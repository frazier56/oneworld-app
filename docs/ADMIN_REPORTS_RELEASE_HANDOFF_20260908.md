# Admin reports T004 — serialized release handoff

Prepared 8 September 2026 for the OneWorld27 release owner. This handoff does not authorize a second publisher.

## Release candidate

- Branch: `codex/admin-reports-t004-20260908`
- Base: deployment app `7ecee1cb` (`Activate verified request lifecycle and shared shell release`)
- Admin implementation: `admin-dashboard.js`, `admin-dashboard.css`, `admin-parity.css`, `admin/index.html`
- Server contract: `supabase/migrations/20260908091500_admin_finance_evidence_summary.sql`
- Regression evidence: `tests/admin-finance-contract.cjs`, `tests/fixtures/admin-finance.html`

The importer, Jenny review, request lifecycle, receipt hold, and owner-acceptance files are preserved. This candidate does not modify Jenny records, `listing-review`, the root app pointer, OneHome chunks, or any participant-facing workflow.

## Required serialized order

1. Confirm OneWorld27 remains the sole publisher and that no other app or database release is in flight.
2. Capture the current `public.admin_dashboard_sections()` definition and ACL as rollback evidence.
3. Apply `20260908091500_admin_finance_evidence_summary.sql` to project `wseblryyqxawvbjmylbo` **before** publishing the Admin assets.
4. Verify the migration record exists, the function is `SECURITY DEFINER` with an empty `search_path`, `anon` and `PUBLIC` cannot execute it, `authenticated` can execute it, and the function still rejects a signed-in non-admin with SQLSTATE `42501`.
5. As the platform admin, call the summary once and verify that the response contains the existing `money` and `ops` keys plus `money.finance`, that `money.finance.access_scope` is `platform_admin_aggregate_only`, and that `money.finance.recurring.mrr` is JSON null with status `definition_required`.
6. Publish the Admin asset changes from the candidate only after step 5 passes. Do not replace the current root `index.html`, `404.html`, OneHome chunks, importer files, or Jenny migration with older copies.
7. Verify the public Admin asset URLs return HTTP 200 and `/admin/` references `admin-dashboard.js?v=20260907-finance1`, `admin-dashboard.css?v=20260907-finance2`, and `admin-parity.css?v=20260907-finance1`.
8. Complete the signed-in, read-only live acceptance below. If any check fails, restore the prior Admin asset pointer. The server change is backward-compatible with the prior Admin UI; retain the captured function definition for a controlled database rollback only if the server contract itself is defective.

## Signed-in live Admin acceptance

Use a platform-admin account. Do not create, edit, refund, charge, message, approve, claim, or delete any real record.

- Open `/admin/` at 1,440 by 1,000 CSS pixels and 390 by 844 CSS pixels.
- Visit Overview, Growth, People, Money, and Ops. Each section must load without a raw error or redirect loop.
- On Money, confirm the five KPI cards: Paid agreements, Paid bookings, Active promos, Confirmed refund records, and MRR.
- Confirm MRR displays `Not defined`; no numeric MRR may appear until the business definition and priced recurring source are approved.
- Confirm the three evidence cards appear: Refund evidence, Recurring source coverage, and Recognized platform fees.
- Confirm refunds count only explicit lifecycle-confirmed rows. Monetary refund totals must appear only for sources with recorded amount and currency; agreement and event sources remain count-only.
- Confirm recurring work and accepted monthly rent are labelled commitments, not earned recurring platform revenue.
- Confirm each currency is displayed separately and no cross-currency total is invented.
- At desktop width, verify five KPI columns and three finance columns. At phone width, verify two KPI columns, one finance column, all five navigation tabs visible, and no document or navigation overflow.
- Check the browser console and network panel for Admin-origin errors or failed Admin asset/RPC requests.
- Confirm one new `admin_audit_log` row records the platform-admin dashboard view; do not inspect or alter unrelated audit rows.
- Sign out or use a separate signed-out context and confirm the Admin summary RPC is unavailable to `anon`. With a controlled non-admin test account, confirm the function fails closed. Do not use Jenny or another participant account for this negative test.

## Evidence already complete

- Current live catalog contains every column referenced by the migration.
- Current live function is owned by `postgres`, is `SECURITY DEFINER`, has `search_path=""`, denies `anon`, and grants `authenticated` plus `service_role`.
- The Admin migration is not yet recorded. Latest live migration before this candidate is `20260908085758_owner_acceptance_event_permission_preserving`; the candidate timestamp sorts after it.
- A prior transaction-only execution of the same function body passed and was rolled back: platform admin allowed, anonymous denied, authenticated grant present, confirmed and pending refund counts returned, and MRR remained JSON null with `definition_required`.
- Reconciled local fixture UAT passed on 8 September 2026. At 1,440 by 1,000 CSS pixels: five KPI columns, three finance columns, all five navigation tabs visible, `Not defined` MRR, and no document or navigation overflow. At 390 by 844 CSS pixels: two KPI columns, one finance column, all five navigation tabs visible, `Not defined` MRR, and no document or navigation overflow. All three finance cards rendered and the bottom disclosure/footer were reachable.
- The local browser console contained no Admin-origin warnings or errors. The only warnings came from a browser extension content script.
- Desktop screenshot: `C:\Dev\Projects\One Social\artifacts\admin-finance-20260908\admin-finance-desktop-1440.png` — SHA-256 `A4381E22328FA7F4F2CAC05F8F3210E213E5E9EDD077B5EB76138A702D13EC06`.
- Phone screenshots: `C:\Dev\Projects\One Social\artifacts\admin-finance-20260908\admin-finance-phone-390-top.png` — SHA-256 `F779004AF146FAE2A72A180DA11E586DFC0D4DCC65A447DC9B6CB0798584DDF3`; `C:\Dev\Projects\One Social\artifacts\admin-finance-20260908\admin-finance-phone-390-bottom.png` — SHA-256 `506B9FEDDF63FD483E43AF7AE7C47D66DE0994FF398C2D96AE9D06EFD69BA616`.
- The isolated local QA tab was closed, the responsive viewport override was reset, and the sole owned test server on port 4,173 was stopped; no listener remains.

## Deliberate non-blocker

MRR remains `Not defined`. The open question is whether it includes only earned One World subscription fees or also recurring marketplace and rental platform fees, and which products are in scope. This decision does not block the other finance evidence from release.

## Known unrelated test debt

`tests/onehome-owner-auth-contract.cjs` contains a hard-coded historical root bundle name. It is unchanged from current `origin/main` and is outside this Admin candidate. Treat it as shared release-test drift; do not weaken or silently skip the Admin contract because of it.
