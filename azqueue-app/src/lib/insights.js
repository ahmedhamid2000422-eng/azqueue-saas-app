import { supabase } from "./supabase";

/**
 * Insights compute — turns the queue history into the four signals the
 * Insights dashboard promises. Pure functions where possible; the entry
 * point `computeInsights({ branchId })` does the I/O.
 *
 * Signals returned:
 *   - avgWaitSec       : avg created_at→called_at across today's served tickets
 *   - noShowRate       : count(no_show today) / count(total today)
 *   - bookingConversion: count(arrived bookings today) / count(total bookings today)
 *   - servedToday      : count(completed today)
 *   - waitingNow       : count(waiting right now)
 *   - alerts           : array of action items (slow service, idle staff, repeat drift, etc.)
 *
 * No data → all returns null/0 so the UI can show "—" instead of pretending.
 */
export async function computeInsights({ branchId }) {
  if (!branchId) return null;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // 1. All today's tickets (only what we need)
  const { data: todayTickets } = await supabase
    .from("tickets")
    .select("id, status, created_at, called_at, completed_at, source, service_id, customer_phone")
    .eq("branch_id", branchId)
    .gte("created_at", todayISO);

  const tickets = todayTickets ?? [];
  const total = tickets.length;
  const served = tickets.filter((t) => t.status === "completed");
  const noShows = tickets.filter((t) => t.status === "no_show");
  const waiting = tickets.filter((t) => t.status === "waiting").length;

  // 2. Avg wait (created → called) across today's called/served tickets
  const calledTickets = tickets.filter((t) => t.called_at);
  const avgWaitSec = calledTickets.length
    ? Math.round(
        calledTickets.reduce((s, t) => s + (new Date(t.called_at) - new Date(t.created_at)) / 1000, 0) /
          calledTickets.length
      )
    : null;

  // 3. No-show rate
  const noShowRate = total ? noShows.length / total : null;

  // 4. Booking conversion — booked → arrived
  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("id, status, scheduled_at")
    .eq("branch_id", branchId)
    .gte("scheduled_at", todayISO);

  const bookings = todayBookings ?? [];
  const arrived = bookings.filter((b) => b.status === "arrived").length;
  const bookingConversion = bookings.length ? arrived / bookings.length : null;

  // 5. Slow-service alert — compare today's avg per service vs last 30-day avg
  const slowServices = await detectSlowServices(branchId, todayISO);

  // 6. Idle counter alert — anyone marked 'active' with no served ticket in 30 min
  // Pass already-fetched data so detectIdleStaff never needs its own DB queries.
  const idleAlert = await detectIdleStaff(branchId, tickets, waiting);

  // 7. Repeat-customer drift — same phone twice today, second wait > first
  const repeatDrift = detectRepeatDrift(tickets);

  const alerts = [
    ...slowServices.map((s) => ({
      severity: "warn",
      mark: "✱",
      title: `Slow service · ${s.name}`,
      body: `Today's average runs ${Math.round(s.deltaPct)}% slower than baseline.`,
      impactLabel: "wait",
      impact: `+${Math.round(s.deltaPct)}%`,
      direction: "up", // worse
    })),
    ...(idleAlert ? [{
      severity: "info",
      mark: "✦",
      title: "Idle staff",
      body: idleAlert,
      impactLabel: "util",
      impact: "−",
      direction: "down",
    }] : []),
    ...(repeatDrift ? [{
      severity: "info",
      mark: "✱",
      title: "Repeat-customer drift",
      body: repeatDrift,
      impactLabel: "NPS",
      direction: "down",
      impact: "−",
    }] : []),
  ];

  return {
    avgWaitSec,
    noShowRate,
    bookingConversion,
    servedToday: served.length,
    totalToday: total,
    waitingNow: waiting,
    alerts,
  };
}

/**
 * Slow-service detection — for each service, compare today's avg duration
 * to the last 30 days' avg. Anything 30%+ slower flags as an anomaly.
 */
