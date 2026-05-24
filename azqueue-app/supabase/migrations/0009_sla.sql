-- =====================================================================
-- AzQueue · 0009 — station-level SLA + escalation
-- Additive only. Zero changes to any existing table.
-- Requires: 0008_stations.sql
-- =====================================================================
--
-- MIGRATION SAFETY NOTES:
--   - Both tables are brand new. No existing table is touched.
--   - escalations.ticket_id FK on tickets briefly locks tickets to
--     validate; on a small table this is milliseconds.
--   - The sweep function (run client-side) uses an index on
--     tickets(branch_id, status, created_at) which already exists
--     from 0001_init.sql (tickets_created_idx). No new index needed.
--   - Feature flag ops_sla defaults OFF; sweep never runs until enabled.

-- ── 1. SLA policies ──────────────────────────────────────────────────
-- One policy per branch (null = branch-wide default).
-- target_secs: show amber warning dot on task card
-- breach_secs: show red dot + manager nudge
-- enabled:     defaults false — sweep checks this before doing anything
create table if not exists public.sla_policies (
  id           uuid primary key default uuid_generate_v4(),
  branch_id    uuid not null references public.branches(id) on delete cascade,
  target_secs  integer not null default 600,     -- warn at 10 min
  breach_secs  integer not null default 900,     -- breach at 15 min
  enabled      boolean not null default false,   -- SAFE OFF by default
  created_at   timestamptz not null default now(),
  unique (branch_id)                             -- one policy per branch for now
);

create index if not exists sla_policies_branch_idx on public.sla_policies(branch_id);

-- ── 2. Escalations ────────────────────────────────────────────────────
-- Records a breach/warning on a TASK at a STATION.
-- There is NO user_id column here. Not now, not ever.
-- "Who was slow?" -> "No person; here is the overloaded station."
create table if not exists public.escalations (
  id           uuid primary key default uuid_generate_v4(),
  ticket_id    uuid not null references public.tickets(id) on delete cascade,
  station_id   uuid references public.stations(id) on delete set null,
  level        text not null default 'warning'
               check (level in ('warning', 'breach')),
  reason       text not null default 'time_exceeded',
  resolved_at  timestamptz,   -- null = open; set when manager resolves
  created_at   timestamptz not null default now()
);

-- Sweep reads open escalations per ticket — this index keeps it O(1)
create index if not exists escalations_ticket_open_idx
  on public.escalations(ticket_id) where resolved_at is null;

create index if not exists escalations_station_open_idx
  on public.escalations(station_id, created_at desc) where resolved_at is null;

-- ── 3. RLS ────────────────────────────────────────────────────────────
alter table public.sla_policies  enable row level security;
alter table public.escalations   enable row level security;

-- SLA policies: branch owner/staff full access
create policy "sla_policies_branch_rw" on public.sla_policies
  for all
  using (
    branch_id in (
      select id from public.branches where owner_id = auth.uid()
      union
      select branch_id from public.staff where user_id = auth.uid()
    )
  );

-- Escalations: branch members can read + update (resolve); insert via sweep only
create policy "escalations_branch_read" on public.escalations
  for select
  using (
    ticket_id in (
      select id from public.tickets
      where branch_id in (
        select id from public.branches where owner_id = auth.uid()
        union
        select branch_id from public.staff where user_id = auth.uid()
      )
    )
  );

create policy "escalations_branch_resolve" on public.escalations
  for update
  using (
    ticket_id in (
      select id from public.tickets
      where branch_id in (
        select id from public.branches where owner_id = auth.uid()
        union
        select branch_id from public.staff where user_id = auth.uid()
      )
    )
  );

create policy "escalations_branch_insert" on public.escalations
  for insert
  with check (
    ticket_id in (
      select id from public.tickets
      where branch_id in (
        select id from public.branches where owner_id = auth.uid()
        union
        select branch_id from public.staff where user_id = auth.uid()
      )
    )
  );
