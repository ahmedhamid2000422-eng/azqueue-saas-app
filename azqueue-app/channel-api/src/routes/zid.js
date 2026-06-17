/**
 * routes/zid.js — Zid OAuth connect/callback + data sync.
 *
 * Why this lives in channel-api and not the main React app: Zid's OAuth
 * flow requires a server that can hold the Client Secret securely (see
 * docs.zid.sa/authorization — "Your app must run server-side"). The main
 * AzQueue app is a browser-side Vite/React app with only a Supabase anon
 * key, so it can never hold that secret safely. This Express service
 * already holds the Supabase service-role key server-side, so it's the
 * natural home for it.
 *
 * Flow:
 *   1. Branch owner clicks "Connect Zid" in AzQueue Settings → Integrations.
 *   2. Frontend calls GET /zid/connect with the owner's own Supabase
 *      session token, so we can confirm they actually own the branch
 *      before sending them anywhere.
 *   3. We hand back Zid's authorize URL; the frontend does a full-page
 *      redirect there. The owner logs into Zid (if needed) and approves
 *      the requested scopes HIMSELF, on Zid's own site — AzQueue and
 *      Claude never see his Zid password.
 *   4. Zid redirects his browser back to GET /zid/callback with a
 *      one-time code (no auth header available at this point — that's
 *      normal for OAuth redirects, the code itself is the credential).
 *   5. We exchange the code for tokens server-side and save them to
 *      channel_connections (channel = 'zid').
 *   6. POST /zid/sync pulls customers, orders, and products into AzQueue.
 *
 * This router is intentionally NOT behind the shared `requireApiKey`
 * middleware in server.js — it has its own per-branch ownership check
 * (verifyBranchOwner) based on the calling user's real Supabase session,
 * which is what we actually want here (a static shared secret would let
 * any branch owner trigger syncs for any other branch).
 */

import express from "express";
import { db } from "../db.js";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  listZidCustomers,
  listZidOrders,
  listZidProducts,
} from "../lib/zid.js";

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

/** Verify the bearer token belongs to a real Supabase user who owns branchId. */
async function verifyBranchOwner(req, branchId) {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !branchId) return false;

  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return false;

  const { data: branch } = await db
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .eq("owner_id", userData.user.id)
    .maybeSingle();

  return !!branch;
}

/** Find-or-create an AzQueue customer for a Zid identity, deduped by zid_id → email → phone. */
async function findOrCreateCustomerFromZid(branchId, { zidId, name, email, phone }) {
  let existing = null;

  if (zidId) {
    const { data } = await db.from("customers").select("*")
      .eq("branch_id", branchId).eq("zid_id", zidId).maybeSingle();
    existing = data;
  }
  if (!existing && email) {
    const { data } = await db.from("customers").select("*")
      .eq("branch_id", branchId).ilike("email", email).maybeSingle();
    existing = data;
  }
  if (!existing && phone) {
    const { data } = await db.from("customers").select("*")
      .eq("branch_id", branchId).eq("phone", phone).maybeSingle();
    existing = data;
  }

  if (existing) {
    const updates = { last_seen_at: new Date().toISOString() };
    if (zidId && !existing.zid_id) updates.zid_id = zidId;
    if (name && !existing.display_name) updates.display_name = name;
    if (email && !existing.email) updates.email = email;
    if (phone && !existing.phone) updates.phone = phone;
    const { data: updated, error } = await db.from("customers").update(updates)
      .eq("id", existing.id).select("*").single();
    if (error) throw error;
    return updated ?? existing;
  }

  const { data: created, error } = await db.from("customers").insert({
    branch_id: branchId,
    display_name: name ?? null,
    email: email ?? null,
    phone: phone ?? null,
    zid_id: zidId ?? null,
    last_seen_at: new Date().toISOString(),
  }).select("*").single();
  if (error) throw error;
  return created;
}

/** Log a customer_event, skipping if this external_id was already synced. */
async function logEventIfNew(branchId, customerId, { eventType, content, metadata, externalId }) {
  if (externalId) {
    const { data: dup } = await db.from("customer_events").select("id")
      .eq("branch_id", branchId).eq("channel", "zid").eq("external_id", externalId).maybeSingle();
    if (dup) return { created: false };
  }
  const { error } = await db.from("customer_events").insert({
    customer_id: customerId,
    branch_id: branchId,
    channel: "zid",
    event_type: eventType,
    direction: "inbound",
    content,
    metadata,
    external_id: externalId ?? null,
  });
  if (error) throw error;
  return { created: true };
}

