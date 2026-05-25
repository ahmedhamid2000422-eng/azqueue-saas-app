-- 0017_loyalty.sql
-- Digital punch card loyalty program.
-- One program per branch. One card per customer per branch.
-- Punches auto-awarded on ticket completion; staff can also award bonus punches.

-- Branch configures their program
create table if not exists public.loyalty_programs (
  id                  uuid primary key default gen_random_uuid(),
  branch_id           uuid not null references public.branches(id) on delete cascade,
  name                text not null default 'Loyalty Card',
  punches_required    int  not null default 10 check (punches_required between 1 and 50),
  reward_description  text not null default 'Free service of your choice',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (branch_id)
);

-- One card per customer per branch (tracks running punch count + lifetime total)
create table if not exists public.loyalty_cards (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id) on delete cascade,
  customer_id       uuid not null references public.customers(id) on delete cascade,
  current_punches   int  not null default 0,  -- resets to 0 after reward claimed
  lifetime_punches  int  not null default 0,  -- never resets
  rewards_earned    int  not null default 0,
  rewards_redeemed  int  not null default 0,
  last_punch_at     timestamptz,
  created_at        timestamptz not null default now(),
  unique (branch_id, customer_id)
);

-- Every punch and reward event
create table if not exists public.loyalty_events (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id) on delete cascade,
  card_id      uuid not null references public.loyalty_cards(id) on delete cascade,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  ticket_id    uuid references public.tickets(id) on delete set null,
  staff_id     uuid references public.staff(id) on delete set null,
  event_type   text not null check (event_type in ('punch', 'bonus_punch', 'reward_earned', 'reward_redeemed')),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists loyalty_cards_branch_idx    on public.loyalty_cards(branch_id);
create index if not exists loyalty_cards_customer_idx  on public.loyalty_cards(customer_id);
create index if not exists loyalty_events_card_idx     on public.loyalty_events(card_id, created_at desc);

-- RLS
alter table public.loyalty_programs enable row level security;
alter table public.loyalty_cards    enable row level security;
alter table public.loyalty_events   enable row level security;

-- Branch staff can manage programs
create policy "staff manage loyalty_programs"
  on public.loyalty_programs using (
    exists (select 1 from public.staff s where s.branch_id = loyalty_programs.branch_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.staff s where s.branch_id = loyalty_programs.branch_id and s.user_id = auth.uid())
  );

create policy "owners manage loyalty_programs"
  on public.loyalty_programs using (
    exists (select 1 from public.branches b where b.id = loyalty_programs.branch_id and b.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.branches b where b.id = loyalty_programs.branch_id and b.user_id = auth.uid())
  );

-- Cards + events — same pattern
create policy "staff manage loyalty_cards"
  on public.loyalty_cards using (
    exists (select 1 from public.staff s where s.branch_id = loyalty_cards.branch_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.staff s where s.branch_id = loyalty_cards.branch_id and s.user_id = auth.uid())
  );

create policy "owners manage loyalty_cards"
  on public.loyalty_cards using (
    exists (select 1 from public.branches b where b.id = loyalty_cards.branch_id and b.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.branches b where b.id = loyalty_cards.branch_id and b.user_id = auth.uid())
  );

create policy "staff manage loyalty_events"
  on public.loyalty_events using (
    exists (select 1 from public.staff s where s.branch_id = loyalty_events.branch_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.staff s where s.branch_id = loyalty_events.branch_id and s.user_id = auth.uid())
  );

create policy "owners manage loyalty_events"
  on public.loyalty_events using (
    exists (select 1 from public.branches b where b.id = loyalty_events.branch_id and b.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.branches b where b.id = loyalty_events.branch_id and b.user_id = auth.uid())
  );
