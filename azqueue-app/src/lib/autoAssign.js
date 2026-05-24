/**
 * autoAssign.js — Smart staff-assignment & schedule-optimization engine.
 *
 * FUNCTIONS
 *   enrichStaffLoad()   — Add `.currentLoad` (active ticket count) to each staff
 *                         member so the picker can balance workload.
 *
 *   pickBestStaff()     — Given a service name + enriched staff list, return the
 *                         optimal assignee:
 *                           · extended / complex → manager / senior / specialist
 *                           · standard / quick   → regular staff (preserve specialist capacity)
 *                           · ties broken by lightest current load
 *
 *   scheduleReflow()    — Compare today's bookings against real duration stats and
 *                         flag two kinds of issues:
 *                           "overrun"   — service is averaging >20% over estimate
 *                                         (needs ≥5 real samples to fire)
 *                           "collision" — a booking slot would overlap with the
 *                                         previous appointment given actual durations
 *
 *   autoFixSchedule()   — Compute the minimum set of booking-time adjustments to
 *                         eliminate all collision issues. Returns proposed changes
 *                         (does NOT write to DB — caller applies after confirmation).
 */

import { getComplexity } from "./complexity";

// ── Staff-load enrichment ─────────────────────────────────────────────────

/**
 * Enrich a staff list with each member's current ticket workload.
 *
 * @param {Staff[]}  staffList     — raw staff rows from Supabase
 * @param {Ticket[]} activeTickets — waiting + serving tickets for today
 * @returns {Staff[]} same objects with `.currentLoad` count added
 */
export function enrichStaffLoad(staffList, activeTickets = []) {
  const counts = {};
  for (const t of activeTickets ?? []) {
    if (t.staff_id) counts[t.staff_id] = (counts[t.staff_id] ?? 0) + 1;
  }
  return (staffList ?? []).map((s) => ({
    ...s,
    currentLoad: counts[s.id] ?? 0,
  }));
}

// ── Best-staff picker ─────────────────────────────────────────────────────

/**
 * Pick the best available staff member for a given service.
 *
 * Routing rules (in order):
 *   1. extended / complex → prefer managers / seniors / specialists
 *   2. standard / quick  → prefer regular staff (keep specialists free)
 *   3. Within each group: lightest current load wins
 *   4. If no ideal match: fall back to lightest-loaded anyone
 *
 * @param {string}   serviceName        — e.g. "Business Tax Return"
 * @param {Staff[]}  staffList          — enriched via enrichStaffLoad()
 * @param {object}   [opts]
 * @param {string[]} [opts.excludeIds]  — staff IDs to skip (e.g. on break)
 * @returns {{ staffId: string|null, staffName: string, reason: string }}
 */
export function pickBestStaff(serviceName, staffList, { excludeIds = [] } = {}) {
  if (!staffList?.length) {
    return { staffId: null, staffName: "Any", reason: "No staff configured" };
  }

  const cx = getComplexity(serviceName);
  const needsSpecialist = cx.tier === "extended" || cx.tier === "complex";

  const active = (staffList ?? []).filter(
    (s) =>
      !excludeIds.includes(s.id) &&
      (s.status === "active" || !s.status)
  );

  if (!active.length) {
    return { staffId: null, staffName: "Any", reason: "No active staff available" };
  }

  const isSpecialist = (s) =>
    ["manager", "senior", "specialist"].includes((s.role ?? "").toLowerCase());

  const specialists = active.filter(isSpecialist);
  const regulars    = active.filter((s) => !isSpecialist(s));

  // Sort ascending by current load (lightest first)
  const byLoad = (arr) =>
    [...arr].sort((a, b) => (a.currentLoad ?? 0) - (b.currentLoad ?? 0));

  if (needsSpecialist && specialists.length) {
    const pick = byLoad(specialists)[0];
    return {
      staffId:   pick.id,
      staffName: pick.display_name,
      reason:    `${cx.label} case → routed to ${pick.display_name} (${pick.role ?? "specialist"}, ${pick.currentLoad ?? 0} active)`,
    };
  }

  if (!needsSpecialist && regulars.length) {
    const pick = byLoad(regulars)[0];
    return {
      staffId:   pick.id,
      staffName: pick.display_name,
      reason:    `${cx.label} service → ${pick.display_name} (keeps specialist free)`,
    };
  }

  // Fallback: lightest-loaded anyone
  const pick = byLoad(active)[0];
  return {
    staffId:   pick.id,
    staffName: pick.display_name,
    reason:    `Best available → ${pick.display_name} (load: ${pick.currentLoad ?? 0})`,
  };
}

// ── Schedule reflow detector ──────────────────────────────────────────────

/**
 * Scan today's bookings for duration overruns and slot collisions.
 *
 * Overrun  — fires when real avg > estimated * 1.2 AND ≥5 samples exist.
 * Collision — fires when, using actual durations, a booking's start time
 *             falls before the previous appointment would finish.
 *
 * @param {Booking[]} bookings      — today's bookings
 * @param {object}    serviceMap    — { id → name }
 * @param {object}    durationStats — from buildDurationStats(); may be empty
 * @param {Staff[]}   staffList     — to resolve display names
 * @returns {ReflowIssue[]}
 *   Each issue: { type, severity, bookingId, staffName, serviceName, scheduledAt, message }
 */
