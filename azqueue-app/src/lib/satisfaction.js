/**
 * satisfaction.js — Customer satisfaction scoring helpers.
 *
 * Staff submit a 1-5 star score (+ optional note) when they complete a ticket.
 * Scores are stored in `satisfaction_scores` and surfaced on the Customers page.
 */

import { supabase } from "./supabase";

/**
 * Save a satisfaction score for a completed ticket.
 * @param {object} opts
 * @param {string} opts.branchId
 * @param {string} opts.ticketId
 * @param {string|null} opts.customerId   — may be null if no customer profile exists yet
 * @param {string|null} opts.staffId
 * @param {number}      opts.score        — 1–5
 * @param {string}      opts.note         — optional free-text note
 */
export async function saveScore({ branchId, ticketId, customerId, staffId, score, note }) {
  const { error } = await supabase.from("satisfaction_scores").insert({
    branch_id:   branchId,
    ticket_id:   ticketId   || null,
    customer_id: customerId || null,
    staff_id:    staffId    || null,
    score,
    note:        note?.trim() || null,
  });
  if (error) throw error;
}

/**
 * Fetch all scores for a single customer, newest first.
 * Returns [{ id, score, note, created_at, staff_id }]
 */
export async function getCustomerScores(customerId) {
  if (!customerId) return [];
  const { data } = await supabase
    .from("satisfaction_scores")
    .select("id, score, note, created_at, staff_id")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

/**
 * Compute the average score for a customer (0 if no scores).
 */
export async function getAverageScore(customerId) {
  const scores = await getCustomerScores(customerId);
  if (!scores.length) return null;
  const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  return Math.round(avg * 10) / 10; // 1 decimal place
}

/**
 * Fetch branch-level stats: avg score + count for today / all time.
 */
export async function getBranchScoreStats(branchId) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [{ data: all }, { data: today }] = await Promise.all([
    supabase.from("satisfaction_scores")
      .select("score")
      .eq("branch_id", branchId),
    supabase.from("satisfaction_scores")
      .select("score")
      .eq("branch_id", branchId)
      .gte("created_at", todayStart.toISOString()),
  ]);

  const calc = (rows) => {
    if (!rows?.length) return { avg: null, count: 0 };
    const avg = rows.reduce((s, r) => s + r.score, 0) / rows.length;
    return { avg: Math.round(avg * 10) / 10, count: rows.length };
  };

  return { allTime: calc(all), today: calc(today) };
}

/** Emoji label for a 1-5 score. */
export function scoreEmoji(score) {
  return ["", "😞", "😐", "😊", "😄", "🤩"][score] ?? "—";
}

/** Colour class for a score (Tailwind). */
export function scoreColour(score) {
  if (score >= 4.5) return "text-emerald-400";
  if (score >= 3.5) return "text-green-400";
  if (score >= 2.5) return "text-yellow-400";
  if (score >= 1.5) return "text-orange-400";
  return "text-red-400";
}
