-- Trigger helpers execute through their triggers and must not be callable as RPCs.
revoke all on function public.link_rental_acceptances_to_owner()
  from public, anon, authenticated;
revoke all on function public.guard_rental_payment_receipt_events_immutable()
  from public, anon, authenticated;
