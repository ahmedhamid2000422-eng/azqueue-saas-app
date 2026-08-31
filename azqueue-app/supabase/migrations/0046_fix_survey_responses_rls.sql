-- 0046 — close a cross-tenant read on survey_responses
--
-- THE PROBLEM
-- `survey_responses` holds answers to AzQueue's own market-research
-- questionnaire. Its read policy was:
--
--     create policy "auth_select_survey"
--       on public.survey_responses for select
--       to authenticated
--       using (true);
--
-- `using (true)` means every signed-in user of AzQueue could read every
-- response ever submitted — including responses from rival businesses
-- describing their pain points and what they'd be willing to pay. The table
-- has no branch_id, so there is nothing to scope it by: it is platform data,
-- not tenant data, and the only correct audience is AzQueue staff.
--
-- Note this is NOT the same table as `surveys`, which stores per-branch
-- customer feedback and is already correctly scoped with
-- user_belongs_to_branch(branch_id). That one is fine.

-- Platform admins are flagged in their JWT app/user metadata, matching the
-- check the admin UI already makes in Topbar.jsx.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata'  ->> 'platform_admin')::boolean,
    (auth.jwt() -> 'app_metadata'   ->> 'platform_admin')::boolean,
    false
  );
$$;

comment on function public.is_platform_admin() is
  'True when the caller is AzQueue staff. Used for platform-wide data that belongs to no single tenant.';

-- Replace the open read with an admin-only one.
drop policy if exists "auth_select_survey" on public.survey_responses;

create policy "platform_admin_select_survey"
  on public.survey_responses for select
  to authenticated
  using (public.is_platform_admin());

-- Submitting stays open: the whole point is that anyone can answer the
-- research questionnaire, including people with no account. Insert-only
-- access reveals nothing.
