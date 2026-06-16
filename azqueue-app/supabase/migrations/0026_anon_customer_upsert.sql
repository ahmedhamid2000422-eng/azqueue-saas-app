-- AzQueue · 0026 — Allow anon to upsert customers via secure RPC
--
-- Problem: customers table has RLS restricting to authenticated users only.
-- When a customer scans a QR code (anon), findOrCreateCustomer() silently
-- fails — they never appear in the Customers tab.
--
-- Fix: a security definer RPC that anon can call. It validates the branch
-- exists and inserts/returns the customer safely without exposing other rows.

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
  -- Validate branch exists (prevents random inserts to nonexistent branches)
  if not exists (select 1 from public.branches where id = p_branch_id) then
    raise exception 'branch not found';
  end if;

  -- Upsert by phone (primary identifier for walk-ins)
  if p_phone is not null and trim(p_phone) != '' then
    insert into public.customers (branch_id, display_name, phone, email, last_seen_at)
    values (p_branch_id, trim(p_name), trim(p_phone), nullif(trim(coalesce(p_email,'')), ''), now())
    on conflict (branch_id, phone)
    do update set
      display_name = excluded.display_name,
      email        = coalesce(excluded.email, customers.email),
      last_seen_at = now()
    returning id into v_id;
    return v_id;
  end if;

  -- Fallback: upsert by email if no phone
  if p_email is not null and trim(p_email) != '' then
    insert into public.customers (branch_id, display_name, email, last_seen_at)
    values (p_branch_id, trim(p_name), trim(p_email), now())
    on conflict (branch_id, lower(email))
    do update set
      display_name = excluded.display_name,
      last_seen_at = now()
    returning id into v_id;
    return v_id;
  end if;

  -- No identifier — insert name-only record
  insert into public.customers (branch_id, display_name, last_seen_at)
  values (p_branch_id, trim(p_name), now())
  returning id into v_id;
  return v_id;
end;
$$;

-- Allow anon and authenticated users to call this function
grant execute on function public.upsert_walk_in_customer(uuid, text, text, text) to anon;
grant execute on function public.upsert_walk_in_customer(uuid, text, text, text) to authenticated;

-- Also explicitly grant anon the right to call generate_ticket_token
-- (Postgres default PUBLIC grant covers this, but this makes it explicit and
--  survives any future revoke-on-public policies Supabase may add.)
grant execute on function public.generate_ticket_token(uuid, text) to anon;
grant execute on function public.generate_ticket_token(uuid, text) to authenticated;
