-- 0054 — allow the arrival-channel values
--
-- 0001_init.sql constrained tickets.source to ('walk','book'). Splitting
-- check-ins into "kiosk" (the counter iPad, marked by ?kiosk=1) and
-- "own_device" shipped without widening it, so every check-in failed with
-- "check-in couldn't be completed" until this ran. Recorded here so the
-- constraint and the code can't drift apart again.
--
-- 'walk' is kept, not migrated. Every ticket before the split carries it and
-- there is no way to know which device those came from — rewriting them into
-- kiosk or own_device would invent the answer to the question the split
-- exists to ask. It reports as "route not recorded" and empties itself as
-- those tickets age out of the 30-day window.

alter table public.tickets drop constraint if exists tickets_source_check;

alter table public.tickets
  add constraint tickets_source_check
  check (source in ('walk', 'book', 'kiosk', 'own_device'));

comment on column public.tickets.source is
  'How the visit entered the queue: walk (legacy, device unknown) | book | kiosk (counter iPad) | own_device (customer phone).';
