-- pgcrypto is installed in the extensions schema. Keep the locked search path
-- explicit while making the evidence-manifest digest available.
alter function public.rental_inspection_send_v2(uuid)
  set search_path = public, storage, extensions, pg_temp;
