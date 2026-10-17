-- 0063 — document readiness
--
-- THE GAP THIS CLOSES
-- AzQueue has told customers what to bring since the checklist library was
-- written. It has never recorded what they actually brought. So there is no
-- readiness figure, no history of which documents go missing, and no way to
-- answer the question the whole tax/immigration template exists for: does
-- being prepared change how long service takes?
--
-- See docs/tax-immigration-audit.md. This is the one genuinely missing piece;
-- almost everything else in that workflow was built in 0048.
--
-- WHAT THIS IS NOT
-- It is not document storage. No uploads, no scans, no file references. There
-- is no access-controlled upload system in this codebase, and building one for
-- a tax and immigration office means passports and Social Security cards at
-- rest. Recording that somebody HAS a passport is a different thing from
-- holding it, with different obligations. Keep it that way.
--
-- It is also not a new ticket status. Readiness is a third axis alongside
-- queue position (tickets.status) and work progress (the 0048 timestamps).
-- Folding it into status would produce 'awaiting_documents', which reads as a
-- queue position and would then have to be excluded from every wait
-- calculation — precisely the mistake 0048 was written to avoid.

-- ── What a service requires ──────────────────────────────────────────
create table if not exists public.checklist_requirements (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id) on delete cascade,

  -- Matches a key in DEFAULT_CHECKLISTS / service_checklists (0062).
  service_key text not null,

  item_label  text not null,

  /* WHY item_code EXISTS.
     "Passport", "Valid passport" and "Passport (unexpired)" are the same
     document. Counting by label would split one missing-item statistic into
     three and the "most commonly missing" figure would be noise. The label is
     what a customer reads; the code is what gets counted. */
  item_code   text not null,

  /* A warning, never a block. Ahmed's decision, 5 September: staff should be
     told what is missing and left to judge. A hard block on starting service
     would be worked around within a week — someone would mark items present
     that are not, and the data would become worse than none. */
  required    boolean not null default true,

  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create unique index if not exists checklist_requirements_unique_idx
  on public.checklist_requirements(branch_id, service_key, item_code);

create index if not exists checklist_requirements_lookup_idx
  on public.checklist_requirements(branch_id, service_key, sort_order);

comment on table public.checklist_requirements is
  'What a service needs, one row per document, so items can be counted and compared across visits. The 52 built-in lists stay in src/lib/checklists.js; these are the countable form.';
comment on column public.checklist_requirements.required is
  'Advisory only. Nothing in the application blocks service on a missing item — it warns. Deliberate.';

-- ── What happened on one visit ───────────────────────────────────────
create table if not exists public.ticket_checklist_items (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.branches(id) on delete cascade,
  ticket_id      uuid not null references public.tickets(id) on delete cascade,

  requirement_id uuid references public.checklist_requirements(id) on delete set null,

  /* Snapshotted, not only referenced. A branch may edit or delete a
     requirement between the reminder going out and the customer arriving, and
     a visit's record must still say what was asked for at the time. A
     dangling foreign key would silently rewrite history. */
  item_code      text not null,
  item_label     text not null,

  /* TWO STATES, DELIBERATELY.
     What the customer says they have, and what staff confirmed, are different
     facts — and the gap between them is itself worth measuring. If customers
     routinely claim readiness they do not have, the reminder wording is wrong,
     and that is only visible if both are recorded separately. */
  customer_state text check (customer_state in ('has', 'not_sure', 'missing')),
  staff_state    text check (staff_state    in ('confirmed', 'rejected', 'missing')),

  noted_at       timestamptz not null default now(),
  noted_by       uuid references public.staff(id) on delete set null
);

create unique index if not exists ticket_checklist_items_unique_idx
  on public.ticket_checklist_items(ticket_id, item_code);

create index if not exists ticket_checklist_items_ticket_idx
  on public.ticket_checklist_items(ticket_id);

/* Aggregate queries ask "which codes were missing, over a date range, for
   this branch". Indexed for that shape rather than for single lookups. */
create index if not exists ticket_checklist_items_missing_idx
  on public.ticket_checklist_items(branch_id, item_code, noted_at)
  where staff_state in ('rejected', 'missing') or customer_state = 'missing';

comment on table public.ticket_checklist_items is
  'One row per required document per visit. Records possession, never the document itself.';

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.checklist_requirements   enable row level security;
alter table public.ticket_checklist_items   enable row level security;

drop policy if exists checklist_requirements_rw on public.checklist_requirements;
create policy checklist_requirements_rw on public.checklist_requirements
  for all
  using (user_belongs_to_branch(branch_id))
  with check (user_belongs_to_branch(branch_id));

/* Requirements are public-readable for the same reason service_checklists is
   (0062): a list of documents to bring is already printed on the kiosk and
   emailed on request. The public what-to-bring page needs it without a login. */
drop policy if exists checklist_requirements_public_read on public.checklist_requirements;
create policy checklist_requirements_public_read on public.checklist_requirements
  for select to anon
  using (true);

/* TICKET ITEMS ARE NOT PUBLIC, AND THE DISTINCTION MATTERS.
   A requirement row says "an N-400 needs a passport" — general, harmless.
   A ticket item row says "this person was asked for a passport and did not
   have one" — information about a named individual's immigration situation,
   attached to a ticket that carries their name and phone number.

   0060 had to close exactly this class of leak on tickets and bookings. Staff
   only, from the first migration. */
drop policy if exists ticket_checklist_items_rw on public.ticket_checklist_items;
create policy ticket_checklist_items_rw on public.ticket_checklist_items
  for all
  using (user_belongs_to_branch(branch_id))
  with check (user_belongs_to_branch(branch_id));
