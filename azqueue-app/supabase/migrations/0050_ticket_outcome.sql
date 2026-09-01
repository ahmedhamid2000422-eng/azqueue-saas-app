-- 0050 — how a visit ended
--
-- Completion used to be a silent side effect of pressing Call next, so two
-- things were never recorded:
--
--   * the last customer of the day was never completed at all, and their
--     visit was measured as lasting overnight — which skews the service-time
--     median that the wait estimator, Intel and the whole back-queue design
--     depend on;
--   * "we saw them and finished" and "they have to come back with a
--     document" looked identical in the data.
--
-- The second is the more valuable one. A visit that ends in missing
-- paperwork is a visit that has to happen AGAIN, in a queue that is already
-- the business's biggest problem. Nothing currently measures how often that
-- happens, so nobody can tell whether telling people what to bring in
-- advance would be worth the effort.
--
-- Safe to run any time: adds one nullable column.

alter table public.tickets
  add column if not exists outcome text;

comment on column public.tickets.outcome is
  'How the visit ended: done | needs_docs | passed_on. Null for tickets completed before this existed, and for handoffs (which are identified by handed_off_at instead).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickets_outcome_check') then
    alter table public.tickets
      add constraint tickets_outcome_check
      check (outcome is null or outcome in ('done', 'needs_docs', 'passed_on'));
  end if;
end $$;

-- "How often does a visit end with missing paperwork" is the question this
-- exists to answer, so make it cheap to ask.
create index if not exists tickets_outcome_idx
  on public.tickets(branch_id, outcome)
  where outcome is not null;
