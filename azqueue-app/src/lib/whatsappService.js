/**
 * whatsappService.js — Frontend access to the WhatsApp AI customer-service
 * inbox (Settings → Support Inbox).
 *
 * Reads (listConversations, getMessages) go straight through Supabase —
 * RLS on wa_conversations/wa_messages already restricts rows to the
 * signed-in user's own branch (owner or staff), same pattern as every
 * other branch-scoped table in the app.
 *
 * Writes (claim/reply/resolve) go through the wa-reply Edge Function
 * instead of a direct table write, because replying also needs to
 * actually send the WhatsApp message via Twilio — that has to happen
 * server-side where the Twilio secret lives. supabase.functions.invoke()
 * automatically attaches the signed-in user's access token, which
 * wa-reply verifies before doing anything.
 */

import { supabase } from "./supabase";

/**
 * List conversations the AI has handed off to a human for this branch,
 * most recently handed-off first.
 */
export async function listHandoffConversations(branchId) {
  const { data, error } = await supabase
    .from("wa_conversations")
    .select("id, wa_from, state, assigned_team, claimed_by, claimed_at, context, created_at")
    .eq("branch_id", branchId)
    .eq("needs_human", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Full message transcript for one conversation, oldest first. */
export async function getConversationMessages(conversationId) {
  const { data, error } = await supabase
    .from("wa_messages")
    .select("id, direction, sender, staff_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Claim a handed-off conversation as the signed-in staff member. */
export async function claimConversation(conversationId) {
  const { data, error } = await supabase.functions.invoke("wa-reply", {
    body: { conversationId, action: "claim" },
  });
  if (error) throw error;
  return data;
}

/** Send a reply as staff — actually delivers it over WhatsApp via Twilio. */
export async function sendStaffReply(conversationId, body) {
  const { data, error } = await supabase.functions.invoke("wa-reply", {
    body: { conversationId, action: "reply", body },
  });
  if (error) throw error;
  return data;
}

/** Hand the conversation back to the AI (clears needs_human / claimed_by). */
export async function resolveConversation(conversationId) {
  const { data, error } = await supabase.functions.invoke("wa-reply", {
    body: { conversationId, action: "resolve" },
  });
  if (error) throw error;
  return data;
}
