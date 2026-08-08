-- Auto-expire stale tickets nightly at 11 PM UTC
-- Cancels any tickets still in 'waiting' or 'serving' status
-- that are older than 12 hours (covers any branch timezone).
--
-- Requires pg_cron extension (enabled by default on Supabase).

-- Enable pg_cron if not already enabled
create extension if not exists pg_cron;

-- Create the expire function
create or replace function expire_stale_tickets()
returns void
language plpgsql
security definer
as $$
begin
  update tickets
  set
    status       = 'cancelled',
    completed_at = now()
  where
    status in ('waiting', 'serving')
    and created_at < now() - interval '12 hours';
end;
$$;

-- Schedule it: every day at 11 PM UTC (covers end-of-day globally)
select cron.schedule(
  'expire-stale-tickets',   -- job name (unique)
  '0 23 * * *',             -- cron: 11 PM UTC daily
  'select expire_stale_tickets()'
);
