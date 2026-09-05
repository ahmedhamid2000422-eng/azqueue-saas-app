import { supabase } from "./supabase";

/**
 * notifications — fires WhatsApp or SMS messages by invoking the
 * `send-notification` Supabase Edge Function (Twilio).
 *
 * Until the function is deployed and TWILIO_* secrets are set, calls fall
 * through harmlessly — the function logs a dry-run row in notifications_log.
 *
 * Templates (ticket-based, pass ticketId):
 *   "confirm"      — customer checks in
 *   "call"         — ticket moves to "serving"
 *   "thanks"       — ticket completed
 *   "prayer_pause" — prayer auto-pause
 *
 * Templates (booking-based, pass bookingId):
 *   "booking_confirmation" — customer's appointment booking is confirmed
 *
 * Channels:
 *   "whatsapp"  (default) — requires TWILIO_WHATSAPP_FROM
 *   "sms"                 — requires TWILIO_SMS_FROM
 */
export async function notify({ ticketId, bookingId, template, channel = "whatsapp", extras = {} }) {
  if ((!ticketId && !bookingId) || !template) {
    return { error: "missing ticketId/bookingId or template" };
  }

  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: { ticketId, bookingId, template, channel, extras },
    });
    if (error) return { error: error.message };
    return { data };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.info("[notify dry-run]", { ticketId, bookingId, template, channel, extras });
    }
    return { error: e?.message };
  }
}

/**
 * Convenience helpers — default to WhatsApp. Pass channel: "sms" to
 * send via SMS instead, or use the *Sms variants for explicit SMS sends.
 */
export const sendConfirmation    = (ticketId, channel = "whatsapp") => notify({ ticketId, template: "confirm",      channel });
export const sendCallNotice      = (ticketId, channel = "whatsapp") => notify({ ticketId, template: "call",         channel });
export const sendThanks          = (ticketId, channel = "whatsapp") => notify({ ticketId, template: "thanks",       channel });
export const sendPrayerPause     = (ticketId, extras, channel = "whatsapp") => notify({ ticketId, template: "prayer_pause", channel, extras });

/**
 * The same message, named for what it actually is. A break is a break —
 * prayer, lunch, cleaning, shift change — and only the label changes.
 * Pass `breakName` in extras; it falls back to "a short break" if omitted.
 *
 * Prefer this in new code. sendPrayerPause stays for existing callers.
 */
export const sendBreakPause      = (ticketId, extras, channel = "whatsapp") => notify({ ticketId, template: "break_pause", channel, extras });

// QA bug B8 — booking confirmation. Same dry-run-safe pattern as the
// ticket helpers above: safe to call unconditionally right after a
// booking insert, even before Twilio secrets are configured.
export const sendBookingConfirmation = (bookingId, channel = "whatsapp") =>
  notify({ bookingId, template: "booking_confirmation", channel });

// Explicit SMS shortcuts
export const sendConfirmationSms = (ticketId) => notify({ ticketId, template: "confirm",      channel: "sms" });
export const sendCallNoticeSms   = (ticketId) => notify({ ticketId, template: "call",         channel: "sms" });
export const sendThanksSms       = (ticketId) => notify({ ticketId, template: "thanks",       channel: "sms" });
export const sendBookingConfirmationSms = (bookingId) => notify({ bookingId, template: "booking_confirmation", channel: "sms" });

/**
 * sendChecklistSms — text a customer the "what to bring" list.
 *
 * NOT WIRED TO A LIVE TEMPLATE YET, AND THAT IS DELIBERATE.
 *
 * The send-notification edge function only accepts the five templates that
 * match the approved A2P campaign samples. A checklist is not one of them, so
 * this throws rather than silently sending something undeclared or silently
 * doing nothing — a caller that reaches here has got past two feature gates
 * and should hear about it.
 *
 * To make this real:
 *   1. Add a sixth sample to campaign CM9d4930a3a84ff613446b2ae3155b99af
 *   2. Add a matching `checklist` template to send-notification/index.ts
 *   3. Replace this body with a notify({ ticketId, template: "checklist" })
 *      call — note it needs a ticketId, so the checklist would have to be
 *      sent after joining rather than before, or the function needs a path
 *      that takes a raw phone number
 *
 * That third point is the real design question: the whole value of the
 * checklist is that it arrives BEFORE someone joins the queue, and every
 * existing template hangs off a ticket that does not exist yet.
 */
export async function sendChecklistSms() {
  throw new Error(
    "Checklist SMS is not available: no approved A2P sample exists for this message type. " +
    "See docs/sms-compliance-audit.md before enabling."
  );
}
