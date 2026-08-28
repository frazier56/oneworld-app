-- Make Stripe capture -> OneEvent ticket fulfillment recoverable and idempotent.

create table if not exists public.event_payment_fulfillment_attempts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.event_applications(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  approved_by uuid not null references auth.users(id) on delete restrict,
  stripe_payment_intent_id text not null,
  stripe_session_id text,
  status text not null default 'capture_pending' check (
    status in (
      'capture_pending',
      'captured',
      'fulfillment_pending',
      'fulfilled',
      'capture_failed',
      'manual_review',
      'refunded'
    )
  ),
  registration_id uuid references public.event_registrations(id) on delete set null,
  captured_at timestamptz,
  fulfilled_at timestamptz,
  last_error text,
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id),
  unique (stripe_payment_intent_id)
);

create index if not exists idx_event_payment_fulfillment_retry
  on public.event_payment_fulfillment_attempts (status, next_retry_at, created_at)
  where status in ('capture_pending', 'captured', 'fulfillment_pending');

alter table public.event_payment_fulfillment_attempts enable row level security;
revoke all on public.event_payment_fulfillment_attempts from anon, authenticated;
grant all on public.event_payment_fulfillment_attempts to service_role;

create unique index if not exists idx_event_registrations_application_unique
  on public.event_registrations (application_id)
  where application_id is not null;

create or replace function public.fulfill_approved_event_application(
  p_attempt_id uuid,
  p_application_id uuid,
  p_approved_by uuid,
  p_paid_at timestamptz,
  p_ticket_amount numeric,
  p_platform_fee numeric,
  p_currency text,
  p_stripe_session_id text,
  p_payment_intent_id text,
  p_qr_code text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.event_applications%rowtype;
  v_registration_id uuid;
begin
  select *
    into v_app
    from public.event_applications
   where id = p_application_id
   for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_app.approval_status = 'rejected' then
    raise exception 'Rejected application cannot be fulfilled';
  end if;

  if v_app.payment_status not in ('authorized', 'paid') then
    raise exception 'Application payment is not authorized';
  end if;

  update public.event_applications
     set payment_status = 'paid',
         paid_at = coalesce(paid_at, p_paid_at),
         approval_status = 'approved',
         approved_at = coalesce(approved_at, now()),
         approved_by = coalesce(approved_by, p_approved_by),
         updated_at = now()
   where id = p_application_id;

  if v_app.applicant_user_id is not null then
    insert into public.event_registrations (
      event_id, user_id, guest_name, guest_email, guest_phone,
      status, qr_code, qr_valid, quantity, ticket_type,
      registration_source, payment_status, amount_paid, amount_paid_cents,
      platform_fee_paid, currency, paid_at, stripe_session_id,
      stripe_payment_intent_id, application_id, sms_optin
    ) values (
      v_app.event_id, v_app.applicant_user_id, null, null, null,
      'registered', p_qr_code, true, v_app.quantity, v_app.ticket_type,
      'paid', 'paid', p_ticket_amount, round(p_ticket_amount * 100)::integer,
      p_platform_fee, upper(coalesce(p_currency, 'USD')), p_paid_at,
      p_stripe_session_id, p_payment_intent_id, p_application_id, v_app.sms_optin
    )
    on conflict (event_id, user_id) do update set
      status = excluded.status,
      qr_code = excluded.qr_code,
      qr_valid = excluded.qr_valid,
      quantity = excluded.quantity,
      ticket_type = excluded.ticket_type,
      registration_source = excluded.registration_source,
      payment_status = excluded.payment_status,
      amount_paid = excluded.amount_paid,
      amount_paid_cents = excluded.amount_paid_cents,
      platform_fee_paid = excluded.platform_fee_paid,
      currency = excluded.currency,
      paid_at = excluded.paid_at,
      stripe_session_id = excluded.stripe_session_id,
      stripe_payment_intent_id = excluded.stripe_payment_intent_id,
      application_id = excluded.application_id,
      sms_optin = excluded.sms_optin,
      updated_at = now()
    returning id into v_registration_id;
  else
    insert into public.event_registrations (
      event_id, user_id, guest_name, guest_email, guest_phone,
      status, qr_code, qr_valid, quantity, ticket_type,
      registration_source, payment_status, amount_paid, amount_paid_cents,
      platform_fee_paid, currency, paid_at, stripe_session_id,
      stripe_payment_intent_id, application_id, sms_optin
    ) values (
      v_app.event_id, null, v_app.applicant_name, v_app.applicant_email, v_app.applicant_phone,
      'registered', p_qr_code, true, v_app.quantity, v_app.ticket_type,
      'paid', 'paid', p_ticket_amount, round(p_ticket_amount * 100)::integer,
      p_platform_fee, upper(coalesce(p_currency, 'USD')), p_paid_at,
      p_stripe_session_id, p_payment_intent_id, p_application_id, v_app.sms_optin
    )
    on conflict (application_id) where application_id is not null do update set
      status = excluded.status,
      qr_code = excluded.qr_code,
      qr_valid = excluded.qr_valid,
      quantity = excluded.quantity,
      ticket_type = excluded.ticket_type,
      registration_source = excluded.registration_source,
      payment_status = excluded.payment_status,
      amount_paid = excluded.amount_paid,
      amount_paid_cents = excluded.amount_paid_cents,
      platform_fee_paid = excluded.platform_fee_paid,
      currency = excluded.currency,
      paid_at = excluded.paid_at,
      stripe_session_id = excluded.stripe_session_id,
      stripe_payment_intent_id = excluded.stripe_payment_intent_id,
      sms_optin = excluded.sms_optin,
      updated_at = now()
    returning id into v_registration_id;
  end if;

  update public.event_payment_fulfillment_attempts
     set status = 'fulfilled',
         registration_id = v_registration_id,
         fulfilled_at = now(),
         last_error = null,
         next_retry_at = null,
         updated_at = now()
   where id = p_attempt_id
     and application_id = p_application_id;

  if not found then
    raise exception 'Payment fulfillment attempt not found';
  end if;

  return v_registration_id;
end;
$$;

revoke all on function public.fulfill_approved_event_application(
  uuid, uuid, uuid, timestamptz, numeric, numeric, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.fulfill_approved_event_application(
  uuid, uuid, uuid, timestamptz, numeric, numeric, text, text, text, text
) to service_role;
