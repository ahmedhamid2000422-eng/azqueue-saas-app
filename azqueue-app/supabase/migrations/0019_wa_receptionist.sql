-- ============================================================
-- 0019_wa_receptionist.sql
-- WhatsApp AI Receptionist module
--
-- Works across all AzQueue business types:
--   queue  → tax / professional services
--   gym    → fight gym / class studio
--   design → interior design / creative studio  (future business_type value)
--
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ============================================================

-- ── Branches: WhatsApp config ────────────────────────────────
alter table public.branches
  add column if not exists wa_phone      text,             -- E.164, e.g. +60123456789
  add column if not exists wa_enabled    boolean not null default false,
  add column if not exists wa_flow_config jsonb not null default '{}'::jsonb;
  -- wa_flow_config shape (optional overrides; defaults come from business_type):
  -- {
  --   "welcome"     : "Hi! Welcome to {{branch}}...",
  --   "menu_items"  : [{ "id": "reno", "label": "Full Home Renovation" }, ...],
  --   "questions"   : [{ "id": "budget", "ask": "What is your budget range?", "key": "budget_range" }, ...],
  --   "handoff_msg" : "Thanks! Our team will be in touch shortly.",
  --   "brand_tone"  : "professional | casual | friendly"
  -- }

-- ── Customers: lead tracking ──────────────────────────────────
alter table public.customers
  add column if not exists lead_score  text
    check (lead_score  is null or lead_score  in ('HOT', 'WARM', 'COLD')),
  add column if not exists lead_source text,          -- 'whatsapp' | 'walkin' | 'referral' | ...
  add column if not exists lead_data   jsonb not null default '{}'::jsonb;
  -- lead_data shape (populated by the WA bot):
  -- {
  --   "service_category" : "Full Home Renovation",
  --   "property_type"    : "Landed House",
  --   "location"         : "Putrajaya",
  --   "budget_range"     : "RM 50k–100k",
  --   "timeline"         : "1-3 months",
  --   "requirements"     : "Open plan kitchen...",
  --   "next_action"      : "Book consultation",
  --   "summary"          : "Hot lead — renovation ready homeowner..."
  -- }

-- ── WhatsApp conversation sessions ───────────────────────────
create table if not exists public.wa_conversations (
  id           uuid        primary key default gen_random_uuid(),
  branch_id    uuid        not null references public.branches(id) on delete cascade,
  wa_from      text        not null,   -- customer WhatsApp number (E.164)
  state        text        not null default 'init',
  -- state machine values:
  --   init → menu → qualifying → booking_date → booking_time → booking_purpose → done
  context      jsonb       not null default '{}'::jsonb,  -- accumulated answers
  lead_score   text        check (lead_score is null or lead_score in ('HOT', 'WARM', 'COLD')),
  customer_id  uuid        references public.customers(id) on delete set null,
  completed    boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Unique active conversation per phone+branch (one at a time)
create unique index if not exists wa_conversations_active_idx
  on public.wa_conversations (branch_id, wa_from)
  where not completed;

create index if not exists wa_conversations_branch_idx  on public.wa_conversations (branch_id);
create index if not exists wa_conversations_customer_idx on public.wa_conversations (customer_id);
create index if not exists customers_lead_score_idx     on public.customers (lead_score);

-- Auto-update updated_at
create or replace function public.wa_conversations_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wa_conversations_updated_at on public.wa_conversations;
create trigger wa_conversations_updated_at
  before update on public.wa_conversations
  for each row execute function public.wa_conversations_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.wa_conversations enable row level security;

-- Staff/owners of a branch can read their conversations
create policy "branch staff can read wa_conversations"
  on public.wa_conversations for select
  using (
    branch_id in (
      select id from public.branches where owner_id = auth.uid()
      union
      select branch_id from public.staff where user_id = auth.uid()
    )
  );

-- Only the Edge Function (service_role key) can insert/update conversations.
-- Client-side reads are fine for the dashboard; writes must go via the Edge Function.
create policy "service role manages wa_conversations"
  on public.wa_conversations for all
  using    (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
