/**
 * freshdeskImport.js — One-time / repeatable data import from Freshdesk into AzQueue.
 *
 * This is NOT a new integration — it reuses the Freshdesk connection the
 * branch owner already set up himself in Settings → Integrations → Freshdesk
 * (his own subdomain + API key, stored in channel_connections). This module
 * never sees or asks for credentials; it just reads the saved connection and
 * pulls data through it.
 *
 * What gets imported, and where it lands:
 *   - Freshdesk contacts  → AzQueue customers        (matched/merged by email or phone)
 *   - Freshdesk agents    → AzQueue staff             (matched by invite_email)
 *   - Freshdesk tickets   → AzQueue customer_events   (channel: 'freshdesk')
 *
 * Safe to re-run: customers are deduped by email/phone (existing identity
 * resolution in customers.js), staff are deduped by invite_email, and
 * events are deduped by their Freshdesk ticket ID via the unique
 * (branch_id, channel, external_id) index — re-running the sync just
 * fills in anything new since the last run.
 *
 * Lives in its own file (not freshdesk.js or customers.js) to avoid a
 * circular import, since customers.js already imports from freshdesk.js.
 */

import { supabase } from "./supabase";
import { getFreshdeskConfig, listFreshdeskContacts, listFreshdeskAgents, getFreshdeskTickets } from "./freshdesk";
import { findOrCreateCustomer, logEvent } from "./customers";

/**
 * Import a Freshdesk agent as AzQueue staff, deduping on invite_email.
 * If a staff row already exists with this email (pending or linked), skip it.
 */
async function importAgentAsStaff(branchId, agent) {
  const name  = agent.contact?.name ?? "Unnamed agent";
  const email = agent.contact?.email ?? null;

  if (email) {
    const { data: existing } = await supabase
      .from("staff")
      .select("id")
      .eq("branch_id", branchId)
      .ilike("invite_email", email)
      .maybeSingle();
    if (existing) return { created: false };

    // Also skip if someone with this email already signed in as staff
    const { data: linked } = await supabase
      .from("staff")
      .select("id, user_id")
      .eq("branch_id", branchId)
      .eq("display_name", name)
      .maybeSingle();
    if (linked?.user_id) return { created: false };
  }

  const { error } = await supabase.from("staff").insert({
    branch_id:    branchId,
    display_name: name,
    invite_email: email,
    role:         "staff",
  });
  if (error) throw error;
  return { created: true };
}

/**
 * Import a Freshdesk contact as an AzQueue customer, then pull their
 * tickets in as customer_events.
 */
async function importContactWithTickets(branchId, config, contact) {
  const customer = await findOrCreateCustomer(branchId, {
    name:        contact.name ?? null,
    email:       contact.email ?? null,
    phone:       contact.phone ?? contact.mobile ?? null,
    freshdeskId: String(contact.id),
  });

  const tickets = await getFreshdeskTickets(config.apiKey, config.subdomain, contact.id);
  let eventsLogged = 0;
  for (const ticket of tickets) {
    await logEvent(customer.id, branchId, {
      channel:    "freshdesk",
      eventType:  ticket.status === "resolved" || ticket.status === "closed" ? "ticket_resolve" : "ticket_open",
      content:    `[${ticket.priority.toUpperCase()}] ${ticket.subject} — ${ticket.status}`,
      externalId: String(ticket.id),
      metadata:   ticket,
    });
    eventsLogged++;
  }

  return { customer, eventsLogged };
}

/**
 * Run a full import: agents → staff, contacts → customers, tickets → events.
 *
 * @param {string} branchId
 * @param {{ onProgress?: (info: {stage: string, done: number, total?: number}) => void }} opts
 * @returns {Promise<{ staffCreated: number, staffSkipped: number, customersImported: number, eventsLogged: number, errors: string[] }>}
 */
export async function syncFreshdeskData(branchId, { onProgress } = {}) {
  const config = await getFreshdeskConfig(branchId);
  if (!config) {
    throw new Error("Freshdesk isn't connected for this branch yet — connect it above first.");
  }

  const result = {
    staffCreated: 0,
    staffSkipped: 0,
    customersImported: 0,
    eventsLogged: 0,
    errors: [],
  };

  // 1. Agents → staff
  let agents = [];
  try {
    agents = await listFreshdeskAgents(config.apiKey, config.subdomain);
  } catch (e) {
    result.errors.push(`Couldn't list agents: ${e.message}`);
  }
  for (let i = 0; i < agents.length; i++) {
    try {
      const { created } = await importAgentAsStaff(branchId, agents[i]);
      if (created) result.staffCreated++; else result.staffSkipped++;
    } catch (e) {
      result.errors.push(`Agent "${agents[i]?.contact?.name ?? agents[i]?.id}": ${e.message}`);
    }
    onProgress?.({ stage: "staff", done: i + 1, total: agents.length });
  }

  // 2. Contacts → customers, + their tickets → events
  let contacts = [];
  try {
    contacts = await listFreshdeskContacts(config.apiKey, config.subdomain);
  } catch (e) {
    result.errors.push(`Couldn't list contacts: ${e.message}`);
  }
  for (let i = 0; i < contacts.length; i++) {
    try {
      const { eventsLogged } = await importContactWithTickets(branchId, config, contacts[i]);
      result.customersImported++;
      result.eventsLogged += eventsLogged;
    } catch (e) {
      result.errors.push(`Contact "${contacts[i]?.name ?? contacts[i]?.id}": ${e.message}`);
    }
    onProgress?.({ stage: "customers", done: i + 1, total: contacts.length });
  }

  return result;
}
