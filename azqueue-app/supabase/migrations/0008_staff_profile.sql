-- AzQueue · 0008 — Staff profile fields
-- Run AFTER 0007.
--
-- Per-staff configuration that drives smart routing:
--   · services_handled    — which services this person can take
--   · service_preferences — 1..5 weight per service (autopilot uses for routing)
--   · max_complexity      — 1..5 cap (basic / simple / moderate / complex / expert)
--   · work_style          — balanced | high_volume | complex_cases
--   · expertise_areas     — freeform tags (Walk-ins, Regulars, VIP, etc.)
--   · languages           — array of {code, fluency: fluent|conversational|basic}
--   · estimated_times     — map of service_id → minutes (per-staff service avg)
--   · notes               — owner-only freeform

alter table public.staff
  add column if not exists services_handled    uuid[]  not null default '{}',
  add column if not exists service_preferences jsonb   not null default '{}'::jsonb,
  add column if not exists max_complexity      int     not null default 3,
  add column if not exists work_style          text    not null default 'balanced'
    check (work_style in ('balanced','high_volume','complex_cases')),
  add column if not exists expertise_areas     text[]  not null default '{}',
  add column if not exists languages           jsonb   not null default '[]'::jsonb,
  add column if not exists estimated_times     jsonb   not null default '{}'::jsonb,
  add column if not exists notes               text,
  add column if not exists profile_updated_at  timestamptz;

create index if not exists staff_services_handled_idx on public.staff using gin (services_handled);
create index if not exists staff_expertise_idx        on public.staff using gin (expertise_areas);
