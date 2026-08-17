-- ═══════════════════════════════════════════════════════════════════
-- AzQueue · Walk-in customer upsert (fixes 404 on upsert_walk_in_customer)
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query
--   Paste this entire file → Run
--
-- WHAT IT FIXES:
--   The customers table has RLS restricting writes to authenticated users.
--   When a customer scans a QR code they are anonymous, so their record was
--   never created and they never appeared in the Customers tab.
--   This adds a security-definer RPC that anon is explicitly allowed to call.
-- ═══════════════════════════════════════════════════════════════════

-- Unique indexes the upsert depends on ------------------------------
create unique index if not exists customers_branch_phone_key
  on public.customers (branch_id, phone)
  where phone is not null;

create unique index if not exists customers_branch_email_key
  on public.customers (branch_id, lower(email))
  where email is not null;

-- The RPC ------------------------------------------------------------
create or replace function public.upsert_walk_in_customer(
  p_branch_id   uuid,
  p_name        text,
  p_phone       text,
  p_email       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Validate branch exists (prevents inserts to nonexistent branches)
  if not exists (select 1 from public.branches where id = p_branch_id) then
    raise exception 'branch not found';
  end if;

  -- Preferred: upsert by phone (primary identifier for walk-ins)
  if p_phone is not null and trim(p_phone) <> '' then
    insert into public.customers (branch_id, display_name, phone, email, last_seen_at)
    values (
      p_branch_id,
      nullif(trim(p_name), ''),
      trim(p_phone),
      nullif(trim(coalesce(p_email, '')), ''),
      now()
    )
    on conflict (branch_id, phone) where phone is not null
    do update set
      display_name = coalesce(excluded.display_name, customers.display_name),
      email        = coalesce(excluded.email,        customers.email),
      last_seen_at = now()
    returning id into v_id;
    return v_id;
  end if;

  -- Fallback: upsert by email when no phone was given
  if p_email is not null and trim(p_email) <> '' then
    insert into public.customers (branch_id, display_name, email, last_seen_at)
    values (p_branch_id, nullif(trim(p_name), ''), trim(p_email), now())
    on conflict (branch_id, lower(email)) where email is not null
    do update set
      display_name = coalesce(excluded.display_name, customers.display_name),
      last_seen_at = now()
    returning id into v_id;
    return v_id;
  end if;

  -- Last resort: name-only record
  insert into public.customers (branch_id, display_name, last_seen_at)
  values (p_branch_id, nullif(trim(p_name), ''), now())
  returning id into v_id;
  return v_id;
end;
$$;

-- Permissions --------------------------------------------------------
grant execute on function public.upsert_walk_in_customer(uuid, text, text, text) to anon;
grant execute on function public.upsert_walk_in_customer(uuid, text, text, text) to authenticated;

grant execute on function public.generate_ticket_token(uuid, text) to anon;
grant execute on function public.generate_ticket_token(uuid, text) to authenticated;

-- Verify -------------------------------------------------------------
select 'upsert_walk_in_customer installed' as status;
