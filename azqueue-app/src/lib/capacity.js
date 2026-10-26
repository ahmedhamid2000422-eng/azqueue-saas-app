/**
 * capacity.js — a CAPACITY SCENARIO MODEL.
 *
 * It is not a measurement, a forecast, or a staffing recommendation. It takes
 * observed arrivals, an assumed service time, and reports what the arithmetic
 * implies. Three categories, never blurred:
 *
 *   OBSERVED   arrivals per hour. `created_at` is written when a customer
 *              enters their own details at the kiosk. Trustworthy.
 *   ASSUMED    minutes per visit, staff available, service targets. Supplied
 *              by someone who knows the work. NOT derived from the database.
 *   PREDICTED  backlog, waiting estimates, staffing. Arithmetic on the above.
 *              No stronger than the weakest assumption feeding it.
 *
 * Every returned object carries `basis` naming which is which, so a caller
 * cannot present a prediction as a finding by accident.
 *
 * WHY SERVICE TIME IS AN INPUT
 * AzQueue cannot measure it. `started_at` is written in the same instant as
 * `called_at`; 47% of tickets are closed by cron with no outcome; the median
 * "consultation" reads as 1.5 minutes. A model fed those would produce
 * confident nonsense, which this project has already done five times.
 */

/** Defaults are starting points for a conversation, not norms. */
export const DEFAULT_TARGETS = {
  waitTargetMinutes: 15,   // what counts as an acceptable wait
  acceptablePeak: 3,       // a short queue of this size is fine
  closingBacklogMax: 0,    // nobody should still be waiting at close
};

export function hourlyCapacity({ staffCount, serviceMinutes }) {
  if (!staffCount || !serviceMinutes) return null;
  return (staffCount * 60) / serviceMinutes;
}

/**
 * One hour.
 *
 * `estimatedWaitMinutes` is a MODEL ESTIMATE for someone arriving into an
 * existing backlog: how long before capacity reaches them. It is not a
 * measured wait and no customer's actual wait is known.
 */
export function hourOutlook({ arrivals, staffCount, serviceMinutes, carriedOver = 0 }) {
  const capacity = hourlyCapacity({ staffCount, serviceMinutes });
  if (capacity == null) return null;

  const demand   = arrivals + carriedOver;
  const served   = Math.min(demand, capacity);
  const leftover = Math.max(0, demand - capacity);

  /* Someone arriving at the start of this hour waits for the backlog ahead of
     them to clear, at `capacity` per hour. */
  const estimatedWaitMinutes = capacity > 0 ? (carriedOver / capacity) * 60 : null;

  return {
    basis: "predicted",
    hourArrivals: arrivals,           // observed
    carriedOver,                      // predicted
    demand,
    capacity: round1(capacity),       // predicted from assumed inputs
    served: round1(served),
    leftover: round1(leftover),
    estimatedWaitMinutes: estimatedWaitMinutes == null ? null : Math.round(estimatedWaitMinutes),
    utilisation: round2(demand / capacity),
  };
}

/**
 * A day.
 *
 * Reports against explicit targets rather than a single pass/fail. A queue
 * that forms and clears can be perfectly acceptable; an earlier version of
 * this file called any backlog a failure, which is its own kind of wrong.
 */
