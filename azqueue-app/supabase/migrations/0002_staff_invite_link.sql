-- =====================================================================
-- AzQueue · 0002 — staff invite + auto-link trigger
-- Run this AFTER 0001_init.sql, in Supabase SQL Editor.
-- =====================================================================
--
-- Adds:
--   1. invite_email column on staff (so we can look them up by email later)
--   2. Trigger on auth.users insert: if a staff row exists with matching
--      invite_email, populate its user_id and clear the invite. Now they can
--      sign in and the RLS policies recognise them as belonging to the branch.

alter table public.staff
  add column if not exists invite_email text;

create index if not exists staff_invite_email_idx on public.staff(invite_email);

-- Function: link any pending staff rows to the new auth user
create or replace function public.link_staff_on_signup()
returns trigger language plpgsql security definer as $$
begin
  update public.staff
     set user_id      = new.id,
         invite_email = null
   where invite_email = new.email
     and user_id is null;
  return new;
end $$;

-- Trigger on auth.users insert
drop trigger if exists on_auth_user_created_link_staff on auth.users;
create trigger on_auth_user_created_link_staff
  after insert on auth.users
  for each row execute procedure public.link_staff_on_signup();
