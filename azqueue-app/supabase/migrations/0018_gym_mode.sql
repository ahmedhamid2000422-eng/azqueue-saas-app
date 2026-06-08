-- ════════════════════════════════════════════════════════════════════
-- 0018_gym_mode — adds the columns needed for the new "gym / class
-- studio" vertical (Mohamed Elradi's fight gym), without touching any
-- existing queue-mode behaviour. Every new column is optional/defaulted
-- so existing branches (tax office mode) are unaffected.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Branch vertical flag ──────────────────────────────────────────
-- Lets an owner mark their branch as a class-based gym instead of a
-- walk-in queue. Drives which nav/pages the business mode shows.
alter table public.branches
  add column if not exists business_type text not null default 'queue'
  check (business_type in ('queue', 'gym')),
  add column if not exists booking_faq jsonb not null default '[]'::jsonb;

comment on column public.branches.business_type is
  'Vertical this branch operates as — "queue" (walk-in/ticket queue, e.g. tax office) or "gym" (recurring class bookings).';
comment on column public.branches.booking_faq is
  'Owner-editable FAQ shown on the public booking page — array of {"q": "...", "a": "..."} objects. Replaces ad-hoc WhatsApp Q&A (pain point #3).';

-- ── 2. Class "level" on services ─────────────────────────────────────
-- For gyms, each "service" represents a class type
-- (Beginner Striking / Advanced Sparring / Conditioning, etc).
-- `level` lets the booking page auto-filter by skill level (pain point #5).
alter table public.services
  add column if not exists level text
  check (level is null or level in ('beginner', 'advanced', 'all_levels', 'conditioning'));

comment on column public.services.level is
  'Skill level this class is aimed at (gym mode only) — used to auto-filter the booking page for beginners vs advanced students.';

-- ── 3. Attendance-confirmation + reminder tracking on bookings ──────
-- Supports pain point #1 (no-shows): a "confirm attendance" step plus
-- a one-time auto-reminder a few hours before class.
alter table public.bookings
  add column if not exists confirmed_at     timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists customer_id      uuid references public.customers(id) on delete set null;

comment on column public.bookings.confirmed_at is
  'Set when the student taps "Confirm attendance" — null means unconfirmed.';
comment on column public.bookings.reminder_sent_at is
  'Set once the 2–3 hr pre-class SMS reminder has been dispatched, so we never double-send.';
comment on column public.bookings.customer_id is
  'Links the booking to its customer/student record so attendance can roll up into sessions_attended / no_show_strikes.';

create index if not exists bookings_customer_idx on public.bookings(customer_id);

-- ── 4. Student tracking on customers ─────────────────────────────────
-- Supports pain point #6 (no student tracking) and the strike half of #1.
alter table public.customers
  add column if not exists sessions_attended int  not null default 0,
  add column if not exists no_show_strikes   int  not null default 0,
  add column if not exists student_track     text
    check (student_track is null or student_track in ('beginner', 'intermediate', 'fighter'));

comment on column public.customers.sessions_attended is
  'Running count of completed/attended classes — shown as a "Sessions attended" badge on the student profile.';
comment on column public.customers.no_show_strikes is
  'Running count of confirmed-but-missed bookings — instructor-visible flag for repeat no-shows.';
comment on column public.customers.student_track is
  'Coach-assigned track for the student — beginner / intermediate / fighter. Used for class recommendations and roster filtering.';

-- ── 5. Helpful indexes ───────────────────────────────────────────────
create index if not exists branches_business_type_idx on public.branches(business_type);
create index if not exists services_level_idx          on public.services(level);

-- ════════════════════════════════════════════════════════════════════
-- Done. No RLS changes needed — these are plain columns on tables that
-- already have owner/staff policies in place (0001_init, 0011_customers,
-- 0006_public_bookings).
-- ════════════════════════════════════════════════════════════════════
