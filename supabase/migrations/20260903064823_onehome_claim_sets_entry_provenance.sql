create or replace function public.rental_claim_property(p_token text)
returns table(
  property_id uuid,
  property_title text,
  contract_id uuid,
  inspection_id uuid,
  share_token text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  c public.rental_property_claims%rowtype;
  p public.rental_properties%rowtype;
  v_uid uuid := auth.uid();
  v_email text;
  v_tenant_name text;
  v_tenant_email text;
  v_start date;
  v_term_days integer;
  v_contract public.rental_contracts%rowtype;
  v_inspection public.rental_inspections%rowtype;
begin
  if v_uid is null then
    raise exception 'Create your account or sign in first, then open this link again.'
      using errcode = '42501';
  end if;
  if coalesce(p_token, '') !~ '^[0-9a-f]{48}$' then
    raise exception 'That invitation is not valid.' using errcode = '22023';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null then
    raise exception 'Your account needs an email address before it can claim this home.'
      using errcode = '42501';
  end if;

  select * into c
    from public.rental_property_claims
   where claim_token = p_token and revoked_at is null
   for update;
  if not found then
    raise exception 'That invitation is not valid.' using errcode = '22023';
  end if;
  if c.expires_at < now() then
    raise exception 'That invitation has expired. Ask for a new one.' using errcode = '22023';
  end if;
  if c.review_decision is distinct from 'approved' then
    raise exception 'Approve the listing before creating the owner account.' using errcode = '42501';
  end if;
  if c.invited_by = v_uid then
    raise exception 'This listing is already yours.' using errcode = '22023';
  end if;
  if c.invited_email is not null and lower(c.invited_email) is distinct from v_email then
    raise exception 'This invitation was sent to a different email address. Sign in with that address.'
      using errcode = '42501';
  end if;

  -- Entry provenance is immutable to browser roles. Record it here only after
  -- the authenticated user and invitation have both passed the claim checks.
  update public.profiles pr
     set entry_product = coalesce(pr.entry_product, 'onerental'),
         entry_at = coalesce(pr.entry_at, now()),
         updated_at = now()
   where pr.id = v_uid;

  -- A reload after a successful claim returns the same handoff instead of duplicating it.
  if c.claimed_at is not null then
    if c.claimed_by is distinct from v_uid then
      raise exception 'This listing has already been claimed.' using errcode = '22023';
    end if;
    select * into v_contract
      from public.rental_contracts rc
     where rc.source_claim_id = c.id;
    if found then
      select * into v_inspection
        from public.rental_inspections ri
       where ri.contract_id = v_contract.id and ri.kind = 'move_in' and ri.round = 1;
      return query select c.property_id, coalesce((select rp.title from public.rental_properties rp where rp.id = c.property_id), ''),
        v_contract.id, v_inspection.id, v_contract.share_token;
      return;
    end if;
    -- A pre-migration claim can have ownership but no lease. Continue once and repair it.
  end if;

  select * into p from public.rental_properties rp where rp.id = c.property_id for update;
  if not found then
    raise exception 'That listing no longer exists.' using errcode = 'P0002';
  end if;

  select nullif(btrim(pr.full_name), ''), nullif(lower(btrim(pr.email)), '')
    into v_tenant_name, v_tenant_email
    from public.profiles pr where pr.id = c.invited_by;

  v_start := coalesce(p.available_from, current_date);
  v_term_days := greatest(
    coalesce(p.min_term_days, 1),
    case p.bill_interval::text
      when 'years' then 365 * greatest(p.bill_interval_count, 1)
      when 'months' then 30 * greatest(p.bill_interval_count, 1)
      when 'weeks' then 7 * greatest(p.bill_interval_count, 1)
      else greatest(p.bill_interval_count, 1)
    end
  );

  update public.rental_property_claims x
     set invited_email = coalesce(x.invited_email, v_email),
         reviewed_by = coalesce(x.reviewed_by, v_uid),
         claimed_at = now(),
         claimed_by = v_uid
   where x.id = c.id;

  update public.rental_properties rp
     set agent_id = v_uid, updated_at = now()
   where rp.id = c.property_id;

  insert into public.rental_contracts (
    property_id, agent_id, tenant_id, tenant_name, tenant_email,
    starts_on, ends_on, bill_interval, bill_interval_count,
    rent_amount, currency, deposit_required, deposit_amount,
    status, inspection_order, inspection_order_chosen_at,
    source_claim_id, terms_extra
  ) values (
    p.id, v_uid, c.invited_by, v_tenant_name, v_tenant_email,
    v_start, v_start + v_term_days, p.bill_interval, p.bill_interval_count,
    p.price, p.currency, p.deposit_required, p.deposit_amount,
    'draft', 'inspect_first', now(),
    c.id,
    jsonb_build_object(
      'source', 'approved_owner_review',
      'listing_no', p.listing_no,
      'minimum_term_days', p.min_term_days,
      'move_in_fee', p.move_in_fee,
      'move_in_fee_note', p.move_in_fee_note,
      'utilities_included', p.utilities_included
    )
  ) returning * into v_contract;

  insert into public.rental_inspections (
    contract_id, property_id, round, kind, state, opened_by
  ) values (
    v_contract.id, p.id, 1, 'move_in', 'draft', v_uid
  ) returning * into v_inspection;

  perform public.notify_rental(
    c.invited_by,
    'rental_listing_claimed',
    'Your listing has a new owner',
    p.title || ' was claimed by ' || v_email || '. The owner can now review the walkthrough photos.',
    '/rentals'
  );

  return query select p.id, p.title, v_contract.id, v_inspection.id, v_contract.share_token;
end
$function$;
