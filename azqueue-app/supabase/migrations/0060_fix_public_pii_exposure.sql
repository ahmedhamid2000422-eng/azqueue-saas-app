-- 0060 — stop exposing every customer's name, phone and email to the open internet
--
-- WHAT WAS WRONG
-- Two policies from 0001 and 0006, unchanged since the day they were written:
--
--   create policy tickets_public_select_own  on public.tickets  for select to anon using (true);
--   create policy bookings_public_select_own on public.bookings for select to anon using (true);
--
-- Both are named "select_own" but check nothing — "using (true)" permits
-- every row to every anonymous request, filtered or not. Confirmed live on
-- 3 September: a request to /rest/v1/tickets with no filter at all, using
-- only the public anon key (which ships in every page load by design),
-- returned real customer names, phone numbers and personal emails. Same
-- result on /rest/v1/bookings. This has been true since the tables were
-- created — not a new regression, and not something a second tenant makes
-- worse, since it was already exposing this branch's own customers to
-- anyone who opened dev tools.
--
-- WHY THE FIX ISN'T A NARROWER "using" CLAUSE
-- Row-level security filters rows; it cannot see whether the client's query
-- included a WHERE clause. There is no "using" condition that means "only
-- if the caller already knows the id" — that has to be enforced by not
-- exposing the table for open SELECT at all, and instead exposing a
-- function that requires the id as an argument.
--
-- WHAT ACTUALLY NEEDS THIS
-- Two customer-facing pages read a single row by its id, given to the
-- customer as a link (in the URL, not guessable by walking the table):
--   - CustomerTicket.jsx  — "where am I in the queue"
--   - ConfirmAttendance.jsx — "confirm you're coming"
-- Both keep working unchanged in what they show the customer; what changes
-- is that nobody else can read the table underneath them.

-- ── 1. Two narrow, id-scoped functions ───────────────────────────────
create or replace function public.get_ticket_public(p_id uuid)
returns table (
  id uuid, token text, status text, customer_name text,
  customer_phone text, customer_email text, branch_id uuid,
  service_id uuid, staff_id uuid, assigned_station_id uuid,
  detail text, created_at timestamptz, called_at timestamptz,
  completed_at timestamptz, expired_at timestamptz, outcome text,
  handoff_category text, source text, arrived_at timestamptz
)
language sql
security definer
set search_path = public
as $fn$
  select id, token, status, customer_name, customer_phone, customer_email,
         branch_id, service_id, staff_id, assigned_station_id, detail,
         created_at, called_at, completed_at, expired_at, outcome,
         handoff_category, source, arrived_at
  from public.tickets
  where id = p_id;
$fn$;

comment on function public.get_ticket_public is
  'The only way an anonymous request can read a ticket. Requires the exact id, so a customer with their own link sees their own ticket and nobody can page through the table. Replaces the old tickets_public_select_own policy, which had no such restriction.';

grant execute on function public.get_ticket_public(uuid) to anon;

create or replace function public.get_booking_public(p_id uuid)
returns table (
  id uuid, branch_id uuid, service_id uuid, customer_name text,
  scheduled_at timestamptz, status text, confirmed_at timestamptz
)
language sql
security definer
set search_path = public
as $fn$
  select id, branch_id, service_id, customer_name, scheduled_at, status, confirmed_at
  from public.bookings
  where id = p_id;
$fn$;

comment on function public.get_booking_public is
  'The only way an anonymous request can read a booking. Requires the exact id. Deliberately omits customer_phone and customer_email — ConfirmAttendance.jsx never displayed them, so the function does not hand them out either.';

grant execute on function public.get_booking_public(uuid) to anon;

-- ── 2. Remove the policies these functions replace ───────────────────
drop policy if exists tickets_public_select_own on public.tickets;
drop policy if exists bookings_public_select_own on public.bookings;

-- ── 3. Same problem, lower stakes — branches carries business info, not
--      customer PII, but "using (true)" is still wrong on principle and
--      becomes a real cross-tenant issue the day a second business joins.
--      Narrows to branches with a slug, which every real branch has. ────
drop policy if exists branches_public_read on public.branches;

create policy branches_public_read on public.branches
  for select to anon
  using (slug is not null);
