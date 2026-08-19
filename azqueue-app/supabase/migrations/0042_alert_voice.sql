-- ═══════════════════════════════════════════════════════════════════
-- AzQueue · Spoken broadcast alerts
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Adds a per-alert flag so staff can choose whether a broadcast is also
-- read aloud on the TV display, or shown silently as a banner only.
-- ═══════════════════════════════════════════════════════════════════

alter table public.branch_alerts
  add column if not exists speak boolean not null default false;

comment on column public.branch_alerts.speak is
  'When true, TV displays read the message aloud once as well as showing the banner.';

select 'alert voice column installed' as status;
