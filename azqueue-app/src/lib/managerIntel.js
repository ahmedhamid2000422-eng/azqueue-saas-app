import { supabase } from "./supabase";

/**
 * managerIntel — turns the real staff status log + ticket history into the
 * signals Manager Mode promises:
 *   - staff roster with current state (from public.staff)
 *   - break-pattern heatmap (hour-of-day × staff, last 14 days)
 *   - long-task alerts (currently-serving tickets exceeding their service avg)
 *   - wellness signals (hours since last break)
 *   - weekly performance digest (per-staff served-per-shift trend)
 *
 * Pure(ish) functions where possible. `computeManagerIntel({ branchId })`
 * does the I/O and returns one object the Manager page can render.
 */

const LONG_TASK_THRESHOLD = 1.6; // 1.6× the staff's avg service time = flag
const WELLNESS_THRESHOLD_HOURS = 4;

export async function computeManagerIntel({ branchId }) {
  if (!branchId) return null;

  // All 5 queries fire in parallel — previously sequential (~250ms), now ~60ms.
  const thirtyAgo  = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const fourteenAgo = new Date(); fourteenAgo.setDate(fourteenAgo.getDate() - 14);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [
    { data: staffRows },
    { data: serving },
    { data: history },
    { data: statusLog },
    { data: todayTickets },
  ] = await Promise.all([
    // 1. Roster (narrowed from select("*"))
    supabase
      .from("staff")
      .select("id, display_name, role, status, status_since, branch_id")
      .eq("branch_id", branchId)
      .order("display_name"),

    // 2. Active currently-serving tickets (long-task detection)
    supabase
      .from("tickets")
      .select("id, token, customer_name, service_id, staff_id, started_at, called_at")
      .eq("branch_id", branchId)
      .eq("status", "serving"),

    // 3. Service-time history for baseline math (last 30 days)
    supabase
      .from("service_times")
      .select("service_id, staff_id, duration_sec, created_at")
      .eq("branch_id", branchId)
      .gte("created_at", thirtyAgo.toISOString()),

    // 4. Status log for break-pattern heatmap (last 14 days)
    supabase
      .from("staff_status_log")
      .select("staff_id, status, changed_at")
      .eq("branch_id", branchId)
      .gte("changed_at", fourteenAgo.toISOString())
      .order("changed_at", { ascending: true }),

    // 5. Today's tickets per staff (performance digest)
    supabase
      .from("tickets")
      .select("staff_id, status, completed_at")
      .eq("branch_id", branchId)
      .gte("created_at", todayStart.toISOString()),
  ]);

  const staff = staffRows ?? [];

  // ── Compute long-task & wellness alerts ──────────────────────────
  const alerts = [];
  const now = new Date();

  for (const t of (serving ?? [])) {
    const baseline = avgDuration((history ?? []).filter(
      (h) => h.staff_id === t.staff_id && h.service_id === t.service_id
    ));
    if (!baseline) continue;
    const elapsed = (now - new Date(t.started_at || t.called_at)) / 1000;
    if (elapsed > baseline * LONG_TASK_THRESHOLD) {
      const member = staff.find((s) => s.id === t.staff_id);
      alerts.push({
        kind: "long",
        severity: "warn",
        tag: "Long task",
        who: member?.display_name ?? `Ticket ${t.token}`,
        body: `${formatMin(elapsed)} elapsed · usually ${formatMin(baseline)}`,
        t: "now",
      });
    }
  }

  for (const member of staff) {
    if (member.status === "active" || member.status === "serving") {
      const lastBreak = lastEventTime(statusLog ?? [], member.id, "on_break");
      const sinceBreakHours = lastBreak
        ? (now - lastBreak) / 3_600_000
        : (now - new Date(member.status_since ?? member.status_since ?? now)) / 3_600_000;
      if (sinceBreakHours >= WELLNESS_THRESHOLD_HOURS) {
        alerts.push({
          kind: "wellness",
          severity: "warn",
          tag: "Wellness",
          who: member.display_name,
          body: `${sinceBreakHours.toFixed(1)}h since last break · suggest pause`,
          t: humanAgo(member.status_since),
        });
      }
    }
  }

  // ── Break-pattern heatmap ────────────────────────────────────────
  // Build a 24-hour bucket per staff: how many on_break events fall in each hour
  const heatmap = staff.map((member) => {
    const buckets = new Array(24).fill(0);
    for (const log of (statusLog ?? [])) {
      if (log.staff_id !== member.id) continue;
      if (log.status !== "on_break") continue;
      const h = new Date(log.changed_at).getHours();
      buckets[h] += 1;
    }
    const max = Math.max(...buckets, 1);
    return {
      id: member.id,
      name: member.display_name,
      values: buckets.map((v) => v / max), // 0..1 normalised
      raw: buckets,
    };
  });

  // ── Per-staff today summary ──────────────────────────────────────
  const todaySummary = staff.map((member) => {
    const mine = (todayTickets ?? []).filter((t) => t.staff_id === member.id);
    return {
      id: member.id,
      name: member.display_name,
      role: member.role,
      status: member.status,
      since: humanAgo(member.status_since),
      served: mine.filter((t) => t.status === "completed").length,
      flag: alerts.find((a) => a.who === member.display_name && a.kind === "long")
        ? "long"
        : alerts.find((a) => a.who === member.display_name && a.kind === "wellness")
          ? "wellness"
          : null,
    };
  });

  // ── Weekly digest — last 7 days, per staff ───────────────────────
  const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
  const fourteenStart = new Date(sevenAgo); fourteenStart.setDate(fourteenStart.getDate() - 7);

  const { data: weekTickets } = await supabase
    .from("tickets")
    .select("staff_id, completed_at, status")
    .eq("branch_id", branchId)
    .eq("status", "completed")
    .gte("completed_at", fourteenStart.toISOString());

  const weekly = staff.map((member) => {
    const mine = (weekTickets ?? []).filter((t) => t.staff_id === member.id);
    const last7 = mine.filter((t) => new Date(t.completed_at) >= sevenAgo).length;
    const prev7 = mine.length - last7;
    const delta = prev7 ? Math.round(((last7 - prev7) / prev7) * 100) : null;
    return {
      id: member.id,
      name: member.display_name,
      role: member.role,
      delta: delta == null
        ? "—"
        : delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : "—",
      note: delta == null
        ? "Baseline forming"
        : delta > 5 ? "Faster than last week"
        : delta < -5 ? "Slower than last week"
        : "Steady · on baseline",
      direction: delta == null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat",
      served: last7,
    };
  });

  // ── Wellness banner items ────────────────────────────────────────
  const wellness = alerts
    .filter((a) => a.kind === "wellness")
    .map((a) => ({ who: a.who, body: a.body, level: "warn" }));

  return {
    counts: {
      active: staff.filter((s) => s.status === "active" || s.status === "serving").length,
      onBreak: staff.filter((s) => s.status === "on_break").length,
      alerts: alerts.length,
    },
    alerts,
    roster: todaySummary,
    heatmap,
    weekly,
    wellness,
  };
}

/* ── helpers ─────────────────────────────────────────────────────── */
function avgDuration(rows) {
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + (r.duration_sec || 0), 0) / rows.length;
}
function lastEventTime(log, staffId, status) {
  for (let i = log.length - 1; i >= 0; i--) {
    const r = log[i];
    if (r.staff_id === staffId && r.status === status) return new Date(r.changed_at);
  }
  return null;
}
function formatMin(seconds) {
  if (!seconds) return "—";
  return `${Math.round(seconds / 60)} min`;
}
function humanAgo(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
