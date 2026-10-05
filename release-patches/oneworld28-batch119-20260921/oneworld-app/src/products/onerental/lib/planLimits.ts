/**
 * ONEHOME PLAN LIMITS — the one place that answers "how much does this plan allow?"
 * ============================================================================================
 * Lee, 12 September 2026, after walking Airbnb's create-a-listing flow:
 *
 *   *"for free, fifteen photos... Pro gives thirty... VIP a hundred photos and five videos. One
 *   video for free... Pro three videos... Pro maybe high definition. A thousand characters free,
 *   two thousand Pro, six thousand VIP."*
 *
 * And the ruling that shapes everything else in this file:
 *
 *   *"we'll get rid of the sponsored thing... use Airbnb's model."*
 *
 * ── WHAT A PLAN BUYS, AND WHAT IT CANNOT BUY ────────────────────────────────────────────────
 * A plan buys CAPACITY — how much of your property you are allowed to show, and how many places
 * you can run at once. A plan does NOT buy ATTENTION. It never moves a listing up a feed, never
 * wins a tie in search, and is not an input to ranking at any point.
 *
 * This is a reversal of `plans.ts` as it stood until today, which promised *"your places rank
 * above free listings in the feed"*, *"featured at the top of your city's feed"* and *"first in
 * agent search"*. All three are gone. They were the sponsored model, and Lee killed it for the
 * reason that makes it worth writing down: **the moment the top of a feed is for sale, the top of
 * the feed stops being information.** A tenant learns within a week that the first three results
 * are adverts and starts scrolling past them, so the seller pays for a position nobody reads and
 * the buyer trusts the whole feed less. Airbnb sells no placement at all, and it is the largest
 * marketplace of its kind. Capacity is honest: a host who pays gets to show more of the flat, and
 * the tenant who sees it is better informed, not worse.
 *
 * ── THE ONE RULE THAT MAKES THE CAPS SAFE ───────────────────────────────────────────────────
 * A cap governs what you may ADD. It never deletes, hides or rejects what is already there. A
 * host who uploaded forty photos before this file existed keeps forty photos; they simply cannot
 * add a forty-first until they move up. Silently dropping twenty-five of someone's photos
 * because a pricing decision was made in a different month is the kind of thing that ends a
 * marketplace's reputation in one screenshot.
 *
 * ⚠️ NOT WIRED TO STRIPE, AND SAY IT PRECISELY. `planOf()` itself accepts "pro" and "vip" and
 * returns them; what is true today is that **the listing form calls it with `null`**, because
 * there is no entitlement source to read yet, so every host resolves to "free". Max corrected an
 * earlier note of mine that said the function always returns free — it does not, and the
 * difference matters to whoever wires the entitlement: they change the CALLER, not this helper.
 *
 * And the caps are enforced **in the client only**. Nothing at the database refuses a sixteenth
 * photo. That is deliberate — a server rule written before there is a plan to read would reject
 * listings for a tier nobody is on — but it means these limits are not plan ENFORCEMENT yet.
 * They are an honest description of what the form allows.
 */

export type RentalPlan = "free" | "pro" | "vip";

export interface PlanLimits {
  /** How many photos this plan may have on one listing. */
  photos: number;
  /** How many videos this plan may have on one listing. */
  videos: number;
  /** How many characters the public description may run to. */
  description: number;
  /** Longest single video, in seconds. */
  videoSeconds: number;
  /* ⚠️ `videoHeight` WAS HERE AND IS DELIBERATELY GONE — Max, 12 Sep 2026: *"verify
     duration/quality promises against the actual upload/transcode path before claiming them
     delivered."*

     Lee asked for *"Pro maybe high definition"*, and I encoded 720p / 1080p / 4K as though it
     were a product fact. **There is no transcoder.** A video is stored exactly as it was
     uploaded, at whatever resolution the host's phone produced, on every plan. Selling
     "Video in 4K" on a tier that does nothing to the file is a promise the code cannot keep,
     and the first host who checks finds out we said something untrue about what they paid for.

     Longer video IS real and IS enforced — `videoSeconds` below is now read by the upload gate
     in `PublicVideoDeck`, not merely printed beside it. That delivers the half of Lee's "higher
     definition OR longer video" that we can actually stand behind. The quality half comes back
     the day there is an encode step, and not before. */
  /** How many listings may be live at once. `Infinity` is deliberate, not a missing number. */
  liveListings: number;
}

