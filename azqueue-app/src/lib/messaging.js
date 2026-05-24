/**
 * messaging.js — Outbound message sending + AI reply drafts.
 *
 * Architecture:
 *   Every outbound message is logged to customer_events (direction: 'outbound')
 *   regardless of whether the channel is connected. This means the timeline
 *   always reflects what was sent, even if delivery happened manually.
 *
 *   When a channel IS connected, sendMessage() calls the appropriate
 *   channel handler (WhatsApp Cloud API, Facebook Messenger API, etc.).
 *   When it is NOT connected, the message is logged with a 'manual' note
 *   and the staff member sends it themselves via the native platform.
 *
 * Adding a new channel:
 *   1. Add the channel to the check constraint in 0012_messaging.sql.
 *   2. Add a send handler in CHANNEL_SENDERS below.
 *   3. Add the config fields to the connect UI in ChannelSettings.jsx (future).
 *   That's it — the rest of the pipeline (logging, AI, UI) works unchanged.
 */

import { supabase } from "./supabase";

// ── Channel connections ────────────────────────────────────────────────

/**
 * Load all channel connections for a branch.
 * Returns a map: { facebook: { status, config, ... }, whatsapp: { ... }, ... }
 */
export async function loadChannelConnections(branchId) {
  if (!branchId) return {};
  const { data } = await supabase
    .from("channel_connections")
    .select("channel, status, error_msg, last_sync")
    .eq("branch_id", branchId);

  const map = {};
  for (const row of (data ?? [])) {
    map[row.channel] = row;
  }
  return map;
}

/**
 * Save (upsert) a channel connection config.
 * Only branch owner should call this.
 */
