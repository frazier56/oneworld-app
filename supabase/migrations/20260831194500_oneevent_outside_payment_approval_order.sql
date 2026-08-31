-- The paid-event guard validates application approval before a registration insert.
-- Wrap the original atomic implementation so the application state changes first;
-- any later failure rolls the whole transaction back.
alter function public.issue_outside_paid_event_ticket_internal(uuid, uuid, text, text, text)
  rename to issue_outside_paid_event_ticket_after_approval_internal;

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
  v_result jsonb;
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

  v_result := public.issue_outside_paid_event_ticket_after_approval_internal(
    p_actor_id,
    p_application_id,
    p_claim_token,
    p_method,
    p_note
  );

  return v_result;
end;
$function$;

revoke all on function public.issue_outside_paid_event_ticket_internal(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.issue_outside_paid_event_ticket_internal(uuid, uuid, text, text, text)
  to service_role;

revoke all on function public.issue_outside_paid_event_ticket_after_approval_internal(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.issue_outside_paid_event_ticket_after_approval_internal(uuid, uuid, text, text, text)
  to service_role;

