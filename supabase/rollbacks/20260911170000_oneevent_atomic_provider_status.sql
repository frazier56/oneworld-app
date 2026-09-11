-- Optional full candidate rollback. Restore twilio-message-status v13 first.
-- Do not remove the 20260911153000 observability columns/view/index: v13 uses them.

drop function if exists public.oneevent_apply_twilio_provider_status(
  text, uuid, text, timestamptz, text, text
);
drop function if exists public.oneevent_provider_status_rank(text);
