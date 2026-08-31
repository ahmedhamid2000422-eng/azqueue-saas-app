// Supabase Edge Function — visit feedback email.
//
// WHAT IT DOES
// Finds visits that finished a couple of hours ago, emails that customer one
// question — how did it go? — and records that we asked so nobody is asked
// twice.
//
// WHY THE DELAY
// Sending the instant someone walks out gets answered in the car park by
// people still feeling the queue, not the service. A couple of hours later
// reads as considered rather than automated. It's also short enough that the
// visit is still fresh.
//
// SETUP
//   Deploy as `visit-survey`, Verify JWT OFF (called by cron).
//   Secrets: RESEND_API_KEY, SUPABASE_URL, SB_SECRET_KEY (or
//            SUPABASE_SERVICE_ROLE_KEY), SURVEY_SECRET, APP_URL
//
// CONSENT
// This is a transactional message about a service the person just received,
// sent once, to an address they gave us for this visit. It carries no
// marketing and no offers. If that ever changes, it becomes marketing and
// needs an unsubscribe link and a postal address under CAN-SPAM.

const RESEND = Deno.env.get("RESEND_API_KEY");
const URL_   = Deno.env.get("SUPABASE_URL");
const KEY    = Deno.env.get("SB_SECRET_KEY")
            ?? Deno.env.get("SUPABASE_SECRET_KEY")
            ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SECRET = Deno.env.get("SURVEY_SECRET");
const APP    = Deno.env.get("APP_URL") ?? "https://azqueue.io";
const FROM   = Deno.env.get("SURVEY_FROM") ?? "AzQueue <hello@azqueue.io>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...cors } });

/* How long after a visit ends we ask, and how far back we're willing to
   look. The upper bound stops a backlog turning into a mass send if the job
   has been down for days — nobody wants a survey about a visit last week. */
const WAIT_HOURS = 2;
const MAX_HOURS  = 26;

async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function emailHtml(o: { name: string; business: string; url: string }) {
  const first = (o.name ?? "").trim().split(/\s+/)[0] || "there";
  /* Five links rather than a form: one tap from the inbox is the difference
     between a 2% and a 20% response rate, and the page can collect the
     comment afterwards from people who want to leave one. */
  const faces = [
    { r: 5, label: "Great" },
    { r: 4, label: "Good" },
    { r: 3, label: "OK" },
    { r: 2, label: "Poor" },
    { r: 1, label: "Bad" },
  ];
  const buttons = faces.map((f) =>
    `<a href="${o.url}&r=${f.r}" style="display:inline-block;padding:10px 16px;margin:0 4px 8px 0;` +
    `border:1px solid #c9a86a;color:#8a7340;text-decoration:none;font-size:13px;">${f.label}</a>`
  ).join("");

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#faf8f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2b2a26;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e8e2d6;padding:28px;">
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hello ${first},</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
    Thank you for coming in to ${o.business} today. How did it go?
  </p>
  <div style="margin:0 0 20px;">${buttons}</div>
  <p style="font-size:13px;line-height:1.6;color:#6b6a64;margin:0;">
    One tap is all we need. There's a box for anything else you'd like to say.
  </p>
  <p style="font-size:12px;line-height:1.6;color:#9a9890;margin:24px 0 0;border-top:1px solid #eee;padding-top:14px;">
    Sent once, about your visit today. We won't email you again about it.
  </p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  /* Called by cron, so it's authenticated by a shared secret rather than a
     user session. Accepts either a header or a query param — pg_net finds
     headers fiddly. */
  const url = new URL(req.url);
  const given = req.headers.get("x-survey-secret") ?? url.searchParams.get("secret");
  if (!SECRET || given !== SECRET) return json({ ok: false, error: "unauthorized" }, 401);

  if (!RESEND) return json({ ok: false, error: "RESEND_API_KEY not set" }, 500);
  if (!KEY)    return json({ ok: false, error: "service key not set" }, 500);

  const now   = Date.now();
  const upper = new Date(now - WAIT_HOURS * 3_600_000).toISOString();
  const lower = new Date(now - MAX_HOURS  * 3_600_000).toISOString();

  /* Eligible: finished in the window, has an email, hasn't been asked. */
  const tickets = await db(
    `tickets?select=id,branch_id,customer_name,customer_email,completed_at` +
    `&status=eq.completed` +
    `&completed_at=lte.${upper}&completed_at=gte.${lower}` +
    `&survey_sent_at=is.null` +
    `&customer_email=not.is.null` +
    `&limit=200`
  ) as Array<Record<string, string>>;

  if (!tickets?.length) return json({ ok: true, sent: 0, note: "nothing eligible" });

  /* Branch names and slugs, one lookup rather than one per ticket. */
  const ids = [...new Set(tickets.map((t) => t.branch_id))];
  const branches = await db(
    `branches?select=id,name,slug&id=in.(${ids.join(",")})`
  ) as Array<{ id: string; name: string; slug: string }>;
  const byId = Object.fromEntries(branches.map((b) => [b.id, b]));

  let sent = 0;
  const failures: string[] = [];

  for (const t of tickets) {
    const b = byId[t.branch_id];
    if (!b) continue;

    const surveyUrl = `${APP}/survey/${b.slug}?ticket=${t.id}`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: t.customer_email,
          subject: `How was your visit to ${b.name}?`,
          html: emailHtml({ name: t.customer_name, business: b.name, url: surveyUrl }),
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);

      /* Mark AFTER a successful send, so a failure retries next run rather
         than silently losing the request. */
      await db(`tickets?id=eq.${t.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ survey_sent_at: new Date().toISOString() }),
      });
      sent += 1;
    } catch (e) {
      failures.push(`${t.id}: ${(e as Error).message}`);
    }
  }

  if (failures.length) console.error("[visit-survey]", failures.slice(0, 5));
  return json({ ok: true, sent, eligible: tickets.length, failed: failures.length });
});
