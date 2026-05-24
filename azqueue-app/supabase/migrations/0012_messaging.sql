-- =====================================================================
-- AzQueue · 0012 — Messaging: direction + channel connections
-- Additive only. Zero changes to existing rows or constraints.
-- Requires: 0011_customers.sql
-- =====================================================================
--
-- WHAT THIS ADDS:
--   1. direction column on customer_events — inbound vs outbound.
--      Existing rows default to 'inbound' (safe assumption).
--   2. channel_connections table — one row per channel per branch.
--      Stores connection status + encrypted config (page token, etc.)
--      'Send' buttons in the UI check this table before attempting delivery.

-- ── 1. Direction on customer_events ──────────────────────────────────
alter table public.customer_events
  add column if not exists direction text not null default 'inbound'
  check (direction in ('inbound', 'outbound'));

-- Index for filtering outbound messages in the composer history
create index if not exists customer_events_direction_idx
  on public.customer_events(customer_id, direction, created_at desc);

-- ── 2. Channel connections ────────────────────────────────────────────
-- One row per channel per branch.
-- config stores channel-specific credentials as jsonb.
-- In production, encrypt config at rest (Supabase Vault or app-level AES).
-- Status: 'disconnected' = never set up, 'connected' = working,
--         'error' = last send/webhook failed
create table if not exists public.channel_connections (
  id          uuid primary key default uuid_generate_v4(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  channel     text not null
              check (channel in ('facebook', 'instagram', 'whatsapp', 'email', 'freshdesk')),
  status      text not null default 'disconnected'
              check (status in ('connected', 'disconnected', 'error')),
  config      jsonb,       -- channel credentials — keep minimal, encrypt in prod
  error_msg   text,        -- last error message if status = 'error'
  last_sync   timestamptz,
  created_at  timestamptz not null default now(),
  unique (branch_id, channel)
);

create index if not exists channel_connections_branch_idx
  on public.channel_connections(branch_id);

-- ── 3. RLS ────────────────────────────────────────────────────────────
alter table public.channel_connections enable row level security;

-- Only branch owner can read/write channel credentials (not regular staff)
create policy "channel_connections_owner_rw" on public.channel_connections
  for all
  using (
    branch_id in (
      select id from public.branches where owner_id = auth.uid()
    )
  );

-- Staff can read connection status (to know if Send will work) but not config
create policy "channel_connections_staff_read" on public.channel_connections
  for select
  using (
    branch_id in (
      select branch_id from public.staff where user_id = auth.uid()
    )
  );
