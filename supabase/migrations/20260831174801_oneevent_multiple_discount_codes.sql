-- OneEvent: allow each paid event to own up to ten discount codes.
-- Codes stay host-only in Postgres; public checkout resolves one submitted code
-- through the service-role Edge Function so the full code list is never exposed.

create table if not exists public.event_discount_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null,
  discount_percent integer not null,
  position smallint not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_discount_codes_code_format
    check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_-]{2,32}$'),
  constraint event_discount_codes_percent_range
    check (discount_percent between 1 and 100),
  constraint event_discount_codes_position_range
    check (position between 1 and 10),
  constraint event_discount_codes_event_position_key unique (event_id, position)
);

create unique index if not exists event_discount_codes_event_code_key
  on public.event_discount_codes (event_id, upper(code));

create index if not exists event_discount_codes_event_id_idx
  on public.event_discount_codes (event_id);

alter table public.event_discount_codes enable row level security;

revoke all on table public.event_discount_codes from anon, authenticated;
grant select, insert, update, delete on table public.event_discount_codes to authenticated;
grant all on table public.event_discount_codes to service_role;

drop policy if exists "Event owners can read discount codes" on public.event_discount_codes;
create policy "Event owners can read discount codes"
  on public.event_discount_codes
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.events e
      where e.id = event_discount_codes.event_id
        and (
          e.host_id = (select auth.uid())
          or public.is_event_manager(e.id, (select auth.uid()))
        )
    )
  );

-- Writes are intentionally RPC-only so replacing the list is atomic.

create or replace function public.replace_event_discount_codes(
  p_event_id uuid,
  p_codes jsonb
)
returns table(code text, discount_percent integer, sort_order smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_item jsonb;
  v_position integer := 0;
  v_code text;
  v_percent integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        e.host_id = v_user_id
        or public.is_event_manager(e.id, v_user_id)
      )
  ) then
    raise exception 'Only this event owner can manage discount codes'
      using errcode = '42501';
  end if;

  if p_codes is null or jsonb_typeof(p_codes) <> 'array' then
    raise exception 'Discount codes must be a JSON array' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_codes);
  if v_count > 10 then
    raise exception 'An event can have at most 10 discount codes' using errcode = '22023';
  end if;

  -- Validate the full replacement before deleting the current list.
  for v_item in select value from jsonb_array_elements(p_codes)
  loop
    v_code := upper(btrim(coalesce(v_item ->> 'code', '')));
    begin
      v_percent := (v_item ->> 'discountPercent')::integer;
    exception when others then
      raise exception 'Every discount must include a whole-number percentage from 1 to 100'
        using errcode = '22023';
    end;

    if v_code !~ '^[A-Z0-9_-]{2,32}$' then
      raise exception 'Codes must be 2-32 letters, numbers, underscores, or hyphens'
        using errcode = '22023';
    end if;
    if v_percent not between 1 and 100 then
      raise exception 'Discount percentage must be from 1 to 100'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from (
      select upper(btrim(value ->> 'code')) as normalized_code, count(*)
      from jsonb_array_elements(p_codes)
      group by 1
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Each discount code must be unique for this event'
      using errcode = '23505';
  end if;

  delete from public.event_discount_codes d where d.event_id = p_event_id;

  v_position := 0;
  for v_item in select value from jsonb_array_elements(p_codes)
  loop
    v_position := v_position + 1;
    v_code := upper(btrim(v_item ->> 'code'));
    v_percent := (v_item ->> 'discountPercent')::integer;

    insert into public.event_discount_codes (
      event_id, code, discount_percent, position, created_by
    ) values (
      p_event_id, v_code, v_percent, v_position, v_user_id
    );
  end loop;

  -- Keep the legacy columns synchronized during the gradual client rollout.
  update public.events e
  set discount_code = first_code.code,
      discount_percent = first_code.discount_percent
  from (
    select d.code, d.discount_percent
    from public.event_discount_codes d
    where d.event_id = p_event_id
    order by d.position
    limit 1
  ) first_code
  where e.id = p_event_id;

  if v_count = 0 then
    update public.events
    set discount_code = null,
        discount_percent = null
    where id = p_event_id;
  end if;

  return query
  select d.code, d.discount_percent, d.position
  from public.event_discount_codes d
  where d.event_id = p_event_id
  order by d.position;
end;
$$;

revoke all on function public.replace_event_discount_codes(uuid, jsonb) from public, anon;
grant execute on function public.replace_event_discount_codes(uuid, jsonb) to authenticated;
grant execute on function public.replace_event_discount_codes(uuid, jsonb) to service_role;

comment on table public.event_discount_codes is
  'Host-only OneEvent discount codes. A maximum of ten active codes can belong to one event.';

comment on function public.replace_event_discount_codes(uuid, jsonb) is
  'Atomically validates and replaces an event owner''s ordered discount-code list.';

-- Preserve every valid legacy single code as the first code in the new list.
insert into public.event_discount_codes (
  event_id, code, discount_percent, position, created_by
)
select
  e.id,
  upper(btrim(e.discount_code)),
  e.discount_percent,
  1,
  e.host_id
from public.events e
where e.discount_code is not null
  and upper(btrim(e.discount_code)) ~ '^[A-Z0-9_-]{2,32}$'
  and e.discount_percent between 1 and 100
on conflict (event_id, position) do update
set code = excluded.code,
    discount_percent = excluded.discount_percent,
    updated_at = now();
