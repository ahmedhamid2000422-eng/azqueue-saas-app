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
      .select("id, name, status, pause_reason, created_at, branch_id, staff_id")
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
    .select("id, name, status, pause_reason, created_at, branch_id, staff_id")
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

/**
 * Who is normally at this counter.
 *
 * A label and a default, not a record of work. What actually gets written to
 * a ticket is chosen per device on the Queue page — if this wrote to tickets
 * as well, the two could disagree and attribution would quietly go wrong
 * again. Pass null to clear.
 */
export async function setStationStaff(stationId, staffId) {
  const { error } = await supabase
    .from("stations")
    .update({ staff_id: staffId || null })
    .eq("id", stationId);
  if (error) { console.error("[stations] assign staff failed", error); return { ok: false, error: error.message }; }
  return { ok: true };
}

/* ── What each counter can handle ────────────────────────────────────
   Backed by the station_services join table (migration 0061).

   THE EMPTY-SET RULE, RESTATED HERE BECAUSE IT IS EASY TO GET WRONG:
   a station with no rows is UNRESTRICTED, not incapable. Every station has
   zero rows the moment the migration runs, and treating that as "handles
   nothing" would stop the queue routing to every counter at once — a total
   outage caused by a migration that only added a table.

   So: an empty set means "not configured", and the caller should treat that
   station as able to take anything. Do not seed stations with every service
   to avoid this — that loses the difference between "not set up yet" and
   "deliberately handles everything", and only the first is worth prompting
   about. */

/** Map of station_id → array of service_ids, for one branch. */
export async function loadStationServices(branchId) {
  if (!branchId) return {};

  const { data: stationRows } = await supabase
    .from("stations")
    .select("id")
    .eq("branch_id", branchId);

  const ids = (stationRows ?? []).map((s) => s.id);
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from("station_services")
    .select("station_id, service_id")
    .in("station_id", ids);

  if (error) {
    console.error("[stations] loadStationServices failed", error);
    return {};
  }

  const map = {};
  for (const row of data ?? []) {
    (map[row.station_id] ??= []).push(row.service_id);
  }
  return map;
}

/**
 * Replace a station's service list wholesale.
 *
 * Delete-then-insert rather than diffing: the lists are a handful of rows,
 * and a diff has an ordering bug waiting in it that a full replace does not.
 * Passing an empty array clears the restriction, which per the rule above
 * means the station goes back to handling anything.
 */
export async function setStationServices(stationId, serviceIds) {
  if (!stationId) return { ok: false, error: "No station" };

  const { error: delErr } = await supabase
    .from("station_services")
    .delete()
    .eq("station_id", stationId);

  if (delErr) {
    console.error("[stations] clearing services failed", delErr);
    return { ok: false, error: delErr.message };
  }

  if (!serviceIds?.length) return { ok: true };

  const { error: insErr } = await supabase
    .from("station_services")
    .insert(serviceIds.map((service_id) => ({ station_id: stationId, service_id })));

  if (insErr) {
    console.error("[stations] setting services failed", insErr);
    return { ok: false, error: insErr.message };
  }
  return { ok: true };
}

/**
 * Which stations can take a given service.
 *
 * Used by check-in to tell a customer which line to join. Stations with no
 * configured services are included — unrestricted, per the rule above.
 */
export function stationsForService(stations, stationServiceMap, serviceId) {
  return (stations ?? []).filter((st) => {
    const list = stationServiceMap?.[st.id];
    if (!list || list.length === 0) return true;   // not configured = takes anything
    return list.includes(serviceId);
  });
}
