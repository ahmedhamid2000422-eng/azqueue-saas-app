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

/* The check-in page's "it's busy, quieter after 4" panel.
   Defaults ON, but set VITE_CHECKIN_NUDGE=false in Vercel and redeploy to
   silence it instantly — no code change, no waiting on a developer. Worth
   having because the cost of this one landing badly is an argument at the
   counter that the owner has to absorb personally. */
export const CHECKIN_NUDGE_ENABLED = import.meta.env.VITE_CHECKIN_NUDGE !== "false";

/* Features that are built but not yet live for customers. The pages behind
   these still exist and still query real tables — they're gated because the
   thing that FILLS those tables isn't running yet (no WhatsApp number
   connected, no survey emails going out). Showing a permanently empty page
   reads as a bug; saying "soon" reads as a roadmap.
   Flip to "true" in Vercel env vars when the underlying pipe is live. */
export const WHATSAPP_ENABLED = import.meta.env.VITE_WHATSAPP_ENABLED === "true";
export const REVIEWS_ENABLED  = import.meta.env.VITE_REVIEWS_ENABLED === "true";

/**
 * AUTOPILOT_ENABLED — whether the queue may call customers automatically.
 *
 * Currently OFF. Autopilot paces calls from a rolling average service time,
 * which breaks down when case length varies wildly — a 5-minute document
 * drop-off and a 1-hour immigration consult can't share one interval, so it
 * ends up calling people while staff are still busy.
 *
 * With this off, the autopilot loop never runs and its UI is hidden; staff
 * call each customer with "Call next". Set VITE_AUTOPILOT_ENABLED=true to
 * bring it back without touching per-branch settings.
 */
export const AUTOPILOT_ENABLED = import.meta.env.VITE_AUTOPILOT_ENABLED === "true";

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

/**
 * How long the queue stays paused for prayer, in minutes.
 * Applies to the on-screen countdown, the autopilot hold, and the spoken
 * announcement, so they can never disagree with each other.
 */
export const PRAYER_PAUSE_MINUTES = Number(
  import.meta.env.VITE_PRAYER_PAUSE_MINUTES ?? 7,
);

/** How many minutes before a prayer the queue starts winding down. */
export const PRAYER_WARN_MINUTES = Number(
  import.meta.env.VITE_PRAYER_WARN_MINUTES ?? 5,
);
