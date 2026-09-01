-- OneHome owner QA: separate legal acknowledgements, production-safe image
-- inspection batches, frozen evidence manifests, and an exact listing-10518 reset.

create table if not exists public.rental_owner_term_acceptances (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.rental_property_claims(id) on delete cascade,
  acceptance_kind text not null check (acceptance_kind in ('platform_terms', 'property_owner_terms')),
  document_version text not null,
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  document_snapshot text not null,
  signer_user_id uuid null references auth.users(id) on delete set null,
  signer_name text not null,
  signer_capacity text not null default 'property_owner',
  locale text not null default 'en',
  ip_hash text null check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  user_agent text null,
  accepted_at timestamptz not null default now(),
  unique (claim_id, acceptance_kind)
);

comment on table public.rental_owner_term_acceptances is
  'Two distinct owner-review acceptances. OneWorld platform terms and property-owner supplemental terms must never be merged.';

alter table public.rental_owner_term_acceptances enable row level security;
drop policy if exists rental_owner_term_acceptances_read_parties
  on public.rental_owner_term_acceptances;
create policy rental_owner_term_acceptances_read_parties
on public.rental_owner_term_acceptances
for select to authenticated
using (
  exists (
    select 1 from public.rental_property_claims claim
    where claim.id = claim_id
      and (claim.claimed_by = (select auth.uid()) or claim.invited_by = (select auth.uid()))
  )
);

revoke all on public.rental_owner_term_acceptances from public, anon, authenticated;
grant select on public.rental_owner_term_acceptances to authenticated;

-- The owner accepts the two snapshots atomically with an approval. A request for
-- changes does not create either acceptance.
drop function if exists public.rental_listing_review_submit(text, text, text, text);
drop function if exists public.rental_listing_review_submit(text, text, text, text, boolean, boolean, text, text, text);

