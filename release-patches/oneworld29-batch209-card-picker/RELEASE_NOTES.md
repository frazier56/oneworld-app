# Batch 209 — pay with any saved card (Lee, 29 Oct 2026)
- Bug: "PaymentMethod … does not belong to the Customer you supplied". Lee's Visa 5536 sits on an older Stripe customer; pay-contract-saved searched for a customer and found a newer one.
  Fix (pay-contract-saved v23): charge against the customer recorded on the card's own payment_methods row (caller-scoped, so a token not on your account is refused). Idempotency key now includes the card, so a retry with another card is not served the cached error.
- Bug: adding a card "didn't save". It did save (twice), but the sheet kept the old card selected. Now the new card is selected after saving.
- "Paying with" → Change opens the saved-cards list (pick one, or Add a new card) instead of jumping to the add-card form. "Primary" shows only on the primary card. Non-card rows (PayPal link) are not offered as a way to authorize a hold.
