/**
 * ONEEVENT PLAN LIMITS — how many photos and videos an event may carry, per plan.
 * ============================================================================================
 * OneEvent 30, 20 September 2026. Same shape as OneHome's `planLimits.ts` so the shared media
 * step (PhotoDeck → PublicVideoDeck → MediaChoices) reads one `{ photos, videos }` on both.
 *
 * THE NUMBERS ARE ONEHOME'S — Lee, 20 Sep 2026: *"adopt the same limitations that are already
 * there for OneHome, just put them for OneEvent."* OneHome's listing form enforces photos 8 / 25 /
 * 50 (`onerental/lib/plans.ts`) and lets every plan add up to five videos (the uploader's own
 * cap; OneHome's written 1 / 3 / 5 video ladder in `onerental/lib/planLimits.ts` is not wired to
 * its form). Same numbers here, so a host who knows one product knows the other.
 *
 * A cap governs what you may ADD. It never deletes or hides what an event already has.
 *
 * Plan resolution is the account's `one_world_plan(user, app)`; VIP is account-wide (18 Sep).
 * The form reads `subscription.plan` from `useAuth`, which already inherits that precedence.
 */
export type EventPlan = "free" | "pro" | "vip";

export interface EventPlanLimits {
  /** Photos on one event. The first (or the chosen one) is the cover. */
  photos: number;
  /** Public videos on one event. Any one of them may lead the Discover card. */
  videos: number;
}

export const EVENT_PLAN_LIMITS: Record<EventPlan, EventPlanLimits> = {
  free: { photos: 8,  videos: 5 },
  pro:  { photos: 25, videos: 5 },
  vip:  { photos: 50, videos: 5 },
};

export const eventPlanOf = (raw?: string | null): EventPlan =>
  raw === "pro" || raw === "vip" ? raw : "free";

export const eventLimitsFor = (raw?: string | null): EventPlanLimits =>
  EVENT_PLAN_LIMITS[eventPlanOf(raw)];
