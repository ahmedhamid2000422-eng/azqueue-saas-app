/**
 * notify.js — Twilio SMS notifications (multi-tenant, used by all branches).
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ SECURITY WARNING                                                │
 * │ These calls run in the browser, which means the Twilio Auth    │
 * │ Token is visible to anyone who opens DevTools on your site.    │
 * │                                                                 │
 * │ This is acceptable for an internal front-desk tablet/TV, but   │
 * │ NOT safe for a public-facing app.                              │
 * │                                                                 │
 * │ To harden for production:                                       │
 * │  1. Create a Supabase Edge Function (supabase/functions/sms)   │
 * │  2. Move the fetch() call below into that function             │
 * │  3. Store TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN as Supabase   │
 * │     secrets (not VITE_ env vars)                               │
 * │  4. Call supabase.functions.invoke('sms', { body: {...} })     │
 * │     from the client instead of calling Twilio directly         │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Three exported functions:
 *   sendCheckinConfirmation(phone, name, token, position, branchName)
 *   sendCalledNotification(phone, name, token, windowNumber, staffName, branchName)
 *   sendWaitUpdate(phone, name, position, branchName)
 *
 * All functions are fire-and-forget — they log errors to console
 * but never throw, so a Twilio failure never breaks the queue flow.
 *
 * All functions are no-ops if phone is null/empty.
 */

const ACCOUNT_SID  = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
const AUTH_TOKEN   = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
const FROM_NUMBER  = import.meta.env.VITE_TWILIO_PHONE_NUMBER;

const TWILIO_URL = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

/**
 * Low-level send — never throws.
 * @param {string} to   E.164 phone number e.g. "+15551234567"
 * @param {string} body SMS message body
 */
async function sendSms(to, body) {
  if (!to || !ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) return;

  // Normalise: strip non-digits then prepend +1 if no country code
  const digits = to.replace(/\D/g, "");
  const e164 = digits.startsWith("1") && digits.length === 11
    ? `+${digits}`
    : digits.length === 10
      ? `+1${digits}`
      : `+${digits}`;

  try {
    const encoded = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
    const params  = new URLSearchParams({ To: e164, From: FROM_NUMBER, Body: body });

    const res = await fetch(TWILIO_URL, {
      method:  "POST",
      headers: {
        "Authorization": `Basic ${encoded}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("[notify] Twilio error:", res.status, errBody?.message ?? errBody);
    }
  } catch (e) {
    console.error("[notify] sendSms failed:", e);
  }
}

/**
 * Sent immediately after a customer joins the queue via the check-in page.
 *
 * @param {string} phone      Customer phone (any format)
 * @param {string} name       Customer first/full name
 * @param {string} token      Queue token e.g. "A014"
 * @param {number} position   Number of people ahead (0 = next)
 * @param {string} branchName Branch display name
 */
export async function sendCheckinConfirmation(phone, name, token, position, branchName) {
  if (!phone) return;
  const ahead = position ?? 0;
  const wait  = Math.max(1, ahead) * 10;
  const body  =
    `Hi ${name}, you joined the queue at ${branchName}.\n` +
    `You are #${token} · ${ahead} ${ahead === 1 ? "person" : "people"} ahead.\n` +
    `Est. wait: ~${wait} min. We'll text you when it's your turn.`;
  await sendSms(phone, body);
}

/**
 * Sent when a staff member calls this customer's ticket.
 *
 * @param {string} phone              Customer phone
 * @param {string} name               Customer name
 * @param {string} token              Queue token e.g. "A014"
 * @param {number|string} windowNumber  Window/counter number
 * @param {string} staffName          Staff member's display name
 * @param {string} [branchName]       Branch display name (defaults to "AzQueue")
 */
export async function sendCalledNotification(phone, name, token, windowNumber, staffName, branchName = "AzQueue") {
  if (!phone) return;
  const body =
    `${name}, it's your turn!\n` +
    `Please come to ${windowNumber} · ${staffName} is ready for you.\n` +
    branchName;
  await sendSms(phone, body);
}

/**
 * Optional position update — call periodically for long waits.
 *
 * @param {string} phone         Customer phone
 * @param {string} name          Customer name
 * @param {number} position      Current position in queue (1 = next)
 * @param {string} [branchName]  Branch display name (defaults to "AzQueue")
 */
export async function sendWaitUpdate(phone, name, position, branchName = "AzQueue") {
  if (!phone) return;
  const pos  = Math.max(1, position ?? 1);
  const wait = pos * 10;
  const body =
    `Hi ${name}, you're still #${pos} in line.\n` +
    `Est. ${wait} more minutes. Thank you for waiting.\n` +
    branchName;
  await sendSms(phone, body);
}

/**
 * Gym mode — sent ~2-3 hours before a booked class to cut down no-shows.
 * Includes a one-tap confirm link (/confirm/:bookingId) so the student can
 * lock in their spot without needing to reply — no inbound SMS webhook required.
 *
 * @param {string} phone       Student phone
 * @param {string} name        Student name
 * @param {string} className   Class/service name e.g. "Beginner Striking"
 * @param {Date|string} when   Class start time
 * @param {string} branchName  Gym/branch display name
 * @param {string} [bookingId] Booking UUID — when provided, link to /confirm/:id is appended
 */
export async function sendClassReminder(phone, name, className, when, branchName, bookingId) {
  if (!phone) return;
  const dt = new Date(when);
  const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // One-tap confirm link — uses the app's own origin so it works on any domain.
  let confirmLine = "";
  if (bookingId) {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      if (origin) confirmLine = `\nConfirm your spot: ${origin}/confirm/${bookingId}`;
    } catch { /* non-fatal */ }
  }

  const body =
    `Hi ${name}, reminder — ${className} at ${branchName} starts at ${time} today.` +
    confirmLine +
    `\n(Can't make it? Let us know — frees up your spot for someone else.)`;
  await sendSms(phone, body);
}
