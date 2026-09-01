-- The source contract contains individualized and legally unresolved clauses.
-- Keep those clauses visible as pending decisions, but outside the accepted
-- property-owner snapshot. This migration follows the v2 definition migration
-- and makes a checked acknowledgment record only the settled review terms.

do $migration$
declare
  v_oid oid;
  v_definition text;
  v_old_snapshot constant text := 'Property-owner supplemental terms review snapshot for listings 10517 and 10518: Current terms are COP 9,000,000 for each monthly rental period, a separate one-time COP 300,000 cleaning charge when the lease starts, and no security deposit. The start date and tenant identity are added to the tenant packet. Continuing property rules from the prior five-page contract are residential lawful use only; furnished property and furniture returned in the move-in-documented condition subject to ordinary wear; owner responsibility for necessary or structural repairs; tenant responsibility for damage caused by the tenant or guests and written repair reporting; water, electricity, gas, internet, television and building administration included, with tenant-requested extras paid by the tenant; no alterations, assignment or subletting without prior written owner approval; temporary travel is not abandonment while rent is current and belongings remain; a support animal is allowed with the tenant responsible for animal-caused damage; after twelve months, any annual adjustment follows the prior contract CPI approach; and lawful late-payment and breach remedies remain subject to the final lease and applicable law. Excluded as obsolete or private are old dates and rent amounts, the deposit, bank and payee details, the portable-air-conditioner arrangement, signatures, identity numbers and contact details. This is a separate review acknowledgment and does not sign the final lease.';
  v_new_snapshot constant text := 'Property-owner supplemental terms review snapshot for listings 10517 and 10518: Current terms are COP 9,000,000 for each monthly rental period, a separate one-time COP 300,000 cleaning charge when the lease starts, and no security deposit. The start date and tenant identity are added to the tenant packet. Settled continuing property rules from the prior five-page contract are residential lawful use only; furnished property and furniture returned in the move-in-documented condition subject to ordinary wear; owner responsibility for necessary or structural repairs; tenant responsibility for damage caused by the tenant or guests and written repair reporting; water, electricity, gas, internet, television and building administration included, with tenant-requested extras paid by the tenant; no alterations, assignment or subletting without prior written owner approval; and temporary travel not treated as abandonment while rent is current and belongings remain. Not accepted by this snapshot are cancellation and notice periods, annual rent adjustments, late-payment interest, penalties and collection costs, repainting beyond ordinary wear, owner entry after alleged abandonment, support-animal wording, or any deposit or replacement security; these require a separate final decision before lease signature. Excluded as obsolete or private are old dates and rent amounts, the deposit, bank and payee details, the portable-air-conditioner arrangement, signatures, identity numbers and contact details. This is a separate review acknowledgment and does not sign the final lease.';
begin
  for v_oid in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('rental_listing_review_submit', 'rental_owner_terms_acknowledge_existing')
  loop
    v_definition := pg_get_functiondef(v_oid);
    if position(v_old_snapshot in v_definition) = 0
       or position('onehome-property-owner-review-draft-2026-09-01-v2' in v_definition) = 0 then
      raise exception 'Expected OneHome property terms v2 definition was not found.';
    end if;
    v_definition := replace(v_definition, v_old_snapshot, v_new_snapshot);
    v_definition := replace(
      v_definition,
      'onehome-property-owner-review-draft-2026-09-01-v2',
      'onehome-property-owner-review-draft-2026-09-01-v3'
    );
    execute v_definition;
  end loop;
end
$migration$;
