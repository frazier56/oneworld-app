-- OneHome first-rent receipt confirmation.
-- The landlord starts the lease by confirming receipt and may reverse that confirmation
-- for 24 hours. Every confirmation and reversal is append-only evidence.

create table if not exists public.rental_payment_receipt_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  event_kind text not null check (event_kind in ('confirmed', 'reversed')),
  confirmation_id uuid null references public.rental_payment_receipt_events(id),
  actor_id uuid not null references public.profiles(id),
  note text null,
  created_at timestamptz not null default now(),
  reversal_deadline timestamptz null,
  constraint rental_payment_receipt_event_shape_ck check (
    (event_kind = 'confirmed' and confirmation_id is null and reversal_deadline is not null)
    or
    (event_kind = 'reversed' and confirmation_id is not null and reversal_deadline is null)
  )
);

create unique index if not exists rental_payment_receipt_one_reversal_idx
  on public.rental_payment_receipt_events(confirmation_id)
  where event_kind = 'reversed';

create index if not exists rental_payment_receipt_contract_time_idx
  on public.rental_payment_receipt_events(contract_id, created_at desc);

comment on table public.rental_payment_receipt_events is
  'Append-only evidence of landlord receipt confirmations and their 24-hour reversals.';

create or replace function public.guard_rental_payment_receipt_events_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  raise exception 'OneHome receipt evidence is append-only and cannot be changed or deleted.'
    using errcode = '42501';
end
$function$;

drop trigger if exists trg_rental_payment_receipt_events_immutable
  on public.rental_payment_receipt_events;
create trigger trg_rental_payment_receipt_events_immutable
before update or delete on public.rental_payment_receipt_events
for each row execute function public.guard_rental_payment_receipt_events_immutable();

alter table public.rental_payment_receipt_events enable row level security;
drop policy if exists rental_payment_receipt_parties_read
  on public.rental_payment_receipt_events;
create policy rental_payment_receipt_parties_read
on public.rental_payment_receipt_events
for select to authenticated
using (
  exists (
    select 1
    from public.rental_contracts c
    where c.id = contract_id
      and auth.uid() in (c.agent_id, c.tenant_id)
  )
);

revoke all on public.rental_payment_receipt_events from public, anon, authenticated;
grant select on public.rental_payment_receipt_events to authenticated;

-- Preserve the audited contract guard and add one narrowly proven reverse transition.
-- The reverse RPC inserts the exact immutable reversal event first, then sets both
-- transaction-local identifiers. A direct client table update cannot satisfy this branch.
do $migration$
declare
  v_definition text;
  v_needle text := $needle$        or (old.status = 'awaiting_first_payment' and new.status = 'active' and is_agent
            and new.first_payment_route = 'outside'
            and new.first_payment_at is not null
            and new.first_payment_marked_by = uid)
$needle$;
  v_replacement text := $replacement$        or (old.status = 'awaiting_first_payment' and new.status = 'active' and is_agent
            and new.first_payment_route = 'outside'
            and new.first_payment_at is not null
            and new.first_payment_marked_by = uid)
        -- A receipt confirmation can be reversed for 24 hours only through the audited RPC.
        or (old.status = 'active' and new.status = 'awaiting_first_payment' and is_agent
            and current_setting('app.rental_receipt_reversal_contract', true) = old.id::text
            and exists (
              select 1
              from public.rental_payment_receipt_events receipt_event
              where receipt_event.id::text = current_setting('app.rental_receipt_reversal_event', true)
                and receipt_event.contract_id = old.id
                and receipt_event.event_kind = 'reversed'
                and receipt_event.actor_id = uid
            ))
$replacement$;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'guard_rental_contract_roles'
    and pg_get_function_identity_arguments(p.oid) = '';

  if v_definition is null or position(v_needle in v_definition) = 0 then
    raise exception 'The rental contract guard did not match the reviewed production definition.';
  end if;
  if position(v_replacement in v_definition) > 0 then
    return;
  end if;

  execute replace(v_definition, v_needle, v_replacement);
end
$migration$;

