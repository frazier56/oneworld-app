-- OneHome walkthrough media v2: private owner uploads, video support, gated
-- tenant release, one-shot tenant condition evidence, and an immutable audit
-- ledger. Storage remains private; user-facing media is served only by short-
-- lived signed URLs from the rental-inspection Edge Function.

update storage.buckets
   set public = false,
       file_size_limit = 314572800,
       allowed_mime_types = array[
         'image/jpeg','image/png','image/webp','image/heic','image/heif',
         'video/mp4','video/webm','video/quicktime'
       ]::text[]
 where id = 'rental-evidence';

alter table public.rental_inspection_items
  add column if not exists captured_at timestamptz,
  add column if not exists uploaded_at timestamptz not null default clock_timestamp(),
  add column if not exists source_version integer not null default 1,
  add column if not exists tenant_photo_mime_type text,
  add column if not exists tenant_photo_byte_size bigint,
  add column if not exists tenant_photo_original_name text,
  add column if not exists tenant_photo_captured_at timestamptz,
  add column if not exists tenant_photo_uploaded_at timestamptz,
  add column if not exists tenant_evidence_status text not null default 'none'
    check (tenant_evidence_status in ('none','pending_agent_review','accepted')),
  add column if not exists tenant_evidence_locked_at timestamptz,
  add column if not exists tenant_evidence_locked_by uuid;

update public.rental_inspection_items
   set uploaded_at = created_at
 where uploaded_at is null;

alter table public.rental_inspections
  add column if not exists released_at timestamptz,
  add column if not exists release_reason text
    check (release_reason is null or release_reason in ('payment','agent_early')),
  add column if not exists released_by uuid;

create table if not exists public.rental_inspection_audit_events (
  id bigint generated always as identity primary key,
  inspection_id uuid not null,
  contract_id uuid not null,
  item_id uuid,
  event_type text not null,
  actor_user_id uuid,
  actor_role text not null,
  event_payload jsonb not null default '{}'::jsonb,
  audit_version integer not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  check (actor_role in ('owner','listing_agent','tenant_capability','system','migration'))
);

create index if not exists rental_inspection_audit_events_inspection_idx
  on public.rental_inspection_audit_events (inspection_id, id);
create index if not exists rental_inspection_audit_events_item_idx
  on public.rental_inspection_audit_events (item_id, id) where item_id is not null;

alter table public.rental_inspection_audit_events enable row level security;
revoke all on table public.rental_inspection_audit_events from public, anon, authenticated;
grant select, insert on table public.rental_inspection_audit_events to service_role;
grant usage, select on sequence public.rental_inspection_audit_events_id_seq to service_role;

create or replace function public.guard_rental_inspection_audit_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  raise exception 'Walkthrough audit events are append-only.' using errcode='42501';
end
$function$;

drop trigger if exists trg_rental_inspection_audit_immutable on public.rental_inspection_audit_events;
create trigger trg_rental_inspection_audit_immutable
before update or delete on public.rental_inspection_audit_events
for each row execute function public.guard_rental_inspection_audit_immutable();

insert into public.rental_inspection_audit_events (
  inspection_id, contract_id, item_id, event_type, actor_user_id, actor_role, event_payload, created_at
)
select i.id, i.contract_id, item.id, 'media_uploaded_backfill', item.added_by,
       case when item.added_by_role='host' then 'owner' else 'migration' end,
       jsonb_strip_nulls(jsonb_build_object(
         'storage_path', item.photo_url,
         'media_kind', item.media_kind,
         'mime_type', item.mime_type,
         'byte_size', item.byte_size,
         'original_name', item.original_name,
         'captured_at', item.captured_at,
         'uploaded_at', item.created_at,
         'source_version', 1
       )),
       item.created_at
  from public.rental_inspection_items item
  join public.rental_inspections i on i.id=item.inspection_id
 where not exists (
   select 1 from public.rental_inspection_audit_events e
    where e.item_id=item.id and e.event_type in ('media_uploaded','media_uploaded_backfill')
 );

