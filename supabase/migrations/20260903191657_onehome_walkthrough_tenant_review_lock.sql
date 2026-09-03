-- Tighten walkthrough access at the table, object, and RPC layers. Tenant
-- capability access continues through the rental-inspection Edge Function,
-- which issues short-lived URLs only after release.

drop policy if exists rental_inspections_party on public.rental_inspections;
create policy rental_inspections_released_party_read
on public.rental_inspections
for select
to authenticated
using (
  exists (
    select 1
      from public.rental_contracts c
     where c.id = rental_inspections.contract_id
       and (
         c.agent_id = (select auth.uid())
         or (c.tenant_id = (select auth.uid()) and rental_inspections.released_at is not null)
       )
  )
);

drop policy if exists rental_inspection_items_party on public.rental_inspection_items;
create policy rental_inspection_items_released_party_read
on public.rental_inspection_items
for select
to authenticated
using (
  exists (
    select 1
      from public.rental_inspections i
      join public.rental_contracts c on c.id = i.contract_id
     where i.id = rental_inspection_items.inspection_id
       and (
         c.agent_id = (select auth.uid())
         or (c.tenant_id = (select auth.uid()) and i.released_at is not null)
       )
  )
);

drop policy if exists rental_evidence_read on storage.objects;
create policy rental_evidence_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'rental-evidence'
  and exists (
    select 1
      from public.rental_contracts c
     where c.id::text = (storage.foldername(name))[1]
       and (
         c.agent_id = (select auth.uid())
         or (
           c.tenant_id = (select auth.uid())
           and exists (
             select 1
               from public.rental_inspections i
              where i.contract_id = c.id
                and i.released_at is not null
           )
         )
       )
  )
);

-- The ledger is service-only. A deny policy makes that posture explicit while
-- keeping the security advisor from treating the intentionally policy-free
-- table as accidental.
create policy rental_inspection_audit_events_service_only
on public.rental_inspection_audit_events
for all
to anon, authenticated
using (false)
with check (false);

-- All mutations flow through the server-authorized Edge Function. The
-- functions still enforce ownership internally as defense in depth.
revoke all on function public.rental_inspection_item_add_v2(uuid,text,text,text,bigint,text,integer,timestamptz,text,text,integer,integer) from authenticated;
revoke all on function public.rental_inspection_item_delete_v2(uuid) from authenticated;
revoke all on function public.rental_inspection_send_v2(uuid) from authenticated;
revoke all on function public.rental_inspection_confirm_tenant_evidence(uuid) from authenticated;
grant execute on function public.rental_inspection_item_add_v2(uuid,text,text,text,bigint,text,integer,timestamptz,text,text,integer,integer) to service_role;
grant execute on function public.rental_inspection_item_delete_v2(uuid) to service_role;
grant execute on function public.rental_inspection_send_v2(uuid) to service_role;
grant execute on function public.rental_inspection_confirm_tenant_evidence(uuid) to service_role;

