// health-check — does a customer check-in still work?
//
// WHY THIS EXISTS
// Twice now, customer check-in broke in production and the first people to
// know were customers standing in the office. Mohamed found out from them,
// in front of clients. The bug each time was invisible to everyone signed in:
//
//   Sept — tickets.source gained 'kiosk'/'own_device' but the anon INSERT
//          policy still demanded source = 'walk'. Staff unaffected.
//   Nov  — 0060 removed anon SELECT to close a PII leak, and the check-in
//          code used .insert().select(), whose RETURNING needs SELECT.
//          Row written, read-back refused, customer told it failed.
//
// THE DESIGN POINT THAT MATTERS
// This runs with the ANON key, not the service role. A service-role check
// would have passed cheerfully through both outages, because both were
// permission problems. The monitor has to be as powerless as a customer or
// it is not testing anything.
//
// It writes a real ticket with is_test = true — already filtered out of every
// statistic in the product — then deletes it. A check that stops short of
// writing would not have caught either outage.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY          = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY");
const ALERT_TO          = Deno.env.get("HEALTH_ALERT_EMAIL");
const BRANCH_SLUG       = Deno.env.get("HEALTH_BRANCH_SLUG") ?? "az-tax-services";
const SITE_URL          = Deno.env.get("HEALTH_SITE_URL") ?? "https://www.azqueue.io";

/* Quiet hours are deliberately NOT observed. A 3am failure is still a
   failure, and knowing at 3am beats finding out at 9am from a customer. */

type Step = { step: string; ok: boolean; detail?: string };

/* THE WEBSITE IS A SEPARATE FAILURE DOMAIN FROM THE DATABASE.
   Vercel and Supabase go down independently. A database-only check reports
   green while customers stare at a white screen — and the opposite is just
   as possible. Both have to be tested or the monitor is only watching half
   the system.

   Three distinct ways the site breaks, all seen in this project:
     - the host is down or DNS fails           -> page does not load
     - a build shipped broken                  -> page loads, no app root
     - a stale service worker references a JS  -> asset 404s, and because
       bundle that no longer exists               SPA routing serves
                                                  index.html for anything
                                                  missing, it comes back as
                                                  HTML rather than a 404 */
async function checkSite(steps: Step[]): Promise<boolean> {
  const pageUrl = `${SITE_URL}/q/${BRANCH_SLUG}`;
  let html = "";

  try {
    const res = await fetch(pageUrl, { headers: { "Cache-Control": "no-cache" } });
    html = await res.text();
    const ok = res.ok && html.includes('id="root"');
    steps.push({
      step: "load check-in page",
      ok,
      detail: ok ? undefined : `HTTP ${res.status}${html.includes('id="root"') ? "" : ", no app root in HTML"}`,
    });
    if (!ok) return false;
  } catch (err) {
    steps.push({ step: "load check-in page", ok: false, detail: String(err) });
    return false;
  }

  /* Follow the script the page actually asks for. A 200 that returns HTML is
     the stale-bundle failure: the asset is gone, SPA routing answers with
     index.html, and the app never starts. */
  const m = html.match(/<script[^>]+src="([^"]+\.js)"/);
  if (!m) {
    steps.push({ step: "find app bundle", ok: false, detail: "no script tag in HTML" });
    return false;
  }

  const assetUrl = m[1].startsWith("http") ? m[1] : `${SITE_URL}${m[1]}`;
  try {
    const res = await fetch(assetUrl);
    const type = res.headers.get("content-type") ?? "";
    const ok = res.ok && type.includes("javascript");
    steps.push({
      step: "load app bundle",
      ok,
      detail: ok ? undefined : `HTTP ${res.status}, content-type ${type || "none"}`,
    });
    return ok;
  } catch (err) {
    steps.push({ step: "load app bundle", ok: false, detail: String(err) });
    return false;
  }
}

async function run(): Promise<{ ok: boolean; steps: Step[] }> {
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const steps: Step[] = [];
  let ticketId: string | null = null;

  // The site has to be reachable before anything else is worth testing.
  const siteOk = await checkSite(steps);
  if (!siteOk) return { ok: false, steps };

  // 1. Can an anonymous visitor find the branch? (public read)
  const { data: branch, error: bErr } = await anon
    .from("branches")
    .select("id, slug, name")
    .eq("slug", BRANCH_SLUG)
    .maybeSingle();
  steps.push({ step: "read branch", ok: !bErr && !!branch, detail: bErr?.message });
  if (bErr || !branch) return { ok: false, steps };

  // 2. Are there services to choose from? An empty list is a dead kiosk.
  const { data: services, error: sErr } = await anon
    .from("services")
    .select("id, name")
    .eq("branch_id", branch.id)
    .eq("active", true)
    .limit(1);
  const haveService = !sErr && (services?.length ?? 0) > 0;
  steps.push({ step: "read services", ok: haveService, detail: sErr?.message ?? (haveService ? undefined : "no active services") });
  if (!haveService) return { ok: false, steps };

  // 3. Can a token be generated? (RPC, anon-executable)
  const { data: token, error: tErr } = await anon
    .rpc("generate_ticket_token", { b_id: branch.id, src: "walk" });
  steps.push({ step: "generate token", ok: !tErr && !!token, detail: tErr?.message });
  if (tErr || !token) return { ok: false, steps };

  // 4. THE ONE THAT MATTERS — write a ticket exactly as the kiosk does.
  ticketId = crypto.randomUUID();
  const { error: iErr } = await anon.from("tickets").insert({
    id: ticketId,
    branch_id: branch.id,
    service_id: services![0].id,
    token,
    source: "own_device",
    status: "waiting",
    is_test: true,
    customer_name: "AzQueue health check",
  });
  steps.push({ step: "insert ticket (as anon)", ok: !iErr, detail: iErr?.message });

  // 5. Clean up with the service role, whatever happened above.
  if (ticketId) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    await admin.from("tickets").delete().eq("id", ticketId);
  }

  return { ok: steps.every((s) => s.ok), steps };
}

async function alert(steps: Step[]) {
  if (!RESEND_API_KEY || !ALERT_TO) return;
  const failed = steps.filter((s) => !s.ok);
  const body = [
    "Customer check-in is failing on azqueue.io.",
    "",
    ...steps.map((s) => `${s.ok ? "OK  " : "FAIL"}  ${s.step}${s.detail ? " — " + s.detail : ""}`),
    "",
    "Checked as an anonymous visitor, the same as a customer at the kiosk —",
    "covering both the website (Vercel) and the database (Supabase).",
    "Nobody in the office has been told.",
  ].join("\n");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "AzQueue <noreply@azqueue.io>",
      to: [ALERT_TO],
      subject: `AzQueue check-in DOWN — ${failed[0]?.step ?? "unknown step"}`,
      text: body,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const result = await run();
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  /* Record every run, pass or fail. Uptime is only meaningful against a
     denominator, and a silent monitor is the thing being fixed here. */
  const { data: previous } = await admin
    .from("health_checks")
    .select("ok")
    .order("checked_at", { ascending: false })
    .limit(1);

  await admin.from("health_checks").insert({
    ok: result.ok,
    steps: result.steps,
  });

  /* Email on the TRANSITION into failure, not on every run. A broken
     check-in at five-minute intervals would send 288 emails a day and be
     filtered within an hour — which is the same as no alert at all. */
  const wasOk = previous?.[0]?.ok ?? true;
  if (!result.ok && wasOk) await alert(result.steps);

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 503,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
