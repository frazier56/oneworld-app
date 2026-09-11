# T095 exact live dependency baseline

Read-only retrieval date: 2026-09-11. Supabase project: `wseblryyqxawvbjmylbo`.

## Deployed worker

- Slug: `process-event-rolodex-broadcast`
- Status/version: `ACTIVE` / `31`
- Bundle SHA-256: `179efafae4696e0536baee8a5f2afa3de83d64e8cd4f68f7b52418b0ac05ff73`
- Gateway `verify_jwt`: `false`
- Exact retrieved files:
  - `artifacts/t095-live-worker-v31/process-event-rolodex-broadcast/index.ts` (60,841 characters in API response)
  - `artifacts/t095-live-worker-v31/_shared/whatsapp-broadcast-safety.ts` (5,020 characters in API response)

Local artifact byte hashes after newline normalization (source text is otherwise unchanged; the deployed bundle hash above remains authoritative):

- index: `3b9071cc4487af4a0ad1274fe7260b080566e2a1fce358aeeda9f52bb75ab86a`
- shared safety module: `6ed4c45f6ae797fad410d91bb401a3b172d373e094e0b0fbaea253b84ce5a314`

The successor worker source started from those exact two retrieved files. Its intended changes are limited to strict service-key authentication, the SMS claim/authorization/in-flight boundary, conditional dispatch-evidence finalization, and routing every broadcast-summary write through the shared locked RPC.

## Live provider-claim dependency

Exact signature: `claim_event_rolodex_provider_dispatch(uuid,uuid,text,text,integer,integer)`.

- Owner: `postgres`
- `SECURITY DEFINER`: false
- `search_path`: empty
- ACL: `{postgres=X/postgres,service_role=X/postgres}`
- `anon`: no execute
- `authenticated`: no execute
- `service_role`: execute

The exact live definition is reproduced in the 18:00 successor migration, with only `in_flight` added to the terminal claim states. The paired rollback restores the original state list and function body.

## Production boundary

This retrieval was read-only. No migration, Edge function, SMS, or customer row was changed. The successor remains held for review.
