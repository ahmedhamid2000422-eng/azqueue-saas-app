// Supabase Edge Function — creates a Stripe Checkout session for tier upgrades.
//
// Deploy:  supabase functions deploy create-checkout-session
// Secrets needed:
//   STRIPE_SECRET_KEY         — sk_live_… or sk_test_…
//   STRIPE_PRICE_ESSENTIAL    — price_… for the Essential tier
//   STRIPE_PRICE_PROFESSIONAL — price_… for Professional
//   STRIPE_PRICE_EXECUTIVE    — price_… for Executive
//   STRIPE_PRICE_MANAGER      — price_… for Manager
//   APP_URL                   — e.g. https://azqueue.app (for redirect URLs)
//
// Body:    { tier: "essential" | "professional" | "executive" | "manager" }
// Returns: { url } — the Stripe Checkout URL to redirect to

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRICE_BY_TIER: Record<string, string> = {
  essential:    "STRIPE_PRICE_ESSENTIAL",
  professional: "STRIPE_PRICE_PROFESSIONAL",
  executive:    "STRIPE_PRICE_EXECUTIVE",
  manager:      "STRIPE_PRICE_MANAGER",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // 1. Identify caller from JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthenticated" }, 401);
  const user = userData.user;

  // 2. Parse body
  let body: { tier?: string };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const tier = body.tier ?? "professional";
  const priceEnvKey = PRICE_BY_TIER[tier];
  if (!priceEnvKey) return json({ error: "Unknown tier" }, 400);

  const priceId = Deno.env.get(priceEnvKey);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const appUrl = Deno.env.get("APP_URL") ?? "https://azqueue.app";

  if (!stripeKey) {
    return json({
      ok: false,
      dryRun: true,
      message: "Stripe not configured yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_* secrets to enable.",
    });
  }
  if (!priceId) {
    return json({ error: `Missing price ID for ${tier}. Set ${priceEnvKey}.` }, 500);
  }

  // 3. Find or create the Stripe customer for this user
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: subRow } = await admin
    .from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();

  let customerId = subRow?.stripe_customer_id;
  if (!customerId) {
    const created = await stripe(stripeKey, "/v1/customers", {
      email: user.email ?? "",
      "metadata[user_id]": user.id,
    });
    if (!created.id) return json({ error: "Could not create Stripe customer", details: created }, 500);
    customerId = created.id;

    await admin.from("subscriptions").upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      status: "inactive",
      tier: "essential",
    });
  }

  // 4. Create the Checkout session
  const params: Record<string, string> = {
    "mode": "subscription",
    "customer": customerId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "success_url": `${appUrl}/business/settings?upgraded=1`,
    "cancel_url":  `${appUrl}/business/settings?upgraded=0`,
    "metadata[user_id]": user.id,
    "metadata[tier]": tier,
    "subscription_data[metadata][user_id]": user.id,
    "subscription_data[metadata][tier]": tier,
  };
  const session = await stripe(stripeKey, "/v1/checkout/sessions", params);
  if (!session.url) return json({ error: "Could not create checkout", details: session }, 500);

  return json({ ok: true, url: session.url });
});

async function stripe(key: string, path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return res.json();
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    status,
  });
}
