-- These four owner mutations execute with the caller's authenticated JWT so
-- auth.uid() can enforce contract ownership inside each SECURITY DEFINER
-- function. Public/anonymous execution remains revoked; the Edge Function also
-- validates the owner handoff before invoking them.
grant execute on function public.rental_inspection_item_add_v2(uuid,text,text,text,bigint,text,integer,timestamptz,text,text,integer,integer) to authenticated;
grant execute on function public.rental_inspection_item_delete_v2(uuid) to authenticated;
grant execute on function public.rental_inspection_send_v2(uuid) to authenticated;
grant execute on function public.rental_inspection_confirm_tenant_evidence(uuid) to authenticated;
