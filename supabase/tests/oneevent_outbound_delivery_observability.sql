begin;

insert into public.outbound_messages (
  id,
  channel,
  to_address,
  body_text,
  context,
  status,
  attempts,
  provider_id
) values (
  '00000000-0000-4000-8000-000000000951',
  'sms',
  '+15555550195',
  'transaction-only observability fixture',
  '{"test":"rollback_only"}'::jsonb,
  'sent',
  1,
  'SM00000000000000000000000000000951'
);

insert into public.event_message_provider_callbacks (
  outbound_message_id,
  provider_message_id,
  provider_status,
  channel,
  payload,
  received_at
) values
  (
    '00000000-0000-4000-8000-000000000951',
    'SM00000000000000000000000000000951',
    'sent',
    'sms',
    '{"test":true}'::jsonb,
    '2026-09-11T15:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000951',
    'SM00000000000000000000000000000951',
    'delivered',
    'sms',
    '{"test":true}'::jsonb,
    '2026-09-11T15:00:01Z'
  ),
  (
    '00000000-0000-4000-8000-000000000951',
    'SM00000000000000000000000000000951',
    'queued',
    'sms',
    '{"test":true}'::jsonb,
    '2026-09-11T15:00:02Z'
  );

insert into public.event_message_provider_callbacks (
  outbound_message_id,
  provider_message_id,
  provider_status,
  channel,
  payload,
  received_at
) values (
  '00000000-0000-4000-8000-000000000951',
  'SM00000000000000000000000000000951',
  'delivered',
  'sms',
  '{"duplicate":true}'::jsonb,
  '2026-09-11T15:00:03Z'
)
on conflict (provider, provider_message_id, provider_status, error_code) do nothing;

do $$
declare
  callback_count integer;
  observed_state text;
  sent_applied boolean;
  delivered_applied boolean;
  late_sent_applied boolean;
  late_failed_applied boolean;
begin
  select count(*)
  into callback_count
  from public.event_message_provider_callbacks
  where provider_message_id = 'SM00000000000000000000000000000951';

  if callback_count <> 3 then
    raise exception 'duplicate callback was not suppressed: % rows', callback_count;
  end if;

  sent_applied := public.oneevent_apply_twilio_provider_status(
    'outbound',
    '00000000-0000-4000-8000-000000000951',
    'sent',
    '2026-09-11T15:00:00Z',
    null,
    null
  );
  delivered_applied := public.oneevent_apply_twilio_provider_status(
    'outbound',
    '00000000-0000-4000-8000-000000000951',
    'delivered',
    '2026-09-11T15:00:01Z',
    null,
    null
  );
  late_sent_applied := public.oneevent_apply_twilio_provider_status(
    'outbound',
    '00000000-0000-4000-8000-000000000951',
    'sent',
    '2026-09-11T15:00:02Z',
    null,
    null
  );
  late_failed_applied := public.oneevent_apply_twilio_provider_status(
    'outbound',
    '00000000-0000-4000-8000-000000000951',
    'failed',
    '2026-09-11T15:00:03Z',
    '30007',
    'filtered'
  );

  if not sent_applied or not delivered_applied then
    raise exception 'expected forward provider transitions to apply';
  end if;
  if late_sent_applied or late_failed_applied then
    raise exception 'late lower-ranked provider transition applied';
  end if;

  select delivery_state
  into observed_state
  from public.oneevent_outbound_delivery_status
  where id = '00000000-0000-4000-8000-000000000951';

  if observed_state <> 'delivered' then
    raise exception 'late queued callback downgraded carrier-final state: %', observed_state;
  end if;
end
$$;

rollback;
