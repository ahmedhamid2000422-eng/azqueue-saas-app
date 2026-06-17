/**
 * zid.js — frontend helpers for the Zid integration.
 *
 * Zid requires real OAuth 2.0, and the Client Secret has to live
 * server-side (see docs.zid.sa/authorization). So unlike freshdesk.js,
 * this file never talks to Zid directly — it calls AzQueue's own
 * channel-api service, which holds the Zid client secret and does the
 * OAuth dance + data sync on the branch owner's behalf. This file just:
 *
 *   - asks channel-api for the "go connect" URL and sends the owner's
 *     browser there (he approves on Zid's own consent screen — AzQueue
 *     and Claude never see his Zid login)
 *   - reads connection status from channel_connections, for the UI
 *   - triggers a sync run once connected
 */

import { supabase } from "./supabase";

const CHANNEL_API_URL = import.meta.env.VITE_CHANNEL_API_URL ?? "http://localhost:3001";

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("You need to be signed in to do this.");
  return { Authorization: `Bearer ${token}` };
}

/** Read the current Zid connection status for a branch (no secrets exposed here). */
export async function getZidStatus(branchId) {
  const { data } = await supabase
    .from("channel_connections")
    .select("status, last_sync, error_msg")
    .eq("branch_id", branchId)
    .eq("channel", "zid")
    .maybeSingle();
  return data ?? { status: "disconnected", last_sync: null, error_msg: null };
}

/** Send the owner's browser to Zid's consent screen to connect their store. */
export async function startZidConnect(branchId) {
  const headers = await authHeader();
  const res = await fetch(
    `${CHANNEL_API_URL}/zid/connect?branch_id=${encodeURIComponent(branchId)}`,
    { headers }
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Couldn't start the Zid connection.");
  window.location.href = json.url; // full-page redirect — owner approves on Zid's own site
}

/** Disconnect Zid for a branch. The owner can re-approve any time. */
export async function disconnectZid(branchId) {
  await supabase
    .from("channel_connections")
    .upsert(
      { branch_id: branchId, channel: "zid", status: "disconnected", config: {} },
      { onConflict: "branch_id,channel" }
    );
}

/** Run (or re-run) the Zid → AzQueue import. Safe to call repeatedly. */
export async function syncZidData(branchId) {
  const headers = await authHeader();
  const res = await fetch(`${CHANNEL_API_URL}/zid/sync`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ branchId }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Zid sync failed.");
  return json;
}
