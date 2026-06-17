/**
 * googleAnalytics.js — Google Analytics (GA4) connection for AzQueue Insights.
 *
 * Inbound-only, in the opposite direction from Slack: AzQueue pulls
 * aggregate site metrics (sessions, users, conversions) IN from GA4 for
 * display on the Insights dashboard. Nothing is written back to Google,
 * and — unlike Freshdesk/Zid/Shopify — nothing here is customer-identity
 * data, so there's no import into `customers`/`customer_events`.
 *
 * Auth uses a service account the owner creates himself in Google Cloud
 * Console and grants Viewer access to on his own GA4 property (see
 * migration 0031 for the exact steps) — same "paste a credential you
 * generated yourself" pattern as every other integration here.
 *
 * The actual Google calls (signing a JWT with the service account's
 * private key, exchanging it for an access token, calling the GA4 Data
 * API) happen in the ga4-metrics Edge Function, not here — Google's
 * token endpoint doesn't allow that exchange from a browser origin, so
 * unlike Shopify this can't be a direct frontend fetch.
 */

import { supabase } from "./supabase";

// ── Config helpers ────────────────────────────────────────────────────────

/** Load the GA4 connection state for a branch. Returns { propertyId } or null. */
export async function getGAConfig(branchId) {
  const { data } = await supabase
    .from("channel_connections")
    .select("config, status")
    .eq("branch_id", branchId)
    .eq("channel", "google_analytics")
    .maybeSingle();

  if (!data?.config?.propertyId || data.status !== "connected") return null;
  return { propertyId: data.config.propertyId };
}

/**
 * Save GA4 credentials for a branch. Tests the connection via the
 * ga4-metrics Edge Function before saving — throws if invalid.
 */
export async function saveGAConfig(branchId, { serviceAccountJson, propertyId }) {
  const sa = serviceAccountJson.trim();
  const id = propertyId.trim();

  const { data, error } = await supabase.functions.invoke("ga4-metrics", {
    body: { branchId, serviceAccountJson: sa, propertyId: id, days: 1 },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? "Couldn't verify those credentials — please check and try again.");

  const { error: saveErr } = await supabase
    .from("channel_connections")
    .upsert(
      {
        branch_id: branchId,
        channel: "google_analytics",
        status: "connected",
        config: { serviceAccountJson: sa, propertyId: id },
        error_msg: null,
        last_sync: new Date().toISOString(),
      },
      { onConflict: "branch_id,channel" }
    );
  if (saveErr) throw saveErr;
}

/** Disconnect Google Analytics for a branch. */
export async function disconnectGA(branchId) {
  await supabase
    .from("channel_connections")
    .upsert(
      { branch_id: branchId, channel: "google_analytics", status: "disconnected", config: {} },
      { onConflict: "branch_id,channel" }
    );
}

// ── Fetching ─────────────────────────────────────────────────────────────

/**
 * Fetch GA4 metrics for the dashboard — daily rows plus totals over the
 * window. Returns null if not connected or the call fails; callers
 * shouldn't need to guard every render on this, just treat null as
 * "nothing to show yet."
 */
export async function fetchGAMetrics(branchId, days = 30) {
  try {
    const { data, error } = await supabase.functions.invoke("ga4-metrics", {
      body: { branchId, days },
    });
    if (error || !data?.ok) return null;
    return { rows: data.rows ?? [], totals: data.totals ?? null };
  } catch {
    return null;
  }
}
