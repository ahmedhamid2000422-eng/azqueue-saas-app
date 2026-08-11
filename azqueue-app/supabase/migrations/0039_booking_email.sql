-- AzQueue · 0039 — Add customer_email to bookings
--
-- Email is now the primary customer notification channel (transactional,
-- no A2P 10DLC carrier registration required). Tickets already have
-- customer_email (migration 0014); bookings did not.

alter table public.bookings
  add column if not exists customer_email text;

create index if not exists bookings_customer_email_idx
  on public.bookings(branch_id, customer_email)
  where customer_email is not null;

-- Phone is no longer strictly required now that email can carry notifications.
alter table public.bookings
  alter column customer_phone drop not null;
