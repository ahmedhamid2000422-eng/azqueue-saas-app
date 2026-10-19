-- 0065 — the turn timeout has been forging completions
--
-- WHAT WAS WRONG
-- expire_called_tickets() (0041) cancels a ticket 30 minutes after it was
-- called, so a counter is not held by somebody who wandered off. Correct
-- behaviour. But it wrote:
--
--     set status = 'cancelled', completed_at = now()
--
-- and never set expired_at.
--
-- completed_at is the record of a visit ENDING. Writing it on a ticket nobody
-- served invents a service time: started_at to completed_at reads as exactly
-- 30 minutes, because that is the timeout, not because anything happened.
--
-- WHAT IT DID TO THE NUMBERS
-- Found 17 October 2026 while looking at service duration. The distribution
-- was bimodal — 38 visits under 5 minutes, a thin middle, then 32 piled into
-- 30-35 minutes and absolutely nothing beyond 35. Every row in that spike was
-- status='cancelled' with completed_at landing 20-40 seconds after
-- turn_expires_at: the next cron tick.
--
-- Because expired_at was null, every query that filters swept tickets the
-- documented way let these through. Median service time, p90, the daily
-- report, the Insights engine, the station timings — all of them counted a
-- 30-minute no-service as a 30-minute visit. Immigration showed median 30.3
-- and p90 30.9, which is not a distribution, it is a ceiling.
--
-- This is the same mistake 0056 fixed for expire_stale_tickets(), the nightly
-- sweep. The per-minute timeout was never fixed with it. CLAUDE.md already
-- states the rule — "a ticket with expired_at set was swept by the nightly
-- job, not served" — and the rule was sound; this function just never
-- complied with it.
--
-- THE FIX
--   * expired_at is set, so every existing exclusion works.
--   * completed_at is left alone, because nothing was completed.
--   * status becomes 'no_show', which is what actually happened: the customer
--     was called and did not come to the counter. 'cancelled' implies someone
--     decided to cancel.

create or replace function public.expire_called_tickets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.tickets
  set status     = 'no_show',
      expired_at = now()
  where status = 'serving'
    and turn_expires_at is not null
    and turn_expires_at < now()
    and expired_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.expire_called_tickets() to anon, authenticated;

comment on function public.expire_called_tickets() is
  'Releases a counter when a called customer does not arrive. Sets expired_at, NEVER completed_at — writing completed_at here forged 30-minute service times for a month. See 0065.';

-- ── Repair the rows already written ──────────────────────────────────
--
-- Identified by their signature: cancelled, with completed_at landing inside
-- the minute after turn_expires_at — the cron tick. A person closing a real
-- visit would not land in that window by accident.
--
-- NOTE, 19 October: an earlier draft of this also required staff_id to be
-- null, on the assumption that an attributed ticket must have been closed by
-- a human. Wrong — three rows (A101-A103) carried a staff_id from
-- auto-assignment while showing the identical fingerprint: exactly 31
-- minutes, cancelled, 36-59 seconds after expiry. The condition was dropped.
--
-- completed_at is cleared because it was never true. expired_at is set to the
-- value it should have had. The rows are kept — they are evidence that a
-- customer was called and not served, which is worth knowing.

update public.tickets
set expired_at   = coalesce(expired_at, completed_at),
    completed_at = null,
    status       = 'no_show'
where status = 'cancelled'
  and completed_at is not null
  and turn_expires_at is not null
  and completed_at >= turn_expires_at
  and completed_at <  turn_expires_at + interval '2 minutes';

-- What was repaired, so the result is visible rather than assumed.
select count(*) as rows_repaired
from public.tickets
where status = 'no_show'
  and completed_at is null
  and expired_at is not null;
