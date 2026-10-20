/**
 * timing.js — what we can and cannot say about how long things took.
 *
 * Every duration in AzQueue has been wrong at least once, in the same way:
 * a timestamp written by something that was not the event it names. Five
 * separate code paths wrote `completed_at` on tickets nobody served (0056,
 * 0065, 0067). Each was found months later by noticing an impossible number.
 *
 * So this module does two things, and the second matters more:
 *   1. computes durations only from records that can support them
 *   2. reports how many records were excluded, and why
 *
 * A median with no coverage figure beside it is the shape of every mistake
 * this project has made. 202 completions sounds solid until you learn 237
 * other tickets were closed by a cron job and are simply absent.
 */

/* ── Vocabulary, used exactly ─────────────────────────────────────────
 *
 * WAIT            joined -> called          customer is in the room, nobody with them
 * CALLED-TO-DONE  called -> completed       NOT service time. See below.
 * TOTAL VISIT     joined -> completed       the customer's whole experience
 *
 * There is no SERVICE TIME in AzQueue today. `started_at` is written at the
 * same instant as `called_at` by startNext(), so called-to-done includes any
 * gap between calling someone and actually sitting down with them. Calling it
 * "service time" would be a claim the data cannot support. A separate
 * service-start event is deferred until there is evidence the gap is real —
 * see docs/tax-season-plan.md.
 */
export const DURATION_LABELS = {
  wait: "Wait (joined to called)",
  calledToDone: "Called to finished",
  totalVisit: "Total visit (joined to finished)",
};

/** Reasons a ticket cannot contribute a duration. Shown to the user, not logged. */
export const EXCLUSION_REASONS = {
  not_completed: "Never completed",
  system_closed: "Closed automatically, outcome unknown",
  missing_timestamps: "Timestamps missing",
  implausible: "Duration outside plausible range",
  caught_up: "Closed out later, not timed live",
};

/* Over four hours is a forgotten button press, not a visit. Under a few
   seconds is a double-click. Both are excluded and counted, never silently
   dropped. */
const MIN_MINUTES = 0.25;
const MAX_MINUTES = 240;

function minutesBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;   // negative = clock skew
  return ms / 60000;
}

/**
 * Decide whether one ticket can contribute a called-to-done duration.
 * @returns {{ ok: true, minutes: number } | { ok: false, reason: string }}
 */
export function durationFor(ticket) {
  if (!ticket) return { ok: false, reason: "missing_timestamps" };

  if (ticket.expired_at || ticket.closed_by === "system") {
    return { ok: false, reason: "system_closed" };
  }
  /* Closed out at the end of the day rather than as it happened. The OUTCOME
     is trustworthy — a staff member asserted it — but the timestamp is when
     they tidied up, not when the customer left. Counts towards outcome
     coverage, never towards a duration. */
  if (ticket.timing_source === "catch_up") {
    return { ok: false, reason: "caught_up" };
  }
  if (ticket.status !== "completed") {
    return { ok: false, reason: "not_completed" };
  }

  const start = ticket.started_at || ticket.called_at;
  const mins = minutesBetween(start, ticket.completed_at);
  if (mins == null) return { ok: false, reason: "missing_timestamps" };
  if (mins < MIN_MINUTES || mins > MAX_MINUTES) {
    return { ok: false, reason: "implausible" };
  }
  return { ok: true, minutes: mins };
}

/**
 * Coverage: the honest denominator.
 *
 * Returns both ratios the spec asks for, plus a breakdown of why records
 * were dropped. `timingCoverage` is the one to show beside any median —
 * it answers "of the visits we say we completed, how many can we actually
 * time?".
 */
export function timingCoverage(tickets = []) {
  const total = tickets.length;
  const completed = tickets.filter((t) => t.status === "completed" && !t.expired_at);

  const excluded = {};
  const usable = [];

  for (const t of completed) {
    const d = durationFor(t);
    if (d.ok) usable.push(d.minutes);
    else excluded[d.reason] = (excluded[d.reason] ?? 0) + 1;
  }

  /* Known outcome = somebody decided. A cron closure is an absence of
     information, not an outcome, and must not be counted as one. */
  const knownOutcome = tickets.filter(
    (t) => !t.expired_at && t.closed_by !== "system" &&
           ["completed", "cancelled", "no_show"].includes(t.status)
  ).length;

  const systemClosed = tickets.filter(
    (t) => t.expired_at || t.closed_by === "system"
  ).length;

  const stillOpen = tickets.filter(
    (t) => ["waiting", "serving"].includes(t.status)
  ).length;

  return {
    total,
    completed: completed.length,
    timed: usable.length,
    /* null, never 0, when there is nothing to divide. A coverage of "0%"
       and "no data" mean different things and must look different. */
    timingCoverage: completed.length ? usable.length / completed.length : null,
    outcomeCoverage: total ? knownOutcome / total : null,
    knownOutcome,
    systemClosed,
    stillOpen,
    excluded,
    minutes: usable,
  };
}

/** Median. Means are wrong here — these distributions are right-skewed. */
export function median(values = []) {
  const n = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!n.length) return null;
  const mid = Math.floor(n.length / 2);
  return n.length % 2 ? n[mid] : (n[mid - 1] + n[mid]) / 2;
}

export function percentile(values = [], p = 0.9) {
  const n = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!n.length) return null;
  const idx = Math.min(n.length - 1, Math.floor(p * n.length));
  return n[idx];
}

/**
 * A duration summary that cannot be quoted without its caveats, because the
 * caveats are fields on the same object.
 */
export function summarise(tickets = [], { minSample = 5 } = {}) {
  const cov = timingCoverage(tickets);
  if (cov.timed < minSample) {
    return {
      ...cov,
      median: null,
      p90: null,
      mean: null,
      note: `Not enough timed records yet — ${cov.timed} of ${minSample} needed.`,
    };
  }
  const mean = cov.minutes.reduce((a, b) => a + b, 0) / cov.minutes.length;
  return {
    ...cov,
    median: median(cov.minutes),
    p90: percentile(cov.minutes, 0.9),
    mean,
    label: DURATION_LABELS.calledToDone,
    note: null,
  };
}
