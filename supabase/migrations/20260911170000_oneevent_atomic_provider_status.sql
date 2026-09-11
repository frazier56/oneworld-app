create or replace function public.oneevent_provider_status_rank(p_status text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(coalesce(p_status, ''))
    when 'accepted' then 10
    when 'scheduled' then 15
    when 'queued' then 20
    when 'sending' then 30
    when 'sent' then 40
    when 'undelivered' then 50
    when 'failed' then 50
    when 'canceled' then 50
    when 'delivered' then 60
    when 'read' then 70
    else 0
  end
$$;

create or replace function public.oneevent_apply_twilio_provider_status(
  p_target text,
  p_id uuid,
  p_provider_status text,
  p_status_at timestamptz,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_status text;
  v_next_status text := lower(coalesce(p_provider_status, ''));
begin
  if public.oneevent_provider_status_rank(v_next_status) = 0 then
    raise exception 'Unsupported provider status: %', p_provider_status
      using errcode = '22023';
  end if;

  if p_target = 'outbound' then
    select provider_status
    into v_current_status
    from public.outbound_messages
    where id = p_id
    for update;

    if not found or public.oneevent_provider_status_rank(v_next_status)
      <= public.oneevent_provider_status_rank(v_current_status) then
      return false;
    end if;

    update public.outbound_messages
    set
      provider_status = v_next_status,
      provider_status_at = p_status_at,
      provider_error_code = nullif(p_error_code, ''),
      status = case
        when v_next_status in ('undelivered', 'failed', 'canceled') then 'failed'
        when v_next_status in ('sent', 'delivered', 'read') then 'sent'
        else status
      end,
      sent_at = case
        when v_next_status in ('sent', 'delivered', 'read') then coalesce(sent_at, p_status_at)
        else sent_at
      end,
      delivered_at = case
        when v_next_status in ('delivered', 'read') then coalesce(delivered_at, p_status_at)
        else delivered_at
      end,
      failed_at = case
        when v_next_status in ('delivered', 'read') then null
        when v_next_status in ('undelivered', 'failed', 'canceled') then coalesce(failed_at, p_status_at)
        else failed_at
      end,
      last_error = case
        when v_next_status in ('undelivered', 'failed', 'canceled')
          then coalesce(nullif(p_error_message, ''), 'Twilio ' || v_next_status)
        when v_next_status in ('sent', 'delivered', 'read') then null
        else last_error
      end
    where id = p_id;
    return true;
  end if;

  if p_target = 'reminder' then
    select provider_status
    into v_current_status
    from public.event_reminder_deliveries
    where id = p_id
    for update;

    if not found or public.oneevent_provider_status_rank(v_next_status)
      <= public.oneevent_provider_status_rank(v_current_status) then
      return false;
    end if;

    update public.event_reminder_deliveries
    set
      provider_status = v_next_status,
      provider_status_at = p_status_at,
      provider_error_code = nullif(p_error_code, ''),
      updated_at = p_status_at,
      status = case
        when v_next_status in ('accepted', 'scheduled', 'queued', 'sending') then 'queued'
        when v_next_status in ('sent', 'delivered', 'read') then 'sent'
        else 'failed'
      end,
      sent_at = case
        when v_next_status in ('sent', 'delivered', 'read') then coalesce(sent_at, p_status_at)
        else sent_at
      end,
      delivered_at = case
        when v_next_status in ('delivered', 'read') then coalesce(delivered_at, p_status_at)
        else delivered_at
      end,
      read_at = case
        when v_next_status = 'read' then coalesce(read_at, p_status_at)
        else read_at
      end,
      failure_reason = case
        when v_next_status in ('undelivered', 'failed', 'canceled')
          then coalesce(nullif(p_error_message, ''), 'Twilio ' || v_next_status)
        when v_next_status in ('sent', 'delivered', 'read') then null
        else failure_reason
      end
    where id = p_id;
    return true;
  end if;

  if p_target = 'recipient' then
    select provider_status
    into v_current_status
    from public.event_rolodex_broadcast_recipients
    where id = p_id
    for update;

    if not found or public.oneevent_provider_status_rank(v_next_status)
      <= public.oneevent_provider_status_rank(v_current_status) then
      return false;
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
      sent_at = case
        when v_next_status in ('sent', 'delivered', 'read') then coalesce(sent_at, p_status_at)
        else sent_at
      end,
      delivered_at = case
        when v_next_status in ('delivered', 'read') then coalesce(delivered_at, p_status_at)
        else delivered_at
      end,
      opened_at = case
        when v_next_status = 'read' then coalesce(opened_at, p_status_at)
        else opened_at
      end,
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
    where id = p_id;
    return true;
  end if;

  raise exception 'Unsupported provider status target: %', p_target
    using errcode = '22023';
end
$$;

revoke all on function public.oneevent_provider_status_rank(text) from public, anon, authenticated;
revoke all on function public.oneevent_apply_twilio_provider_status(text, uuid, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.oneevent_apply_twilio_provider_status(text, uuid, text, timestamptz, text, text)
  to service_role;
