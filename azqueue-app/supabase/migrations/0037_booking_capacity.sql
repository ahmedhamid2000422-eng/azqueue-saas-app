-- AzQueue · 0037 — Booking capacity cap per branch
--
-- Adds max_daily_bookings (nullable int) to branches.
-- Null = unlimited. When the day's confirmed booking count reaches
-- this value, the public booking page shows "Fully booked — try walk-in"
-- with a link to the walk-in kiosk (/q/:slug).

alter table public.branches
  add column if not exists max_daily_bookings int
  check (max_daily_bookings is null or max_daily_bookings > 0);

comment on column public.branches.max_daily_bookings is
  'Max confirmed bookings per calendar day. NULL = unlimited.';
