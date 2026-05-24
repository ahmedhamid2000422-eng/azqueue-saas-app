/**
 * customers.js — Customer identity, unified timeline, AI summaries.
 *
 * Core concept:
 *   One customer = one row in `customers`, regardless of how many channels
 *   they contact you through. Identity is resolved by email, phone, or
 *   social ID. Every touchpoint becomes a `customer_events` row.
 *
 * Channel ingestion:
 *   Queue visits are logged automatically via logQueueEvent().
 *   Future channels (Facebook, Instagram, WhatsApp, Freshdesk) just call
 *   logEvent() — the schema is ready, no changes needed here.
 *
 * AI summaries:
 *   generateSummary() calls OpenAI with the last 30 events and upserts
 *   a customer_summaries row. Requires VITE_OPENAI_API_KEY in .env.
 *   Falls back gracefully if the key is missing.
 */

import { supabase } from "./supabase";
import { getFreshdeskContext } from "./freshdesk";

// ── Identity resolution ───────────────────────────────────────────────

/**
 * Find an existing customer or create a new one.
 * Matches on email first, then phone, then social IDs.
 * If a partial match exists, merges the new fields in.
 *
 * @param {string} branchId
 * @param {{ name?, email?, phone?, facebookId?, instagramId?, whatsappId?, freshdeskId? }} identity
 * @returns {Promise<{ id: string, ...customer }>}
 */
