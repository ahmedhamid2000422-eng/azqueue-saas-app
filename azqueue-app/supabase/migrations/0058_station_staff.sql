-- 0058 — who is normally at this counter
--
-- 0008 kept stations and staff deliberately apart: "A station is a
-- place/counter/role that does work. It is NOT a person." That holds for a
-- bank with a dozen windows, where a counter outlives whoever sits at it.
--
-- It does not match a two-person office, where "Counter 1" and "Mohamed" mean
-- the same thing to everyone who works there. So a station may now name the
-- person usually at it.
--
-- WHAT THIS IS NOT
-- It is not the record of who served a customer. That is tickets.staff_id,
-- written from the "Serving from this device" picker on the Queue page, and
-- it stays the single source of truth. If a station's default and the device
-- picker disagreed and both wrote to tickets, attribution would be wrong
-- again in a way nobody would notice — which is the failure this project has
-- already had once, when staff_id was never written at all.
--
-- So: staff_id here is a LABEL and a DEFAULT. It lets the TV show
-- "Counter 1 — Mohamed" and lets the device picker start on the right person.
-- Nothing reads it when recording a visit.

alter table public.stations
  add column if not exists staff_id uuid
    references public.staff(id) on delete set null;

comment on column public.stations.staff_id is
  'Who is normally at this counter. A label and a default only — the record of who actually served a customer is tickets.staff_id, set per device on the Queue page. Never write this to a ticket.';

create index if not exists stations_staff_idx
  on public.stations(staff_id)
  where staff_id is not null;