create or replace function public.rental_payment_confirm(
  p_contract_id uuid,
  p_accept boolean default true,
  p_note text default null
)
returns table(contract_id uuid, new_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  c public.rental_contracts%rowtype;
  uid uuid := auth.uid();
  v_confirmation_id uuid;
begin
  if uid is null then
    raise exception 'Sign in as the landlord to confirm a payment.' using errcode = '42501';
  end if;

  select * into c
  from public.rental_contracts
  where id = p_contract_id
  for update;

  if not found then
    raise exception 'Agreement not found.' using errcode = '22023';
  end if;
  if c.agent_id <> uid then
    raise exception 'Only the landlord can confirm the rent arrived.' using errcode = '42501';
  end if;
  if c.status <> 'awaiting_first_payment' then
    raise exception 'This agreement is not waiting on a first payment (it is %).', c.status
      using errcode = '22023';
  end if;

  if p_accept is false then
    update public.rental_contracts
       set first_payment_claimed_at = null,
           first_payment_claimed_by = null,
           first_payment_rail = null,
           first_payment_reference = null,
           first_payment_claim_note = null,
           updated_at = now()
     where id = c.id;

    perform public.notify_rental(c.tenant_id, 'rental_payment_not_received',
      'The landlord has not seen the payment yet',
      coalesce(nullif(btrim(coalesce(p_note, '')), ''),
               'Check the details and let them know again once it is on its way.'),
      '/rentals/inspection/' || c.share_token);

    contract_id := c.id;
    new_status := c.status::text;
    return next;
    return;
  end if;

  if c.first_payment_claimed_at is null then
    raise exception 'The tenant has not said they sent it yet. Ask them to mark it sent first.'
      using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.rental_inspections i
    where i.contract_id = c.id
      and i.kind = 'move_in'
      and i.state = 'agreed'
  ) then
    raise exception 'The move-in walkthrough must be approved before the rent can be confirmed.'
      using errcode = '22023';
  end if;

  insert into public.rental_payment_receipt_events (
    contract_id, event_kind, actor_id, note, reversal_deadline
  ) values (
    c.id, 'confirmed', uid,
    nullif(btrim(coalesce(p_note, '')), ''),
    now() + interval '24 hours'
  )
  returning id into v_confirmation_id;

  update public.rental_contracts
     set status = 'active'::public.rental_contract_status,
         first_payment_route = coalesce(first_payment_route, 'outside'),
         first_payment_at = coalesce(first_payment_at, now()),
         first_payment_marked_by = coalesce(first_payment_marked_by, uid),
         first_payment_note = coalesce(
           first_payment_note,
           nullif(btrim(coalesce(p_note, '')), '')
         ),
         activated_at = now(),
         fee_waived_at = coalesce(fee_waived_at, now()),
         fee_waived_reason = coalesce(
           fee_waived_reason,
           'Paid outside the contract. OneHome does not charge a commission or a transaction fee on money it never touched.'
         ),
         updated_at = now()
   where id = c.id;

  perform public.notify_rental(uid, 'rental_payment_receipt_confirmed',
    'Receipt confirmed',
    'The lease is active. You can reverse this confirmation for 24 hours if you tapped it by mistake.',
    '/rentals/c/' || c.id::text);

  contract_id := c.id;
  new_status := 'active';
  return next;
end
$function$;

