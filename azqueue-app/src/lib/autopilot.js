import { supabase } from "./supabase";

/**
 * Autopilot — learns service times and auto-calls the next customer at the right pace.
 *
 * Pacing rules (premium rhythm, not a brutal stopwatch):
 *   1. Adaptive — the call interval is the rolling average service time for the
 *      currently-serving service, with a sensible default fallback.
 *   2. Staff-aware — if more customers are being called than there are active staff,
 *      we slow down by 30%. (The system trusts the floor over the timer.)
 *   3. Pause-aware — if the prayer pause is active or approaching, autopilot halts.
 *      It resumes automatically when the pause window clears.
 *
 * This file is the pure logic. The React hook `useAutopilot` ticks it.
 */

const DEFAULT_DURATION_SEC = 20 * 60;     // 20 min if nothing else is known
const STAFF_OVERLOAD_SLOWDOWN = 1.3;      // ×1.3 when called > active staff
const MIN_INTERVAL_SEC = 60;              // never call faster than 60s after the previous call

/**
 * Compute the rolling average service duration (in seconds) for the given
 * branch + optional service filter. Returns null if no data yet.
 *
 * Looks at the last `windowSize` completed services (default 30) so it adapts
 * to recent rhythm rather than ancient history.
 */
export async function getAvgServiceSeconds({ branchId, serviceId = null, windowSize = 30 }) {
  if (!branchId) return null;
  let q = supabase
    .from("service_times")
    .select("duration_sec")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(windowSize);
  if (serviceId) q = q.eq("service_id", serviceId);

  const { data, error } = await q;
  if (error || !data || data.length === 0) return null;

  const total = data.reduce((sum, r) => sum + (r.duration_sec || 0), 0);
  return Math.round(total / data.length);
}

/**
 * Decide whether autopilot should call the next customer right now.
 *
 * Inputs:
 *   serving            — the currently-serving ticket (or null)
 *   waiting            — array of waiting tickets, oldest first
 *   activeStaffCount   — how many staff are currently set to "active" or "serving"
 *   avgServiceSec      — rolling average service duration in seconds
 *   pauseStatus        — { state: "clear" | "approaching" | "paused" }
 *   now                — Date instance
 *
 * Returns one of:
 *   { action: "call",  ticket }     — call this ticket now
 *   { action: "wait",  reason }     — wait; reason is human-readable
 *   { action: "halt",  reason }     — halt because of pause window
 */
export function decide({
  serving,
  waiting,
  activeStaffCount = 1,
  avgServiceSec,
  pauseStatus,
  now = new Date(),
}) {
  if (pauseStatus?.state === "paused" || pauseStatus?.state === "approaching") {
    return { action: "halt", reason: `paused for ${pauseStatus.prayer}` };
  }

  if (waiting.length === 0) {
    return { action: "wait", reason: "queue empty" };
  }

  // If nothing serving and queue has people → call first
  if (!serving) {
    return { action: "call", ticket: waiting[0] };
  }

  // Staff-aware slowdown — count tickets in 'serving' state
  const beingCalled = 1; // serving counts as one
  const overloadFactor = beingCalled > activeStaffCount ? STAFF_OVERLOAD_SLOWDOWN : 1;

  const targetIntervalSec = Math.max(
    MIN_INTERVAL_SEC,
    (avgServiceSec || DEFAULT_DURATION_SEC) * overloadFactor
  );

  // How long has the current service been running?
  const startedAt = serving.started_at ? new Date(serving.started_at) : new Date(serving.called_at || now);
  const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));

  if (elapsedSec >= targetIntervalSec) {
    return { action: "call", ticket: waiting[0] };
  }

  return {
    action: "wait",
    reason: `next call in ${formatRemaining(targetIntervalSec - elapsedSec)}`,
    secondsUntilNext: targetIntervalSec - elapsedSec,
    targetIntervalSec,
  };
}

function formatRemaining(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/**
 * Record a completed service in the service_times log so future avg calculations
 * become more accurate. Call this whenever a ticket transitions to "completed".
 */
export async function logServiceTime({ branchId, ticketId, serviceId, staffId, startedAt, completedAt }) {
  if (!startedAt || !completedAt) return;
  const durationSec = Math.max(1, Math.floor((new Date(completedAt) - new Date(startedAt)) / 1000));
  await supabase.from("service_times").insert({
    branch_id: branchId,
    ticket_id: ticketId,
    service_id: serviceId ?? null,
    staff_id: staffId ?? null,
    duration_sec: durationSec,
  });
}
