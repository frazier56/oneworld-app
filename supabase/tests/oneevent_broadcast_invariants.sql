-- OneEvent Rolodex broadcast invariants.
-- Read-only: this query returns violation counts and never exposes recipient PII.

with recipient_scope as (
  select
    r.*,
    b.channels as broadcast_channels,
    h.email_ok,
    h.sms_ok,
    h.whatsapp_ok
  from public.event_rolodex_broadcast_recipients r
  join public.event_rolodex_broadcasts b on b.id = r.broadcast_id
  left join public.host_rolodex h on h.id = r.rolodex_id
),
duplicate_live_destinations as (
  select broadcast_id, channel, destination
  from recipient_scope
  where destination is not null
    and processing_status <> 'done'
  group by broadcast_id, channel, destination
  having count(*) > 1
),
dual_channel_missing_pairs as (
  select r.broadcast_id, r.rolodex_id
  from recipient_scope r
  where r.broadcast_channels @> array['whatsapp', 'sms']::text[]
  group by r.broadcast_id, r.rolodex_id
  having count(*) filter (where channel = 'whatsapp') <> 1
      or count(*) filter (where channel = 'sms') <> 1
),
link_scope as (
  select
    l.*,
    r.broadcast_id as recipient_broadcast_id,
    r.event_id as recipient_event_id,
    r.channel as recipient_channel
  from public.event_message_links l
  left join public.event_rolodex_broadcast_recipients r on r.id = l.recipient_id
)
select 'external_channel_without_permission' as invariant,
       count(*)::bigint as violations
from recipient_scope
where (channel = 'email' and email_ok is not true)
   or (channel = 'sms' and sms_ok is not true)
   or (channel = 'whatsapp' and whatsapp_ok is not true)

union all
select 'dual_channel_missing_primary_or_fallback', count(*)::bigint
from dual_channel_missing_pairs

union all
select 'waiting_sms_without_whatsapp_primary', count(*)::bigint
from recipient_scope sms
where sms.channel = 'sms'
  and sms.provider_status = 'waiting_for_whatsapp'
  and not exists (
    select 1
    from recipient_scope wa
    where wa.broadcast_id = sms.broadcast_id
      and wa.rolodex_id = sms.rolodex_id
      and wa.channel = 'whatsapp'
  )

union all
select 'duplicate_active_destination', count(*)::bigint
from duplicate_live_destinations

union all
select 'post_hardening_done_without_processed_at', count(*)::bigint
from recipient_scope
where created_at >= timestamptz '2026-08-26 00:00:00+00'
  and processing_status = 'done'
  and processed_at is null

union all
select 'provider_terminal_without_provider_timestamp', count(*)::bigint
from recipient_scope
where lower(coalesce(provider_status, '')) in ('delivered', 'read', 'failed', 'undelivered')
  and provider_status_at is null

union all
select 'delivered_without_delivered_timestamp', count(*)::bigint
from recipient_scope
where status = 'delivered'
  and delivered_at is null

union all
select 'opened_without_opened_timestamp', count(*)::bigint
from recipient_scope
where status = 'opened'
  and opened_at is null

union all
select 'orphan_or_mismatched_tracked_link', count(*)::bigint
from link_scope
where recipient_broadcast_id is null
   or broadcast_id <> recipient_broadcast_id
   or event_id <> recipient_event_id
   or channel <> recipient_channel

union all
select 'clicked_link_without_click_timestamps', count(*)::bigint
from link_scope
where click_count > 0
  and (first_clicked_at is null or last_clicked_at is null)

order by invariant;
