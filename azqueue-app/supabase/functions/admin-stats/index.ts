// Supabase Edge Function — platform admin stats.
//
// Returns aggregated metrics + recent signups for the AzQueue platform.
// Only callable by users with user_metadata.platform_admin = true.
//
// Deploy:  supabase functions deploy admin-stats
//
// The function uses the SERVICE ROLE key to bypass RLS — but verifies the
// caller is an admin first by reading their JWT via the anon key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1. Identify caller from the Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthenticated" }, 401);

  const isAdmin = userData.user.user_metadata?.platform_admin === true;
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  // 2. Now use service role to query aggregates that bypass RLS
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Total counts
  const [{ count: branchCount }, { count: ticketCount }, { count: bookingCount }, { count: staffCount }] = await Promise.all([
    admin.from("branches").select("id", { count: "exact", head: true }),
    admin.from("tickets") .select("id", { count: "exact", head: true }),
    admin.from("bookings").select("id", { count: "exact", head: true }),
    admin.from("staff")   .select("id", { count: "exact", head: true }),
  ]);

  // Recent signups via auth admin API
  const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  const allUsers = usersData?.users ?? [];
  const sortedRecent = [...allUsers]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      mode: u.user_metadata?.mode ?? "business",
      tier: u.user_metadata?.tier ?? null,
      business_name: u.user_metadata?.business_name ?? null,
      display_name:  u.user_metadata?.display_name  ?? null,
    }));

  // Mode + tier breakdowns from full user list
  const modeBreakdown = { business: 0, personal: 0 };
  const tierBreakdown = { essential: 0, professional: 0, executive: 0, manager: 0 };
  for (const u of allUsers) {
    const m = u.user_metadata?.mode ?? "business";
    if (modeBreakdown[m] != null) modeBreakdown[m]++;
    const t = u.user_metadata?.tier;
    if (t && tierBreakdown[t] != null) tierBreakdown[t]++;
  }

  // Signup trend — last 30 days bucketed by day
  const signupsByDay = {};
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    signupsByDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const u of allUsers) {
    const day = u.created_at?.slice(0, 10);
    if (day in signupsByDay) signupsByDay[day]++;
  }
  const trend = Object.entries(signupsByDay)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // Top businesses by ticket volume (last 30 days)
  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const { data: branchesData } = await admin
    .from("branches")
    .select("id, name, slug, owner_id, created_at, lat, lng")
    .order("created_at", { ascending: false })
    .limit(50);

  const branches = branchesData ?? [];
  const branchTicketCounts = {};
  if (branches.length) {
    const branchIds = branches.map((b) => b.id);
    const { data: tk } = await admin
      .from("tickets")
      .select("branch_id")
      .in("branch_id", branchIds)
      .gte("created_at", thirtyAgo.toISOString());
    for (const t of tk ?? []) {
      branchTicketCounts[t.branch_id] = (branchTicketCounts[t.branch_id] ?? 0) + 1;
    }
  }

  const topBranches = branches
    .map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      created_at: b.created_at,
      tickets_30d: branchTicketCounts[b.id] ?? 0,
    }))
    .sort((a, b) => b.tickets_30d - a.tickets_30d)
    .slice(0, 10);

  return json({
    ok: true,
    totals: {
      users:    allUsers.length,
      branches: branchCount ?? 0,
      tickets:  ticketCount ?? 0,
      bookings: bookingCount ?? 0,
      staff:    staffCount ?? 0,
    },
    modeBreakdown,
    tierBreakdown,
    recentSignups: sortedRecent,
    signupTrend: trend,
    topBranches,
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    status,
  });
}
