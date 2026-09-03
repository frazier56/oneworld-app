-- Keep the existing-approval acknowledgement narrowly scoped while adding the
-- reserved user-UAT fixture (10519) and its separate internal regression fixture
-- (10520). This function remains service-role-only and retains every token,
-- decision, expiry and claim-state guard.
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
  v_property_snapshot constant text := 'Property-owner supplemental terms review snapshot for listings 10517 and 10518: Current terms are COP 9,000,000 for each monthly rental period, a separate one-time COP 300,000 cleaning charge when the lease starts, and no security deposit. The start date and tenant identity are added to the tenant packet. Settled continuing property rules from the prior five-page contract are residential lawful use only; furnished property and furniture returned in the move-in-documented condition subject to ordinary wear; owner responsibility for necessary or structural repairs; tenant responsibility for damage caused by the tenant or guests and written repair reporting; water, electricity, gas, internet, television and building administration included, with tenant-requested extras paid by the tenant; no alterations, assignment or subletting without prior written owner approval; and temporary travel not treated as abandonment while rent is current and belongings remain. Not accepted by this snapshot are cancellation and notice periods, annual rent adjustments, late-payment interest, penalties and collection costs, repainting beyond ordinary wear, owner entry after alleged abandonment, support-animal wording, or any deposit or replacement security; these require a separate final decision before lease signature. Excluded as obsolete or private are old dates and rent amounts, the deposit, bank and payee details, the portable-air-conditioner arrangement, signatures, identity numbers and contact details. This is a separate review acknowledgment and does not sign the final lease.';
  v_platform_version constant text := 'oneworld-platform-owner-review-2026-09-01';
  v_property_version constant text := 'onehome-property-owner-review-draft-2026-09-01-v3';
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
  if p.listing_no not in (10517, 10518, 10519, 10520) then
    raise exception 'existing-approval acknowledgement is restricted to the current owner handoff listings' using errcode = '42501';
  end if;
  if c.review_decision <> 'approved' or c.claimed_at is not null
     or c.revoked_at is not null or c.expires_at <= now() then
    raise exception 'this approved owner link is not ready for acknowledgement' using errcode = '42501';
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

revoke all on function public.rental_owner_terms_acknowledge_existing(
  text,text,boolean,boolean,text,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.rental_owner_terms_acknowledge_existing(
  text,text,boolean,boolean,text,text,text,text,text
) to service_role;
