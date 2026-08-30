-- event_registrations.trg_recalculate_event_ticket_totals is the single owner of
-- attendee, sold-inventory, and revenue aggregates. The guest-list RPCs must not
-- manually increment/decrement those same counters after changing a registration.

create or replace function public.issue_complimentary_event_ticket_internal(
  p_actor_id uuid,
  p_event_id uuid,
  p_ticket_type text,
  p_recipient_name text,
  p_recipient_email text,
  p_recipient_phone text,
  p_claim_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_ticket_type text := lower(coalesce(nullif(p_ticket_type, ''), 'ga'));
  v_capacity integer;
  v_sold integer;
  v_registration public.event_registrations%rowtype;
  v_qr_code text;
  v_token_hash text;
begin
  if p_actor_id is null or not public.is_event_manager(p_event_id, p_actor_id) then
    raise exception 'Not authorized to issue tickets for this event';
  end if;

  if length(trim(coalesce(p_recipient_name, ''))) < 2 then
    raise exception 'Recipient name is required';
  end if;

  if p_recipient_email is null
     or p_recipient_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid recipient email is required';
  end if;

  if length(regexp_replace(coalesce(p_recipient_phone, ''), '\D', '', 'g')) < 7 then
    raise exception 'Recipient phone number is required';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  if v_ticket_type = 'vip' then
    v_capacity := coalesce(v_event.vip_ticket_qty, 0);
    v_sold := coalesce(v_event.vip_sold, 0);
  else
    v_ticket_type := 'ga';
    v_capacity := coalesce(v_event.ga_ticket_qty, v_event.max_attendees, 999999);
    v_sold := coalesce(v_event.ga_sold, 0);
  end if;

  if greatest(v_capacity - v_sold, 0) < 1 then
    raise exception 'No % tickets remaining', upper(v_ticket_type);
  end if;

  v_token_hash := encode(extensions.digest(p_claim_token, 'sha256'), 'hex');
  v_qr_code := 'OS-EVT-' || left(p_event_id::text, 8) || '-COMP-'
    || left(encode(extensions.gen_random_bytes(8), 'hex'), 8);

  insert into public.event_registrations (
    event_id, user_id, quantity, status, qr_code, ticket_type,
    registration_source, payment_status, amount_paid, platform_fee_paid,
    currency, recipient_name, recipient_email, recipient_phone,
    guest_name, guest_email, guest_phone, issued_by, issued_at,
    claim_token_hash, claim_token_expires_at, ticket_email_status
  ) values (
    p_event_id, null, 1, 'registered', v_qr_code, v_ticket_type,
    'complimentary', 'complimentary', 0, 0,
    coalesce(v_event.currency, 'USD'), trim(p_recipient_name),
    lower(trim(p_recipient_email)), trim(p_recipient_phone),
    trim(p_recipient_name), lower(trim(p_recipient_email)), trim(p_recipient_phone),
    p_actor_id, now(), v_token_hash, now() + interval '30 days', 'pending'
  )
  returning * into v_registration;

  -- The registration aggregate trigger updates attendee_count/ga_sold/vip_sold.
  insert into public.event_ticket_audit (
    registration_id, event_id, actor_id, action, registration_source, metadata
  ) values (
    v_registration.id, p_event_id, p_actor_id,
    'complimentary_ticket_issued', 'complimentary',
    jsonb_build_object(
      'ticket_type', v_ticket_type,
      'recipient_email', lower(trim(p_recipient_email))
    )
  );

  return jsonb_build_object(
    'registration_id', v_registration.id,
    'event_id', p_event_id,
    'ticket_type', v_ticket_type,
    'claim_token', p_claim_token
  );
end;
$$;

create or replace function public.cancel_event_ticket_internal(
  p_actor_id uuid,
  p_registration_id uuid,
  p_reason text,
  p_refund_status text default 'not_required',
  p_stripe_refund_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registration public.event_registrations%rowtype;
  v_restore_inventory boolean;
  v_ticket_type text;
begin
  select * into v_registration
  from public.event_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'Ticket not found';
  end if;

  if p_actor_id is null
     or not public.is_event_manager(v_registration.event_id, p_actor_id) then
    raise exception 'Not authorized to cancel this ticket';
  end if;

  if lower(coalesce(v_registration.status, '')) in ('cancelled', 'canceled') then
    return jsonb_build_object(
      'registration_id', v_registration.id,
      'already_cancelled', true,
      'refund_status', v_registration.refund_status
    );
  end if;

  v_ticket_type := lower(coalesce(nullif(v_registration.ticket_type, ''), 'ga'));
  v_restore_inventory := coalesce(v_registration.checked_in_count, 0) = 0
    and v_registration.checked_in_at is null;

  update public.event_registrations
  set status = 'cancelled',
      qr_valid = false,
      qr_invalidated_at = coalesce(qr_invalidated_at, now()),
      cancelled_at = coalesce(cancelled_at, now()),
      cancelled_by = p_actor_id,
      cancellation_reason = coalesce(
        nullif(trim(p_reason), ''), cancellation_reason, 'Host cancelled ticket'
      ),
      refund_status = coalesce(nullif(p_refund_status, ''), refund_status),
      stripe_refund_id = coalesce(p_stripe_refund_id, stripe_refund_id),
      refunded_at = case
        when p_refund_status = 'succeeded' then coalesce(refunded_at, now())
        else refunded_at
      end,
      payment_status = case
        when registration_source = 'paid' and p_refund_status = 'succeeded' then 'refunded'
        when registration_source = 'paid' and p_refund_status = 'pending' then 'refund_pending'
        else payment_status
      end,
      updated_at = now()
  where id = p_registration_id;

  -- The registration aggregate trigger restores inventory exactly once.
  insert into public.event_ticket_audit (
    registration_id, event_id, actor_id, action, registration_source, metadata
  ) values (
    v_registration.id,
    v_registration.event_id,
    p_actor_id,
    case
      when v_registration.registration_source = 'paid'
        then 'paid_ticket_cancelled_refunded'
      else 'ticket_cancelled'
    end,
    v_registration.registration_source,
    jsonb_build_object(
      'restored_inventory', v_restore_inventory,
      'ticket_type', v_ticket_type,
      'refund_status', p_refund_status,
      'stripe_refund_id', p_stripe_refund_id
    )
  );

  return jsonb_build_object(
    'registration_id', v_registration.id,
    'restored_inventory', v_restore_inventory,
    'refund_status', p_refund_status
  );
end;
$$;


