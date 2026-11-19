# Release nov12-orch2 — production package (NOT deployed)

| Item | State | What ships |
|---|---|---|
| A · Paste listing links | Already LIVE (DB + listing-links v1 + app index-BcnCBkRh.js); re-verified 12 Nov, 12/12 | nothing new — `A_paste_links_proof.sql` is the proof |
| B · vaia-event-intelligence v19 | Ready | `supabase/functions/vaia-event-intelligence/{index.ts,plan.ts}` |
| C · onejob-stripe-webhook v26 | Ready (+ one Stripe dashboard change) | `supabase/functions/onejob-stripe-webhook/{index.ts,onepay.ts}` |
| D · Website "Front Desk" label | Not in this package | see release note |
| E · World feed Vea button | Not in this package | app source not reachable from this session |

Proofs: `deno test` (plan_test.ts 4/4, onepay_test.ts 6/6) and `deno check` on both index.ts files
(harness proven to bite with an injected type error). No SQL changes in B or C.

## Production steps
1. Deploy `vaia-event-intelligence` (files index.ts + plan.ts, verify_jwt = **true**) → becomes v19.
2. Deploy `onejob-stripe-webhook` (files index.ts + onepay.ts, verify_jwt = **false**) → becomes v26.
   Before deploying, diff index.ts against live v25 (`get_edge_function`): the only differences must be the
   v26 header paragraph, the `./onepay.ts` import, the v26 block at the top of `try`, and the word "OnePay" in SAFETY.
3. Stripe dashboard → Developers → Webhooks → destination **onejob-disputes** (we_1Txe9wGwkV5KyRSvaAmlm983,
   "Your account") → add events `payment_intent.succeeded` and `payment_intent.payment_failed` (keep all existing).
   Do this AFTER step 2, so v25 never receives OnePay successes it would ignore.

## Rollback
- B: redeploy v18 source (from `get_edge_function` before step 1, or git history) — v18 only re-gates the Rolodex.
- C: remove the two event types from onejob-disputes first, then redeploy v25. No data to undo: the OnePay
  calls are the idempotent functions onepay-card-pay already uses.
