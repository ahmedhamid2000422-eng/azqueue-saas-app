-- Everything observable — Az Tax Services
-- Written 20 October 2026. Run ONE BLOCK AT A TIME — the editor returns
-- a single result set per run. Paste the results back.
--
-- Each block returns a small aggregate, not raw rows, so the whole thing
-- fits in a conversation. Every block obeys the rules in CLAUDE.md:
--   is_test = false · America/Denver · medians not means · n stated
--   expired_at not null = swept, never a completion and never an abandonment
--   status = 'completed' required for any duration
--
-- Blocks marked [NEW] depend on migrations run 19-20 October and will be
-- empty until the office has used the new build for a while. That is
-- expected, not a failure.

-- === A1. Daily shape (last 45 days) ===
select
  date(created_at at time zone 'America/Denver')                      as day,
  to_char(created_at at time zone 'America/Denver', 'Dy')             as dow,
  count(*)                                                            as arrivals,
  count(*) filter (where status = 'completed' and expired_at is null) as completed,
  count(*) filter (where expired_at is not null)                      as swept,
  count(*) filter (where status in ('cancelled','no_show') and expired_at is null) as walkouts,
  count(*) filter (where status in ('waiting','serving'))             as still_open
from tickets
where is_test = false
  and created_at > now() - interval '45 days'
group by 1,2
order by 1 desc;

-- === A2. Arrivals by weekday, per day ===
select
  to_char(created_at at time zone 'America/Denver', 'Dy') as weekday,
  count(*)                                                as arrivals,
  count(distinct date(created_at at time zone 'America/Denver')) as days,
  round(count(*)::numeric
        / nullif(count(distinct date(created_at at time zone 'America/Denver')),0), 1) as per_day
from tickets
where is_test = false and created_at > now() - interval '45 days'
group by 1, extract(isodow from created_at at time zone 'America/Denver')
order by extract(isodow from created_at at time zone 'America/Denver');

-- === A3. Arrivals by hour, Monday vs rest ===
select
  case when extract(isodow from created_at at time zone 'America/Denver') = 1
       then 'Mon' else 'Tue-Thu' end                        as daytype,
  extract(hour from created_at at time zone 'America/Denver') as hour,
  count(*)                                                    as arrivals,
  count(distinct date(created_at at time zone 'America/Denver')) as days
from tickets
where is_test = false
  and extract(isodow from created_at at time zone 'America/Denver') between 1 and 4
  and created_at > now() - interval '45 days'
group by 1,2 order by 1,2;

-- === A4. Arrival channel ===
select source, count(*) as n,
       min(date(created_at at time zone 'America/Denver')) as first_seen,
       max(date(created_at at time zone 'America/Denver')) as last_seen
from tickets
where is_test = false and created_at > now() - interval '90 days'
group by 1 order by n desc;

-- === A5. Service mix ===
select coalesce(s.name,'(none recorded)') as service,
       count(*) as visits,
       round(100.0*count(*)/sum(count(*)) over (),1) as pct
from tickets t left join services s on s.id = t.service_id
where t.is_test = false and t.created_at > now() - interval '90 days'
group by 1 order by visits desc;

-- === A6. Outcome of every ticket ===
select status,
       count(*) as n,
       count(*) filter (where expired_at is not null) as of_which_swept
from tickets
where is_test = false and created_at > now() - interval '90 days'
group by 1 order by n desc;

-- === A7. Service time — ONLY properly completed visits ===
select coalesce(s.name,'(none)') as service, count(*) as n,
  round(percentile_cont(0.5) within group (
    order by extract(epoch from (t.completed_at - t.started_at))/60)::numeric,1) as median_min,
  round(percentile_cont(0.9) within group (
    order by extract(epoch from (t.completed_at - t.started_at))/60)::numeric,1) as p90_min
from tickets t left join services s on s.id = t.service_id
where t.is_test = false and t.status = 'completed' and t.expired_at is null
  and t.started_at is not null and t.completed_at is not null
  and t.created_at > now() - interval '90 days'
group by 1 having count(*) >= 5 order by n desc;

-- === A8. [NEW] Live vs caught-up — the only honest duration split ===
select coalesce(timing_source,'not answered') as recorded,
       count(*) as n,
       round(percentile_cont(0.5) within group (
         order by extract(epoch from (completed_at - started_at))/60)::numeric,1) as median_min
