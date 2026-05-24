/**
 * complexity.js — Service complexity tiers & queue optimization engine.
 *
 * TIERS
 *   quick    — 0-10 min  — drop-offs, simple questions, notary stamps
 *   standard — 10-30 min — personal tax, basic immigration questions, oil change
 *   complex  — 30-60 min — immigration cases, business tax, mortgage
 *   extended — 60+ min   — full N-400/I-485 prep, corporate tax, complex litigation
 *
 * OPTIMIZER
 *   analyzeQueue()  — reads current tickets + actual duration history,
 *                     returns wait-time projections and routing recommendations.
 *   smartSort()     — re-orders the waiting list to minimize total wait time:
 *                     quick cases are batched first, complex ones get
 *                     dedicated slots so they don't block the line.
 */

// ── Tier definitions ─────────────────────────────────────────────────────

export const TIERS = {
  quick: {
    label:       "Quick",
    color:       "text-emerald-400",
    border:      "border-emerald-800",
    bg:          "bg-emerald-900/10",
    dot:         "#6ee7b7",
    maxMin:      10,
    staffLevel:  "any",          // any staff can handle
  },
  standard: {
    label:       "Standard",
    color:       "text-sky-400",
    border:      "border-sky-800",
    bg:          "bg-sky-900/10",
    dot:         "#7dd3fc",
    maxMin:      30,
    staffLevel:  "any",
  },
  complex: {
    label:       "Complex",
    color:       "text-amber-400",
    border:      "border-amber-800",
    bg:          "bg-amber-900/10",
    dot:         "#fbbf24",
    maxMin:      60,
    staffLevel:  "experienced",  // needs experienced staff
  },
  extended: {
    label:       "Extended",
    color:       "text-red-400",
    border:      "border-red-800",
    bg:          "bg-red-900/10",
    dot:         "#f87171",
    maxMin:      120,
    staffLevel:  "specialist",   // needs a specialist/senior
  },
};

// ── Service complexity map ────────────────────────────────────────────────
// Key = lowercase substring to match against service name.
// More specific patterns first — first match wins.

