-- =====================================================================
-- AzQueue · 0003 — staff status log + auto-trigger
-- Run this AFTER 0002, in Supabase SQL Editor.
-- =====================================================================
--
-- Why: Manager Mode needs to compute break patterns and wellness signals.
-- That requires history, not just the current row. This migration adds:
--   1. staff_status_log table — append-only history of status changes
--   2. Trigger on staff updates that writes a log row whenever status changes
--   3. RLS policies so only branch members can read their own log

create table if not exists public.staff_status_log (
  id          uuid primary key default uuid_generate_v4(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  staff_id    uuid not null references public.staff(id)    on delete cascade,
  status      text not null,        -- off / active / serving / on_break
  changed_at  timestamptz not null default now()
);

create index if not exists staff_status_log_staff_idx  on public.staff_status_log(staff_id, changed_at desc);
create index if not exists staff_status_log_branch_idx on public.staff_status_log(branch_id, changed_at desc);

-- RLS — same "user belongs to branch" gate as the rest
alter table public.staff_status_log enable row level security;

drop policy if exists staff_status_log_rw on public.staff_status_log;
create policy staff_status_log_rw on public.staff_status_log for all
  using (user_belongs_to_branch(branch_id))
  with check (user_belongs_to_branch(branch_id));

-- Auto-log on every status change
create or replace function public.log_staff_status_change()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into public.staff_status_log (branch_id, staff_id, status, changed_at)
    values (new.branch_id, new.id, new.status, now());

    -- Also bump status_since on the parent row
    new.status_since := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_staff_status_log on public.staff;
create trigger trg_staff_status_log
  before update on public.staff
  for each row execute procedure public.log_staff_status_change();

-- Seed a row for staff that already exist (so today's counts have a starting point)
insert into public.staff_status_log (branch_id, staff_id, status, changed_at)
select branch_id, id, status, coalesce(status_since, created_at)
from public.staff
where not exists (
  select 1 from public.staff_status_log l where l.staff_id = staff.id
);
