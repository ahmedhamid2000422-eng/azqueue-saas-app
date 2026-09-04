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

/* Every message opens with the business name and the first one a person
   receives carries opt-out instructions. That is a carrier requirement, not a
   style choice — and the A2P campaign's sample messages are compared against
   real traffic, so what is written here has to be what actually sends.

   STOP is on "confirm" because that is the first message of any visit. It is
   left off "call", which arrives moments later and is the one message that
   must be read at a glance while someone is being waved to a counter. */
/* ASCII only, deliberately. An em dash or curly apostrophe is outside GSM-7,
   and a single one forces the whole message into UCS-2 — which cuts a segment
   from 160 characters to 70, so an ordinary message quietly becomes three
   segments at three times the cost. Keep hyphens and straight quotes here. */
const TEMPLATES = {
  /* "via AzQueue" appears on the FIRST message of a visit and nowhere else.
     Two reasons. The recipient consented at a tax office and is now getting a
     text from an unfamiliar number, so naming the platform once answers the
     question they are actually asking. And A2P error 30893 requires at least
     one sample message to carry the registered brand name — every other
     message names the business, which is the customer of that brand. */
  confirm: ({ token, branchName, serviceName }) =>
    `${branchName} via AzQueue: You're checked in. Ticket ${token} for ${serviceName ?? "your service"}. We'll message you when you're up. Reply STOP to opt out.`,

  call: ({ token, branchName }) =>
    `${branchName}: You're up - please come to the counter now. Ticket ${token}.`,

  thanks: ({ token, branchName }) =>
    `${branchName}: Thanks for visiting! Ticket ${token} is complete. Reply STOP to opt out.`,

  /* A BREAK IS A BREAK, WHATEVER THE BUSINESS CALLS IT.
     This was written for prayer times, which is right for a tax office in
     Aurora and meaningless to a barber in Denver or a clinic anywhere. The
     mechanism is identical for all of them — the queue holds, everyone keeps
     their place, service resumes at a stated time. Only the label differs,
     and a label is data, not code.

     So the name is a value the business supplies: "Dhuhr", "Lunch",
     "Cleaning", "Shift change". `prayerName` is still accepted because
     callers across 40-odd files still pass it, and breaking them to rename a
     parameter would be a poor trade.

     A2P note: the approved campaign's sample 5 reads "Pausing briefly for
     [Prayer]" — a bracketed variable, so a different value in that slot is
     the same declared message shape, not new traffic. */
  prayer_pause: ({ token, branchName, prayerName, breakName, resumeTime }) =>
    `${branchName}: Pausing briefly for ${breakName ?? prayerName ?? "a short break"}. Your ticket ${token} keeps its place - service resumes at ${resumeTime}.`,

  // Booking-flow confirmation (QA bug B8) — sent once when a customer books
  // an appointment, either via the public /b/:slug page or the in-app
  // Bookings screen. Distinct from "confirm" above, which is the check-in
  // (walk-in queue) message and talks about a ticket token, not a date/time.
  booking_confirmation: ({ branchName, serviceName, customerName, scheduledAt }) =>
    `${branchName}: Hi ${customerName ?? "there"}! Your booking for ${serviceName ?? "your appointment"} is confirmed for ${scheduledAt}. Reply STOP to opt out.`,
};

/* `break_pause` is the name this should have had. Both keys point at the same
   template, so new code can use the generic name while the forty-odd existing
   callers keep working unchanged. Retire "prayer_pause" when those callers
   are eventually renamed — not before. */
TEMPLATES.break_pause = TEMPLATES.prayer_pause;

const TICKET_TEMPLATES  = new Set(["confirm", "call", "thanks", "prayer_pause", "break_pause"]);
const BOOKING_TEMPLATES = new Set(["booking_confirmation"]);

/**
 * CORS. Every other edge function in this project had these headers; this one
 * never did, which meant the browser refused the request before it was ever
 * sent — the preflight OPTIONS call got no Access-Control-Allow-Origin back
 * and the actual POST never happened.
 *
 * That is why SMS appeared to do nothing while email worked fine from the same
 * check-in: queue-email had CORS, this did not. The failure was invisible in
 * the function's own logs, because the request never reached the function.
 */
const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  /* Preflight. Must come before the method check — the browser sends OPTIONS,
     not POST, and rejecting it as "method not allowed" is what produced the
     CORS error rather than a useful one. */
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: cors });
  }

  const { ticketId, bookingId, template, channel = "whatsapp", extras = {} } = body;

  if (!template || !TEMPLATES[template]) {
    return new Response("Missing/invalid template", { status: 400, headers: cors });
  }
  if (!ticketId && !bookingId) {
    return new Response("Either ticketId or bookingId is required", { status: 400, headers: cors });
  }
  if (ticketId && bookingId) {
    return new Response("Provide only one of ticketId / bookingId, not both", { status: 400, headers: cors });
  }
  if (bookingId && !BOOKING_TEMPLATES.has(template)) {
    return new Response(`Template "${template}" is not valid for a bookingId`, { status: 400, headers: cors });
  }
  if (ticketId && !TICKET_TEMPLATES.has(template)) {
    return new Response(`Template "${template}" is not valid for a ticketId`, { status: 400, headers: cors });
  }
  if (channel !== "whatsapp" && channel !== "sms") {
    return new Response("channel must be 'whatsapp' or 'sms'", { status: 400, headers: cors });
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
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: { "content-type": "application/json", ...cors } });
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
      return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { "content-type": "application/json", ...cors } });
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
      { headers: { "content-type": "application/json", ...cors } }
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
    { headers: { "content-type": "application/json", ...cors }, status: errorText ? 500 : 200 }
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
