-- =====================================================================
-- AzQueue · 0005 — Personal Flow tables
-- Run this AFTER 0004, in Supabase SQL Editor.
-- =====================================================================
--
-- Backs the Personal Flow product (Deep Work / Tasks / Docs / Schedule / AI).
-- Each row is owned by a single user — no shared visibility.

-- ── Tasks ────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  due_label   text,                               -- "Today", "Tomorrow", "Thu", etc — UI-friendly
  due_at      timestamptz,                        -- structured due, optional
  done        boolean not null default false,
  priority    boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_owner_idx on public.tasks(owner_id, done, created_at desc);

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks
  for each row execute procedure set_updated_at();

-- ── Docs ─────────────────────────────────────────────────────────────
create table if not exists public.docs (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Untitled',
  body        text,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists docs_owner_idx on public.docs(owner_id, updated_at desc);

drop trigger if exists docs_updated_at on public.docs;
create trigger docs_updated_at before update on public.docs
  for each row execute procedure set_updated_at();

-- ── Deep work sessions ───────────────────────────────────────────────
create table if not exists public.deep_work_sessions (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  task_id       uuid references public.tasks(id) on delete set null,
  title         text not null,
  target_min    int  not null default 90,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  duration_sec  int,
  completed     boolean not null default false
);
create index if not exists dws_owner_idx on public.deep_work_sessions(owner_id, started_at desc);

-- ── Personal prefs (one row per user) ───────────────────────────────
create table if not exists public.personal_prefs (
  owner_id           uuid primary key references auth.users(id) on delete cascade,
  daily_focus_min    int     not null default 180,
  prayer_aware       boolean not null default true,
  lat                double precision,
  lng                double precision,
  city               text,
  updated_at         timestamptz not null default now()
);
drop trigger if exists personal_prefs_updated_at on public.personal_prefs;
create trigger personal_prefs_updated_at before update on public.personal_prefs
  for each row execute procedure set_updated_at();

-- ── RLS — each user only sees & edits their own rows ────────────────
alter table public.tasks               enable row level security;
alter table public.docs                enable row level security;
alter table public.deep_work_sessions  enable row level security;
alter table public.personal_prefs      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tasks','docs','deep_work_sessions','personal_prefs']
  loop
    execute format('drop policy if exists %I_owner_rw on public.%I', t, t);
    execute format(
      'create policy %I_owner_rw on public.%I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t, t
    );
  end loop;
end $$;
