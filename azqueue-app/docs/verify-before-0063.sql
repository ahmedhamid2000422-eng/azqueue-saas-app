-- Run in the Supabase SQL editor before building the readiness feature.
-- Three questions. Each one can change the plan, and none can be answered
-- from the codebase — they are about what the office actually does.

-- ── 1. Has the drop-off / back queue ever been used? ──────────────────
-- Ahmed believes yes. If the answer is zero, the largest available win in
-- the product is training rather than code.
select
  count(*)                                          as total_tickets,
  count(*) filter (where handed_off_at is not null) as ever_handed_off,
  count(*) filter (where work_done_at   is not null) as work_finished,
  count(*) filter (where collected_at   is not null) as collected,
  count(*) filter (where handoff_category = 'dropoff')    as dropoffs,
  count(*) filter (where handoff_category = 'immigration') as immigration,
  count(*) filter (where handoff_category = 'taxes')       as taxes
from public.tickets
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and is_test = false;

-- Turnaround, if there is anything to measure. Median, not mean.
select
  count(*) as n,
  percentile_cont(0.5) within group (
    order by extract(epoch from (work_done_at - handed_off_at)) / 3600
  ) as median_hours_to_finish
from public.tickets
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and is_test = false
  and handed_off_at is not null
  and work_done_at  is not null;

-- ── 2. Is any service marked as a pickup? ─────────────────────────────
-- The pickup kiosk at /q/:slug/pickup depends on this flag.
select id, name, is_pickup, active
from public.services
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
order by name;

-- ── 3. Is the staff capability config actually filled in? ─────────────
-- analyzeQueue and enrichStaffLoad read these. Empty arrays mean routing
-- silently falls back to "anyone can do anything" — which is correct
-- behaviour, but it means the capability system is unconfigured rather
-- than unbuilt.
select
  display_name,
  role,
  is_senior_advisor,
  max_complexity,
  cardinality(services_handled) as services_count,
  cardinality(expertise_areas)  as expertise_count,
  jsonb_array_length(coalesce(languages, '[]'::jsonb)) as languages_count,
  estimated_times
from public.staff
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a';

-- Station routing added in 0061. Expected to be empty — it ran today.
select
  s.name as station,
  count(ss.service_id) as services_mapped
from public.stations s
left join public.station_services ss on ss.station_id = s.id
where s.branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
group by s.name
order by s.name;

-- ── 4. Bonus: is staff attribution actually being recorded? ───────────
-- The "Served by" picker was hidden whenever a branch had one staff row,
-- so staff_id was never written. Fixed 5 September, not yet deployed.
-- This is the before-number.
select
  count(*)                                      as completed_visits,
  count(*) filter (where staff_id is not null)  as with_staff,
  round(100.0 * count(*) filter (where staff_id is not null)
        / nullif(count(*), 0), 1)               as pct_attributed
from public.tickets
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and is_test = false
  and completed_at is not null;
