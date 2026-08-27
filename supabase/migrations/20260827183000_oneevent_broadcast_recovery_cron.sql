-- Recover accepted OneEvent broadcasts whose best-effort background worker did
-- not start or whose batch-to-batch self-call was interrupted. The authenticated
-- recovery cron is installed by the following migration after its dedicated
-- secret is created.

create or replace function public.fail_stale_event_rolodex_broadcasts(
  p_stale_after interval default interval '30 minutes'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_broadcast_ids uuid[];
  v_recipient_count integer := 0;
  v_broadcast_count integer := 0;
begin
  select coalesce(array_agg(id), '{}'::uuid[])
    into v_broadcast_ids
  from (
    select b.id
    from public.event_rolodex_broadcasts b
    where b.status = 'processing'
      and b.created_at < now() - p_stale_after
      and (b.processing_lock_until is null or b.processing_lock_until < now())
      and coalesce(b.processing_last_batch_at, b.processing_started_at, b.created_at) < now() - p_stale_after
      and exists (
        select 1
        from public.event_rolodex_broadcast_recipients r
        where r.broadcast_id = b.id
          and r.processing_status = 'pending'
      )
    for update skip locked
  ) candidates;

  if coalesce(array_length(v_broadcast_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'broadcasts_closed', 0,
      'recipients_failed', 0,
      'checked_at', now()
    );
  end if;

  update public.event_rolodex_broadcast_recipients r
  set status = 'failed',
      processing_status = 'done',
      processed_at = now(),
      provider_status = 'failed',
      provider_status_at = now(),
      provider_error_code = 'STALE_BROADCAST_WATCHDOG',
      error_message = 'Broadcast processing remained unavailable after automatic recovery attempts. No external send was recorded for this recipient.',
      metadata = coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object(
        'watchdog_closed_at', now(),
        'watchdog_policy', 'retry_then_fail_closed'
      )
  where r.broadcast_id = any(v_broadcast_ids)
    and r.processing_status = 'pending';

  get diagnostics v_recipient_count = row_count;

  update public.event_rolodex_broadcasts b
  set status = 'completed_with_errors',
      completed_at = now(),
      processing_lock_until = null,
      processing_error = 'Automatic recovery attempts were exhausted; unsent recipients were failed closed.',
      sent_count = s.sent_count,
      queued_count = s.queued_count,
      skipped_count = s.skipped_count,
      failed_count = s.failed_count,
      processed_count = s.sent_count + s.queued_count + s.skipped_count + s.failed_count,
      metadata = coalesce(b.metadata, '{}'::jsonb) || jsonb_build_object(
        'watchdog_closed_at', now(),
        'watchdog_policy', 'retry_then_fail_closed'
      )
  from (
    select r.broadcast_id,
           count(*) filter (where r.status = 'sent')::integer as sent_count,
           count(*) filter (where r.status = 'queued')::integer as queued_count,
           count(*) filter (where r.status = 'skipped')::integer as skipped_count,
           count(*) filter (where r.status = 'failed')::integer as failed_count
    from public.event_rolodex_broadcast_recipients r
    where r.broadcast_id = any(v_broadcast_ids)
    group by r.broadcast_id
  ) s
  where b.id = s.broadcast_id;

  get diagnostics v_broadcast_count = row_count;

  return jsonb_build_object(
    'broadcasts_closed', v_broadcast_count,
    'recipients_failed', v_recipient_count,
    'broadcast_ids', to_jsonb(v_broadcast_ids),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.fail_stale_event_rolodex_broadcasts(interval)
  from public, anon, authenticated;
grant execute on function public.fail_stale_event_rolodex_broadcasts(interval)
  to service_role;
