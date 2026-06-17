/**
 * platformOverview.js — internal unified cross-platform rollup for Insights.
 *
 * This is the "internal" half of the analytics feature, mirroring what
 * googleAnalytics.js does for the "external" half. Where GA4 pulls in
 * website metrics from outside AzQueue, this rolls up activity that's
 * already inside AzQueue but scattered across separately-built features:
 * customer_events (populated by Freshdesk/Zid/Shopify imports, WhatsApp,
 * queue activity — see customers.js logEvent/logQueueEvent), wa_conversations
 * (WhatsApp AI customer-service sessions), and channel_connections (which
 * platforms are actually connected right now).
 *
 * None of this needs a new table or RPC — customer_events and
 * wa_conversations already carry RLS policies that let an owner or any
 * staff member on the branch read them directly (see migrations
 * 0011_customers.sql and 0019_wa_receptionist.sql), so this is a plain
 * client-side aggregation, same as the rest of the dashboard.
 */

import { supabase } from "./supabase";

export const CHANNEL_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  email: "Email",
  freshdesk: "Freshdesk",
  zid: "Zid",
  shopify: "Shopify",
  slack: "Slack",
  google_analytics: "Google Analytics",
};

/**
 * Pull together a cross-platform activity snapshot for a branch.
 *
 * @param {string} branchId
 * @param {number} days — lookback window for activity counts (default 30)
 */
export async function fetchPlatformOverview(branchId, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const [{ data: connections }, { data: events }, { data: conversations }] = await Promise.all([
    supabase
      .from("channel_connections")
      .select("channel, status, last_sync")
      .eq("branch_id", branchId),

    supabase
      .from("customer_events")
      .select("channel, event_type, direction, created_at")
      .eq("branch_id", branchId)
      .gte("created_at", cutoff)
      .limit(5000),

    supabase
      .from("wa_conversations")
      .select("id, needs_human, completed, created_at")
      .eq("branch_id", branchId)
      .gte("created_at", cutoff)
      .limit(5000),
  ]);

  // ── Roll up event volume per channel ──────────────────────────────
  const byChannel = {};
  for (const e of events ?? []) {
    byChannel[e.channel] = (byChannel[e.channel] ?? 0) + 1;
  }
  const channelActivity = Object.entries(byChannel)
    .map(([channel, count]) => ({ channel, label: CHANNEL_LABELS[channel] ?? channel, count }))
    .sort((a, b) => b.count - a.count);

  // ── WhatsApp AI conversation stats ──────────────────────────────────
  const wa = conversations ?? [];
  const waStats = {
    total: wa.length,
    needsHuman: wa.filter((c) => c.needs_human && !c.completed).length,
    completed: wa.filter((c) => c.completed).length,
  };

  // ── Which platforms are actually connected ──────────────────────────
  const connectionMap = {};
  for (const c of connections ?? []) connectionMap[c.channel] = c;

  return {
    connections: connections ?? [],
    connectionMap,
    channelActivity,
    totalEvents: events?.length ?? 0,
    waStats,
    days,
  };
}
