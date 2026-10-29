# Batch 207 — OneHome fees in pesos (both sides)

Lee, 29 Oct 2026: "Fee only" + "Both sides". Rent goes straight from tenant to host; OneHome never holds it.
The tenant pays the guest service fee and the host pays the host fee, each in pesos (Nequi / PSE via Wompi).

- DB (migration `wompi1_onehome_fees_in_pesos`, additive): `guest_fee_paid_at/ref`, `host_fee_paid_at/ref` on
  rental_booking_requests; `onehome_fee_due` + `onehome_wompi_fee_paid` (service_role only); `my_onehome_fee` (caller's side).
- Fee due only when: COP, state accepted, no fee waiver. Amount = guest_total − quoted_total (guest) or quoted_total − host_net (host), whole pesos.
- wompi-pay v7: purposes `onehome_guest_fee` / `onehome_host_fee` (amount server-side; caller must be the tenant / the property's host).
- wompi-webhook v5: settles both.
- UI: `OneHomeFeePay` card in the tenant's request card and the host's contract screen (accepted COP bookings).
