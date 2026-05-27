-- AzQueue · 0014 — Shadow Slots
-- Run AFTER 0013.
--
-- "Shadow slots" are time windows the branch owner deliberately leaves
-- unbookable in the public booking page to absorb walk-in traffic that
-- history shows tends to arrive at those hours. Customers who book online
-- never see these windows; walk-ins slide right in.
--
-- Adds:
--   1. shadow_slots table — per-branch, recurring by day_of_week + hour
--   2. shadow_slots_enabled flag on branches (default false)
--   3. Updated get_available_slots RPC that skips shadow windows
--   4. RLS policies so only branch owners manage their own slots

-- ── 1. shadow_slots table ─────────────────────────────────────────────
create table if not exists public.shadow_slots (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  day_of_week   int  not null check (day_of_week between 0 and 6), -- 0=Sun … 6=Sat
  hour          int  not null check (hour between 0 and 23),
  duration_min  int  not null default 60 check (duration_min > 0),
  label         text,          -- optional note, e.g. "Lunch walk-in rush"
  active        bool not null default true,
  created_at    timestamptz not null default now()
);

-- Unique: one shadow slot per branch / day / hour
create unique index if not exists shadow_slots_branch_dow_hour
  on public.shadow_slots (branch_id, day_of_week, hour)
  where active = true;

-- ── 2. Flag on branches ───────────────────────────────────────────────
alter table public.branches
  add column if not exists shadow_slots_enabled bool not null default false;

-- ── 3. RLS ────────────────────────────────────────────────────────────
alter table public.shadow_slots enable row level security;

-- Managers/owners of the branch can do everything
create policy shadow_slots_branch_all on public.shadow_slots
  for all
  using (
    branch_id in (
      select id from public.branches where owner_id = auth.uid()
    )
  );

-- Anon read — needed so the RPC (security definer) can skip them
-- The RPC runs as the function owner, not anon, so this isn't strictly
-- required, but it allows future client-side previews without leaking data.
create policy shadow_slots_anon_read on public.shadow_slots
  for select to anon
  using (active = true);

-- ── 4. Updated get_available_slots RPC ───────────────────────────────
-- Same logic as 0006 but adds a shadow-slot skip when
-- shadow_slots_enabled = true on the branch.
create or replace function public.get_available_slots(
  p_branch_id  uuid,
  p_day        date,
  p_service_id uuid
)
returns table (slot_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dur          int;
  v_open_h       int := 9;
  v_close_h      int := 18;
  v_islamic      boolean;
  v_shadows_on   boolean;
  v_tz           text;
  v_now          timestamptz := now();
  v_cur          timestamptz;
  v_end          timestamptz;
  v_dow          int;   -- 0=Sun … 6=Sat for the target day
begin
  -- Service must exist and belong to this branch
  select duration_min into v_dur
    from public.services
   where id = p_service_id and branch_id = p_branch_id and active = true;
  if v_dur is null then return; end if;

  -- Branch settings
  select coalesce(timezone, 'Asia/Kuala_Lumpur'),
         islamic_mode,
         coalesce(shadow_slots_enabled, false)
    into v_tz, v_islamic, v_shadows_on
   from public.branches where id = p_branch_id;

  -- Build open/close timestamps in the branch's local timezone
  v_cur := (p_day::text || ' ' || lpad(v_open_h::text, 2, '0') || ':00')::timestamp
             at time zone v_tz;
  v_end := (p_day::text || ' ' || lpad(v_close_h::text, 2, '0') || ':00')::timestamp
             at time zone v_tz;

  -- Day-of-week for shadow slot matching (0=Sun, matches extract(dow ...))
  v_dow := extract(dow from p_day)::int;

  while v_cur + (v_dur || ' minutes')::interval <= v_end loop

    -- Skip past slots
    if v_cur < v_now then
      v_cur := v_cur + (v_dur || ' minutes')::interval;
      continue;
    end if;

    -- Skip if an existing confirmed/arrived/pending booking overlaps
    if exists (
      select 1 from public.bookings b
       where b.branch_id = p_branch_id
         and b.status in ('confirmed','arrived','pending')
         and b.scheduled_at < v_cur + (v_dur || ' minutes')::interval
         and b.scheduled_at + (
               (select coalesce(s.duration_min, v_dur)
                  from public.services s where s.id = b.service_id)
               || ' minutes')::interval > v_cur
    ) then
      v_cur := v_cur + (v_dur || ' minutes')::interval;
      continue;
    end if;

    -- Skip prayer windows when Islamic mode is on
    if v_islamic and exists (
      select 1 from public.prayer_times_cache pt
       where pt.branch_id = p_branch_id and pt.day = p_day
         and (
              ((p_day::text || ' ' || pt.fajr   ::text)::timestamp at time zone v_tz)
                between v_cur and v_cur + (v_dur || ' minutes')::interval
           or ((p_day::text || ' ' || pt.dhuhr  ::text)::timestamp at time zone v_tz)
                between v_cur and v_cur + (v_dur || ' minutes')::interval
           or ((p_day::text || ' ' || pt.asr    ::text)::timestamp at time zone v_tz)
                between v_cur and v_cur + (v_dur || ' minutes')::interval
           or ((p_day::text || ' ' || pt.maghrib::text)::timestamp at time zone v_tz)
                between v_cur and v_cur + (v_dur || ' minutes')::interval
           or ((p_day::text || ' ' || pt.isha   ::text)::timestamp at time zone v_tz)
                between v_cur and v_cur + (v_dur || ' minutes')::interval
         )
    ) then
      v_cur := v_cur + (v_dur || ' minutes')::interval;
      continue;
    end if;

    -- Skip shadow slots when the feature is enabled for this branch
    if v_shadows_on and exists (
      select 1 from public.shadow_slots ss
       where ss.branch_id  = p_branch_id
         and ss.active     = true
         and ss.day_of_week = v_dow
         -- The slot start falls within the shadow window
         and extract(hour from v_cur at time zone v_tz)::int >= ss.hour
         and extract(hour from v_cur at time zone v_tz)::int <  ss.hour + (ss.duration_min / 60)
    ) then
      v_cur := v_cur + (v_dur || ' minutes')::interval;
      continue;
    end if;

    slot_at := v_cur;
    return next;

    v_cur := v_cur + (v_dur || ' minutes')::interval;
  end loop;
end $$;

-- Anon needs to call this to book
grant execute on function public.get_available_slots(uuid, date, uuid) to anon;

-- ── 5. Walk-in heatmap RPC ────────────────────────────────────────────
-- Returns walk-in ticket counts grouped by day_of_week + hour
-- over the last 90 days. Used by the Shadow Slots UI to show owners
-- where their walk-in traffic actually falls.
create or replace function public.get_walkin_heatmap(
  p_branch_id uuid,
  p_days      int default 90
)
returns table (day_of_week int, hour int, ticket_count int)
language sql
security definer
set search_path = public
as $$
  select
    extract(dow  from created_at at time zone
      coalesce((select timezone from public.branches where id = p_branch_id),
               'Asia/Kuala_Lumpur'))::int  as day_of_week,
    extract(hour from created_at at time zone
      coalesce((select timezone from public.branches where id = p_branch_id),
               'Asia/Kuala_Lumpur'))::int  as hour,
    count(*)::int                           as ticket_count
  from public.tickets
  where branch_id = p_branch_id
    and source    = 'walk'
    and created_at >= now() - (p_days || ' days')::interval
  group by 1, 2
  order by 1, 2;
$$;

grant execute on function public.get_walkin_heatmap(uuid, int) to authenticated;
grant execute on function public.get_walkin_heatmap(uuid, int) to anon;
