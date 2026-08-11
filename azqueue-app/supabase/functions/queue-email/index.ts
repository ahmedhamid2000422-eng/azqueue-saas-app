// Supabase Edge Function — queue notification emails via Resend.
//
// Deploy:  supabase functions deploy queue-email
// Secrets: RESEND_API_KEY (already set for invite-staff)
//
// Body: { type, to, name, branchName, token?, position?, counter?, staffName?,
//         when?, serviceName?, message?, ticketUrl? }
//
// type ∈ "checkin" | "called" | "wait" | "booking" | "alert"
//
// Returns { ok, dryRun?, messageId? }. Never 500s the caller's flow for a
// missing key — returns a dry-run 200 so the queue keeps working.
//
// Transactional only: these are confirmations for a service the customer
// actively requested. No marketing, no A2P registration required.

const FROM_EMAIL    = "AzQueue <noreply@azqueue.io>";
const FALLBACK_FROM = "AzQueue <onboarding@resend.dev>";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")   return new Response("Method not allowed", { status: 405 });

  let b: Record<string, string | number | undefined>;
  try { b = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const type       = String(b.type ?? "");
  const to         = String(b.to ?? "");
  const name       = String(b.name ?? "there");
  const branchName = String(b.branchName ?? "AzQueue");

  if (!to || !type) return json({ error: "type and to are required" }, 400);

  const content = buildContent(type, {
    name, branchName,
    token:       b.token       ? String(b.token)       : "",
    position:    b.position    != null ? Number(b.position) : null,
    counter:     b.counter     ? String(b.counter)     : "",
    staffName:   b.staffName   ? String(b.staffName)   : "",
    when:        b.when        ? String(b.when)        : "",
    serviceName: b.serviceName ? String(b.serviceName) : "",
    message:     b.message     ? String(b.message)     : "",
    ticketUrl:   b.ticketUrl   ? String(b.ticketUrl)   : "",
  });

  if (!content) return json({ error: `unknown type "${type}"` }, 400);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.log(`[queue-email] dry-run → ${type} to ${to}`);
    return json({ ok: true, dryRun: true, missing: "RESEND_API_KEY" });
  }

  const send = (from: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to:      [to],
        subject: content.subject,
        html:    content.html,
        text:    content.text,
      }),
    });

  let res  = await send(FROM_EMAIL);
  let data = await res.json() as Record<string, unknown>;

  if (!res.ok && String(data?.message ?? "").toLowerCase().includes("domain")) {
    res  = await send(FALLBACK_FROM);
    data = await res.json() as Record<string, unknown>;
  }

  if (!res.ok) {
    console.error("[queue-email] Resend error:", data);
    return json({ ok: false, error: data?.message ?? "Failed to send" }, 500);
  }

  return json({ ok: true, messageId: data?.id });
});

/* ── Content per notification type ──────────────────────────────────────── */

type Ctx = {
  name: string; branchName: string; token: string;
  position: number | null; counter: string; staffName: string;
  when: string; serviceName: string; message: string; ticketUrl: string;
};

