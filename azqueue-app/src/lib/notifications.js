import { supabase } from "./supabase";

/**
 * notifications — fires WhatsApp or SMS messages by invoking the
 * `send-notification` Supabase Edge Function (Twilio).
 *
 * Until the function is deployed and TWILIO_* secrets are set, calls fall
 * through harmlessly — the function logs a dry-run row in notifications_log.
 *
 * Templates:
 *   "confirm"      — customer checks in
 *   "call"         — ticket moves to "serving"
 *   "thanks"       — ticket completed
 *   "prayer_pause" — prayer auto-pause
 *
 * Channels:
 *   "whatsapp"  (default) — requires TWILIO_WHATSAPP_FROM
 *   "sms"                 — requires TWILIO_SMS_FROM
 */
export async function notify({ ticketId, template, channel = "whatsapp", extras = {} }) {
  if (!ticketId || !template) return { error: "missing ticketId or template" };

  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: { ticketId, template, channel, extras },
    });
    if (error) return { error: error.message };
    return { data };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.info("[notify dry-run]", { ticketId, template, channel, extras });
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

// Explicit SMS shortcuts
export const sendConfirmationSms = (ticketId) => notify({ ticketId, template: "confirm",      channel: "sms" });
export const sendCallNoticeSms   = (ticketId) => notify({ ticketId, template: "call",         channel: "sms" });
export const sendThanksSms       = (ticketId) => notify({ ticketId, template: "thanks",       channel: "sms" });
