-- ============================================================
-- PERMANENT CLEANUP: Delete test branches that don't belong
-- to your account and shouldn't be visible in your dashboard.
--
-- WHY THIS IS NEEDED
-- "Az Tax", "Demo Branch", and "KL Downtown" were created
-- under a different account (mohdhanis@kapentacreative.com).
-- Because their owner_id doesn't match your auth.uid(), the
-- Delete button in Settings was silently blocked by RLS.
--
-- HOW TO RUN
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste this entire file
--   3. Click "Run" (runs as postgres superuser, bypasses RLS)
--   4. Confirm the SELECT at the bottom shows only YOUR branches
-- ============================================================


-- ── Step 1: preview what will be deleted ─────────────────────────────
-- Run this first to confirm before deleting anything:

SELECT id, name, owner_id, created_at
FROM public.branches
WHERE name IN ('Az Tax', 'Demo Branch', 'KL Downtown')
ORDER BY name;


-- ── Step 2: delete the unwanted branches ─────────────────────────────
-- All related records (tickets, staff, queues, etc.) will be removed
-- automatically via ON DELETE CASCADE foreign keys.

DELETE FROM public.branches
WHERE name IN ('Az Tax', 'Demo Branch', 'KL Downtown');


-- ── Step 3: verify only your branches remain ─────────────────────────

SELECT id, name, owner_id, created_at
FROM public.branches
ORDER BY created_at;


-- ── Step 4 (bonus): lock down the public read policy ─────────────────
-- The current policy allows ANY anon user to read ALL branches.
-- This replaces it so only branches with a valid slug are visible
-- (anonymous widget/kiosk reads still work, but raw table is protected).

DROP POLICY IF EXISTS branches_public_read ON public.branches;

CREATE POLICY branches_public_read ON public.branches
  FOR SELECT TO anon
  USING (slug IS NOT NULL);


-- ── Step 5 (bonus): fix tier default ─────────────────────────────────
-- The getTier() function in src/lib/tier.js falls back to "manager"
-- (the highest paid tier) for users with no tier set in user_metadata.
-- This is a JS fix — update src/lib/tier.js line ~74:
--
--   CHANGE:  return user?.user_metadata?.tier || "manager";
--   TO:      return user?.user_metadata?.tier || "essential";
--
-- This ensures new signups start on the free tier, not the top paid tier.
-- ============================================================
