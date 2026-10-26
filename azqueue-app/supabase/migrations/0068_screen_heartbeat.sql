-- 0068 — was the queue screen actually open?
--
-- THE QUESTION NO QUERY COULD ANSWER
-- 15 October: ten tickets, every one closed by cron. 17 October: ten tickets,
-- none. Same volume, two days apart, opposite outcomes. Several rounds of
-- analysis failed to explain it, because the database records what was
-- CLICKED and has no idea whether anyone was LOOKING.
--
-- The same gap makes the weekday denominators unresolvable. Over 90 days
-- Tuesday had check-ins on 8 of 13 calendar Tuesdays. Was the office shut on
-- the other five, or open with nobody using the system? Monday reads as 15.8
-- per calendar day or 18.6 per active day depending on which you believe, and
-- that difference propagates into every staffing scenario.
--
-- A heartbeat separates "closed" from "not recorded" directly, instead of by
-- inference.
--
-- WHAT IT IS NOT
-- Not staff monitoring. It records that a DEVICE had a page open — no user,
-- no keystrokes, no idle detection, no per-person activity. The question is
-- whether the tool was in use, not whether a person was working. Anything
-- finer would be surveillance of Mohamed and Benyamin, which is not something
-- this product should collect.

create table if not exists public.screen_heartbeats (
  id         bigserial primary key,
  branch_id  uuid not null references public.branches(id) on delete cascade,

  /* Which screen. The queue page and the TV answer different questions:
     a TV running all day with no queue page open is a waiting room nobody is
     serving. */
  surface    text not null check (surface in ('queue', 'tv', 'kiosk', 'overview')),

  /* Stable per browser, from localStorage. Not a user, not a person —
     deliberately anonymous so this cannot become attendance tracking. */
  device_key text not null,

  seen_at    timestamptz not null default now()
);

/* The only query shape this serves: "which minutes of which day did branch X
   have surface Y open". */
create index if not exists screen_heartbeats_lookup_idx
  on public.screen_heartbeats(branch_id, surface, seen_at desc);

comment on table public.screen_heartbeats is
  'One row per device per minute while a screen is open. Separates "office closed" from "system not used" — a distinction no other table can make. Device-level only, never per-person.';

alter table public.screen_heartbeats enable row level security;

drop policy if exists screen_heartbeats_write on public.screen_heartbeats;
create policy screen_heartbeats_write on public.screen_heartbeats
  for insert to authenticated
  with check (user_belongs_to_branch(branch_id));

drop policy if exists screen_heartbeats_read on public.screen_heartbeats;
create policy screen_heartbeats_read on public.screen_heartbeats
  for select using (user_belongs_to_branch(branch_id));

/* The kiosk is not signed in, so it needs an anonymous insert path. Insert
   only — anon can never read these back. */
drop policy if exists screen_heartbeats_kiosk_write on public.screen_heartbeats;
create policy screen_heartbeats_kiosk_write on public.screen_heartbeats
  for insert to anon
  with check (surface = 'kiosk');

-- ── Retention ────────────────────────────────────────────────────────
-- A minute-resolution log grows fast and is worthless once summarised.
-- 60 days is enough to cover a season and answer "what happened that day".
create or replace function public.prune_screen_heartbeats()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.screen_heartbeats where seen_at < now() - interval '60 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

do $$ begin perform cron.unschedule('prune-screen-heartbeats');
exception when others then null; end $$;

select cron.schedule('prune-screen-heartbeats', '30 3 * * *',
                     'select public.prune_screen_heartbeats()');

-- ── Daily rollup: the answer, in one row per day ─────────────────────
create or replace view public.screen_activity_daily as
select
  branch_id,
  (seen_at at time zone 'America/Denver')::date          as day,
  surface,
  count(distinct date_trunc('minute', seen_at))          as minutes_open,
  min(seen_at at time zone 'America/Denver')             as first_seen,
  max(seen_at at time zone 'America/Denver')             as last_seen,
  count(distinct device_key)                             as devices
from public.screen_heartbeats
group by 1, 2, 3;

comment on view public.screen_activity_daily is
  'Minutes each surface was open per day. Join against ticket counts to tell a closed day from an unrecorded one.';
