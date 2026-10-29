# Batch 200 — WOMPI 1: pay in pesos (Nequi, PSE) on One World screens — SANDBOX ONLY
- New shared sheet `LocalPaySheet` (Nequi push / PSE bank redirect) + `useLocalPayReturn`.
- Unlinked test bench `/pay-test` (server accepts `sandbox_test` purpose only in Wompi test mode).
- Backend: edge functions `wompi-pay` (config/create/status) + `wompi-webhook` (checksum-verified),
  tables `wompi_payments` (own-row read RLS) + `wompi_events` (service-role only).
- Amount is always resolved server-side per purpose; unknown purposes refused.
- Production index untouched. Rollback: rollback/sandbox-index.html.
