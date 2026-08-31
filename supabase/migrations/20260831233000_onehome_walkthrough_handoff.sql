-- OneHome owner -> tenant walkthrough handoff.
-- Sending freezes the owner's evidence bundle; the tenant's single approval is atomic.

create or replace function public.rental_inspection_send(p_inspection_id uuid)
returns table(
  inspection_id uuid,
  contract_id uuid,
  share_token text,
  property_title text,
  inspection_state text,
  photo_count integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_inspection public.rental_inspections%rowtype;
  v_contract public.rental_contracts%rowtype;
  v_title text;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Sign in before sending the walkthrough.' using errcode = '42501';
  end if;

  select * into v_inspection
    from public.rental_inspections
   where id = p_inspection_id
   for update;
  if not found then
    raise exception 'That walkthrough was not found.' using errcode = '22023';
  end if;

  select * into v_contract
    from public.rental_contracts
   where id = v_inspection.contract_id;
  if v_contract.agent_id <> v_user then
    raise exception 'Only the owner can send this walkthrough.' using errcode = '42501';
  end if;
  if v_inspection.kind <> 'move_in' then
    raise exception 'Only the move-in walkthrough can be sent here.' using errcode = '22023';
  end if;

  select count(*)::integer into v_count
    from public.rental_inspection_items
   where rental_inspection_items.inspection_id = p_inspection_id;
  if v_count = 0 then
    raise exception 'Add the walkthrough photos before sending them.' using errcode = '22023';
  end if;

  if v_inspection.state = 'draft'::public.inspection_state then
    update public.rental_inspections
       set state = 'awaiting_tenant'::public.inspection_state,
           sent_at = coalesce(sent_at, now()),
           host_done_at = coalesce(host_done_at, now())
     where id = p_inspection_id;
    v_inspection.state := 'awaiting_tenant'::public.inspection_state;
  elsif v_inspection.state not in (
    'awaiting_tenant'::public.inspection_state,
    'tenant_responded'::public.inspection_state,
    'agreed'::public.inspection_state
  ) then
    raise exception 'This walkthrough cannot be sent in its current state.' using errcode = '22023';
  end if;

  select p.title into v_title
    from public.rental_properties p
   where p.id = v_contract.property_id;

  inspection_id := v_inspection.id;
  contract_id := v_contract.id;
  share_token := v_contract.share_token;
  property_title := coalesce(v_title, 'your OneHome');
  inspection_state := v_inspection.state::text;
  photo_count := v_count;
  return next;
end;
$function$;

create or replace function public.rental_inspection_approve_all(p_token text)
returns table(
  inspection_id uuid,
  inspection_state text,
  photo_count integer,
  approved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_contract public.rental_contracts%rowtype;
  v_inspection public.rental_inspections%rowtype;
  v_count integer;
  v_now timestamptz := now();
begin
  if coalesce(p_token, '') !~ '^[0-9a-fA-F]{48}$' then
    raise exception 'That link is not valid.' using errcode = '22023';
  end if;

  select * into v_contract
    from public.rental_contracts
   where share_token = lower(p_token);
  if not found then
    raise exception 'That link is not valid.' using errcode = '22023';
  end if;
  if not public.rental_inspection_is_open(v_contract) then
    raise exception 'The move-in photos are not open yet.' using errcode = '42501';
  end if;

  select * into v_inspection
    from public.rental_inspections
   where contract_id = v_contract.id and kind = 'move_in'
   order by round desc
   limit 1
   for update;
  if not found or v_inspection.state = 'draft'::public.inspection_state then
    raise exception 'The owner has not sent these photos yet.' using errcode = '42501';
  end if;

  select count(*)::integer into v_count
    from public.rental_inspection_items
   where rental_inspection_items.inspection_id = v_inspection.id;
  if v_count = 0 then
    raise exception 'There are no walkthrough photos to approve.' using errcode = '22023';
  end if;

  if v_inspection.state <> 'agreed'::public.inspection_state then
    update public.rental_inspection_items
       set verdict = 'agreed'::public.inspection_item_verdict,
           tenant_note = null,
           responded_at = coalesce(responded_at, v_now)
     where rental_inspection_items.inspection_id = v_inspection.id
       and verdict = 'pending'::public.inspection_item_verdict;

    update public.rental_inspections
       set state = 'agreed'::public.inspection_state,
           tenant_done_at = coalesce(tenant_done_at, v_now),
           host_done_at = coalesce(host_done_at, sent_at, v_now),
           settled_at = coalesce(settled_at, v_now)
     where id = v_inspection.id;

    perform public.notify_rental(
      v_contract.agent_id,
      'rental_inspection_agreed',
      'The move-in walkthrough was approved',
      'The tenant approved every photo in the walkthrough. The lease is still unsigned and rent has not been confirmed.',
      '/rentals/c/' || v_contract.id::text
    );
  end if;

  inspection_id := v_inspection.id;
  inspection_state := 'agreed';
  photo_count := v_count;
  approved_at := coalesce(v_inspection.settled_at, v_now);
  return next;
end;
$function$;

revoke all on function public.rental_inspection_send(uuid) from public, anon;
grant execute on function public.rental_inspection_send(uuid) to authenticated, service_role;

revoke all on function public.rental_inspection_approve_all(text) from public;
grant execute on function public.rental_inspection_approve_all(text) to anon, authenticated, service_role;

