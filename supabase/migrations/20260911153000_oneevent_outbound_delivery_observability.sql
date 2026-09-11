-- Preserve the generic queue status contract while recording carrier-final truth.
alter table public.outbound_messages
  add column if not exists provider_status text,
  add column if not exists provider_status_at timestamptz,
  add column if not exists provider_error_code text,
  add column if not exists delivered_at timestamptz,
  add column if not exists failed_at timestamptz;

alter table public.event_message_provider_callbacks
  add column if not exists outbound_message_id uuid
    references public.outbound_messages(id) on delete set null;

create index if not exists event_message_provider_callbacks_outbound_idx
  on public.event_message_provider_callbacks (outbound_message_id, received_at desc);

create unique index if not exists event_message_provider_callbacks_delivery_dedupe_idx
  on public.event_message_provider_callbacks
    (provider, provider_message_id, provider_status, error_code) nulls not distinct;

comment on column public.outbound_messages.provider_status is
  'Most authoritative monotonic provider status received by signed callback.';
comment on column public.outbound_messages.provider_status_at is
  'Time the current provider_status was accepted by the callback handler.';
comment on column public.outbound_messages.delivered_at is
  'Carrier-confirmed delivery time; API acceptance alone does not set this.';
comment on column public.outbound_messages.failed_at is
  'Carrier-final failure time.';

create or replace view public.oneevent_outbound_delivery_status
with (security_invoker = true)
as
select
  outbound.id,
  outbound.channel,
  outbound.to_address,
  outbound.to_name,
  outbound.template,
  outbound.context,
  outbound.status as queue_status,
  outbound.provider_id,
  outbound.created_at,
  outbound.sent_at,
  coalesce(outbound.provider_status, callback.provider_status) as provider_status,
  coalesce(outbound.provider_status_at, callback.received_at) as provider_status_at,
  coalesce(outbound.provider_error_code, callback.error_code) as provider_error_code,
  coalesce(outbound.delivered_at,
    case when callback.provider_status in ('delivered', 'read') then callback.received_at end
  ) as delivered_at,
  coalesce(outbound.failed_at,
    case when callback.provider_status in ('undelivered', 'failed', 'canceled') then callback.received_at end
  ) as failed_at,
  case
    when coalesce(outbound.provider_status, callback.provider_status) in ('delivered', 'read') then 'delivered'
    when coalesce(outbound.provider_status, callback.provider_status) in ('undelivered', 'failed', 'canceled') then 'failed'
    when outbound.provider_id is not null or outbound.status = 'sent' then 'accepted'
    else outbound.status
  end as delivery_state
from public.outbound_messages outbound
left join lateral (
  select
    provider_status,
    received_at,
    error_code
  from public.event_message_provider_callbacks provider_callback
  where provider_callback.provider_message_id = outbound.provider_id
  order by
    case provider_callback.provider_status
      when 'read' then 70
      when 'delivered' then 60
      when 'undelivered' then 50
      when 'failed' then 50
      when 'canceled' then 50
      when 'sent' then 40
      when 'sending' then 30
      when 'queued' then 20
      when 'scheduled' then 15
      when 'accepted' then 10
      else 0
    end desc,
    provider_callback.received_at desc
  limit 1
) callback on true;

comment on view public.oneevent_outbound_delivery_status is
  'Service-role operational read model separating queue/API acceptance from carrier-final delivery.';

revoke all on public.oneevent_outbound_delivery_status from anon, authenticated;
