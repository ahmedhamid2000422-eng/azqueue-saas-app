-- =====================================================================
-- AzQueue · stations + least-loaded task routing
-- Additive only — nothing existing is modified.
-- Run in Supabase SQL editor or via `supabase db push`.
-- =====================================================================

-- ── 1. Stations ───────────────────────────────────────────────────────
-- A station is a place/counter/role that does work.
-- It is NOT a person. Do not conflate with the staff table.
create table if not exists public.stations (
  id           uuid primary key default uuid_generate_v4(),
  branch_id    uuid not null references public.branches(id) on delete cascade,
  name         text not null,
  status       text not null default 'active'
               check (status in ('active','paused','offline')),
  pause_reason text,   -- 'break' | 'prayer' | 'maintenance' | null
                       -- CURRENT operational state only.
                       -- NEVER log history here — that would build a break record.
  created_at   timestamptz not null default now()
);

create index if not exists stations_branch_idx on public.stations(branch_id);

-- ── 2. Nullable FK on tickets ─────────────────────────────────────────
-- Old clients that never read this column keep working untouched.
alter table public.tickets
  add column if not exists assigned_station_id uuid
    references public.stations(id) on delete set null;

create index if not exists tickets_station_idx on public.tickets(assigned_station_id);

-- ── 3. Station events — system-level telemetry ───────────────────────
-- Keyed on STATION, not person.
-- RETENTION RULE: aggregate only at station/shift level.
-- Do NOT join back to staff to build a per-person history.
-- Suggested retention: 90 days (enforce via pg_cron or Supabase scheduled function).
create table if not exists public.station_events (
  id          bigserial primary key,
  station_id  uuid not null references public.stations(id) on delete cascade,
  ticket_id   uuid references public.tickets(id) on delete set null,
  event_type  text not null
              check (event_type in ('assigned','completed','paused','resumed')),
  created_at  timestamptz not null default now()
);

create index if not exists station_events_station_idx
  on public.station_events(station_id, created_at desc);

-- ── 4. Routing RPC ────────────────────────────────────────────────────
-- Atomically assigns the next unrouted waiting ticket to the
-- least-loaded active station. Returns the ticket id assigned,
-- or null if no active stations / no unrouted tickets.
--
-- Routing rule (deterministic, not AI):
--   1. Active stations only (status = 'active').
--   2. Lowest count of currently in-progress assigned tickets.
--   3. Tie-break: oldest station first (round-robin effect over time).
--   4. Paused/offline stations are skipped entirely.
create or replace function public.route_next_ticket(p_branch_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_station_id uuid;
  v_ticket_id  uuid;
begin
  -- Find least-loaded active station
  select s.id into v_station_id
  from public.stations s
  left join public.tickets t
    on  t.assigned_station_id = s.id
    and t.branch_id = p_branch_id
    and t.status in ('waiting', 'serving')
  where s.branch_id = p_branch_id
    and s.status    = 'active'
  group by s.id
  order by count(t.id) asc, s.created_at asc
  limit 1;

  if v_station_id is null then
    return null; -- no active stations
  end if;

  -- Find oldest unrouted waiting ticket (priority desc, then arrival order)
  select id into v_ticket_id
  from public.tickets
  where branch_id          = p_branch_id
    and status             = 'waiting'
    and assigned_station_id is null
  order by priority desc, created_at asc
  limit 1;

  if v_ticket_id is null then
    return null; -- nothing to route
  end if;

  -- Atomic assignment
  update public.tickets
     set assigned_station_id = v_station_id
   where id = v_ticket_id;

  -- Emit telemetry (station-level, not person-level)
  insert into public.station_events (station_id, ticket_id, event_type)
    values (v_station_id, v_ticket_id, 'assigned');

  return v_ticket_id;
end $$;

-- ── 5. RLS ────────────────────────────────────────────────────────────
alter table public.stations       enable row level security;
alter table public.station_events enable row level security;

-- Stations: full access for branch owner and staff of that branch
create policy "stations_branch_rw" on public.stations
  for all
  using (
    branch_id in (
      select id from public.branches where owner_id = auth.uid()
      union
      select branch_id from public.staff where user_id = auth.uid()
    )
  );

-- Station events: read-only for branch members; inserts via RPC only
create policy "station_events_read" on public.station_events
  for select
  using (
    station_id in (
      select s.id from public.stations s
      where s.branch_id in (
        select id from public.branches where owner_id = auth.uid()
        union
        select branch_id from public.staff where user_id = auth.uid()
      )
    )
  );