create or replace function public.guard_rental_inspection_item_evidence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if old.inspection_id is distinct from new.inspection_id
     or old.photo_url is distinct from new.photo_url
     or old.added_by is distinct from new.added_by
     or old.added_by_role is distinct from new.added_by_role
     or old.media_kind is distinct from new.media_kind
     or old.mime_type is distinct from new.mime_type
     or old.byte_size is distinct from new.byte_size
     or old.original_name is distinct from new.original_name
     or old.duration_ms is distinct from new.duration_ms
     or old.width is distinct from new.width
     or old.height is distinct from new.height
     or old.captured_at is distinct from new.captured_at
     or old.uploaded_at is distinct from new.uploaded_at
     or old.source_version is distinct from new.source_version then
    raise exception 'Walkthrough source metadata and timestamps are immutable.' using errcode='42501';
  end if;
  if old.verdict <> 'pending'::public.inspection_item_verdict and (
     old.verdict is distinct from new.verdict
     or old.tenant_note is distinct from new.tenant_note
     or old.tenant_photo_url is distinct from new.tenant_photo_url
     or old.responded_at is distinct from new.responded_at
     or old.tenant_photo_mime_type is distinct from new.tenant_photo_mime_type
     or old.tenant_photo_byte_size is distinct from new.tenant_photo_byte_size
     or old.tenant_photo_original_name is distinct from new.tenant_photo_original_name
     or old.tenant_photo_captured_at is distinct from new.tenant_photo_captured_at
     or old.tenant_photo_uploaded_at is distinct from new.tenant_photo_uploaded_at
  ) then
    raise exception 'The tenant response for this item is closed.' using errcode='42501';
  end if;
  if old.tenant_evidence_locked_at is not null and (
     old.tenant_evidence_status is distinct from new.tenant_evidence_status
     or old.tenant_evidence_locked_at is distinct from new.tenant_evidence_locked_at
     or old.tenant_evidence_locked_by is distinct from new.tenant_evidence_locked_by
  ) then
    raise exception 'Accepted tenant condition evidence is locked.' using errcode='42501';
  end if;
  return new;
end
$function$;

drop trigger if exists trg_rental_inspection_item_evidence_guard on public.rental_inspection_items;
create trigger trg_rental_inspection_item_evidence_guard
before update on public.rental_inspection_items
for each row execute function public.guard_rental_inspection_item_evidence();

create or replace function public.rental_inspection_item_add_v2(
  p_inspection_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_media_kind text default 'image',
  p_duration_ms integer default null,
  p_captured_at timestamptz default null,
  p_room text default null,
  p_caption text default null,
  p_width integer default null,
  p_height integer default null
)
returns public.rental_inspection_items
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $function$
declare
  uid uuid := auth.uid();
  i public.rental_inspections%rowtype;
  c public.rental_contracts%rowtype;
  v_kind text := lower(btrim(coalesce(p_media_kind,'')));
  v_images integer;
  v_videos integer;
  v_object_size bigint;
  v_object_mime text;
  v_item public.rental_inspection_items%rowtype;
