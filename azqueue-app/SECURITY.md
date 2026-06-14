# AzQueue — Security & Privacy

A practical guide to what's safe to expose, what isn't, and how AzQueue
defends user data. This page is for you (the operator), not customers.
Customer-facing legal copy lives at `/legal/privacy` and `/legal/terms`.

## TL;DR

- **Your frontend code is public.** That's normal for any web app. Once
  deployed, anyone can View Source / inspect the JS bundle. There are no
  business secrets in it.
- **Your Supabase ANON key is public.** It's designed to be. Row Level
  Security (RLS) policies enforce who can read/write what, not the key.
- **Real secrets live in Supabase Edge Function secrets** — never in
  `.env`, never in the client bundle, never in your git repo.
- **Customer-facing pages are public on purpose** (check-in, ticket,
  booking, survey, display). They're locked down by RLS, rate limits,
  and database triggers — not by hiding URLs.

## Two kinds of "keys"

### Public, safe to expose

| Key | Where it lives | Why it's safe |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` → client bundle | Just a URL. |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` → client bundle | Auth requests are rate-limited and gated by RLS at the database. |
| Stripe publishable key (`pk_…`) | If used, in `.env.local` | Only useful for client-side Stripe Elements; cannot charge cards. |

These are not secrets. They appear in browser DevTools the moment a user
opens your site, and that is fine.

### Secret, never expose

| Key | Where it lives | Why it must stay hidden |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets (auto-injected) | Bypasses ALL row-level security. With this key, anyone can read/write any row. |
| `STRIPE_SECRET_KEY` (`sk_…`) | Supabase Edge Function secrets | Can charge cards, refund money, create customers. |
| `STRIPE_WEBHOOK_SECRET` (`whsec_…`) | Supabase Edge Function secrets | Used to verify Stripe webhook authenticity. Leak means forged subscription events. |
| `TWILIO_AUTH_TOKEN` | Supabase Edge Function secrets | Can send WhatsApp/SMS messages billed to you. |
| `ANTHROPIC_API_KEY` (`sk-ant-…`) | Supabase Edge Function secrets | Bills your account for every AI call. |

If any secret key is ever in a git commit, in `.env`, or in a `VITE_…`
variable: rotate it immediately in the provider's dashboard. Don't try to
delete the commit — assume it has been read.

## How to set secrets

```bash
# Once, to link your local CLI to the project
supabase login
supabase link --project-ref YOURPROJECT

# Then for each secret
supabase secrets set STRIPE_SECRET_KEY=sk_live_…
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…
supabase secrets set TWILIO_AUTH_TOKEN=…
supabase secrets set ANTHROPIC_API_KEY=sk-ant-…

# Verify (shows names, not values)
supabase secrets list

# Deploy functions so they pick up the new secrets
supabase functions deploy create-checkout-session
supabase functions deploy customer-portal-session
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy send-notification
supabase functions deploy ai-assist
supabase functions deploy admin-stats
```

## Why public-facing pages stay safe

Five customer-facing pages are intentionally accessible without auth:
`/q/:slug` (check-in), `/t/:id` (live ticket), `/b/:slug` (booking),
`/display/:slug` (TV wall), `/survey/:slug` (survey).

They're protected by:

1. **Row-Level Security policies.** Anon can only read branch names,
   service names, and their own ticket row. Anon can only insert tickets,
   bookings, surveys — with strict per-policy checks (status must equal
   "confirmed" for bookings; rating must be 1–5; service must exist;
   ticket must not already have a survey).

2. **Database-level rate limits.** Triggers in `0009_surveys_and_security.sql`
   refuse:
   - More than 5 ticket check-ins per phone per branch per 10 minutes
   - More than 3 bookings per phone per branch per day
   - More than 5 surveys per phone per branch per hour

3. **Field-update guard.** Anon can update GPS location columns on a
   ticket they have the UUID for, but a trigger blocks any attempt to
   change `status`, `token`, `staff_id`, `priority`, `customer_name`,
   `customer_phone`, or any timestamp. They cannot promote themselves
   from waiting to serving.

4. **Field-length constraints.** Phone capped at 32, name at 80,
   feedback at 1000 characters. No buffer-stuffing attacks.

5. **Unguessable identifiers.** Ticket IDs are UUIDs. Brute-forcing
   them is computationally infeasible.

## Webhook integrity

The Stripe webhook endpoint (`/functions/v1/stripe-webhook`) performs
real signature verification with `STRIPE_WEBHOOK_SECRET`:

- HMAC-SHA256 of `{timestamp}.{raw_body}` compared against `v1=` sigs
- Constant-time comparison to prevent timing-leak attacks
- Rejects timestamps older than 5 minutes (anti-replay)

Without a valid signature the function returns 400 and never touches the
database. Forging subscription events is not possible without the
webhook secret.

## What the platform admin can see

The `/admin` route is gated by `user_metadata.platform_admin = true`.
The `admin-stats` edge function double-checks this — even if someone
spoofed the client flag, the server-side check would reject them.

When you (the operator) view `/admin`, you see aggregated counts and a
recent-signups list. The function uses the service role to bypass RLS,
which is why the admin check is enforced both client-side and server-side.

## Data retention

- **Live tickets:** scoped to today (queries filter by `created_at >= todayStart`)
- **Customer location pings:** discarded the moment a ticket flips to `completed`
- **Account deletion:** processed within 30 days of request (mentioned in
  privacy policy at `/legal/privacy`)
- **Audit log:** Supabase keeps a separate, query-able auth log for sign-ins
  and admin actions. You can review it in the Supabase Dashboard.

## What to do if a secret leaks

1. **Rotate immediately** in the provider's dashboard (Stripe, Twilio,
   Anthropic, Supabase). This invalidates the old key.
2. **Update your Supabase secrets** with the new value.
3. **Redeploy the affected edge functions** so they pick up the change.
4. **Check provider logs** for unauthorised activity since the leak.
5. **Tell affected users** if customer data was at risk (this is a legal
   requirement under PDPA/GDPR for material breaches).

## Things deliberately not done (and why)

- **CAPTCHA on signup.** Adds friction; relies on Google. Email
  confirmation + rate limits cover most automated abuse for now.
- **Per-IP rate limiting in app code.** Supabase Edge handles this at
  infrastructure level. Rewriting it in Deno is brittle.
- **Encrypting customer phone numbers at rest.** Supabase encrypts the
  entire database at rest. Field-level encryption only matters for
  truly sensitive data (medical records, government IDs) which we don't
  handle.
- **Sentry / error monitoring.** Worth adding after first paying
  customers. Until then, browser DevTools is enough.

## Questions

If anything looks wrong or feels exposed, the answer is almost always:
**rotate the key, check git history, review RLS policies**. Email
security@azqueue.app to discuss anything sensitive in writing.
