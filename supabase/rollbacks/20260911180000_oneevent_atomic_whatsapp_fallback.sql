-- Run only after restoring the previous deployed versions of both:
--   twilio-message-status
--   process-event-rolodex-broadcast
-- The previous Edge bundles do not call these functions.

drop function if exists public.oneevent_apply_twilio_recipient_status(
  uuid, text, timestamptz, text, text
);
drop function if exists public.oneevent_claim_sms_provider_dispatch(
  uuid, uuid, text, integer, integer
);
drop function if exists public.oneevent_refresh_broadcast_delivery_summary(
  uuid, timestamptz
);