begin
  if uid is null then raise exception 'Sign in as the property owner.' using errcode='42501'; end if;
  select * into i from public.rental_inspections where id=p_inspection_id for update;
  if not found then raise exception 'That walkthrough was not found.' using errcode='22023'; end if;
  select * into c from public.rental_contracts where id=i.contract_id;
  if c.agent_id is distinct from uid then raise exception 'Only the owner can add walkthrough media.' using errcode='42501'; end if;
  if i.state <> 'draft'::public.inspection_state then raise exception 'This evidence set is frozen. Use property messages for additional media.' using errcode='42501'; end if;
  if v_kind not in ('image','video') then raise exception 'Choose a photo or video.' using errcode='22023'; end if;
  if v_kind='image' and p_mime_type not in ('image/jpeg','image/png','image/webp','image/heic','image/heif') then
    raise exception 'Only JPEG, PNG, WebP, HEIC and HEIF photos are supported.' using errcode='22023';
  end if;
  if v_kind='video' and p_mime_type not in ('video/mp4','video/webm','video/quicktime') then
    raise exception 'Only MP4, WebM and QuickTime videos are supported.' using errcode='22023';
  end if;
  if v_kind='image' and (p_byte_size is null or p_byte_size < 1 or p_byte_size > 26214400) then
    raise exception 'Each photo must be 25 MiB or smaller.' using errcode='22023';
  end if;
  if v_kind='video' and (p_byte_size is null or p_byte_size < 1 or p_byte_size > 314572800) then
    raise exception 'Each video must be 300 MiB or smaller.' using errcode='22023';
  end if;
  if v_kind='video' and (p_duration_ms is null or p_duration_ms < 1 or p_duration_ms > 300000) then
    raise exception 'Each video must be five minutes or shorter.' using errcode='22023';
  end if;
  if v_kind='image' and p_duration_ms is not null then raise exception 'A photo cannot have video duration.' using errcode='22023'; end if;
  if p_storage_path not like c.id::text || '/' || uid::text || '/' || i.id::text || '/%' then
    raise exception 'That upload path does not belong to this walkthrough.' using errcode='42501';
  end if;
  select nullif(o.metadata->>'size','')::bigint,
         lower(coalesce(o.metadata->>'mimetype',o.metadata->>'contentType',''))
    into v_object_size,v_object_mime
    from storage.objects o
   where o.bucket_id='rental-evidence' and o.name=p_storage_path;
  if not found then raise exception 'The media upload did not finish.' using errcode='22023'; end if;
  if v_object_size is distinct from p_byte_size then raise exception 'The uploaded file size did not match.' using errcode='22023'; end if;
  if v_object_mime <> lower(p_mime_type) then raise exception 'The uploaded file type did not match.' using errcode='22023'; end if;
  select count(*) filter(where media_kind='image')::integer,
         count(*) filter(where media_kind='video')::integer
    into v_images,v_videos from public.rental_inspection_items where inspection_id=i.id;
  if v_kind='image' and v_images >= 100 then raise exception 'A walkthrough can contain at most 100 photos.' using errcode='22023'; end if;
  if v_kind='video' and v_videos >= 10 then raise exception 'A walkthrough can contain at most 10 videos.' using errcode='22023'; end if;

  insert into public.rental_inspection_items (
    inspection_id, ordinal, photo_url, host_note, added_by, added_by_role,
    media_kind, mime_type, byte_size, original_name, room, duration_ms,
    width, height, upload_state, captured_at, uploaded_at, source_version
  ) values (
    i.id, v_images+v_videos+1, p_storage_path, left(nullif(btrim(coalesce(p_caption,'')),''),1000), uid, 'host',
    v_kind, lower(p_mime_type), p_byte_size, left(p_original_name,255),
    left(nullif(btrim(coalesce(p_room,'')),''),120), p_duration_ms,
    p_width, p_height, 'ready',
    case when p_captured_at between '2000-01-01'::timestamptz and clock_timestamp()+interval '5 minutes' then p_captured_at else null end,
    clock_timestamp(), 1
  ) returning * into v_item;

  insert into public.rental_inspection_audit_events(
    inspection_id,contract_id,item_id,event_type,actor_user_id,actor_role,event_payload
  ) values (
    i.id,c.id,v_item.id,'media_uploaded',uid,'owner',
    jsonb_strip_nulls(jsonb_build_object(
      'storage_path',v_item.photo_url,'media_kind',v_item.media_kind,'mime_type',v_item.mime_type,
      'byte_size',v_item.byte_size,'original_name',v_item.original_name,
      'captured_at',v_item.captured_at,'uploaded_at',v_item.uploaded_at,'duration_ms',v_item.duration_ms,
      'width',v_item.width,'height',v_item.height,'source_version',v_item.source_version
    ))
  );
  return v_item;
end
$function$;

revoke all on function public.rental_inspection_item_add_v2(uuid,text,text,text,bigint,text,integer,timestamptz,text,text,integer,integer) from public,anon;
grant execute on function public.rental_inspection_item_add_v2(uuid,text,text,text,bigint,text,integer,timestamptz,text,text,integer,integer) to authenticated,service_role;