create or replace function public.rental_payment_receipt_reverse(
  p_contract_id uuid,
  p_note text default null
)
returns table(contract_id uuid, new_status text, reversed_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  c public.rental_contracts%rowtype;
  uid uuid := auth.uid();
  v_confirmation public.rental_payment_receipt_events%rowtype;
  v_reversal_id uuid;
  v_now timestamptz := now();
begin
  if uid is null then
    raise exception 'Sign in as the landlord to reverse a receipt confirmation.' using errcode = '42501';
  end if;

  select * into c
  from public.rental_contracts
  where id = p_contract_id
  for update;

  if not found then
    raise exception 'Agreement not found.' using errcode = '22023';
  end if;
  if c.agent_id <> uid then
    raise exception 'Only the landlord can reverse their receipt confirmation.' using errcode = '42501';
  end if;
  if c.status <> 'active' then
    raise exception 'This lease does not have an active receipt confirmation.' using errcode = '22023';
  end if;

  select confirmed.* into v_confirmation
  from public.rental_payment_receipt_events confirmed
  where confirmed.contract_id = c.id
    and confirmed.event_kind = 'confirmed'
    and not exists (
      select 1
      from public.rental_payment_receipt_events reversed
      where reversed.event_kind = 'reversed'
        and reversed.confirmation_id = confirmed.id
    )
  order by confirmed.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No reversible receipt confirmation was found.' using errcode = '22023';
  end if;
  if v_now > v_confirmation.reversal_deadline then
    raise exception 'The 24-hour reversal window has closed.' using errcode = '22023';
  end if;

  insert into public.rental_payment_receipt_events (
    contract_id, event_kind, confirmation_id, actor_id, note
  ) values (
    c.id, 'reversed', v_confirmation.id, uid,
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_reversal_id;

  perform set_config('app.rental_receipt_reversal_contract', c.id::text, true);
  perform set_config('app.rental_receipt_reversal_event', v_reversal_id::text, true);

  update public.rental_contracts
     set status = 'awaiting_first_payment'::public.rental_contract_status,
         activated_at = null,
         updated_at = v_now
   where id = c.id;

  perform public.notify_rental(c.tenant_id, 'rental_payment_receipt_reversed',
    'The receipt confirmation was reversed',
    coalesce(nullif(btrim(coalesce(p_note, '')), ''),
             'The landlord reversed the confirmation within the 24-hour correction window. The lease is waiting on receipt confirmation again.'),
    '/rentals/inspection/' || c.share_token);

  contract_id := c.id;
  new_status := 'awaiting_first_payment';
  reversed_at := v_now;
  return next;
end
$function$;

create or replace function public.rental_owner_handoff_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  uid uuid := auth.uid();
  v_result jsonb;
begin
  if uid is null then
    raise exception 'Sign in as the property owner.' using errcode = '42501';
  end if;
  if p_token !~ '^[0-9a-fA-F]{48}$' then
    raise exception 'That owner link is not valid.' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'property_id', p.id,
    'property_title', p.title,
    'contract_id', c.id,
    'inspection_id', i.id,
    'share_token', c.share_token,
    'inspection_state', i.state,
    'contract_status', c.status,
    'rent_amount', c.rent_amount,
    'currency', c.currency,
    'payment_rail', c.first_payment_rail,
    'payment_reference', c.first_payment_reference,
    'payment_claim_note', c.first_payment_claim_note,
    'payment_claimed_at', c.first_payment_claimed_at,
    'receipt', case when receipt.id is null then null else jsonb_build_object(
      'id', receipt.id,
      'confirmed_at', receipt.created_at,
      'reversal_deadline', receipt.reversal_deadline,
      'can_reverse', c.status = 'active' and now() <= receipt.reversal_deadline
    ) end
  )
  into v_result
  from public.rental_property_claims claim
  join public.rental_properties p on p.id = claim.property_id
  join public.rental_contracts c on c.source_claim_id = claim.id
  left join lateral (
    select inspection.*
    from public.rental_inspections inspection
    where inspection.contract_id = c.id
      and inspection.kind = 'move_in'
    order by inspection.round desc
    limit 1
  ) i on true
  left join lateral (
    select confirmed.*
    from public.rental_payment_receipt_events confirmed
    where confirmed.contract_id = c.id
      and confirmed.event_kind = 'confirmed'
      and not exists (
        select 1
        from public.rental_payment_receipt_events reversed
        where reversed.event_kind = 'reversed'
          and reversed.confirmation_id = confirmed.id
      )
    order by confirmed.created_at desc
    limit 1
  ) receipt on true
  where lower(claim.claim_token) = lower(p_token)
    and claim.claimed_by = uid
    and c.agent_id = uid
  limit 1;

  if v_result is null then
    raise exception 'This owner handoff is not connected to your account.' using errcode = '42501';
  end if;
  return v_result;
end
$function$;

revoke all on function public.rental_payment_receipt_reverse(uuid, text) from public, anon;
grant execute on function public.rental_payment_receipt_reverse(uuid, text) to authenticated, service_role;

revoke all on function public.rental_owner_handoff_status(text) from public, anon;
grant execute on function public.rental_owner_handoff_status(text) to authenticated, service_role;

revoke all on function public.rental_payment_confirm(uuid, boolean, text) from public, anon;
grant execute on function public.rental_payment_confirm(uuid, boolean, text) to authenticated, service_role;

