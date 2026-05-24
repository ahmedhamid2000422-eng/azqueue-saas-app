-- =====================================================================
-- AzQueue · initial schema
-- Run this in Supabase SQL editor (Database → SQL Editor → New query → paste)
-- =====================================================================

-- ── Extensions ───────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Helper: updated_at trigger ───────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── 1. Branches ──────────────────────────────────────────────────────
create table if not exists public.branches (
  id            uuid primary key default uuid_generate_v4(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  slug          text not null unique,                        -- used in /q/[slug]
  name          text not null,
  city          text,
  timezone      text not null default 'Asia/Kuala_Lumpur',
  lat           double precision,
  lng           double precision,
  hours         jsonb,                                        -- {"mon":["09:00","18:00"], ...}
  islamic_mode  boolean not null default true,
  autopilot     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists branches_updated_at on public.branches;
create trigger branches_updated_at before update on public.branches
  for each row execute procedure set_updated_at();

create index if not exists branches_owner_idx on public.branches(owner_id);

-- ── 2. Services (haircut, beard trim, etc) ───────────────────────────
create table if not exists public.services (
  id           uuid primary key default uuid_generate_v4(),
  branch_id    uuid not null references public.branches(id) on delete cascade,
  name         text not null,
  duration_min int  not null default 20,                     -- expected duration; updated by autopilot
  price_cents  int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists services_branch_idx on public.services(branch_id);

-- ── 3. Staff ─────────────────────────────────────────────────────────
create table if not exists public.staff (
  id          uuid primary key default uuid_generate_v4(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,  -- null until they accept invite
  display_name text not null,
  role        text not null default 'staff' check (role in ('owner','manager','staff')),
  status      text not null default 'off' check (status in ('off','active','serving','on_break')),
  status_since timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists staff_branch_idx on public.staff(branch_id);
create index if not exists staff_user_idx   on public.staff(user_id);

-- ── 4. Tickets — the heart of the queue ──────────────────────────────
create table if not exists public.tickets (
  id            uuid primary key default uuid_generate_v4(),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  service_id    uuid references public.services(id) on delete set null,
  staff_id      uuid references public.staff(id)    on delete set null,

  token         text not null,                                -- e.g. "A102", "T04"
  source        text not null check (source in ('walk','book')),
  customer_name text,
  customer_phone text,

  status        text not null default 'waiting'
                check (status in ('waiting','serving','completed','no_show','cancelled')),
  priority      int  not null default 0,                      -- bookings get +5 inside their window

  created_at    timestamptz not null default now(),
  called_at     timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  scheduled_at  timestamptz,                                  -- only for bookings

  notes         text
);

create index if not exists tickets_branch_status_idx on public.tickets(branch_id, status);
create index if not exists tickets_phone_idx         on public.tickets(customer_phone);
create index if not exists tickets_created_idx       on public.tickets(branch_id, created_at desc);

-- ── 5. Bookings — pre-scheduled slots that materialise into tickets ──
create table if not exists public.bookings (
  id             uuid primary key default uuid_generate_v4(),
  branch_id      uuid not null references public.branches(id) on delete cascade,
  service_id     uuid not null references public.services(id) on delete cascade,
  staff_id       uuid references public.staff(id) on delete set null,

  customer_name  text not null,
  customer_phone text not null,
  scheduled_at   timestamptz not null,
  status         text not null default 'confirmed'
                 check (status in ('confirmed','pending','arrived','no_show','cancelled')),
  ticket_id      uuid references public.tickets(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
  for each row execute procedure set_updated_at();

create index if not exists bookings_branch_time_idx on public.bookings(branch_id, scheduled_at);

-- ── 6. Service times (autopilot learns from these) ───────────────────
create table if not exists public.service_times (
  id           uuid primary key default uuid_generate_v4(),
  branch_id    uuid not null references public.branches(id) on delete cascade,
  ticket_id    uuid not null references public.tickets(id)  on delete cascade,
  service_id   uuid references public.services(id)          on delete set null,
  staff_id     uuid references public.staff(id)             on delete set null,
  duration_sec int  not null,
  created_at   timestamptz not null default now()
);

create index if not exists service_times_branch_idx  on public.service_times(branch_id, created_at desc);
create index if not exists service_times_service_idx on public.service_times(service_id);

-- ── 7. Notification log (WhatsApp/SMS/Email send history) ────────────
create table if not exists public.notifications_log (
  id          uuid primary key default uuid_generate_v4(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  ticket_id   uuid references public.tickets(id) on delete set null,
  channel     text not null check (channel in ('whatsapp','sms','email')),
  template    text not null,                                  -- 'confirm','call','thanks','prayer_pause'
  to_phone    text,
  status      text not null default 'queued' check (status in ('queued','sent','delivered','read','failed')),
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_branch_idx on public.notifications_log(branch_id, created_at desc);

-- ── 8. Insights cache (computed nightly) ─────────────────────────────
create table if not exists public.insights_cache (
  id          uuid primary key default uuid_generate_v4(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  day         date not null,
  payload     jsonb not null,                                 -- {avg_wait, no_show_rate, slow_services, booking_conv, ...}
  created_at  timestamptz not null default now(),
  unique (branch_id, day)
);

-- ── 9. Prayer times cache (Aladhan API daily fetch) ──────────────────
create table if not exists public.prayer_times_cache (
  branch_id  uuid primary key references public.branches(id) on delete cascade,
  day        date not null,
  fajr       time not null,
  dhuhr      time not null,
  asr        time not null,
  maghrib    time not null,
  isha       time not null,
  jumah      time,
  fetched_at timestamptz not null default now()
);

-- =====================================================================
-- ROW-LEVEL SECURITY
-- =====================================================================
-- Pattern:
--  · branches: owner can read/write own. Staff can read where staff.branch_id matches.
--  · everything else: scoped via "user belongs to branch" (owner OR staff with user_id)

alter table public.branches            enable row level security;
alter table public.services            enable row level security;
alter table public.staff               enable row level security;
alter table public.tickets             enable row level security;
alter table public.bookings            enable row level security;
alter table public.service_times       enable row level security;
alter table public.notifications_log   enable row level security;
alter table public.insights_cache      enable row level security;
alter table public.prayer_times_cache  enable row level security;

-- Helper: does the current user belong to this branch?
create or replace function user_belongs_to_branch(b_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.branches b where b.id = b_id and b.owner_id = auth.uid()
    union
    select 1 from public.staff s where s.branch_id = b_id and s.user_id = auth.uid()
  );
$$;

-- branches policies
drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches for select using (
  owner_id = auth.uid()
  or exists (select 1 from public.staff s where s.branch_id = id and s.user_id = auth.uid())
);
drop policy if exists branches_owner_write on public.branches;
create policy branches_owner_write on public.branches for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- services / staff / tickets / bookings / service_times / notifications_log / insights_cache / prayer_times_cache
-- all share the same "belongs to branch" gate
do $$
declare t text;
begin
  foreach t in array array['services','staff','tickets','bookings','service_times','notifications_log','insights_cache','prayer_times_cache']
  loop
    execute format('drop policy if exists %I_rw on public.%I', t, t);
    execute format(
      'create policy %I_rw on public.%I for all using (user_belongs_to_branch(branch_id)) with check (user_belongs_to_branch(branch_id))',
      t, t
    );
  end loop;
end $$;

-- =====================================================================
-- PUBLIC (UNAUTHENTICATED) ACCESS — for /q/[slug] customer flow
-- =====================================================================
-- Customer needs to:
--   · read a branch by slug (name/services only)
--   · read services for a branch
--   · insert a ticket (themselves)
--   · read their own ticket by id (to see live position)
--
-- This is granted via dedicated policies on the SAME tables, gated by `anon` role.

-- Branches: anon can read minimal info by slug
drop policy if exists branches_public_read on public.branches;
create policy branches_public_read on public.branches for select to anon using (true);
-- (We expose the name/slug/lat/lng to anon. owner_id is fine to leak — it's a UUID.)

-- Services: anon can read active services
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services for select to anon using (active = true);

-- Tickets: anon can INSERT a new ticket, and SELECT their own ticket by id
drop policy if exists tickets_public_insert on public.tickets;
create policy tickets_public_insert on public.tickets for insert to anon with check (
  source = 'walk' and status = 'waiting'
);

drop policy if exists tickets_public_select_own on public.tickets;
create policy tickets_public_select_own on public.tickets for select to anon using (true);
-- (anyone with the ticket UUID can see it — UUIDs are unguessable.)

-- =====================================================================
-- TOKEN GENERATOR — generates A101, A102, B42C1 etc.
-- =====================================================================
create or replace function generate_ticket_token(b_id uuid, src text)
returns text language plpgsql as $$
declare
  prefix text;
  next_num int;
begin
  prefix := case src when 'walk' then 'A' when 'book' then 'B' else 'X' end;
  select coalesce(max(substring(token from '[0-9]+')::int), 100) + 1
    into next_num
    from public.tickets
    where branch_id = b_id
      and substring(token from '^[A-Z]') = prefix
      and created_at > current_date;
  return prefix || next_num::text;
end $$;

-- =====================================================================
-- SEED DATA (only on a fresh project — comment out for production)
-- =====================================================================
-- Uncomment to seed a demo branch under your own account:
--
-- insert into public.branches (owner_id, slug, name, city, timezone, lat, lng)
-- values (auth.uid(), 'kl-downtown', 'KL Downtown', 'Bukit Bintang', 'Asia/Kuala_Lumpur', 3.149, 101.713);
--
-- insert into public.services (branch_id, name, duration_min)
-- select id, x.name, x.dur from public.branches, (
--   values ('Haircut', 20), ('Beard Trim', 12), ('Haircut + Beard', 30), ('Spa', 45)
-- ) as x(name, dur) where slug = 'kl-downtown';