create or replace function public.rental_inspection_item_delete_v2(p_item_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_item public.rental_inspection_items%rowtype; v_inspection public.rental_inspections%rowtype; v_contract public.rental_contracts%rowtype;
begin
  select item.* into v_item
    from public.rental_inspection_items item
    join public.rental_inspections i on i.id=item.inspection_id
    join public.rental_contracts c on c.id=i.contract_id
   where item.id=p_item_id and c.agent_id=auth.uid() and i.state='draft'::public.inspection_state
   for update of item;
  if not found then raise exception 'Only the owner can delete unfrozen walkthrough media.' using errcode='42501'; end if;
  select * into v_inspection from public.rental_inspections where id=v_item.inspection_id;
  select * into v_contract from public.rental_contracts where id=v_inspection.contract_id;
  insert into public.rental_inspection_audit_events(inspection_id,contract_id,item_id,event_type,actor_user_id,actor_role,event_payload)
  values(v_inspection.id,v_contract.id,v_item.id,'media_removed_from_draft',auth.uid(),'owner',
    jsonb_strip_nulls(jsonb_build_object('storage_path',v_item.photo_url,'media_kind',v_item.media_kind,'uploaded_at',v_item.uploaded_at,'source_version',v_item.source_version)));
  delete from public.rental_inspection_items where id=p_item_id;
  with ranked as (
    select id,row_number() over(order by ordinal,id) rn from public.rental_inspection_items where inspection_id=v_inspection.id
  ) update public.rental_inspection_items item set ordinal=-ranked.rn from ranked where item.id=ranked.id;
  update public.rental_inspection_items set ordinal=-ordinal where inspection_id=v_inspection.id;
  return v_item.photo_url;
end
$function$;

revoke all on function public.rental_inspection_item_delete_v2(uuid) from public,anon;
grant execute on function public.rental_inspection_item_delete_v2(uuid) to authenticated,service_role;

create or replace function public.rental_inspection_send_v2(p_inspection_id uuid)
returns table(inspection_id uuid, contract_id uuid, share_token text, property_title text, inspection_state text, media_count integer, release_reason text, released_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
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
  v_hash:=encode(digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  v_reason:=case when v_contract.first_payment_claimed_at is not null or v_contract.status in ('active','ended') then 'payment' else 'agent_early' end;
  if v_inspection.state='draft'::public.inspection_state then
    update public.rental_inspections set state='awaiting_tenant'::public.inspection_state,
      sent_at=coalesce(sent_at,v_now),host_done_at=coalesce(host_done_at,v_now),
      evidence_version=greatest(round,1),evidence_manifest=v_manifest,evidence_manifest_sha256=v_hash,
      evidence_frozen_at=coalesce(evidence_frozen_at,v_now),released_at=coalesce(released_at,v_now),
      release_reason=coalesce(release_reason,v_reason),released_by=coalesce(released_by,v_user)
      where id=p_inspection_id;
    insert into public.rental_inspection_audit_events(inspection_id,contract_id,event_type,actor_user_id,actor_role,event_payload,created_at)
    values(v_inspection.id,v_contract.id,'packet_frozen',v_user,'owner',jsonb_build_object('evidence_version',greatest(v_inspection.round,1),'manifest_sha256',v_hash,'media_count',v_count),v_now),
          (v_inspection.id,v_contract.id,'visibility_released',v_user,case when v_reason='payment' then 'system' else 'listing_agent' end,jsonb_build_object('reason',v_reason),v_now);
    v_inspection.state:='awaiting_tenant'::public.inspection_state;
  elsif v_inspection.state not in ('awaiting_tenant'::public.inspection_state,'tenant_responded'::public.inspection_state,'host_reviewing'::public.inspection_state,'agreed'::public.inspection_state) then
    raise exception 'This walkthrough cannot be released in its current state.' using errcode='22023';
  end if;
  select p.title into v_title from public.rental_properties p where p.id=v_contract.property_id;
  inspection_id:=v_inspection.id; contract_id:=v_contract.id; share_token:=v_contract.share_token;
  property_title:=coalesce(v_title,'your OneHome'); inspection_state:=v_inspection.state::text;
  media_count:=v_count; release_reason:=coalesce(v_inspection.release_reason,v_reason); released_at:=coalesce(v_inspection.released_at,v_now); return next;
end
$function$;

revoke all on function public.rental_inspection_send_v2(uuid) from public,anon;
grant execute on function public.rental_inspection_send_v2(uuid) to authenticated,service_role;

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
  c public.rental_contracts%rowtype; i public.rental_inspections%rowtype; item public.rental_inspection_items%rowtype;
  v_now timestamptz:=clock_timestamp(); v_size bigint; v_mime text;
begin
  if p_verdict not in ('agreed','disputed') then raise exception 'Approve the item or reject it.' using errcode='22023'; end if;
  if p_verdict='disputed' and coalesce(btrim(p_note),'')='' then raise exception 'A rejection comment is required.' using errcode='22023'; end if;
  if p_verdict='agreed' and nullif(btrim(coalesce(p_tenant_photo_path,'')),'') is not null then raise exception 'Condition evidence is only attached to a rejected item.' using errcode='22023'; end if;
  select * into c from public.rental_contracts where share_token=lower(btrim(coalesce(p_token,'')));
  if not found then raise exception 'That walkthrough link is not valid.' using errcode='22023'; end if;
  select insp.* into i from public.rental_inspections insp
   where insp.contract_id=c.id and insp.kind='move_in' order by insp.round desc limit 1 for update;
  if not found or i.state='draft'::public.inspection_state or i.released_at is null then raise exception 'The walkthrough media are not available yet.' using errcode='42501'; end if;
  select * into item from public.rental_inspection_items where id=p_item_id and inspection_id=i.id for update;
  if not found then raise exception 'That item is not part of this walkthrough.' using errcode='22023'; end if;
  if item.verdict <> 'pending'::public.inspection_item_verdict then raise exception 'The tenant response for this item is already closed.' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_tenant_photo_path,'')),'') is not null then
    if p_tenant_photo_path not like c.id::text || '/tenant-evidence/' || item.id::text || '/%' then raise exception 'That condition photo does not belong to this item.' using errcode='42501'; end if;
    select nullif(o.metadata->>'size','')::bigint,lower(coalesce(o.metadata->>'mimetype',o.metadata->>'contentType','')) into v_size,v_mime
      from storage.objects o where o.bucket_id='rental-evidence' and o.name=p_tenant_photo_path;
    if not found then raise exception 'The tenant condition photo upload did not finish.' using errcode='22023'; end if;
    if v_mime not in ('image/jpeg','image/png','image/webp','image/heic','image/heif') or v_size<1 or v_size>26214400 then
      raise exception 'Tenant condition evidence must be a supported photo no larger than 25 MiB.' using errcode='22023';
    end if;
  end if;
  update public.rental_inspection_items set
    verdict=p_verdict::public.inspection_item_verdict,
    tenant_note=case when p_verdict='disputed' then left(btrim(p_note),2000) else null end,
    tenant_photo_url=nullif(btrim(coalesce(p_tenant_photo_path,'')),''),
    tenant_photo_mime_type=v_mime,tenant_photo_byte_size=v_size,
    tenant_photo_original_name=left(nullif(btrim(coalesce(p_tenant_photo_original_name,'')),''),255),
    tenant_photo_captured_at=case when p_tenant_photo_captured_at between '2000-01-01'::timestamptz and v_now+interval '5 minutes' then p_tenant_photo_captured_at else null end,
    tenant_photo_uploaded_at=case when p_tenant_photo_path is not null then v_now else null end,
    tenant_evidence_status=case when p_tenant_photo_path is not null then 'pending_agent_review' else 'none' end,
    responded_at=v_now
  where id=item.id;
  update public.rental_inspections set state='tenant_responded'::public.inspection_state,tenant_done_at=v_now where id=i.id and state='awaiting_tenant'::public.inspection_state;
  insert into public.rental_inspection_audit_events(inspection_id,contract_id,item_id,event_type,actor_role,event_payload,created_at)
  values(i.id,c.id,item.id,case when p_verdict='agreed' then 'tenant_item_approved' else 'tenant_item_rejected' end,'tenant_capability',
    jsonb_strip_nulls(jsonb_build_object('verdict',p_verdict,'comment',case when p_verdict='disputed' then left(btrim(p_note),2000) else null end,
      'tenant_photo_path',nullif(btrim(coalesce(p_tenant_photo_path,'')),''),'tenant_photo_mime_type',v_mime,'tenant_photo_byte_size',v_size,
      'tenant_photo_original_name',left(nullif(btrim(coalesce(p_tenant_photo_original_name,'')),''),255),
      'tenant_photo_captured_at',p_tenant_photo_captured_at,'tenant_photo_uploaded_at',case when p_tenant_photo_path is not null then v_now else null end,
      'request_fingerprint',nullif(btrim(coalesce(p_request_fingerprint,'')),''))),v_now);
  item_id:=item.id; verdict:=p_verdict; responded_at:=v_now; return next;
