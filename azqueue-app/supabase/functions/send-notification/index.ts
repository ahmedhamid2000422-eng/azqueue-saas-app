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
//   { ticketId, template, channel? }       — ticket-based templates (check-in flow)
//   { bookingId, template, channel? }      — booking-based templates (appointment flow)
//   channel: "whatsapp" (default) | "sms"
//   template: "confirm" | "call" | "thanks" | "prayer_pause" | "booking_confirmation"
//
// Exactly one of ticketId / bookingId must be provided — they hydrate from
// different tables (tickets vs. bookings) and are logged against different
// notifications_log columns.
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

  // Booking-flow confirmation (QA bug B8) — sent once when a customer books
  // an appointment, either via the public /b/:slug page or the in-app
  // Bookings screen. Distinct from "confirm" above, which is the check-in
  // (walk-in queue) message and talks about a ticket token, not a date/time.
  booking_confirmation: ({ branchName, serviceName, customerName, scheduledAt }) =>
    `${branchName}: Hi ${customerName ?? "there"}! Your booking for ${serviceName ?? "your appointment"} is confirmed for ${scheduledAt}. We look forward to seeing you!`,
};

const TICKET_TEMPLATES  = new Set(["confirm", "call", "thanks", "prayer_pause"]);
const BOOKING_TEMPLATES = new Set(["booking_confirmation"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { ticketId, bookingId, template, channel = "whatsapp", extras = {} } = body;

  if (!template || !TEMPLATES[template]) {
    return new Response("Missing/invalid template", { status: 400 });
  }
  if (!ticketId && !bookingId) {
    return new Response("Either ticketId or bookingId is required", { status: 400 });
  }
  if (ticketId && bookingId) {
    return new Response("Provide only one of ticketId / bookingId, not both", { status: 400 });
  }
  if (bookingId && !BOOKING_TEMPLATES.has(template)) {
    return new Response(`Template "${template}" is not valid for a bookingId`, { status: 400 });
  }
  if (ticketId && !TICKET_TEMPLATES.has(template)) {
    return new Response(`Template "${template}" is not valid for a ticketId`, { status: 400 });
  }
  if (channel !== "whatsapp" && channel !== "sms") {
    return new Response("channel must be 'whatsapp' or 'sms'", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Hydrate ticket+branch+service OR booking+branch+service, build the
  // message, and pin down which record this send is logged against.
  let record: { branch_id: string; customer_phone: string };
  let message: string;

  if (ticketId) {
    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("*, branches(*), services(name)")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404 });
    }
    record = ticket;
    message = TEMPLATES[template]({
      token: ticket.token,
      branchName: ticket.branches?.name ?? "Your business",
      serviceName: ticket.services?.name,
      ...extras,
    });
  } else {
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*, branches(*), services(name)")
      .eq("id", bookingId)
      .single();

    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404 });
    }
    record = booking;
    message = TEMPLATES[template]({
      branchName: booking.branches?.name ?? "Your business",
      serviceName: booking.services?.name,
      customerName: booking.customer_name,
      scheduledAt: formatScheduledAt(booking.scheduled_at, booking.branches?.timezone),
      ...extras,
    });
  }

  const sid  = Deno.env.get("TWILIO_ACCOUNT_SID");
  const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");
  const smsFrom      = Deno.env.get("TWILIO_SMS_FROM");

  // Resolve the From number for the requested channel
  const fromNumber = channel === "sms" ? smsFrom : whatsappFrom;
  const toNumber   = channel === "sms"
    ? normalisePhone(record.customer_phone)
    : `whatsapp:${normalisePhone(record.customer_phone)}`;

  const logBase = {
    branch_id:  record.branch_id,
    ticket_id:  ticketId ?? null,
    booking_id: bookingId ?? null,
    channel,
    template,
    to_phone:   record.customer_phone,
  };

  // Dry-run mode — credentials not yet configured
  if (!sid || !auth || !fromNumber) {
    const missing = [
      !sid  && "TWILIO_ACCOUNT_SID",
      !auth && "TWILIO_AUTH_TOKEN",
      !fromNumber && (channel === "sms" ? "TWILIO_SMS_FROM" : "TWILIO_WHATSAPP_FROM"),
    ].filter(Boolean).join(", ");

    await supabase.from("notifications_log").insert({
      ...logBase,
      status: "queued",
      error:  `dry-run · missing: ${missing}`,
    });

    return new Response(
      JSON.stringify({ dryRun: true, missing, message, would_send_to: record.customer_phone }),
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
    ...logBase,
    status:  errorText ? "failed" : "sent",
    error:   errorText,
    sent_at: errorText ? null : new Date().toISOString(),
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

function formatScheduledAt(iso: string, timezone?: string): string {
  if (!iso) return "your scheduled time";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: timezone || undefined,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
