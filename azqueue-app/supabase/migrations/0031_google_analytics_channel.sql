-- =====================================================================
-- AzQueue · 0031 — Google Analytics (GA4) as an analytics-only connection
--
-- Widens channel_connections.channel to allow 'google_analytics'. Like
-- Slack, this is a one-directional connection — but in the opposite
-- direction from Slack: AzQueue pulls metrics IN from GA4, it never
-- writes anything back. Unlike Freshdesk/Zid/Shopify, what comes in
-- isn't customer records — it's aggregate site metrics (sessions, users,
-- conversions) — so nothing gets imported into `customers` or
-- `customer_events`. The ga4-metrics Edge Function fetches live from
-- Google's Data API on demand; nothing is persisted here beyond the
-- connection credentials themselves.
--
-- HOW THE OWNER CONNECTS IT (self-serve, no Claude/AzQueue involvement):
--   1. In Google Cloud Console: create (or reuse) a project, enable the
--      "Google Analytics Data API"
--   2. IAM & Admin → Service Accounts → Create service account → Create
--      a JSON key (downloads a .json file)
--   3. In Google Analytics: Admin → Property Access Management → add the
--      service account's email as a Viewer on the GA4 property
--   4. Find the Property ID: Admin → Property Settings (a number, not the
--      "G-XXXXXXX" measurement ID)
--   5. Paste the downloaded JSON file's contents + the Property ID into
--      AzQueue Settings → Integrations → Google Analytics
--
-- Same dynamic constraint-name lookup as 0027/0028/0030.
-- =====================================================================

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.channel_connections'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%slack%';
  if con_name is not null then
    execute format('alter table public.channel_connections drop constraint %I', con_name);
  end if;
end $$;

alter table public.channel_connections
  add constraint channel_connections_channel_check
  check (channel in ('facebook', 'instagram', 'whatsapp', 'email', 'freshdesk', 'zid', 'shopify', 'slack', 'google_analytics'));
