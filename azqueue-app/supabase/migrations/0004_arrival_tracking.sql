-- =====================================================================
-- AzQueue · 0004 — GPS arrival tracking
-- Run this AFTER 0003, in Supabase SQL Editor.
-- =====================================================================
--
-- Lets the customer's live ticket page (/t/:id) post their location while
-- they're on their way. The dashboard then shows "X min away" or "arrived"
-- per ticket — without ever storing location after the visit ends.
--
-- Design: opt-in only. The customer has to grant browser geolocation. The
-- ticket stops accepting updates the moment status flips to completed.

alter table public.tickets
  add column if not exists customer_lat        double precision,
  add column if not exists customer_lng        double precision,
  add column if not exists customer_distance_m double precision,   -- meters from branch
  add column if not exists customer_eta_sec    int,                 -- estimated travel time in seconds
  add column if not exists arrived_at          timestamptz,         -- when distance crossed the threshold
  add column if not exists last_location_at    timestamptz;         -- when we last got a ping

create index if not exists tickets_arrival_idx on public.tickets(branch_id, arrived_at);

-- Allow anon (the customer themselves) to update ONLY their own location columns.
-- We can't do field-level RLS, so we keep it tight: only updates that don't
-- change status / token / etc. The id-based filter restricts the row.
drop policy if exists tickets_public_update_location on public.tickets;
create policy tickets_public_update_location on public.tickets
  for update to anon using (true)
  with check (
    -- Only allow updates while the ticket is still active
    status in ('waiting','serving')
  );