export const SERVICE_COMPLEXITY = [

  // ── Extended (60+ min) ────────────────────────────────────────────
  { match: "n-400",              tier: "extended", estimatedMin: 90,  canBatch: false, notes: "Full naturalization case review" },
  { match: "i-485",              tier: "extended", estimatedMin: 75,  canBatch: false, notes: "Adjustment of status — extensive docs" },
  { match: "asylum",             tier: "extended", estimatedMin: 90,  canBatch: false, notes: "Detailed country conditions review" },
  { match: "corporate tax",      tier: "extended", estimatedMin: 120, canBatch: false, notes: "Multi-entity, complex deductions" },
  { match: "business tax",       tier: "extended", estimatedMin: 90,  canBatch: false, notes: "Business entity review, payroll, deductions" },
  { match: "llc tax",            tier: "extended", estimatedMin: 90,  canBatch: false, notes: "Pass-through entity complexity" },
  { match: "s-corp",             tier: "extended", estimatedMin: 90,  canBatch: false, notes: "S-Corp salary/distribution strategy" },
  { match: "mortgage",           tier: "extended", estimatedMin: 75,  canBatch: false, notes: "Full underwriting review" },
  { match: "full case",          tier: "extended", estimatedMin: 90,  canBatch: false, notes: "" },

  // ── Complex (30-60 min) ───────────────────────────────────────────
  { match: "immigration",        tier: "complex",  estimatedMin: 45,  canBatch: false, notes: "Case-specific — allow full hour for new clients" },
  { match: "i-130",              tier: "complex",  estimatedMin: 45,  canBatch: false, notes: "Family petition review" },
  { match: "daca",               tier: "complex",  estimatedMin: 40,  canBatch: false, notes: "Evidence review + timeline" },
  { match: "tax preparation",    tier: "complex",  estimatedMin: 45,  canBatch: false, notes: "Depends on number of income streams" },
  { match: "tax prep",           tier: "complex",  estimatedMin: 45,  canBatch: false, notes: "" },
  { match: "bookkeeping",        tier: "complex",  estimatedMin: 60,  canBatch: false, notes: "Volume-dependent" },
  { match: "legal consult",      tier: "complex",  estimatedMin: 45,  canBatch: false, notes: "Allow 60 min for new matters" },
  { match: "contract review",    tier: "complex",  estimatedMin: 40,  canBatch: false, notes: "" },
  { match: "loan application",   tier: "complex",  estimatedMin: 45,  canBatch: false, notes: "" },
  { match: "car service",        tier: "complex",  estimatedMin: 45,  canBatch: false, notes: "Diagnosis + estimate time" },
  { match: "medical",            tier: "complex",  estimatedMin: 30,  canBatch: false, notes: "" },
  { match: "dental",             tier: "complex",  estimatedMin: 45,  canBatch: false, notes: "" },
  { match: "enrollment",         tier: "complex",  estimatedMin: 40,  canBatch: false, notes: "Document verification + forms" },
  { match: "physical therapy",   tier: "complex",  estimatedMin: 45,  canBatch: false, notes: "" },

  // ── Standard (10-30 min) ──────────────────────────────────────────
  { match: "tax consult",        tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },
  { match: "tax",                tier: "standard", estimatedMin: 20,  canBatch: false, notes: "Simple returns only in standard tier" },
  { match: "notary",             tier: "standard", estimatedMin: 15,  canBatch: true,  notes: "Can run 2-3 simultaneously" },
  { match: "passport",           tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },
  { match: "driver",             tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },
  { match: "dmv",                tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },
  { match: "social security",    tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },
  { match: "bank account",       tier: "standard", estimatedMin: 25,  canBatch: false, notes: "" },
  { match: "inspection",         tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },
  { match: "registration",       tier: "standard", estimatedMin: 15,  canBatch: false, notes: "" },
  { match: "vaccination",        tier: "standard", estimatedMin: 15,  canBatch: true,  notes: "" },
  { match: "optometry",          tier: "standard", estimatedMin: 25,  canBatch: false, notes: "" },
  { match: "eye exam",           tier: "standard", estimatedMin: 25,  canBatch: false, notes: "" },
  { match: "tutoring",           tier: "standard", estimatedMin: 30,  canBatch: false, notes: "" },
  { match: "consultation",       tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },
  { match: "haircut",            tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },
  { match: "barber",             tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },

  // ── Quick (0-10 min) ──────────────────────────────────────────────
  { match: "drop-off",           tier: "quick",    estimatedMin: 5,   canBatch: true,  notes: "Accept, log, receipt — no review needed now" },
  { match: "drop off",           tier: "quick",    estimatedMin: 5,   canBatch: true,  notes: "" },
  { match: "dropoff",            tier: "quick",    estimatedMin: 5,   canBatch: true,  notes: "" },
  { match: "document drop",      tier: "quick",    estimatedMin: 5,   canBatch: true,  notes: "" },
  { match: "question",           tier: "quick",    estimatedMin: 8,   canBatch: true,  notes: "Quick status check or general question" },
  { match: "status check",       tier: "quick",    estimatedMin: 5,   canBatch: true,  notes: "" },
  { match: "pickup",             tier: "quick",    estimatedMin: 5,   canBatch: true,  notes: "" },
  { match: "payment",            tier: "quick",    estimatedMin: 5,   canBatch: true,  notes: "" },
  { match: "oil change",         tier: "quick",    estimatedMin: 10,  canBatch: false, notes: "" },
  { match: "nails",              tier: "quick",    estimatedMin: 30,  canBatch: false, notes: "" },
  { match: "salon",              tier: "standard", estimatedMin: 30,  canBatch: false, notes: "" },

  // ── Fallback ─────────────────────────────────────────────────────
  { match: "general",            tier: "standard", estimatedMin: 20,  canBatch: false, notes: "" },
];

// ── Lookup ───────────────────────────────────────────────────────────────

/**
 * Get the complexity entry for a service name.
 * @param {string} serviceName
 * @returns {{ tier, estimatedMin, canBatch, notes, ...TIERS[tier] }}
 */
export function getComplexity(serviceName) {
  if (!serviceName) return { tier: "standard", estimatedMin: 20, canBatch: false, notes: "", ...TIERS.standard };
  const lower = serviceName.toLowerCase();
  const entry = SERVICE_COMPLEXITY.find((e) => lower.includes(e.match));
  const base = entry ?? { tier: "standard", estimatedMin: 20, canBatch: false, notes: "" };
  return { ...base, ...TIERS[base.tier] };
}

// ── Actual duration tracker ───────────────────────────────────────────────

/**
 * Compute actual service duration in minutes from a completed ticket.
 */
export function actualDuration(ticket) {
  if (!ticket.started_at || !ticket.completed_at) return null;
  return (new Date(ticket.completed_at) - new Date(ticket.started_at)) / 60000;
}

