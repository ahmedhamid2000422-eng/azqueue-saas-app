/**
 * waitEstimator.js — evidence-based "how long until my turn" estimates.
 *
 * WHY THIS EXISTS
 * The old estimates were guesses: notify.js multiplied queue position by a
 * hardcoded 10 minutes, and the ticket page defaulted to 15. Neither looked
 * at what the business actually does. With a caseload mixing 5-minute
 * drop-offs and 1-hour consultations, those numbers are wrong most of the
 * time — and a wrong estimate is worse than none, because customers plan
 * around it and leave when it slips.
 *
 * WHAT CHANGED
 *
 * 1. Median, not mean. One 90-minute case pulls a mean upward permanently;
 *    the median describes the typical visit. Averages are the reason the old
 *    figures felt long even on quiet days.
 *
 * 2. Per-service when possible. "Document Review" and "Immigration" get
 *    their own medians once each has enough history, falling back to the
 *    branch median, then to a stated default.
 *
 * 3. Servers matter. Four people ahead with three counters open is not the
 *    same wait as four people ahead with one. Expected wait divides by the
 *    number of positions actually serving concurrently.
 *
 * 4. A range, not false precision. Returns low/high from the interquartile
 *    spread so the UI can say "about 20–35 minutes" — honest about
 *    variability rather than promising a number that will be wrong.
 *
 * 5. Confidence is reported. With little history it says so, and callers can
 *    choose to show nothing rather than mislead.
 */

import { supabase } from "./supabase";
import { describe } from "./stats";

const MS_MIN = 60_000;

/** Minimum completed visits before a median is trustworthy enough to show. */
const MIN_FOR_SERVICE = 8;
const MIN_FOR_BRANCH  = 5;

/** Used only when there is no history at all, and always flagged as such. */
const FALLBACK_MIN = 15;

function minutesBetween(a, b) {
  if (!a || !b) return null;
  const m = (new Date(b).getTime() - new Date(a).getTime()) / MS_MIN;
  return m >= 0 && m < 720 ? m : null;
}

/**
 * Load service-duration statistics for a branch.
 * Returns { byService: { [id]: stats }, overall: stats|null, servers }.
 */
export async function loadServiceStats(branchId, { days = 60 } = {}) {
  if (!branchId) return { byService: {}, overall: null, servers: 1 };

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("tickets")
    .select("service_id, started_at, completed_at")
    .eq("branch_id", branchId)
    .eq("status", "completed")
    .gte("created_at", since)
    .limit(2000);

  if (error || !data?.length) return { byService: {}, overall: null, servers: 1 };

  const all = [];
  const groups = {};
  data.forEach((t) => {
    const m = minutesBetween(t.started_at, t.completed_at);
    if (m == null) return;
    all.push(m);
    const k = t.service_id ?? "none";
    (groups[k] ??= []).push(m);
  });

  const byService = {};
  Object.entries(groups).forEach(([k, arr]) => {
    if (arr.length >= MIN_FOR_SERVICE) byService[k] = describe(arr);
  });

  // Concurrency: how many were genuinely served at the same time.
  const events = [];
  data.forEach((t) => {
    if (!t.started_at || !t.completed_at) return;
    events.push([+new Date(t.started_at), 1], [+new Date(t.completed_at), -1]);
  });
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, servers = 1;
  for (const [, d] of events) { cur += d; servers = Math.max(servers, cur); }

  return {
    byService,
    overall: all.length >= MIN_FOR_BRANCH ? describe(all) : null,
    servers: Math.max(1, servers),
  };
}

/**
 * Estimate the wait for someone at a given queue position.
 *
 * @param {object} opts
 * @param {number} opts.position    1 = next to be called
 * @param {string} [opts.serviceId] the service they're waiting for
 * @param {object} opts.stats       from loadServiceStats()
 * @param {number} [opts.serversOverride] if you know how many are open now
 * @returns {{ minutes, low, high, confidence, basis, perCustomerMin, servers }}
 */
export function estimateWait({ position, serviceId, stats, serversOverride }) {
  if (position == null || position < 0) return null;

  const svc = serviceId != null ? stats?.byService?.[serviceId] : null;
  const chosen = svc ?? stats?.overall ?? null;

  const perCustomer = chosen?.median ?? FALLBACK_MIN;
  const servers = Math.max(1, serversOverride ?? stats?.servers ?? 1);

  // Position 1 means "you are next" — the wait is the remainder of the
  // current visit, so roughly one service time, not zero.
  const effective = Math.max(1, position);
  const ahead = effective / servers;          // visits that must finish first
  const centre = ahead * perCustomer;

  // Spread for a SUM of visits, not a single one.
  //
  // Multiplying the 90th percentile by the number of people ahead would
  // assume every one of them is a worst case at the same time. For roughly
  // independent visits the standard deviation of the total grows with the
  // square root of the count, so three people ahead is nowhere near three
  // times as uncertain as one. Getting this wrong produced estimates like
  // "20–255 minutes", which tells a customer nothing.
  const sdPer = chosen?.sd ?? perCustomer * 0.5;
  const sdTotal = Math.sqrt(ahead) * sdPer;

  // Asymmetric on purpose: overruns are more common than early finishes,
  // so allow more room above the centre than below it.
  //
  // The lower bound is also floored at half the centre. When service times
  // are very mixed the standard deviation can exceed the median, which would
  // otherwise drive the floor to ~0 and produce "1–145 min" — technically
  // defensible, practically worthless to someone deciding whether to wait.
  // Nobody gets served in a fraction of the typical time, so half is a
  // realistic optimistic case.
  const lowPer  = Math.max(centre * 0.5, centre - 1.0 * sdTotal);
  const highPer = centre + 1.28 * sdTotal;    // ≈80% of cases fall under this

  const confidence =
    svc            ? "high"   :   // this exact service has its own history
    stats?.overall ? "medium" :   // branch-wide history only
                     "low";       // nothing to go on

  const basis =
    svc            ? "based on this service's own history"
    : stats?.overall ? "based on this branch's typical visit"
    : "a general estimate — not enough history yet";

  const round5 = (n) => Math.max(1, Math.round(n / 5) * 5);

  return {
    minutes: Math.max(1, Math.round(centre)),
    low:  round5(lowPer),
    high: round5(highPer),
    confidence,
    basis,
    perCustomerMin: Math.round(perCustomer),
    servers,
    sampleSize: chosen?.n ?? 0,
  };
}

/**
 * Human-readable estimate. Returns null when confidence is too low to be
 * worth showing — deliberately, because a confident wrong number costs more
 * trust than showing nothing.
 */
export function formatWait(est, { allowLow = false } = {}) {
  if (!est) return null;
  if (est.confidence === "low" && !allowLow) return null;

  // Once the range gets wide, quoting a single number is misleading.
  if (est.high - est.low >= 10) return `about ${est.low}–${est.high} min`;
  return `about ${est.minutes} min`;
}

/** Convenience: load stats and estimate in one call. */
export async function estimateWaitFor({ branchId, position, serviceId, serversOverride }) {
  const stats = await loadServiceStats(branchId);
  return estimateWait({ position, serviceId, stats, serversOverride });
}
