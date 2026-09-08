-- 0062 — document checklists move out of localStorage
--
-- WHAT WAS WRONG
-- Branch checklist overrides were stored in the browser, under
-- `azqueue_checklists_<branchId>`. That means an edit made on the office
-- desktop does not exist on the kiosk, on the counter iPad, or on anybody
-- else's machine — and nothing anywhere says so. Mohamed could correct the
-- N-400 list, watch it save, and the kiosk two metres away would keep handing
-- out the old one indefinitely.
--
-- It also blocked the public "what to bring" page entirely: a customer's
-- phone has no localStorage from the office, so it could only ever serve the
-- built-in lists.
--
-- WHAT THIS IS NOT
-- It is not the checklist library. The 52 built-in lists stay in
-- src/lib/checklists.js — they are the same for every business and belong in
-- code, where they are versioned and reviewable. This table holds only a
-- branch's OVERRIDES, keyed by the same service key the library uses.
--
-- Absence of a row means "use the built-in", not "no checklist". Same rule as
-- station_services in 0061: an empty table is the normal starting state and
-- must behave as the default, never as a prohibition.

create table if not exists public.service_checklists (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id) on delete cascade,

  -- Matches a key in DEFAULT_CHECKLISTS ("n-400", "tax preparation", ...).
  -- Text rather than a foreign key because the library lives in code and a
  -- branch may override a list for a service it has not created yet.
  service_key  text not null,

  items        text[] not null default '{}',
  reminder     text,

  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);

-- One override per service per branch. The upsert path depends on this.
create unique index if not exists service_checklists_branch_key_idx
  on public.service_checklists(branch_id, service_key);

comment on table public.service_checklists is
  'Per-branch overrides of the built-in document checklists in src/lib/checklists.js. No row means use the built-in. Replaced localStorage, which made every edit device-local.';

alter table public.service_checklists enable row level security;

-- Staff and owners of the branch may read and write their own.
drop policy if exists service_checklists_rw on public.service_checklists;
create policy service_checklists_rw on public.service_checklists
  for all
  using (user_belongs_to_branch(branch_id))
  with check (user_belongs_to_branch(branch_id));

/* PUBLIC READ IS DELIBERATE, AND IT IS NOT THE 0060 MISTAKE.
   0060 closed an anon SELECT on tickets and bookings because those rows carry
   customer names, phone numbers and email addresses.

   A checklist row carries none of that. It is a list of documents to bring —
   already printed on the kiosk, already emailed to anyone who asks, and
   already handed out at the counter. The public "what to bring" page needs to
   read it without a login, and the alternative would be a SECURITY DEFINER
   RPC wrapping data that is public by design.

   Read only. Anonymous callers can never write. */
drop policy if exists service_checklists_public_read on public.service_checklists;
create policy service_checklists_public_read on public.service_checklists
  for select to anon
  using (true);
