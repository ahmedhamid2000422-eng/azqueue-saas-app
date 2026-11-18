-- 0070 — know before the customers do
--
-- Customer check-in has broken twice in production. Both times the first
-- people to notice were customers standing in the office, and Mohamed heard
-- about it from them, in front of clients. That is the actual problem — worse
-- than either bug, and the reason he is losing confidence in the system.
--
-- Both outages were invisible to anyone signed in:
--   Sept — anon INSERT policy still required source = 'walk' after 0054
--          widened the column.
--   Nov  — 0060 removed anon SELECT; .insert().select() needs it for
--          RETURNING, so the row was written and the read-back refused.
--
-- A monitor using the service role would have passed through both. The
-- health-check function therefore runs with the ANON key: it has to be as
-- powerless as a customer, or it is not testing the thing that breaks.

create table if not exists public.health_checks (
  id         bigserial primary key,
  ok         boolean not null,
  steps      jsonb   not null,
  checked_at timestamptz not null default now()
);

create index if not exists health_checks_recent_idx
  on public.health_checks(checked_at desc);

comment on table public.health_checks is
  'One row per health-check run. Written by the health-check edge function, which exercises check-in as an anonymous visitor every five minutes.';

alter table public.health_checks enable row level security;

/* Owners and staff can read it; nothing writes here except the function,
   which uses the service role and bypasses RLS. */
drop policy if exists health_checks_read on public.health_checks;
create policy health_checks_read on public.health_checks
  for select to authenticated using (true);

-- ── Retention ────────────────────────────────────────────────────────
create or replace function public.prune_health_checks()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.health_checks where checked_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── Schedule ─────────────────────────────────────────────────────────
create extension if not exists pg_cron;

do $$ begin perform cron.unschedule('health-check'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('prune-health-checks'); exception when others then null; end $$;

/* Every five minutes. Frequent enough that a Monday-morning outage is caught
   before the queue builds; infrequent enough to be trivial load. */
select cron.schedule('health-check', '*/5 * * * *',
                     $$select public.call_edge_function('health-check', null)$$);

select cron.schedule('prune-health-checks', '45 3 * * *',
                     'select public.prune_health_checks()');

-- ── A view for "is it up, and has it been?" ──────────────────────────
create or replace view public.health_summary as
select
  (seq.day at time zone 'America/Denver')::date      as day,
  count(*)                                           as checks,
  count(*) filter (where h.ok)                       as passed,
  count(*) filter (where not h.ok)                   as failed,
  round(100.0 * count(*) filter (where h.ok) / nullif(count(*), 0), 1) as pct_up
from public.health_checks h
cross join lateral (select h.checked_at as day) seq
group by 1
order by 1 desc;

comment on view public.health_summary is
  'Daily uptime of customer check-in, measured as an anonymous visitor.';
