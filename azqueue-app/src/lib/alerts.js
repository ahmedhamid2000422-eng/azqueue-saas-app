/**
 * alerts.js — branch-wide broadcast alerts.
 *
 * A broadcast alert does two things:
 *   1. Posts a message that TV displays show as a banner until it expires
 *   2. Notifies waiting customers directly (email now, SMS when re-enabled)
 *
 * The banner lives in the `branch_alerts` table so it survives a display
 * reload and reaches screens that were briefly offline.
 */

import { supabase } from "./supabase";
import { sendAlertEmail } from "./notifyEmail";
import { sendBroadcastAlert } from "./notify";
import { SMS_ENABLED } from "./features";

/** Post an alert banner for all TV displays of a branch. */
export async function postBranchAlert(branchId, message, { minutes = 15, userId = null } = {}) {
  if (!branchId || !message?.trim()) return { ok: false };
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("branch_alerts")
    .insert({
      branch_id:  branchId,
      message:    message.trim(),
      created_by: userId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("[alerts] could not post banner", error);
    return { ok: false, error };
  }
  return { ok: true, id: data.id };
}

/** Load the current active alert for a branch (most recent, unexpired). */
export async function loadActiveAlert(branchId) {
  if (!branchId) return null;
  const { data } = await supabase
    .from("branch_alerts")
    .select("id, message, expires_at, created_at")
    .eq("branch_id", branchId)
    .is("cleared_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

/** Clear an alert early (staff action). */
export async function clearBranchAlert(alertId) {
  if (!alertId) return;
  await supabase
    .from("branch_alerts")
    .update({ cleared_at: new Date().toISOString() })
    .eq("id", alertId);
}

/**
 * Send a broadcast to everyone currently in the queue.
 *
 * @param {object[]} tickets  waiting/serving tickets (need customer_email / _phone / _name)
 * @param {string}   message  the staff-typed message
 * @param {string}   branchName
 * @returns {{ total, emailed, texted }}
 */
export async function broadcastToQueue(tickets, message, branchName) {
  const list = tickets ?? [];
  let emailed = 0;
  let texted  = 0;

  await Promise.all(
    list.map(async (t) => {
      const name = t.customer_name ?? "there";

      if (t.customer_email) {
        try {
          const r = await sendAlertEmail({
            email: t.customer_email,
            name,
            message,
            branchName,
          });
          if (r?.ok) emailed++;
        } catch { /* one failure shouldn't stop the rest */ }
      }

      if (SMS_ENABLED && t.customer_phone) {
        try {
          await sendBroadcastAlert(t.customer_phone, name, message, branchName);
          texted++;
        } catch { /* ignore */ }
      }
    }),
  );

  return { total: list.length, emailed, texted };
}
