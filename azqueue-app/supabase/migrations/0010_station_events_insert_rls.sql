-- =====================================================================
-- AzQueue · 0010 — Fix missing INSERT policy on station_events
-- Additive only. Zero changes to any existing table or policy.
-- Requires: 0008_stations.sql
-- =====================================================================
--
-- WHAT THIS FIXES:
--   0008 created station_events with only a SELECT policy.
--   stations.js calls two direct client-side inserts:
--     - setStationStatus()  → inserts paused/resumed events
--     - reassignTicket()    → inserts assigned events
--   Without an INSERT policy, RLS silently drops those rows.
--   The route_next_ticket RPC is security definer so it was unaffected.
--
-- SCOPE:
--   Branch members (owner or staff of that branch) may insert
--   station_events for stations that belong to their branch.
--   Reads are still restricted to branch members via the existing
--   station_events_read policy.

create policy "station_events_insert" on public.station_events
  for insert
  with check (
    station_id in (
      select s.id from public.stations s
      where s.branch_id in (
        select id   from public.branches where owner_id = auth.uid()
        union
        select branch_id from public.staff where user_id = auth.uid()
      )
    )
  );
