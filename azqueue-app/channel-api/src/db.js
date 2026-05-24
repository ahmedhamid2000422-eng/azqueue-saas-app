/**
 * db.js — Supabase admin client for the channel-api service.
 *
 * Uses the service_role key — bypasses all RLS policies.
 * Never expose this key to the frontend.
 *
 * Re-exports a single `db` instance used by all modules.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

export const db = createClient(url, key, {
  auth: {
    // Service-role client — no user session
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      // Identify requests from this service in Supabase logs
      "x-client-info": "azqueue-channel-api/1.0",
    },
  },
});