export function dayOutlook({
  hours = [], staffCount, serviceMinutes, targets = DEFAULT_TARGETS,
}) {
  let carried = 0;
  const rows = [];

  for (const h of hours) {
    const out = hourOutlook({
      arrivals: h.arrivals, staffCount, serviceMinutes, carriedOver: carried,
    });
    if (!out) return null;
    carried = out.leftover;
    rows.push({ hour: h.hour, ...out });
  }

  const peakRow = rows.reduce((a, b) => (b.leftover > a.leftover ? b : a), rows[0]);
  /* The hour backlog GROWS fastest is not the hour it PEAKS — growth is the
     derivative. They are different operational facts: growth tells you when
     to add a person, peak tells you how bad it gets. */
  let growthRow = rows[0];
  let maxGrowth = -Infinity;
  for (const r of rows) {
    const growth = r.leftover - r.carriedOver;
    if (growth > maxGrowth) { maxGrowth = growth; growthRow = r; }
  }

  const hoursAboveTarget = rows.filter(
    (r) => r.estimatedWaitMinutes != null && r.estimatedWaitMinutes > targets.waitTargetMinutes
  );

  return {
    basis: "predicted",
    assumptions: {
      staffCount,
      serviceMinutes,
      operatingHours: rows.length ? `${rows[0].hour}:00–${rows[rows.length - 1].hour + 1}:00` : null,
      staffAvailableAllHours: true,   // the model assumes no breaks or absences
      arrivalsSpreadEvenlyWithinHour: true,
      targets,
    },
    rows,
    peakBacklog: round1(peakRow?.leftover ?? 0),
    peakHour: peakRow?.hour ?? null,
    fastestGrowthHour: growthRow?.hour ?? null,
    closingBacklog: round1(carried),
    hoursAboveWaitTarget: hoursAboveTarget.length,
    worstEstimatedWaitMinutes: rows.reduce(
      (m, r) => Math.max(m, r.estimatedWaitMinutes ?? 0), 0
    ),
    meetsTargets:
      round1(peakRow?.leftover ?? 0) <= targets.acceptablePeak &&
      round1(carried) <= targets.closingBacklogMax &&
      hoursAboveTarget.length === 0,
  };
}

/**
 * Smallest staff count meeting the stated targets.
 *
 * Returns the assumptions alongside the number, because a staffing figure
 * without them is meaningless — the same day needs different staffing at
 * 20 minutes a visit than at 40, and daily volume alone determines nothing.
 */
export function staffNeeded({ hours, serviceMinutes, targets = DEFAULT_TARGETS, maxStaff = 8 }) {
  for (let n = 1; n <= maxStaff; n++) {
    const d = dayOutlook({ hours, staffCount: n, serviceMinutes, targets });
    if (d?.meetsTargets) {
      return {
        basis: "predicted",
        staff: n,
        becauseOf: {
          busiestHour: d.rows.reduce((a, b) => (b.hourArrivals > a.hourArrivals ? b : a), d.rows[0]).hour,
          peakArrivalsThatHour: d.rows.reduce((m, r) => Math.max(m, r.hourArrivals), 0),
          serviceMinutes,
          operatingHours: d.assumptions.operatingHours,
          targets,
        },
      };
    }
  }
  return null;
}

/**
 * Drop-off scenario.
 *
 * DROP-OFF MOVES WORK, IT DOES NOT REMOVE IT. A drop-off is a short intake at
 * the counter plus the full job done later, away from the customer. Modelling
 * only the shortened counter visit would make the work disappear, which is
 * the mistake worth avoiding here.
 *
 * So this returns BOTH: what happens at the counter, and how many back-office
 * hours the same day now owes.
 */
export function dropOffScenario({
  hours, staffCount, serviceMinutes, targets = DEFAULT_TARGETS,
  share = 0.3,
  intakeMinutes = 5,          // assumed: taking documents and explaining next steps
  backOfficeMinutes = null,   // assumed: the job itself, done later
}) {
  if (!(share > 0 && share < 1)) return null;
  const backOffice = backOfficeMinutes ?? serviceMinutes;

  const blendedCounterMinutes = serviceMinutes * (1 - share) + intakeMinutes * share;
  const counter = dayOutlook({ hours, staffCount, serviceMinutes: blendedCounterMinutes, targets });
  if (!counter) return null;

  const totalArrivals = hours.reduce((a, h) => a + h.arrivals, 0);
  const droppedOff = totalArrivals * share;
  const backOfficeHours = (droppedOff * backOffice) / 60;

  return {
    basis: "predicted",
    assumptions: {
      share, intakeMinutes, backOfficeMinutes: backOffice, serviceMinutes, staffCount,
      note: "Back-office work is moved, not removed. It must be staffed somewhere.",
    },
    counter,
    droppedOffCustomers: round1(droppedOff),
    backOfficeHoursOwed: round1(backOfficeHours),
    backOfficeStaffHoursEquivalent: round1(backOfficeHours),
  };
}

