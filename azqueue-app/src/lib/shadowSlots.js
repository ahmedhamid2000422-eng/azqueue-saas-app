/**
 * shadowSlots.js
 *
 * Data helpers for the Shadow Slots feature — deliberately unbookable
 * time windows that absorb walk-in traffic based on historical patterns.
 *
 * Terminology:
 *   day_of_week  0 = Sunday … 6 = Saturday  (matches JS Date.getDay())
 *   hour         0 – 23  (local branch time, applied in the RPC)
 */

import { supabase } from "./supabase";

// ── Shadow slot CRUD ──────────────────────────────────────────────────

/** Load all active shadow slots for a branch, ordered by day + hour. */
export async function fetchShadowSlots(branchId) {
  const { data, error } = await supabase
    .from("shadow_slots")
    .select("*")
    .eq("branch_id", branchId)
    .eq("active", true)
    .order("day_of_week")
    .order("hour");
  if (error) throw error;
  return data ?? [];
}

/**
 * Add a shadow slot. Replaces if one already exists for the same
 * branch / day_of_week / hour.
 *
 * NOTE: this deliberately does NOT use `.upsert(..., { onConflict })`.
 * The only unique index covering (branch_id, day_of_week, hour) is the
 * partial index `shadow_slots_branch_dow_hour` (only enforced where
 * active = true) — Postgres cannot use a partial index as the ON CONFLICT
 * arbiter for a plain upsert, so that approach fails every time with
 * error 42P10 ("no unique or exclusion constraint matching the ON
 * CONFLICT specification"). Selecting first and branching into an
 * update/insert avoids needing an arbiter at all (QA bug B4).
 */
export async function addShadowSlot(branchId, dayOfWeek, hour, durationMin = 60, label = null) {
  const { data: existing, error: findError } = await supabase
    .from("shadow_slots")
    .select("id")
    .eq("branch_id", branchId)
    .eq("day_of_week", dayOfWeek)
    .eq("hour", hour)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { data, error } = await supabase
      .from("shadow_slots")
      .update({ duration_min: durationMin, label, active: true })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("shadow_slots")
    .insert({ branch_id: branchId, day_of_week: dayOfWeek, hour, duration_min: durationMin, label, active: true })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Soft-delete a shadow slot by id. */
export async function removeShadowSlot(id) {
  const { error } = await supabase
    .from("shadow_slots")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;
}

// ── Branch-level enable/disable ───────────────────────────────────────

export async function setShadowSlotsEnabled(branchId, enabled) {
  const { error } = await supabase
    .from("branches")
    .update({ shadow_slots_enabled: enabled })
    .eq("id", branchId);
  if (error) throw error;
}

// ── Walk-in heatmap ───────────────────────────────────────────────────

/**
 * Returns a nested map: { [dayOfWeek]: { [hour]: count } }
 * Built from the get_walkin_heatmap RPC (last 90 days of walk-in tickets).
 *
 * If there is no historical data the map is empty — the UI shows grey cells
 * with a "Not enough data yet" message.
 */
export async function fetchWalkinHeatmap(branchId, days = 90) {
  const { data, error } = await supabase.rpc("get_walkin_heatmap", {
    p_branch_id: branchId,
    p_days: days,
  });
  if (error) throw error;

  const map = {};
  for (const row of data ?? []) {
    if (!map[row.day_of_week]) map[row.day_of_week] = {};
    map[row.day_of_week][row.hour] = row.ticket_count;
  }
  return map;
}

// ── Helpers ───────────────────────────────────────────────────────────

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_FULL   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Format an hour integer as "9 AM", "2 PM" etc. */
export function fmtHour(h) {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** True if a shadow slot exists in slots[] for the given day + hour. */
export function hasShadowSlot(slots, dayOfWeek, hour) {
  return slots.some((s) => s.day_of_week === dayOfWeek && s.hour === hour);
}

/** Return the slot object (or undefined) for a given day + hour. */
export function getShadowSlot(slots, dayOfWeek, hour) {
  return slots.find((s) => s.day_of_week === dayOfWeek && s.hour === hour);
}

/**
 * Normalise a heatmap so the hottest cell = 1.0.
 * Returns the same shape as the input map with float values 0–1.
 */
export function normaliseHeatmap(map) {
  const values = Object.values(map).flatMap((row) => Object.values(row));
  const max = Math.max(...values, 1);
  const out = {};
  for (const [dow, hours] of Object.entries(map)) {
    out[dow] = {};
    for (const [h, v] of Object.entries(hours)) {
      out[dow][h] = v / max;
    }
  }
  return out;
}
