# ONE WORLD LABS — WHAT WE CHARGE, AND WHERE THE NUMBER LIVES

**Read this before quoting, changing, or asking anyone about a fee. Do not grep for a number.**
Verified against the live database 14 October 2026.

---

## THERE ARE TWO FEES. ON PURPOSE. NEITHER IS A BUG.

| | Rate | Charged on | Who pays | Where the number lives |
|---|---|---|---|---|
| **Transaction fee** | **5.99%** | a one-off transaction | varies per product | `platform_fee_rate()` · shell `FEE_RATE` |
| **Rental fee** | **8.99%** | **each monthly rent payment** | split: manager **1.50** + tenant **7.49** | `rental_host_fee_rate()` · `rental_guest_fee_rate()` |

### The transaction fee, 5.99 percent
| Product | What the 5.99 is taken of | Who pays |
|---|---|---|
| OneJob | the contract price | the client, added on top |
| OneEvent | the ticket subtotal | the buyer, added on top (Stripe `application_fee_amount`) |
| OneAgent | the booking rate | taken out of the payout |
| OneSale | **the earnest money only** — never the sale price | the payee, taken out |

### The rental fee, 8.99 percent — OneHome / OneRental
Lee, 14 Sep 2026 and again 14 Oct 2026: *"The 1.5% is for the property manager. The rest is for
the tenant. So just keep that the way it is. That's for rentals. 5.9% goes to transaction fees
otherwise."*

- **1.50%** is deducted from the property manager's rent.
- **7.49%** is added to the tenant's payment.
- `rental_fee_rate()` is **derived** from the two, never typed, so the total can never drift from
  the two amounts people actually pay.
- Every request and lease **freezes both rates at signing**, and `rental_booking_fee_rate_guard`
  lets a renewal keep the rate its tenancy began on. Older live rows carry 0.015 / 0.075.

### OneRide is neither
**20 percent** of the fare, taken from the driver. `ride-money` `RATE`.

---

## ⛔ THE MISTAKE THIS FILE EXISTS TO PREVENT

**An 8.99 found in OneHome rental code is CORRECT. Do not "fix" it to 5.99.**

On 14 October 2026 I read "there is no 8.99" as applying to every product, changed the tenant fee
to make the rental total 5.99, and had to revert it the same hour. Lee's own words afterwards:
*"you didn't give me enough context... Next time, provide context."*

He is right, and it is the whole lesson. The recurring loop was never a stray number — it was that
nothing in this repository said there were **two** fees, so anyone who grepped `8.99` found a live
rate that looked like it contradicted "the fee is 5.99", could not tell which was authoritative,
and went back to Lee to ask. He has answered that question more times than anyone should have to.

**So: read this table. Do not ask him. If a number here is ever actually wrong, bring him the two
fees, what each is charged on, and who pays — then the decision, not the question.**

Stripe is not a source and never was: it stores no rate for us. Every fee is computed by our own
code and handed over as a fixed amount per charge. Its product catalogue, active and archived, was
checked on 14 Oct and holds no fee rate of any kind.

---

## RULES

1. **Never type a rate.** Read `platform_fee_rate()` / `FEE_RATE`, or the two rental functions.
   Two server functions once carried their own literal and paid out on a different rate than the
   app quoted. `ListProperty` typed `0.09` — a third number, on the one screen a manager reads to
   decide whether to absorb the tenant fee, and not even the 8.99 we charge. Both are fixed.
2. **Never render a combined rental total as a typed number.** Use `RENTAL_FEE_RATE`, the sum.
3. **A fixture is not exempt.** `previewFixtures.ts` carried 0.075, 0.03 and totals that did not
   satisfy the real CHECK constraints — a test that asserts a wrong rate is how a wrong rate
   survives a cleanup.
4. **A fee change is one edit in the database and one in `shell/lib/supabase.ts`.** The
   seven-language member copy interpolates the constants and follows on its own — check it anyway,
   at phone width, in Spanish.
5. **Update this file in the same change.** If it is stale, it is worse than nothing.
