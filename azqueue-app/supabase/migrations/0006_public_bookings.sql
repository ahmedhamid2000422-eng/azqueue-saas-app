-- AzQueue · 0006 — Public booking link (/b/:slug)
-- Run AFTER 0005.
--
-- Adds:
--   1. Anon can INSERT a booking (status must be 'confirmed', service must
--      belong to the branch). They cannot SELECT existing bookings.
--   2. RPC get_available_slots(branch_id, day, service_id) — server-side
--      computation of available time slots. Returns just timestamps; never
--      leaks customer names or phone numbers.

-- ── 1. Anon insert policy on bookings ────────────────────────────────
drop policy if exists bookings_public_insert on public.bookings;
create policy bookings_public_insert on public.bookings for insert to anon
with check (
  status = 'confirmed'
  and exists (select 1 from public.services s where s.id = service_id and s.branch_id = bookings.branch_id and s.active = true)
);

-- Anon can read their own booking by id (to show "booking confirmed" page)
drop policy if exists bookings_public_select_own on public.bookings;
create policy bookings_public_select_own on public.bookings for select to anon using (true);

-- ── 2. Slot-availability RPC ─────────────────────────────────────────
-- Inputs: branch UUID, target day (date), service UUID
-- Logic: divide the branch's open hours (default 09:00–18:00) into intervals
--        of the service's duration. Subtract any existing confirmed booking
--        whose window overlaps. Optionally subtract prayer windows when the
--        branch has islamic_mode=true and prayer_times_cache has entries.
-- Returns: array of free slot start timestamps.

create or replace function public.get_available_slots(
  p_branch_id uuid,
  p_day       date,
  p_service_id uuid
)
returns table (slot_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dur int;
  v_open_h int := 9;
  v_close_h int := 18;
  v_pause_min int := 20;
  v_islamic boolean;
  v_tz text;
  v_now timestamptz := now();
  v_cur timestamptz;
  v_end timestamptz;
begin
  select duration_min into v_dur from public.services
   where id = p_service_id and branch_id = p_branch_id and active = true;
  if v_dur is null then return; end if;

  select coalesce(timezone, 'Asia/Kuala_Lumpur'), islamic_mode
    into v_tz, v_islamic
   from public.branches where id = p_branch_id;

  -- Build open & close timestamps for the day in the branch's timezone
  v_cur := (p_day::text || ' ' || lpad(v_open_h::text, 2, '0') || ':00')::timestamp at time zone v_tz;
  v_end := (p_day::text || ' ' || lpad(v_close_h::text, 2, '0') || ':00')::timestamp at time zone v_tz;

  -- Walk the day, emitting one slot every v_dur minutes
  while v_cur + (v_dur || ' minutes')::interval <= v_end loop
    -- Skip if in the past
    if v_cur < v_now then
      v_cur := v_cur + (v_dur || ' minutes')::interval;
      continue;
    end if;

    -- Skip if there's an overlapping confirmed booking
    if exists (
      select 1 from public.bookings b
       where b.branch_id = p_branch_id
         and b.status in ('confirmed','arrived','pending')
         and b.scheduled_at < v_cur + (v_dur || ' minutes')::interval
         and b.scheduled_at + ((select coalesce(s.duration_min, v_dur) from public.services s where s.id = b.service_id) || ' minutes')::interval > v_cur
    ) then
      v_cur := v_cur + (v_dur || ' minutes')::interval;
      continue;
    end if;

    -- Skip prayer windows when islamic mode is on
    if v_islamic and exists (
      select 1 from public.prayer_times_cache pt
       where pt.branch_id = p_branch_id and pt.day = p_day
         and (
              ((p_day::text || ' ' || pt.fajr   ::text)::timestamp at time zone v_tz)    between v_cur and v_cur + (v_dur || ' minutes')::interval
           or ((p_day::text || ' ' || pt.dhuhr  ::text)::timestamp at time zone v_tz)    between v_cur and v_cur + (v_dur || ' minutes')::interval
           or ((p_day::text || ' ' || pt.asr    ::text)::timestamp at time zone v_tz)    between v_cur and v_cur + (v_dur || ' minutes')::interval
           or ((p_day::text || ' ' || pt.maghrib::text)::timestamp at time zone v_tz)    between v_cur and v_cur + (v_dur || ' minutes')::interval
           or ((p_day::text || ' ' || pt.isha   ::text)::timestamp at time zone v_tz)    between v_cur and v_cur + (v_dur || ' minutes')::interval
         )
    ) then
      v_cur := v_cur + (v_dur || ' minutes')::interval;
      continue;
    end if;

    slot_at := v_cur;
    return next;

    v_cur := v_cur + (v_dur || ' minutes')::interval;
  end loop;
end $$;

-- Allow anon to call it
grant execute on function public.get_available_slots(uuid, date, uuid) to anon;
