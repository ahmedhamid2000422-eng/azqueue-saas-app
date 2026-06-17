-- ============================================================
-- 0029_wa_customer_service.sql
-- WhatsApp AI Customer Service + team handoff
--
-- Builds on 0019_wa_receptionist.sql (wa_conversations / wa-bot edge fn).
-- That migration gave the bot a fixed sales-qualification funnel
-- (menu → qualifying questions → done). This adds a second mode:
-- free-form AI customer service, where Claude carries an open
-- conversation, answers what it can on the business's behalf, and
-- decides for itself when a human is needed — at which point it
-- classifies the conversation into a team and hands it off instead of
-- just dropping a static "our team will reach out" message.
--
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ============================================================

-- ── Staff: which team they belong to ─────────────────────────────
-- Free text, not an enum — branch owners name their own teams
-- ("Sales", "Support", "Billing", ...). The AI picks from whichever
-- distinct team names exist for the branch (see wa-bot/support.ts).
alter table public.staff
  add column if not exists team text;

create index if not exists staff_team_idx on public.staff(branch_id, team);

-- ── wa_conversations: human handoff state ────────────────────────
alter table public.wa_conversations
  add column if not exists needs_human   boolean not null default false,
  add column if not exists assigned_team text,
  add column if not exists claimed_by    uuid references public.staff(id) on delete set null,
  add column if not exists claimed_at    timestamptz;

create index if not exists wa_conversations_needs_human_idx
  on public.wa_conversations(branch_id, needs_human)
  where needs_human = true;

-- ── wa_messages: full transcript ──────────────────────────────────
-- wa_conversations.context only ever held structured Q&A answers for
-- the funnel flow — there was nowhere to store a real back-and-forth
-- transcript. This table is that transcript, needed so staff can read
-- what was said before they take over, and so the AI has real message
-- history to reason over in free-form mode.
create table if not exists public.wa_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete cascade,
  direction       text not null check (direction in ('in', 'out')),
  sender          text not null check (sender in ('customer', 'ai', 'staff')),
  staff_id        uuid references public.staff(id) on delete set null,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists wa_messages_conversation_idx on public.wa_messages(conversation_id, created_at);
create index if not exists wa_messages_branch_idx        on public.wa_messages(branch_id);

alter table public.wa_messages enable row level security;

create policy "branch staff can read wa_messages"
  on public.wa_messages for select
  using (
    branch_id in (
      select id from public.branches where owner_id = auth.uid()
      union
      select branch_id from public.staff where user_id = auth.uid()
    )
  );

-- Only the Edge Functions (service_role key) write messages — both the
-- inbound AI side (wa-bot) and the outbound staff-reply side (wa-reply)
-- go through a service role client, never directly from the browser,
-- so a message is always logged exactly once and a customer's WhatsApp
-- number is never exposed to client-side insert/update logic.
create policy "service role manages wa_messages"
  on public.wa_messages for all
  using    (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
