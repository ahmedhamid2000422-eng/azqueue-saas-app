-- 0059 — pausing the queue, and saying what a visit actually is
--
-- Three additions, all nullable, nothing existing changes.

-- ── 1. A queue that can be paused on purpose ─────────────────────────
-- Distinct from the prayer pause, which is automatic and brief. This one is
-- a person deciding to stop taking people, and it stays until someone turns
-- it off — which is exactly why the UI has to keep saying so. A queue
-- silently frozen at 3pm is worse than one that was never paused.
alter table public.branches
  add column if not exists queue_paused_at timestamptz;

comment on column public.branches.queue_paused_at is
  'Set when staff pause the queue by hand. Null means running. Stays set until cleared — the Queue page shows a persistent banner while it is, because a pause nobody remembers is how a waiting room fills with people who will never be called.';

-- ── 2. What the visit actually is ────────────────────────────────────
-- handoff_category is deliberately coarse: dropoff | immigration | taxes.
-- That is right for routing and wrong for a person picking work up later,
-- who needs to know it is an I-130 with two pages missing.
alter table public.tickets
  add column if not exists detail text;

comment on column public.tickets.detail is
  'Free text describing the specific work — "I-130, missing birth certificate". Suggested values live in src/lib/workTypes.js and are a placeholder until the office supplies its real list; staff may always type their own.';

-- ── 3. Escalation, with a limit ──────────────────────────────────────
-- The owner is the manager and the senior advisor. Everything escalates to
-- him by default, which is how a manager ends up handling complaints that
-- were never his to handle. Marking a ticket escalated is deliberate and
-- recorded, so it can be counted later: if most escalations turn out to be
-- one category, that category needs a rule, not his attention.
alter table public.tickets
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_reason text;

comment on column public.tickets.escalated_reason is
  'Why this needed the manager. Recorded so escalations can be counted by reason — a category that escalates every time is a missing rule, not a busy manager.';

create index if not exists tickets_escalated_idx
  on public.tickets(branch_id, escalated_at)
  where escalated_at is not null;
