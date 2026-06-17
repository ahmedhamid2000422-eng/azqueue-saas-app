-- =====================================================================
-- AzQueue · 0030 — Slack notifications channel
--
-- Widens channel_connections.channel to allow 'slack'. Unlike Freshdesk/
-- Zid/Shopify, Slack here is OUTBOUND ONLY — AzQueue posts into a Slack
-- channel (task assignments with the right person + date, WhatsApp AI
-- handoffs, etc.) via an Incoming Webhook. It does not pull anything
-- back in, so there's no customer-identity column or import table to add
-- — just a connection row holding the webhook URL.
--
-- HOW THE OWNER CONNECTS IT (self-serve, no Claude/AzQueue involvement):
--   1. In Slack: Apps → search "Incoming WebHooks" → Add to Slack
--   2. Choose the channel notifications should post into → Add Incoming WebHooks integration
--   3. Copy the generated Webhook URL (https://hooks.slack.com/services/...)
--   4. Paste it into AzQueue Settings → Integrations → Slack
--
-- Same dynamic constraint-name lookup as 0027/0028 — the constraint was
-- declared inline with no explicit name, so look up the auto-generated
-- name by definition rather than guessing it.
-- =====================================================================

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.channel_connections'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%shopify%';
  if con_name is not null then
    execute format('alter table public.channel_connections drop constraint %I', con_name);
  end if;
end $$;

alter table public.channel_connections
  add constraint channel_connections_channel_check
  check (channel in ('facebook', 'instagram', 'whatsapp', 'email', 'freshdesk', 'zid', 'shopify', 'slack'));
