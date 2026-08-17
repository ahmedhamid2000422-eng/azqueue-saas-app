-- 0015_satisfaction_scores.sql
-- Customer satisfaction scores submitted by staff after each service visit.
--
-- FIXED: the original version of this migration referenced `b.user_id` on
-- public.branches, but that column is `owner_id` — so the migration errored
-- and the table was never created, producing 404s from the Queue page.
-- It now uses the existing user_belongs_to_branch() helper from 0001_init,
-- which covers both branch owners and assigned staff.

create table if not exists public.satisfaction_scores (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id) on delete cascade,
  ticket_id    uuid references public.tickets(id)   on delete set null,
  customer_id  uuid references public.customers(id) on delete set null,
  staff_id     uuid references public.staff(id)     on delete set null,
  score        smallint not null check (score between 1 and 5),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists satisfaction_scores_branch_idx
  on public.satisfaction_scores(branch_id, created_at desc);
create index if not exists satisfaction_scores_customer_idx
  on public.satisfaction_scores(customer_id) where customer_id is not null;
create index if not exists satisfaction_scores_ticket_idx
  on public.satisfaction_scores(ticket_id)   where ticket_id  is not null;

alter table public.satisfaction_scores enable row level security;

-- Replace any partially-created policies from earlier attempts
drop policy if exists "branch staff can manage scores"  on public.satisfaction_scores;
drop policy if exists "branch owners can manage scores" on public.satisfaction_scores;
drop policy if exists satisfaction_scores_branch_access on public.satisfaction_scores;

-- Owners and staff of the branch can read and write its scores.
create policy satisfaction_scores_branch_access
  on public.satisfaction_scores
  for all
  using      (user_belongs_to_branch(branch_id))
  with check (user_belongs_to_branch(branch_id));

select 'satisfaction_scores installed' as status;
