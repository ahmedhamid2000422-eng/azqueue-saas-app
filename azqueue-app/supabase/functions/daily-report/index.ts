// Supabase Edge Function — end-of-day summary email.
//
// SETUP
//   1. Deploy as `daily-report`, Verify JWT OFF
//   2. Secrets already needed: RESEND_API_KEY
//      New secrets:  REPORT_EMAIL   — where to send (e.g. you@gmail.com)
//                    REPORT_SECRET  — any random string; the cron job sends it
//   3. Schedule it with the SQL in migration 0043
//
// Body (all optional):
//   { secret, to, branchId, date }   date = "YYYY-MM-DD", defaults to today
//
// Returns { ok, sent, stats }.

const FROM_EMAIL    = "AzQueue <noreply@azqueue.io>";
const FALLBACK_FROM = "AzQueue <onboarding@resend.dev>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...cors } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SB_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Thin REST helper — avoids pulling in the whole supabase-js client. */
async function q(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error("[daily-report] query failed", path, res.status, (await res.text()).slice(0, 200));
    return [];
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405 });

  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  // Shared-secret check — the function is public (no JWT) so the cron job can
  // reach it, but only the cron job knows this value.
  const expected = Deno.env.get("REPORT_SECRET");
  if (expected && body.secret !== expected) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const to = body.to ?? Deno.env.get("REPORT_EMAIL");
  if (!to) return json({ ok: false, error: "no recipient — set REPORT_EMAIL" }, 400);

  // Day window. Defaults to today in the branch's local sense; we use UTC
  // bounds which is close enough for a summary and avoids tz gymnastics.
  const day   = body.date ?? new Date().toISOString().slice(0, 10);
  const from  = `${day}T00:00:00.000Z`;
  const until = `${day}T23:59:59.999Z`;

  const branches = body.branchId
    ? await q(`branches?select=id,name&id=eq.${body.branchId}`)
    : await q(`branches?select=id,name&order=created_at`);

  if (branches.length === 0) return json({ ok: false, error: "no branches" }, 404);

  const sections: string[] = [];
  const summary: Record<string, unknown>[] = [];

  for (const b of branches) {
    const [tickets, bookings, surveys] = await Promise.all([
      q(`tickets?select=id,status,created_at,called_at,started_at,completed_at,service_id&branch_id=eq.${b.id}&created_at=gte.${from}&created_at=lte.${until}`),
      q(`bookings?select=id,status&branch_id=eq.${b.id}&scheduled_at=gte.${from}&scheduled_at=lte.${until}`),
      q(`surveys?select=rating&branch_id=eq.${b.id}&created_at=gte.${from}&created_at=lte.${until}`),
    ]);

    const served    = tickets.filter((t) => t.status === "completed");
    const cancelled = tickets.filter((t) => t.status === "cancelled");
    const noShow    = tickets.filter((t) => t.status === "no_show");
    const stillOpen = tickets.filter((t) => t.status === "waiting" || t.status === "serving");

    // Average wait: check-in → called
    const waits = tickets
      .filter((t) => t.called_at)
      .map((t) => (new Date(t.called_at).getTime() - new Date(t.created_at).getTime()) / 60000)
      .filter((m) => m >= 0 && m < 600);
    const avgWait = waits.length ? Math.round(waits.reduce((a, x) => a + x, 0) / waits.length) : null;

    // Average service: started → completed
    const services = served
      .filter((t) => t.started_at && t.completed_at)
      .map((t) => (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 60000)
      .filter((m) => m >= 0 && m < 600);
    const avgService = services.length ? Math.round(services.reduce((a, x) => a + x, 0) / services.length) : null;

    const ratings = surveys.map((s) => Number(s.rating)).filter((n) => Number.isFinite(n));
    const avgRating = ratings.length
      ? (ratings.reduce((a, x) => a + x, 0) / ratings.length).toFixed(1)
      : null;

    const stats = {
      branch: b.name,
      checkedIn: tickets.length,
      served: served.length,
      cancelled: cancelled.length,
      noShow: noShow.length,
      stillOpen: stillOpen.length,
      bookings: bookings.length,
      avgWaitMin: avgWait,
      avgServiceMin: avgService,
      avgRating,
      reviews: ratings.length,
    };
    summary.push(stats);
    sections.push(renderBranch(stats));
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.log("[daily-report] dry-run — no RESEND_API_KEY", summary);
    return json({ ok: true, dryRun: true, stats: summary });
  }

  const prettyDay = new Date(day + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });

  const html = shell(prettyDay, sections.join(""));
  const text = summary.map((s) => JSON.stringify(s)).join("\n");

  const send = (fromAddr: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddr,
        to: [to],
        subject: `AzQueue daily report — ${prettyDay}`,
        html,
        text,
      }),
    });

  let res  = await send(FROM_EMAIL);
  let data = await res.json() as Record<string, unknown>;
  if (!res.ok && String(data?.message ?? "").toLowerCase().includes("domain")) {
    res  = await send(FALLBACK_FROM);
    data = await res.json() as Record<string, unknown>;
  }
  if (!res.ok) {
    console.error("[daily-report] Resend error", data);
    return json({ ok: false, error: data?.message ?? "send failed" }, 502);
  }

  return json({ ok: true, sent: to, messageId: data?.id, stats: summary });
});

/* ── Rendering ─────────────────────────────────────────────────────── */

function stat(label: string, value: string | number | null, hint = "") {
  return `
    <td style="padding:14px 10px;text-align:center;border:1px solid #e5e0d5;">
      <div style="font-size:24px;font-weight:600;color:#1a1a17;">${value ?? "—"}</div>
      <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8a857c;margin-top:4px;">${label}</div>
      ${hint ? `<div style="font-size:10px;color:#b0aba1;margin-top:2px;">${hint}</div>` : ""}
    </td>`;
}

function renderBranch(s: any) {
  return `
    <div style="margin:0 0 28px;">
      <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#c9a86a;margin-bottom:10px;">${esc(s.branch)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
        <tr>
          ${stat("Checked in", s.checkedIn)}
          ${stat("Served", s.served)}
          ${stat("Bookings", s.bookings)}
        </tr>
        <tr>
          ${stat("Avg wait", s.avgWaitMin != null ? s.avgWaitMin + "m" : null)}
          ${stat("Avg service", s.avgServiceMin != null ? s.avgServiceMin + "m" : null)}
          ${stat("Rating", s.avgRating ?? null, s.reviews ? `${s.reviews} review${s.reviews === 1 ? "" : "s"}` : "")}
        </tr>
        <tr>
          ${stat("Cancelled", s.cancelled)}
          ${stat("No-shows", s.noShow)}
          ${stat("Left open", s.stillOpen)}
        </tr>
      </table>
    </div>`;
}

function shell(day: string, inner: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f2ed;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ed;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border:1px solid #e5e0d5;">
        <tr><td style="padding:30px 30px 10px;">
          <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#c9a86a;">AzQueue</div>
          <h1 style="margin:8px 0 4px;font-size:24px;font-weight:400;color:#1a1a17;">Daily report</h1>
          <div style="font-size:13px;color:#8a857c;margin-bottom:20px;">${esc(day)}</div>
        </td></tr>
        <tr><td style="padding:0 30px 20px;">${inner}</td></tr>
        <tr><td style="padding:18px 30px 28px;border-top:1px solid #efece4;">
          <p style="margin:0;color:#8a857c;font-size:11px;line-height:1.6;">
            Sent automatically by AzQueue. Times are UTC-based day boundaries.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
