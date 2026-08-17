-- ═══════════════════════════════════════════════════════════════════
-- AzQueue · Enable Supabase Realtime on the live-updating tables
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- WHAT IT FIXES:
--   The TV display, staff queue and dashboard all subscribe to
--   postgres_changes on `tickets`. Postgres only emits those events for
--   tables included in the `supabase_realtime` publication — and no
--   migration ever added them. The subscription connected successfully
--   but never received a single event, so screens only updated on their
--   fallback poll (up to 60s late).
--
--   REPLICA IDENTITY FULL is required so that UPDATE and DELETE events
--   carry the old row. Without it, Realtime cannot evaluate the
--   `branch_id=eq.<id>` filter on those events and drops them.
-- ═══════════════════════════════════════════════════════════════════

-- Ensure the publication exists (it does on all standard Supabase projects)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Add each table only if it isn't already published
do $$
declare
  t text;
begin
  -- Every table the app subscribes to via postgres_changes
  foreach t in array array[
    'tickets', 'bookings', 'branches', 'staff', 'stations',
    'customers', 'customer_events', 'surveys', 'tasks',
    'escalations', 'wa_conversations'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;  -- table doesn't exist in this project, skip
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename  = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    -- Needed for UPDATE/DELETE payloads to include the filter column
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- Verify: should list tickets, bookings, staff, stations
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
