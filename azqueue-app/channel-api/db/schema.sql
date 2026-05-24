-- =====================================================================
-- AzQueue Channel API — supplemental schema
-- Run AFTER the Supabase migrations (0001–0012).
-- These two tables live in the same Supabase project but are owned
-- by the channel-api service (service-role access only).
-- =====================================================================

-- ── 1. Enrichment cache ───────────────────────────────────────────────
-- Caches LLM-generated customer enrichment results.
-- Keyed by customer_id. TTL enforced in application code (default 24h).
-- Avoids calling the LLM on every profile load.
create table if not exists public.enrich_cache (
  customer_id   uuid primary key references public.customers(id) on delete cascade,
  summary       text,
  sentiment     text check (sentiment in ('positive', 'neutral', 'negative', 'frustrated')),
  key_issues    text[]   not null default '{}',
  recommended_action text,
  model         text     not null default 'claude-haiku-4-5-20251001',
  generated_at  timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '24 hours')
);

create index if not exists enrich_cache_expires_idx
  on public.enrich_cache(expires_at);

-- ── 2. Webhook log ─────────────────────────────────────────────────────
-- Raw inbound webhook payloads from all channels.
-- Useful for debugging, replay, and audit.
-- Pruned by a scheduled job after 30 days.
create table if not exists public.webhook_log (
  id          uuid primary key default uuid_generate_v4(),
  channel     text not null
              check (channel in ('facebook','instagram','whatsapp','email','freshdesk','manual')),
  branch_id   uuid references public.branches(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  event_type  text,
  payload     jsonb not null,
  processed   boolean not null default false,
  error       text,
  received_at timestamptz not null default now()
);

create index if not exists webhook_log_channel_idx
  on public.webhook_log(channel, received_at desc);

create index if not exists webhook_log_branch_idx
  on public.webhook_log(branch_id, received_at desc)
  where branch_id is not null;

-- Auto-prune after 30 days (run via pg_cron or a nightly job)
-- DELETE FROM public.webhook_log WHERE received_at < now() - interval '30 days';

-- ── 3. RLS — service-role only ────────────────────────────────────────
-- The channel-api server uses the Supabase service_role key and bypasses RLS.
-- These policies prevent accidental frontend access.
alter table public.enrich_cache enable row level security;
alter table public.webhook_log  enable row level security;

-- No frontend access — channel-api service role bypasses RLS automatically.
-- Uncomment to allow staff to read enrichment results via frontend:
-- create policy "enrich_cache_staff_read" on public.enrich_cache
--   for select using (
--     customer_id in (
--       select id from public.customers
--       where branch_id in (
--         select id from public.branches where owner_id = auth.uid()
--         union
--         select branch_id from public.staff where user_id = auth.uid()
--       )
--     )
--   );