/**
 * Given a list of completed tickets with service names,
 * compute per-service average durations from real data.
 * Returns: { [serviceName]: { avg, min, max, count } }
 */
export function buildDurationStats(completedTickets, serviceMap) {
  const stats = {};
  for (const t of completedTickets) {
    const dur = actualDuration(t);
    if (dur === null || dur <= 0 || dur > 240) continue; // skip bad data
    const name = serviceMap[t.service_id] ?? "General";
    if (!stats[name]) stats[name] = { total: 0, count: 0, min: dur, max: dur };
    stats[name].total += dur;
    stats[name].count += 1;
    stats[name].min    = Math.min(stats[name].min, dur);
    stats[name].max    = Math.max(stats[name].max, dur);
  }
  return Object.fromEntries(
    Object.entries(stats).map(([name, s]) => [
      name,
      { avg: Math.round(s.total / s.count), min: Math.round(s.min), max: Math.round(s.max), count: s.count },
    ])
  );
}

// ── Smart sort ───────────────────────────────────────────────────────────

/**
 * Re-order the waiting queue to minimise total wait time and keep the line
 * moving. Strategy:
 *   1. Extended cases → moved LAST (or to their own dedicated slot)
 *   2. Quick cases that canBatch → grouped near the front
 *   3. Standard → middle
 *   4. Complex → after standard, before extended
 *   5. Within each tier, preserve original arrival order
 *
 * @param {Ticket[]} waiting         — current waiting queue (arrival order)
 * @param {Object}   serviceMap      — { id → name }
 * @param {Object}   durationStats   — real-world duration data (optional)
 * @returns {Ticket[]}               — re-ordered queue
 */
export function smartSort(waiting, serviceMap, durationStats = {}) {
  const tierOrder = { quick: 0, standard: 1, complex: 2, extended: 3 };

  return [...waiting].sort((a, b) => {
    // Preserve priority (escalated tickets always first)
    const pDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (pDiff !== 0) return pDiff;

    const aName = serviceMap[a.service_id] ?? "";
    const bName = serviceMap[b.service_id] ?? "";
    const aC = getComplexity(aName);
    const bC = getComplexity(bName);
    const tDiff = tierOrder[aC.tier] - tierOrder[bC.tier];
    if (tDiff !== 0) return tDiff;

    // Within same tier, preserve arrival order
    return new Date(a.created_at) - new Date(b.created_at);
  });
}

// ── Queue analyzer ───────────────────────────────────────────────────────

/**
 * Analyze the current queue and return actionable recommendations.
 *
 * @param {object} opts
 * @param {Ticket[]} opts.waiting       — waiting tickets
 * @param {Ticket|null} opts.serving    — currently serving
 * @param {Staff[]} opts.staffList      — available staff
 * @param {Object} opts.serviceMap      — { id → name }
 * @param {Object} opts.durationStats   — real avg durations from buildDurationStats()
 *
 * @returns {{
 *   tally: { quick, standard, complex, extended, dropoff },
 *   projectedWaitMin: number,
 *   staffingStatus: 'ok' | 'stretched' | 'overloaded',
 *   recommendations: string[],
 *   laneGroups: { quick: Ticket[], standard: Ticket[], complex: Ticket[], extended: Ticket[] }
 * }}
 */
