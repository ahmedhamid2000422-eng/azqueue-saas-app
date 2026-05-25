-- 0016_notifications_log.sql
-- Logs every outbound notification (WhatsApp, SMS, etc.) sent via Edge Functions.

create table if not exists public.notifications_log (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid references public.branches(id) on delete cascade,
  ticket_id   uuid references public.tickets(id) on delete set null,
  channel     text not null default 'whatsapp',
  template    text not null,
  to_phone    text,
  status      text not null check (status in ('queued', 'sent', 'failed')),
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_log_branch_idx on public.notifications_log(branch_id, created_at desc);
create index if not exists notifications_log_ticket_idx on public.notifications_log(ticket_id) where ticket_id is not null;

-- Only branch staff and owners can read their own logs
alter table public.notifications_log enable row level security;

create policy "branch staff can read notifications"
  on public.notifications_log for select
  using (
    exists (
      select 1 from public.staff s
      where s.branch_id = notifications_log.branch_id
        and s.user_id = auth.uid()
    )
  );

create policy "branch owners can read notifications"
  on public.notifications_log for select
  using (
    exists (
      select 1 from public.branches b
      where b.id = notifications_log.branch_id
        and b.user_id = auth.uid()
    )
  );
