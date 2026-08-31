-- 0047 — visit feedback email
--
-- Asks each customer one question a couple of hours after their visit.
-- Every metric in AzQueue measures what people DID; none of them records
-- why. With 58% of this client base having come once and not returned, the
-- reason is the most valuable missing number in the product.
--
-- BEFORE RUNNING, set the secret in Supabase → Edge Functions → Secrets:
--   SURVEY_SECRET   any long random string
--   RESEND_API_KEY  already set for queue-email
--   APP_URL         https://azqueue.io
-- and store the same SURVEY_SECRET in Vault as 'survey_secret' (below).

-- ── Remember who has been asked ─────────────────────────────────────
alter table public.tickets
  add column if not exists survey_sent_at timestamptz;

comment on column public.tickets.survey_sent_at is
  'When the post-visit feedback email was sent. Null means not yet asked; set only after a successful send, so failures retry.';

-- The job filters on exactly this shape, and will run every 15 minutes.
create index if not exists tickets_survey_pending_idx
  on public.tickets(completed_at)
  where status = 'completed' and survey_sent_at is null;

-- ── Schedule ────────────────────────────────────────────────────────
create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- Store the secret in Vault rather than inlining it in the cron command,
-- where it would be readable by anyone who can list scheduled jobs.
select vault.create_secret(
  'REPLACE_WITH_YOUR_SURVEY_SECRET',
  'survey_secret',
  'Shared secret for the visit-survey edge function'
) where not exists (
  select 1 from vault.decrypted_secrets where name = 'survey_secret'
);

select cron.unschedule('visit-survey')
  where exists (select 1 from cron.job where jobname = 'visit-survey');

-- Every 15 minutes. The function itself only picks up visits that finished
-- 2 to 26 hours ago, so the cadence just controls promptness, not volume.
select cron.schedule(
  'visit-survey',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://haiighdwffvbjfepfttf.supabase.co/functions/v1/visit-survey',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-survey-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'survey_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── Checking it works ───────────────────────────────────────────────
-- net.http_post is ASYNCHRONOUS: cron will report success even when the call
-- fails, because all it did was queue the request. The truth is here:
--
--   select id, status_code, content::text, created
--   from net._http_response order by created desc limit 5;
--
-- A 401 means SURVEY_SECRET in Edge Function Secrets doesn't match the Vault
-- value above. That mismatch is what silently broke the daily report.
