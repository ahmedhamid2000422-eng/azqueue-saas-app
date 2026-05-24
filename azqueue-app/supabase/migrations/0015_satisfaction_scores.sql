-- 0015_satisfaction_scores.sql
-- Customer satisfaction scores submitted by staff after each service visit.

create table if not exists public.satisfaction_scores (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id) on delete cascade,
  ticket_id    uuid references public.tickets(id) on delete set null,
  customer_id  uuid references public.customers(id) on delete set null,
  staff_id     uuid references public.staff(id) on delete set null,
  score        smallint not null check (score between 1 and 5),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists satisfaction_scores_branch_idx    on public.satisfaction_scores(branch_id, created_at desc);
create index if not exists satisfaction_scores_customer_idx  on public.satisfaction_scores(customer_id) where customer_id is not null;
create index if not exists satisfaction_scores_ticket_idx    on public.satisfaction_scores(ticket_id)   where ticket_id  is not null;

-- Only authenticated branch staff can read/write scores for their own branch.
alter table public.satisfaction_scores enable row level security;

create policy "branch staff can manage scores"
  on public.satisfaction_scores
  using (
    exists (
      select 1 from public.staff s
      where s.branch_id = satisfaction_scores.branch_id
        and s.user_id   = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.staff s
      where s.branch_id = satisfaction_scores.branch_id
        and s.user_id   = auth.uid()
    )
  );

-- Branch owners can also access.
create policy "branch owners can manage scores"
  on public.satisfaction_scores
  using (
    exists (
      select 1 from public.branches b
      where b.id      = satisfaction_scores.branch_id
        and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.branches b
      where b.id      = satisfaction_scores.branch_id
        and b.user_id = auth.uid()
    )
  );