export const PLAN_LIMITS: Record<RentalPlan, PlanLimits> = {
  free: { photos: 15,  videos: 1, description: 1000, videoSeconds: 60,  liveListings: 1 },
  pro:  { photos: 30,  videos: 3, description: 2000, videoSeconds: 180, liveListings: 5 },
  vip:  { photos: 100, videos: 5, description: 6000, videoSeconds: 300, liveListings: Infinity },
};

export const PLAN_ORDER: readonly RentalPlan[] = ["free", "pro", "vip"];

/** The plan above this one, or null at the top. Drives every "what would more get me" line. */
export const nextPlan = (p: RentalPlan): RentalPlan | null =>
  PLAN_ORDER[PLAN_ORDER.indexOf(p) + 1] ?? null;

export const PLAN_NAME: Record<RentalPlan, [en: string, es: string]> = {
  free: ["Free", "Gratis"],
  pro:  ["Pro", "Pro"],
  vip:  ["VIP", "VIP"],
};

/**
 * The member's plan. One function, so the money leg has exactly one place to land.
 *
 * It takes the raw value rather than reading it itself, because the caller already holds the
 * profile and a second fetch here would be a second source of truth. An unrecognised value —
 * null, a legacy string, a plan that was renamed — falls to "free" rather than throwing: a host
 * whose plan row is odd must still be able to list a property.
 */
export const planOf = (raw?: string | null): RentalPlan =>
  raw === "pro" || raw === "vip" ? raw : "free";

export const limitsFor = (plan: RentalPlan): PlanLimits => PLAN_LIMITS[plan];

/**
 * What to tell somebody who has just hit a cap.
 *
 * Returns null when there is nothing to say — either they are under the cap, or they are on VIP
 * and there is no rung above. **A control is never disabled with an unexplained stop.** Lee's
 * standing rule is that a greyed control which advertises a feature and then refuses it reads as
 * a broken app; the honest version names the number, names the plan, and names the next number.
 */
export function capNote(
  plan: RentalPlan, kind: "photos" | "videos" | "description", used: number, es: boolean,
): string | null {
  const limit = PLAN_LIMITS[plan][kind];
  if (used < limit) return null;
  const up = nextPlan(plan);
  if (!up) return null;
  const more = PLAN_LIMITS[up][kind];
  const upName = PLAN_NAME[up][es ? 1 : 0];
  const n = (v: number) => v.toLocaleString(es ? "es-CO" : "en-US");
  if (kind === "description") {
    return es
      ? `Llegó a ${n(limit)} caracteres. ${upName} permite ${n(more)}.`
      : `That is your ${n(limit)} characters. ${upName} allows ${n(more)}.`;
  }
  const thing = kind === "photos"
    ? (es ? "fotos" : "photos")
    : (es ? "videos" : "videos");
  return es
    ? `Llegó a ${n(limit)} ${thing}. ${upName} permite ${n(more)}.`
    : `That is your ${n(limit)} ${thing}. ${upName} allows ${n(more)}.`;
}

/**
 * The cap to hand a deck, given what is already on the listing.
 *
 * This is the "never delete what is already there" rule, in one line. If a host is already over
 * the cap — uploaded before the caps existed, or downgraded — the deck's maximum becomes what
 * they have, so every existing item stays visible and reorderable and only the ADD control is
 * closed. A host who has never been over the cap sees the cap.
 */
export const effectiveCap = (limit: number, existing: number): number => Math.max(limit, existing);
