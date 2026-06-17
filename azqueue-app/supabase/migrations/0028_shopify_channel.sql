-- =====================================================================
-- AzQueue · 0028 — Shopify e-commerce channel
-- Widens existing check constraints to allow 'shopify'.
-- Adds a customer identity column and a small product/inventory table.
-- Requires: 0011_customers.sql, 0012_messaging.sql, 0027_zid_channel.sql
--   (0027 already added the order_placed/order_fulfilled/order_cancelled
--    event types — Shopify orders reuse those, no new event types needed)
-- =====================================================================
--
-- WHAT THIS ADDS:
--   1. 'shopify' as a valid channel_connections.channel value
--   2. 'shopify' as a valid customer_events.channel value
--   3. customers.shopify_id — mirrors freshdesk_id / zid_id
--   4. shopify_products — catalog/inventory snapshot, same shape as
--      zid_products. Kept as its own table rather than merged with
--      zid_products: a branch could plausibly run Zid AND Shopify at
--      once, and the two platforms' product IDs aren't comparable.
--
-- Same dynamic constraint-name lookup approach as 0027 (the original
-- constraints were declared inline with no explicit name, so Postgres
-- auto-generated one — rather than guess it, look it up by definition).

-- ── 1. channel_connections.channel ─────────────────────────────────────
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.channel_connections'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%zid%';
  if con_name is not null then
    execute format('alter table public.channel_connections drop constraint %I', con_name);
  end if;
end $$;

alter table public.channel_connections
  add constraint channel_connections_channel_check
  check (channel in ('facebook', 'instagram', 'whatsapp', 'email', 'freshdesk', 'zid', 'shopify'));

-- ── 2. customer_events.channel ───────────────────────────────────────
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.customer_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%zid%'
    and pg_get_constraintdef(oid) ilike '%queue%';
  if con_name is not null then
    execute format('alter table public.customer_events drop constraint %I', con_name);
  end if;
end $$;

alter table public.customer_events
  add constraint customer_events_channel_check
  check (channel in ('queue', 'facebook', 'instagram', 'whatsapp', 'email', 'freshdesk', 'manual', 'zid', 'shopify'));

-- ── 3. customers.shopify_id ─────────────────────────────────────────
alter table public.customers
  add column if not exists shopify_id text;

create index if not exists customers_shopify_id_idx
  on public.customers(branch_id, shopify_id)
  where shopify_id is not null;

-- ── 4. Shopify products / inventory snapshot ───────────────────────
create table if not exists public.shopify_products (
  id                  uuid primary key default uuid_generate_v4(),
  branch_id           uuid not null references public.branches(id) on delete cascade,
  shopify_product_id  text not null,
  name                text,
  sku                 text,
  price               numeric,
  stock_qty           integer,
  raw                 jsonb,
  synced_at           timestamptz not null default now(),
  unique (branch_id, shopify_product_id)
);

create index if not exists shopify_products_branch_idx
  on public.shopify_products(branch_id);

alter table public.shopify_products enable row level security;

create policy "shopify_products_branch_rw" on public.shopify_products
  for all
  using (
    branch_id in (
      select id from public.branches where owner_id = auth.uid()
      union
      select branch_id from public.staff where user_id = auth.uid()
    )
  );
