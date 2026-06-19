-- AzQueue · 0035 — Add booking_id to notifications_log (QA bug B8)
--
-- Context: B8 reported "missing WhatsApp booking confirmation message."
-- Investigation found notifications_log / send-notification were built
-- entirely around `tickets` (check-in flow, B5) — there was no path at
-- all wired up to send a WhatsApp confirmation when a customer books an
-- appointment via the public /b/:slug page or the in-app Bookings screen.
--
-- This migration adds a nullable `booking_id` column so a notification
-- row can reference a booking instead of a ticket (exactly one of
-- ticket_id / booking_id will be set, never both). See the companion
-- code change in supabase/functions/send-notification/index.ts, which
-- now accepts a `bookingId` body param and a new "booking_confirmation"
-- template, hydrating from `bookings` instead of `tickets` when present.
--
-- Safe to run multiple times — uses `add column if not exists`.

alter table public.notifications_log
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create index if not exists notifications_log_booking_idx
  on public.notifications_log(booking_id)
  where booking_id is not null;