export function analyzeQueue(opts) {
  const { waiting = [], serving = null, staffList = [], serviceMap = {}, durationStats = {} } = opts;

  const activeStaff = staffList.filter((s) => s.status === "active" || !s.status).length || 1;

  // ── Tally by tier ───────────────────────────────────────────────────
  const tally = { quick: 0, standard: 0, complex: 0, extended: 0, dropoff: 0, canBatch: 0 };
  const laneGroups = { quick: [], standard: [], complex: [], extended: [] };

  let totalEstimatedMin = 0;

  for (const t of waiting) {
    const name = serviceMap[t.service_id] ?? "";
    const cx   = getComplexity(name);

    // Use real average if we have it, fall back to estimate
    const realAvg = durationStats[name]?.avg;
    const durMin  = realAvg ?? cx.estimatedMin;

    tally[cx.tier] = (tally[cx.tier] || 0) + 1;
    laneGroups[cx.tier].push(t);
    totalEstimatedMin += durMin;

    if (name.toLowerCase().includes("drop")) tally.dropoff++;
    if (cx.canBatch) tally.canBatch++;
  }

  // Subtract batch savings (quick batchable cases cost ≈ 5 min each instead of full estimate)
  const batchSavings = tally.canBatch > 1 ? (tally.canBatch - 1) * 4 : 0;
  const adjustedTotal = Math.max(0, totalEstimatedMin - batchSavings);

  // With current staff, divide total workload
  const projectedWaitMin = Math.ceil(adjustedTotal / activeStaff);

  // ── Staffing status ─────────────────────────────────────────────────
  let staffingStatus = "ok";
  const complexNeedingSpecialist = tally.complex + tally.extended;
  if (projectedWaitMin > 60) staffingStatus = "overloaded";
  else if (projectedWaitMin > 30 || complexNeedingSpecialist > activeStaff * 2) staffingStatus = "stretched";

  // ── Recommendations ─────────────────────────────────────────────────
  const recommendations = [];

  if (tally.dropoff > 0) {
    recommendations.push(
      tally.dropoff === 1
        ? "1 drop-off in queue — can be processed in ~5 min at any counter. Fast-track it to keep the line moving."
        : `${tally.dropoff} drop-offs in queue — batch them together at a free counter. Total time: ~${tally.dropoff * 5} min.`
    );
  }

  if (tally.canBatch > 1) {
    recommendations.push(
      `${tally.canBatch} batchable tasks (drop-offs, quick questions) — grouping them saves ~${Math.round(batchSavings)} min overall.`
    );
  }

  if (tally.extended > 0) {
    const extMin = tally.extended * 90;
    recommendations.push(
      `${tally.extended} extended case${tally.extended > 1 ? "s" : ""} (immigration/business tax) in queue — reserve a dedicated counter and specialist. Estimated ${extMin} min.`
    );
  }

  if (tally.complex > 0) {
    recommendations.push(
      `${tally.complex} complex case${tally.complex > 1 ? "s" : ""} — assign your most experienced staff. Rushing these risks errors.`
    );
  }

  if (staffingStatus === "overloaded" && activeStaff < 3) {
    recommendations.push(
      `Projected wait: ${projectedWaitMin} min with ${activeStaff} staff. Consider opening an additional counter or calling in support.`
    );
  }

  if (staffingStatus === "stretched" && tally.quick > 0) {
    recommendations.push(
      `Move quick tasks (${tally.quick}) to the front to clear the line while complex cases are processed in parallel.`
    );
  }

  if (tally.complex + tally.extended > 0 && tally.quick + tally.standard > 0) {
    recommendations.push(
      "Split-lane mode: run a fast lane (quick/standard) and a slow lane (complex/extended) simultaneously."
    );
  }

  // Staff assignment hints
  const specialistStaff  = staffList.filter((s) => s.role === "manager" || s.role === "senior");
  const regularStaff     = staffList.filter((s) => s.role !== "manager" && s.role !== "senior");

  if ((tally.extended > 0 || tally.complex > 0) && specialistStaff.length > 0) {
    const name = specialistStaff[0].display_name;
    recommendations.push(
      `Assign ${name} to complex/extended cases — they have the experience to handle these efficiently.`
    );
  }

  if (regularStaff.length > 0 && tally.quick + tally.standard > 0) {
    recommendations.push(
      `${regularStaff.map((s) => s.display_name).join(", ")} → handle quick & standard cases to keep throughput high.`
    );
  }

  return {
    tally,
    projectedWaitMin,
    staffingStatus,
    recommendations,
    laneGroups,
    activeStaff,
  };
}

// ── Wait time estimate for a specific position ───────────────────────────

/**
 * Estimate how long customer at position `pos` (0-based) in the sorted
 * queue will wait, given current serving ticket started at `servingStartedAt`.
 *
 * @returns {number} estimated wait in minutes
 */
export function estimatedWait(pos, sortedWaiting, serviceMap, durationStats, servingStartedAt, servingServiceName) {
  let acc = 0;

  // Time remaining for the current serving customer
  if (servingStartedAt) {
    const elapsedMin = (Date.now() - new Date(servingStartedAt)) / 60000;
    const totalMin   = durationStats[servingServiceName]?.avg ?? getComplexity(servingServiceName).estimatedMin;
    acc += Math.max(0, totalMin - elapsedMin);
  }

  // Sum up tickets ahead of this position
  for (let i = 0; i < pos; i++) {
    const name   = serviceMap[sortedWaiting[i]?.service_id] ?? "";
    const cx     = getComplexity(name);
    acc += durationStats[name]?.avg ?? cx.estimatedMin;
  }

  return Math.round(acc);
}