// ── GET /zid/connect?branch_id=xxx  (Authorization: Bearer <user token>) ──
// Returns the Zid authorize URL for the frontend to navigate to. Doesn't
// redirect directly because the call comes from fetch(), not a top-level
// browser navigation — the frontend does `window.location.href = url`.
router.get("/connect", async (req, res) => {
  const branchId = req.query.branch_id;
  const ok = await verifyBranchOwner(req, branchId);
  if (!ok) return res.status(403).json({ error: "Not authorized for this branch." });

  try {
    const url = buildAuthorizeUrl(branchId); // branchId travels through as `state`
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /zid/callback?code=...&state=<branchId> ──────────────────────────
// Zid redirects the merchant's browser here directly — there's no auth
// header available at this point. That's fine: the one-time code (plus
// our client secret) IS the credential, and Zid only issues it after the
// merchant approved the consent screen themselves.
router.get("/callback", async (req, res) => {
  const { code, state: branchId, error: zidError } = req.query;

  if (zidError) {
    return res.redirect(`${FRONTEND_URL}/settings?zid=error&reason=${encodeURIComponent(zidError)}`);
  }
  if (!code || !branchId) {
    return res.redirect(`${FRONTEND_URL}/settings?zid=error&reason=missing_code`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { error } = await db.from("channel_connections").upsert(
      {
        branch_id: branchId,
        channel: "zid",
        status: "connected",
        config: {
          authorization: tokens.authorization,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresIn
            ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
            : null,
        },
        error_msg: null,
        last_sync: null,
      },
      { onConflict: "branch_id,channel" }
    );
    if (error) throw error;
    return res.redirect(`${FRONTEND_URL}/settings?zid=connected`);
  } catch (e) {
    console.error("Zid OAuth callback failed:", e);
    return res.redirect(`${FRONTEND_URL}/settings?zid=error&reason=${encodeURIComponent(e.message)}`);
  }
});

// ── POST /zid/sync  { branchId }  (Authorization: Bearer <user token>) ───
router.post("/sync", async (req, res, next) => {
  try {
    const { branchId } = req.body ?? {};
    const ok = await verifyBranchOwner(req, branchId);
    if (!ok) return res.status(403).json({ error: "Not authorized for this branch." });

    const { data: conn } = await db.from("channel_connections").select("config, status")
      .eq("branch_id", branchId).eq("channel", "zid").maybeSingle();

    if (!conn || conn.status !== "connected" || !conn.config?.authorization) {
      return res.status(400).json({ error: "Zid isn't connected for this branch yet — connect it above first." });
    }

    const config = { authorization: conn.config.authorization, accessToken: conn.config.accessToken };
    const result = { customersImported: 0, ordersLogged: 0, productsSynced: 0, errors: [] };
    const customerIdByZidId = new Map();

    // 1. Customers → AzQueue customers
    let customers = [];
    try {
      customers = await listZidCustomers(config);
    } catch (e) {
      result.errors.push(`Couldn't list customers: ${e.message}`);
    }
    for (const c of customers) {
      try {
        const zidId = c?.id != null ? String(c.id) : null;
        const customer = await findOrCreateCustomerFromZid(branchId, {
          zidId,
          name: c.name ?? [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
          email: c.email ?? null,
          phone: c.mobile ?? c.phone ?? null,
        });
        if (zidId) customerIdByZidId.set(zidId, customer.id);
        result.customersImported++;
      } catch (e) {
        result.errors.push(`Customer "${c?.name ?? c?.id}": ${e.message}`);
      }
    }

    // 2. Orders → customer_events (find-or-create the customer if they
    //    weren't already pulled in above — e.g. guest checkout)
    let orders = [];
    try {
      orders = await listZidOrders(config);
    } catch (e) {
      result.errors.push(`Couldn't list orders: ${e.message}`);
    }
    for (const o of orders) {
      try {
        const zidCustomerId = o.customer?.id != null ? String(o.customer.id) : null;
        let customerId = zidCustomerId ? customerIdByZidId.get(zidCustomerId) : null;

        if (!customerId) {
          const customer = await findOrCreateCustomerFromZid(branchId, {
            zidId: zidCustomerId,
            name: o.customer?.name ?? null,
            email: o.customer?.email ?? o.email ?? null,
            phone: o.customer?.mobile ?? o.customer?.phone ?? o.phone ?? null,
          });
          customerId = customer.id;
          if (zidCustomerId) customerIdByZidId.set(zidCustomerId, customerId);
        }

        const statusText = (o.status?.name ?? o.status ?? "").toString().toLowerCase();
        const eventType = statusText.includes("cancel")
          ? "order_cancelled"
          : statusText.includes("deliver") || statusText.includes("fulfill") || statusText.includes("complete")
            ? "order_fulfilled"
            : "order_placed";

        const total = o.total?.value ?? o.total ?? "?";
        const currency = o.total?.currency ?? "";
        const { created } = await logEventIfNew(branchId, customerId, {
          eventType,
          content: `Order #${o.order_number ?? o.id} — ${o.status?.name ?? o.status ?? "placed"} (${total} ${currency})`.trim(),
          metadata: o,
          externalId: o.id != null ? String(o.id) : null,
        });
        if (created) result.ordersLogged++;
      } catch (e) {
        result.errors.push(`Order "${o?.order_number ?? o?.id}": ${e.message}`);
      }
    }

    // 3. Products → zid_products (catalog/inventory snapshot — not customer-linked)
    let products = [];
    try {
      products = await listZidProducts(config);
    } catch (e) {
      result.errors.push(`Couldn't list products: ${e.message}`);
    }
    for (const p of products) {
      try {
        if (p?.id == null) continue;
        const { error } = await db.from("zid_products").upsert(
          {
            branch_id: branchId,
            zid_product_id: String(p.id),
            name: p.name ?? null,
            sku: p.sku ?? null,
            price: p.price?.value ?? p.price ?? null,
            stock_qty: p.quantity ?? p.stock ?? null,
            raw: p,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "branch_id,zid_product_id" }
        );
        if (error) throw error;
        result.productsSynced++;
      } catch (e) {
        result.errors.push(`Product "${p?.name ?? p?.id}": ${e.message}`);
      }
    }

    await db.from("channel_connections").update({ last_sync: new Date().toISOString() })
      .eq("branch_id", branchId).eq("channel", "zid");

    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
