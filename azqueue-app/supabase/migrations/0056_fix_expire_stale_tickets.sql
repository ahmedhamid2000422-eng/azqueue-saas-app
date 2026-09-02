-- 0056 — stop the nightly sweep corrupting service times
--
-- The previous version:
--
--   update tickets set status = 'cancelled', completed_at = now()
--    where status in ('waiting','serving')
--      and created_at < now() - interval '12 hours';
--
-- Three faults, in order of damage.
--
-- 1. IT WROTE completed_at ON TICKETS NOBODY COMPLETED.
--    A ticket still in 'serving' when the sweep ran got completed_at = now(),
--    so its service time was measured from when staff called the customer to
--    whenever the cron fired. Worse, the job runs at 17:00 Denver but only
--    touches rows older than 12 hours, so today's tickets survive until
--    TOMORROW's run — a Monday 2pm visit was recorded as 27 hours of service.
--    This is what made avg_service_min meaningless.
--
-- 2. 'cancelled' MEANT THREE DIFFERENT THINGS.
--    A customer who gave up, a staff member clearing the screen, and this
--    sweep all produced the same status. Abandonment is the number this
--    business most needs and it cannot be measured through a status that also
--    counts housekeeping.
--
-- 3. IT WAS NOT SCOPED TO A BRANCH.
--    It updated every row in the table. Invisible with one tenant; with two it
--    silently closes another business's live queue. Kept unscoped here because
--    it is a global sweep by design, but it now refuses to touch anything that
--    is still plausibly live (see the interval below).
--
-- The sweep still needs to exist: a forgotten ticket left 'waiting' forever
-- would otherwise sit in the queue count and every wait estimate. It just has
-- to stop pretending those tickets were served.

alter table public.tickets
  add column if not exists expired_at timestamptz;

comment on column public.tickets.expired_at is
  'Set by the nightly sweep when a ticket was abandoned in place. Distinguishes a housekeeping close from a customer who actually gave up, and from a visit that was served. Never counted as a completion.';

create or replace function public.expire_stale_tickets()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.tickets
     set status     = 'cancelled',
         /* The moment we gave up on it — NOT a completion. completed_at is
            left untouched, so service-time averages only ever see visits that
            actually ended at a counter. */
         expired_at = now()
   where status in ('waiting', 'serving')
     and expired_at is null
     /* 18 hours, not 12. The old window plus a 17:00 run meant same-day
        tickets survived to the next evening, turning a two o'clock visit into
        a 27-hour record. Anything genuinely from a previous day is well past
        this; nothing from the current trading day is caught. */
     and created_at < now() - interval '18 hours';
end;
$fn$;

comment on function public.expire_stale_tickets is
  'Nightly housekeeping. Closes tickets abandoned in place, marking expired_at rather than completed_at so they are never mistaken for served visits.';

-- ── Repair the history it already wrote ──────────────────────────────
-- Any cancelled ticket carrying completed_at but no outcome was closed by the
-- sweep or by a bulk clear, not by someone finishing a visit. Move the
-- timestamp to expired_at so every service-time average computed from here on
-- is drawn only from real visits.
--
-- Deliberately conservative: only rows that are BOTH cancelled AND have no
-- recorded outcome. A cancelled ticket that a staff member completed through
-- the Complete panel has an outcome and is left alone.
update public.tickets
   set expired_at   = completed_at,
       completed_at = null
 where status = 'cancelled'
   and completed_at is not null
   and expired_at is null
   and outcome is null;
