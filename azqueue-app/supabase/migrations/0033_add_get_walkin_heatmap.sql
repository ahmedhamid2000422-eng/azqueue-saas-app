-- AzQueue · 0033 — Add missing get_walkin_heatmap RPC (QA bug A2)
--
-- Context: 0014_shadow_slots.sql already defines this function (section 5),
-- but live testing showed it was never deployed to the database — the
-- Shadow Slots panel fails with:
--   "Could not find the function public.get_walkin_heatmap(p_branch_id, p_days)
--    in the schema cache"
--
-- This migration adds ONLY the missing function + grants (extend-only).
-- It deliberately does NOT re-run the rest of 0014 (table, column, policies),
-- since those already appear to be live (the Shadow Slots toggle works),
-- and re-creating policies that already exist would error and abort the
-- script before reaching the function below.
--
-- Safe to run even if this function somehow already exists — uses
-- `create or replace function`.

-- ── Walk-in heatmap RPC ──────────────────────────────────────────────
-- Returns walk-in ticket counts grouped by day_of_week + hour
-- over the last N days. Used by the Shadow Slots UI to show owners
-- where their walk-in traffic actually falls.
create or replace function public.get_walkin_heatmap(
  p_branch_id uuid,
  p_days      int default 90
)
returns table (day_of_week int, hour int, ticket_count int)
language sql
security definer
set search_path = public
as $$
  select
    extract(dow  from created_at at time zone
      coalesce((select timezone from public.branches where id = p_branch_id),
               'Asia/Kuala_Lumpur'))::int  as day_of_week,
    extract(hour from created_at at time zone
      coalesce((select timezone from public.branches where id = p_branch_id),
               'Asia/Kuala_Lumpur'))::int  as hour,
    count(*)::int                           as ticket_count
  from public.tickets
  where branch_id = p_branch_id
    and source    = 'walk'
    and created_at >= now() - (p_days || ' days')::interval
  group by 1, 2
  order by 1, 2;
$$;

grant execute on function public.get_walkin_heatmap(uuid, int) to authenticated;
grant execute on function public.get_walkin_heatmap(uuid, int) to anon;
