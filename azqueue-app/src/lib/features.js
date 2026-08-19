/**
 * features.js — runtime feature switches.
 *
 * Follows the same pattern as PAYWALL_ENABLED in tier.js: default off in code,
 * flipped on with a Vercel environment variable, so no redeploy of logic is
 * needed to turn a feature back on.
 */

/**
 * SMS_ENABLED — whether the app collects phone numbers and offers SMS.
 *
 * Currently OFF: the Twilio A2P 10DLC campaign is not approved, so no SMS can
 * be delivered. While off:
 *   · customer forms hide the phone field and the SMS consent checkbox
 *   · email becomes the required contact field
 *   · staff SMS actions fall back to email
 *
 * To turn back on once A2P is approved, set this in Vercel:
 *     VITE_SMS_ENABLED=true
 * No code change required.
 */
export const SMS_ENABLED = import.meta.env.VITE_SMS_ENABLED === "true";

/** Minutes a customer has to arrive after being called before auto-cancel. */
export const TURN_TIMEOUT_MINUTES = Number(
  import.meta.env.VITE_TURN_TIMEOUT_MINUTES ?? 30,
);

/** Queue position at which the "you're almost up" reminder is sent. */
export const NEAR_FRONT_POSITION = Number(
  import.meta.env.VITE_NEAR_FRONT_POSITION ?? 3,
);

/**
 * How long a customer must have been with staff before "Call next" asks what
 * to do with them first. Below this, calling next just completes the current
 * visit — prompting every time is noise.
 */
export const INTERCEPT_AFTER_MINUTES = Number(
  import.meta.env.VITE_INTERCEPT_AFTER_MINUTES ?? 45,
);

/** How long the queue pauses for prayer, and how far ahead it's announced. */
export const PRAYER_PAUSE_MINUTES = Number(
  import.meta.env.VITE_PRAYER_PAUSE_MINUTES ?? 5,
);
