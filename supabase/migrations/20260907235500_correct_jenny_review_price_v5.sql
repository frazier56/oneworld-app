-- Align Jenny's permanent review link with the agreed COP 9,000,000 rent.
-- Historical contracts, payment records and requests are intentionally untouched.
do $migration$
declare
  v_rows integer;
  v_oid oid;
  v_definition text;
begin
  update public.rental_properties
     set price = 9000000,
         updated_at = now()
   where listing_no = 10517
     and currency = 'COP'
     and price = 8600000;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Expected exactly one COP 8,600,000 listing #10517; updated % rows.', v_rows;
  end if;

  select p.oid into v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'rental_owner_terms_acknowledge_existing';
  if v_oid is null then
    raise exception 'Expected rental_owner_terms_acknowledge_existing function was not found.';
  end if;
  v_definition := pg_get_functiondef(v_oid);
  if position('COP 8,600,000 for each monthly rental period' in v_definition) = 0
     or position('onehome-property-owner-review-draft-2026-09-03-v4' in v_definition) = 0 then
    raise exception 'Expected OneHome property terms v4 acknowledgement definition was not found.';
  end if;
  v_definition := replace(
    v_definition,
    'COP 8,600,000 for each monthly rental period',
    'COP 9,000,000 for each monthly rental period'
  );
  v_definition := replace(
    v_definition,
    'onehome-property-owner-review-draft-2026-09-03-v4',
    'onehome-property-owner-review-draft-2026-09-07-v5'
  );
  execute v_definition;

  select p.oid into v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'rental_listing_review_submit';
  if v_oid is null then
    raise exception 'Expected rental_listing_review_submit function was not found.';
  end if;
  v_definition := pg_get_functiondef(v_oid);
  if position('COP 9,000,000 for each monthly rental period' in v_definition) = 0
     or position('onehome-property-owner-review-draft-2026-09-01-v3' in v_definition) = 0 then
    raise exception 'Expected OneHome property terms v3 review definition was not found.';
  end if;
  v_definition := replace(
    v_definition,
    'onehome-property-owner-review-draft-2026-09-01-v3',
    'onehome-property-owner-review-draft-2026-09-07-v5'
  );
  execute v_definition;
end
$migration$;
