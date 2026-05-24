-- AzQueue · 0007 — Stripe billing
-- Run AFTER 0006.
--
-- Tracks Stripe customer IDs + active subscriptions per user.
-- The stripe-webhook edge function maintains this table on every Stripe event.
-- The user's tier (in auth.users.user_metadata.tier) is the source of truth
-- for feature gating; this table is the source of truth for billing state.

create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id   text unique,
  stripe_subscription_id text,
  status               text not null default 'inactive',
  tier                 text not null default 'essential',
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx     on public.subscriptions(stripe_customer_id);
create index if not exists subscriptions_subscription_idx on public.subscriptions(stripe_subscription_id);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute procedure set_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_self on public.subscriptions;
create policy subscriptions_self on public.subscriptions for select using (user_id = auth.uid());
