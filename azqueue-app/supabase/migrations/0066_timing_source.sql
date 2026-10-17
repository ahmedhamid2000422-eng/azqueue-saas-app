-- 0066 — was this visit recorded as it happened, or caught up afterwards?
--
-- THE PROBLEM THIS ANSWERS
-- Measured 17 October: median "service time" for a Consultation is 1.5
-- minutes, Document Review 0.7, Follow-up 1.0 — with p90s of 13-21 minutes.
-- More than half of all visits are closed within a minute or two of being
-- called.
--
-- A 1.5-minute consultation did not happen. The likeliest explanation is that
-- staff serve the customer first and tap Call and Done together afterwards to
-- keep the list tidy. The timestamps record when somebody tapped, not when
-- anybody was served. Staff attribution sitting at 0% supports the same
-- reading: nobody tapping through a list thinks to set "Served by".
--
-- WHY A COLUMN AND NOT A FIX
-- Because the behaviour is reasonable. A two-person office at peak season is
-- not going to produce perfect live timestamps, and a product that treats
-- catching-up as an error will be ignored or worked around within a week.
--
-- What matters is being able to TELL THE TWO APART. A median taken from
-- visits recorded live is a real number. A median taken from all visits is
-- the one that produced 1.5 minutes. One column separates them.
--
--   null      — unknown. Every row before this migration, and anything the
--               staff member did not answer. Treat as unusable for duration.
--   'live'    — pressed while the customer was there.
--   'catch_up'— recorded afterwards. The visit happened; the timestamps did
--               not.
--
-- SAFETY
-- Nullable, no default beyond null, nothing deployed reads it. Safe to run at
-- any time, including during office hours.

alter table public.tickets
  add column if not exists timing_source text
    check (timing_source is null or timing_source in ('live', 'catch_up'));

comment on column public.tickets.timing_source is
  'Whether Done was pressed as the visit ended (live) or while catching up afterwards (catch_up). Null = unknown, including every ticket before 0066. Duration statistics must use live rows only — see docs/baseline-2026-10.md.';

-- Duration queries filter on this, over a date range, for one branch.
create index if not exists tickets_timing_source_idx
  on public.tickets(branch_id, timing_source, completed_at)
  where timing_source is not null;
