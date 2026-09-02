-- 0055 — mark test check-ins so they never reach a statistic
--
-- WHY
-- The owner tests the live system daily, sometimes with realistic names and
-- phone numbers. Those rows are indistinguishable from customers, and they sit
-- in the same table every figure reads: the wait estimator, the alert
-- baselines, Intel, the arrival-channel split, the daily report.
--
-- The cost is not hypothetical. A day that looked like "6 people arrived at
-- 3pm and none were ever called" turned out to be a test session, and the
-- conclusion drawn from it — that the last hour of the day was being
-- abandoned — was entirely an artefact.
--
-- A number built partly from test rows is exactly what data-principles rule 5
-- exists to prevent: it claims a source it doesn't have.
--
-- HOW
-- Check in via ?test=1 and the ticket is marked. Every analytical query
-- filters it out. The default is false, so nothing that already exists
-- changes, and a real customer can never be marked by accident.

alter table public.tickets
  add column if not exists is_test boolean not null default false;

comment on column public.tickets.is_test is
  'True for check-ins made through ?test=1. Excluded from every statistic. Historic rows are false because they predate the flag — AzQueue-era figures before 2026-09-02 are known to be mixed and should not be trusted.';

-- Most analytical queries ask for "real tickets in a window", so the index
-- carries the flag rather than filtering after the fact.
create index if not exists tickets_real_idx
  on public.tickets(branch_id, created_at)
  where is_test = false;

-- The obvious tests from 1 September: Malaysian numbers on a Denver branch.
-- Deliberately narrow. Anything ambiguous is left alone — wrongly marking a
-- real customer as a test deletes a genuine visit from the record, which is
-- worse than leaving a known-dirty row in a period already flagged as dirty.
update public.tickets
   set is_test = true
 where customer_phone like '+60%'
   and is_test = false;
