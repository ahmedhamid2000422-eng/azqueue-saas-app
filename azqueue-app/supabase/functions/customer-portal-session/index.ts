// Supabase Edge Function — opens the Stripe Customer Portal for the user.
//
// Deploy: supabase functions deploy customer-portal-session
// Returns: { url } — Stripe-hosted billing portal URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: "Unauthenticated" }, 401);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const appUrl    = Deno.env.get("APP_URL") ?? "https://azqueue.app";
  if (!stripeKey) {
    return json({ ok: false, dryRun: true, message: "Stripe not configured yet." });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: sub } = await admin
    .from("subscriptions").select("stripe_customer_id").eq("user_id", userData.user.id).maybeSingle();

  if (!sub?.stripe_customer_id) {
    return json({ error: "No Stripe customer for this account yet. Upgrade first." }, 400);
  }

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/business/settings`,
    }),
  });
  const session = await res.json();
  if (!session.url) return json({ error: "Could not open portal", details: session }, 500);

  return json({ ok: true, url: session.url });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    status,
  });
}
