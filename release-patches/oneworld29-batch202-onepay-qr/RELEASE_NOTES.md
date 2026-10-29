# Batch 202 — OnePay QR guest pay — SANDBOX
- Charge → QR/link: shows a scan-to-pay QR (token link) + copy link + cancel.
- Public /pay/:token: customer sees business, items, total; pays with Nequi/PSE as guest (name + email).
- Approved Wompi payment settles the OnePay sale (ledger, receipt, order paid) via onepay_wompi_paid.
- New merchants default to QR/link on with provider wompi.
- 202d: customer page moved /pay/:token → /checkout/:token (it shadowed OnePay's own /pay/* screens).
