-- Fulfill paid direct OneEvent checkouts from a verified Stripe webhook.
-- This closes the browser-return gap: a paid Checkout Session must still create
-- exactly one ticket when the buyer closes the success page before it loads.

create unique index if not exists event_registrations_stripe_session_uidx
  on public.event_registrations (stripe_session_id)
  where stripe_session_id is not null;

create unique index if not exists event_registrations_stripe_payment_intent_uidx
  on public.event_registrations (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create or replace function public.fulfill_direct_event_checkout(
  p_event_id uuid,
  p_user_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_quantity integer,
  p_ticket_type text,
  p_ticket_amount numeric,
  p_platform_fee numeric,
  p_currency text,
  p_paid_at timestamptz,
  p_stripe_session_id text,
  p_payment_intent_id text,
  p_qr_code text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_existing public.event_registrations%rowtype;
  v_registration_id uuid;
  v_ticket_type text := lower(coalesce(nullif(trim(p_ticket_type), ''), 'ga'));
  v_guest_email text := lower(nullif(trim(p_guest_email), ''));
begin
  if nullif(trim(p_stripe_session_id), '') is null
     or nullif(trim(p_payment_intent_id), '') is null then
    raise exception 'Stripe payment identity is required';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'Ticket quantity must be between 1 and 10';
  end if;

  if v_ticket_type not in ('ga', 'vip') then
    raise exception 'Unsupported ticket type';
  end if;

  if coalesce(p_ticket_amount, -1) < 0 or coalesce(p_platform_fee, -1) < 0 then
    raise exception 'Payment amounts cannot be negative';
  end if;

  if p_user_id is null and (
    v_guest_email is null
    or length(trim(coalesce(p_guest_name, ''))) < 2
  ) then
    raise exception 'Guest name and email are required';
  end if;

  select * into v_event
    from public.events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'Event not found';
  end if;

  -- Stripe can retry the event, and the browser-return verifier can win the
  -- race. Either way, an already-fulfilled payment is a successful no-op.
  select * into v_existing
    from public.event_registrations
   where stripe_session_id = p_stripe_session_id
      or stripe_payment_intent_id = p_payment_intent_id
   order by registered_at asc
   limit 1
   for update;

  if found then
    if v_existing.event_id <> p_event_id then
      raise exception 'Stripe payment is already attached to another event';
    end if;
    return v_existing.id;
  end if;

  -- A second, distinct successful charge for the same admission needs human
  -- review/refund; silently attaching it to an old ticket would hide money.
  if p_user_id is not null then
    select * into v_existing
      from public.event_registrations
     where event_id = p_event_id and user_id = p_user_id
     limit 1
     for update;
  else
    select * into v_existing
      from public.event_registrations
     where event_id = p_event_id
       and user_id is null
       and lower(guest_email) = v_guest_email
     limit 1
     for update;
  end if;

  if found then
    raise exception 'A different registration already exists for this attendee and event';
  end if;

  insert into public.event_registrations (
    event_id, user_id, guest_name, guest_email, guest_phone,
    status, qr_code, qr_valid, quantity, ticket_type,
    registration_source, payment_status, amount_paid, amount_paid_cents,
    platform_fee_paid, currency, paid_at, stripe_session_id,
    stripe_payment_intent_id, recipient_name, recipient_email, recipient_phone
  ) values (
    p_event_id, p_user_id,
    case when p_user_id is null then trim(p_guest_name) else null end,
    case when p_user_id is null then v_guest_email else null end,
    case when p_user_id is null then nullif(trim(p_guest_phone), '') else null end,
    'registered', p_qr_code, true, p_quantity, v_ticket_type,
    'paid', 'paid', p_ticket_amount, round(p_ticket_amount * 100)::integer,
    p_platform_fee, upper(coalesce(nullif(trim(p_currency), ''), v_event.currency, 'USD')),
    coalesce(p_paid_at, now()), p_stripe_session_id, p_payment_intent_id,
    case when p_user_id is null then trim(p_guest_name) else null end,
    case when p_user_id is null then v_guest_email else null end,
    case when p_user_id is null then nullif(trim(p_guest_phone), '') else null end
  )
  returning id into v_registration_id;

  insert into public.event_ticket_audit (
    registration_id, event_id, actor_id, action, registration_source, metadata
  ) values (
    v_registration_id, p_event_id, null, 'paid_ticket_webhook_fulfilled', 'paid',
    jsonb_build_object(
      'stripe_session_id', p_stripe_session_id,
      'stripe_payment_intent_id', p_payment_intent_id,
      'ticket_type', v_ticket_type,
      'quantity', p_quantity
    )
  );

  return v_registration_id;
end;
$$;

revoke all on function public.fulfill_direct_event_checkout(
  uuid, uuid, text, text, text, integer, text, numeric, numeric,
  text, timestamptz, text, text, text
) from public, anon, authenticated;

grant execute on function public.fulfill_direct_event_checkout(
  uuid, uuid, text, text, text, integer, text, numeric, numeric,
  text, timestamptz, text, text, text
) to service_role;
