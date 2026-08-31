-- 0045 — imported client history
--
-- CONTEXT
-- Az Tax ran on Qminder before AzQueue. That history (9,308 clients, 17,752
-- visits) previously lived in a JSON file committed to public/, which meant
-- it was downloadable by anyone on the internet. It has been removed from the
-- repo; this migration gives it a proper home behind row-level security.
--
-- WHAT IS AND ISN'T IMPORTED
-- The export holds one row per PERSON — name, phone, visit count, first and
-- last visit — plus pre-computed hour/day/month totals. It does NOT contain
-- the individual visits. So imported counts are stored as columns on the
-- customer, and the aggregate charts are stored as-is. No per-ticket rows are
-- invented to fill the gap; a fabricated timestamp is worse than a missing one.
--
-- HOW IT ADDS UP
-- A person's displayed visit count is imported_visits + live AzQueue tickets.
-- Someone with 9 Qminder visits who came in last week shows 10, not two
-- separate records.

-- ── Imported counts on the customer ─────────────────────────────────
alter table public.customers
  add column if not exists imported_visits   integer     not null default 0,
  add column if not exists first_seen_at     timestamptz,
  add column if not exists imported_at       timestamptz,
  add column if not exists import_source     text;

comment on column public.customers.imported_visits is
  'Visits recorded in a previous system before this branch moved to AzQueue. Added to live ticket counts, never overwritten by them.';
comment on column public.customers.first_seen_at is
  'Earliest known visit, including visits from an imported system.';

create index if not exists customers_branch_imported_idx
  on public.customers(branch_id, imported_visits desc);

-- ── Aggregate history that has no per-row source ────────────────────
-- Hour/day/month totals from the old system. Stored as a single row per
-- branch because the underlying visits don't exist as rows to count.
create table if not exists public.branch_history_summary (
  branch_id     uuid primary key references public.branches(id) on delete cascade,
  source        text        not null,              -- e.g. 'qminder'
  total_visits  integer     not null default 0,
  unique_people integer     not null default 0,
  range_from    date,
  range_to      date,
  hours         jsonb,                             -- {"labels":[...],"values":[...]}
  days          jsonb,
  months        jsonb,
  imported_at   timestamptz not null default now()
);

alter table public.branch_history_summary enable row level security;

-- Same rule as everything else: you see your own branch, nobody else's.
drop policy if exists "history readable by branch members" on public.branch_history_summary;
create policy "history readable by branch members"
  on public.branch_history_summary for select
  using (public.user_belongs_to_branch(branch_id));

drop policy if exists "history writable by branch members" on public.branch_history_summary;
create policy "history writable by branch members"
  on public.branch_history_summary for all
  using (public.user_belongs_to_branch(branch_id))
  with check (public.user_belongs_to_branch(branch_id));
