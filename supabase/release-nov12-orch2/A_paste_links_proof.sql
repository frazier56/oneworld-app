-- Release nov12-orch2 · Item A "Paste listing links" — ALREADY LIVE (found live on 12 Nov 2026):
--   DB migration onehome_listing_links_r1 · edge function listing-links v1 (verify_jwt true,
--   ezbr 237ad2bb…) · app bundle index-BcnCBkRh.js (oneworld-app main 270752999).
-- This is the re-verification run against the CURRENT live schema on 12 Nov 2026.
-- ROLLED-BACK PROOF ONLY: the block always ends in RAISE, so every write is undone. Nothing commits.
-- Result 12 Nov 2026: 12 of 12 true (rent + sale twins, dedupe, plan, own-site cap, grants, RLS).
do $$
declare u uuid; a jsonb; b jsonb; c jsonb; s jsonb; k text := 'fincaraiz.com.co/inmueble/apto-test-'||md5(random()::text);
 rr record; sr record; cnt int; e text; out text := '';
begin
  select id into u from public.profiles order by created_at limit 1;
  a := public.link_svc_import_listing(u,'rent',k,'{"title":"Apto test rent","price":"4500000","currency":"COP","photos":["https://x.test/a.jpg","http://bad/b.jpg"],"city":"Medellín","bedrooms":"2","bathrooms":"2","area_m2":"80","estrato":"4","property_type":"apartment","country_iso2":"CO","address_line":"Calle 1 # 2-3"}'::jsonb);
  select * into rr from public.rental_properties where id=(a->>'id')::uuid;
  out := out || E'\nrent draft row: '||(a->>'status'='created' and rr.status='draft' and rr.agent_id=u and rr.price=4500000 and rr.bedrooms=2 and array_length(rr.photos,1)=1 and rr.city='Medellín')::text;
  out := out || E'\nrent street address not on public row: '||(coalesce(rr.address_line,'')='')::text;
  b := public.link_svc_import_listing(u,'rent',k,'{"title":"again"}'::jsonb);
  out := out || E'\nrent dedupe: '||(b->>'status'='exists' and b->>'id'=a->>'id')::text;
  c := public.link_svc_import_listing(u,'sale',k,'{"title":"Casa test sale","price":"650000000","currency":"COP","photos":["https://x.test/s.jpg"],"city":"Envigado","bedrooms":"3","sale_kind":"house","property_type":"house","country_label":"Colombia","admin_fee_monthly":"350000"}'::jsonb);
  select * into sr from public.sale_properties where id=(c->>'id')::uuid;
  out := out || E'\nsale draft row: '||(c->>'status'='created' and sr.status='draft' and sr.agent_id=u and sr.asking_price=650000000 and sr.kind::text='house' and sr.city='Envigado' and sr.admin_fee_monthly=350000)::text;
  b := public.link_svc_import_listing(u,'sale',k,'{}'::jsonb);
  out := out || E'\nsale dedupe: '||(b->>'status'='exists' and b->>'id'=c->>'id')::text;
  s := public.link_svc_plan(u, jsonb_build_array(jsonb_build_object('url_key',k,'kind','rent'),jsonb_build_object('url_key',k,'kind','sale'),jsonb_build_object('url_key',k||'x','kind','rent')));
  out := out || E'\nplan reports rent+sale already, new key not: '||(jsonb_array_length(s->'already')=2)::text;
  perform public.link_svc_add_site(u,'www.Site-One.co'); perform public.link_svc_add_site(u,'site-two.com'); perform public.link_svc_add_site(u,'site-three.com.co');
  begin perform public.link_svc_add_site(u,'site-four.com'); e:='none'; exception when others then e:=sqlstate; end;
  out := out || E'\nfourth own site refused LK002: '||(e='LK002')::text;
  select count(*) into cnt from wasi_private.link_sites where user_id=u and host='site-one.co';
  out := out || E'\nwww stripped + lowercased: '||(cnt=1)::text;
  begin perform public.link_svc_add_site(u,'localhost'); e:='none'; exception when others then e:=sqlstate; end;
  out := out || E'\nbad host refused LK001: '||(e='LK001')::text;
  begin perform public.link_svc_import_listing(u,'lease',k,'{}'); e:='none'; exception when others then e:='raised'; end;
  out := out || E'\nbad kind refused: '||(e='raised')::text;
  out := out || E'\nmembers cannot execute service fns: '||(not has_function_privilege('authenticated','public.link_svc_import_listing(uuid,text,text,jsonb)','execute') and not has_function_privilege('anon','public.onehome_svc_insert_draft(uuid,text,jsonb)','execute') and not has_function_privilege('authenticated','public.link_svc_add_site(uuid,text)','execute'))::text;
  out := out || E'\nledger RLS on, no member grant: '||((select relrowsecurity from pg_class where oid='wasi_private.link_imported'::regclass) and not has_table_privilege('authenticated','wasi_private.link_imported','select'))::text;
  raise exception 'PROOF_RESULT (rolled back):%', out;
end $$;
