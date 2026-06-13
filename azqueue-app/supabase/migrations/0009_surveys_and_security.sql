-- AzQueue · 0009 — Public surveys + security hardening
-- Run AFTER 0008.
--
-- Adds:
--   1. public.surveys table for customer ratings + feedback
--   2. Anon insert policy on surveys (rate-limited via the policy itself)
--   3. Tighter anon update on tickets (only the row whose id is referenced)
--   4. anon insert rate-limit on tickets (max 5 per phone per 10 minutes)
--   5. Stricter constraints on existing user-facing fields

-- ── 1. Surveys table ─────────────────────────────────────────────────
create table if not exists public.surveys (
  id              uuid primary key default uuid_generate_v4(),
  branch_id       uuid not null references public.branches(id) on delete cascade,
  ticket_id       uuid references public.tickets(id) on delete set null,
  customer_phone  text,                 -- optional; respect anonymous submissions
  rating          int  not null check (rating between 1 and 5),
  feedback        text,
  is_anonymous    boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists surveys_branch_idx       on public.surveys(branch_id, created_at desc);
create index if not exists surveys_ticket_idx       on public.surveys(ticket_id);
create index if not exists surveys_phone_idx        on public.surveys(customer_phone);

alter table public.surveys enable row level security;

-- Branch members can read all surveys for their branch
drop policy if exists surveys_branch_read on public.surveys;
create policy surveys_branch_read on public.surveys for select
  using (user_belongs_to_branch(branch_id));

-- Anon can insert a survey (one per ticket; throttled per phone)
drop policy if exists surveys_public_insert on public.surveys;
create policy surveys_public_insert on public.surveys for insert to anon
with check (
  rating between 1 and 5
  and exists (select 1 from public.branches b where b.id = branch_id)
  -- Ticket-scoped surveys must belong to the branch they're submitted to
  and (
    ticket_id is null
    or exists (select 1 from public.tickets t where t.id = ticket_id and t.branch_id = surveys.branch_id)
  )
  -- One survey per ticket
  and (
    ticket_id is null
    or not exists (select 1 from public.surveys s where s.ticket_id = surveys.ticket_id)
  )
  -- Throttle: max 5 surveys per phone per branch per hour
  and (
    customer_phone is null
    or (
      select count(*)
        from public.surveys s2
       where s2.customer_phone = surveys.customer_phone
         and s2.branch_id = surveys.branch_id
         and s2.created_at > now() - interval '1 hour'
    ) < 5
  )
);

-- ── 2. Tighten anon ticket update — only allow updating location fields ──
-- The previous policy allowed any anon to update any waiting/serving ticket.
-- Combined with id-only knowledge (UUIDs are unguessable), this was OK but
-- now we additionally require that the only fields touched are location ones.
-- Postgres RLS doesn't do field-level — but we add a trigger that blocks any
-- attempted change to identity fields by anon.

create or replace function public.guard_anon_ticket_update()
returns trigger language plpgsql as $$
begin
  -- Only enforce when caller is the anon role
  if current_setting('role', true) is null or current_setting('role', true) <> 'anon' then
    return new;
  end if;

  -- Anon may only update location columns + arrived_at + last_location_at
  if new.token         is distinct from old.token         then raise exception 'anon cannot change token'; end if;
  if new.status        is distinct from old.status        then raise exception 'anon cannot change status'; end if;
  if new.staff_id      is distinct from old.staff_id      then raise exception 'anon cannot change staff_id'; end if;
  if new.service_id    is distinct from old.service_id    then raise exception 'anon cannot change service_id'; end if;
  if new.source        is distinct from old.source        then raise exception 'anon cannot change source'; end if;
  if new.priority      is distinct from old.priority      then raise exception 'anon cannot change priority'; end if;
  if new.customer_name is distinct from old.customer_name then raise exception 'anon cannot change customer_name'; end if;
  if new.customer_phone is distinct from old.customer_phone then raise exception 'anon cannot change customer_phone'; end if;
  if new.created_at    is distinct from old.created_at    then raise exception 'anon cannot change created_at'; end if;
  if new.called_at     is distinct from old.called_at     then raise exception 'anon cannot change called_at'; end if;
  if new.started_at    is distinct from old.started_at    then raise exception 'anon cannot change started_at'; end if;
  if new.completed_at  is distinct from old.completed_at  then raise exception 'anon cannot change completed_at'; end if;
  if new.scheduled_at  is distinct from old.scheduled_at  then raise exception 'anon cannot change scheduled_at'; end if;
  if new.branch_id     is distinct from old.branch_id     then raise exception 'anon cannot change branch_id'; end if;

  return new;
end $$;

drop trigger if exists guard_anon_ticket_update on public.tickets;
create trigger guard_anon_ticket_update
  before update on public.tickets
  for each row execute procedure public.guard_anon_ticket_update();

-- ── 3. Anon ticket insert rate-limit (max 5 per phone per branch / 10 min) ──
create or replace function public.guard_anon_ticket_insert()
returns trigger language plpgsql as $$
begin
  if current_setting('role', true) is distinct from 'anon' then
    return new;
  end if;
  if new.customer_phone is null then
    return new;
  end if;
  if (
    select count(*) from public.tickets
     where customer_phone = new.customer_phone
       and branch_id      = new.branch_id
       and created_at     > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'too many check-ins from this phone — try again in a few minutes';
  end if;
  return new;
end $$;

drop trigger if exists guard_anon_ticket_insert on public.tickets;
create trigger guard_anon_ticket_insert
  before insert on public.tickets
  for each row execute procedure public.guard_anon_ticket_insert();

-- ── 4. Anon booking insert rate-limit (max 3 per phone per branch / day) ──
create or replace function public.guard_anon_booking_insert()
returns trigger language plpgsql as $$
begin
  if current_setting('role', true) is distinct from 'anon' then
    return new;
  end if;
  if new.customer_phone is null then
    return new;
  end if;
  if (
    select count(*) from public.bookings
     where customer_phone = new.customer_phone
       and branch_id      = new.branch_id
       and created_at     > now() - interval '1 day'
  ) >= 3 then
    raise exception 'too many bookings from this phone today';
  end if;
  return new;
end $$;

drop trigger if exists guard_anon_booking_insert on public.bookings;
create trigger guard_anon_booking_insert
  before insert on public.bookings
  for each row execute procedure public.guard_anon_booking_insert();

-- ── 5. Stricter field constraints ────────────────────────────────────
do $$
begin
  -- Lengths to prevent abuse via huge text payloads
  begin
    alter table public.tickets   add constraint tickets_phone_len_chk    check (customer_phone  is null or char_length(customer_phone)  <= 32);
  exception when duplicate_object then null; end;
  begin
    alter table public.tickets   add constraint tickets_name_len_chk     check (customer_name   is null or char_length(customer_name)   <= 80);
  exception when duplicate_object then null; end;
  begin
    alter table public.bookings  add constraint bookings_phone_len_chk   check (customer_phone  is null or char_length(customer_phone)  <= 32);
  exception when duplicate_object then null; end;
  begin
    alter table public.bookings  add constraint bookings_name_len_chk    check (customer_name   is null or char_length(customer_name)   <= 80);
  exception when duplicate_object then null; end;
  begin
    alter table public.surveys   add constraint surveys_feedback_len_chk check (feedback        is null or char_length(feedback)        <= 1000);
  exception when duplicate_object then null; end;
end $$;