export async function findOrCreateCustomer(branchId, identity = {}) {
  const { name, email, phone, facebookId, instagramId, whatsappId, freshdeskId } = identity;

  // Try to find existing customer — check each identifier in priority order
  let existing = null;

  if (email) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .ilike("email", email)
      .maybeSingle();
    existing = data;
  }

  if (!existing && phone) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .eq("phone", phone)
      .maybeSingle();
    existing = data;
  }

  if (!existing && facebookId) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .eq("facebook_id", facebookId)
      .maybeSingle();
    existing = data;
  }

  if (!existing && instagramId) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .eq("instagram_id", instagramId)
      .maybeSingle();
    existing = data;
  }

  if (!existing && whatsappId) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("branch_id", branchId)
      .eq("whatsapp_id", whatsappId)
      .maybeSingle();
    existing = data;
  }

  if (existing) {
    // Merge any new fields we didn't have before
    const updates = {};
    if (name        && !existing.display_name) updates.display_name  = name;
    if (email       && !existing.email)        updates.email         = email;
    if (phone       && !existing.phone)        updates.phone         = phone;
    if (facebookId  && !existing.facebook_id)  updates.facebook_id   = facebookId;
    if (instagramId && !existing.instagram_id) updates.instagram_id  = instagramId;
    if (whatsappId  && !existing.whatsapp_id)  updates.whatsapp_id   = whatsappId;
    if (freshdeskId && !existing.freshdesk_id) updates.freshdesk_id  = freshdeskId;
    updates.last_seen_at = new Date().toISOString();

    if (Object.keys(updates).length > 1) {
      const { data } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", existing.id)
        .select("*")
        .single();
      return data ?? existing;
    }
    return existing;
  }

  // Create new customer
  const { data, error } = await supabase
    .from("customers")
    .insert({
      branch_id:    branchId,
      display_name: name ?? null,
      email:        email ?? null,
      phone:        phone ?? null,
      facebook_id:  facebookId  ?? null,
      instagram_id: instagramId ?? null,
      whatsapp_id:  whatsappId  ?? null,
      freshdesk_id: freshdeskId ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ── Customer queries ──────────────────────────────────────────────────

/**
 * List all customers for a branch, most recently seen first.
 */
export async function loadCustomers(branchId, { limit = 50, offset = 0, search = "" } = {}) {
  if (!branchId) return [];

  let query = supabase
    .from("customers")
    .select("id, display_name, email, phone, tags, vip, last_seen_at, created_at, freshdesk_id")
    .eq("branch_id", branchId)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (search.trim()) {
    query = query.or(
      `display_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data } = await query;
  return data ?? [];
}

/**
 * Load a single customer with their full timeline, notes, and AI summary.
 */
export async function loadCustomerProfile(customerId) {
  if (!customerId) return null;

  const [
    { data: customer },
    { data: events },
    { data: notes },
    { data: summary },
    { data: scores },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single(),

    supabase
      .from("customer_events")
      .select("id, channel, event_type, content, external_id, staff_id, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100),

    supabase
      .from("customer_notes")
      .select("id, content, staff_id, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),

    supabase
      .from("customer_summaries")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle(),

    supabase
      .from("satisfaction_scores")
      .select("id, score, note, created_at, staff_id")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!customer) return null;

  const scoreList = scores ?? [];
  const avgScore = scoreList.length
    ? Math.round(scoreList.reduce((s, r) => s + r.score, 0) / scoreList.length * 10) / 10
    : null;

  return {
    ...customer,
    events:  events   ?? [],
    notes:   notes    ?? [],
    summary: summary  ?? null,
    scores:  scoreList,
    avgScore,
  };
}

// ── Event logging ─────────────────────────────────────────────────────

/**
 * Log any normalized event to the customer timeline.
 *
 * @param {string} customerId
 * @param {string} branchId
 * @param {{ channel, eventType, content?, metadata?, externalId?, staffId? }} event
 */
export async function logEvent(customerId, branchId, {
  channel, eventType, content = null, metadata = null, externalId = null, staffId = null,
}) {
  // Skip duplicate events from the same source system
  if (externalId) {
    const { data: exists } = await supabase
      .from("customer_events")
      .select("id")
      .eq("branch_id", branchId)
      .eq("channel", channel)
      .eq("external_id", externalId)
      .maybeSingle();
    if (exists) return exists;
  }

  const { data, error } = await supabase
    .from("customer_events")
    .insert({
      customer_id: customerId,
      branch_id:   branchId,
      channel,
      event_type:  eventType,
      content,
      metadata,
      external_id: externalId,
      staff_id:    staffId,
    })
    .select("id, channel, event_type, content, created_at")
    .single();
  if (error) throw error;

  // Update last_seen_at on the customer
  await supabase
    .from("customers")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", customerId);

  return data;
}

/**
 * Convenience: log a queue event when a ticket moves through a stage.
 * Called from Queue.jsx when a ticket is created / called / completed.
 *
 * @param {string} customerId
 * @param {string} branchId
 * @param {'queue_join'|'queue_serve'|'queue_complete'} stage
 * @param {{ ticketId, token, service?, staffId? }} meta
 */
export async function logQueueEvent(customerId, branchId, stage, { ticketId, token, service, staffId } = {}) {
  const labels = {
    queue_join:     `Joined queue — ticket #${token}${service ? ` · ${service}` : ""}`,
    queue_serve:    `Called to counter — ticket #${token}`,
    queue_complete: `Service completed — ticket #${token}`,
  };
  return logEvent(customerId, branchId, {
    channel:    "queue",
    eventType:  stage,
    content:    labels[stage] ?? stage,
    externalId: ticketId,
    staffId,
  });
}

// ── Notes ─────────────────────────────────────────────────────────────

export async function addNote(customerId, branchId, staffId, content) {
  const { data, error } = await supabase
    .from("customer_notes")
    .insert({ customer_id: customerId, branch_id: branchId, staff_id: staffId, content })
    .select("id, content, staff_id, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(noteId) {
  const { error } = await supabase
    .from("customer_notes")
    .delete()
    .eq("id", noteId);
  if (error) throw error;
}

// ── Customer mutations ────────────────────────────────────────────────

export async function updateCustomer(customerId, fields) {
  const { data, error } = await supabase
    .from("customers")
    .update(fields)
    .eq("id", customerId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(customerId) {
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId);
  if (error) throw error;
}

// ── AI summary ────────────────────────────────────────────────────────

/**
 * Generate an AI summary for a customer using their last 30 events.
 * Requires VITE_OPENAI_API_KEY in .env.local
 * Upserts into customer_summaries — safe to call multiple times.
 */
export async function generateSummary(customerId, branchId) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;

  // Load last 30 events for context
  const { data: events } = await supabase
    .from("customer_events")
    .select("channel, event_type, content, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!events?.length) return null;

  const timeline = events
    .reverse()
    .map((e) => `[${e.channel}] ${e.event_type}: ${e.content ?? "(no content)"}`)
    .join("\n");

  const prompt = `You are a customer support assistant. Summarize this customer's interaction history concisely for a staff member who is about to serve them.

Customer timeline (oldest to newest):
${timeline}

Respond with a JSON object with these exact keys:
- summary: 2-3 sentences describing who this customer is and their history
- sentiment: one of "positive", "neutral", "negative", "frustrated"
- key_issues: array of up to 4 short phrases (the main things they've contacted about)
- recommended_action: one sentence — what should the staff member do or know before serving them

JSON only, no markdown.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    // Upsert — replaces any existing summary for this customer
    const { data } = await supabase
      .from("customer_summaries")
      .upsert(
        {
          customer_id:        customerId,
          summary:            parsed.summary ?? null,
          sentiment:          parsed.sentiment ?? "neutral",
          key_issues:         parsed.key_issues ?? [],
          recommended_action: parsed.recommended_action ?? null,
          generated_at:       new Date().toISOString(),
        },
        { onConflict: "customer_id" }
      )
      .select("*")
      .single();

    return data;
  } catch {
    return null; // AI is a nice-to-have, never a hard dependency
  }
}

// ── Marketing persona ─────────────────────────────────────────────────

/**
 * Generate a marketing persona for a customer from their event history.
 * Stores result in the existing customer_summaries row under a `persona` key.
 * Requires VITE_OPENAI_API_KEY in .env.local
 */
export async function generatePersona(customerId, branchId) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("display_name, id, email, phone, tags, created_at")
    .eq("id", customerId)
    .single();

  if (!customer) return null;

  // Load last 30 events for context
  const { data: events } = await supabase
    .from("customer_events")
    .select("channel, event_type, content, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(30);

  // Pull Freshdesk history if connected — non-blocking, best-effort
  const freshdeskContext = await getFreshdeskContext(branchId, {
    email: customer.email,
    phone: customer.phone,
  }).catch(() => null);

  const timeline = (events ?? [])
    .reverse()
    .map((e) => "[" + e.channel + "] " + e.event_type + ": " + (e.content ?? "(no content)"))
    .join("\n");

  const customerName = customer.display_name ?? "this customer";
  const tags = (customer.tags ?? []).join(", ") || "none";
  const memberSince = customer.created_at?.slice(0, 10) ?? "unknown";

  const prompt =
    "You are a marketing strategist. Based on this customer's interaction history, " +
    "build a short persona profile that helps with targeting and personalization.\n\n" +
    "Customer: " + customerName + "\n" +
    "Tags: " + tags + "\n" +
    "Member since: " + memberSince + "\n\n" +
    "Interaction timeline (oldest to newest):\n" + timeline + "\n\n" +
    (freshdeskContext ? "Support history from Freshdesk:\n" + freshdeskContext + "\n\n" : "") +
    "Respond with a JSON object:\n" +
    '- persona_type: 1 short label (e.g. "High-value repeat", "At-risk", "New & engaged")\n' +
    '- persona_summary: 1-2 sentences about who this customer is for marketing purposes\n' +
    '- engagement_level: one of "high", "medium", "low"\n' +
    '- recommended_channel: best outreach channel (e.g. "SMS", "Email", "WhatsApp")\n' +
    "- marketing_note: one sentence, what to highlight in the next communication\n\n" +
    "JSON only, no markdown.";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    const json = await res.json();
    const rawText = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(rawText);

    const { data } = await supabase
      .from("customer_summaries")
      .upsert(
        {
          customer_id:         customerId,
          persona_type:        parsed.persona_type        ?? null,
          persona_summary:     parsed.persona_summary     ?? null,
          engagement_level:    parsed.engagement_level    ?? null,
          recommended_channel: parsed.recommended_channel ?? null,
          marketing_note:      parsed.marketing_note      ?? null,
          persona_at:          new Date().toISOString(),
        },
        { onConflict: "customer_id", ignoreDuplicates: false }
      )
      .select("*")
      .single();

    return data;
  } catch {
    return null; // AI is a nice-to-have, never a hard dependency
  }
}

// ── CRM URL helpers ──────────────────────────────────────────────────────────

/**
 * Build a Freshdesk contact search URL for a customer.
 */
export function freshdeskUrl(customer) {
  if (!customer?.phone && !customer?.email) return null;
  const q = customer.email || customer.phone;
  return `https://app.freshdesk.com/contacts?q=${encodeURIComponent(q)}`;
}
