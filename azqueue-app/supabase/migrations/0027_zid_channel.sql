-- =====================================================================
-- AzQueue · 0027 — Zid e-commerce channel
-- Widens existing check constraints to allow 'zid' + order event types.
-- Adds a customer identity column and a small product/inventory table.
-- Requires: 0011_customers.sql, 0012_messaging.sql
-- =====================================================================
--
-- WHAT THIS ADDS:
--   1. 'zid' as a valid channel_connections.channel value
--      (so the OAuth connection itself can be stored/displayed)
--   2. 'zid' as a valid customer_events.channel value
--   3. 'order_placed', 'order_fulfilled', 'order_cancelled' as valid
--      customer_events.event_type values (Zid orders land here)
--   4. customers.zid_id — Zid customer ID, mirrors freshdesk_id, used
--      for identity matching so re-running the sync doesn't duplicate
--   5. zid_products — a small catalog/inventory snapshot table. Products
--      aren't a "customer touchpoint" like tickets/orders are, so they
--      don't fit customer_events — they get their own table instead.
--
-- The original check constraints in 0011/0012 were declared inline
-- without explicit names, so Postgres auto-named them following its
-- default convention (<table>_<column>_check). We look the actual name
-- up dynamically (rather than hard-coding a guess) so this migration
-- can't silently no-op if that naming assumption is ever wrong.

-- ── 1. channel_connections.channel ─────────────────────────────────────
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.channel_connections'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%freshdesk%';
  if con_name is not null then
    execute format('alter table public.channel_connections drop constraint %I', con_name);
  end if;
end $$;

alter table public.channel_connections
  add constraint channel_connections_channel_check
  check (channel in ('facebook', 'instagram', 'whatsapp', 'email', 'freshdesk', 'zid'));

-- ── 2. customer_events.channel ───────────────────────────────────────
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.customer_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%freshdesk%'
    and pg_get_constraintdef(oid) ilike '%queue%';
  if con_name is not null then
    execute format('alter table public.customer_events drop constraint %I', con_name);
  end if;
end $$;

alter table public.customer_events
  add constraint customer_events_channel_check
  check (channel in ('queue', 'facebook', 'instagram', 'whatsapp', 'email', 'freshdesk', 'manual', 'zid'));

-- ── 3. customer_events.event_type ────────────────────────────────────
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.customer_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%ticket_resolve%';
  if con_name is not null then
    execute format('alter table public.customer_events drop constraint %I', con_name);
  end if;
end $$;

alter table public.customer_events
  add constraint customer_events_event_type_check
  check (event_type in (
    'message',
    'queue_join', 'queue_serve', 'queue_complete',
    'ticket_open', 'ticket_resolve',
    'order_placed', 'order_fulfilled', 'order_cancelled',
    'note'
  ));

-- ── 4. customers.zid_id ─────────────────────────────────────────────
alter table public.customers
  add column if not exists zid_id text;

create index if not exists customers_zid_id_idx
  on public.customers(branch_id, zid_id)
  where zid_id is not null;

-- ── 5. Zid products / inventory snapshot ───────────────────────────
-- One row per Zid product per branch. Re-synced in place (upsert),
-- not a timeline — this is "current state of the catalog", not events.
create table if not exists public.zid_products (
  id              uuid primary key default uuid_generate_v4(),
  branch_id       uuid not null references public.branches(id) on delete cascade,
  zid_product_id  text not null,
  name            text,
  sku             text,
  price           numeric,
  stock_qty       integer,
  raw             jsonb,       -- full Zid product payload, for anything not modeled above
  synced_at       timestamptz not null default now(),
  unique (branch_id, zid_product_id)
);

create index if not exists zid_products_branch_idx
  on public.zid_products(branch_id);

alter table public.zid_products enable row level security;

create policy "zid_products_branch_rw" on public.zid_products
  for all
  using (
    branch_id in (
      select id from public.branches where owner_id = auth.uid()
      union
      select branch_id from public.staff where user_id = auth.uid()
    )
  );