create function public.rental_listing_review_submit(
  p_token text,
  p_decision text,
  p_name text,
  p_note text default null,
  p_platform_terms_accepted boolean default false,
  p_property_terms_accepted boolean default false,
  p_platform_terms_version text default null,
  p_property_terms_version text default null,
  p_locale text default 'en',
  p_ip_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  c public.rental_property_claims;
  p public.rental_properties;
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_platform_snapshot constant text := 'I agree to the OneWorld / OneHome platform terms for account use, privacy, electronic records and signatures, messaging, fees, payment-record status, support and disputes. OneWorld provides the platform and is not the property owner or a party supplying the property.';
  v_property_snapshot constant text := 'I acknowledge that I reviewed the property-owner supplemental terms snapshot for this listing, including COP 9,000,000 rent for each monthly period, month-to-month structure, and the separately displayed COP 300,000 move-in cleaning charge. This records review of the owner-side property terms; it does not merge them with OneWorld platform terms, settle the open legal decisions, or create a signed final lease.';
  v_platform_version constant text := 'oneworld-platform-owner-review-2026-09-01';
  v_property_version constant text := 'onehome-property-owner-review-draft-2026-09-01';
begin
  if p_decision not in ('approved','changes_requested') then
    raise exception 'answer must be approved or changes_requested' using errcode = '22023';
  end if;
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'please type your name' using errcode = '22004';
  end if;
  if p_decision = 'changes_requested' and v_note is null then
    raise exception 'please say what needs changing' using errcode = '22004';
  end if;
  if p_decision = 'approved' and not coalesce(p_platform_terms_accepted, false) then
    raise exception 'review and accept the OneWorld / OneHome platform terms separately' using errcode = '22004';
  end if;
  if p_decision = 'approved' and not coalesce(p_property_terms_accepted, false) then
    raise exception 'review and acknowledge the property-owner supplemental terms separately' using errcode = '22004';
  end if;
  if p_decision = 'approved' and p_platform_terms_version is distinct from v_platform_version then
    raise exception 'the OneWorld / OneHome terms version changed; review it again' using errcode = '22004';
  end if;
  if p_decision = 'approved' and p_property_terms_version is distinct from v_property_version then
    raise exception 'the property-owner terms version changed; review it again' using errcode = '22004';
  end if;

  select * into c from public.rental_property_claims
   where claim_token = btrim(coalesce(p_token,'')) limit 1
   for update;
  if not found then raise exception 'link not recognised' using errcode = 'P0002'; end if;
  if c.revoked_at is not null or c.expires_at <= now() then
    raise exception 'this link has expired' using errcode = '22023';
  end if;
  if c.review_decision = 'approved' then
    raise exception 'this listing has already been approved' using errcode = '42501';
  end if;

  if p_decision = 'approved' then
    insert into public.rental_owner_term_acceptances (
      claim_id, acceptance_kind, document_version, document_sha256,
      document_snapshot, signer_name, locale, ip_hash, user_agent
    ) values
      (c.id, 'platform_terms', v_platform_version,
       encode(digest(convert_to(v_platform_snapshot, 'UTF8'), 'sha256'), 'hex'),
       v_platform_snapshot, v_name, left(coalesce(nullif(p_locale, ''), 'en'), 12),
       nullif(p_ip_hash, ''), left(nullif(p_user_agent, ''), 1000)),
      (c.id, 'property_owner_terms', v_property_version,
       encode(digest(convert_to(v_property_snapshot, 'UTF8'), 'sha256'), 'hex'),
       v_property_snapshot, v_name, left(coalesce(nullif(p_locale, ''), 'en'), 12),
       nullif(p_ip_hash, ''), left(nullif(p_user_agent, ''), 1000))
    on conflict (claim_id, acceptance_kind) do nothing;
  end if;

  update public.rental_property_claims
     set reviewed_at = now(), review_decision = p_decision,
         reviewed_by_name = v_name, review_note = v_note,
         reviewed_by = coalesce(reviewed_by, auth.uid())
   where id = c.id;

  select * into p from public.rental_properties where id = c.property_id;
  insert into public.notifications (user_id, type, title, body, metadata, action_url)
  values (
    c.invited_by,
    case when p_decision = 'approved' then 'rental_listing_approved_by_owner'
         else 'rental_listing_changes_requested' end,
    case when p_decision = 'approved'
         then v_name || ' approved listing #' || coalesce(p.listing_no::text, '')
         else v_name || ' asked for changes on listing #' || coalesce(p.listing_no::text, '') end,
    coalesce(v_note, case when p_decision = 'approved'
                          then 'Everything looked right. The owner separately acknowledged the platform and property-owner terms; no final lease was signed and no rent should be sent yet.'
                          else null end),
    jsonb_build_object('property_id', c.property_id, 'claim_id', c.id,
      'listing_no', p.listing_no, 'decision', p_decision, 'by_name', v_name,
      'separate_terms_acknowledged', p_decision = 'approved'),
    '/rentals/' || c.property_id::text
  );

  return jsonb_build_object('decision', p_decision, 'reviewed_at', now(),
    'by_name', v_name, 'listing_no', p.listing_no,
    'platform_terms_version', case when p_decision = 'approved' then v_platform_version else null end,
    'property_terms_version', case when p_decision = 'approved' then v_property_version else null end);
end
$function$;

revoke all on function public.rental_listing_review_submit(text,text,text,text,boolean,boolean,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.rental_listing_review_submit(text,text,text,text,boolean,boolean,text,text,text,text,text)
  to service_role;

-- Listing 10518 was intentionally approved before this migration. This narrow
-- compatibility RPC records the two missing acceptances before account creation;
-- it cannot change the already-approved decision or claim the property.
create or replace function public.rental_owner_terms_acknowledge_existing(
  p_token text,
  p_name text,
  p_platform_terms_accepted boolean,
  p_property_terms_accepted boolean,
  p_platform_terms_version text,
  p_property_terms_version text,
  p_locale text default 'en',
  p_ip_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  c public.rental_property_claims%rowtype;
  p public.rental_properties%rowtype;
  v_name text:=btrim(coalesce(p_name,''));
  v_platform_snapshot constant text := 'I agree to the OneWorld / OneHome platform terms for account use, privacy, electronic records and signatures, messaging, fees, payment-record status, support and disputes. OneWorld provides the platform and is not the property owner or a party supplying the property.';
  v_property_snapshot constant text := 'I acknowledge that I reviewed the property-owner supplemental terms snapshot for this listing, including COP 9,000,000 rent for each monthly period, month-to-month structure, and the separately displayed COP 300,000 move-in cleaning charge. This records review of the owner-side property terms; it does not merge them with OneWorld platform terms, settle the open legal decisions, or create a signed final lease.';
  v_platform_version constant text := 'oneworld-platform-owner-review-2026-09-01';
  v_property_version constant text := 'onehome-property-owner-review-draft-2026-09-01';
begin
  if length(v_name)<2 or length(v_name)>120 then raise exception 'please type your name' using errcode='22004'; end if;
  if not coalesce(p_platform_terms_accepted,false) or not coalesce(p_property_terms_accepted,false) then
    raise exception 'review and accept both terms sections separately' using errcode='22004';
  end if;
  if p_platform_terms_version is distinct from v_platform_version or p_property_terms_version is distinct from v_property_version then
    raise exception 'the terms version changed; review it again' using errcode='22004';
  end if;
  select * into c from public.rental_property_claims where claim_token=btrim(coalesce(p_token,'')) for update;
  if not found then raise exception 'link not recognised' using errcode='P0002'; end if;
  select * into p from public.rental_properties where id=c.property_id;
  if p.listing_no<>10518 or coalesce(c.note,'') !~* '(safe|qa|test)' then
    raise exception 'existing-approval acknowledgement is restricted to QA listing 10518' using errcode='42501';
  end if;
  if c.review_decision<>'approved' or c.claimed_at is not null or c.revoked_at is not null or c.expires_at<=now() then
    raise exception 'this approved QA link is not ready for acknowledgement' using errcode='42501';
  end if;
  insert into public.rental_owner_term_acceptances(
    claim_id,acceptance_kind,document_version,document_sha256,document_snapshot,signer_name,locale,ip_hash,user_agent
  ) values
    (c.id,'platform_terms',v_platform_version,encode(digest(convert_to(v_platform_snapshot,'UTF8'),'sha256'),'hex'),
     v_platform_snapshot,v_name,left(coalesce(nullif(p_locale,''),'en'),12),nullif(p_ip_hash,''),left(nullif(p_user_agent,''),1000)),
    (c.id,'property_owner_terms',v_property_version,encode(digest(convert_to(v_property_snapshot,'UTF8'),'sha256'),'hex'),
     v_property_snapshot,v_name,left(coalesce(nullif(p_locale,''),'en'),12),nullif(p_ip_hash,''),left(nullif(p_user_agent,''),1000))
  on conflict(claim_id,acceptance_kind) do nothing;
  return jsonb_build_object('acknowledged',true,'claim_id',c.id);
end
$function$;

revoke all on function public.rental_owner_terms_acknowledge_existing(text,text,boolean,boolean,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.rental_owner_terms_acknowledge_existing(text,text,boolean,boolean,text,text,text,text,text)
  to service_role;

create or replace function public.guard_rental_claim_requires_separate_terms()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if new.claimed_by is not null and old.claimed_by is distinct from new.claimed_by then
    if (select count(distinct acceptance_kind)
          from public.rental_owner_term_acceptances
         where claim_id = new.id
           and acceptance_kind in ('platform_terms', 'property_owner_terms')) <> 2 then
      raise exception 'Review and accept both terms sections before claiming this home.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists trg_rental_claim_requires_separate_terms on public.rental_property_claims;
create trigger trg_rental_claim_requires_separate_terms
before update of claimed_by on public.rental_property_claims
for each row execute function public.guard_rental_claim_requires_separate_terms();

create or replace function public.link_rental_acceptances_to_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.claimed_by is not null and old.claimed_by is distinct from new.claimed_by then
    update public.rental_owner_term_acceptances
       set signer_user_id = new.claimed_by
     where claim_id = new.id and signer_user_id is null;
  end if;
  return new;
end
$function$;

drop trigger if exists trg_link_rental_acceptances_to_owner on public.rental_property_claims;
create trigger trg_link_rental_acceptances_to_owner
after update of claimed_by on public.rental_property_claims
for each row execute function public.link_rental_acceptances_to_owner();

-- Image media metadata. The enum-like checks deliberately allow a future video
-- migration, but this release and bucket remain image-only.
alter table public.rental_inspection_items
  add column if not exists media_kind text not null default 'image'
    check (media_kind in ('image','video')),
  add column if not exists mime_type text,
  add column if not exists byte_size bigint check (byte_size is null or byte_size > 0),
  add column if not exists original_name text,
  add column if not exists room text,
  add column if not exists duration_ms integer check (duration_ms is null or duration_ms >= 0),
  add column if not exists width integer check (width is null or width > 0),
  add column if not exists height integer check (height is null or height > 0),
  add column if not exists thumbnail_path text,
  add column if not exists upload_state text not null default 'ready'
    check (upload_state in ('ready','failed'));

alter table public.rental_inspections
  add column if not exists evidence_version integer not null default 0,
  add column if not exists evidence_manifest jsonb,
  add column if not exists evidence_manifest_sha256 text,
  add column if not exists evidence_frozen_at timestamptz;

create or replace function public.rental_inspection_item_add(
  p_inspection_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_byte_size bigint,
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
  v_count integer;
  v_item public.rental_inspection_items%rowtype;
begin
  if uid is null then raise exception 'Sign in as the property owner.' using errcode='42501'; end if;
  select * into i from public.rental_inspections where id=p_inspection_id for update;
  if not found then raise exception 'That walkthrough was not found.' using errcode='22023'; end if;
  select * into c from public.rental_contracts where id=i.contract_id;
  if c.agent_id is distinct from uid then raise exception 'Only the owner can add walkthrough photos.' using errcode='42501'; end if;
  if i.state <> 'draft'::public.inspection_state then raise exception 'This evidence set is frozen. Start a correction round to change it.' using errcode='42501'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','image/heic','image/heif') then
    raise exception 'Only JPEG, PNG, WebP, HEIC and HEIF photos are supported. Video is not supported yet.' using errcode='22023';
  end if;
  if p_byte_size is null or p_byte_size < 1 or p_byte_size > 26214400 then
    raise exception 'Each photo must be 25 MiB or smaller.' using errcode='22023';
  end if;
  if p_storage_path not like c.id::text || '/' || uid::text || '/' || i.id::text || '/%' then
    raise exception 'That upload path does not belong to this walkthrough.' using errcode='42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id='rental-evidence' and o.name=p_storage_path) then
    raise exception 'The photo upload did not finish.' using errcode='22023';
  end if;
  select count(*)::integer into v_count from public.rental_inspection_items where inspection_id=i.id;
  if v_count >= 100 then raise exception 'A walkthrough can contain at most 100 photos.' using errcode='22023'; end if;

  insert into public.rental_inspection_items (
    inspection_id, ordinal, photo_url, host_note, added_by, added_by_role,
    media_kind, mime_type, byte_size, original_name, room, width, height, upload_state
  ) values (
    i.id, v_count + 1, p_storage_path, left(nullif(btrim(coalesce(p_caption,'')),''), 1000), uid, 'host',
    'image', p_mime_type, p_byte_size, left(p_original_name,255),
    left(nullif(btrim(coalesce(p_room,'')),''),120), p_width, p_height, 'ready'
  ) returning * into v_item;
  return v_item;
end
$function$;

create or replace function public.rental_inspection_item_update(
  p_item_id uuid, p_room text default null, p_caption text default null
)
returns public.rental_inspection_items
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_item public.rental_inspection_items%rowtype;
begin
  update public.rental_inspection_items item
     set room=left(nullif(btrim(coalesce(p_room,'')),''),120),
         host_note=left(nullif(btrim(coalesce(p_caption,'')),''),1000)
    from public.rental_inspections i, public.rental_contracts c
   where item.id=p_item_id and i.id=item.inspection_id and c.id=i.contract_id
     and c.agent_id=auth.uid() and i.state='draft'::public.inspection_state
  returning item.* into v_item;
  if not found then raise exception 'Only the owner can edit an unfrozen walkthrough.' using errcode='42501'; end if;
  return v_item;
end
$function$;

create or replace function public.rental_inspection_items_reorder(
  p_inspection_id uuid, p_item_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare i public.rental_inspections%rowtype; c public.rental_contracts%rowtype; v_count integer; v_id uuid; v_pos integer:=0;
begin
  select * into i from public.rental_inspections where id=p_inspection_id for update;
  if not found then raise exception 'That walkthrough was not found.' using errcode='22023'; end if;
  select * into c from public.rental_contracts where id=i.contract_id;
  if c.agent_id is distinct from auth.uid() or i.state <> 'draft'::public.inspection_state then
    raise exception 'Only the owner can reorder an unfrozen walkthrough.' using errcode='42501';
  end if;
  select count(*)::integer into v_count from public.rental_inspection_items where inspection_id=i.id;
  if coalesce(array_length(p_item_ids,1),0) <> v_count
     or (select count(distinct x) from unnest(p_item_ids) x) <> v_count
     or exists (select 1 from unnest(p_item_ids) x where not exists (
       select 1 from public.rental_inspection_items item where item.id=x and item.inspection_id=i.id)) then
    raise exception 'The new order must contain every walkthrough photo exactly once.' using errcode='22023';
  end if;
  update public.rental_inspection_items set ordinal=-ordinal where inspection_id=i.id;
  foreach v_id in array p_item_ids loop
    v_pos:=v_pos+1;
    update public.rental_inspection_items set ordinal=v_pos where id=v_id and inspection_id=i.id;
  end loop;
  return v_count;
end
$function$;

create or replace function public.rental_inspection_item_delete(p_item_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_path text; v_inspection uuid;
begin
  select item.photo_url, item.inspection_id into v_path, v_inspection
    from public.rental_inspection_items item
    join public.rental_inspections i on i.id=item.inspection_id
    join public.rental_contracts c on c.id=i.contract_id
   where item.id=p_item_id and c.agent_id=auth.uid() and i.state='draft'::public.inspection_state
   for update of item;
  if v_path is null then raise exception 'Only the owner can delete an unfrozen walkthrough photo.' using errcode='42501'; end if;
  delete from public.rental_inspection_items where id=p_item_id;
  with ranked as (
    select id,row_number() over(order by ordinal,id) rn
    from public.rental_inspection_items where inspection_id=v_inspection
  ) update public.rental_inspection_items item set ordinal=-ranked.rn from ranked where item.id=ranked.id;
  update public.rental_inspection_items set ordinal=-ordinal where inspection_id=v_inspection;
  return v_path;
end
$function$;

create or replace function public.rental_inspection_start_correction(p_inspection_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare old_i public.rental_inspections%rowtype; c public.rental_contracts%rowtype; new_i public.rental_inspections%rowtype;
begin
  select * into old_i from public.rental_inspections where id=p_inspection_id for update;
  if not found then raise exception 'That walkthrough was not found.' using errcode='22023'; end if;
  select * into c from public.rental_contracts where id=old_i.contract_id;
  if c.agent_id is distinct from auth.uid() then raise exception 'Only the owner can start a correction round.' using errcode='42501'; end if;
  if old_i.state <> 'tenant_responded'::public.inspection_state or not exists (
    select 1 from public.rental_inspection_items where inspection_id=old_i.id and verdict='disputed'::public.inspection_item_verdict
  ) then raise exception 'A correction round requires a tenant change request.' using errcode='22023'; end if;
  insert into public.rental_inspections(contract_id,property_id,round,kind,state,opened_by)
  values(old_i.contract_id,old_i.property_id,old_i.round+1,old_i.kind,'draft',auth.uid()) returning * into new_i;
  insert into public.rental_inspection_items(
    inspection_id,ordinal,photo_url,host_note,added_by,added_by_role,media_kind,mime_type,byte_size,
    original_name,room,duration_ms,width,height,thumbnail_path,upload_state
  ) select new_i.id,row_number() over(order by ordinal,id),photo_url,host_note,auth.uid(),'host',media_kind,mime_type,
    byte_size,original_name,room,duration_ms,width,height,thumbnail_path,'ready'
    from public.rental_inspection_items where inspection_id=old_i.id and verdict='agreed'::public.inspection_item_verdict
    order by ordinal,id;
  return new_i.id;
end
$function$;

revoke all on function public.rental_inspection_item_add(uuid,text,text,text,bigint,text,text,integer,integer) from public,anon;
revoke all on function public.rental_inspection_item_update(uuid,text,text) from public,anon;
revoke all on function public.rental_inspection_items_reorder(uuid,uuid[]) from public,anon;
revoke all on function public.rental_inspection_item_delete(uuid) from public,anon;
revoke all on function public.rental_inspection_start_correction(uuid) from public,anon;
grant execute on function public.rental_inspection_item_add(uuid,text,text,text,bigint,text,text,integer,integer) to authenticated,service_role;
grant execute on function public.rental_inspection_item_update(uuid,text,text) to authenticated,service_role;
grant execute on function public.rental_inspection_items_reorder(uuid,uuid[]) to authenticated,service_role;
grant execute on function public.rental_inspection_item_delete(uuid) to authenticated,service_role;
grant execute on function public.rental_inspection_start_correction(uuid) to authenticated,service_role;

-- Sending freezes a canonical evidence manifest. No item can be edited after this.
create or replace function public.rental_inspection_send(p_inspection_id uuid)
returns table(inspection_id uuid, contract_id uuid, share_token text, property_title text, inspection_state text, photo_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user uuid:=auth.uid(); v_inspection public.rental_inspections%rowtype; v_contract public.rental_contracts%rowtype;
  v_title text; v_count integer; v_manifest jsonb; v_hash text;
begin
  if v_user is null then raise exception 'Sign in before sending the walkthrough.' using errcode='42501'; end if;
  select * into v_inspection from public.rental_inspections where id=p_inspection_id for update;
  if not found then raise exception 'That walkthrough was not found.' using errcode='22023'; end if;
  select * into v_contract from public.rental_contracts where id=v_inspection.contract_id;
  if v_contract.agent_id <> v_user then raise exception 'Only the owner can send this walkthrough.' using errcode='42501'; end if;
  if v_inspection.kind <> 'move_in' then raise exception 'Only the move-in walkthrough can be sent here.' using errcode='22023'; end if;
  select count(*)::integer,
         jsonb_agg(jsonb_build_object('id',id,'ordinal',ordinal,'path',photo_url,'room',room,'caption',host_note,
           'mime_type',mime_type,'byte_size',byte_size) order by ordinal,id)
    into v_count,v_manifest from public.rental_inspection_items where rental_inspection_items.inspection_id=p_inspection_id;
  if v_count=0 then raise exception 'Add the walkthrough photos before sending them.' using errcode='22023'; end if;
  if exists(select 1 from public.rental_inspection_items where rental_inspection_items.inspection_id=p_inspection_id and upload_state<>'ready') then
    raise exception 'Resolve every failed or incomplete upload before sending.' using errcode='22023';
  end if;
  v_hash:=encode(digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  if v_inspection.state='draft'::public.inspection_state then
    update public.rental_inspections set state='awaiting_tenant'::public.inspection_state,
      sent_at=coalesce(sent_at,now()),host_done_at=coalesce(host_done_at,now()),
      evidence_version=greatest(round,1),evidence_manifest=v_manifest,evidence_manifest_sha256=v_hash,
      evidence_frozen_at=coalesce(evidence_frozen_at,now()) where id=p_inspection_id;
    v_inspection.state:='awaiting_tenant'::public.inspection_state;
  elsif v_inspection.state not in ('awaiting_tenant'::public.inspection_state,'tenant_responded'::public.inspection_state,'agreed'::public.inspection_state) then
    raise exception 'This walkthrough cannot be sent in its current state.' using errcode='22023';
  end if;
  select p.title into v_title from public.rental_properties p where p.id=v_contract.property_id;
  inspection_id:=v_inspection.id; contract_id:=v_contract.id; share_token:=v_contract.share_token;
  property_title:=coalesce(v_title,'your OneHome'); inspection_state:=v_inspection.state::text; photo_count:=v_count; return next;
end
$function$;

revoke all on function public.rental_inspection_send(uuid) from public,anon;
grant execute on function public.rental_inspection_send(uuid) to authenticated,service_role;

-- The existing receipt event guard remains append-only except inside the exact,
-- hard-coded QA reset transaction below.
create or replace function public.guard_rental_payment_receipt_events_immutable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
begin
  if current_setting('app.onehome_qa_reset',true)='10518' then return old; end if;
  raise exception 'OneHome receipt evidence is append-only and cannot be changed or deleted.' using errcode='42501';
end
$function$;

create or replace function public.onehome_qa_reset_10518(
  p_claim_id uuid, p_contract_id uuid, p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,storage,pg_temp
as $function$
declare claim public.rental_property_claims%rowtype; prop public.rental_properties%rowtype;
  contract public.rental_contracts%rowtype; v_paths text[]; v_user uuid;
begin
  select * into claim from public.rental_property_claims c where c.id=p_claim_id for update;
  if not found then raise exception 'The QA claim was not found.' using errcode='22023'; end if;
  select * into prop from public.rental_properties p where p.id=claim.property_id and p.listing_no=10518 for update;
  if not found or coalesce(claim.note,'') !~* '(safe|qa|test)' then
    raise exception 'Reset is restricted to the marked OneHome QA listing 10518.' using errcode='42501';
  end if;
  if claim.claimed_by is distinct from p_actor_id then raise exception 'Only the QA account that claimed this rehearsal can reset it.' using errcode='42501'; end if;
  select * into contract from public.rental_contracts where id=p_contract_id and source_claim_id=claim.id for update;
  if not found then raise exception 'The expected QA contract does not match listing 10518.' using errcode='22023'; end if;
  v_user:=claim.claimed_by;
  select coalesce(array_agg(item.photo_url order by item.photo_url),array[]::text[]) into v_paths
    from public.rental_inspection_items item join public.rental_inspections i on i.id=item.inspection_id
   where i.contract_id=contract.id and item.photo_url !~* '^https?://';
  perform set_config('app.onehome_qa_reset','10518',true);
  if contract.conversation_id is not null then
    delete from public.messages where conversation_id=contract.conversation_id
      and metadata->>'contract_id'=contract.id::text;
    delete from public.conversations where id=contract.conversation_id
      and metadata->>'contract_id'=contract.id::text
      and not exists(select 1 from public.messages where conversation_id=contract.conversation_id);
  end if;
  delete from public.rental_contracts where id=contract.id;
  delete from public.rental_owner_term_acceptances where claim_id=claim.id;
  update public.rental_properties set agent_id=claim.invited_by,updated_at=now() where id=prop.id;
  update public.rental_property_claims set invited_email=null,claimed_at=null,claimed_by=null,reviewed_by=null
    where id=claim.id;
  return jsonb_build_object('listing_no',10518,'claim_id',claim.id,'contract_id',contract.id,
    'qa_user_id',v_user,'storage_paths',v_paths,'restored_state','approved_unclaimed');
end
$function$;

revoke all on function public.onehome_qa_reset_10518(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.onehome_qa_reset_10518(uuid,uuid,uuid) to service_role;
