/**
 * zid.js — Zid OAuth + REST API client for the channel-api service.
 *
 * Zid requires OAuth 2.0 (authorization code grant) and explicitly requires
 * the integrating app to run server-side, because the Client Secret must
 * stay off the browser (see docs.zid.sa/authorization). That's the whole
 * reason this lives here in channel-api and not in the main React app.
 *
 * Token response shape from Zid's POST /oauth/token:
 *   { access_token, authorization, refresh_token, expires_in }
 * Two headers are required on every Zid Merchant API call:
 *   Authorization:      <authorization>    — account-level, talks to the Zid API
 *   X-Manager-Token:     <access_token>     — store-level, scopes calls to this store
 *
 * NOTE ON RESPONSE SHAPES BELOW: Zid's list endpoints (customers/orders/
 * products) aren't fully nailed down here — the docs describe the
 * resources but not byte-for-byte response envelopes. The field-name
 * fallbacks below (`json.customers ?? json.results ?? ...`) are best
 * guesses based on Zid's general API conventions. Once a real store is
 * connected, the first sync's error log (or a quick look at the raw
 * response) will show if any of these need adjusting — that's expected
 * and easy to fix, not a sign anything is fundamentally wrong.
 */

const OAUTH_BASE = "https://oauth.zid.sa";
const API_BASE = "https://api.zid.sa/v1";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — add it to channel-api/.env`);
  return v;
}

/** Build the URL to send the merchant's browser to, to approve the app. */
export function buildAuthorizeUrl(state) {
  const clientId = requireEnv("ZID_CLIENT_ID");
  const redirectUri = requireEnv("ZID_REDIRECT_URI");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `${OAUTH_BASE}/oauth/authorize?${params.toString()}`;
}

/** Exchange a one-time authorization code for tokens. */
export async function exchangeCodeForTokens(code) {
  const clientId = requireEnv("ZID_CLIENT_ID");
  const clientSecret = requireEnv("ZID_CLIENT_SECRET");
  const redirectUri = requireEnv("ZID_REDIRECT_URI");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Zid token exchange failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return {
    authorization: json.authorization,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}

/** Refresh an expiring token set (refresh tokens themselves expire in ~1 year). */
export async function refreshTokens(refreshToken) {
  const clientId = requireEnv("ZID_CLIENT_ID");
  const clientSecret = requireEnv("ZID_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Zid token refresh failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return {
    authorization: json.authorization,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresIn: json.expires_in,
  };
}

function zidHeaders({ authorization, accessToken }) {
  return {
    Authorization: authorization,
    "X-Manager-Token": accessToken,
    Accept: "application/json",
    "Accept-Language": "en",
  };
}

async function fetchZidPage(url, config) {
  const res = await fetch(url, { headers: zidHeaders(config) });
  if (!res.ok) throw new Error(`Zid request failed (${res.status}): ${url}`);
  return res.json();
}

/**
 * Generic paginated list helper — Zid uses `?page=` pagination on its
 * Merchant API list endpoints. Stops when a page comes back short or empty.
 */
async function listAllPages(resourcePath, config, extractBatch) {
  const all = [];
  let page = 1;
  while (true) {
    const json = await fetchZidPage(`${API_BASE}${resourcePath}?page=${page}`, config);
    const batch = extractBatch(json) ?? [];
    if (!batch.length) break;
    all.push(...batch);
    // Heuristic stop condition: fewer items than a full page means we're done.
    // Falls back to a hard cap if Zid's page size isn't discoverable from the
    // response, so a misbehaving API can't spin this into an infinite loop.
    if (batch.length < 25 || page > 500) break;
    page++;
    await new Promise((r) => setTimeout(r, 150)); // be polite to rate limits
  }
  return all;
}

/** List ALL customers in the connected Zid store. */
export async function listZidCustomers(config) {
  return listAllPages("/customers", config, (json) => json?.customers ?? json?.results);
}

/** List ALL orders in the connected Zid store. */
export async function listZidOrders(config) {
  return listAllPages("/orders", config, (json) => json?.orders ?? json?.results);
}

/** List ALL products in the connected Zid store. */
export async function listZidProducts(config) {
  return listAllPages("/products", config, (json) => json?.results ?? json?.products);
}
