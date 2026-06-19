-- AzQueue · 0034 — Add missing senior-advisor columns on staff (QA bug B2, part 2)
--
-- Context: while fixing B2 ("invited teammate never appears"), live testing
-- traced the root cause to migration 0002_staff_invite_link.sql never having
-- been run against the live database (the `invite_email` column it adds is
-- missing, so the invite insert fails silently). That migration is already
-- fully idempotent (`add column if not exists`, `create or replace function`,
-- `drop trigger if exists` + `create trigger`) — safe to re-run as-is; no new
-- migration needed for that part. Please run 0002_staff_invite_link.sql in
-- the Supabase SQL Editor if you haven't already.
--
-- Separately, this migration fixes a second, related gap found in the same
-- file (src/modes/business/Settings.jsx, StaffTab): the "Senior Advisor"
-- toggle and per-staff advisor fee read/write `is_senior_advisor` and
-- `advisor_fee` columns that no migration ever created. Clicking that toggle
-- would fail the same silent way B2 did. This adds ONLY those two columns
-- (extend-only) — nothing else on `staff` is touched.
--
-- Safe to run multiple times — uses `add column if not exists`.

alter table public.staff
  add column if not exists is_senior_advisor boolean not null default false,
  add column if not exists advisor_fee       numeric;
