import { supabase } from "./supabase";

/**
 * backQueue — work that continues after the customer has gone home.
 *
 * See docs/review-stage-spec.md. The short version: staff take the documents,
 * assign the work to a category, and the customer leaves. The work waits here
 * until somebody is free. When it's done they're emailed to collect it.
 *
 * THE RULE THAT MATTERS MOST
 * A ticket in the back queue is NOT a person waiting in line. It must never
 * appear in the waiting list, the TV display, the queue count, or any wait
 * calculation. Everything in this file works on `handed_off_at is not null`,
 * which is the marker the rest of the app filters OUT.
 */

export const CATEGORIES = [
  { key: "dropoff",     label: "Drop-off",    hint: "Documents left, nothing started yet" },
  { key: "immigration", label: "Immigration", hint: "Forms and filings" },
  { key: "taxes",       label: "Taxes",       hint: "Returns and related work" },
];

export function categoryLabel(key) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key ?? "—";
}

/** Turnaround promise for a category, in days. Falls back to a week. */
export function turnaroundDays(branch, category) {
  const map = branch?.turnaround_days ?? {};
  const n = Number(map[category]);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

/** "within a week" / "within 2 days" — phrased the way a person would say it. */
export function turnaroundPhrase(days) {
  if (days <= 1) return "by tomorrow";
  if (days <= 3) return `within ${days} days`;
  if (days <= 8) return "within a week";
  return `within about ${Math.round(days / 7)} weeks`;
}

/**
 * Hand a ticket to the back queue. The customer leaves at this point.
 *
 * Does NOT complete the ticket — completion means the work is finished, which
 * happens later. The ticket leaves the waiting list because `handed_off_at`
 * is set, not because its status says done.
 */
export async function assignWork({ ticketId, category, assignedTo = null, takenInBy = null }) {
  if (!ticketId || !category) return { ok: false, error: "ticket and category required" };

  const { data, error } = await supabase
    .from("tickets")
    .update({
      handoff_category: category,
      assigned_to:      assignedTo,
      taken_in_by:      takenInBy,
      handed_off_at:    new Date().toISOString(),
      // The counter interaction is over even though the work isn't.
      completed_at:     new Date().toISOString(),
      status:           "completed",
    })
    .eq("id", ticketId)
    .select("id, customer_name, customer_email, handoff_category")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, ticket: data };
}

/** Everything currently sitting in the back queue for a branch. */
export async function loadBackQueue(branchId) {
  if (!branchId) return [];
  const { data, error } = await supabase
    .from("tickets")
    .select("id, token, customer_name, customer_email, customer_phone, handoff_category, assigned_to, taken_in_by, handed_off_at, work_started_at, service_id")
    .eq("branch_id", branchId)
    .not("handed_off_at", "is", null)
    .is("work_done_at", null)
    .order("handed_off_at", { ascending: true });

  if (error) { console.error("[backQueue] load failed", error); return []; }
  return data ?? [];
}

/** Work finished but not yet collected — the shelf. */
export async function loadAwaitingCollection(branchId) {
  if (!branchId) return [];
  const { data, error } = await supabase
    .from("tickets")
    .select("id, token, customer_name, customer_email, handoff_category, work_done_at, ready_notified_at")
    .eq("branch_id", branchId)
    .not("work_done_at", "is", null)
    .is("collected_at", null)
    .order("work_done_at", { ascending: true });

  if (error) { console.error("[backQueue] collection load failed", error); return []; }
  return data ?? [];
}

/** Mark that someone has picked the work up and started on it. */
export async function startWork(ticketId, staffId = null) {
  const patch = { work_started_at: new Date().toISOString() };
  if (staffId) patch.assigned_to = staffId;
  const { error } = await supabase.from("tickets").update(patch).eq("id", ticketId);
  return { ok: !error, error: error?.message };
}

/**
 * The work is finished and ready to collect.
 *
 * Returns the ticket so the caller can send the "ready to collect" email.
 * `ready_notified_at` is deliberately NOT set here — it's set only after the
 * email actually sends, so a failed send retries rather than vanishing.
 */
export async function finishWork(ticketId, staffId = null) {
  const patch = { work_done_at: new Date().toISOString() };
  if (staffId) patch.assigned_to = staffId;

  const { data, error } = await supabase
    .from("tickets")
    .update(patch)
    .eq("id", ticketId)
    .select("id, customer_name, customer_email, handoff_category, branch_id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, ticket: data };
}

export async function markNotified(ticketId) {
  await supabase
    .from("tickets")
    .update({ ready_notified_at: new Date().toISOString() })
    .eq("id", ticketId);
}

/** Handed over to the customer. Closes the pickup announcement too. */
export async function markCollected(ticketId) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tickets").update({ collected_at: now }).eq("id", ticketId);

  await supabase
    .from("pickup_waits")
    .update({ collected_at: now })
    .eq("ticket_id", ticketId)
    .is("collected_at", null);

  return { ok: !error, error: error?.message };
}

/* ── Pickup announcements ─────────────────────────────────────────────
   Someone standing at the unstaffed pickup spot. A bell, not a queue entry:
   no position, no estimated wait, and never counted as waiting. */

/** Kiosk lookup. Returns { status: 'ready' | 'in_progress' | 'none', ... }. */
export async function findPickup({ branchSlug, contact }) {
  const { data, error } = await supabase.rpc("find_pickup", {
    p_branch_slug: branchSlug,
    p_contact: contact,
  });
  if (error) { console.error("[backQueue] find_pickup failed", error); return { status: "none" }; }
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { status: "none" };
}

/** "I'm here" — raises the staff banner. */
export async function announcePickup({ branchId, ticketId, displayName }) {
  const { error } = await supabase.from("pickup_waits").insert({
    branch_id: branchId,
    ticket_id: ticketId,
    display_name: displayName ?? null,
  });
  return { ok: !error, error: error?.message };
}

/** Open pickup announcements, oldest first — what the staff banner shows. */
export async function loadOpenPickups(branchId) {
  if (!branchId) return [];
  const { data, error } = await supabase
    .from("pickup_waits")
    .select("id, ticket_id, display_name, announced_at, acknowledged_at, tickets(handoff_category, customer_name, handed_off_at)")
    .eq("branch_id", branchId)
    .is("collected_at", null)
    .order("announced_at", { ascending: true });

  if (error) { console.error("[backQueue] pickups load failed", error); return []; }
  return data ?? [];
}

/** Someone has seen it — stops the chime without closing the pickup. */
export async function acknowledgePickup(pickupId) {
  const { error } = await supabase
    .from("pickup_waits")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", pickupId);
  return { ok: !error, error: error?.message };
}
