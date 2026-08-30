-- Prevent an event with real paid admissions from being changed to free through
-- a broad client-side event update. Guest-list tickets remain independently
-- supported through the complimentary-ticket workflow.

create or replace function public.guard_paid_event_pricing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.ticket_type, 'free') = 'free'
     and coalesce(new.ticket_price, 0) <= 0
     and coalesce(new.ga_ticket_price, 0) <= 0
     and coalesce(new.vip_ticket_price, 0) <= 0
     and exists (
       select 1
       from public.event_registrations r
       where r.event_id = new.id
         and r.payment_status = 'paid'
         and lower(coalesce(r.status, 'registered')) not in ('cancelled', 'canceled')
     )
  then
    raise exception using
      errcode = '23514',
      message = 'This event already has paid tickets. Keep its ticket price, or create a separate free event.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_paid_event_pricing() from public;

drop trigger if exists guard_paid_event_pricing_trigger on public.events;
create trigger guard_paid_event_pricing_trigger
before update of ticket_type, ticket_price, ga_ticket_price, vip_ticket_price
on public.events
for each row
execute function public.guard_paid_event_pricing();


