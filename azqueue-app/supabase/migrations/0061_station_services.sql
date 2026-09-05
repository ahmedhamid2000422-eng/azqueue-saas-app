-- 0061 — what each counter can actually handle
--
-- THE PROBLEM THIS SOLVES
-- Az Tax Services has one shared login and three people with genuinely
-- different capabilities. Mohamed does notarisation, divorce cases and
-- specialised tax advisory; Benyamin does general tax, general immigration
-- and consultancy. Nothing in the product knew that. A customer needing a
-- notarisation could wait forty minutes to reach a counter that cannot
-- legally help them, and the only thing standing between that and a wasted
-- visit was somebody remembering.
--
-- It also blocked three other things:
--   - Wait estimates could not account for who can serve whom, so a single
--     queue average was the best it could ever do.
--   - Escalation had no rule. Everything drifted to the owner because there
--     was no way to say "this reason needs a manager, that one does not".
--   - Check-in could not tell a customer which line to join.
--
-- WHY A JOIN TABLE RATHER THAN A COLUMN
-- A station handles many services and a service can be handled at many
-- stations. An array column on stations would work until the first time
-- someone renames or deletes a service, at which point the array holds a
-- stale name with nothing to check it against. The FK here means the
-- database enforces it.

create table if not exists public.station_services (
  station_id uuid not null references public.stations(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (station_id, service_id)
);

comment on table public.station_services is
  'Which services each counter can handle. Absence of any row for a station means "no restriction set" — see the note below on why that is not the same as "handles nothing".';

create index if not exists station_services_service_idx
  on public.station_services(service_id);

-- ── The empty-set rule ───────────────────────────────────────────────
-- A station with NO rows means unrestricted, not incapable.
--
-- This matters more than it looks. Every existing station has no rows the
-- moment this migration runs, and if empty meant "handles nothing" the queue
-- would stop routing to every counter at once — a silent, total outage
-- caused by a migration that only added a table. Defaulting to unrestricted
-- means this changes nothing until somebody deliberately sets a restriction.
--
-- The application must honour this. Do not "fix" it by seeding every station
-- with every service: that looks equivalent and is not, because it loses the
-- distinction between "not configured yet" and "deliberately handles
-- everything", and the first is worth prompting about while the second is
-- not.

-- ── Escalation routing ───────────────────────────────────────────────
-- Which reasons need a manager rather than any available staff member.
-- Stored per branch because it is a policy, not a fact: one office may
-- require the owner for a refund decision, another may not.
alter table public.branches
  add column if not exists manager_only_reasons text[] not null default '{}';

comment on column public.branches.manager_only_reasons is
  'Escalation reasons that must route to a manager rather than any staff member. Values match ESCALATION_REASONS in src/lib/workTypes.js. Empty array means nothing is manager-only, which is the safe default — a wrong entry here sends a customer to someone who cannot help them, which is worse than no rule.';

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.station_services enable row level security;

-- Staff and owners manage their own branch's mapping, reached through the
-- station's branch_id rather than a duplicated column.
drop policy if exists station_services_branch_rw on public.station_services;
create policy station_services_branch_rw on public.station_services
  for all to authenticated
  using (
    exists (
      select 1 from public.stations s
      where s.id = station_services.station_id
        and (
          exists (select 1 from public.branches b where b.id = s.branch_id and b.owner_id = auth.uid())
          or exists (select 1 from public.staff st where st.branch_id = s.branch_id and st.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.stations s
      where s.id = station_services.station_id
        and (
          exists (select 1 from public.branches b where b.id = s.branch_id and b.owner_id = auth.uid())
          or exists (select 1 from public.staff st where st.branch_id = s.branch_id and st.user_id = auth.uid())
        )
    )
  );

-- The check-in page is anonymous and needs to know which counters take which
-- service, so it can tell a customer where to go. It reads no personal data —
-- this table is two foreign keys and nothing else.
drop policy if exists station_services_public_read on public.station_services;
create policy station_services_public_read on public.station_services
  for select to anon
  using (true);
