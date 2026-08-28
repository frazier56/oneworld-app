-- Read-only OneEvent broadcast readiness check.
-- This intentionally returns aggregate counts only; no recipient PII is exposed.
with target_event as (
  select id, host_id, title
  from public.events
  where lower(title) like '%founders roundtable mastermind%'
  order by created_at desc
  limit 1
), sample as (
  select r.*
  from public.host_rolodex r
  join target_event e on e.host_id = r.host_id
  order by coalesce(nullif(lower(r.email), ''), nullif(r.phone, ''), r.id::text), r.id
  limit 250
), config as (
  select key, lower(coalesce(value, '')) in ('1', 'true', 'yes', 'on') as enabled
  from public.app_secrets
  where key in (
    'EVENT_ROLODEX_EXTERNAL_SENDS_ENABLED',
    'EVENT_ROLODEX_SMS_SENDS_ENABLED',
    'EVENT_ROLODEX_WHATSAPP_SENDS_ENABLED',
    'EVENT_ROLODEX_WHATSAPP_APPROVED'
  )
), queue_health as (
  select
    count(*) filter (where b.status = 'processing') as processing_broadcasts,
    count(*) filter (
      where b.status = 'processing'
        and coalesce(b.processing_last_batch_at, b.processing_started_at, b.created_at)
          < now() - interval '5 minutes'
    ) as stale_processing_broadcasts
  from public.event_rolodex_broadcasts b
), pending_health as (
  select count(*) filter (where processing_status = 'pending') as pending_recipients
  from public.event_rolodex_broadcast_recipients
), cron_health as (
  select
    max(d.start_time) filter (where j.jobname = 'oneevent-broadcast-recovery-1min') as recovery_last_run,
    max(d.start_time) filter (where j.jobname = 'oneevent-broadcast-watchdog-5min') as watchdog_last_run,
    count(*) filter (
      where j.jobname = 'oneevent-broadcast-recovery-1min'
        and d.start_time > now() - interval '10 minutes'
        and d.status <> 'succeeded'
    ) as recovery_failures_last_10m
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
)
select
  (select title from target_event) as event_title,
  count(*) as sampled_contacts,
  count(*) filter (where nullif(trim(email), '') is not null) as contacts_with_email,
  count(distinct lower(trim(email))) filter (where nullif(trim(email), '') is not null) as unique_emails,
  count(*) filter (where nullif(trim(phone), '') is not null) as contacts_with_phone,
  count(distinct regexp_replace(phone, '[^0-9+]', '', 'g'))
    filter (where nullif(trim(phone), '') is not null) as unique_phones,
  count(*) filter (where email_ok and nullif(trim(email), '') is not null) as email_permission_rows,
  count(*) filter (where sms_ok and nullif(trim(phone), '') is not null) as sms_permission_rows,
  count(*) filter (where whatsapp_ok and nullif(trim(phone), '') is not null) as whatsapp_permission_rows,
  count(*) filter (
    where sms_ok and whatsapp_ok and nullif(trim(phone), '') is not null
  ) as dual_channel_permission_rows,
  ceil(count(*) / 50.0)::integer as worker_batches_at_50,
  (select enabled from config where key = 'EVENT_ROLODEX_EXTERNAL_SENDS_ENABLED') as all_external_sends_enabled,
  (select enabled from config where key = 'EVENT_ROLODEX_SMS_SENDS_ENABLED') as sms_sends_enabled,
  (select enabled from config where key = 'EVENT_ROLODEX_WHATSAPP_SENDS_ENABLED') as whatsapp_sends_enabled,
  (select enabled from config where key = 'EVENT_ROLODEX_WHATSAPP_APPROVED') as whatsapp_approved,
  q.processing_broadcasts,
  q.stale_processing_broadcasts,
  p.pending_recipients,
  c.recovery_last_run,
  c.watchdog_last_run,
  c.recovery_failures_last_10m
from sample
cross join queue_health q
cross join pending_health p
cross join cron_health c
group by
  q.processing_broadcasts,
  q.stale_processing_broadcasts,
  p.pending_recipients,
  c.recovery_last_run,
  c.watchdog_last_run,
  c.recovery_failures_last_10m;
