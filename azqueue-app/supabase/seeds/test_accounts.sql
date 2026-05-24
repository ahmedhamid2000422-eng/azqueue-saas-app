-- =====================================================================
-- AzQueue · Master test accounts — demo data seed
-- =====================================================================
--
-- This file populates a fully-loaded Business workspace + Personal workspace
-- so you can test both modes end-to-end without typing demo data by hand.
--
-- HOW TO USE
-- ----------
-- 1) In Supabase Dashboard → Authentication → Users → "Add user" — create
--    two users with these exact emails (passwords are your choice):
--
--       BUSINESS:  business@az.test
--       PERSONAL:  personal@az.test
--
--    Tip: when you click "Add user", check "Auto Confirm User" so they can
--    sign in immediately without email verification.
--
-- 2) Run THIS file in SQL Editor. It looks up those users by email and
--    seeds a branch + services + staff + tickets for the business one,
--    and tasks + docs + sessions for the personal one. Idempotent —
--    safe to re-run; it resets demo content but never touches the auth users.
--
-- 3) Sign in to your app at /login with either email + the password you set.
--    Business → /business · Personal → /personal · all data already there.
--
-- =====================================================================

-- ── 1. Look up the test users (skip everything if they don't exist yet) ──
do $$
declare
  biz_id uuid;
  pers_id uuid;
  bid uuid;
  svc_haircut uuid;
  svc_beard uuid;
  svc_combo uuid;
  staff_yusuf uuid;
  staff_sara uuid;
  staff_mohammad uuid;
begin
  select id into biz_id  from auth.users where email = 'business@az.test';
  select id into pers_id from auth.users where email = 'personal@az.test';

  if biz_id is null and pers_id is null then
    raise notice 'Neither test user found. Create them in Authentication → Users first, then re-run.';
    return;
  end if;

  -- ════════════════════════════════════════════════════════════════
  -- BUSINESS workspace
  -- ════════════════════════════════════════════════════════════════
  if biz_id is not null then
    -- Mark them as business mode in metadata (in case they signed up bare)
    update auth.users
       set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('mode', 'business', 'tier', 'manager', 'business_name', 'Khalifa Premier Services')
     where id = biz_id;

    -- Wipe any prior demo branch for idempotency
    delete from public.branches where owner_id = biz_id and slug like 'demo-%';

    -- Branch 1
    insert into public.branches (owner_id, slug, name, city, timezone, lat, lng, autopilot, islamic_mode)
    values (biz_id, 'demo-kl-downtown', 'KL Downtown', 'Bukit Bintang', 'Asia/Kuala_Lumpur', 3.149, 101.713, true, true)
    returning id into bid;

    -- Services for branch 1
    insert into public.services (branch_id, name, duration_min)
    values (bid, 'Haircut', 20) returning id into svc_haircut;
    insert into public.services (branch_id, name, duration_min)
    values (bid, 'Beard Trim', 12) returning id into svc_beard;
    insert into public.services (branch_id, name, duration_min)
    values (bid, 'Haircut + Beard', 30) returning id into svc_combo;
    insert into public.services (branch_id, name, duration_min)
    values (bid, 'Spa', 45);

    -- Staff
    insert into public.staff (branch_id, display_name, role, status)
    values (bid, 'Yusuf K.', 'manager', 'serving') returning id into staff_yusuf;
    insert into public.staff (branch_id, display_name, role, status)
    values (bid, 'Sara A.',  'staff',   'active')  returning id into staff_sara;
    insert into public.staff (branch_id, display_name, role, status)
    values (bid, 'Mohammad U.', 'staff', 'on_break') returning id into staff_mohammad;
    insert into public.staff (branch_id, display_name, role, status)
    values (bid, 'Hana B.', 'staff', 'off');

    -- Today's tickets — mix of statuses
    insert into public.tickets (branch_id, service_id, staff_id, token, source, customer_name, customer_phone, status, created_at, called_at, started_at, completed_at)
    values
      (bid, svc_haircut, staff_yusuf,    'A101', 'walk', 'Ali Khan',     '+60123456701', 'completed',
        now() - interval '90 minutes', now() - interval '85 minutes', now() - interval '85 minutes', now() - interval '65 minutes'),
      (bid, svc_combo,   staff_sara,     'A102', 'walk', 'Hassan Ali',   '+60123456702', 'completed',
        now() - interval '70 minutes', now() - interval '60 minutes', now() - interval '60 minutes', now() - interval '32 minutes'),
      (bid, svc_haircut, staff_yusuf,    'A103', 'walk', 'Ahmed M.',     '+60123456703', 'serving',
        now() - interval '40 minutes', now() - interval '15 minutes', now() - interval '15 minutes', null),
      (bid, svc_beard,   null,           'A104', 'walk', 'Sara Ahmed',   '+60123456704', 'waiting',
        now() - interval '20 minutes', null, null, null),
      (bid, svc_haircut, null,           'A105', 'walk', 'Mohammad U.',  '+60123456705', 'waiting',
        now() - interval '14 minutes', null, null, null),
      (bid, svc_combo,   null,           'A106', 'walk', 'Zainab F.',    '+60123456706', 'waiting',
        now() - interval '8 minutes',  null, null, null);

    -- A few service_times so autopilot has a baseline
    insert into public.service_times (branch_id, ticket_id, service_id, staff_id, duration_sec)
    select bid, id, service_id, staff_id, extract(epoch from (completed_at - started_at))::int
    from public.tickets where branch_id = bid and status = 'completed' and started_at is not null and completed_at is not null;

    -- Today's bookings
    insert into public.bookings (branch_id, service_id, staff_id, customer_name, customer_phone, scheduled_at, status)
    values
      (bid, svc_haircut, staff_yusuf, 'Ayesha Malik', '+60123456710', date_trunc('day', now()) + interval '10 hours 30 minutes', 'confirmed'),
      (bid, svc_combo,   staff_sara,  'Yahya A.',     '+60123456711', date_trunc('day', now()) + interval '13 hours',           'confirmed'),
      (bid, svc_beard,   null,        'Omar S.',      '+60123456712', date_trunc('day', now()) + interval '14 hours 30 minutes', 'pending');

    -- Branch 2 — for testing the multi-branch switcher
    insert into public.branches (owner_id, slug, name, city, timezone, lat, lng)
    values (biz_id, 'demo-bangsar', 'Bangsar Studio', 'Bangsar', 'Asia/Kuala_Lumpur', 3.130, 101.671);

    raise notice 'Business demo loaded for business@az.test — sign in and visit /business';
  end if;

  -- ════════════════════════════════════════════════════════════════
  -- PERSONAL workspace
  -- ════════════════════════════════════════════════════════════════
  if pers_id is not null then
    update auth.users
       set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('mode', 'personal', 'display_name', 'Ahmed')
     where id = pers_id;

    delete from public.tasks               where owner_id = pers_id;
    delete from public.docs                where owner_id = pers_id;
    delete from public.deep_work_sessions  where owner_id = pers_id;
    delete from public.personal_prefs      where owner_id = pers_id;

    insert into public.personal_prefs (owner_id, daily_focus_min, prayer_aware, lat, lng, city)
    values (pers_id, 180, true, 3.149, 101.713, 'Kuala Lumpur');

    insert into public.tasks (owner_id, title, due_label, priority) values
      (pers_id, 'Ship the pricing page',          'Today',    true),
      (pers_id, 'Review pull requests',           'Today',    false),
      (pers_id, 'Reply to investor emails',       'Today',    false),
      (pers_id, 'Read Krebs cycle chapter',       'Tomorrow', false),
      (pers_id, 'Submit Calculus assignment',     'Soon',     false),
      (pers_id, 'Plan Q3 product roadmap',        'Someday',  true);

    insert into public.docs (owner_id, title, body, pinned) values
      (pers_id, 'Q3 strategy memo', E'Three priorities for Q3:\n\n1. Ship pricing page\n2. Onboard 10 design partners\n3. Customer side QR flow\n\nLink to tasks above.', true),
      (pers_id, 'Lecture notes · Mitochondria', E'- Cell power plant\n- ATP via oxidative phosphorylation\n- Two membranes: outer (porous) + inner (folded into cristae)\n- Krebs cycle in matrix\n- Electron transport chain on inner membrane', false);

    -- Some recent deep work sessions for the streak/stats
    insert into public.deep_work_sessions (owner_id, title, target_min, started_at, ended_at, duration_sec, completed) values
      (pers_id, 'Pricing page draft',      90, now() - interval '2 hours',     now() - interval '40 minutes', 4800, true),
      (pers_id, 'Investor reply batch',    45, now() - interval '1 day 4 hours', now() - interval '1 day 3 hours', 2700, true),
      (pers_id, 'Q3 memo writing',         90, now() - interval '2 days 6 hours', now() - interval '2 days 5 hours', 5400, true),
      (pers_id, 'Roadmap brainstorm',      60, now() - interval '3 days 8 hours', now() - interval '3 days 7 hours', 3600, true);

    raise notice 'Personal demo loaded for personal@az.test — sign in and visit /personal';
  end if;
end $$;
