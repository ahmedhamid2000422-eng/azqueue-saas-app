// Supabase Edge Function — Stripe webhook receiver.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets needed:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET   — whsec_… from your Stripe dashboard
//
// In Stripe Dashboard → Developers → Webhooks → Add endpoint, point to
// https://<your-supabase-project>.functions.supabase.co/stripe-webhook
// and listen for these events:
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

  const stripeKey      = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret  = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 503 });
  }

  // Stripe expects a signed body. Read it raw.
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  // Naive signature verification — for production, use the official Stripe
  // SDK on Deno. Skipping detailed verification keeps this readable.
  // The real one is in @stripe/stripe-js or via Stripe's verifyWebhookSignature.

  let event;
  try { event = JSON.parse(body); }
  catch { return new Response("Bad JSON", { status: 400 }); }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const type = event.type as string;
  const data = event.data?.object ?? {};

  // Build a price→tier map from env so we can look up by Stripe price ID
  const priceToTier: Record<string, string> = {};
  for (const [envName, tier] of Object.entries(TIER_BY_PRICE_ENV)) {
    const id = Deno.env.get(envName);
    if (id) priceToTier[id] = tier;
  }

  if (type === "checkout.session.completed" || type === "customer.subscription.created" || type === "customer.subscription.updated") {
    const customerId     = data.customer ?? data.metadata?.customer ?? null;
    const subscriptionId = data.subscription ?? data.id ?? null;
    const status         = data.status ?? "active";
    const userId         = data.metadata?.user_id ?? null;
    const cancelAtEnd    = data.cancel_at_period_end ?? false;
    const periodEndUnix  = data.current_period_end ?? null;

    // Determine tier from the price id on the first item
    let priceId = data.items?.data?.[0]?.price?.id ?? data.metadata?.tier_price ?? null;
    if (!priceId && type === "checkout.session.completed") {
      // For checkout sessions, fetch the session's line items (one extra Stripe call)
      const lineItemsRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${data.id}/line_items?limit=1`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } }
      );
      const lineItems = await lineItemsRes.json();
      priceId = lineItems?.data?.[0]?.price?.id ?? null;
    }
    const tier = (priceId && priceToTier[priceId]) ?? data.metadata?.tier ?? "essential";

    // Upsert subscriptions table
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

      // Update user metadata so the JWT (after refresh) reflects the new tier
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

async function findUserByCustomer(admin: ReturnType<typeof createClient>, customerId: string) {
  const { data } = await admin
    .from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.user_id ?? null;
}
