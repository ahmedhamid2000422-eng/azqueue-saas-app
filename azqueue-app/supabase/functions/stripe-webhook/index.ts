// Supabase Edge Function — Stripe webhook receiver.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET   — whsec_… from Stripe Dashboard → Developers → Webhooks
//
// In Stripe Dashboard add an endpoint pointing to:
//   https://<your-project>.functions.supabase.co/stripe-webhook
// Subscribe to:
//   - checkout.session.completed
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TIER_BY_PRICE_ENV: Record<string, string> = {
  STRIPE_PRICE_ESSENTIAL:    "essential",
  STRIPE_PRICE_PROFESSIONAL: "professional",
  STRIPE_PRICE_EXECUTIVE:    "executive",
  STRIPE_PRICE_MANAGER:      "manager",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const stripeKey     = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 503 });
  }

  // 1. Read raw body + signature header — both required for verification
  const body = await req.text();
  const sigHeader = req.headers.get("stripe-signature");
  if (!sigHeader) return new Response("Missing signature", { status: 400 });

  // 2. Verify the signature — reject the request if anything is off
  try {
    await verifyStripeSignature(body, sigHeader, webhookSecret);
  } catch (e) {
    return new Response(`Signature verification failed: ${(e as Error).message}`, { status: 400 });
  }

  // Now safe to parse and act
  let event;
  try { event = JSON.parse(body); }
  catch { return new Response("Bad JSON", { status: 400 }); }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const type = event.type as string;
  const data = event.data?.object ?? {};

  const priceToTier: Record<string, string> = {};
  for (const [envName, tier] of Object.entries(TIER_BY_PRICE_ENV)) {
    const id = Deno.env.get(envName);
    if (id) priceToTier[id] = tier;
  }

  if (type === "checkout.session.completed" || type === "customer.subscription.created" || type === "customer.subscription.updated") {
    const customerId     = data.customer ?? null;
    const subscriptionId = data.subscription ?? data.id ?? null;
    const status         = data.status ?? "active";
    const userId         = data.metadata?.user_id ?? null;
    const cancelAtEnd    = data.cancel_at_period_end ?? false;
    const periodEndUnix  = data.current_period_end ?? null;

    let priceId = data.items?.data?.[0]?.price?.id ?? null;
    if (!priceId && type === "checkout.session.completed") {
      const lineItemsRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${data.id}/line_items?limit=1`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } }
      );
      const lineItems = await lineItemsRes.json();
      priceId = lineItems?.data?.[0]?.price?.id ?? null;
    }
    const tier = (priceId && priceToTier[priceId]) ?? data.metadata?.tier ?? "essential";

    if (userId) {
      await admin.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status,
        tier,
        current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
        cancel_at_period_end: cancelAtEnd,
      }, { onConflict: "user_id" });

      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { tier },
      });
    }
  }

  if (type === "customer.subscription.deleted") {
    const customerId = data.customer;
    const userId     = data.metadata?.user_id;
    const targetUserId = userId ?? (await findUserByCustomer(admin, customerId));

    if (targetUserId) {
      await admin.from("subscriptions").upsert({
        user_id: targetUserId,
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        status: "cancelled",
        tier: "essential",
      }, { onConflict: "user_id" });
      await admin.auth.admin.updateUserById(targetUserId, {
        user_metadata: { tier: "essential" },
      });
    }
  }

  return new Response("ok", { status: 200 });
});

/**
 * Verify a Stripe webhook signature (v1 scheme).
 *
 * Header format: t=<unix>,v1=<hex>,v1=<hex>
 * Signed payload: "<unix>.<raw body>"
 * Compute HMAC-SHA256 with the webhook secret and compare against the v1 sigs.
 * Reject if no v1 sig matches OR if the timestamp is older than 5 minutes.
 */
async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts: Record<string, string[]> = {};
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (!k || !v) continue;
    (parts[k] ??= []).push(v);
  }

  const ts = parts.t?.[0];
  const sigs = parts.v1 ?? [];
  if (!ts || sigs.length === 0) throw new Error("Malformed signature header");

  // Reject replay attempts older than 5 minutes
  const ageSec = Math.floor(Date.now() / 1000) - parseInt(ts, 10);
  if (ageSec > 300) throw new Error("Timestamp too old");

  const signedPayload = `${ts}.${payload}`;
  const expected = await hmacSha256Hex(secret, signedPayload);

  const ok = sigs.some((sig) => timingSafeEqualHex(sig, expected));
  if (!ok) throw new Error("No matching v1 signature");
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time hex string compare to prevent timing-leak attacks
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function findUserByCustomer(admin: ReturnType<typeof createClient>, customerId: string) {
  const { data } = await admin
    .from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.user_id ?? null;
}
