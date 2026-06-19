-- AzQueue · 0036 — Allow 'design' and 'architecture' business types (QA bug C2)
--
-- Context: supabase/functions/wa-bot/flows.ts has shipped four complete
-- WhatsApp conversation flows since 0019/0029 (queue, gym, design,
-- architecture — see DEFAULT_FLOWS in flows.ts). 0019's own header comment
-- even flagged "design" as a "future business_type value". But the
-- branches.business_type check constraint added in 0018_gym_mode.sql only
-- ever allowed ('queue', 'gym'), and the Settings > Modes tab UI only ever
-- rendered two picker buttons — so "design" and "architecture" branches
-- could never actually be created, even though the bot-side support for
-- them was fully built and tested.
--
-- This migration widens the constraint to match what flows.ts already
-- supports. See the companion UI change in src/modes/business/Settings.jsx
-- (ModesTab), which now renders all four business types as picker buttons.
--
-- Safe to run multiple times — drops and recreates the named constraint.

alter table public.branches
  drop constraint if exists branches_business_type_check;

alter table public.branches
  add constraint branches_business_type_check
  check (business_type in ('queue', 'gym', 'design', 'architecture'));

comment on column public.branches.business_type is
  'Which dashboard/WhatsApp flow this branch uses: queue (walk-in ticket queue, '
  'e.g. tax/clinic), gym (recurring class bookings), design (interior design '
  'studio), or architecture (architecture/design firm). Drives both the '
  'in-app tools shown (Settings > Modes) and the default WhatsApp bot flow '
  '(supabase/functions/wa-bot/flows.ts).';
