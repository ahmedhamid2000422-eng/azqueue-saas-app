-- ============================================================
-- Survey responses — stores answers from the AzQueue market
-- research questionnaire (WhatsApp-style chat survey).
-- ============================================================

create table if not exists public.survey_responses (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Q1
  role          text,           -- 'student' | 'owner' | 'both'

  -- Q2 (multi-select)
  businesses    text[],         -- e.g. ['gym','tax','clinic']

  -- Q3
  frustration   text,

  -- Q4
  would_use_wa  text,           -- 'yes' | 'probably' | 'not_sure' | 'no'

  -- Q5
  top_feature   text,

  -- Q6 owner only (multi-select)
  pain_points   text[],

  -- Q7 owner only
  willingness_to_pay text,

  -- metadata
  user_agent    text,
  referrer      text
);

alter table public.survey_responses enable row level security;

-- Anyone (including anon visitors) can submit a response
create policy "anon_insert_survey"
  on public.survey_responses for insert
  to anon
  with check (true);

-- Only signed-in users can read results
create policy "auth_select_survey"
  on public.survey_responses for select
  to authenticated
  using (true);
