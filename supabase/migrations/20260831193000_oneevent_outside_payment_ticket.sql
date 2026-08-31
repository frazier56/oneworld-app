-- Record host-confirmed event payments made outside OneEvent without
-- misclassifying the attendee as complimentary or inventing a Stripe charge.
alter table public.event_applications
  add column if not exists payment_origin text,
  add column if not exists outside_payment_recorded_at timestamptz,
  add column if not exists outside_payment_recorded_by uuid references auth.users(id);

alter table public.event_registrations
  add column if not exists payment_origin text,
  add column if not exists external_payment_method text,
  add column if not exists external_payment_note text;

update public.event_applications
set payment_origin = 'oneevent'
where payment_status = 'paid'
  and payment_origin is null;

update public.event_registrations
set payment_origin = case
  when registration_source = 'paid' and payment_status = 'paid' then 'oneevent'
  else null
end
where payment_origin is null;

create or replace function public.issue_outside_paid_event_ticket_internal(
  p_actor_id uuid,
  p_application_id uuid,
  p_claim_token text,
  p_method text default 'outside_oneevent',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_application public.event_applications%rowtype;
  v_event public.events%rowtype;
  v_existing public.event_registrations%rowtype;
  v_registration public.event_registrations%rowtype;
  v_ticket_type text;
  v_quantity integer;
  v_unit_price numeric;
  v_amount numeric;
  v_qr_code text;
  v_token_hash text;
begin
  if p_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
    into v_application
    from public.event_applications
   where id = p_application_id
   for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if not public.is_event_manager(v_application.event_id, p_actor_id) then
    raise exception 'Only this event''s host or event managers can record an outside payment';
  end if;

  if lower(coalesce(v_application.approval_status, '')) = 'rejected' then
    raise exception 'A rejected application cannot receive a ticket';
  end if;

  select *
    into v_existing
    from public.event_registrations
   where application_id = p_application_id
     and lower(coalesce(status, '')) not in ('cancelled', 'canceled')
     and coalesce(qr_valid, true)
   order by registered_at desc
   limit 1
   for update;

  if found then
    if v_existing.payment_origin = 'outside_oneevent' then
      return jsonb_build_object(
        'registration_id', v_existing.id,
        'event_id', v_existing.event_id,
        'already_issued', true,
        'amount', v_existing.amount_paid,
        'currency', v_existing.currency,
        'recipient_name', coalesce(v_existing.recipient_name, v_existing.guest_name),
        'recipient_email', coalesce(v_existing.recipient_email, v_existing.guest_email)
      );
    end if;
    raise exception 'This application already has an active ticket';
  end if;

  select *
    into v_event
    from public.events
   where id = v_application.event_id
   for update;

  if not found then
    raise exception 'Event not found';
  end if;

  v_ticket_type := case
    when lower(coalesce(v_application.ticket_type, 'ga')) = 'vip' then 'vip'
    else 'ga'
  end;
  v_quantity := greatest(1, coalesce(v_application.quantity, 1));
  v_unit_price := case
    when v_ticket_type = 'vip'
      then coalesce(v_event.vip_ticket_price, v_event.ticket_price, 0)
    else coalesce(v_event.ga_ticket_price, v_event.ticket_price, 0)
  end;
  v_amount := greatest(0, v_unit_price * v_quantity);

  if v_amount <= 0 then
    raise exception 'This event has no paid ticket amount to record';
  end if;

  if v_application.applicant_user_id is not null and exists (
    select 1
      from public.event_registrations r
     where r.event_id = v_application.event_id
       and r.user_id = v_application.applicant_user_id
       and lower(coalesce(r.status, '')) not in ('cancelled', 'canceled')
       and coalesce(r.qr_valid, true)
  ) then
    raise exception 'This applicant already has an active ticket';
  end if;

  v_token_hash := encode(extensions.digest(p_claim_token, 'sha256'), 'hex');
  v_qr_code := 'OS-EVT-' || left(v_application.event_id::text, 8) || '-OUT-'
    || left(encode(extensions.gen_random_bytes(8), 'hex'), 8);

  insert into public.event_registrations (
    event_id, user_id, quantity, status, qr_code, qr_valid, ticket_type,
    registration_source, payment_status, amount_paid, amount_paid_cents,
    platform_fee_paid, currency, paid_at,
    recipient_name, recipient_email, recipient_phone,
    guest_name, guest_email, guest_phone,
    issued_by, issued_at, claim_token_hash, claim_token_expires_at,
    ticket_email_status, application_id, sms_optin,
    payment_origin, external_payment_method, external_payment_note
  ) values (
    v_application.event_id, v_application.applicant_user_id, v_quantity,
    'registered', v_qr_code, true, v_ticket_type,
    'paid', 'paid', v_amount, round(v_amount * 100)::integer,
    0, upper(coalesce(v_event.currency, 'USD')), now(),
    trim(v_application.applicant_name), lower(trim(v_application.applicant_email)),
    nullif(trim(coalesce(v_application.applicant_phone, '')), ''),
    case when v_application.applicant_user_id is null then trim(v_application.applicant_name) else null end,
    case when v_application.applicant_user_id is null then lower(trim(v_application.applicant_email)) else null end,
    case when v_application.applicant_user_id is null then nullif(trim(coalesce(v_application.applicant_phone, '')), '') else null end,
    p_actor_id, now(), v_token_hash, now() + interval '30 days',
    'pending', v_application.id, v_application.sms_optin,
    'outside_oneevent', left(coalesce(nullif(trim(p_method), ''), 'outside_oneevent'), 80),
    nullif(left(trim(coalesce(p_note, '')), 500), '')
  )
  returning * into v_registration;

  update public.event_applications
     set approval_status = 'approved',
         approved_at = coalesce(approved_at, now()),
         approved_by = coalesce(approved_by, p_actor_id),
         payment_status = 'paid',
         paid_at = coalesce(paid_at, now()),
         payment_origin = 'outside_oneevent',
         outside_payment_recorded_at = now(),
         outside_payment_recorded_by = p_actor_id,
         updated_at = now()
   where id = v_application.id;

  insert into public.event_ticket_audit (
    registration_id, event_id, actor_id, action, registration_source, metadata
  ) values (
    v_registration.id, v_registration.event_id, p_actor_id,
    'outside_payment_recorded_ticket_issued', 'paid',
    jsonb_build_object(
      'application_id', v_application.id,
      'ticket_type', v_ticket_type,
      'quantity', v_quantity,
      'amount', v_amount,
      'currency', upper(coalesce(v_event.currency, 'USD')),
      'payment_origin', 'outside_oneevent',
      'method', left(coalesce(nullif(trim(p_method), ''), 'outside_oneevent'), 80),
      'note', nullif(left(trim(coalesce(p_note, '')), 500), ''),
      'platform_fee', 0
    )
  );

  return jsonb_build_object(
    'registration_id', v_registration.id,
    'event_id', v_registration.event_id,
    'already_issued', false,
    'amount', v_amount,
    'currency', v_registration.currency,
    'ticket_type', v_ticket_type,
    'quantity', v_quantity,
    'claim_token', p_claim_token,
    'recipient_name', trim(v_application.applicant_name),
    'recipient_email', lower(trim(v_application.applicant_email)),
    'event_title', v_event.title,
    'event_start_date', v_event.start_date,
    'event_location', coalesce(v_event.venue_name, v_event.location, '')
  );
end;
$function$;

revoke all on function public.issue_outside_paid_event_ticket_internal(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.issue_outside_paid_event_ticket_internal(uuid, uuid, text, text, text)
  to service_role;

comment on function public.issue_outside_paid_event_ticket_internal(uuid, uuid, text, text, text)
  is 'Atomically records a manager-confirmed outside payment, approves the application, issues a paid ticket, and writes an audit trail.';

