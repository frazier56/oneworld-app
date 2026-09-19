-- Valid only after preflight confirms these two names were absent before D07.
-- Removes only the D07 objects; never broadens ACLs or edits customer data.
begin;
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
   raise exception 'D07 object collision or drift; refusing rollback' using errcode='55000';
 end if;
end $preflight$;
drop trigger if exists enforce_listing_host_readiness on public.rental_properties;
drop function if exists rental_private.enforce_listing_host_readiness();
commit;
