-- Coordinate WhatsApp terminal callbacks with their SMS fallback in one transaction.
-- This is a successor to 20260911170000_oneevent_atomic_provider_status.sql.

create or replace function public.oneevent_refresh_broadcast_delivery_summary(
  p_broadcast_id uuid,
  p_status_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sent integer;
  v_queued integer;
  v_skipped integer;
  v_failed integer;
  v_pending integer;
  v_whatsapp_pending integer;
begin
  -- Serialize summary publication per broadcast. The count runs after this
  -- lock is acquired, so a callback that waited sees earlier committed rows.
  perform 1
  from public.event_rolodex_broadcasts
  where id = p_broadcast_id
  for update;

  select
    count(*) filter (where status = 'sent'),
    count(*) filter (where status = 'queued'),
    count(*) filter (where status = 'skipped'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where processing_status = 'pending'),
    count(*) filter (where skipped_reason = 'whatsapp_pending_meta_approval')
  into v_sent, v_queued, v_skipped, v_failed, v_pending, v_whatsapp_pending
  from public.event_rolodex_broadcast_recipients
  where broadcast_id = p_broadcast_id;

  update public.event_rolodex_broadcasts
  set
    sent_count = v_sent,
    queued_count = v_queued,
    skipped_count = v_skipped,
    failed_count = v_failed,
    whatsapp_pending_count = v_whatsapp_pending,
    processed_count = v_sent + v_queued + v_skipped + v_failed,
    status = case
      when v_pending > 0 or v_queued > 0 then 'processing'
      when v_failed > 0 then 'completed_with_errors'
      else 'completed'
    end,
    completed_at = case when v_pending > 0 or v_queued > 0 then null else p_status_at end
  where id = p_broadcast_id;
end
$$;

create or replace function public.oneevent_claim_sms_provider_dispatch(
  p_recipient_id uuid,
  p_broadcast_id uuid,
  p_idempotency_key text,
  p_lock_seconds integer default 180,
  p_max_attempts integer default 3
)
returns table(should_send boolean, state text, attempt_count integer, provider_sid text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_probe public.event_rolodex_broadcast_recipients%rowtype;
  v_sms public.event_rolodex_broadcast_recipients%rowtype;
  v_primary public.event_rolodex_broadcast_recipients%rowtype;
begin
  select * into v_probe
  from public.event_rolodex_broadcast_recipients
  where id = p_recipient_id;

  if not found or v_probe.broadcast_id <> p_broadcast_id or v_probe.channel <> 'sms' then
    return query select false, 'cancelled'::text, 0, null::text;
    return;
  end if;

  -- Callback and dispatch claim take locks in the same order: WhatsApp, SMS,
  -- then provider-dispatch evidence. The first transaction to lock wins.
  select * into v_primary
  from public.event_rolodex_broadcast_recipients
  where broadcast_id = p_broadcast_id
    and rolodex_id = v_probe.rolodex_id
    and channel = 'whatsapp'
  order by id
  limit 1
  for update;

  select * into v_sms
  from public.event_rolodex_broadcast_recipients
  where id = p_recipient_id
    and broadcast_id = p_broadcast_id
    and channel = 'sms'
  for update;

  if not found then
    return query select false, 'cancelled'::text, 0, null::text;
    return;
  end if;

  if v_primary.id is not null and (
    v_primary.delivered_at is not null
    or v_primary.opened_at is not null
    or lower(coalesce(v_primary.provider_status, '')) in ('delivered', 'read')
  ) then
    update public.event_rolodex_broadcast_recipients as sms
    set
      status = 'skipped',
      skipped_reason = 'whatsapp_delivered_primary',
      provider_status = 'not_needed',
      provider_status_at = now(),
      processing_status = 'done',
      processed_at = now()
    where sms.id = v_sms.id
      and sms.provider_sid is null
      and sms.provider_message_id is null
      and coalesce(sms.provider_status, '') not in ('accepted', 'sent', 'delivered', 'read');

    insert into public.event_rolodex_provider_dispatches(
      recipient_id, broadcast_id, channel, idempotency_key, state,
      last_error_code, last_error_redacted
    ) values (
      v_sms.id, p_broadcast_id, 'sms', p_idempotency_key, 'cancelled',
      'whatsapp_delivered_primary', 'SMS fallback cancelled because WhatsApp delivered'
    ) on conflict (idempotency_key) do update set
      state = case when public.event_rolodex_provider_dispatches.state = 'accepted'
        then public.event_rolodex_provider_dispatches.state else 'cancelled' end,
      lock_until = null,
      last_error_code = case when public.event_rolodex_provider_dispatches.state = 'accepted'
        then public.event_rolodex_provider_dispatches.last_error_code else 'whatsapp_delivered_primary' end,
      last_error_redacted = case when public.event_rolodex_provider_dispatches.state = 'accepted'
        then public.event_rolodex_provider_dispatches.last_error_redacted
        else 'SMS fallback cancelled because WhatsApp delivered' end,
      updated_at = now();

    return query select false, 'cancelled'::text, 0, null::text;
    return;
  end if;

  if v_primary.id is not null
    and v_primary.status not in ('failed', 'skipped')
    and lower(coalesce(v_primary.provider_status, '')) not in ('failed', 'undelivered', 'canceled') then
    return query select false, 'waiting_for_whatsapp'::text, 0, null::text;
    return;
  end if;

  if v_sms.provider_sid is not null or v_sms.provider_message_id is not null
    or lower(coalesce(v_sms.provider_status, '')) in ('accepted', 'sent', 'delivered', 'read') then
    return query select false, 'accepted'::text, 0, coalesce(v_sms.provider_sid, v_sms.provider_message_id);
    return;
  end if;

  return query
  select c.should_send, c.state, c.attempt_count, c.provider_sid
  from public.claim_event_rolodex_provider_dispatch(
    p_recipient_id,
    p_broadcast_id,
    'sms',
    p_idempotency_key,
    p_lock_seconds,
    p_max_attempts
  ) as c;
end
$$;

create or replace function public.oneevent_apply_twilio_recipient_status(
  p_recipient_id uuid,
  p_provider_status text,
  p_status_at timestamptz,
  p_error_code text default null,
  p_error_message text default null
)
returns table(applied boolean, kick_sms_fallback boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_primary public.event_rolodex_broadcast_recipients%rowtype;
  v_fallback public.event_rolodex_broadcast_recipients%rowtype;
  v_next_status text := lower(coalesce(p_provider_status, ''));
  v_kick boolean := false;
begin
  if public.oneevent_provider_status_rank(v_next_status) = 0 then
    raise exception 'Unsupported provider status: %', p_provider_status using errcode = '22023';
  end if;

  select * into v_primary
  from public.event_rolodex_broadcast_recipients
  where id = p_recipient_id
  for update;

  if not found then
    return query select false, false;
    return;
  end if;

  if public.oneevent_provider_status_rank(v_next_status)
    <= public.oneevent_provider_status_rank(v_primary.provider_status) then
    -- A repeated terminal failure may be Twilio retrying after the Edge
    -- invocation failed to wake the worker. Re-kicking is safe because the
    -- worker's durable dispatch claim remains authoritative.
    if v_primary.channel = 'whatsapp'
      and v_next_status = lower(coalesce(v_primary.provider_status, ''))
      and v_next_status in ('failed', 'undelivered', 'canceled') then
      select * into v_fallback
      from public.event_rolodex_broadcast_recipients
      where broadcast_id = v_primary.broadcast_id
        and rolodex_id = v_primary.rolodex_id
        and channel = 'sms'
      order by id
      limit 1
      for update;
      v_kick := found
        and v_fallback.processing_status = 'pending'
        and v_fallback.provider_sid is null
        and v_fallback.provider_message_id is null
        and coalesce(v_fallback.provider_status, '') = '';
    end if;
    return query select false, v_kick;
    return;
  end if;

  update public.event_rolodex_broadcast_recipients
  set
    provider_status = v_next_status,
    provider_status_at = p_status_at,
    provider_error_code = nullif(p_error_code, ''),
    status = case
      when v_next_status in ('accepted', 'scheduled', 'queued', 'sending') then 'queued'
      when v_next_status in ('sent', 'delivered', 'read') then 'sent'
      else 'failed'
    end,
    queued_at = case
      when v_next_status in ('accepted', 'scheduled', 'queued', 'sending') then coalesce(queued_at, p_status_at)
      else queued_at
    end,
    sent_at = case when v_next_status in ('sent', 'delivered', 'read') then coalesce(sent_at, p_status_at) else sent_at end,
    delivered_at = case when v_next_status in ('delivered', 'read') then coalesce(delivered_at, p_status_at) else delivered_at end,
    opened_at = case when v_next_status = 'read' then coalesce(opened_at, p_status_at) else opened_at end,
    undelivered_at = case
      when v_next_status in ('delivered', 'read') then null
      when v_next_status in ('undelivered', 'failed', 'canceled') then coalesce(undelivered_at, p_status_at)
      else undelivered_at
    end,
    error_message = case
      when v_next_status in ('undelivered', 'failed', 'canceled')
        then coalesce(nullif(p_error_message, ''), 'Twilio ' || v_next_status)
      when v_next_status in ('sent', 'delivered', 'read') then null
      else error_message
    end
  where id = p_recipient_id;

  if v_primary.channel = 'whatsapp'
    and v_next_status in ('delivered', 'read', 'failed', 'undelivered', 'canceled') then
    select * into v_fallback
    from public.event_rolodex_broadcast_recipients
    where broadcast_id = v_primary.broadcast_id
      and rolodex_id = v_primary.rolodex_id
      and channel = 'sms'
    order by id
    limit 1
    for update;

    if found and v_fallback.provider_sid is null and v_fallback.provider_message_id is null then
      if v_next_status in ('delivered', 'read') then
        update public.event_rolodex_broadcast_recipients
        set
          status = 'skipped',
          skipped_reason = 'whatsapp_delivered_primary',
          provider_status = 'not_needed',
          provider_status_at = p_status_at,
          provider_error_code = null,
          error_message = null,
          processing_status = 'done',
          processed_at = p_status_at
        where id = v_fallback.id
          and coalesce(provider_status, '') not in ('accepted', 'sent', 'delivered', 'read');

        update public.event_rolodex_provider_dispatches
        set
          state = 'cancelled',
          lock_until = null,
          last_error_code = 'whatsapp_delivered_primary',
          last_error_redacted = 'SMS fallback cancelled because WhatsApp delivered',
          updated_at = p_status_at
        where recipient_id = v_fallback.id and channel = 'sms' and state <> 'accepted';
      else
        update public.event_rolodex_broadcast_recipients
        set
          status = 'queued',
          skipped_reason = null,
          error_message = null,
          provider_status = null,
          provider_status_at = null,
          provider_error_code = null,
          processing_status = 'pending',
          processed_at = null,
          queued_at = p_status_at
        where id = v_fallback.id
          and provider_status = 'waiting_for_whatsapp'
          and processing_status = 'done';
        v_kick := found;
      end if;
    end if;
  end if;

  perform public.oneevent_refresh_broadcast_delivery_summary(v_primary.broadcast_id, p_status_at);
  return query select true, v_kick;
end
$$;

revoke all on function public.oneevent_refresh_broadcast_delivery_summary(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.oneevent_apply_twilio_recipient_status(uuid, text, timestamptz, text, text)
  from public, anon, authenticated;
revoke all on function public.oneevent_claim_sms_provider_dispatch(uuid, uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.oneevent_apply_twilio_recipient_status(uuid, text, timestamptz, text, text)
  to service_role;
grant execute on function public.oneevent_claim_sms_provider_dispatch(uuid, uuid, text, integer, integer)
  to service_role;
