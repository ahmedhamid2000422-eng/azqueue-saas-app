-- =====================================================================
-- AzQueue · 0013 — Bounce-count escalation
-- Additive only. Zero changes to existing rows or constraints.
-- Requires: 0009_sla.sql, 0001_init.sql
-- =====================================================================
--
-- WHAT THIS ADDS:
--   1. tickets.bounce_count  — how many times this ticket was parked
--      back into the waiting queue mid-service. Incremented by Queue.jsx
--      whenever staff press "Park". Default 0, can never go below 0.
--
--   2. sla_policies.bounce_warn_count   — default 2 bounces → warning
--      sla_policies.bounce_breach_count — default 3 bounces → breach
--      If bounce SLA is not desired, set both to a very high number
--      or rely on the enabled flag (sweep checks bounce thresholds only
--      when enabled = true, same as time thresholds).
--
--   3. No new table — bounce escalations reuse the existing `escalations`
--      table with reason = 'bounce_excessive'. The `reason` column has
--      no CHECK constraint, so no DDL change is needed there.
--
-- ETHICS NOTE:
--   bounce_count is on the TICKET, not on a staff_id or user_id.
--   A high bounce count signals a service-flow problem or a complex case,
--   not a person to blame. The manager UI reflects this framing.

-- ── 1. Bounce counter on tickets ──────────────────────────────────────
alter table public.tickets
  add column if not exists bounce_count integer not null default 0;

-- Prevent accidental negatives (belt + suspenders)
alter table public.tickets
  add constraint if not exists tickets_bounce_count_non_negative
  check (bounce_count >= 0);

-- Index for the sweep query (tickets with high bounce counts)
create index if not exists tickets_bounce_idx
  on public.tickets(branch_id, bounce_count desc)
  where status in ('waiting', 'serving') and bounce_count > 0;

-- ── 2. Bounce thresholds on SLA policy ───────────────────────────────
alter table public.sla_policies
  add column if not exists bounce_warn_count   integer not null default 2;

alter table public.sla_policies
  add column if not exists bounce_breach_count integer not null default 3;

-- Ensure warn < breach (UI enforces this too, but belt + suspenders)
alter table public.sla_policies
  add constraint if not exists sla_bounce_order_check
  check (bounce_breach_count > bounce_warn_count);
