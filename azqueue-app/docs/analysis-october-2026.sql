-- Analysis queries — October 2026
--
-- Written because volume finally supports them. The baseline in
-- docs/baseline-2026-09.md rests on 49 visits across four usable days; the
-- three weeks to 17 October carry roughly 166 across 16 trading days.
--
-- RULES BAKED INTO EVERY QUERY BELOW, because this project has retracted five
-- conclusions for ignoring them:
--   * is_test = false
--   * expired_at is null  — a swept ticket was closed by the nightly job, not
--     served and not abandoned
--   * America/Denver, never the server clock or Ahmed's
--   * medians, not means — wait times are right-skewed
--   * day by day, never pooled; the pooled median matched no real day
--   * n reported alongside every figure
--
-- Run them in order. Query 1 decides whether to trust any of the rest.

-- ─────────────────────────────────────────────────────────────────────
-- 1. HOW MUCH OF THE DATA IS ACTUALLY USABLE?
-- A ticket closed by the sweep has no honest service time, and a day where
-- most tickets were swept is a day nobody worked the queue live.
-- ─────────────────────────────────────────────────────────────────────
select
  date(created_at at time zone 'America/Denver')                    as day,
  count(*)                                                          as tickets,
  count(*) filter (where expired_at is not null)                    as swept,
  count(*) filter (where status = 'completed' and expired_at is null) as truly_completed,
  count(*) filter (where called_at is null and expired_at is null)   as never_called,
  round(100.0 * count(*) filter (where expired_at is not null)
        / nullif(count(*), 0), 0)                                    as pct_swept
from tickets
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and is_test = false
  and created_at > now() - interval '30 days'
group by 1
order by 1 desc;

-- ─────────────────────────────────────────────────────────────────────
-- 2. WAIT TIME, DAY BY DAY
-- The headline the baseline could never settle: 18.1 one day, 47.4 another,
-- both clean. With 16 days the spread itself becomes readable.
-- ─────────────────────────────────────────────────────────────────────
select
  date(created_at at time zone 'America/Denver') as day,
  count(*)                                       as n,
  round(percentile_cont(0.5) within group (
    order by extract(epoch from (called_at - created_at)) / 60)::numeric, 1) as median_wait_min,
  round(percentile_cont(0.9) within group (
    order by extract(epoch from (called_at - created_at)) / 60)::numeric, 1) as p90_wait_min,
  round(max(extract(epoch from (called_at - created_at)) / 60)::numeric, 1)  as worst_min
from tickets
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and is_test = false
  and expired_at is null
  and called_at is not null
group by 1
having count(*) >= 5          -- below five a median is noise
order by 1 desc;

-- ─────────────────────────────────────────────────────────────────────
-- 3. SERVICE TIME BY SERVICE
-- What each kind of visit actually takes. Drives slot length on Schedule and
-- the estimates shown on the Queue page.
-- ─────────────────────────────────────────────────────────────────────
select
  s.name                                          as service,
  count(*)                                        as n,
  round(percentile_cont(0.5) within group (
    order by extract(epoch from (t.completed_at - t.started_at)) / 60)::numeric, 1) as median_min,
  round(percentile_cont(0.9) within group (
    order by extract(epoch from (t.completed_at - t.started_at)) / 60)::numeric, 1) as p90_min
from tickets t
join services s on s.id = t.service_id
where t.branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and t.is_test = false
  and t.expired_at is null
  and t.started_at is not null
  and t.completed_at is not null
  -- Guard against overnight rows: a visit recorded as four hours is a
  -- forgotten Done press, not a four-hour consultation.
  and t.completed_at - t.started_at between interval '1 minute' and interval '4 hours'
group by 1
having count(*) >= 5
order by n desc;

-- ─────────────────────────────────────────────────────────────────────
-- 4. DEMAND BY WEEKDAY AND HOUR
-- Mondays look heavy and Fridays near-empty in the arrival counts. This is
-- the staffing question, and it now has enough days behind it.
-- ─────────────────────────────────────────────────────────────────────
select
  to_char(created_at at time zone 'America/Denver', 'Dy')   as weekday,
  extract(hour from created_at at time zone 'America/Denver') as hour,
  count(*)                                                  as arrivals,
  count(distinct date(created_at at time zone 'America/Denver')) as days_observed
from tickets
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and is_test = false
  and created_at > now() - interval '30 days'
group by 1, 2
order by
  case to_char(created_at at time zone 'America/Denver', 'Dy')
    when 'Mon' then 1 when 'Tue' then 2 when 'Wed' then 3
    when 'Thu' then 4 when 'Fri' then 5 when 'Sat' then 6 else 7 end,
  2;

-- ─────────────────────────────────────────────────────────────────────
-- 5. WHAT PEOPLE COME IN FOR
-- Decides which checklists matter and which services deserve a station.
-- ─────────────────────────────────────────────────────────────────────
select
  coalesce(s.name, 'No service recorded') as service,
  count(*)                                as visits,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from tickets t
left join services s on s.id = t.service_id
where t.branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and t.is_test = false
  and t.created_at > now() - interval '30 days'
group by 1
order by visits desc;

-- ─────────────────────────────────────────────────────────────────────
-- 6. REAL ABANDONMENT, SEPARATED FROM THE SWEEP
-- The distinction the daily email was missing. A walkout is somebody closed
-- by a person during the day; a swept ticket is one nobody closed at all.
-- ─────────────────────────────────────────────────────────────────────
select
  date(created_at at time zone 'America/Denver') as day,
  count(*)                                       as tickets,
  count(*) filter (where status in ('cancelled','no_show') and expired_at is null) as real_walkouts,
  count(*) filter (where expired_at is not null)                                   as swept_not_closed
from tickets
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and is_test = false
  and created_at > now() - interval '30 days'
group by 1
order by 1 desc;

-- ─────────────────────────────────────────────────────────────────────
-- 7. IS THE BACK QUEUE BEING USED?
-- Built in 0048 and the single largest lever in the product: documents taken,
-- customer goes home, work finished later. Unused, it is a training problem.
-- ─────────────────────────────────────────────────────────────────────
select
  count(*)                                           as tickets_30d,
  count(*) filter (where handed_off_at is not null)  as handed_off,
  count(*) filter (where work_done_at  is not null)  as work_finished,
  count(*) filter (where collected_at  is not null)  as collected,
  round(percentile_cont(0.5) within group (
    order by extract(epoch from (work_done_at - handed_off_at)) / 3600)
    filter (where work_done_at is not null and handed_off_at is not null)::numeric, 1)
                                                     as median_hours_turnaround
from tickets
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and is_test = false
  and created_at > now() - interval '30 days';

-- ─────────────────────────────────────────────────────────────────────
-- 8. IS STAFF ATTRIBUTION WORKING YET?
-- The "Served by" picker was hidden whenever a branch had one staff row, so
-- staff_id was never written. Any per-person figure is meaningless until this
-- climbs. Fixed 5 September — this says whether the fix is live and used.
-- ─────────────────────────────────────────────────────────────────────
select
  date_trunc('week', created_at at time zone 'America/Denver')::date as week,
  count(*)                                       as completed,
  count(*) filter (where staff_id is not null)   as with_staff,
  round(100.0 * count(*) filter (where staff_id is not null)
        / nullif(count(*), 0), 0)                as pct_attributed
from tickets
where branch_id = '1238a46d-f101-415e-8b07-8cf99eaefb2a'
  and is_test = false
  and expired_at is null
  and completed_at is not null
  and created_at > now() - interval '60 days'
group by 1
order by 1 desc;