from tickets
where is_test = false and status = 'completed' and expired_at is null
  and started_at is not null and completed_at is not null
  and created_at > now() - interval '45 days'
group by 1 order by n desc;

-- === A9. Back queue / drop-off — built in 0048, possibly never used ===
select
  count(*)                                          as tickets_90d,
  count(*) filter (where handed_off_at is not null) as handed_off,
  count(*) filter (where work_started_at is not null) as work_started,
  count(*) filter (where work_done_at is not null)  as work_done,
  count(*) filter (where ready_notified_at is not null) as notified,
  count(*) filter (where collected_at is not null)  as collected
from tickets
where is_test = false and created_at > now() - interval '90 days';

-- === A10. Handoff categories ===
select coalesce(handoff_category,'(none)') as category, count(*) as n
from tickets
where is_test = false and created_at > now() - interval '90 days'
group by 1 order by n desc;

-- === A11. Escalations — what staff could not handle alone ===
select coalesce(escalated_reason,'(no reason given)') as reason, count(*) as n
from tickets
where is_test = false and escalated_at is not null
  and created_at > now() - interval '90 days'
group by 1 order by n desc limit 15;

-- === A12. Staff attribution by week ===
select date_trunc('week', created_at at time zone 'America/Denver')::date as week,
       count(*) as completed,
       count(*) filter (where staff_id is not null) as with_staff
from tickets
where is_test = false and expired_at is null and completed_at is not null
  and created_at > now() - interval '90 days'
group by 1 order by 1 desc;

-- === A13. Returned-to-queue (bounce) ===
select bounce_count, count(*) as tickets
from tickets
where is_test = false and created_at > now() - interval '90 days'
group by 1 order by 1;

-- === B1. Customers by origin ===
select coalesce(import_source,'created in app') as origin,
       count(*) as customers,
       count(*) filter (where phone is not null)  as with_phone,
       count(*) filter (where email is not null)  as with_email,
       count(*) filter (where phone is null and email is null) as no_contact
from customers group by 1 order by customers desc;

-- === B2. Duplicate phone numbers — is findOrCreateCustomer matching? ===
select count(*) as phones_with_duplicates,
       sum(rows) - count(*) as extra_rows
from (
  select phone, count(*) as rows
  from customers
  where phone is not null
  group by phone having count(*) > 1
) d;

-- === B3. Qminder history — when clients were last seen ===
select to_char(last_seen_at,'YYYY-MM') as month,
       count(*) as clients_last_seen,
       round(avg(coalesce(imported_visits,1)),1) as avg_visits
from customers
where import_source = 'qminder' and last_seen_at is not null
group by 1 order by 1;

-- === B4. Client loyalty, from the import ===
select case
         when coalesce(imported_visits,1) = 1 then '1 visit'
         when imported_visits between 2 and 3  then '2-3'
         when imported_visits between 4 and 6  then '4-6'
         else '7+' end as visits,
       count(*) as clients
from customers
where import_source = 'qminder'
group by 1 order by 1;

-- === B5. Are historical clients coming back? ===
select count(*) as qminder_clients_seen_since_august
from customers
where import_source = 'qminder'
  and last_seen_at > '2026-08-31';

-- === C1. Bookings ===
select status, count(*) as n
from bookings
where created_at > now() - interval '90 days'
group by 1 order by n desc;

-- === C2. Booking lead time and punctuality ===
select count(*) as n,
  round(percentile_cont(0.5) within group (
    order by extract(epoch from (scheduled_at - created_at))/3600)::numeric,1) as median_hours_ahead
from bookings
where created_at > now() - interval '90 days';

-- === D1. Notifications actually sent ===
select channel, template, status, count(*) as n
from notifications_log
where created_at > now() - interval '90 days'
group by 1,2,3 order by n desc limit 25;

-- === E1. Configuration — services ===
select name, duration_min, active, is_pickup from services order by name;

-- === E2. Configuration — staff ===
select display_name, role, status, is_senior_advisor,
       cardinality(services_handled) as services_set,
       cardinality(expertise_areas)  as expertise_set
from staff;

-- === E3. Configuration — stations ===
select s.name, s.staff_id is not null as has_default_staff,
       count(ss.service_id) as services_mapped
from stations s
left join station_services ss on ss.station_id = s.id
group by s.id, s.name, s.staff_id order by s.name;

-- === E4. Opening hours as configured ===
select name, hours, timezone from branches;
