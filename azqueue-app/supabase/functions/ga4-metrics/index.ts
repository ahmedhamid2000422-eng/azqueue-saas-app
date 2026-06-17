/**
 * ga4-metrics/index.ts — Google Analytics (GA4) metrics for AzQueue Insights.
 *
 * GA4 access uses a service account (the owner creates it himself in Google
 * Cloud Console and grants it Viewer access on his GA4 property — see
 * migration 0031 for the exact steps). Authenticating as a service account
 * means signing a JWT with the account's private key and exchanging it for
 * an access token at Google's OAuth token endpoint. That token exchange is
 * a server-to-server flow by design (Google does not enable CORS on it for
 * browser callers), so — unlike Shopify/Freshdesk, which AzQueue's frontend
 * calls directly — this has to run here, in an Edge Function.
 *
 * Two ways this gets called from the frontend (src/lib/googleAnalytics.js):
 *   1. Testing credentials before saving: body includes serviceAccountJson
 *      + propertyId directly (not yet persisted) — used by the "Connect"
 *      button in Settings to validate before writing to channel_connections.
 *   2. Fetching the dashboard's metrics: body has just { branchId, days }
 *      — credentials are loaded from channel_connections (channel =
 *      'google_analytics') for that branch.
 *
 * Nothing GA4 returns is stored — every call fetches live from Google and
 * returns the rows straight to the caller. There's no customer-identity
 * data in here, so there's nothing to import into `customers`.
 *
 * Always called with the signed-in user's access token, same verification
 * pattern as wa-reply: re-derive identity from the token, then confirm the
 * caller actually has access to the requested branch (owner or staff)
 * before touching anything.
 *
 * POST body: { branchId, days?, serviceAccountJson?, propertyId? }
 *
 * REQUIRED SUPABASE SECRETS:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── base64url helpers ───────────────────────────────────────────────────

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ── Google service-account auth ─────────────────────────────────────────

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("Service account JSON is not valid JSON — paste the full downloaded .json file contents.");
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error("That JSON doesn't look like a service account key (missing client_email / private_key).");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const keyData = pemToArrayBuffer(sa.private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(sigBuf)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description ?? data?.error ?? `Google token exchange failed (${res.status})`);
  }
  return data.access_token as string;
}

function cleanPropertyId(propertyId: string): string {
  return propertyId.trim().replace(/^properties\//, "");
}

async function runReport(accessToken: string, propertyId: string, days: number) {
  const id = cleanPropertyId(propertyId);
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "conversions" },
          { name: "averageSessionDuration" },
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `GA4 request failed (${res.status}) — check the Property ID and that the service account has Viewer access.`);
  }
  return data;
}

function parseRows(data: any) {
  const rows = (data?.rows ?? []).map((r: any) => ({
    date: r.dimensionValues?.[0]?.value ?? "",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    activeUsers: Number(r.metricValues?.[1]?.value ?? 0),
    conversions: Number(r.metricValues?.[2]?.value ?? 0),
    avgSessionDuration: Number(r.metricValues?.[3]?.value ?? 0),
  }));

  const totals = rows.reduce(
    (acc: any, r: any) => ({
      sessions: acc.sessions + r.sessions,
      activeUsers: acc.activeUsers + r.activeUsers,
      conversions: acc.conversions + r.conversions,
    }),
    { sessions: 0, activeUsers: 0, conversions: 0 }
  );

  return { rows, totals };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Verify the calling user via their own access token ──────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessTokenJwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!accessTokenJwt) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessTokenJwt}` } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const { branchId, days, serviceAccountJson, propertyId } = await req.json();
    if (!branchId) return json({ error: "branchId is required" }, 400);

    // ── Confirm the caller actually has access to this branch ───────
    const [{ data: ownedBranch }, { data: staffRow }] = await Promise.all([
      admin.from("branches").select("id").eq("id", branchId).eq("owner_id", userData.user.id).maybeSingle(),
      admin.from("staff").select("id").eq("branch_id", branchId).eq("user_id", userData.user.id).maybeSingle(),
    ]);
    if (!ownedBranch && !staffRow) {
      return json({ error: "You don't have access to this branch" }, 403);
    }

    // ── Resolve credentials: either provided directly (testing before
    //    save) or loaded from the saved connection ──────────────────
    let saJson = serviceAccountJson;
    let propId = propertyId;

    if (!saJson || !propId) {
      const { data: conn } = await admin
        .from("channel_connections")
        .select("config")
        .eq("branch_id", branchId)
        .eq("channel", "google_analytics")
        .maybeSingle();
      saJson = conn?.config?.serviceAccountJson;
      propId = conn?.config?.propertyId;
    }

    if (!saJson || !propId) {
      return json({ error: "Google Analytics isn't connected for this branch yet" }, 400);
    }

    const accessToken = await getAccessToken(saJson);
    const reportData = await runReport(accessToken, propId, Number(days) > 0 ? Number(days) : 30);
    const { rows, totals } = parseRows(reportData);

    return json({ ok: true, rows, totals });
  } catch (err) {
    console.error("[ga4-metrics] Error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});
