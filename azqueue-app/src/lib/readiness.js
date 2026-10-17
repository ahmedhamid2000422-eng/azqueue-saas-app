/**
 * readiness.js — how prepared a customer is, as a number staff can act on.
 *
 * Pure functions only, no Supabase calls. That is deliberate: this is the
 * arithmetic that decides what the Queue page says about a person standing at
 * the counter, and it is the kind of logic that fails silently — an off-by-one
 * in a denominator produces a plausible number rather than an error. Keeping
 * it pure means it can be tested without a database. See readiness.test.js.
 *
 * VOCABULARY
 *   requirement   what a service needs   (checklist_requirements)
 *   item          what happened on one visit (ticket_checklist_items)
 *   customer_state  what they said they have   has | not_sure | missing
 *   staff_state     what staff verified        confirmed | rejected | missing
 *
 * Staff always override the customer. A customer saying they have their W-2
 * and a staff member finding they do not are not equal claims.
 */

/** Item counts as present for readiness. Staff verdict wins where it exists. */
export function isPresent(item) {
  if (!item) return false;
  if (item.staff_state) return item.staff_state === "confirmed";
  return item.customer_state === "has";
}

/** Item is a known problem — staff rejected it, or somebody said it's missing. */
export function isMissing(item) {
  if (!item) return false;
  if (item.staff_state) return item.staff_state === "rejected" || item.staff_state === "missing";
  return item.customer_state === "missing";
}

/**
 * Readiness for one visit.
 *
 * @param requirements  rows for this service; only `required` ones count
 * @param items         rows for this ticket, matched on item_code
 * @returns { required, present, missing, unknown, ratio, complete }
 *
 * `ratio` is null when nothing is required — NOT 1. A service with no
 * checklist has no readiness, and reporting it as 100% prepared would quietly
 * inflate the "arrived fully prepared" statistic with visits that were never
 * measured. This project has retracted five conclusions built on exactly that
 * kind of silent default.
 */
export function computeReadiness(requirements = [], items = []) {
  const byCode = new Map(items.map((i) => [i.item_code, i]));
  const required = requirements.filter((r) => r.required !== false);

  let present = 0;
  let missing = 0;

  for (const req of required) {
    const item = byCode.get(req.item_code);
    if (isPresent(item)) present += 1;
    else if (isMissing(item)) missing += 1;
  }

  const total = required.length;
  /* Unknown is its own category, not a synonym for missing. Nobody has said
     anything about these — treating silence as "missing" would make every
     customer who skipped the form look unprepared. */
  const unknown = total - present - missing;

  return {
    required: total,
    present,
    missing,
    unknown,
    ratio: total > 0 ? present / total : null,
    complete: total > 0 && present === total,
  };
}

/**
 * The line shown on the counter screen. Short, because it is read while a
 * customer is mid-sentence.
 *
 *   "6 of 8 confirmed · missing: proof of address, prior-year return"
 */
export function readinessLine(readiness, requirements = [], items = []) {
  if (!readiness || readiness.required === 0) return null;

  const head = `${readiness.present} of ${readiness.required} confirmed`;

  const byCode = new Map(items.map((i) => [i.item_code, i]));
  const missingLabels = requirements
    .filter((r) => r.required !== false && isMissing(byCode.get(r.item_code)))
    .map((r) => r.item_label);

  if (missingLabels.length === 0) return head;

  /* Two names, then a count. Three or more full document titles wraps to a
     second line and pushes the buttons down the screen. */
  const shown = missingLabels.slice(0, 2).join(", ");
  const rest  = missingLabels.length - 2;
  return `${head} · missing: ${shown}${rest > 0 ? ` +${rest} more` : ""}`;
}

/**
 * Urgency for styling. Never red for an unprepared customer — turning up
 * without paperwork is ordinary, and a screen that treats it as an alarm
 * teaches staff to ignore alarms.
 */
export function readinessTone(readiness) {
  if (!readiness || readiness.required === 0) return "none";
  if (readiness.complete) return "good";
  if (readiness.missing > 0) return "warn";
  return "unknown";
}

/**
 * Aggregate: which documents go missing most often.
 *
 * @param rows  ticket_checklist_items across a period
 * @param minSample  below this, return null rather than a ranking
 *
 * Returns null, not an empty list, when there is not enough data. A ranked
 * list built from four visits looks identical to one built from four hundred,
 * and that is how this project produced five conclusions it later retracted.
 * Callers must handle null by saying so on screen.
 */
export function mostMissingItems(rows = [], { minSample = 30, limit = 5 } = {}) {
  if (rows.length < minSample) return null;

  const counts = new Map();
  const seen   = new Map();

  for (const row of rows) {
    const code = row.item_code;
    seen.set(code, (seen.get(code) ?? 0) + 1);
    if (isMissing(row)) counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([code, missing]) => ({
      item_code: code,
      item_label: rows.find((r) => r.item_code === code)?.item_label ?? code,
      missing,
      asked: seen.get(code) ?? 0,
      rate: missing / (seen.get(code) || 1),
    }))
    .sort((a, b) => b.missing - a.missing)
    .slice(0, limit);
}

/** Median. Wait and service times are right-skewed; means mislead here. */
export function median(values = []) {
  const nums = values.filter((v) => typeof v === "number" && !Number.isNaN(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

/**
 * Does preparation change service time?
 *
 * Returns null unless BOTH groups clear minPerGroup. This is the headline
 * claim of the whole template and the one most likely to be wrong: prepared
 * customers are probably also the simpler cases. Callers must present the
 * result as an observation with both sample sizes, never as cause.
 */
export function readinessVsDuration(visits = [], { minPerGroup = 15 } = {}) {
  const prepared   = visits.filter((v) => v.ratio === 1).map((v) => v.serviceMinutes);
  const unprepared = visits.filter((v) => v.ratio != null && v.ratio < 1).map((v) => v.serviceMinutes);

  if (prepared.length < minPerGroup || unprepared.length < minPerGroup) return null;

  const a = median(prepared);
  const b = median(unprepared);
  return {
    preparedMedian: a,
    unpreparedMedian: b,
    differenceMinutes: b - a,
    nPrepared: prepared.length,
    nUnprepared: unprepared.length,
  };
}
