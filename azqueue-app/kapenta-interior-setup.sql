-- ============================================================
-- Kapenta Interior — AzQueue branch setup
-- Client: Mohd. Hanis <mohdhanis@kapentacreative.com>
--
-- HOW TO USE:
--   1. In Supabase → Authentication → Users → "Invite user"
--      Enter: mohdhanis@kapentacreative.com
--      (He gets an email to set his password — he can do this later)
--
--   2. Once the user row appears in Supabase → Authentication → Users,
--      copy his UUID (the long id next to his email) and paste it below.
--
--   3. Run this entire script in Database → SQL Editor → New query.
--
--   4. After running, update wa_phone with his Twilio WhatsApp number
--      once you have it (E.164 format: e.g. +60123456789)
-- ============================================================

do $$
declare
  v_user_id   uuid := 'PASTE-MOHD-HANIS-UUID-HERE';  -- ← from Supabase Auth users tab
  v_branch_id uuid;
begin

  -- ── 1. Create the branch ──────────────────────────────────────
  insert into public.branches (
    owner_id,
    slug,
    name,
    city,
    timezone,
    business_type,
    autopilot,
    wa_enabled,
    wa_flow_config
  )
  values (
    v_user_id,
    'kapenta-interior',
    'Kapenta Interior',
    'Kuala Lumpur',
    'Asia/Kuala_Lumpur',
    'queue',
    true,
    false,                                  -- set to true once WhatsApp number is configured
    '{"preset": "design"}'::jsonb           -- uses the Interior Design WhatsApp bot flow
  )
  returning id into v_branch_id;

  -- ── 2. Create owner staff record ─────────────────────────────
  insert into public.staff (branch_id, user_id, display_name, role, status)
  values (v_branch_id, v_user_id, 'Mohd. Hanis', 'owner', 'off');

  -- ── 3. Create services (matches the WhatsApp bot menu exactly) ─
  insert into public.services (branch_id, name, duration_min, active) values
    (v_branch_id, 'Design Consultation',      60, true),
    (v_branch_id, 'Kitchen Cabinet Design',   45, true),
    (v_branch_id, 'Bathroom Design',          45, true),
    (v_branch_id, 'Full Home Renovation',     60, true),
    (v_branch_id, 'Commercial / Office Design', 60, true),
    (v_branch_id, 'Furniture & Custom Carpentry', 45, true),
    (v_branch_id, 'Site Visit',               30, true);

  raise notice '✅ Kapenta Interior branch created: %', v_branch_id;
  raise notice '   Check-in link: https://azqueue.io/checkin/%', v_branch_id;
  raise notice '   WhatsApp bot flow: design (interior design menu)';
  raise notice '';
  raise notice '📱 Next step: Set wa_phone and set wa_enabled = true';
  raise notice '   UPDATE public.branches SET wa_phone = ''+601XXXXXXXX'', wa_enabled = true WHERE id = ''%'';', v_branch_id;

end $$;
