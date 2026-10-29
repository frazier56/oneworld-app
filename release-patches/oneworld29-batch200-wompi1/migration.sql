-- WOMPI 1 — local Colombian payments rail (Nequi, PSE, card) behind One World's own screens.
-- Rows are written ONLY by the wompi-pay / wompi-webhook edge functions (service role).
create table if not exists public.wompi_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  env text not null check (env in ('sandbox','production')),
  purpose text not null,
  purpose_ref text,
  reference text not null unique,
  amount_in_cents bigint not null check (amount_in_cents > 0),
  currency text not null default 'COP' check (currency = 'COP'),
  method text not null check (method in ('NEQUI','PSE','CARD','BANCOLOMBIA_TRANSFER')),
  wompi_tx_id text unique,
  status text not null default 'CREATED'
    check (status in ('CREATED','PENDING','APPROVED','DECLINED','VOIDED','ERROR')),
  status_message text,
  redirect_url text,
  last_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index if not exists wompi_payments_user_idx on public.wompi_payments(user_id, created_at desc);
create index if not exists wompi_payments_purpose_idx on public.wompi_payments(purpose, purpose_ref);

create table if not exists public.wompi_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  env text not null,
  wompi_tx_id text,
  status text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.wompi_payments enable row level security;
alter table public.wompi_events enable row level security;
revoke all on public.wompi_payments from anon, authenticated;
revoke all on public.wompi_events from anon, authenticated;
grant select on public.wompi_payments to authenticated;
drop policy if exists wompi_payments_own_read on public.wompi_payments;
create policy wompi_payments_own_read on public.wompi_payments
  for select to authenticated using (user_id = (select auth.uid()));
-- wompi_events: no client access at all (service role only).
