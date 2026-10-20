-- 0067 — completed_at means "a visit ended", and nothing else
--
-- THE RECURRING BUG
-- `completed_at` reads like "this row is finished" rather than "this visit
-- ended", so five separate code paths have used it as a generic closed-at:
--
--   expire_stale_tickets()      nightly cron      fixed in 0056
--   expire_called_tickets()     per-minute cron   fixed in 0065
--   Queue.jsx cancelTicket      staff cancel      fixed here
--   StaffQueue.jsx noShow       staff no-show     fixed here
--   useQueue.js noShow          staff no-show     fixed here
--
-- Each one invented a service duration for somebody who was never served,
-- and each was found separately, months apart, by noticing an impossible
-- statistic. This migration fixes the data and adds a constraint so the next
-- instance fails loudly instead of silently.
--
-- IT ALSO EXPLAINS THE 202 vs 259 DISCREPANCY
-- One report counted status='completed' (202), another counted
-- completed_at is not null (259). The 57 difference is exactly the walkouts,
-- which carry a completed_at from the paths above. 202 + 57 = 259. Not two
-- definitions — one bug.

-- ── 1. Audit table, so the repair is reversible and inspectable ──────
create table if not exists public.ticket_timestamp_audit (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.tickets(id) on delete cascade,
  migration      text not null,
  field          text not null,
  previous_value timestamptz,
  new_value      timestamptz,
  reason         text not null,
  recorded_at    timestamptz not null default now()
);

create index if not exists ticket_timestamp_audit_ticket_idx
  on public.ticket_timestamp_audit(ticket_id);

alter table public.ticket_timestamp_audit enable row level security;

drop policy if exists ticket_timestamp_audit_read on public.ticket_timestamp_audit;
create policy ticket_timestamp_audit_read on public.ticket_timestamp_audit
  for select using (
    exists (select 1 from public.tickets t
            where t.id = ticket_id and user_belongs_to_branch(t.branch_id))
  );

comment on table public.ticket_timestamp_audit is
  'Every lifecycle timestamp a migration changed, with the previous value. Nothing here is derived — it is the record of what was altered and why.';

-- ── 2. Closure provenance, separate from outcome ─────────────────────
alter table public.tickets
  add column if not exists closed_by      text
    check (closed_by is null or closed_by in ('staff', 'customer', 'system')),
  add column if not exists closure_reason text,
  add column if not exists closed_at      timestamptz;

comment on column public.tickets.closed_by is
  'Who ended this ticket: staff | customer | system (cron). Independent of outcome — a system closure says nothing about what happened to the customer.';
comment on column public.tickets.closure_reason is
  'Why it closed. For system closures: turn_timeout | stale_sweep | queue_cleared. Null outcome with closed_by=system means UNKNOWN, not no-show.';

-- ── 3. Repair the 57 ─────────────────────────────────────────────────
-- Record first, change second. Status is NOT touched: there is no evidence
-- for what these customers actually did, and reclassifying them would be
-- inventing an outcome to replace an invented timestamp.

insert into public.ticket_timestamp_audit
  (ticket_id, migration, field, previous_value, new_value, reason)
select id, '0067', 'completed_at', completed_at, null,
       'Status is ' || status || ' — not served, so no completion time. '
       || 'Written by cancelTicket / noShow paths fixed in 0067.'
from public.tickets
where status in ('cancelled', 'no_show')
  and completed_at is not null;

update public.tickets
set completed_at = null,
    closed_at    = coalesce(closed_at, expired_at, completed_at),
    closed_by    = coalesce(closed_by,
                     case when expired_at is not null then 'system' else 'staff' end),
    closure_reason = coalesce(closure_reason, 'historical: ' || status)
where status in ('cancelled', 'no_show')
  and completed_at is not null;

-- ── 4. Backfill provenance for already-swept tickets ─────────────────
update public.tickets
set closed_by      = coalesce(closed_by, 'system'),
    closed_at      = coalesce(closed_at, expired_at),
    closure_reason = coalesce(closure_reason, 'historical: cron sweep')
where expired_at is not null
  and closed_by is null;

-- ── 5. Stop it happening again ───────────────────────────────────────
-- A ticket cannot hold a completion time unless it completed. This is the
-- part that turns a silent five-times-repeated bug into an immediate error.
alter table public.tickets
  drop constraint if exists tickets_completed_at_requires_completed;

alter table public.tickets
  add constraint tickets_completed_at_requires_completed
  check (completed_at is null or status = 'completed')
  not valid;   -- existing rows already repaired above; NOT VALID avoids a
               -- full-table rewrite and any row that slipped through still
               -- blocks future writes.

-- ── 6. Server-authoritative closure ──────────────────────────────────
-- Client clocks are not authoritative. This trigger stamps closed_at from
-- the database whenever a ticket moves to a terminal state without one.
create or replace function public.stamp_ticket_closure()
returns trigger language plpgsql as $$
begin
  if new.status in ('completed','cancelled','no_show')
     and (old.status is distinct from new.status)
     and new.closed_at is null then
    new.closed_at := now();
    if new.closed_by is null then
      new.closed_by := 'staff';
    end if;
  end if;
  /* Never let an already-set lifecycle timestamp be overwritten by a repeat
     click — the first value is the true one. */
  if old.completed_at is not null and new.completed_at is not null
     and new.completed_at <> old.completed_at then
    new.completed_at := old.completed_at;
  end if;
  if old.started_at is not null and new.started_at is not null
     and new.started_at <> old.started_at then
    new.started_at := old.started_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_ticket_closure on public.tickets;
create trigger trg_stamp_ticket_closure
  before update on public.tickets
  for each row execute function public.stamp_ticket_closure();

-- ── 7. Reconciliation, before and after ──────────────────────────────
select
  count(*) filter (where status = 'completed')                     as status_completed,
  count(*) filter (where completed_at is not null)                 as has_completed_at,
  count(*) filter (where status = 'completed' and completed_at is not null) as both,
  count(*) filter (where status in ('cancelled','no_show') and completed_at is not null) as still_wrong
from public.tickets
where is_test = false;
