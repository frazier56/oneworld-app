-- Read-only WhatsApp + SMS routing preflight for Joel's Roundtable.
-- Returns aggregate counts only. It does not queue or send messages.

with target_event as (
  select id, host_id, title
  from public.events
  where lower(title) like '%founders roundtable mastermind%'
  order by created_at desc
  limit 1
),
sample as (
  select
    r.id,
    r.sms_ok,
    r.whatsapp_ok,
    nullif(regexp_replace(coalesce(r.phone, ''), '[^0-9+]', '', 'g'), '') as phone
  from public.host_rolodex r
  join target_event e on e.host_id = r.host_id
  order by coalesce(nullif(lower(r.email), ''), nullif(r.phone, ''), r.id::text), r.id
  limit 250
),
config as (
  select key, lower(coalesce(value, '')) in ('1', 'true', 'yes', 'on') as enabled
  from public.app_secrets
  where key in (
    'EVENT_ROLODEX_EXTERNAL_SENDS_ENABLED',
    'EVENT_ROLODEX_SMS_SENDS_ENABLED',
    'EVENT_ROLODEX_WHATSAPP_SENDS_ENABLED',
    'EVENT_ROLODEX_WHATSAPP_APPROVED'
  )
)
select
  (select title from target_event) as event_title,
  count(*) as selected_contacts,
  count(*) * 2 as planned_recipient_rows_for_whatsapp_and_sms,
  count(*) filter (where phone is null) as contacts_without_phone,
  count(*) filter (where phone is not null and whatsapp_ok is true) as whatsapp_permission_rows,
  count(distinct phone) filter (where phone is not null and whatsapp_ok is true) as unique_whatsapp_destinations,
  count(*) filter (where phone is not null and sms_ok is true) as sms_permission_rows,
  count(distinct phone) filter (where phone is not null and sms_ok is true) as unique_sms_destinations,
  count(*) filter (where phone is not null and whatsapp_ok is true and sms_ok is true) as fallback_capable_rows,
  count(distinct phone) filter (where phone is not null and whatsapp_ok is true and sms_ok is true) as unique_fallback_capable_destinations,
  count(*) filter (where phone is not null and whatsapp_ok is true and sms_ok is not true) as whatsapp_only_rows,
  count(*) filter (where phone is not null and sms_ok is true and whatsapp_ok is not true) as sms_only_rows,
  count(*) filter (where phone is not null and sms_ok is not true and whatsapp_ok is not true) as phone_without_channel_permission_rows,
  ceil((count(*) * 2) / 50.0)::integer as worker_batches_at_50,
  coalesce((select enabled from config where key = 'EVENT_ROLODEX_EXTERNAL_SENDS_ENABLED'), false) as external_sends_enabled,
  coalesce((select enabled from config where key = 'EVENT_ROLODEX_SMS_SENDS_ENABLED'), false) as sms_sends_enabled,
  coalesce((select enabled from config where key = 'EVENT_ROLODEX_WHATSAPP_SENDS_ENABLED'), false) as whatsapp_sends_enabled,
  coalesce((select enabled from config where key = 'EVENT_ROLODEX_WHATSAPP_APPROVED'), false) as whatsapp_approved,
  (
    count(distinct phone) filter (where phone is not null and whatsapp_ok is true and sms_ok is true) > 0
  ) as internal_dual_consent_canary_available
from sample;