create or replace function public.rental_inspection_approve_all(p_token text)
returns table(
  inspection_id uuid,
  inspection_state text,
  photo_count integer,
  approved_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_contract public.rental_contracts%rowtype;
  v_inspection public.rental_inspections%rowtype;
  v_count integer;
  v_now timestamptz := clock_timestamp();
begin
  if coalesce(p_token, '') !~ '^[0-9a-fA-F]{48}$' then
    raise exception 'That link is not valid.' using errcode = '22023';
  end if;
  select * into v_contract from public.rental_contracts where share_token = lower(p_token);
  if not found then raise exception 'That link is not valid.' using errcode = '22023'; end if;
  select * into v_inspection
    from public.rental_inspections
   where contract_id = v_contract.id and kind = 'move_in'
   order by round desc limit 1 for update;
  if not found or v_inspection.state = 'draft'::public.inspection_state or v_inspection.released_at is null then
    raise exception 'The walkthrough media are not available yet.' using errcode = '42501';
  end if;
  select count(*)::integer into v_count
    from public.rental_inspection_items
   where rental_inspection_items.inspection_id = v_inspection.id;
  if v_count = 0 then raise exception 'There are no walkthrough items to approve.' using errcode = '22023'; end if;
  if exists (
    select 1 from public.rental_inspection_items
     where rental_inspection_items.inspection_id = v_inspection.id
       and verdict <> 'agreed'::public.inspection_item_verdict
  ) then
    raise exception 'Review every item before completing the walkthrough.' using errcode = '22023';
  end if;
  if v_inspection.state <> 'agreed'::public.inspection_state then
    update public.rental_inspections
       set state = 'agreed'::public.inspection_state,
           tenant_done_at = coalesce(tenant_done_at, v_now),
           host_done_at = coalesce(host_done_at, sent_at, v_now),
           settled_at = coalesce(settled_at, v_now)
     where id = v_inspection.id;
    insert into public.rental_inspection_audit_events(
      inspection_id, contract_id, event_type, actor_role, event_payload, created_at
    ) values (
      v_inspection.id, v_contract.id, 'walkthrough_approved', 'tenant_capability',
      jsonb_build_object('item_count', v_count), v_now
    );
    perform public.notify_rental(
      v_contract.agent_id,
      'rental_inspection_agreed',
      'The move-in walkthrough was approved',
      'The tenant reviewed and approved every walkthrough item.',
      '/rentals/c/' || v_contract.id::text
    );
  end if;
  inspection_id := v_inspection.id;
  inspection_state := 'agreed';
  photo_count := v_count;
  approved_at := coalesce(v_inspection.settled_at, v_now);
  return next;
end
$function$;

revoke all on function public.rental_inspection_approve_all(text) from public, anon, authenticated;
grant execute on function public.rental_inspection_approve_all(text) to service_role;

create or replace function public.rental_inspection_respond_v2(
  p_token text,
  p_item_id uuid,
  p_verdict text,
  p_note text default null,
  p_tenant_photo_path text default null,
  p_tenant_photo_original_name text default null,
  p_tenant_photo_captured_at timestamptz default null,
  p_request_fingerprint text default null
)
returns table(item_id uuid, verdict text, responded_at timestamptz)
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $function$
declare
  c public.rental_contracts%rowtype;
  i public.rental_inspections%rowtype;
  item public.rental_inspection_items%rowtype;
  v_now timestamptz := clock_timestamp();
  v_size bigint;
  v_mime text;
begin
  if p_verdict not in ('agreed','disputed') then
    raise exception 'Approve the item or reject it.' using errcode='22023';
  end if;
  if p_verdict='disputed' and coalesce(btrim(p_note),'')='' then
    raise exception 'A rejection comment is required.' using errcode='22023';
  end if;
  if p_verdict='agreed' and nullif(btrim(coalesce(p_tenant_photo_path,'')),'') is not null then
    raise exception 'Condition evidence is only attached to a rejected item.' using errcode='22023';
  end if;
  select * into c from public.rental_contracts where share_token=lower(btrim(coalesce(p_token,'')));
  if not found then raise exception 'That walkthrough link is not valid.' using errcode='22023'; end if;
  select insp.* into i from public.rental_inspections insp
   where insp.contract_id=c.id and insp.kind='move_in'
   order by insp.round desc limit 1 for update;
  if not found or i.state='draft'::public.inspection_state or i.released_at is null then
    raise exception 'The walkthrough media are not available yet.' using errcode='42501';
  end if;
  select * into item from public.rental_inspection_items
   where id=p_item_id and inspection_id=i.id for update;
  if not found then raise exception 'That item is not part of this walkthrough.' using errcode='22023'; end if;
  if item.verdict <> 'pending'::public.inspection_item_verdict then
    raise exception 'The tenant response for this item is already closed.' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_tenant_photo_path,'')),'') is not null then
    if p_tenant_photo_path not like c.id::text || '/tenant-evidence/' || item.id::text || '/%' then
      raise exception 'That condition photo does not belong to this item.' using errcode='42501';
    end if;
    select nullif(o.metadata->>'size','')::bigint,
           lower(coalesce(o.metadata->>'mimetype',o.metadata->>'contentType',''))
      into v_size,v_mime
      from storage.objects o
     where o.bucket_id='rental-evidence' and o.name=p_tenant_photo_path;
    if not found then raise exception 'The tenant condition photo upload did not finish.' using errcode='22023'; end if;
    if v_mime not in ('image/jpeg','image/png','image/webp','image/heic','image/heif') or v_size<1 or v_size>26214400 then
      raise exception 'Tenant condition evidence must be a supported photo no larger than 25 MiB.' using errcode='22023';
    end if;
  end if;
  update public.rental_inspection_items set
    verdict=p_verdict::public.inspection_item_verdict,
    tenant_note=case when p_verdict='disputed' then left(btrim(p_note),2000) else null end,
    tenant_photo_url=nullif(btrim(coalesce(p_tenant_photo_path,'')),''),
    tenant_photo_mime_type=v_mime,
    tenant_photo_byte_size=v_size,
    tenant_photo_original_name=left(nullif(btrim(coalesce(p_tenant_photo_original_name,'')),''),255),
    tenant_photo_captured_at=case
      when p_tenant_photo_captured_at between '2000-01-01'::timestamptz and v_now+interval '5 minutes'
      then p_tenant_photo_captured_at else null end,
    tenant_photo_uploaded_at=case when p_tenant_photo_path is not null then v_now else null end,
    tenant_evidence_status=case when p_tenant_photo_path is not null then 'pending_agent_review' else 'none' end,
    responded_at=v_now
  where id=item.id;
  if exists (
    select 1 from public.rental_inspection_items pending
     where pending.inspection_id=i.id
       and pending.verdict='pending'::public.inspection_item_verdict
  ) then
    update public.rental_inspections
       set state='awaiting_tenant'::public.inspection_state, tenant_done_at=null
     where id=i.id and state='tenant_responded'::public.inspection_state;
  else
    update public.rental_inspections
       set state='tenant_responded'::public.inspection_state, tenant_done_at=v_now
     where id=i.id and state='awaiting_tenant'::public.inspection_state;
  end if;
  insert into public.rental_inspection_audit_events(
    inspection_id,contract_id,item_id,event_type,actor_role,event_payload,created_at
  ) values(
    i.id,c.id,item.id,
    case when p_verdict='agreed' then 'tenant_item_approved' else 'tenant_item_rejected' end,
    'tenant_capability',
    jsonb_strip_nulls(jsonb_build_object(
      'verdict',p_verdict,
      'comment',case when p_verdict='disputed' then left(btrim(p_note),2000) else null end,
      'tenant_photo_path',nullif(btrim(coalesce(p_tenant_photo_path,'')),''),
      'tenant_photo_mime_type',v_mime,
      'tenant_photo_byte_size',v_size,
      'tenant_photo_original_name',left(nullif(btrim(coalesce(p_tenant_photo_original_name,'')),''),255),
      'tenant_photo_captured_at',p_tenant_photo_captured_at,
      'tenant_photo_uploaded_at',case when p_tenant_photo_path is not null then v_now else null end,
      'request_fingerprint',nullif(btrim(coalesce(p_request_fingerprint,'')),''))),
    v_now
  );
  item_id:=item.id;
  verdict:=p_verdict;
  responded_at:=v_now;
  return next;
end
$function$;

revoke all on function public.rental_inspection_respond_v2(text,uuid,text,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.rental_inspection_respond_v2(text,uuid,text,text,text,text,timestamptz,text) to service_role;
