/**
 * workTypes — what a visit actually is, one level below the routing category.
 *
 * PLACEHOLDER. Every list here is a guess at what an immigration and tax
 * office deals with, written so the feature can be seen and used tomorrow.
 * The owner is compiling the real list with his father; when it arrives this
 * file is where it goes, and nothing else has to change.
 *
 * WHY IT IS A SUGGESTION AND NOT A DROPDOWN
 * A fixed list that does not cover a real case forces staff to pick the
 * nearest wrong option, and then the data says something untrue with complete
 * confidence. Every field below accepts free text; the suggestions exist to
 * make the common cases one tap and to keep spelling consistent enough to
 * count later.
 */

/* Suggested detail per handoff category. Order matters — most common first,
   because a list people scan is a list people pick the top of. */
export const WORK_TYPES = {
  dropoff: [
    "Documents to copy",
    "Signature needed",
    "Waiting on missing paperwork",
  ],
  immigration: [
    "I-130 petition",
    "I-485 adjustment",
    "N-400 citizenship",
    "Green card renewal",
    "Work permit",
    "Notarisation",
  ],
  taxes: [
    "Individual return",
    "Business return",
    "Prior year return",
    "Amended return",
    "ITIN application",
  ],
};

export function suggestionsFor(category) {
  return WORK_TYPES[category] ?? [];
}

/**
 * When the manager should be involved — and, more usefully, when he should
 * not be.
 *
 * The owner is both the manager and the senior advisor, so everything drifts
 * to him by default and he ends up absorbing questions that were never his.
 * These are the cases where his involvement is the point: a legal
 * requirement, or a decision only an owner can make.
 *
 * PLACEHOLDER, same as above — the real list comes from the office.
 */
/**
 * Four buttons, not a form. Set from what Ahmed described his father actually
 * needs: a fast, unambiguous handoff, because Mohamed is the one reading
 * these and has no patience for a dropdown of legal categories mid-visit.
 * Binyamin picks one, Mohamed sees a name and a reason, nothing else.
 */
export const ESCALATION_REASONS = [
  "Notarize",
  "Complex case",
  "Question",
  "Unknown",
];

/**
 * Cases that look like they need the manager and do not.
 *
 * Shown as a gentle check before escalating rather than a block: staff can
 * still escalate anything, because a rule that stops someone getting help is
 * worse than an interruption. But naming the common false alarms out loud
 * stops most of them, and the ones that get through are recorded with a
 * reason so the pattern can be seen later.
 */
export const HANDLE_YOURSELF = [
  "Asking how long the wait is",
  "Asking what documents to bring",
  "Booking or rescheduling an appointment",
  "Collecting finished paperwork",
];
