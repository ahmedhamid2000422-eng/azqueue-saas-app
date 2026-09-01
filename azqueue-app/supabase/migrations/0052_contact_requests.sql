-- 0052 — inbound enquiries
--
-- There is no self-serve signup yet, deliberately: every front desk runs
-- differently and a setup that guesses wrong makes the first week look
-- broken. So the way in is a conversation, and this is where those land.

create table if not exists public.contact_requests (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  business_name text,
  email         text not null,
  phone         text,
  message       text,
  tier          text,
  created_at    timestamptz not null default now(),
  handled_at    timestamptz
);

alter table public.contact_requests enable row level security;

-- Anyone can send one; nobody but platform staff can read them. An enquiry
-- describes someone's business and their frustrations with it — that is not
-- something other customers should ever be able to list.
drop policy if exists "anyone can enquire" on public.contact_requests;
create policy "anyone can enquire"
  on public.contact_requests for insert to anon, authenticated
  with check (true);

drop policy if exists "platform admin reads enquiries" on public.contact_requests;
create policy "platform admin reads enquiries"
  on public.contact_requests for select to authenticated
  using (public.is_platform_admin());
