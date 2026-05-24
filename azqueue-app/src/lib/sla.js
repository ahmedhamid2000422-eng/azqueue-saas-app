/**
 * sla.js — SLA policy management + escalation sweep.
 *
 * The sweep is the ethical core of this feature:
 *   - ONE query per branch per tick (never per task, never per person).
 *   - Tickets at PAUSED stations are skipped — prayer/break time
 *     cannot accumulate toward a breach. This is the ethical hinge.
 *   - Escalations record a station_id, NEVER a user_id. Adding user_id
 *     would turn this into a discipline log. That column is permanently banned.
 *   - If ops_sla is disabled, sweep() returns immediately — zero queries.
 *
 * Clock start:
 *   COALESCE(started_at, called_at, created_at) — uses the earliest
 *   reliable timestamp available on the ticket without adding new columns.
 */

import { supabase } from "./supabase";

// ── Policy CRUD ───────────────────────────────────────────────────────

/**
 * Load (or create with defaults) the SLA policy for a branch.
 */
export async function loadPolicy(branchId) {
  if (!branchId) return null;
  const { data } = await supabase
    .from("sla_policies")
    .select("*")
    .eq("branch_id", branchId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Upsert the SLA policy for a branch.
 * Safe to call even if no policy row exists yet.
 */
export async function savePolicy(branchId, { targetSecs, breachSecs, enabled, bounceWarnCount, bounceBreachCount }) {
  const { data, error } = await supabase
    .from("sla_policies")
    .upsert(
      {
        branch_id:           branchId,
        target_secs:         targetSecs,
        breach_secs:         breachSecs,
        enabled,
        bounce_warn_count:   bounceWarnCount   ?? 2,
        bounce_breach_count: bounceBreachCount ?? 3,
      },
      { onConflict: "branch_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ── Escalation queries ────────────────────────────────────────────────

/**
 * Load all open escalations for a branch, joined with ticket + station name.
 * Returns newest first.
 */
export async function loadOpenEscalations(branchId) {
  if (!branchId) return [];

  // Get ticket IDs for this branch first (RLS covers this)
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id")
    .eq("branch_id", branchId)
    .in("status", ["waiting", "serving"]);

  if (!tickets?.length) return [];

  const ticketIds = tickets.map((t) => t.id);

  const { data } = await supabase
    .from("escalations")
    // Join ticket so callers can show customer name, token, bounce count
    .select("id, ticket_id, station_id, level, reason, created_at, tickets(token, customer_name, bounce_count, priority, assigned_station_id)")
    .in("ticket_id", ticketIds)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * Mark an escalation as resolved (manager has taken action).
 */
export async function resolveEscalation(escalationId) {
  const { error } = await supabase
    .from("escalations")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", escalationId);
  if (error) throw error;
}

// ── Sweep ─────────────────────────────────────────────────────────────

/**
 * One sweep per branch per tick (called every 60s from Stations.jsx).
 *
 * Algorithm:
 *   Pass A — time escalation (unchanged):
 *     1. If policy is null or !enabled, return immediately.
 *     2. Fetch active station IDs (paused stations excluded — ethical hinge).
 *     3. Fetch assigned tickets older than target_secs at those stations.
 *     4. Load existing open escalations to skip duplicates.
 *     5. Classify each ticket → warning or breach (reason: time_exceeded).
 *
 *   Pass B — bounce escalation (new):
 *     6. Fetch tickets with bounce_count >= bounce_warn_count (any status,
 *        any station — a bounced ticket may be unassigned between parks).
 *     7. Skip tickets that already have an open bounce_excessive escalation.
 *     8. Classify: bounce_count >= breach → breach, else warning.
 *
 *   Both passes share one batch insert at the end.
 *
 * Cost: 4 reads + 1 conditional write per branch per minute.
 */
export async function runSweep(branchId, policy) {
  if (!policy?.enabled) return { warnings: 0, breaches: 0 };
  if (!branchId) return { warnings: 0, breaches: 0 };

  const now = Date.now();
  const warnCutoff = new Date(now - policy.target_secs * 1000).toISOString();

  // ── Pass A: time escalation ───────────────────────────────────────

  // 1. Active stations only — paused stations cannot breach (ethical hinge)
  const { data: activeStations } = await supabase
    .from("stations")
    .select("id")
    .eq("branch_id", branchId)
    .eq("status", "active");

  const stationIds = (activeStations ?? []).map((s) => s.id);

  // 2. Assigned tickets at active stations older than warn threshold
  const timeCandidates = stationIds.length
    ? (await supabase
        .from("tickets")
        .select("id, assigned_station_id, started_at, called_at, created_at")
        .eq("branch_id", branchId)
        .in("status", ["waiting", "serving"])
        .in("assigned_station_id", stationIds)
        .lt("created_at", warnCutoff)
      ).data ?? []
    : [];

  // ── Pass B: bounce escalation ─────────────────────────────────────
  const bounceWarn   = policy.bounce_warn_count   ?? 2;
  const bounceBreach = policy.bounce_breach_count ?? 3;

  // 3. All tickets for this branch with bounce_count >= warn threshold
  const { data: bounceCandidates } = await supabase
    .from("tickets")
    .select("id, assigned_station_id, bounce_count")
    .eq("branch_id", branchId)
    .in("status", ["waiting", "serving"])
    .gte("bounce_count", bounceWarn);

  // ── Load existing open escalations for all candidates ────────────
  const allCandidateIds = [
    ...new Set([
      ...timeCandidates.map((t) => t.id),
      ...(bounceCandidates ?? []).map((t) => t.id),
    ]),
  ];

  let existingByTicket = {}; // ticketId → { time: level|null, bounce: level|null }

  if (allCandidateIds.length) {
    const { data: existing } = await supabase
      .from("escalations")
      .select("ticket_id, level, reason")
      .in("ticket_id", allCandidateIds)
      .is("resolved_at", null);

    for (const e of (existing ?? [])) {
      if (!existingByTicket[e.ticket_id]) {
        existingByTicket[e.ticket_id] = { time: null, bounce: null };
      }
      if (e.reason === "bounce_excessive") {
        existingByTicket[e.ticket_id].bounce = e.level;
      } else {
        // treat any other reason as time-based for dedup purposes
        if (!existingByTicket[e.ticket_id].time || e.level === "breach") {
          existingByTicket[e.ticket_id].time = e.level;
        }
      }
    }
  }

  const toInsert = [];

  for (const t of timeCandidates) {
    const ex = existingByTicket[t.id];
    if (ex?.time === "breach") continue; // already at max severity

    const clockStart = t.started_at ?? t.called_at ?? t.created_at;
    const elapsedSec = (now - new Date(clockStart).getTime()) / 1000;
    const level = elapsedSec >= policy.breach_secs ? "breach" : "warning";

    // Skip if we already have an equal or higher escalation
    if (ex?.time === level) continue;
    if (ex?.time === "breach") continue;

    toInsert.push({
      ticket_id:    t.id,
      station_id:   t.assigned_station_id ?? null,
      level,
      reason:       "time_exceeded",
      elapsed_secs: Math.round(elapsedSec),
    });
  }

  // ── Classify bounce candidates ────────────────────────────────────────
  for (const t of (bounceCandidates ?? [])) {
    const ex = existingByTicket[t.id];
    if (ex?.bounce === "breach") continue;

    const level = (t.bounce_count ?? 0) >= bounceBreach ? "breach" : "warning";
    if (ex?.bounce === level) continue;

    toInsert.push({
      ticket_id:    t.id,
      station_id:   t.assigned_station_id ?? null,
      level,
      reason:       "bounce_excessive",
      elapsed_secs: null,
    });
  }

  // ── Batch insert ──────────────────────────────────────────────────────
  if (toInsert.length) {
    await supabase.from("escalations").insert(toInsert);
  }

  const warnings = toInsert.filter((r) => r.level === "warning").length;
  const breaches = toInsert.filter((r) => r.level === "breach").length;
  return { warnings, breaches };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Format elapsed seconds as a human-readable string for escalation cards.
 * e.g. 125 → "2m 5s", 45 → "45s"
 */
export function fmtElapsed(secs) {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