async function detectSlowServices(branchId, todayISO) {
  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);

  const { data: recent } = await supabase
    .from("service_times")
    .select("service_id, duration_sec, created_at")
    .eq("branch_id", branchId)
    .gte("created_at", thirtyAgo.toISOString());

  if (!recent?.length) return [];

  // Group by service, compute today's avg + 30d avg
  const byService = {};
  for (const r of recent) {
    if (!r.service_id) continue;
    if (!byService[r.service_id]) byService[r.service_id] = { today: [], all: [] };
    byService[r.service_id].all.push(r.duration_sec);
    if (new Date(r.created_at) >= new Date(todayISO)) {
      byService[r.service_id].today.push(r.duration_sec);
    }
  }

  const slow = [];
  for (const [serviceId, { today, all }] of Object.entries(byService)) {
    if (today.length < 2 || all.length < 5) continue; // need enough data
    const todayAvg = avg(today);
    const baseline = avg(all);
    if (todayAvg > baseline * 1.3) {
      slow.push({
        serviceId,
        deltaPct: ((todayAvg - baseline) / baseline) * 100,
      });
    }
  }

  // Resolve names
  if (slow.length) {
    const ids = slow.map((s) => s.serviceId);
    const { data: svcs } = await supabase.from("services").select("id, name").in("id", ids);
    const nameMap = Object.fromEntries((svcs ?? []).map((s) => [s.id, s.name]));
    return slow.map((s) => ({ ...s, name: nameMap[s.serviceId] ?? "service" }));
  }

  return [];
}

/**
 * Idle-staff detection — anyone whose status='active' but who hasn't completed
 * a ticket in the last 30 minutes, while there's a queue of 2+ waiting.
 *
 * Uses already-fetched todayTickets + waitingCount to avoid N+1 DB queries.
 * The staff fetch is the only remaining query and is shared with the roster check.
 */
async function detectIdleStaff(branchId, todayTickets = [], waitingCount = 0) {
  if (waitingCount < 2) return null;

  const { data: activeStaff } = await supabase
    .from("staff")
    .select("id, display_name, status_since")
    .eq("branch_id", branchId)
    .eq("status", "active");

  if (!activeStaff?.length) return null;

  const cutoff = new Date(Date.now() - 30 * 60_000);

  for (const staff of activeStaff) {
    // Check in-memory: did this staff member complete anything in the last 30 min?
    const recentlyServed = todayTickets.some(
      (t) =>
        t.staff_id === staff.id &&
        t.status === "completed" &&
        t.completed_at &&
        new Date(t.completed_at) >= cutoff
    );
    if (!recentlyServed) {
      return `${staff.display_name} active but no ticket served in 30 min · queue has ${waitingCount} waiting.`;
    }
  }
  return null;
}

/**
 * Repeat-customer drift — same phone returns later in the same day with a longer wait.
 * Crude proxy for "loyalty cohort waiting longer than first-timers."
 */
function detectRepeatDrift(tickets) {
  const byPhone = {};
  for (const t of tickets) {
    if (!t.customer_phone || !t.called_at) continue;
    if (!byPhone[t.customer_phone]) byPhone[t.customer_phone] = [];
    byPhone[t.customer_phone].push(t);
  }
  const repeatWaits = [];
  for (const arr of Object.values(byPhone)) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    for (let i = 1; i < arr.length; i++) {
      const w0 = (new Date(arr[0].called_at) - new Date(arr[0].created_at)) / 1000;
      const w1 = (new Date(arr[i].called_at) - new Date(arr[i].created_at)) / 1000;
      if (w1 > w0 * 1.4) repeatWaits.push({ first: w0, repeat: w1 });
    }
  }
  if (!repeatWaits.length) return null;
  const avgRise = avg(repeatWaits.map((r) => (r.repeat - r.first) / r.first)) * 100;
  return `Returning customers waited ${Math.round(avgRise)}% longer than first-timers today.`;
}

function avg(arr) {
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

/**
 * Format helpers for the dashboard.
 */
export function fmtMin(seconds) {
  if (seconds == null) return "—";
  return `${Math.round(seconds / 60)}m`;
}
export function fmtPct(ratio) {
  if (ratio == null) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}
