# T095 rollback pairing

No candidate in this branch has been applied to production.

Release order:

1. Apply the 17:00 provider-status migration.
2. Apply the 18:00 fallback/attempt-boundary migration.
3. Deploy `process-event-rolodex-broadcast` from the reviewed successor.
4. Drain/expire invocations of the older worker version before activating the new callback path.
5. Deploy `twilio-message-status` from the reviewed successor.

If the successor is later released and must be rolled back:

1. Deploy the supplied `supabase/rollbacks/edge/process-event-rolodex-broadcast-v31-safe` bundle. It is the exact v31 source with only strict exact-service-key authentication retained; restoring raw live v31 would restore forged role-only token acceptance while gateway `verify_jwt=false`.
2. Deploy `supabase/rollbacks/edge/twilio-message-status-v13`.
3. Drain/expire invocations of the successor worker and callback before removing their RPC dependencies.
4. Run `supabase/rollbacks/20260911180000_oneevent_atomic_whatsapp_fallback.sql`.
5. Prefer leaving the additive 17:00 status-rank/RPC migration installed. If it must also be removed, run `supabase/rollbacks/20260911170000_oneevent_atomic_provider_status.sql` only after v13 is restored.
6. Never remove the already-live 15:30 observability columns, callback dedupe index, or operations view while v13 is deployed.

Restoring v13 deliberately returns to the known read/write callback race; it is degraded recovery, not acceptance.

The 18:00 rollback first converts any `in_flight` dispatch evidence to `ambiguous` before restoring the prior state constraint and the exact live provider-claim function. This is intentional: an external request that crossed the provider-attempt boundary cannot safely be labelled cancelled or retried.

The database claim prevents duplicate OneEvent submissions, but no application can guarantee exactly-once delivery across a remote provider boundary. A timeout after `in_flight` is stored as `ambiguous` and quarantined; it must not be retried automatically. If WhatsApp delivers after SMS crossed `in_flight`, both messages may arrive because the SMS request can no longer be recalled.

Rollback source byte hashes:

- v31-safe worker index: `6bfe6fb9e6eeddd6ff4633aec9728afafdbc19a603a820023193ac67d55f7601`
- v31-safe shared module: `26a518a6595e88d16d75d2652400b632d055535fa731ac0d22521d26c6a48968`
- v13 callback index: `32b23bd9d5050628de4369a97f442f3263c84392b1e1aa49d6298f9df005e9e6`
- v13 provider-status helper: `74ab7779e35512a0fa23d5a04b6c725ac4b1ca393a4193d47b1b29faea4a38c8`
