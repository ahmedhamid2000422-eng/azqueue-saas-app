import { supabase } from "./supabase";

/**
 * notifications — fires WhatsApp messages by invoking the `send-notification`
 * Supabase Edge Function. The function handles the actual Twilio call.
 *
 * Until you've deployed the function and set TWILIO_* secrets, calls fall through
 * harmlessly — the function logs a dry-run row in notifications_log so you can
 * verify wiring without sending real messages.
 *
 * Templates:
 *   "confirm"      — fires when a customer checks in
 *   "call"         — fires when their ticket goes to "serving"
 *   "thanks"       — fires when their ticket is "completed"
 *   "prayer_pause" — fires when prayer auto-pause kicks in
 */
export async function notify({ ticketId, template, extras = {} }) {
  if (!ticketId || !template) return { error: "missing ticketId or template" };

  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: { ticketId, template, extras },
    });
    if (error) return { error: error.message };
    return { data };
  } catch (e) {
    // Edge function not deployed yet — quietly ignore so the app still works
    if (import.meta.env.DEV) {
      console.info("[notify dry-run]", { ticketId, template, extras });
    }
    return { error: e?.message };
  }
}

/**
 * Convenience helpers for the three customer-facing flows.
 */
export const sendConfirmation = (ticketId)         => notify({ ticketId, template: "confirm" });
export const sendCallNotice   = (ticketId)         => notify({ ticketId, template: "call" });
export const sendThanks       = (ticketId)         => notify({ ticketId, template: "thanks" });
export const sendPrayerPause  = (ticketId, extras) => notify({ ticketId, template: "prayer_pause", extras });
