-- D07: private drafts remain governed by existing owner RLS. No customer rows modified.
-- Predicate matches rental_host_profile_readiness catalogue captured 2026-09-19,
-- evaluated for NEW.agent_id rather than the caller (including definer RPC writes).
begin;
-- Serialize this migration and its rollback; refuse absent/present mismatches or peer edits.
select pg_advisory_xact_lock(13053419);
do $preflight$
declare f oid := to_regprocedure('rental_private.enforce_listing_host_readiness()'); t record;
begin
 select * into t from pg_trigger where tgrelid='public.rental_properties'::regclass and tgname='enforce_listing_host_readiness';
 if f is null and not found then return; end if;
 if f is null or t.oid is null or t.tgfoid<>f or t.tgenabled<>'A'
   or pg_get_triggerdef(t.oid)<>'CREATE TRIGGER enforce_listing_host_readiness BEFORE INSERT OR UPDATE ON public.rental_properties FOR EACH ROW EXECUTE FUNCTION rental_private.enforce_listing_host_readiness()'
   or not exists(select 1 from pg_proc p where p.oid=f and p.proowner='postgres'::regrole
     and p.proacl::text='{postgres=X/postgres}' and md5(pg_get_functiondef(p.oid))='e33a9f1a725b200671dc9fc4dbc864c1') then
   raise exception 'D07 object collision or drift; refusing replacement' using errcode='55000';
 end if;
end $preflight$;
create or replace function rental_private.enforce_listing_host_readiness()
returns trigger language plpgsql security definer set search_path = ''
as $guard$
declare ready boolean;
begin
  if new.status is distinct from 'published' then return new; end if;
  select
    h.user_id is not null
    and nullif(trim(h.legal_name),'') is not null
    and nullif(trim(h.document_number),'') is not null
    and exists(select 1 from storage.objects o
      where o.bucket_id='rental-host-identity'
      and o.name=h.identity_storage_path
      and (storage.foldername(o.name))[1]=new.agent_id::text)
    and nullif(trim(h.private_address_line),'') is not null
    and nullif(trim(h.private_city),'') is not null
    and (coalesce(s.payouts_enabled,false)
      or exists(select 1 from public.payment_methods pm
        where pm.user_id=new.agent_id and pm.method_type in ('wise','paypal'))
      or h.manual_payout_confirmed_at is not null)
  into ready
  from public.rental_host_profiles h
  left join public.stripe_connect_accounts s on s.user_id=h.user_id
  where h.user_id=new.agent_id;
  if ready is distinct from true then
    raise exception 'Complete the listing host profile before publishing. Your draft can remain private.'
      using errcode='OH002';
  end if;
  return new;
end
$guard$;
revoke all on function rental_private.enforce_listing_host_readiness() from public,anon,authenticated,service_role;
drop trigger if exists enforce_listing_host_readiness on public.rental_properties;
create trigger enforce_listing_host_readiness before insert or update on public.rental_properties
for each row execute function rental_private.enforce_listing_host_readiness();
-- No role-based bypass: system/definer writers must also reference a ready listing host.
alter table public.rental_properties enable always trigger enforce_listing_host_readiness;
commit;