end
$function$;

revoke all on function public.rental_inspection_respond_v2(text,uuid,text,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.rental_inspection_respond_v2(text,uuid,text,text,text,text,timestamptz,text) to service_role;

create or replace function public.rental_inspection_confirm_tenant_evidence(p_item_id uuid)
returns table(item_id uuid, evidence_status text, locked_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare item public.rental_inspection_items%rowtype; i public.rental_inspections%rowtype; c public.rental_contracts%rowtype; v_now timestamptz:=clock_timestamp();
begin
  select * into item from public.rental_inspection_items where id=p_item_id for update;
  if not found then raise exception 'That condition item was not found.' using errcode='22023'; end if;
  select * into i from public.rental_inspections where id=item.inspection_id;
  select * into c from public.rental_contracts where id=i.contract_id;
  if c.agent_id is distinct from auth.uid() then raise exception 'Only the owner or listing agent can confirm tenant evidence.' using errcode='42501'; end if;
  if item.verdict <> 'disputed'::public.inspection_item_verdict or item.tenant_photo_url is null then raise exception 'There is no tenant condition photo to confirm.' using errcode='22023'; end if;
  if item.tenant_evidence_status='accepted' then
    item_id:=item.id;evidence_status:='accepted';locked_at:=item.tenant_evidence_locked_at;return next;return;
  end if;
  update public.rental_inspection_items set tenant_evidence_status='accepted',tenant_evidence_locked_at=v_now,tenant_evidence_locked_by=auth.uid() where id=item.id;
  update public.rental_inspections set state='host_reviewing'::public.inspection_state where id=i.id and state='tenant_responded'::public.inspection_state;
  insert into public.rental_inspection_audit_events(inspection_id,contract_id,item_id,event_type,actor_user_id,actor_role,event_payload,created_at)
  values(i.id,c.id,item.id,'tenant_evidence_accepted',auth.uid(),'listing_agent',jsonb_build_object('tenant_photo_path',item.tenant_photo_url,'tenant_responded_at',item.responded_at),v_now);
  item_id:=item.id;evidence_status:='accepted';locked_at:=v_now;return next;
end
$function$;

revoke all on function public.rental_inspection_confirm_tenant_evidence(uuid) from public,anon;
grant execute on function public.rental_inspection_confirm_tenant_evidence(uuid) to authenticated,service_role;

create or replace function public.onehome_release_walkthrough_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare rec record; v_now timestamptz:=clock_timestamp();
begin
  if not ((old.first_payment_claimed_at is null and new.first_payment_claimed_at is not null)
          or (old.status is distinct from new.status and new.status in ('active','ended'))) then return new; end if;
  for rec in
    update public.rental_inspections i set released_at=coalesce(i.released_at,v_now),release_reason=coalesce(i.release_reason,'payment'),released_by=null
     where i.contract_id=new.id and i.kind='move_in' and i.state<>'draft'::public.inspection_state and i.released_at is null
     returning i.id
  loop
    insert into public.rental_inspection_audit_events(inspection_id,contract_id,event_type,actor_role,event_payload,created_at)
    values(rec.id,new.id,'visibility_released','system',jsonb_build_object('reason','payment'),v_now);
  end loop;
  return new;
end
$function$;

drop trigger if exists trg_onehome_release_walkthrough_on_payment on public.rental_contracts;
create trigger trg_onehome_release_walkthrough_on_payment
after update of first_payment_claimed_at,status on public.rental_contracts
for each row execute function public.onehome_release_walkthrough_on_payment();

revoke all on function public.guard_rental_inspection_audit_immutable() from public,anon,authenticated;
revoke all on function public.guard_rental_inspection_item_evidence() from public,anon,authenticated;
revoke all on function public.onehome_release_walkthrough_on_payment() from public,anon,authenticated;