/** Phrasing helper — fractional people are model quantities, not customers. */
export function describeBacklog(n) {
  if (n == null) return null;
  if (n < 0.5) return "no meaningful queue";
  return `a backlog equivalent to about ${Math.round(n)} customer${Math.round(n) === 1 ? "" : "s"}`;
}

/**
 * Narrative, with every assumption attached. Never says "understaffed" —
 * that is a judgement about a business, not an output of arithmetic.
 */
export function suggestions({
  hours, staffCount, serviceMinutes, targets = DEFAULT_TARGETS, dropOff = null,
}) {
  const base = dayOutlook({ hours, staffCount, serviceMinutes, targets });
  if (!base) return [];
  const out = [];
  const a = base.assumptions;

  const preamble =
    `Scenario: ${staffCount} on the counter, ${serviceMinutes} min assumed per visit, ` +
    `${a.operatingHours}, target wait ${targets.waitTargetMinutes} min.`;
  out.push({ kind: "assumptions", basis: "assumed", text: preamble });

  if (base.meetsTargets) {
    out.push({
      kind: "ok", basis: "predicted",
      text: `This scenario meets the stated targets — ${describeBacklog(base.peakBacklog)} at worst.`,
    });
    return out;
  }

  out.push({
    kind: "peak", basis: "predicted",
    text: `Peak is ${describeBacklog(base.peakBacklog)} around ${base.peakHour}:00, ` +
          `with the backlog growing fastest at ${base.fastestGrowthHour}:00.`,
  });

  if (base.hoursAboveWaitTarget > 0) {
    out.push({
      kind: "wait", basis: "predicted",
      text: `${base.hoursAboveWaitTarget} hour(s) above the ${targets.waitTargetMinutes}-minute wait target; ` +
            `worst estimated wait about ${base.worstEstimatedWaitMinutes} min.`,
    });
  }

  if (base.closingBacklog > targets.closingBacklogMax) {
    out.push({
      kind: "closing", basis: "predicted",
      text: `${describeBacklog(base.closingBacklog)} still waiting at closing.`,
    });
  } else {
    out.push({
      kind: "closing", basis: "predicted",
      text: `The day finishes clear — the queue forms and drains within opening hours.`,
    });
  }

  const need = staffNeeded({ hours, serviceMinutes, targets });
  if (need && need.staff > staffCount) {
    out.push({
      kind: "staffing", basis: "predicted",
      text: `${need.staff} people would meet these targets. Driven by ${need.becauseOf.peakArrivalsThatHour} ` +
            `arrivals in the ${need.becauseOf.busiestHour}:00 hour at ${serviceMinutes} min each — ` +
            `not by the daily total, which peak staffing does not follow.`,
    });
  }

  if (dropOff) {
    const d = dropOffScenario({ hours, staffCount, serviceMinutes, targets, ...dropOff });
    if (d) {
      out.push({
        kind: "dropoff", basis: "predicted",
        text: `If ${Math.round(d.assumptions.share * 100)}% became drop-offs ` +
              `(${d.assumptions.intakeMinutes} min intake), counter peak falls to ` +
              `${describeBacklog(d.counter.peakBacklog)} — but this moves about ` +
              `${d.backOfficeHoursOwed} hours of back-office work into the same day, ` +
              `which still has to be done by someone.`,
      });
    }
  }

  return out;
}

/**
 * BEFORE REPLACING THE ASSUMED SERVICE TIME WITH MEASURED DATA.
 *
 * Live timing does not automatically make this model unconditional. Check all
 * of these first; any failure means the assumption stays.
 */
export const TIMING_READINESS_CHECKS = [
  "Recording coverage: what share of completed visits have timing_source='live'? Low coverage means a self-selected sample.",
  "Validity: durations within a plausible range, no negative values, no clustering at a timeout boundary.",
  "Service mix: does the timed sample contain the same mix of services as the full population?",
  "Representativeness: timed across busy AND quiet days, Mondays AND midweek, all staff — not one good week.",
  "Variation: report spread (IQR, p90) alongside the median. A model fed only an average understates queueing.",
  "Stability: has the distribution settled, or is it still moving as habits change?",
];

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
