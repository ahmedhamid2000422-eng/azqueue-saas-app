/**
 * freshdesk.js — Freshdesk API integration for AzQueue.
 *
 * Fetches contact info + recent tickets from Freshdesk to enrich
 * customer personas with real support history.
 *
 * HOW TO GET YOUR API KEY:
 *   1. Log in to your Freshdesk account (yourcompany.freshdesk.com)
 *   2. Click your avatar (top-right) → Profile Settings
 *   3. Scroll down — your API key is shown on the right side
 *   4. Copy it and paste it into AzQueue Settings → Integrations → Freshdesk
 *
 * Your subdomain is the part before .freshdesk.com in your URL.
 * e.g. if you visit "acme.freshdesk.com", your subdomain is "acme".
 *
 * The API key + subdomain are stored in your branch's channel_connections row
 * (channel = 'freshdesk') so they're only visible to the branch owner.
 */

import { supabase } from "./supabase";

// ── Config helpers ────────────────────────────────────────────────────────

/**
 * Load the Freshdesk credentials for a branch.
 * Returns { apiKey, subdomain } or null if not configured.
 */
export async function getFreshdeskConfig(branchId) {
  const { data } = await supabase
    .from("channel_connections")
    .select("config, status")
    .eq("branch_id", branchId)
    .eq("channel", "freshdesk")
    .maybeSingle();

  if (!data?.config?.apiKey || !data?.config?.subdomain) return null;
  return { apiKey: data.config.apiKey, subdomain: data.config.subdomain };
}

/**
 * Save Freshdesk credentials for a branch.
 * Tests the connection before saving — throws if invalid.
 */
export async function saveFreshdeskConfig(branchId, { apiKey, subdomain }) {
  // Test the credentials
  const testOk = await testFreshdeskCredentials(apiKey, subdomain);
  if (!testOk) throw new Error("Invalid API key or subdomain — please check and try again.");

  const { error } = await supabase
    .from("channel_connections")
    .upsert(
      {
        branch_id: branchId,
        channel: "freshdesk",
        status: "connected",
        config: { apiKey, subdomain },
        error_msg: null,
        last_sync: new Date().toISOString(),
      },
      { onConflict: "branch_id,channel" }
    );

  if (error) throw error;
}

/**
 * Disconnect Freshdesk for a branch.
 */
export async function disconnectFreshdesk(branchId) {
  await supabase
    .from("channel_connections")
    .upsert(
      { branch_id: branchId, channel: "freshdesk", status: "disconnected", config: {} },
      { onConflict: "branch_id,channel" }
    );
}

// ── API calls ─────────────────────────────────────────────────────────────

function basicAuth(apiKey) {
  return "Basic " + btoa(apiKey + ":X");
}

/**
 * Test that the API key + subdomain are valid by hitting the /agents/me endpoint.
 */
export async function testFreshdeskCredentials(apiKey, subdomain) {
  try {
    const res = await fetch(`https://${subdomain}.freshdesk.com/api/v2/agents/me`, {
      headers: { Authorization: basicAuth(apiKey) },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Search for a Freshdesk contact by email or phone.
 * Returns the first match or null.
 */
export async function findFreshdeskContact(apiKey, subdomain, { email, phone }) {
  try {
    let query = null;
    if (email) query = `email:${email}`;
    else if (phone) query = `phone:${phone}`;
    if (!query) return null;

    const url = `https://${subdomain}.freshdesk.com/api/v2/search/contacts?query="${encodeURIComponent(query)}"`;
    const res = await fetch(url, {
      headers: { Authorization: basicAuth(apiKey) },
    });
    if (!res.ok) return null;

    const json = await res.json();
    const results = json.results ?? [];
    return results[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the recent tickets for a Freshdesk contact ID.
 * Returns up to 10 recent tickets (id, subject, status, priority, created_at).
 */
export async function getFreshdeskTickets(apiKey, subdomain, contactId) {
  try {
    const url = `https://${subdomain}.freshdesk.com/api/v2/contacts/${contactId}/tickets?per_page=10&order_by=created_at&order_type=desc`;
    const res = await fetch(url, {
      headers: { Authorization: basicAuth(apiKey) },
    });
    if (!res.ok) return [];

    const tickets = await res.json();
    return (tickets ?? []).map((t) => ({
      id: t.id,
      subject: t.subject,
      status: TICKET_STATUS[t.status] ?? "unknown",
      priority: TICKET_PRIORITY[t.priority] ?? "normal",
      created_at: t.created_at,
    }));
  } catch {
    return [];
  }
}

const TICKET_STATUS = { 2: "open", 3: "pending", 4: "resolved", 5: "closed" };
const TICKET_PRIORITY = { 1: "low", 2: "medium", 3: "high", 4: "urgent" };

/**
 * All-in-one: given a customer's email/phone, returns a compact Freshdesk
 * summary string suitable for injection into the AI persona prompt.
 *
 * Returns null if not configured or no contact found.
 */
export async function getFreshdeskContext(branchId, { email, phone }) {
  const config = await getFreshdeskConfig(branchId);
  if (!config) return null;

  const contact = await findFreshdeskContact(config.apiKey, config.subdomain, { email, phone });
  if (!contact) return null;

  const tickets = await getFreshdeskTickets(config.apiKey, config.subdomain, contact.id);

  const lines = [
    `Freshdesk contact: ${contact.name ?? "unknown"} (ID ${contact.id})`,
    `  Email: ${contact.email ?? "—"}  Phone: ${contact.phone ?? "—"}`,
    `  Tags: ${(contact.tags ?? []).join(", ") || "none"}`,
    `  Total tickets: ${contact.helpdesk_agent ? "(agent account)" : (tickets.length + " recent")}`,
  ];

  if (tickets.length > 0) {
    lines.push("  Recent support tickets:");
    tickets.forEach((t) => {
      lines.push(`    [${t.priority.toUpperCase()}] ${t.subject} — ${t.status} (${t.created_at?.slice(0, 10)})`);
    });
  } else {
    lines.push("  No support tickets on record.");
  }

  return lines.join("\n");
}
