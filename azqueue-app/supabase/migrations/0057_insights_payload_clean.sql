-- 0057 — make the daily figures count only real, served visits
--
-- Three corrections to get_insights_payload. Same signature, same keys, so
-- nothing on the front end changes.
--
-- 1. TEST TICKETS WERE COUNTED.
--    The owner checks himself in daily. Those rows sat in every figure on the
--    page. One test session already produced a wrong conclusion about a day's
--    trading. Now excluded via is_test (0055).
--
-- 2. no_show_rate COUNTED HOUSEKEEPING AS ABANDONMENT.
--    'cancelled' covers three different things: a customer who gave up, a
--    staff member clearing the screen, and the nightly sweep. Only the first
--    is a no-show. Since 0056 the other two carry expired_at, so they can be
--    excluded — and abandonment, the number this business most needs to be
--    true, finally measures what it claims to.
--
-- 3. booking_conversion FILTERED ON A VALUE THAT IS NEVER WRITTEN.
--    It looked for source='booking'. The app writes 'book' (Bookings.jsx).
--    Those never matched, so "Booking fill" has shown nothing since launch —
--    the same class of silent wrongness as the UTC bug. Now 'book'.
--
-- avg_service_sec needs no change: 0056 stopped writing completed_at on
-- swept tickets, so it already sees only visits that ended at a counter.

create or replace function public.get_insights_payload(
  p_branch_id uuid,
  p_day       date default null::date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_tz text; v_day date; v_day_start timestamptz; v_day_end timestamptz;
  v_is_today boolean; v_result jsonb;
begin
  select coalesce(nullif(b.timezone, ''), 'UTC') into v_tz
    from public.branches b where b.id = p_branch_id;
  if v_tz is null then return null; end if;

  v_day       := coalesce(p_day, (now() at time zone v_tz)::date);
  v_day_start := (v_day::timestamp) at time zone v_tz;
  v_day_end   := ((v_day + 1)::timestamp) at time zone v_tz;
  v_is_today  := v_day = (now() at time zone v_tz)::date;

  select jsonb_build_object(
    'day',      v_day,
    'is_today', v_is_today,
    'timezone', v_tz,

    'served_today',
      count(*) filter (where status = 'completed'
                         and created_at >= v_day_start and created_at < v_day_end),

    'avg_wait_sec',
      avg(extract(epoch from (called_at - created_at)))
        filter (where status = 'completed' and called_at is not null
                  and created_at >= v_day_start and created_at < v_day_end),

    'avg_service_sec',
      avg(extract(epoch from (completed_at - called_at)))
        filter (where status = 'completed' and called_at is not null
                  and completed_at is not null
                  and created_at >= v_day_start and created_at < v_day_end),

    /* Genuine walkouts only. expired_at marks a ticket closed by the nightly
       sweep or by Clear queue — nobody gave up, so counting it here would
       report the office's own housekeeping as customers leaving. */
    'no_show_rate',
      case when count(*) filter (where (status = 'completed'
                                    or (status = 'cancelled' and expired_at is null))
                                   and created_at >= v_day_start
                                   and created_at < v_day_end) = 0
           then null
           else count(*) filter (where status = 'cancelled' and expired_at is null
                                   and created_at >= v_day_start
                                   and created_at < v_day_end)::float
              / count(*) filter (where (status = 'completed'
                                    or (status = 'cancelled' and expired_at is null))
                                   and created_at >= v_day_start
                                   and created_at < v_day_end)
      end,

    /* 'book', not 'booking'. See note 3 above. */
    'booking_conversion',
      case when count(*) filter (where source = 'book'
                                   and created_at >= v_day_start
                                   and created_at < v_day_end) = 0
           then null
           else count(*) filter (where source = 'book' and status = 'completed'
                                   and created_at >= v_day_start
                                   and created_at < v_day_end)::float
              / count(*) filter (where source = 'book'
                                   and created_at >= v_day_start
                                   and created_at < v_day_end)
      end,

    'peak_hour',
      (select extract(hour from (t2.completed_at at time zone v_tz))::int
         from public.tickets t2
        where t2.branch_id = p_branch_id
          and t2.is_test = false
          and t2.status = 'completed'
          and t2.completed_at >= v_day_start
          and t2.completed_at <  v_day_end
        group by 1 order by count(*) desc limit 1),

    'waiting_now', case when v_is_today then count(*) filter (where status = 'waiting') else null end,
    'serving_now', case when v_is_today then count(*) filter (where status = 'serving') else null end
  ) into v_result
  from public.tickets
  /* One place to exclude test rows — every aggregate above reads this set. */
  where branch_id = p_branch_id
    and is_test = false;

  return v_result;
end
$fn$;
