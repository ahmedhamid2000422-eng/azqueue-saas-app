/**
 * loyalty.js — Digital punch card loyalty program.
 *
 * Flow:
 *   1. Branch sets up a program (punches_required + reward_description) in Settings.
 *   2. On every ticket completion, addPunch() is called automatically.
 *   3. Staff can also call addBonusPunch() from the Queue card.
 *   4. When current_punches reaches punches_required → reward_earned is triggered.
 *   5. Staff call redeemReward() when the customer claims their reward.
 *   6. Customer sees their card on the check-in kiosk.
 *
 * All functions are non-blocking — a loyalty failure never interrupts queue flow.
 */

import { supabase } from "./supabase";

// ── Program management ─────────────────────────────────────────────

/** Get the loyalty program for a branch (null if not set up). */
export async function getLoyaltyProgram(branchId) {
  if (!branchId) return null;
  const { data } = await supabase
    .from("loyalty_programs")
    .select("*")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

/** Create or update the loyalty program for a branch. */
export async function saveLoyaltyProgram(branchId, { name, punchesRequired, rewardDescription }) {
  const { data, error } = await supabase
    .from("loyalty_programs")
    .upsert(
      {
        branch_id:           branchId,
        name:                name ?? "Loyalty Card",
        punches_required:    punchesRequired ?? 10,
        reward_description:  rewardDescription ?? "Free service of your choice",
        is_active:           true,
      },
      { onConflict: "branch_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ── Card operations ────────────────────────────────────────────────

/**
 * Get (or lazily create) a customer's loyalty card for a branch.
 * Returns { card, program } — program is null if no program exists.
 */
export async function getOrCreateCard(branchId, customerId) {
  const program = await getLoyaltyProgram(branchId);
  if (!program) return { card: null, program: null };

  // Try to find existing card
  const { data: existing } = await supabase
    .from("loyalty_cards")
    .select("*")
    .eq("branch_id", branchId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existing) return { card: existing, program };

  // Create a new card
  const { data: created } = await supabase
    .from("loyalty_cards")
    .insert({ branch_id: branchId, customer_id: customerId })
    .select("*")
    .single();

  return { card: created, program };
}

/**
 * Add a punch to a customer's card (called automatically on ticket completion).
 * Returns { card, rewardEarned: bool } — rewardEarned is true if this punch
 * triggered a new reward so the UI can celebrate + notify.
 *
 * @param {string} branchId
 * @param {string} customerId
 * @param {string} ticketId
 * @param {string|null} staffId
 * @param {'punch'|'bonus_punch'} type
 */
export async function addPunch(branchId, customerId, ticketId, staffId = null, type = "punch") {
  try {
    const { card, program } = await getOrCreateCard(branchId, customerId);
    if (!card || !program) return { card: null, rewardEarned: false };

    const newCurrent   = card.current_punches + 1;
    const newLifetime  = card.lifetime_punches + 1;
    const rewardEarned = newCurrent >= program.punches_required;
    const resetCurrent = rewardEarned ? 0 : newCurrent;
    const newRewards   = rewardEarned ? card.rewards_earned + 1 : card.rewards_earned;

    // Update the card
    const { data: updatedCard } = await supabase
      .from("loyalty_cards")
      .update({
        current_punches:  resetCurrent,
        lifetime_punches: newLifetime,
        rewards_earned:   newRewards,
        last_punch_at:    new Date().toISOString(),
      })
      .eq("id", card.id)
      .select("*")
      .single();

    // Log the punch event
    await supabase.from("loyalty_events").insert({
      branch_id:  branchId,
      card_id:    card.id,
      customer_id: customerId,
      ticket_id:  ticketId ?? null,
      staff_id:   staffId ?? null,
      event_type: type,
    });

    // Log the reward event if triggered
    if (rewardEarned) {
      await supabase.from("loyalty_events").insert({
        branch_id:  branchId,
        card_id:    card.id,
        customer_id: customerId,
        ticket_id:  ticketId ?? null,
        staff_id:   staffId ?? null,
        event_type: "reward_earned",
        note:       program.reward_description,
      });
    }

    return { card: updatedCard, rewardEarned, program };
  } catch (err) {
    // Non-blocking — loyalty failure never stops queue flow
    console.warn("[loyalty] addPunch failed:", err.message);
    return { card: null, rewardEarned: false };
  }
}

/** Add a bonus punch manually from the staff dashboard. */
export async function addBonusPunch(branchId, customerId, ticketId, staffId) {
  return addPunch(branchId, customerId, ticketId, staffId, "bonus_punch");
}

/**
 * Mark a reward as redeemed (staff taps "Redeem" on the customer card).
 */
export async function redeemReward(branchId, customerId, staffId) {
  try {
    const { data: card } = await supabase
      .from("loyalty_cards")
      .select("*")
      .eq("branch_id", branchId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!card || card.rewards_earned <= card.rewards_redeemed) return false;

    await supabase
      .from("loyalty_cards")
      .update({ rewards_redeemed: card.rewards_redeemed + 1 })
      .eq("id", card.id);

    await supabase.from("loyalty_events").insert({
      branch_id:  branchId,
      card_id:    card.id,
      customer_id: customerId,
      staff_id:   staffId ?? null,
      event_type: "reward_redeemed",
    });

    return true;
  } catch (err) {
    console.warn("[loyalty] redeemReward failed:", err.message);
    return false;
  }
}

// ── Read helpers ───────────────────────────────────────────────────

/** Get a customer's card + program in one call (for kiosk and profile display). */
export async function getCustomerCard(branchId, customerId) {
  if (!branchId || !customerId) return null;
  const [{ data: card }, program] = await Promise.all([
    supabase
      .from("loyalty_cards")
      .select("*")
      .eq("branch_id", branchId)
      .eq("customer_id", customerId)
      .maybeSingle(),
    getLoyaltyProgram(branchId),
  ]);
  if (!card || !program) return null;
  return { ...card, program };
}

/** Get last 20 loyalty events for a customer's card. */
export async function getCardEvents(cardId) {
  if (!cardId) return [];
  const { data } = await supabase
    .from("loyalty_events")
    .select("id, event_type, note, created_at, staff_id")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

// ── UI helpers ─────────────────────────────────────────────────────

/** Returns how many punches are pending toward the next reward. */
export function punchesUntilReward(card, program) {
  if (!card || !program) return null;
  return program.punches_required - card.current_punches;
}

/** True if the customer has an unclaimed reward. */
export function hasUnclaimedReward(card) {
  if (!card) return false;
  return card.rewards_earned > card.rewards_redeemed;
}

/**
 * Render punch dots as an array of booleans.
 * e.g. punchDots(card, program) → [true, true, true, false, false, ...]
 */
export function punchDots(card, program) {
  if (!card || !program) return [];
  return Array.from(
    { length: program.punches_required },
    (_, i) => i < card.current_punches
  );
}
