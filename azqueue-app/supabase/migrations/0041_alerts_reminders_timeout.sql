-- ═══════════════════════════════════════════════════════════════════
-- AzQueue · Branch alerts, position reminders, turn timeout
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Adds:
--   1. branch_alerts       — broadcast messages shown on TV displays
--   2. tickets.near_front_notified_at — so the "3 away" reminder fires once
--   3. tickets.turn_expires_at        — 30-minute window after being called
--   4. expire_called_tickets()        — auto-cancels tickets that timed out
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Broadcast alerts ────────────────────────────────────────────
create table if not exists public.branch_alerts (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  message     text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '15 minutes'),
  cleared_at  timestamptz
);

create index if not exists branch_alerts_active_idx
  on public.branch_alerts (branch_id, expires_at desc)
  where cleared_at is null;

alter table public.branch_alerts enable row level security;

drop policy if exists branch_alerts_staff_manage on public.branch_alerts;
drop policy if exists branch_alerts_public_read  on public.branch_alerts;

-- Staff and owners of the branch can create/clear alerts
create policy branch_alerts_staff_manage
  on public.branch_alerts for all
  using      (user_belongs_to_branch(branch_id))
  with check (user_belongs_to_branch(branch_id));

-- TV displays are public (no auth), so anon must be able to read active alerts
create policy branch_alerts_public_read
  on public.branch_alerts for select
  to anon, authenticated
  using (cleared_at is null and expires_at > now());

-- ── 2 & 3. Ticket columns ──────────────────────────────────────────
alter table public.tickets
  add column if not exists near_front_notified_at timestamptz,
  add column if not exists turn_expires_at        timestamptz;

comment on column public.tickets.near_front_notified_at is
  'Set when the "you are 3 away" reminder was sent, so it only fires once.';
comment on column public.tickets.turn_expires_at is
  'When a called ticket auto-cancels if the customer never shows.';

-- ── 4. Auto-cancel timed-out turns ─────────────────────────────────
create or replace function public.expire_called_tickets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.tickets
  set status       = 'cancelled',
      completed_at = now()
  where status = 'serving'
    and turn_expires_at is not null
    and turn_expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.expire_called_tickets() to anon, authenticated;

-- Run every minute so a no-show frees the counter promptly.
-- (pg_cron was enabled by the auto-expire migration; safe to re-run.)
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('expire-called-tickets');
exception when others then
  null;  -- job didn't exist yet
end $$;

select cron.schedule(
  'expire-called-tickets',
  '* * * * *',
  'select public.expire_called_tickets()'
);

-- Publish new table for realtime so TV displays get alerts instantly
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'branch_alerts'
  ) then
    alter publication supabase_realtime add table public.branch_alerts;
  end if;
end $$;
alter table public.branch_alerts replica identity full;

select 'alerts + reminders + timeout installed' as status;
