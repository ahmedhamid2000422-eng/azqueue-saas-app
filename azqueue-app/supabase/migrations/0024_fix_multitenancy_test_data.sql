-- ============================================================
-- Fix multi-tenancy test data
--
-- PROBLEM
-- All test branches (Az Tax, Demo Branch, KL Downtown, Kapenta Interior)
-- were created with the same owner_id (mohdhanis@kapentacreative.com's UUID).
-- When Kapenta Interior logs in, RLS correctly returns ALL branches that share
-- that owner_id — so they see Az Tax etc. This is a test-data issue, not a code bug.
--
-- FIX
-- Reassign "Az Tax", "Demo Branch", and "KL Downtown" to Ahmed's own account UUID.
-- Kapenta Interior keeps its current owner_id (mohdhanis@kapentainterior.com's UUID).
--
-- HOW TO GET YOUR UUID (ahmedhamid2000422@gmail.com):
--   1. Go to Supabase dashboard → Authentication → Users
--   2. Find ahmedhamid2000422@gmail.com in the list
--   3. Click the row → copy the "User UID" value
--   4. Paste it below in place of AHMED_UUID_HERE
--
-- Then run this script in Supabase → SQL Editor → New query
-- ============================================================

-- ── Step 1: confirm what's currently in your branches table ──────────
select id, name, owner_id, created_at
from public.branches
order by created_at;

-- ── Step 2: check all auth users so you can identify your UUID ───────
select id, email, created_at
from auth.users
order by created_at;

-- ── Step 3: reassign the three "Ahmed's" branches ────────────────────
-- Replace AHMED_UUID_HERE with your actual UUID from Step 2 above.
-- DO NOT run this line until you have the correct UUID.

/*
update public.branches
set owner_id = 'AHMED_UUID_HERE'   -- ← paste your UUID here
where name in ('Az Tax', 'Demo Branch', 'KL Downtown');
*/

-- ── Step 4: verify ───────────────────────────────────────────────────
-- After running the update, run this to confirm:
-- select name, owner_id from public.branches order by name;
-- You should see Az Tax / Demo Branch / KL Downtown on Ahmed's UUID,
-- and Kapenta Interior on mohdhanis's UUID.
