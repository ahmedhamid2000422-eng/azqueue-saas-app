-- 0051 — benchmark participation, opt-in
--
-- WHY THIS EXISTS BEFORE THE FEATURE DOES
-- Eventually AzQueue can tell a business "your wait is longer than most
-- clinics your size". That is real value nobody can get alone — but it means
-- using one customer's data to serve another, and the promise made to every
-- business so far is that they see only their own.
--
-- So the consent has to exist BEFORE any such comparison is ever computed.
-- Asking afterwards is asking permission for something already done.
--
-- THE RULES THIS COLUMN ENFORCES
-- 1. Default OFF. Nobody is opted in by signing up.
-- 2. Aggregates only, never anything traceable to one business. A comparison
--    group must contain at least MIN_BENCHMARK_BRANCHES businesses (see
--    src/lib/features.js) or it must not be shown at all — a "benchmark"
--    drawn from two branches identifies both.
-- 3. Reciprocal: only businesses that contribute can see benchmarks. That is
--    what makes it an exchange rather than extraction.
-- 4. Revocable at any time, and revoking takes effect immediately for future
--    calculations.

alter table public.branches
  add column if not exists benchmark_opt_in     boolean not null default false,
  add column if not exists benchmark_opt_in_at  timestamptz,
  add column if not exists benchmark_category   text;

comment on column public.branches.benchmark_opt_in is
  'Whether this branch contributes anonymised aggregates to cross-business benchmarks, and may see them in return. Default false — never enabled without an explicit choice.';
comment on column public.branches.benchmark_opt_in_at is
  'When the choice was made. Kept so it can be shown back to the business: "you turned this on in March".';
comment on column public.branches.benchmark_category is
  'Self-declared comparison group — tax, clinic, salon, government. Comparing a tax office to a barber is worse than no comparison at all.';

create index if not exists branches_benchmark_idx
  on public.branches(benchmark_category)
  where benchmark_opt_in = true;
