-- ═══════════════════════════════════════════════════════════════════
-- AzQueue · Why isn't the daily report arriving?
--
-- Run these one at a time in the SQL Editor and read the output.
-- net.http_post is ASYNCHRONOUS: pg_cron reports success as soon as the
-- request is queued, so a failing report looks like a healthy cron job.
-- The truth is in net._http_response.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Does the job exist and is it active?
select jobid, jobname, schedule, active
from cron.job
where jobname = 'azqueue-daily-report';

-- 2. Has it actually run? (should show one row per day since scheduling)
select runid, status, return_message, start_time
from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'azqueue-daily-report')
order by start_time desc
limit 10;

-- 3. THE IMPORTANT ONE — what did the Edge Function actually reply?
--    401 = REPORT_SECRET mismatch  ·  404 = wrong URL  ·  200 = worked
select id, status_code, left(content, 300) as response, created
from net._http_response
order by created desc
limit 10;

-- 4. Are the Vault secrets present and correct?
select name, left(decrypted_secret, 12) || '…' as starts_with
from vault.decrypted_secrets
where name in ('project_url', 'report_secret');

-- ── Send one right now, without waiting for 01:00 UTC ──────────────
-- Run this, wait ~5 seconds, then re-run query 3 above to see the result.
select net.http_post(
  url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
             || '/functions/v1/daily-report',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body    := jsonb_build_object(
               'secret', (select decrypted_secret from vault.decrypted_secrets where name = 'report_secret'),
               'date',   to_char((now() at time zone 'America/Denver')::date - 1, 'YYYY-MM-DD')
             )
) as request_id;
