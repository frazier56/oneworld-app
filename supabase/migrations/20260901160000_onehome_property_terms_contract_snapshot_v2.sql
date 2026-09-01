-- Keep the stored owner acceptance aligned with the full property terms shown
-- in the public review flow. The prior signed contract is a source document,
-- not a template: obsolete prices, deposit, private data and one-off terms are
-- intentionally excluded from this current listing snapshot.

create or replace function public.rental_listing_review_submit(
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
set search_path = public, extensions, pg_temp
as $function$
declare
  c public.rental_property_claims;
  p public.rental_properties;
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_platform_snapshot constant text := 'I agree to the OneWorld / OneHome platform terms for account use, privacy, electronic records and signatures, messaging, fees, payment-record status, support and disputes. OneWorld provides the platform and is not the property owner or a party supplying the property.';
  v_property_snapshot constant text := 'Property-owner supplemental terms review snapshot for listings 10517 and 10518: Current terms are COP 9,000,000 for each monthly rental period, a separate one-time COP 300,000 cleaning charge when the lease starts, and no security deposit. The start date and tenant identity are added to the tenant packet. Continuing property rules from the prior five-page contract are residential lawful use only; furnished property and furniture returned in the move-in-documented condition subject to ordinary wear; owner responsibility for necessary or structural repairs; tenant responsibility for damage caused by the tenant or guests and written repair reporting; water, electricity, gas, internet, television and building administration included, with tenant-requested extras paid by the tenant; no alterations, assignment or subletting without prior written owner approval; temporary travel is not abandonment while rent is current and belongings remain; a support animal is allowed with the tenant responsible for animal-caused damage; after twelve months, any annual adjustment follows the prior contract CPI approach; and lawful late-payment and breach remedies remain subject to the final lease and applicable law. Excluded as obsolete or private are old dates and rent amounts, the deposit, bank and payee details, the portable-air-conditioner arrangement, signatures, identity numbers and contact details. This is a separate review acknowledgment and does not sign the final lease.';
  v_platform_version constant text := 'oneworld-platform-owner-review-2026-09-01';
  v_property_version constant text := 'onehome-property-owner-review-draft-2026-09-01-v2';
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

  select * into c
    from public.rental_property_claims
   where claim_token = btrim(coalesce(p_token,''))
   limit 1
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
set search_path = public, extensions, pg_temp
as $function$
declare
  c public.rental_property_claims%rowtype;
  p public.rental_properties%rowtype;
  v_name text := btrim(coalesce(p_name,''));
  v_platform_snapshot constant text := 'I agree to the OneWorld / OneHome platform terms for account use, privacy, electronic records and signatures, messaging, fees, payment-record status, support and disputes. OneWorld provides the platform and is not the property owner or a party supplying the property.';
  v_property_snapshot constant text := 'Property-owner supplemental terms review snapshot for listings 10517 and 10518: Current terms are COP 9,000,000 for each monthly rental period, a separate one-time COP 300,000 cleaning charge when the lease starts, and no security deposit. The start date and tenant identity are added to the tenant packet. Continuing property rules from the prior five-page contract are residential lawful use only; furnished property and furniture returned in the move-in-documented condition subject to ordinary wear; owner responsibility for necessary or structural repairs; tenant responsibility for damage caused by the tenant or guests and written repair reporting; water, electricity, gas, internet, television and building administration included, with tenant-requested extras paid by the tenant; no alterations, assignment or subletting without prior written owner approval; temporary travel is not abandonment while rent is current and belongings remain; a support animal is allowed with the tenant responsible for animal-caused damage; after twelve months, any annual adjustment follows the prior contract CPI approach; and lawful late-payment and breach remedies remain subject to the final lease and applicable law. Excluded as obsolete or private are old dates and rent amounts, the deposit, bank and payee details, the portable-air-conditioner arrangement, signatures, identity numbers and contact details. This is a separate review acknowledgment and does not sign the final lease.';
  v_platform_version constant text := 'oneworld-platform-owner-review-2026-09-01';
  v_property_version constant text := 'onehome-property-owner-review-draft-2026-09-01-v2';
begin
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'please type your name' using errcode = '22004';
  end if;
  if not coalesce(p_platform_terms_accepted,false) or not coalesce(p_property_terms_accepted,false) then
    raise exception 'review and accept both terms sections separately' using errcode = '22004';
  end if;
  if p_platform_terms_version is distinct from v_platform_version
     or p_property_terms_version is distinct from v_property_version then
    raise exception 'the terms version changed; review it again' using errcode = '22004';
  end if;

  select * into c
    from public.rental_property_claims
   where claim_token = btrim(coalesce(p_token,''))
   for update;
  if not found then raise exception 'link not recognised' using errcode = 'P0002'; end if;
  select * into p from public.rental_properties where id = c.property_id;
  if p.listing_no <> 10518 or coalesce(c.note,'') !~* '(safe|qa|test)' then
    raise exception 'existing-approval acknowledgement is restricted to QA listing 10518' using errcode = '42501';
  end if;
  if c.review_decision <> 'approved' or c.claimed_at is not null
     or c.revoked_at is not null or c.expires_at <= now() then
    raise exception 'this approved QA link is not ready for acknowledgement' using errcode = '42501';
  end if;

  insert into public.rental_owner_term_acceptances (
    claim_id, acceptance_kind, document_version, document_sha256,
    document_snapshot, signer_name, locale, ip_hash, user_agent
  ) values
    (c.id, 'platform_terms', v_platform_version,
     encode(digest(convert_to(v_platform_snapshot,'UTF8'),'sha256'),'hex'),
     v_platform_snapshot, v_name, left(coalesce(nullif(p_locale,''),'en'),12),
     nullif(p_ip_hash,''), left(nullif(p_user_agent,''),1000)),
    (c.id, 'property_owner_terms', v_property_version,
     encode(digest(convert_to(v_property_snapshot,'UTF8'),'sha256'),'hex'),
     v_property_snapshot, v_name, left(coalesce(nullif(p_locale,''),'en'),12),
     nullif(p_ip_hash,''), left(nullif(p_user_agent,''),1000))
  on conflict (claim_id, acceptance_kind) do nothing;

  return jsonb_build_object(
    'acknowledged', true,
    'claim_id', c.id,
    'platform_terms_version', v_platform_version,
    'property_terms_version', v_property_version
  );
end
$function$;

revoke all on function public.rental_listing_review_submit(
  text,text,text,text,boolean,boolean,text,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.rental_listing_review_submit(
  text,text,text,text,boolean,boolean,text,text,text,text,text
) to service_role;

revoke all on function public.rental_owner_terms_acknowledge_existing(
  text,text,boolean,boolean,text,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.rental_owner_terms_acknowledge_existing(
  text,text,boolean,boolean,text,text,text,text,text
) to service_role;
