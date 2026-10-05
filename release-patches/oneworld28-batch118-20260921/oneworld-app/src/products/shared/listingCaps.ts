/**
 * ONEHOME LISTING CAPS — what one plan allows, for BOTH halves of the product.
 * ============================================================================================
 * ⚠️ WHY THIS FILE EXISTS. These numbers lived in `onerental/lib/plans.ts`, so the SALE listing
 * form enforced none of them: `PhotoDeck` was mounted with no `max` and the description field had
 * no cap, which meant a seller on the free plan uploaded as many photos as they liked. A paid
 * tier that one half of the product ignores is not a tier — it is revenue leaking somewhere
 * nobody is looking, because nothing errors and no screen complains.
 *
 * Lee, 28 September 2026: *"They're like twins. And if one feature is on one side, then it needs
 * to be on the other in the same exact way. Why make them different?"*
 *
 * A plan is bought once and covers the member, not one of their two shelves — so the numbers
 * belong to neither half and live here. `onerental/lib/plans.ts` re-exports them, so no rent
 * caller changed to fix the sale side.
 *
 * ✅ RESOLVED 30 Sep 2026 — Lee chose the 12 September numbers; they are now below. History:
 * ⚠️ AND A CONFLICT THIS SURFACED, LEFT ALONE ON PURPOSE. `onerental/lib/planLimits.ts` holds a
 * SECOND table — 15/30/100 photos, 1000/2000/6000 characters — written on 12 September from Lee's
 * own words, with videos and live-listing counts the table below does not have. **Nothing on the
 * rent side imports it.** The form has always used the numbers here (8/25/50 photos, 600/2000/5000
 * characters). Two tables both called PLAN_LIMITS, with different numbers, one of them dead.
 *
 * The caps below are the ones being copied to sale because they are the ones the product actually
 * enforces today — making sale match a table rent ignores would have been a third answer. Which
 * table is RIGHT is Lee's call, not a refactor: it changes what every paying member gets.
 */

export type PlanKey = "free" | "pro" | "vip";

export type PlanLimits = {
  key: PlanKey;
  /** Monthly price in US dollars. Free is 0. Keep in step with `price` in RENTAL_TIERS above. */
  priceUsd: number;
  houseRules: number;
  photos: number;
  descriptionChars: number;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  /* ✅ DECIDED BY LEE, 30 Sep 2026: the 12 September table — 15 / 30 / 100 photos and
     1,000 / 2,000 / 6,000 characters. Nobody loses photos: the cap only stops the NEXT upload. */
  free: { key: "free", priceUsd: 0,     houseRules: 3,  photos: 15,  descriptionChars: 1000 },
  pro:  { key: "pro",  priceUsd: 9.99,  houseRules: 10, photos: 30,  descriptionChars: 2000 },
  vip:  { key: "vip",  priceUsd: 29.99, houseRules: 50, photos: 100, descriptionChars: 6000 },
};

/** Anything unrecognised is Free. An unknown plan must never unlock more than a known one. */
export function planLimits(plan: string | null | undefined): PlanLimits {
  const key = String(plan ?? "").toLowerCase();
  return key === "vip" ? PLAN_LIMITS.vip : key === "pro" ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
}

