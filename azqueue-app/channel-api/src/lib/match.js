/**
 * match.js — Customer identity resolution against Supabase.
 *
 * Strategy (priority order):
 *   1. email      — case-insensitive unique match within branch
 *   2. phone      — E.164 exact match within branch
 *   3. whatsappId — exact match (same as phone in WA context)
 *   4. facebookId — exact PSID match
 *   5. instagramId — exact IGSID match
 *   6. freshdeskId — exact Freshworks contact ID match
 *
 * On hit: merges any new fields we didn't have before, bumps last_seen_at.
 * On miss: inserts a new customer row.
 *
 * All DB calls use the service-role client (bypasses RLS).
 * This module never calls the LLM — enrichment lives in routes/enrich.js.
 */

import { db } from "../db.js";

/**
 * Find or create a customer for a given branch and identity payload.
 *
 * @param {string} branchId   — UUID of the branch
 * @param {{
 *   name?:        string,
 *   email?:       string,
 *   phone?:       string,
 *   facebookId?:  string,
 *   instagramId?: string,
 *   whatsappId?:  string,
 *   freshdeskId?: string,
 * }} identity  — already normalised by normalize.js
 *
 * @returns {Promise<{ customer: object, created: boolean }>}
 */
export async function findOrCreate(branchId, identity = {}) {
  const { name, email, phone, facebookId, instagramId, whatsappId, freshdeskId } = identity;

  // ── Try each identifier in priority order ──────────────────────────
  let existing = null;

  if (email) {
    const { data } = await db
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .ilike("email", email)
      .maybeSingle();
    existing = data;
  }

  if (!existing && phone) {
    const { data } = await db
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .eq("phone", phone)
      .maybeSingle();
    existing = data;
  }

  if (!existing && whatsappId) {
    const { data } = await db
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .eq("whatsapp_id", whatsappId)
      .maybeSingle();
    existing = data;
  }

  if (!existing && facebookId) {
    const { data } = await db
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .eq("facebook_id", facebookId)
      .maybeSingle();
    existing = data;
  }

  if (!existing && instagramId) {
    const { data } = await db
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .eq("instagram_id", instagramId)
      .maybeSingle();
    existing = data;
  }

  if (!existing && freshdeskId) {
    const { data } = await db
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .eq("freshdesk_id", freshdeskId)
      .maybeSingle();
    existing = data;
  }

  // ── Hit — merge any new fields ──────────────────────────────────────
  if (existing) {
    const updates = { last_seen_at: new Date().toISOString() };

    if (name        && !existing.display_name) updates.display_name  = name;
    if (email       && !existing.email)        updates.email         = email;
    if (phone       && !existing.phone)        updates.phone         = phone;
    if (facebookId  && !existing.facebook_id)  updates.facebook_id   = facebookId;
    if (instagramId && !existing.instagram_id) updates.instagram_id  = instagramId;
    if (whatsappId  && !existing.whatsapp_id)  updates.whatsapp_id   = whatsappId;
    if (freshdeskId && !existing.freshdesk_id) updates.freshdesk_id  = freshdeskId;

    const { data: updated, error } = await db
      .from("customers")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    return { customer: updated ?? existing, created: false };
  }

  // ── Miss — create new customer ──────────────────────────────────────
  const { data: created, error } = await db
    .from("customers")
    .insert({
      branch_id:    branchId,
      display_name: name        ?? null,
      email:        email       ?? null,
      phone:        phone       ?? null,
      facebook_id:  facebookId  ?? null,
      instagram_id: instagramId ?? null,
      whatsapp_id:  whatsappId  ?? null,
      freshdesk_id: freshdeskId ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return { customer: created, created: true };
}

/**
 * Log a customer event (inbound message, webhook action, etc.)
 * Skips duplicate events from the same external source (dedup by external_id).
 *
 * @param {{
 *   customerId:  string,
 *   branchId:    string,
 *   channel:     'facebook'|'instagram'|'whatsapp'|'email'|'freshdesk'|'manual',
 *   eventType:   'message'|'queue_join'|'queue_serve'|'queue_complete'|'ticket_open'|'ticket_resolve'|'note',
 *   direction?:  'inbound'|'outbound',
 *   content?:    string,
 *   metadata?:   object,
 *   externalId?: string,
 *   staffId?:    string,
 * }} event
 * @returns {Promise<object>} the customer_events row
 */
export async function logEvent({
  customerId,
  branchId,
  channel,
  eventType,
  direction = "inbound",
  content   = null,
  metadata  = null,
  externalId = null,
  staffId   = null,
}) {
  // Dedup — skip if we've already processed this external event
  if (externalId) {
    const { data: existing } = await db
      .from("customer_events")
      .select("id")
      .eq("branch_id", branchId)
      .eq("channel", channel)
      .eq("external_id", externalId)
      .maybeSingle();

    if (existing) return existing;
  }

  const { data, error } = await db
    .from("customer_events")
    .insert({
      customer_id: customerId,
      branch_id:   branchId,
      channel,
      event_type:  eventType,
      direction,
      content,
      metadata,
      external_id: externalId,
      staff_id:    staffId,
    })
    .select("id, channel, event_type, direction, content, created_at")
    .single();

  if (error) throw error;

  // Bump customer last_seen_at on every inbound event
  if (direction === "inbound") {
    await db
      .from("customers")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", customerId);
  }

  return data;
}

/**
 * Log a raw webhook payload for debugging / replay.
 * Non-blocking — failures are swallowed so they never interrupt ingestion.
 *
 * @param {object} log
 */
export async function logWebhook({ channel, branchId, customerId, eventType, payload, processed, error }) {
  try {
    await db.from("webhook_log").insert({
      channel,
      branch_id:   branchId   ?? null,
      customer_id: customerId ?? null,
      event_type:  eventType  ?? null,
      payload,
      processed:   processed  ?? false,
      error:       error      ?? null,
    });
  } catch {
    // best-effort — never throw
  }
}
