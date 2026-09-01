import { TURN_TIMEOUT_MINUTES } from "./features";
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
      console.error(
        "[notifyEmail] Edge Function call failed. Is `queue-email` deployed?",
        error,
      );
      return { ok: false, error };
    }
    if (data?.dryRun) {
      console.error(
        "[notifyEmail] DRY RUN — no email sent. RESEND_API_KEY is not set on the `queue-email` function.",
      );
    } else if (data?.ok) {
      console.info("[notifyEmail] sent", payload.type, "→", to, data?.messageId ?? "");
    } else {
      console.error("[notifyEmail] send failed", data);
    }
    return data ?? { ok: true };
  } catch (e) {
    console.warn("[notifyEmail] unexpected failure", e);
    return { ok: false, error: e };
  }
}

/* Minutes before an appointment we ask people to arrive. Short enough not to
   waste their time, long enough to absorb a check-in. */
const ARRIVE_EARLY_MINUTES = 5;

const origin = () =>
  typeof window !== "undefined" ? window.location.origin : "https://azqueue.io";

export function sendCheckinEmail({
  email, name, token, position, branchName, ticketId, branchSlug,
}) {
  return send({
    type: "checkin",
    to: email,
    name,
    token,
    position,
    branchName,
    ticketUrl: ticketId ? `${origin()}/t/${ticketId}` : "",
    /* Az Tax has bookable slots every day and had taken zero bookings in 117
       visits, because nothing anywhere pointed at the booking page. The
       check-in email is the one message every walk-in receives, read while
       they're sitting and waiting — which is exactly when an alternative to
       waiting is worth reading about.

       Omitted when the caller doesn't pass a slug, so a branch with no
       bookable hours never invites someone to an empty calendar. */
    bookingUrl: branchSlug ? `${origin()}/b/${branchSlug}` : "",
  });
}

export function sendCalledEmail({ email, name, token, counter, staffName, branchName, holdMinutes }) {
  /* Tell them how long the ticket is held. A called ticket expires so the
     queue can move on; someone who wasn't told finds out by losing their
     place, which is the worst possible moment to learn a rule. */
  return send({
    type: "called", to: email, name, token, counter, staffName, branchName,
    holdMinutes: holdMinutes ?? TURN_TIMEOUT_MINUTES,
  });
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

/**
 * Booking confirmation.
 *
 * `at` is the appointment Date, used to compute a concrete arrive-by time —
 * "be here by 4:10 for 4:15" gets acted on, "please arrive early" does not.
 *
 * `quietNote` is one sentence about the branch's quieter hours, composed by
 * the caller from that branch's own arrivals. Pass nothing when there isn't
 * enough history to say something true; the email simply omits it.
 */
export function sendBookingEmail({
  email, name, when, at, serviceName, branchName, bookingId, quietNote,
}) {
  let arriveBy = null;
  if (at instanceof Date && !Number.isNaN(+at)) {
    const early = new Date(+at - ARRIVE_EARLY_MINUTES * 60_000);
    arriveBy = early.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return send({
    type: "booking",
    to: email,
    name,
    when,
    serviceName,
    branchName,
    arriveBy,
    quietNote: quietNote ?? null,
    ticketUrl: bookingId ? `${origin()}/confirm/${bookingId}` : "",
  });
}

/**
 * "What to bring" — sent when a walk-in realises at the door that they're
 * missing something. Contains the actual list, because someone standing
 * outside needs to act on it, not click through to it.
 */
export function sendChecklistEmail({ email, serviceName, items, reminder, branchName, quietPhrase }) {
  return send({
    type: "checklist",
    to: email,
    name: "",
    serviceName,
    items,
    reminder: reminder ?? null,
    branchName,
    quietNote: quietPhrase ? `We're usually quieter ${quietPhrase}, if that suits you better.` : null,
  });
}

export function sendAlertEmail({ email, name, message, branchName }) {
  return send({ type: "alert", to: email, name, message, branchName });
}
