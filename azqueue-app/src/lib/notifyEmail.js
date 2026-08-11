/**
 * notifyEmail.js — queue notification emails via the `queue-email` Edge Function.
 *
 * Email replaces SMS as the primary customer notification channel: it's
 * transactional, needs no carrier registration (no A2P 10DLC), and the
 * Resend integration is already live and domain-verified.
 *
 * Every function is fire-and-forget — errors are logged, never thrown, so a
 * mail failure can never break the queue flow. All are no-ops without an email.
 *
 *   sendCheckinEmail({ email, name, token, position, branchName, ticketUrl })
 *   sendCalledEmail({ email, name, token, counter, staffName, branchName })
 *   sendWaitEmail({ email, name, position, branchName, ticketUrl })
 *   sendBookingEmail({ email, name, when, serviceName, branchName, ticketUrl })
 *   sendAlertEmail({ email, name, message, branchName })
 */

import { supabase } from "./supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function send(payload) {
  const to = (payload.to ?? "").trim();
  if (!to || !EMAIL_RE.test(to)) return { ok: false, skipped: true };

  try {
    const { data, error } = await supabase.functions.invoke("queue-email", {
      body: payload,
    });
    if (error) {
      console.warn("[notifyEmail] invoke failed", error);
      return { ok: false, error };
    }
    return data ?? { ok: true };
  } catch (e) {
    console.warn("[notifyEmail] unexpected failure", e);
    return { ok: false, error: e };
  }
}

const origin = () =>
  typeof window !== "undefined" ? window.location.origin : "https://azqueue.io";

export function sendCheckinEmail({ email, name, token, position, branchName, ticketId }) {
  return send({
    type: "checkin",
    to: email,
    name,
    token,
    position,
    branchName,
    ticketUrl: ticketId ? `${origin()}/t/${ticketId}` : "",
  });
}

export function sendCalledEmail({ email, name, token, counter, staffName, branchName }) {
  return send({ type: "called", to: email, name, token, counter, staffName, branchName });
}

export function sendWaitEmail({ email, name, position, branchName, ticketId }) {
  return send({
    type: "wait",
    to: email,
    name,
    position,
    branchName,
    ticketUrl: ticketId ? `${origin()}/t/${ticketId}` : "",
  });
}

export function sendBookingEmail({ email, name, when, serviceName, branchName, bookingId }) {
  return send({
    type: "booking",
    to: email,
    name,
    when,
    serviceName,
    branchName,
    ticketUrl: bookingId ? `${origin()}/confirm/${bookingId}` : "",
  });
}

export function sendAlertEmail({ email, name, message, branchName }) {
  return send({ type: "alert", to: email, name, message, branchName });
}
