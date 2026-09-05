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

/**
 * SMS_PENDING — the in-between state the original flag had no room for.
 *
 * The A2P 10DLC campaign is registered but not yet approved, so the number
 * cannot deliver. Turning SMS_ENABLED off would be the honest-looking move,
 * except it also hides the consent checkbox — and that checkbox IS the
 * call-to-action a carrier reviewer is sent to inspect. Hiding it fails the
 * campaign that would let texting work at all.
 *
 * So the form keeps the phone field and the consent box, and says plainly
 * that texts start once approved. The customer is told the truth, the
 * reviewer sees a real opt-in, and nobody is left waiting for a message that
 * cannot arrive.
 *
 * Set VITE_SMS_PENDING=false the day the campaign is approved.
 */
export const SMS_PENDING = import.meta.env.VITE_SMS_PENDING !== "false";

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
 * INTEGRATIONS_ENABLED — the Freshdesk / Zid / Shopify connectors.
 *
 * Off by default, because for the businesses this is actually being used by
 * they are noise. A tax office has no Shopify store; showing it a panel to
 * connect one invites the reasonable conclusion that the product wasn't built
 * for them. Settings is where an owner goes when something needs changing,
 * and every irrelevant tab makes the relevant one harder to find.
 *
 * The code is untouched behind this — set VITE_INTEGRATIONS_ENABLED=true for
 * an account that genuinely runs one of them.
 */
export const INTEGRATIONS_ENABLED = import.meta.env.VITE_INTEGRATIONS_ENABLED === "true";

/**
 * SLA_ENABLED — the breach and bounce thresholds panel.
 *
 * Off by default, and the reason is worth recording. This is a call-centre
 * control: it asks an owner to set, in minutes, how long a task may run
 * before the system flags it, and how many times a customer may be parked
 * back into the queue before that counts as a failure. It belongs on a floor
 * with a dozen counters and a supervisor watching a wallboard.
 *
 * It sits on the Stations page, which is where a two-person office goes to
 * name its counters. The owner of the one live account read it and could not
 * tell what "bounce thresholds" meant — and he wrote it. If the person who
 * built it cannot parse the label, the person using the screen has no chance,
 * and an unparseable control on a working page is worse than no control: it
 * makes the whole screen feel like it belongs to someone else.
 *
 * Nothing behind this is deleted. sla.js, the sweep, and migrations 0009 and
 * 0013 are untouched, and the sweep costs nothing while the policy is
 * disabled — it returns before issuing a query. Set VITE_SLA_ENABLED=true for
 * an account that genuinely runs shift supervision.
 *
 * If it comes back, it probably belongs next to the queue rather than here,
 * and it needs plain words: "flag a visit still open after N minutes".
 */
export const SLA_ENABLED = import.meta.env.VITE_SLA_ENABLED === "true";

/**
 * MANAGER_ENABLED — the break-pattern heatmap, anomaly alerts, wellness
 * signals and weekly digests.
 *
 * Off by default. Not because the idea is wrong, but because it is being
 * asked to find patterns in a dataset that doesn't have any yet — one branch,
 * roughly 50 real visits ever recorded. On 3 September it told the owner
 * Benyamin needed a break, computed from hours-since-status-changed because
 * no actual break event had ever been logged for him. That is not a break
 * pattern, it is a fallback formula wearing one, and it is exactly the kind
 * of finding this project has had to retract before — the p90 alert, the
 * "3pm cliff" — a number that reads as evidence and is really an artefact of
 * too little data.
 *
 * It was visible at all only because the paywall was switched off (see
 * PAYWALL_ENABLED) for reasons that had nothing to do with this page —
 * tier-gating is a no-op site-wide while that's off, so Manager rode along
 * unintentionally rather than by a decision that it was ready.
 *
 * Nothing behind this is deleted. Bring it back once there is real history —
 * weeks of it, not days — for the heatmap to mean something. Set
 * VITE_MANAGER_ENABLED=true when that's true.
 */
export const MANAGER_ENABLED = import.meta.env.VITE_MANAGER_ENABLED === "true";

/**
 * CHECKLIST_SMS_ENABLED — texting a customer the "what to bring" list.
 *
 * Off, and this one is a compliance gate rather than a product decision.
 *
 * A2P campaign CM9d4930a3a84ff613446b2ae3155b99af was approved with five
 * sample messages, and carriers compare real traffic against them. A document
 * checklist is not any of those five — it is a different message type
 * entirely, so sending it would be undeclared traffic on a registered
 * campaign. That is how a campaign you fought four rejections for starts
 * getting filtered.
 *
 * The UI is built and the phone path is wired. Before switching this on:
 *
 *   1. Add a sixth sample to the campaign, something like
 *      "[Business Name]: For your [Service] visit please bring: [items].
 *       Reply STOP to opt out."
 *   2. Ask Twilio support whether editing samples on an APPROVED campaign
 *      triggers re-review — this is unverified and worth knowing before
 *      touching a working approval.
 *   3. Only then set VITE_CHECKLIST_SMS_ENABLED=true.
 *
 * Email has no such constraint and works today, which is why it stays the
 * default. See docs/sms-compliance-audit.md.
 */
export const CHECKLIST_SMS_ENABLED = import.meta.env.VITE_CHECKLIST_SMS_ENABLED === "true";

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

/**
 * MIN_BENCHMARK_BRANCHES — the floor for any cross-business comparison.
 *
 * A "benchmark" drawn from three businesses identifies all three, especially
 * in one city where the owner can name every competitor. Below this number
 * the comparison must not be shown at all — not shown with a caveat, not
 * shown greyed out. Not shown.
 *
 * 20 is deliberately conservative. It can come down with evidence; it should
 * never come down because a screen looked empty.
 */
export const MIN_BENCHMARK_BRANCHES = 20;

/** Comparison groups. Comparing a tax office to a barber is worse than no
 *  comparison — the wait that means "struggling" in one is normal in the
 *  other. Self-declared, because only the business knows what it is. */
export const BENCHMARK_CATEGORIES = [
  { key: "tax",        label: "Tax & accounting" },
  { key: "immigration",label: "Immigration services" },
  { key: "clinic",     label: "Clinic or medical" },
  { key: "government", label: "Government or public office" },
  { key: "salon",      label: "Salon or personal care" },
  { key: "other",      label: "Something else" },
];
