/**
 * ACCESS STATE — one place that decides what a member's relationship to a product IS (Task 1.1.d).
 * ============================================================================================
 * The signed-in hub used to answer this inline with a free-vs-service split, which had no room for
 * a product that is not built yet — so OneAgent and OneApp rendered as "Free — turn it on any time",
 * inviting a member to open an app that does not exist.
 *
 * This is the single, pure, testable decision. It reads ONLY shared facts the shell already has —
 * whether the member holds the product (their One ID entitlement), whether it is a paid service
 * (`IS_SERVICE`), and whether it is built yet (`COMING_SOON`, shell config). No per-app logic, no
 * device flag, no data source of its own. Every product tile in the switcher gets its label from
 * here, so the four states can never drift apart or be re-implemented per app.
 */

export type AccessState =
  | "connected"     // the member holds it → open it
  | "available"     // a free app they can turn on
  | "subscription"  // a paid service they don't have yet → starts with a subscription
  | "coming-soon";  // not built yet → labelled, never turn-on-able

export interface AccessInputs {
  /** True if the member holds this product (an entitlement row exists). */
  held: boolean;
  /** True if this product is a paid service rather than a free app. */
  isService: boolean;
  /** True if this product is not built yet. */
  comingSoon: boolean;
}

/**
 * A real entitlement always wins: if the member holds it, it is Connected regardless of anything
 * else (a held product is, by definition, built). Otherwise an unbuilt product is Coming soon, a
 * paid one is a Subscription, and everything else is a free Available app.
 */
export function accessState({ held, isService, comingSoon }: AccessInputs): AccessState {
  if (held) return "connected";
  if (comingSoon) return "coming-soon";
  return isService ? "subscription" : "available";
}
