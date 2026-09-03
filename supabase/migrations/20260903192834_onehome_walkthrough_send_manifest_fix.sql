create or replace function public.rental_inspection_send_v2(p_inspection_id uuid)
returns table(
  inspection_id uuid, contract_id uuid, share_token text, property_title text,
  inspection_state text, media_count integer, release_reason text, released_at timestamptz
)
language plpgsql
security definer
set search_path = public, storage, extensions, pg_temp
as $function$
declare
  v_user uuid:=auth.uid(); v_inspection public.rental_inspections%rowtype; v_contract public.rental_contracts%rowtype;
  v_title text; v_count integer; v_manifest jsonb; v_hash text; v_reason text; v_now timestamptz:=clock_timestamp();
begin
  if v_user is null then raise exception 'Sign in before releasing the walkthrough.' using errcode='42501'; end if;
  select * into v_inspection from public.rental_inspections where id=p_inspection_id for update;
  if not found then raise exception 'That walkthrough was not found.' using errcode='22023'; end if;
  select * into v_contract from public.rental_contracts where id=v_inspection.contract_id;
  if v_contract.agent_id <> v_user then raise exception 'Only the owner or listing agent can release this walkthrough.' using errcode='42501'; end if;
  if v_inspection.kind <> 'move_in' then raise exception 'Only the move-in walkthrough can be released here.' using errcode='22023'; end if;
  select count(*)::integer,
         jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id',id,'ordinal',ordinal,'path',photo_url,'room',room,'caption',host_note,
           'media_kind',media_kind,'mime_type',mime_type,'byte_size',byte_size,
           'duration_ms',duration_ms,'captured_at',captured_at,'uploaded_at',uploaded_at,
           'source_version',source_version
         )) order by ordinal,id)
    into v_count,v_manifest from public.rental_inspection_items where rental_inspection_items.inspection_id=p_inspection_id;
  if v_count=0 then raise exception 'Add walkthrough photos or videos before releasing them.' using errcode='22023'; end if;
  if exists(select 1 from public.rental_inspection_items where rental_inspection_items.inspection_id=p_inspection_id and upload_state<>'ready') then
    raise exception 'Resolve every failed or incomplete upload before releasing.' using errcode='22023';
  end if;
  v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  v_reason:=case when v_contract.first_payment_claimed_at is not null or v_contract.status in ('active','ended') then 'payment' else 'agent_early' end;
  if v_inspection.state='draft'::public.inspection_state then
    update public.rental_inspections as target set state='awaiting_tenant'::public.inspection_state,
      sent_at=coalesce(target.sent_at,v_now),host_done_at=coalesce(target.host_done_at,v_now),
      evidence_version=greatest(target.round,1),evidence_manifest=v_manifest,evidence_manifest_sha256=v_hash,
      evidence_frozen_at=coalesce(target.evidence_frozen_at,v_now),released_at=coalesce(target.released_at,v_now),
      release_reason=coalesce(target.release_reason,v_reason),released_by=coalesce(target.released_by,v_user)
      where target.id=p_inspection_id;
    insert into public.rental_inspection_audit_events(inspection_id,contract_id,event_type,actor_user_id,actor_role,event_payload,created_at)
    values(v_inspection.id,v_contract.id,'packet_frozen',v_user,'owner',jsonb_build_object('evidence_version',greatest(v_inspection.round,1),'manifest_sha256',v_hash,'media_count',v_count),v_now),
          (v_inspection.id,v_contract.id,'visibility_released',v_user,case when v_reason='payment' then 'system' else 'listing_agent' end,jsonb_build_object('reason',v_reason),v_now);
    v_inspection.state:='awaiting_tenant'::public.inspection_state;
    v_inspection.release_reason:=v_reason;
    v_inspection.released_at:=v_now;
  elsif v_inspection.state not in ('awaiting_tenant'::public.inspection_state,'tenant_responded'::public.inspection_state,'host_reviewing'::public.inspection_state,'agreed'::public.inspection_state) then
    raise exception 'This walkthrough cannot be released in its current state.' using errcode='22023';
  end if;
  select p.title into v_title from public.rental_properties p where p.id=v_contract.property_id;
  inspection_id:=v_inspection.id; contract_id:=v_contract.id; share_token:=v_contract.share_token;
  property_title:=coalesce(v_title,'your OneHome'); inspection_state:=v_inspection.state::text;
  media_count:=v_count; release_reason:=coalesce(v_inspection.release_reason,v_reason); released_at:=coalesce(v_inspection.released_at,v_now); return next;
end
$function$;

revoke all on function public.rental_inspection_send_v2(uuid) from public, anon;
grant execute on function public.rental_inspection_send_v2(uuid) to authenticated, service_role;