export function scheduleReflow(bookings, serviceMap, durationStats, staffList = []) {
  if (!bookings?.length) return [];

  const staffMap = Object.fromEntries(
    (staffList ?? []).map((s) => [s.id, s.display_name])
  );
  const issues = [];

  // Group by staff (key = staff_id or "unassigned")
  const byStaff = {};
  for (const b of bookings) {
    const key = b.staff_id ?? "unassigned";
    if (!byStaff[key]) byStaff[key] = [];
    byStaff[key].push(b);
  }

  for (const [staffId, bks] of Object.entries(byStaff)) {
    const sorted    = [...bks].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    const staffName = staffMap[staffId] ?? (staffId === "unassigned" ? "Unassigned" : "Staff");
    let cursorEnd   = null; // expected end of previous appointment

    for (const b of sorted) {
      const name    = serviceMap[b.service_id] ?? "Service";
      const cx      = getComplexity(name);
      const stats   = durationStats[name];
      const realAvg = stats?.count >= 5 ? stats.avg : null;
      const actualMin = realAvg ?? cx.estimatedMin;
      const scheduledStart = new Date(b.scheduled_at);

      // ── Overrun warning ─────────────────────────────────────────────
      if (realAvg && realAvg > cx.estimatedMin * 1.2) {
        const overrunMin = Math.round(realAvg - cx.estimatedMin);
        issues.push({
          type:         "overrun",
          severity:     overrunMin > 20 ? "high" : "medium",
          bookingId:    b.id,
          staffName,
          serviceName:  name,
          scheduledAt:  b.scheduled_at,
          actualMin:    realAvg,
          estimatedMin: cx.estimatedMin,
          sampleCount:  stats.count,
          message: `"${name}" averages ${realAvg}m (estimate: ${cx.estimatedMin}m, +${overrunMin}m) across ${stats.count} real cases. Add buffer or re-assign.`,
        });
      }

      // ── Collision check ─────────────────────────────────────────────
      if (cursorEnd && scheduledStart < cursorEnd) {
        const overlapMin = Math.round((cursorEnd - scheduledStart) / 60000);
        issues.push({
          type:        "collision",
          severity:    "high",
          bookingId:   b.id,
          staffName,
          serviceName: name,
          scheduledAt: b.scheduled_at,
          message: `${staffName}'s bookings overlap by ~${overlapMin}m — "${name}" at ${fmtTime(scheduledStart)} starts before the previous appointment ends.`,
        });
      }

      // Advance cursor by actual service duration
      cursorEnd = new Date(scheduledStart.getTime() + actualMin * 60000);
    }
  }

  return issues;
}

// ── Auto-fix (compute adjusted booking times) ─────────────────────────────

/**
 * Compute the minimum set of booking-time adjustments to eliminate all
 * collision issues detected by scheduleReflow().
 *
 * Does NOT write to the database — returns proposed changes for the caller
 * to apply after user confirmation.
 *
 * @param {Booking[]} bookings      — today's bookings
 * @param {object}    serviceMap    — { id → name }
 * @param {object}    durationStats — real duration data
 * @param {Staff[]}   staffList     — to resolve names
 * @returns {{ bookingId: string, staffName: string, serviceName: string, oldTime: string, newTime: string }[]}
 */
export function autoFixSchedule(bookings, serviceMap, durationStats, staffList = []) {
  if (!bookings?.length) return [];

  const staffMap = Object.fromEntries(
    (staffList ?? []).map((s) => [s.id, s.display_name])
  );
  const fixes = [];

  // Process each staff member's bookings in time order
  const byStaff = {};
  for (const b of bookings) {
    const key = b.staff_id ?? "unassigned";
    if (!byStaff[key]) byStaff[key] = [];
    byStaff[key].push(b);
  }

  for (const [staffId, bks] of Object.entries(byStaff)) {
    const sorted   = [...bks].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    const staffName = staffMap[staffId] ?? "Staff";
    let cursor     = null; // earliest start time for next booking

    for (const b of sorted) {
      const name       = serviceMap[b.service_id] ?? "Service";
      const cx         = getComplexity(name);
      const stats      = durationStats[name];
      const actualMin  = (stats?.count >= 5 ? stats.avg : null) ?? cx.estimatedMin;
      const scheduled  = new Date(b.scheduled_at);

      // If cursor pushes this booking back, record the fix
      const effective  = cursor && cursor > scheduled ? cursor : scheduled;

      if (cursor && cursor > scheduled) {
        fixes.push({
          bookingId:   b.id,
          staffName,
          serviceName: name,
          oldTime:     b.scheduled_at,
          newTime:     effective.toISOString(),
          shiftMin:    Math.round((effective - scheduled) / 60000),
        });
      }

      // Advance cursor: this booking ends at effective + actualMin
      cursor = new Date(effective.getTime() + actualMin * 60000);
    }
  }

  return fixes;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtTime(d) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
