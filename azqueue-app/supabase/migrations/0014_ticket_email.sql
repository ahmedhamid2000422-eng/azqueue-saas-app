-- =====================================================================
-- AzQueue · 0014 — Add customer_email to tickets
-- Additive only. Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS).
-- =====================================================================
--
-- NOTE: If you haven't run 0011_customers.sql yet, run ALL of these in order
-- in your Supabase SQL Editor:
--   0011_customers.sql  — creates customers, customer_events, customer_notes,
--                          customer_summaries tables + RLS policies
--   0012_*.sql          — (if present)
--   0013_*.sql          — (if present)
--   0014_ticket_email.sql (this file)
--
-- The "Could not find the 'branch_id' column of 'customers'" error means
-- 0011 has not been applied. Run it first.
-- =====================================================================

-- Add email field to tickets so it's captured at check-in time
-- even before a customer profile is resolved.
alter table public.tickets
  add column if not exists customer_email text;

-- Lightweight index so staff can look up tickets by email
create index if not exists tickets_customer_email_idx
  on public.tickets(branch_id, customer_email)
  where customer_email is not null;
