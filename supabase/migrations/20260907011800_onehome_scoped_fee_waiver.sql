-- OneHome: an auditable, single-use zero-platform-fee exception for one exact rental request.
-- The waiver is resolved and consumed server-side at request creation so clients cannot choose
-- their own rates or reuse the exception for a later month.

create table if not exists rental_private.fee_waivers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.rental_properties(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  expected_starts_on date not null,
  expected_base_rent numeric(14,2) not null check (expected_base_rent > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  host_fee_rate numeric(8,6) not null default 0 check (host_fee_rate = 0),
  guest_fee_rate numeric(8,6) not null default 0 check (guest_fee_rate = 0),
  reason text not null check (length(btrim(reason)) between 10 and 500),
  authorization_source text not null check (length(btrim(authorization_source)) between 3 and 200),
  authorized_by uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  consumed_at timestamptz,
  consumed_by_request_id uuid,
  starts_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint fee_waivers_expiry_after_start check (expires_at is null or expires_at > starts_at),
  constraint fee_waivers_consumption_complete check (
    (consumed_at is null and consumed_by_request_id is null)
    or (consumed_at is not null and consumed_by_request_id is not null)
  )
);

create unique index if not exists fee_waivers_one_open_exact_request
  on rental_private.fee_waivers (
    property_id, host_id, guest_id, expected_starts_on, expected_base_rent, currency
  )
  where active and consumed_at is null;

alter table rental_private.fee_waivers enable row level security;
revoke all on table rental_private.fee_waivers from public, anon, authenticated;
grant select, insert, update, delete on table rental_private.fee_waivers to service_role;

alter table public.rental_booking_requests
  add column if not exists fee_waiver_id uuid
  references rental_private.fee_waivers(id) on delete restrict;

alter table rental_private.fee_waivers
  add constraint fee_waivers_consumed_request_fk
  foreign key (consumed_by_request_id)
  references public.rental_booking_requests(id)
  on delete restrict
  deferrable initially deferred;

alter table public.rental_booking_requests
  drop constraint if exists rental_booking_requests_fee_allocation_ck;
alter table public.rental_booking_requests
  add constraint rental_booking_requests_fee_allocation_ck check (
    host_fee_rate >= 0
    and guest_fee_rate >= 0
    and (
      (
        fee_waiver_id is null
        and host_fee_rate + guest_fee_rate = 0.090000
        and host_pays_guest_fee = (guest_fee_rate = 0 and host_fee_rate = 0.090000)
      )
      or
      (
        fee_waiver_id is not null
        and host_fee_rate = 0
        and guest_fee_rate = 0
        and host_pays_guest_fee = false
      )
    )
  );

create or replace function rental_private.apply_booking_fee_waiver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_host_id uuid;
  v_waiver_id uuid;
begin
  -- Never trust a caller-supplied waiver id. The server resolves it from the frozen relationship.
  new.fee_waiver_id := null;

  select p.agent_id
    into v_host_id
    from public.rental_properties p
   where p.id = new.property_id;

  if v_host_id is null then
    return new;
  end if;

  select w.id
    into v_waiver_id
      from rental_private.fee_waivers w
     where w.property_id = new.property_id
       and w.host_id = v_host_id
       and w.guest_id = new.guest_id
       and w.expected_starts_on = new.starts_on
       and w.expected_base_rent = new.quoted_total
       and w.currency = upper(new.currency)
       and w.active
       and w.consumed_at is null
       and w.consumed_by_request_id is null
       and w.starts_at <= clock_timestamp()
       and (w.expires_at is null or w.expires_at > clock_timestamp())
       and w.host_fee_rate = 0
       and w.guest_fee_rate = 0
     order by w.created_at
     limit 1
     for update skip locked;

  if v_waiver_id is not null then
    if new.id is null then
      new.id := gen_random_uuid();
    end if;
    new.fee_waiver_id := v_waiver_id;
    new.host_pays_guest_fee := false;
    new.host_fee_rate := 0;
    new.guest_fee_rate := 0;
    new.guest_total := round(new.quoted_total, 2);
    new.host_net := round(new.quoted_total, 2);

    update rental_private.fee_waivers
       set consumed_at = clock_timestamp(),
           consumed_by_request_id = new.id,
           active = false,
           updated_at = clock_timestamp()
     where id = v_waiver_id;
  end if;

  return new;
end
$function$;

revoke all on function rental_private.apply_booking_fee_waiver() from public, anon, authenticated;
grant execute on function rental_private.apply_booking_fee_waiver() to service_role;

drop trigger if exists apply_scoped_fee_waiver_before_insert on public.rental_booking_requests;
create trigger apply_scoped_fee_waiver_before_insert
before insert on public.rental_booking_requests
for each row execute function rental_private.apply_booking_fee_waiver();

create or replace function rental_private.guard_booking_fee_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.host_pays_guest_fee is distinct from old.host_pays_guest_fee
     or new.host_fee_rate is distinct from old.host_fee_rate
     or new.guest_fee_rate is distinct from old.guest_fee_rate
     or new.guest_total is distinct from old.guest_total
     or new.host_net is distinct from old.host_net
     or new.fee_waiver_id is distinct from old.fee_waiver_id then
    raise exception 'The booking fee allocation is fixed when the request is created.'
      using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function rental_private.guard_booking_fee_allocation() from public, anon, authenticated;
grant execute on function rental_private.guard_booking_fee_allocation() to service_role;

drop trigger if exists guard_booking_fee_allocation_before_update on public.rental_booking_requests;
create trigger guard_booking_fee_allocation_before_update
before update on public.rental_booking_requests
for each row execute function rental_private.guard_booking_fee_allocation();

-- Lee explicitly authorized a full OneHome platform-fee waiver for this one September request
-- on 6 September 2026. Resolve the actors by stable account email and the home by listing number;
-- the date, price and currency below make the exception single-use and prevent it from reaching
-- any renewal or later request. Abort instead of creating a broad waiver if live identity drifts.
do $block$
declare
  v_property public.rental_properties%rowtype;
  v_host uuid;
  v_guest uuid;
begin
  select * into strict v_property
    from public.rental_properties
   where listing_no = 10519
     and address_line = 'Carrera 30 # 17-152, Apto 1003';

  select id into strict v_host
    from public.profiles
   where lower(email) = 'jennyjc24@hotmail.com';

  select id into strict v_guest
    from public.profiles
   where lower(email) = 'frazierlee@gmail.com';

  if v_property.agent_id <> v_host then
    raise exception 'Listing 10519 is not currently attached to Jenny Rubiano; fee waiver refused.';
  end if;

  insert into rental_private.fee_waivers (
    property_id, host_id, guest_id, expected_starts_on, expected_base_rent, currency,
    reason, authorization_source, authorized_by
  ) values (
    v_property.id,
    v_host,
    v_guest,
    date '2026-09-01',
    9000000.00,
    'COP',
    'OneHome platform fees waived once for the September 2026 Jenny Rubiano / Lee Frazier rental request; base rent remains unchanged.',
    'Lee Frazier explicit, risk-informed approval in OneHome voice task, 6 September 2026',
    v_guest
  );
end
$block$;