function buildContent(type: string, c: Ctx) {
  switch (type) {
    case "checkin": {
      const pos = c.position && c.position > 0
        ? `There ${c.position === 1 ? "is" : "are"} ${c.position} ${c.position === 1 ? "person" : "people"} ahead of you.`
        : `You're next in line.`;
      return wrap({
        subject:  `You're checked in at ${c.branchName} — ticket ${c.token}`,
        heading:  `You're checked in`,
        lead:     `Hi ${c.name}, you've joined the queue at ${c.branchName}.`,
        badge:    c.token,
        badgeCap: "Your ticket",
        body:     [pos, `We'll email you again when it's your turn.`],
        cta:      c.ticketUrl ? { label: "Track your place in line", url: c.ticketUrl } : null,
        branchName: c.branchName,
      });
    }

    case "called": {
      const where = c.counter
        ? `Please head to ${c.counter}.`
        : `Please head to the front desk.`;
      const who = c.staffName ? ` ${c.staffName} is ready for you.` : "";
      return wrap({
        subject:  `It's your turn at ${c.branchName} — ticket ${c.token}`,
        heading:  `It's your turn`,
        lead:     `Hi ${c.name}, we're ready for you now.`,
        badge:    c.token,
        badgeCap: "Now serving",
        body:     [`${where}${who}`],
        cta:      null,
        branchName: c.branchName,
      });
    }

    case "wait": {
      return wrap({
        subject:  `You're almost up at ${c.branchName}`,
        heading:  `Almost your turn`,
        lead:     `Hi ${c.name}, you're getting close to the front of the queue.`,
        badge:    c.position != null ? `#${c.position}` : c.token,
        badgeCap: "Your position",
        body:     [`Please make your way back if you've stepped out.`],
        cta:      c.ticketUrl ? { label: "Track your place in line", url: c.ticketUrl } : null,
        branchName: c.branchName,
      });
    }

    case "booking": {
      const detail = [c.serviceName, c.when].filter(Boolean).join(" · ");
      return wrap({
        subject:  `Your appointment at ${c.branchName} is confirmed`,
        heading:  `Appointment confirmed`,
        lead:     `Hi ${c.name}, your booking at ${c.branchName} is set.`,
        badge:    c.when || c.token,
        badgeCap: "When",
        body:     detail ? [detail] : [],
        cta:      c.ticketUrl ? { label: "View booking", url: c.ticketUrl } : null,
        branchName: c.branchName,
      });
    }

    case "alert": {
      return wrap({
        subject:  `Update from ${c.branchName}`,
        heading:  `A note from ${c.branchName}`,
        lead:     `Hi ${c.name},`,
        badge:    "",
        badgeCap: "",
        body:     [c.message],
        cta:      null,
        branchName: c.branchName,
      });
    }

    default:
      return null;
  }
}

/* ── Shared HTML shell ──────────────────────────────────────────────────── */

function wrap(o: {
  subject: string; heading: string; lead: string;
  badge: string; badgeCap: string; body: string[];
  cta: { label: string; url: string } | null;
  branchName: string;
}) {
  const paras = o.body.filter(Boolean)
    .map(p => `<p style="margin:0 0 14px;color:#4a4a44;font-size:15px;line-height:1.65;">${esc(p)}</p>`)
    .join("");

  const badgeBlock = o.badge ? `
    <div style="border:1px solid #e5e0d5;background:#faf8f4;padding:20px;text-align:center;margin:0 0 24px;">
      <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8a857c;margin-bottom:6px;">${esc(o.badgeCap)}</div>
      <div style="font-size:32px;font-weight:600;color:#1a1a17;letter-spacing:.02em;">${esc(o.badge)}</div>
    </div>` : "";

  const ctaBlock = o.cta ? `
    <div style="margin:0 0 8px;">
      <a href="${esc(o.cta.url)}" style="display:inline-block;background:#c9a86a;color:#1a1a17;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;">${esc(o.cta.label)}</a>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f2ed;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ed;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e0d5;">
        <tr><td style="padding:32px 32px 8px;">
          <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#c9a86a;margin-bottom:10px;">${esc(o.branchName)}</div>
          <h1 style="margin:0 0 12px;font-size:26px;font-weight:400;color:#1a1a17;letter-spacing:-.01em;">${esc(o.heading)}</h1>
          <p style="margin:0 0 20px;color:#4a4a44;font-size:15px;line-height:1.65;">${esc(o.lead)}</p>
        </td></tr>
        <tr><td style="padding:0 32px;">${badgeBlock}${paras}${ctaBlock}</td></tr>
        <tr><td style="padding:24px 32px 32px;border-top:1px solid #efece4;">
          <p style="margin:0;color:#8a857c;font-size:11px;line-height:1.6;">
            You're receiving this because you checked in or booked with ${esc(o.branchName)}.
            Powered by AzQueue.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    o.branchName.toUpperCase(),
    "",
    o.heading,
    o.lead,
    o.badge ? `${o.badgeCap}: ${o.badge}` : "",
    ...o.body,
    o.cta ? `${o.cta.label}: ${o.cta.url}` : "",
    "",
    `You're receiving this because you checked in or booked with ${o.branchName}. Powered by AzQueue.`,
  ].filter(Boolean).join("\n");

  return { subject: o.subject, html, text };
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
