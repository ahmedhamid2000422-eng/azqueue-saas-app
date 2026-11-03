-- 0069 — cron jobs were running during office hours
--
-- pg_cron schedules in UTC. Denver is UTC-6 in summer, UTC-7 in winter, so
-- every "overnight" job was six or seven hours earlier than intended:
--
--   expire-stale-tickets   0 23 * * *  = 5pm Denver (4pm after the clocks
--                                        change) — the nightly sweep was
--                                        firing while the office was open.
--                                        Any ticket not yet called at 4pm was
--                                        closed as stale with no outcome,
--                                        while its customer was quite
--                                        possibly still in the waiting room.
--
--   daily-report-nightly   0 1 * * *   = 6pm Denver. The "daily" report was
--                                        compiled before the day ended and
--                                        missed every late visit.
--
-- The first of these matters for the 237 cron-closed tickets: an unknown
-- share of them may have been swept mid-afternoon rather than overnight. It
-- also gets worse in winter — 4pm during tax season, when the queue is
-- deepest.
--
-- Applied directly in the SQL editor on 28 October 2026 and recorded here so
-- the repository matches the database. Re-running is safe.

create extension if not exists pg_cron;

-- 2am Denver in winter, 3am in summer.
do $$ begin perform cron.unschedule('expire-stale-tickets');
exception when others then null; end $$;

select cron.schedule('expire-stale-tickets', '0 9 * * *',
                     'select public.expire_stale_tickets()');

-- 10pm Denver in winter, 11pm in summer — after close, so the report covers
-- the whole day.
do $$ begin perform cron.unschedule('daily-report-nightly');
exception when others then null; end $$;

select cron.schedule('daily-report-nightly', '0 5 * * *',
                     $$select public.call_edge_function('daily-report', 'report_secret')$$);

-- NOTE FOR ANY FUTURE JOB: write the Denver time in a comment next to the
-- cron expression. Every job on this database was wrong in the same way, and
-- none of them looked wrong.
--
-- Current schedule, UTC -> Denver (winter):
--   expire-called-tickets     * * * * *   every minute
--   visit-survey-hourly       0 * * * *   every hour
--   prune-screen-heartbeats   30 3 * * *  8:30pm
--   expire-stale-tickets      0 9 * * *   2am
--   daily-report-nightly      0 5 * * *   10pm

select jobid, jobname, schedule, active from cron.job order by jobid;
