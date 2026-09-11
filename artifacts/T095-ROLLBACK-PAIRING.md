# T095 rollback pairing

No candidate in this branch has been applied to production.

If the successor is later released and must be rolled back:

1. Restore the exact pre-release `twilio-message-status` v13 bundle.
2. Restore the exact pre-release `process-event-rolodex-broadcast` v31 bundle.
3. Run `supabase/rollbacks/20260911180000_oneevent_atomic_whatsapp_fallback.sql`.
4. Prefer leaving the additive 17:00 status-rank/RPC migration installed. If it must also be removed, run `supabase/rollbacks/20260911170000_oneevent_atomic_provider_status.sql` only after v13 is restored.
5. Never remove the already-live 15:30 observability columns, callback dedupe index, or operations view while v13 is deployed.

Restoring v13 deliberately returns to the known read/write callback race; it is degraded recovery, not acceptance.
