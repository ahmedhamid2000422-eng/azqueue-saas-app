/**
 * wellness.js — pure, testable signal logic for "needs a moment" alerts.
 *
 * Compares a staff member's current service time against their personal
 * 7-day baseline. The threshold is intentionally personal — Yusuf's slow is
 * not Sara's slow. We never compare staff to each other.
 *
 * Returns null when no alert fires, or an alert object describing why.
 */

const SLOW_RATIO = 1.6;          // current service is 1.6× personal avg = flag
const MIN_BASELINE_SAMPLES = 5;   // need at least 5 historical sessions to compare
const MIN_CURRENT_DURATION_SEC = 10 * 60; // ignore tickets < 10 min — too short to be meaningful

/**
 * detectWellnessNeeds
 *
 * @param {object} args
 * @param {string}   args.staffId
 * @param {string}   args.staffName
 * @param {object}   args.currentSession  — {startedAt: Date|string, serviceId?: string}
 * @param {Array}    args.history         — service_times rows from last 7 days for this staff:
 *                                          [{duration_sec, created_at, service_id}]
 * @param {Date?}    args.now             — defaults to new Date()
 * @returns {Alert | null}
 *
 * Alert shape:
 *   { kind: "long_session"|"trending_slow"|null, severity: "warn"|"info",
 *     who, body, currentSec, baselineSec, deltaPct }
 */
export function detectWellnessNeeds({ staffId, staffName, currentSession, history, now = new Date() }) {
  if (!staffId) return null;
  history = history ?? [];

  // ── Signal A: current session running long vs. baseline ──────────
  if (currentSession?.startedAt) {
    const startedAt = new Date(currentSession.startedAt);
    const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
    if (elapsedSec >= MIN_CURRENT_DURATION_SEC) {
      // Build baseline from same service if we know the service, else from all
      const baselineRows = currentSession.serviceId
        ? history.filter((h) => h.service_id === currentSession.serviceId)
        : history;
      if (baselineRows.length >= MIN_BASELINE_SAMPLES) {
        const baselineSec = avg(baselineRows.map((r) => r.duration_sec ?? 0));
        if (baselineSec > 0 && elapsedSec > baselineSec * SLOW_RATIO) {
          const deltaPct = ((elapsedSec - baselineSec) / baselineSec) * 100;
          return {
            kind: "long_session",
            severity: "warn",
            who: staffName ?? "Staff",
            body: `Current session is ${formatMin(elapsedSec)} — about ${Math.round(deltaPct)}% over their 7-day average of ${formatMin(baselineSec)}. Needs a moment.`,
            currentSec: elapsedSec,
            baselineSec,
            deltaPct,
          };
        }
      }
    }
  }

  // ── Signal B: trending slow across last 3 sessions vs the rest ──
  // If their most recent 3 sessions average significantly slower than the
  // earlier four-day window, the staff member may be tired or distracted.
  if (history.length >= 7) {
    const sorted = [...history].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    const recent = sorted.slice(0, 3).map((r) => r.duration_sec ?? 0);
    const older  = sorted.slice(3).map((r) => r.duration_sec ?? 0);
    if (older.length >= MIN_BASELINE_SAMPLES) {
      const recentAvg = avg(recent);
      const olderAvg  = avg(older);
      if (olderAvg > 0 && recentAvg > olderAvg * 1.3) {
        const deltaPct = ((recentAvg - olderAvg) / olderAvg) * 100;
        return {
          kind: "trending_slow",
          severity: "info",
          who: staffName ?? "Staff",
          body: `Last 3 sessions averaged ${formatMin(recentAvg)} — about ${Math.round(deltaPct)}% slower than their week-baseline of ${formatMin(olderAvg)}.`,
          currentSec: recentAvg,
          baselineSec: olderAvg,
          deltaPct,
        };
      }
    }
  }

  return null;
}

/**
 * detectMany — runs `detectWellnessNeeds` over an array of staff.
 *
 * @param {Array} staff   — [{id, display_name}]
 * @param {object} historyByStaff   — staffId → array of service_times rows
 * @param {object} currentByStaff   — staffId → {startedAt, serviceId} or null
 * @returns {Alert[]}
 */
export function detectMany({ staff, historyByStaff, currentByStaff, now = new Date() }) {
  const alerts = [];
  for (const member of staff ?? []) {
    const a = detectWellnessNeeds({
      staffId: member.id,
      staffName: member.display_name,
      currentSession: currentByStaff?.[member.id] ?? null,
      history: historyByStaff?.[member.id] ?? [],
      now,
    });
    if (a) alerts.push(a);
  }
  return alerts;
}

/* ── helpers ─────────────────────────────────────────────────────── */
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + (x || 0), 0) / arr.length;
}

function formatMin(seconds) {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}
