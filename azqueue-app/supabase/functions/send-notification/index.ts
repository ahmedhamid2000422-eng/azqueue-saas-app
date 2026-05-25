// Supabase Edge Function — sends WhatsApp or SMS notifications via Twilio.
//
// Deploy with:  supabase functions deploy send-notification
//
// Required env vars (set with `supabase secrets set ...`):
//   TWILIO_ACCOUNT_SID       — your Twilio Account SID (starts with AC...)
//   TWILIO_AUTH_TOKEN        — your Twilio Auth Token
//   TWILIO_WHATSAPP_FROM     — WhatsApp sender, e.g. "whatsapp:+14155238886"
//   TWILIO_SMS_FROM          — SMS sender phone number, e.g. "+14155238886"
//
// Body:
//   { ticketId, template, channel? }
//   channel: "whatsapp" (default) | "sms"
//   template: "confirm" | "call" | "thanks" | "prayer_pause"
//
// If TWILIO_* env vars are missing, logs a dry-run entry and returns 200.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TEMPLATES = {
  confirm: ({ token, branchName, serviceName }) =>
    `${branchName}: You're checked in. Ticket ${token} for ${serviceName ?? "your service"}. We'll message you when you're up.`,

  call: ({ token, branchName }) =>
    `${branchName}: You're up — please come to the counter now. Ticket ${token}.`,

  thanks: ({ token, branchName }) =>
    `${branchName}: Thanks for visiting! Ticket ${token} is complete. Hope to see you again soon.`,

  prayer_pause: ({ token, branchName, prayerName, resumeTime }) =>
    `${branchName}: Pausing briefly for ${prayerName}. Your ticket ${token} keeps its place — service resumes at ${resumeTime}.`,
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { ticketId, template, channel = "whatsapp", extras = {} } = body;

  if (!ticketId || !template || !TEMPLATES[template]) {
    return new Response("Missing/invalid ticketId or template", { status: 400 });
  }
  if (channel !== "whatsapp" && channel !== "sms") {
    return new Response("channel must be 'whatsapp' or 'sms'", { status: 400 });
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

  const sid  = Deno.env.get("TWILIO_ACCOUNT_SID");
  const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");
  const smsFrom      = Deno.env.get("TWILIO_SMS_FROM");

  // Resolve the From number for the requested channel
  const fromNumber = channel === "sms" ? smsFrom : whatsappFrom;
  const toNumber   = channel === "sms"
    ? normalisePhone(ticket.customer_phone)
    : `whatsapp:${normalisePhone(ticket.customer_phone)}`;

  // Dry-run mode — credentials not yet configured
  if (!sid || !auth || !fromNumber) {
    const missing = [
      !sid  && "TWILIO_ACCOUNT_SID",
      !auth && "TWILIO_AUTH_TOKEN",
      !fromNumber && (channel === "sms" ? "TWILIO_SMS_FROM" : "TWILIO_WHATSAPP_FROM"),
    ].filter(Boolean).join(", ");

    await supabase.from("notifications_log").insert({
      branch_id:  ticket.branch_id,
      ticket_id:  ticket.id,
      channel,
      template,
      to_phone:   ticket.customer_phone,
      status:     "queued",
      error:      `dry-run · missing: ${missing}`,
    });

    return new Response(
      JSON.stringify({ dryRun: true, missing, message, would_send_to: ticket.customer_phone }),
      { headers: { "content-type": "application/json" } }
    );
  }

  // 2. Send via Twilio
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams({
    From: fromNumber,   // "whatsapp:+14155238886" for WA, "+14155238886" for SMS
    To:   toNumber,
    Body: message,
  });

  let result, errorText: string | null = null;
  try {
    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${sid}:${auth}`),
        "content-type":  "application/x-www-form-urlencoded",
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
    branch_id:  ticket.branch_id,
    ticket_id:  ticket.id,
    channel,
    template,
    to_phone:   ticket.customer_phone,
    status:     errorText ? "failed" : "sent",
    error:      errorText,
    sent_at:    errorText ? null : new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({ ok: !errorText, channel, error: errorText, twilio: result }),
    { headers: { "content-type": "application/json" }, status: errorText ? 500 : 200 }
  );
});

function normalisePhone(p: string): string {
  if (!p) return "";
  const trimmed = p.replace(/[\s\-()]/g, "");
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}
