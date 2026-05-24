/**
 * stations.js — client helpers for the Stations + Routing feature.
 *
 * All functions talk directly to Supabase (no separate API server).
 * Routing is handled via a database RPC to ensure atomic assignment
 * and avoid race conditions from concurrent manager actions.
 *
 * Ethics note: no function here surfaces per-person metrics.
 * Load is a station property, not a person property.
 */

import { supabase } from "./supabase";

// ── Queries ──────────────────────────────────────────────────────────

/**
 * Load all stations for a branch, with their live task load derived
 * in memory from a parallel tickets fetch. Load is never stored —
 * computing it live avoids stale counts.
 */
export async function loadStations(branchId) {
  if (!branchId) return [];

  const [{ data: stationRows }, { data: activeTickets }] = await Promise.all([
    supabase
      .from("stations")
      .select("id, name, status, pause_reason, created_at, branch_id")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: true }),

    supabase
      .from("tickets")
      .select("assigned_station_id")
      .eq("branch_id", branchId)
      .in("status", ["waiting", "serving"])
      .not("assigned_station_id", "is", null),
  ]);

  // Build load map from in-memory ticket data
  const loadMap = {};
  for (const t of (activeTickets ?? [])) {
    loadMap[t.assigned_station_id] = (loadMap[t.assigned_station_id] ?? 0) + 1;
  }

  return (stationRows ?? []).map((s) => ({ ...s, load: loadMap[s.id] ?? 0 }));
}

/**
 * Count active (non-paused, non-offline) stations for a branch.
 * Used to compute coverage threshold for the pause warning.
 */
export async function countActiveStations(branchId) {
  const { count } = await supabase
    .from("stations")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId)
    .eq("status", "active");
  return count ?? 0;
}

// ── Mutations ────────────────────────────────────────────────────────

/**
 * Create a new station for a branch.
 */
export async function createStation(branchId, name) {
  const { data, error } = await supabase
    .from("stations")
    .insert({ branch_id: branchId, name: name.trim() })
    .select("id, name, status, pause_reason, created_at, branch_id")
    .single();
  if (error) throw error;
  return { ...data, load: 0 };
}

/**
 * Update a station's name.
 */
export async function renameStation(stationId, name) {
  const { error } = await supabase
    .from("stations")
    .update({ name: name.trim() })
    .eq("id", stationId);
  if (error) throw error;
}

/**
 * Set station status. Emits a station_events row for 'paused' and 'resumed'.
 *
 * status: 'active' | 'paused' | 'offline'
 * reason: 'break' | 'prayer' | 'maintenance' | null
 *
 * pause_reason is CURRENT state only — not a log of who paused when.
 */
export async function setStationStatus(stationId, status, reason = null) {
  const update = {
    status,
    pause_reason: status === "active" ? null : reason,
  };

  const { error } = await supabase
    .from("stations")
    .update(update)
    .eq("id", stationId);
  if (error) throw error;

  // Emit telemetry event (station-level only)
  const eventType = status === "active" ? "resumed" : "paused";
  await supabase
    .from("station_events")
    .insert({ station_id: stationId, event_type: eventType });
}

/**
 * Delete a station. Assigned tickets become unrouted (FK set null by DB).
 */
export async function deleteStation(stationId) {
  const { error } = await supabase
    .from("stations")
    .delete()
    .eq("id", stationId);
  if (error) throw error;
}

// ── Routing ──────────────────────────────────────────────────────────

/**
 * Route the next unrouted waiting ticket to the least-loaded active station.
 * Runs as an atomic RPC to prevent race conditions.
 *
 * Returns the assigned ticket id, or null if nothing to route.
 */
export async function routeNextTicket(branchId) {
  const { data, error } = await supabase.rpc("route_next_ticket", {
    p_branch_id: branchId,
  });
  if (error) throw error;
  return data; // uuid or null
}

/**
 * Manually reassign a ticket to a specific station (manager override).
 * Emits an 'assigned' telemetry event.
 */
export async function reassignTicket(ticketId, stationId) {
  const { data: ticket, error: fetchErr } = await supabase
    .from("tickets")
    .select("assigned_station_id")
    .eq("id", ticketId)
    .single();
  if (fetchErr) throw fetchErr;

  const { error } = await supabase
    .from("tickets")
    .update({ assigned_station_id: stationId })
    .eq("id", ticketId);
  if (error) throw error;

  // Telemetry: assignment event on the new station
  await supabase
    .from("station_events")
    .insert({ station_id: stationId, ticket_id: ticketId, event_type: "assigned" });
}

// ── Coverage helper ───────────────────────────────────────────────────

/**
 * Returns true if pausing one more station would drop coverage below
 * the minimum threshold (default: at least 1 active station must remain).
 */
export function isCoverageLow(stations, minActive = 1) {
  const activeCount = stations.filter((s) => s.status === "active").length;
  return activeCount - 1 < minActive;
}
