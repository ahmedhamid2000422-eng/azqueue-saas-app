-- 0053_schedule_edge_jobs.sql
--
-- Schedule the two edge functions that nothing was calling.
--
-- WHY THIS EXISTS
-- `visit-survey` and `daily-report` were deployed and correct, but no cron job
-- ever pointed at them. Only two jobs existed, both plain SQL. So the daily
-- report had never arrived and no survey had ever been sent — not because
-- anything was broken, but because nothing was scheduled.
--
-- WHY THE SECRET LIVES IN VAULT
-- These functions authenticate on a shared secret. Putting that secret in the
-- cron command would write it into `cron.job`, readable by anything with
-- database access, and into this file, which goes to git. Vault keeps it
-- encrypted at rest and out of the repo. The secrets are created by hand once
-- (see the comment at the bottom), never in a migration.
--
-- WHY A HELPER FUNCTION RATHER THAN net.http_post INLINE
-- Vault is only readable by a SECURITY DEFINER function. Inlining the lookup
-- in the cron command would run it as the cron role and return null, and
-- because net.http_post is ASYNCHRONOUS the job would still report success —
-- posting an empty secret forever while looking healthy. That failure mode is
-- the whole reason this file exists, so it's worth designing out.

create extension if not exists pg_cron;
create extension if not exists pg_net;

/* ────────────────────────────────────────────────────────────────────
   The caller
   ──────────────────────────────────────────────────────────────────── */

create or replace function public.call_edge_function(
  p_slug        text,
  p_secret_name text  default null,
  p_body        jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, vault, net, extensions
as $$
declare
  v_base   text;
  v_key    text;
  v_secret text;
  v_body   jsonb;
  v_id     bigint;
begin
  select decrypted_secret into v_base
    from vault.decrypted_secrets where name = 'edge_base_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'edge_service_key';

  /* Fail loudly. A missing base URL that silently posts nowhere is exactly
     the bug this migration is fixing — the job must go red, not green. */
  if v_base is null then
    raise exception 'vault secret "edge_base_url" is missing — see 0053';
  end if;

  if p_secret_name is not null then
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = p_secret_name;
    if v_secret is null then
      raise exception 'vault secret "%" is missing — see 0053', p_secret_name;
    end if;
    v_body := p_body || jsonb_build_object('secret', v_secret);
  else
    v_body := p_body;
  end if;

  select net.http_post(
    url     := v_base || '/' || p_slug,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || coalesce(v_key, '')
               ),
    body    := v_body,
    timeout_milliseconds := 30000
  ) into v_id;

  return v_id;
end;
$$;

/* This can call ANY edge function with a valid secret attached. It must never
   be reachable from a browser session. */
revoke all on function public.call_edge_function(text, text, jsonb) from public;
revoke all on function public.call_edge_function(text, text, jsonb) from anon;
revoke all on function public.call_edge_function(text, text, jsonb) from authenticated;

/* ────────────────────────────────────────────────────────────────────
   The jobs
   ──────────────────────────────────────────────────────────────────── */

/* Re-runnable: drop our own jobs first so applying this twice is harmless. */
do $$
declare j record;
begin
  for j in
    select jobid from cron.job
     where jobname in ('visit-survey-hourly', 'daily-report-nightly')
  loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

/* Hourly. The function asks about visits that ended 2–26 hours ago and marks
   each person asked, so running every hour sends nobody a second copy — and
   the 26-hour ceiling means a day of downtime can't turn into a mass send. */
select cron.schedule(
  'visit-survey-hourly',
  '0 * * * *',
  $job$ select public.call_edge_function('visit-survey', 'survey_secret') $job$
);

/* 01:00 UTC = 7pm in Denver, after close, on the same calendar day the report
   covers. pg_cron schedules are always UTC — this WILL drift by an hour at the
   daylight-saving boundary, which for an end-of-day email is acceptable. */
select cron.schedule(
  'daily-report-nightly',
  '0 1 * * *',
  $job$ select public.call_edge_function('daily-report', 'report_secret') $job$
);

-- ─────────────────────────────────────────────────────────────────────
-- RUN ONCE BY HAND, NOT IN THIS FILE (values must not reach git):
--
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co/functions/v1', 'edge_base_url');
--   select vault.create_secret('<service_role key>',    'edge_service_key');
--   select vault.create_secret('<SURVEY_SECRET value>', 'survey_secret');
--   select vault.create_secret('<REPORT_SECRET value>', 'report_secret');
--
-- The last two must match the SURVEY_SECRET and REPORT_SECRET set in
-- Edge Functions → Secrets, exactly. A mismatch returns 401, and because
-- net.http_post is asynchronous the job still reports success — so verify in
-- net._http_response, never in the cron log.
-- ─────────────────────────────────────────────────────────────────────
