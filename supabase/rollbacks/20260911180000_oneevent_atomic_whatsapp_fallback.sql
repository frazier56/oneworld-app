-- Run only after restoring the previous deployed versions of both:
--   twilio-message-status
--   process-event-rolodex-broadcast
-- The previous Edge bundles do not call these functions.

drop function if exists public.oneevent_apply_twilio_recipient_status(
  uuid, text, timestamptz, text, text
);
drop function if exists public.oneevent_claim_sms_provider_dispatch(
  uuid, uuid, text, integer, integer
);
drop function if exists public.oneevent_authorize_sms_provider_attempt(
  uuid, uuid, text
);
drop function if exists public.oneevent_refresh_broadcast_delivery_summary(
  uuid, timestamptz
);

update public.event_rolodex_provider_dispatches
set
  state = 'ambiguous',
  lock_until = null,
  last_error_code = 'rollback_provider_outcome_unknown',
  last_error_redacted = 'Release rolled back after provider-attempt boundary',
  updated_at = now()
where state = 'in_flight';

alter table public.event_rolodex_provider_dispatches
  drop constraint if exists event_rolodex_provider_dispatches_state_check;
alter table public.event_rolodex_provider_dispatches
  add constraint event_rolodex_provider_dispatches_state_check
  check (state = any (array[
    'new'::text,
    'processing'::text,
    'accepted'::text,
    'failed_retryable'::text,
    'failed_permanent'::text,
    'ambiguous'::text,
    'cancelled'::text
  ]));

create or replace function public.claim_event_rolodex_provider_dispatch(
  p_recipient_id uuid,
  p_broadcast_id uuid,
  p_channel text,
  p_idempotency_key text,
  p_lock_seconds integer default 180,
  p_max_attempts integer default 3
)
returns table(should_send boolean, state text, attempt_count integer, provider_sid text)
language plpgsql
set search_path = ''
as $$
declare current_row public.event_rolodex_provider_dispatches%rowtype;
begin
  insert into public.event_rolodex_provider_dispatches(recipient_id,broadcast_id,channel,idempotency_key)
  values(p_recipient_id,p_broadcast_id,p_channel,p_idempotency_key)
  on conflict(idempotency_key) do nothing;

  select * into current_row from public.event_rolodex_provider_dispatches
  where idempotency_key=p_idempotency_key for update;

  if current_row.state in ('accepted','ambiguous','cancelled')
     or (current_row.state='processing' and current_row.lock_until>now())
     or current_row.attempt_count>=least(greatest(p_max_attempts,1),3) then
    return query select false,current_row.state,current_row.attempt_count,current_row.provider_sid;
    return;
  end if;

  update public.event_rolodex_provider_dispatches set
    state='processing', attempt_count=public.event_rolodex_provider_dispatches.attempt_count+1,
    lock_until=now()+make_interval(secs=>least(greatest(p_lock_seconds,30),900)), updated_at=now()
  where id=current_row.id returning * into current_row;
  return query select true,current_row.state,current_row.attempt_count,current_row.provider_sid;
end
$$;
