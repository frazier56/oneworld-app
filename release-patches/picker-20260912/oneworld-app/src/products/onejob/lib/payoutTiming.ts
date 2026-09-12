/**
 * HOW LONG UNTIL THE MONEY IS IN THE BANK — one place, so every screen says the same true thing.
 *
 * This file exists because the app shipped a sentence that was false for its own launch market.
 * PayoutSetup told every pro "Want it faster? …instant payout… for a 2.99% fee", and the money
 * timeline repeated it. **Stripe does not offer Instant Payouts in Colombia at all.** A Colombian
 * pro was being sold a product that cannot be bought, on the screen where they set up getting paid.
 *
 * The 2.99% figure itself wasn't invented — it came from dLocal's ~1.9% instant-payout fee, doubled,
 * the same resell logic as everywhere else. It is simply not a Stripe reality in Colombia today. So
 * the offer is gated on the country Stripe actually supports it in, and it stays gated until dLocal
 * confirms Bre-B pricing.
 *
 * THE OTHER CORRECTION. An earlier round told Lee that every Colombian payout waits 7 days. Wrong.
 * The 7 days is a ONE-TIME hold Stripe puts on a brand-new account; every payout after it runs at
 * the country's normal speed (3 business days for Colombia, 2 for the US). Describing a one-time
 * hold as a standing schedule makes the product look four times slower than it is.
 *
 * RULE OF THE ROAD: a real date always beats anything in this file. When Stripe has issued a payout,
 * `payout.arrival_date` is the truth and these estimates must not be shown next to it. These numbers
 * are only for the moment BEFORE a payout exists, when the honest answer is "roughly this long".
 */

/**
 * Countries where Stripe actually offers Instant Payouts. Verified against Stripe's published list
 * (Jul 27 2026). Colombia is absent — which is the whole reason this list is in the codebase.
 * "EU" in Stripe's list is expanded to its members here so a lookup is a plain string check.
 */
const INSTANT_PAYOUT_COUNTRIES = new Set([
  "AE", "AU", "CA", "DK", "GB", "HK", "MY", "NO", "NZ", "SE", "SG", "US",
  // EU / EEA
  "AT", "BE", "BG", "HR", "CY", "CZ", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LI",
  "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
]);

export function instantPayoutAvailable(country?: string | null): boolean {
  return !!country && INSTANT_PAYOUT_COUNTRIES.has(country.toUpperCase());
}

/**
 * Per-country payout timing, as Stripe operates it.
 *
 * `firstPayoutDays` is the ONE-TIME hold on a new account, in calendar days.
 * `ongoingText` is how fast every payout after that lands.
 *
 * Anything not listed falls back to a deliberately vague sentence rather than a made-up number —
 * "a few business days" is honest about not knowing; "2 business days" for an unverified country is
 * a guess dressed as a fact.
 */
const TIMING: Record<string, { firstPayoutDays: number; ongoingText: string }> = {
  CO: { firstPayoutDays: 7, ongoingText: "about 3 business days" },
  US: { firstPayoutDays: 7, ongoingText: "about 2 business days" },
};

export type PayoutTiming = {
  /** "about 3 business days" — how fast a normal payout lands. */
  ongoing: string;
  /** "about 7 days" — the one-time hold on the very first payout, or null if we don't know. */
  firstPayout: string | null;
  /** True when we're stating a number we've actually verified for this country. */
  known: boolean;
};

export function payoutTiming(country?: string | null): PayoutTiming {
  const t = country ? TIMING[country.toUpperCase()] : undefined;
  if (!t) return { ongoing: "a few business days", firstPayout: null, known: false };
  return {
    ongoing: t.ongoingText,
    firstPayout: `about ${t.firstPayoutDays} days`,
    known: true,
  };
}

/**
 * The sentence a pro should read BEFORE they walk into Stripe's onboarding, and again on their
 * payouts panel. Lee: "the notice they see before they enter Stripe… definitely for the payee."
 *
 * Two facts, in the order they'll experience them, with the one-time hold named as one-time so
 * nobody concludes the platform is permanently slow.
 */
export function payeeTimingLines(country?: string | null): string[] {
  const t = payoutTiming(country);
  const lines: string[] = [];
  if (t.firstPayout) {
    lines.push(`Your very first payout is held by Stripe for ${t.firstPayout}. It's a one-time check on brand-new accounts, not how it works from then on.`);
  } else {
    lines.push("Your very first payout takes longer than the rest — Stripe runs a one-time check on brand-new accounts.");
  }
  lines.push(`After that, money reaches your bank in ${t.ongoing} once you and the client have both marked the job complete.`);
  return lines;
}

/**
 * The same two facts written for the CLIENT, who has no Stripe account and no idea why there's a gap
 * between marking a job done and the pro saying thanks. Lee asked for "a similar notice for the
 * payer, so when they click setup they see what's about to happen."
 */
export function payerTimingLines(country?: string | null): string[] {
  const t = payoutTiming(country);
  return [
    "Your card is only authorized when you send the contract — nothing is taken until the professional accepts.",
    "Once they accept, the payment is collected and held in the OneJob Vault. Neither of you can touch it.",
    "When you both mark the job complete, it leaves the Vault the same day and lands in the professional's own Stripe account. From that moment OneJob isn't holding it.",
    // The client can't be told the pro's exact country — that's the pro's private account data, and
    // a payer has no read access to it. So this stays deliberately unspecific rather than guessing
    // from the contract currency, which would be an inference dressed as a fact.
    `Stripe then moves it from there into the professional's bank in ${t.ongoing}, on Stripe's schedule rather than OneJob's. A professional's very first payout takes longer — Stripe runs a one-time check on new accounts.`,
    "If it looks stuck after you've both marked it complete, it's almost always the professional's payout setup, not your payment. You've done your part.",
  ];
}
