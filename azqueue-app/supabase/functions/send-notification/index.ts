// Supabase Edge Function — sends a WhatsApp message via Twilio.
//
// Deploy with:  supabase functions deploy send-notification
//
// Required env vars (set with `supabase secrets set ...`):
//   TWILIO_ACCOUNT_SID       — your Twilio Account SID
//   TWILIO_AUTH_TOKEN        — your Twilio Auth Token
//   TWILIO_WHATSAPP_FROM     — your sandbox/business number, e.g. "whatsapp:+14155238886"
//
// Body:
//   { ticketId, template }   where template is one of: "confirm" | "call" | "thanks" | "prayer_pause"
//
// What it does:
//   1. Looks up the ticket + branch + service
//   2. Renders the template into a localised message
//   3. Sends via Twilio's WhatsApp API
//   4. Logs the result into notifications_log
//
// If TWILIO_* env vars are missing, the function logs the would-be message to
// notifications_log with status = "queued" and returns 200 with a dry-run flag.
// This lets the rest of the app behave normally while you finish Twilio setup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TEMPLATES = {
  confirm: ({ token, branchName, serviceName }) =>
    `${branchName}\n\nYou're checked in. Ticket ${token} for ${serviceName ?? "your service"}. We'll WhatsApp again when you're up.`,

  call: ({ token, branchName }) =>
    `${branchName}\n\nYou're up — please come to the counter. Ticket ${token}.`,

  thanks: ({ token, branchName }) =>
    `${branchName}\n\nThanks for visiting. Tap to rate your experience: ★ ★ ★ ★ ★\n(Ticket ${token})`,

  prayer_pause: ({ token, branchName, prayerName, resumeTime }) =>
    `${branchName}\n\nWe're pausing briefly for ${prayerName}. Your ticket ${token} keeps its place — service resumes at ${resumeTime}.`,
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { ticketId, template, extras = {} } = body;
  if (!ticketId || !template || !TEMPLATES[template]) {
    return new Response("Missing/invalid ticketId or template", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Hydrate ticket + branch + service
  const { data: ticket, error: tErr } = await supabase
    .from("tickets")
    .select("*, branches(*), services(name)")
    .eq("id", ticketId)
    .single();

  if (tErr || !ticket) {
    return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404 });
  }

  const message = TEMPLATES[template]({
    token: ticket.token,
    branchName: ticket.branches?.name ?? "Your business",
    serviceName: ticket.services?.name,
    ...extras,
  });

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM");

  // Dry-run mode — no credentials yet. Log what we *would* send.
  if (!sid || !auth || !from) {
    await supabase.from("notifications_log").insert({
      branch_id: ticket.branch_id,
      ticket_id: ticket.id,
      channel: "whatsapp",
      template,
      to_phone: ticket.customer_phone,
      status: "queued",
      error: "dry-run · Twilio credentials not configured yet",
    });
    return new Response(
      JSON.stringify({ dryRun: true, message, would_send_to: ticket.customer_phone }),
      { headers: { "content-type": "application/json" } }
    );
  }

  // 2. Send via Twilio
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams({
    From: from,                                                  // e.g. "whatsapp:+14155238886"
    To:   `whatsapp:${normalisePhone(ticket.customer_phone)}`,
    Body: message,
  });

  let result, errorText = null;
  try {
    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${sid}:${auth}`),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    result = await res.json();
    if (!res.ok) errorText = result?.message ?? `Twilio ${res.status}`;
  } catch (e) {
    errorText = (e as Error).message;
  }

  // 3. Log it
  await supabase.from("notifications_log").insert({
    branch_id: ticket.branch_id,
    ticket_id: ticket.id,
    channel: "whatsapp",
    template,
    to_phone: ticket.customer_phone,
    status: errorText ? "failed" : "sent",
    error: errorText,
    sent_at: errorText ? null : new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({ ok: !errorText, error: errorText, twilio: result }),
    { headers: { "content-type": "application/json" }, status: errorText ? 500 : 200 }
  );
});

function normalisePhone(p: string): string {
  if (!p) return "";
  const trimmed = p.replace(/[\s\-()]/g, "");
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}
