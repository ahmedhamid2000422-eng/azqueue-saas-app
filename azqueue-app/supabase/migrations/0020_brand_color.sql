-- ============================================================
-- 0020_brand_color.sql
-- Adds per-branch brand colour so owners can theme their
-- customer-facing portal (check-in, ticket, booking pages).
-- Default matches AzQueue gold (#b8955a).
-- ============================================================

alter table public.branches
  add column if not exists brand_color text not null default '#b8955a';

comment on column public.branches.brand_color is
  'Hex colour applied to the customer-facing portal accent (buttons, highlights, QR). Defaults to AzQueue gold.';
