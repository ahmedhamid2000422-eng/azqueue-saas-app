-- ═══════════════════════════════════════════════════════════════════
-- AzQueue · Schedule the daily report email
--
-- BEFORE RUNNING:
--   1. Deploy the `daily-report` Edge Function (Verify JWT OFF)
--   2. Edge Functions → Secrets, add:
--        REPORT_EMAIL   = ahmedhamid2000422@gmail.com
--        REPORT_SECRET  = <any random string you invent>
--   3. Put that same REPORT_SECRET in the line marked below
--
-- Runs at 01:00 UTC = 7:00 PM in Denver (6:00 PM during winter),
-- i.e. end of business day, reporting on the day just finished.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;   -- lets Postgres call the function over HTTP

-- Remove any previous schedule so this file is safe to re-run
do $$
begin
  perform cron.unschedule('azqueue-daily-report');
exception when others then
  null;
end $$;

select cron.schedule(
  'azqueue-daily-report',
  '0 1 * * *',                                   -- 01:00 UTC daily
  $job$
  select net.http_post(
    url     := 'https://haiighdwffvbjfepfttf.supabase.co/functions/v1/daily-report',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := jsonb_build_object(
                 'secret', 'REPLACE_WITH_YOUR_REPORT_SECRET',
                 -- report on the day that just ended, in Denver terms
                 'date',   to_char((now() at time zone 'America/Denver')::date - 1, 'YYYY-MM-DD')
               )
  );
  $job$
);

-- Confirm it's scheduled
select jobname, schedule, active from cron.job where jobname = 'azqueue-daily-report';