export async function saveChannelConnection(branchId, channel, config) {
  const { data, error } = await supabase
    .from("channel_connections")
    .upsert(
      { branch_id: branchId, channel, config, status: "connected", error_msg: null },
      { onConflict: "branch_id,channel" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function disconnectChannel(branchId, channel) {
  const { error } = await supabase
    .from("channel_connections")
    .upsert(
      { branch_id: branchId, channel, status: "disconnected", config: null, error_msg: null },
      { onConflict: "branch_id,channel" }
    );
  if (error) throw error;
}

// ── Send dispatcher ────────────────────────────────────────────────────

/**
 * Send a message to a customer on a given channel.
 *
 * Always logs to customer_events (direction: outbound).
 * Attempts real delivery if the channel is connected.
 * If not connected, logs with content prefixed "(manual)" so staff know
 * to send it themselves — the timeline still shows what was said.
 *
 * @param {string} branchId
 * @param {object} customer  — full customer row (needs channel-specific ID fields)
 * @param {string} channel   — 'whatsapp' | 'facebook' | 'instagram' | 'email' | 'manual'
 * @param {string} content   — message text
 * @param {string|null} staffId
 * @returns {{ sent: boolean, manual: boolean, eventId: string }}
 */
export async function sendMessage(branchId, customer, channel, content, staffId = null) {
  let sent   = false;
  let manual = false;
  let deliveryNote = "";

  if (channel !== "manual") {
    // Load connection config for this channel
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("status, config")
      .eq("branch_id", branchId)
      .eq("channel", channel)
      .maybeSingle();

    if (conn?.status === "connected" && conn?.config) {
      try {
        await CHANNEL_SENDERS[channel]?.(conn.config, customer, content);
        sent = true;

        // Update last_sync on the connection
        await supabase
          .from("channel_connections")
          .update({ last_sync: new Date().toISOString(), error_msg: null })
          .eq("branch_id", branchId)
          .eq("channel", channel);
      } catch (err) {
        // Log the error but don't block the timeline entry
        await supabase
          .from("channel_connections")
          .update({ status: "error", error_msg: err.message })
          .eq("branch_id", branchId)
          .eq("channel", channel);

        deliveryNote = ` [delivery failed: ${err.message}]`;
      }
    } else {
      manual = true;
      deliveryNote = " [send manually — channel not connected]";
    }
  } else {
    manual = true;
  }

  // Always log to the timeline
  const { data: event, error } = await supabase
    .from("customer_events")
    .insert({
      customer_id: customer.id,
      branch_id:   branchId,
      channel:     channel === "manual" ? "manual" : channel,
      event_type:  "message",
      direction:   "outbound",
      content:     content + deliveryNote,
      staff_id:    staffId,
    })
    .select("id, content, created_at")
    .single();
  if (error) throw error;

  // Update customer last_seen_at
  await supabase
    .from("customers")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", customer.id);

  return { sent, manual, eventId: event.id };
}

// ── Channel send implementations ───────────────────────────────────────
//
// Each handler receives: (config, customer, content)
// config = the jsonb stored in channel_connections.config
// Throw an error to signal delivery failure — it will be caught above.

const CHANNEL_SENDERS = {

  /**
   * WhatsApp Cloud API (Meta)
   * config: { phone_number_id, access_token }
   * customer: needs whatsapp_id (E.164 phone number)
   */
  whatsapp: async (config, customer, content) => {
    if (!customer.whatsapp_id) throw new Error("No WhatsApp number for this customer");
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${config.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.access_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: customer.whatsapp_id,
          type: "text",
          text: { body: content },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message ?? "WhatsApp send failed");
    }
  },

  /**
   * Facebook Messenger (Meta Graph API)
   * config: { page_access_token }
   * customer: needs facebook_id (PSID)
   */
  facebook: async (config, customer, content) => {
    if (!customer.facebook_id) throw new Error("No Facebook ID for this customer");
    const res = await fetch("https://graph.facebook.com/v19.0/me/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.page_access_token}`,
      },
      body: JSON.stringify({
        recipient: { id: customer.facebook_id },
        message:   { text: content },
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message ?? "Facebook send failed");
    }
  },

  /**
   * Instagram Direct (Meta Graph API)
   * config: { ig_user_id, page_access_token }
   * customer: needs instagram_id (IGSID)
   */
  instagram: async (config, customer, content) => {
    if (!customer.instagram_id) throw new Error("No Instagram ID for this customer");
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${config.ig_user_id}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.page_access_token}`,
        },
        body: JSON.stringify({
          recipient: { id: customer.instagram_id },
          message:   { text: content },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message ?? "Instagram send failed");
    }
  },

  /**
   * Email via any SMTP-compatible provider.
   * We proxy through a Supabase Edge Function to keep SMTP credentials
   * server-side — client never touches the SMTP password.
   * config: { from_address, from_name }
   * customer: needs email
   */
  email: async (config, customer, content) => {
    if (!customer.email) throw new Error("No email address for this customer");
    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        to:      customer.email,
        from:    `${config.from_name ?? "Support"} <${config.from_address}>`,
        subject: "Message from our team",
        text:    content,
      },
    });
    if (error) throw new Error(error.message ?? "Email send failed");
  },
};

// ── AI reply generation ────────────────────────────────────────────────

/**
 * Generate a suggested reply using the customer's recent conversation thread.
 * Returns a plain string — the draft text to pre-fill in the composer.
 * Returns null if no API key or no events to work from.
 *
 * @param {object[]} recentEvents  — last N events from the customer timeline
 * @param {string}   channel       — channel the reply will be sent on
 * @param {string}   [instruction] — optional extra instruction from staff
 */
export async function generateAiReply(recentEvents, channel, instruction = "") {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey || !recentEvents?.length) return null;

  const thread = recentEvents
    .slice(0, 15)
    .reverse()
    .map((e) => {
      const who = e.direction === "outbound" ? "Staff" : "Customer";
      return `${who} [${e.channel}]: ${e.content ?? "(no content)"}`;
    })
    .join("\n");

  const channelNote = {
    whatsapp:  "Reply should be warm, conversational, and short. WhatsApp style.",
    facebook:  "Reply should be friendly and concise. Facebook Messenger style.",
    instagram: "Reply should be brief and friendly. Instagram DM style.",
    email:     "Reply should be professional and complete. Email style.",
    manual:    "Reply should be clear and helpful.",
  }[channel] ?? "Reply should be clear and helpful.";

  const prompt = `You are a helpful customer support assistant. Based on this conversation, draft a reply for the staff member to send.

Recent conversation:
${thread}

${instruction ? `Staff note: ${instruction}\n` : ""}
${channelNote}

Write only the message text — no labels, no quotation marks, no explanation. Just the reply itself.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       "gpt-4o-mini",
        messages:    [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens:  300,
      }),
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
