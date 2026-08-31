-- 0048 — back-office work queue + pickup
--
-- See docs/review-stage-spec.md for the reasoning. In short: most work does
-- not need the customer present once their documents are taken. Today they
-- sit in the waiting room while it's done, which is why waits reach 90
-- minutes at an office that has twice the capacity it needs.
--
-- After this: staff take the documents, assign the work to a category, and
-- the customer goes home. The work waits in a back queue. When it's finished
-- they're emailed to collect it, and they announce themselves at a separate
-- pickup spot via the kiosk.
--
-- THE CRITICAL RULE
-- Back-queue work is NOT someone waiting in line. Every wait figure, the TV
-- display, the queue count and every insight must exclude it. Mixing the two
-- silently corrupts every number the product reports. Statuses are kept
-- distinct precisely so that this is hard to get wrong.

-- ── Work handoff ────────────────────────────────────────────────────
alter table public.tickets
  add column if not exists handoff_category  text,
  add column if not exists assigned_to       uuid references public.staff(id) on delete set null,
  add column if not exists taken_in_by       uuid references public.staff(id) on delete set null,
  add column if not exists handed_off_at     timestamptz,
  add column if not exists work_started_at   timestamptz,
  add column if not exists work_done_at      timestamptz,
  add column if not exists ready_notified_at timestamptz,
  add column if not exists collected_at      timestamptz;

comment on column public.tickets.handoff_category is
  'dropoff | immigration | taxes — coarse on purpose. Staff pick this many times a day; a long list gets picked wrong and the data becomes noise.';
comment on column public.tickets.handed_off_at is
  'When the customer left and the work entered the back queue. A ticket with this set is NOT waiting in line.';
comment on column public.tickets.ready_notified_at is
  'When the "ready to collect" email went out. Set only after a successful send so failures retry.';

-- Categories are constrained rather than free text: a typo here would split
-- a category in two and quietly break every per-category figure.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tickets_handoff_category_check'
  ) then
    alter table public.tickets
      add constraint tickets_handoff_category_check
      check (handoff_category is null
             or handoff_category in ('dropoff', 'immigration', 'taxes'));
  end if;
end $$;

-- The back queue itself: work handed off but not yet finished.
create index if not exists tickets_back_queue_idx
  on public.tickets(branch_id, handed_off_at)
  where handed_off_at is not null and work_done_at is null;

-- Finished but not yet collected — what a pickup lookup searches.
create index if not exists tickets_ready_pickup_idx
  on public.tickets(branch_id, work_done_at)
  where work_done_at is not null and collected_at is null;

-- ── Services ────────────────────────────────────────────────────────
alter table public.services
  add column if not exists customer_must_be_present boolean not null default false,
  add column if not exists is_pickup                boolean not null default false;

comment on column public.services.customer_must_be_present is
  'Notarisation, signatures, identity checks. These can never be handed off — the customer has to be in the room.';
comment on column public.services.is_pickup is
  'The collection service. Routes to the pickup spot and is excluded from wait statistics.';

-- ── Turnaround promises ─────────────────────────────────────────────
-- Per category, because drop-offs are worked at weekends and are genuinely
-- slower. One global promise would be wrong for at least one category, and a
-- missed promise is worse than a vaguer one. Whatever goes in here is quoted
-- to the customer, so it must be what the office can actually keep.
alter table public.branches
  add column if not exists turnaround_days jsonb
    not null default '{"dropoff": 7, "immigration": 3, "taxes": 2}'::jsonb;

-- ── Pickup announcements ────────────────────────────────────────────
-- Someone standing at an unstaffed desk. Deliberately its own table rather
-- than a ticket status: this is a person ringing a bell, not a queue entry,
-- and it must never acquire a position or an estimated wait.
create table if not exists public.pickup_waits (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.branches(id) on delete cascade,
  ticket_id      uuid references public.tickets(id) on delete set null,
  customer_id    uuid references public.customers(id) on delete set null,
  display_name   text,
  announced_at   timestamptz not null default now(),
  acknowledged_at timestamptz,
  collected_at   timestamptz,
  escalated_at   timestamptz
);

create index if not exists pickup_waits_open_idx
  on public.pickup_waits(branch_id, announced_at)
  where collected_at is null;

alter table public.pickup_waits enable row level security;

-- Staff of the branch see and manage their own pickups.
drop policy if exists "pickups readable by branch" on public.pickup_waits;
create policy "pickups readable by branch"
  on public.pickup_waits for select
  using (public.user_belongs_to_branch(branch_id));

drop policy if exists "pickups writable by branch" on public.pickup_waits;
create policy "pickups writable by branch"
  on public.pickup_waits for update
  using (public.user_belongs_to_branch(branch_id))
  with check (public.user_belongs_to_branch(branch_id));

-- The kiosk is unauthenticated, so announcing a pickup must be insertable by
-- anon — but ONLY against a ticket that is genuinely finished and uncollected
-- for that branch. Without that check, anyone could spam the staff banner.
drop policy if exists "kiosk can announce a pickup" on public.pickup_waits;
create policy "kiosk can announce a pickup"
  on public.pickup_waits for insert
  to anon
  with check (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.branch_id = pickup_waits.branch_id
        and t.work_done_at is not null
        and t.collected_at is null
    )
  );

-- ── Looking someone up at the kiosk ─────────────────────────────────
-- SECURITY DEFINER so the kiosk can match an email without being able to read
-- the tickets or customers tables. It returns the bare minimum: is there
-- something ready, and a first name to greet them by.
--
-- Deliberately does NOT return what they're collecting. A kiosk screen is
-- visible to whoever is standing behind them, and immigration or tax work is
-- not something to display in a public waiting room.
create or replace function public.find_pickup(
  p_branch_slug text,
  p_contact     text
)
returns table (
  ticket_id    uuid,
  branch_id    uuid,
  first_name   text,
  status       text        -- 'ready' | 'in_progress' | 'none'
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch uuid;
  v_clean  text := lower(trim(p_contact));
  v_digits text := regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g');
begin
  select b.id into v_branch from public.branches b where b.slug = p_branch_slug;
  if v_branch is null then
    return query select null::uuid, null::uuid, null::text, 'none'::text;
    return;
  end if;

  -- Ready to collect wins over still-being-worked-on.
  return query
  select t.id,
         t.branch_id,
         split_part(coalesce(t.customer_name, ''), ' ', 1),
         case when t.work_done_at is not null then 'ready' else 'in_progress' end
  from public.tickets t
  where t.branch_id = v_branch
    and t.handed_off_at is not null
    and t.collected_at is null
    and (
      lower(trim(coalesce(t.customer_email, ''))) = v_clean
      or (v_digits <> '' and regexp_replace(coalesce(t.customer_phone, ''), '[^0-9]', '', 'g') = v_digits)
    )
  order by (t.work_done_at is not null) desc, t.handed_off_at desc
  limit 1;

  if not found then
    return query select null::uuid, v_branch, null::text, 'none'::text;
  end if;
end $$;

revoke all on function public.find_pickup(text, text) from public;
grant execute on function public.find_pickup(text, text) to anon, authenticated;

comment on function public.find_pickup is
  'Kiosk lookup by email or phone. Returns only whether something is ready and a first name — never what the person is collecting, because the kiosk screen is public.';
