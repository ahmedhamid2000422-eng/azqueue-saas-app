-- 0049 — Insights: pick a day, and use the branch's own timezone
--
-- TWO BUGS IN THE EXISTING get_insights_payload
--
-- 1. TIMEZONE. It computed the day boundary as:
--        date_trunc('day', now() AT TIME ZONE 'UTC')
--    so "today" began at midnight UTC — which for Aurora, Colorado is 6pm
--    the PREVIOUS evening. Every "today" figure on the Insights page has
--    therefore been counting from 6pm yesterday, and dropping everything
--    after 6pm today into tomorrow. That is almost certainly why the
--    completed count has looked wrong.
--
--    Fixed by using branches.timezone, which is already stored per branch.
--
-- 2. NO WAY TO LOOK BACK. The function only ever reported today, so
--    yesterday's numbers were unreachable the moment the clock rolled over.
--    A day that can never be reviewed cannot be learned from.
--
--    Fixed with an optional p_day. Omit it for today; pass a date for any
--    past day.
--
-- Safe to run at any time: read-only function, no data is modified.

create or replace function public.get_insights_payload(
  p_branch_id uuid,
  p_day       date default null      -- null = today, in the branch's timezone
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz          text;
  v_day         date;
  v_day_start   timestamptz;
  v_day_end     timestamptz;
  v_is_today    boolean;
  v_result      jsonb;
begin
  -- The branch's own timezone. Falls back to UTC rather than guessing.
  select coalesce(nullif(b.timezone, ''), 'UTC') into v_tz
  from public.branches b where b.id = p_branch_id;

  if v_tz is null then
    return null;   -- unknown branch
  end if;

  -- "Today" means today WHERE THE BUSINESS IS, not where the server is.
  v_day := coalesce(p_day, (now() at time zone v_tz)::date);
  v_day_start := (v_day::timestamp) at time zone v_tz;
  v_day_end   := ((v_day + 1)::timestamp) at time zone v_tz;
  v_is_today  := v_day = (now() at time zone v_tz)::date;

  select jsonb_build_object(
    'day', v_day,
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

    'no_show_rate',
      case when count(*) filter (where status in ('completed','cancelled')
                                   and created_at >= v_day_start and created_at < v_day_end) = 0
           then null
           else count(*) filter (where status = 'cancelled'
                                   and created_at >= v_day_start and created_at < v_day_end)::float
              / count(*) filter (where status in ('completed','cancelled')
                                   and created_at >= v_day_start and created_at < v_day_end)
      end,

    'booking_conversion',
      case when count(*) filter (where source = 'booking'
                                   and created_at >= v_day_start and created_at < v_day_end) = 0
           then null
           else count(*) filter (where source = 'booking' and status = 'completed'
                                   and created_at >= v_day_start and created_at < v_day_end)::float
              / count(*) filter (where source = 'booking'
                                   and created_at >= v_day_start and created_at < v_day_end)
      end,

    'peak_hour',
      (select extract(hour from (completed_at at time zone v_tz))::int
         from public.tickets t2
        where t2.branch_id = p_branch_id
          and t2.status = 'completed'
          and t2.completed_at >= v_day_start and t2.completed_at < v_day_end
        group by 1 order by count(*) desc limit 1),

    -- Live counts are only meaningful for today. On a past day they would be
    -- today's numbers shown next to that day's history, which is worse than
    -- showing nothing.
    'waiting_now',
      case when v_is_today then count(*) filter (where status = 'waiting') else null end,
    'serving_now',
      case when v_is_today then count(*) filter (where status = 'serving') else null end
  ) into v_result
  from public.tickets
  where branch_id = p_branch_id;

  return v_result;
end $$;

grant execute on function public.get_insights_payload(uuid, date) to authenticated;

comment on function public.get_insights_payload is
  'Insights for one day, in the branch timezone. p_day null = today. Live counts are null for past days.';
