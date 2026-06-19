-- ============================================================
-- FIX FOR B5: "Check-in doesn't appear in queue"
--
-- ROOT CAUSE (confirmed via live testing against production)
-- This was NOT a bug in the check-in flow, the tickets RLS policy,
-- the generate_ticket_token RPC, or the Queue page's read query.
-- All of those work correctly — verified by inserting a real ticket
-- through the exact anonymous customer path and confirming it landed
-- in the database (token A101, branch Kapenta Interior).
--
-- The actual cause: per migration 0024_fix_multitenancy_test_data.sql,
-- "Kapenta Interior" is intentionally owned by a separate account
-- (mohdhanis@kapentainterior.com's UUID), not Ahmed's own account.
-- AzQueue's RLS (user_belongs_to_branch) correctly only lets a
-- branch's owner or staff see/act on its tickets. Since Ahmed's
-- logged-in account (ahmedhamid2000422@gmail.com) is neither the
-- owner nor staff for this specific branch, the Queue page silently
-- shows 0 tickets for him — even though tickets ARE being created.
--
-- FIX (extend-only — no schema/RLS changes)
-- Add Ahmed's account as a staff member of Kapenta Interior so he
-- can see and manage its queue without touching the existing
-- owner_id (which migration 0024 deliberately left alone).
--
-- HOW TO RUN
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste this entire file
--   3. Click "Run"
--   4. Confirm the final SELECT shows your new staff row
-- ============================================================


-- ── Step 1: confirm the branch and your own UUID ──────────────────────
-- (Ahmed's UUID below, 59664f5b-a233-4b01-a811-dceda8b912cc, was read
--  directly from his own active AzQueue session JWT — not guessed.)

select id, slug, name, owner_id
from public.branches
where slug = 'kapenta-interior';


-- ── Step 2: add Ahmed as staff (manager role) on Kapenta Interior ────

insert into public.staff (branch_id, user_id, display_name, role, status)
select b.id, '59664f5b-a233-4b01-a811-dceda8b912cc', 'Ahmed Hamid', 'manager', 'active'
from public.branches b
where b.slug = 'kapenta-interior'
  and not exists (
    select 1 from public.staff s
    where s.branch_id = b.id
      and s.user_id = '59664f5b-a233-4b01-a811-dceda8b912cc'
  );


-- ── Step 3: verify ─────────────────────────────────────────────────────

select s.id, s.display_name, s.role, s.status, b.name as branch_name
from public.staff s
join public.branches b on b.id = s.branch_id
where s.user_id = '59664f5b-a233-4b01-a811-dceda8b912cc';


-- ── Step 4 (cleanup): remove the test ticket created during this QA pass ─
-- A live test check-in was submitted while diagnosing B5 (token A101,
-- name "Clean Anon Test", phone +60199998888). Safe to delete — it's
-- not a real customer.

delete from public.tickets
where branch_id = (select id from public.branches where slug = 'kapenta-interior')
  and customer_name = 'Clean Anon Test'
  and customer_phone = '+60199998888';
-- ============================================================
