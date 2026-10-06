import type { Filters } from "../components/FilterSheet";

/**
 * ONEHOME RANKING — what comes first, and why, when somebody has filtered.
 * ============================================================================================
 * Lee, 12 September 2026:
 *
 *   *"we'll get rid of the sponsored thing... use Airbnb's model."*
 *
 * ── THE TWO FEEDS, AND THE RULE THAT SEPARATES THEM ─────────────────────────────────────────
 * **Nothing has filtered anything → newest first.** A reader who has asked no question has not
 * told us what "best" means, and imposing a ranking on them is a guess dressed as a service. It
 * also has a second job: a new listing is visible the day it goes up, which is the only thing a
 * host on their first listing actually cares about.
 *
 * **Somebody has filtered → this file.** Once a reader has said "two bedrooms, El Poblado, under
 * two million", they have stated what they want, and putting the closest answer first is the
 * service. This is Airbnb's stated order, in their order of weight:
 *
 *   1. listing quality        2. popularity        3. price and value
 *   4. location               5. how well it matches what was asked for
 *
 * ── THE RULE THAT MAKES IT TRUSTWORTHY ──────────────────────────────────────────────────────
 * **A plan is not an input.** Free, Pro and VIP score identically. There is no placement to buy,
 * no boost, no featured slot and no tie-breaker that money reaches. If a future version of this
 * file gains a `plan` term, the marketplace has changed into an advertising business and the
 * comment at the top of `plans.ts` explains why that is worse for both sides.
 *
 * ── AND THE RULE THAT KEEPS IT HONEST ───────────────────────────────────────────────────────
 * Every term below is computed from data that actually exists on a listing row TODAY. Nothing
 * here reads a column that has to be invented first. Where a signal is real but not yet
 * collected — popularity is the only one — it contributes exactly zero and says so, rather than
 * being faked from a proxy. A ranking with a made-up term is worse than a ranking without it,
 * because nobody can tell which results it moved.
 */

/* ⚠️ THESE WEIGHTS ARE OURS, NOT AIRBNB'S — Max, 12 Sep 2026: *"do not represent chosen ranking
   weights as verified Airbnb internals."* Correct, and worth stating where somebody will read it.

   What comes from Airbnb is the ORDER, which they publish: listing quality, then popularity, then
   price and value, then location, then how well a place matches what was asked for. **The numbers
   below are mine.** Airbnb does not publish its weights and nobody here has seen them. They are a
   first guess at that stated order, chosen so each term outranks the next and they sum to 1, and
   they should be tuned against real results rather than defended.

   Each term returns 0..1, so a total is readable as a percentage when we come to explain a
   result to a host. */
const W_QUALITY = 0.32, W_POPULAR = 0.22, W_VALUE = 0.20, W_LOCATION = 0.14, W_MATCH = 0.12;

/* ⚠️ ONE WEIGHT TABLE, AND BOTH CALLERS USE IT — Max's second ranking correction, 12 Sep 2026.
   `rankListings` redistributed the uncollected popularity weight; `rankReasons` used the raw
   weights. So the numbers that explained an order were not the numbers that produced it. An
   explanation that disagrees with the thing it explains is worse than no explanation, because it
   is the artefact someone reaches for when they are already confused.

   Popularity is not collected (see `popularityScore`), so its weight is spread across the terms
   that are real rather than silently scoring every listing 0.22 lower — a dead term must not
   flatten the live ones. When counters exist, `POPULARITY_COLLECTED` becomes true and this
   function returns the declared weights unchanged. */
function liveWeights(): { q: number; p: number; v: number; l: number; m: number } {
  if (POPULARITY_COLLECTED) return { q: W_QUALITY, p: W_POPULAR, v: W_VALUE, l: W_LOCATION, m: W_MATCH };
  const k = 1 / (W_QUALITY + W_VALUE + W_LOCATION + W_MATCH);
  return { q: W_QUALITY * k, p: 0, v: W_VALUE * k, l: W_LOCATION * k, m: W_MATCH * k };
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const loose = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * 1 · QUALITY — is this listing actually finished?
 *
 * Not "is the flat nice", which we cannot know. It is: did the host do the work. A listing with
 * twelve photos, a video, a real description and the attributes answered tells a tenant far more
 * than one with three photos and "nice apartment", and it is the difference a tenant feels as
 * quality. It also rewards exactly the behaviour that makes the marketplace work, which is why
 * it carries the most weight.
 *
 * The agent's OneScore is a component because credibility IS quality here and it cannot be
 * bought — it is the company's whole thesis. A missing score contributes nothing rather than
 * penalising a new host into invisibility.
 */
export function qualityScore(l: any, agentScore?: number | null): number {
  const photos = Array.isArray(l.photos) ? l.photos.length : 0;
  const videos = Array.isArray(l.videos) ? l.videos.length : 0;
  const desc = String(l.description ?? "").trim().length;

  /* Eight photos is where a listing stops being a teaser; beyond fifteen it is no longer better,
     just longer, so the curve flattens rather than rewarding a hundred near-identical shots. */
  const photoTerm = clamp01(photos / 8) * 0.7 + clamp01((photos - 8) / 7) * 0.3;
  const videoTerm = videos > 0 ? 1 : 0;
  const descTerm = clamp01(desc / 400);

  /* The attributes a tenant asks about unprompted. Answered, not merely present. */
  const answered = [
    l.bedrooms != null, l.bathrooms != null, l.area_m2 != null, l.max_guests != null,
    !!l.available_from, l.property_type != null, l.parking_spaces != null,
    Array.isArray(l.amenities) && l.amenities.length > 0,
  ].filter(Boolean).length;
  const completeTerm = clamp01(answered / 8);

  /* OneScore is published 0..100. Absent = neutral, never a penalty. */
  const scoreTerm = agentScore == null ? 0 : clamp01(Number(agentScore) / 100);
  const scoreWeight = agentScore == null ? 0 : 0.25;

  const base = photoTerm * 0.3 + videoTerm * 0.12 + descTerm * 0.2 + completeTerm * 0.13;
  return clamp01((base + scoreTerm * scoreWeight) / (0.75 + scoreWeight));
}

/**
 * 2 · POPULARITY — **zero today, and deliberately so.**
 *
 * Airbnb ranks on how many people click, save and book a listing. OneHome collects none of those
 * on `rental_properties`: there is no view count, no save count and no booking count on the row.
 *
 * The tempting move is to substitute something that correlates — listing age, photo count again,
 * the agent's other listings — and call it popularity. That would be a made-up term, and the
 * damage is not the inaccuracy: it is that nobody afterwards can tell which results it moved or
 * whether the ranking is working. So this returns 0 for every listing and its weight is
 * redistributed across the terms that are real (see `rank`).
 *
 * When view/save/enquiry counters exist, this function is the one place that changes.
 */
export function popularityScore(_l: any): number { return 0; }
export const POPULARITY_COLLECTED = false;

/* VALUE COMPARISONS NEED ONE MONEY/TIME UNIT BEFORE THEY NEED A MEDIAN.
   `rental_properties.price` is stored in the listing's own `currency` and `price_unit`; the
   listing form writes both USD and COP, and both nightly and monthly rents. Comparing those raw
   numbers makes COP 4,000,000 look thousands of times dearer than USD 2,000, and makes USD 100 a
   night look cheaper than USD 2,000 a month. Normalize to USD per 30 nights first. The 30-day
   figure is only a ranking comparison unit; it does not alter billing or quote a stay.

   A COP listing carries the official rate saved with it in `display_fx_rate`. Without a usable
   rate its value is unknown and therefore neutral; guessing a rate would create a confident but
   false order. Missing currency/unit retain the legacy USD/month interpretation used elsewhere.

   ⚠️ THIS IS MAX'S CODE, APPLIED AS HE WROTE IT rather than re-derived. He found that my value
   term compared raw stored numbers, so in Medellin — where most listings are in pesos — every COP
   listing was ranked against USD ones as though four million were four million dollars. He asked
   for alignment with his exact patch rather than a competing implementation, which is right: two
   implementations of one money rule is how the rule stops being one rule. */
/* ⚠️ MAX'S MISSING-UNIT CORRECTION, 12 Sep 2026, and it is the sharper half of the units
   finding. The first version wrote `l.currency ?? "USD"` and `l.price_unit ?? "month"`. Those
   two `??` were doing something I had not admitted to myself: turning a BLANK field into a
   STATED one. Max:

     "the prepared patch defaults null/undefined currency to USD and period to month. It does
      not make these ambiguous cases neutral. Accepted ListProperty UI defaults establish a
      current UI convention, not the meaning of every historical null record."

   Exactly right, and the damage is asymmetric. A Medellin listing stored at 4,000,000 with no
   currency read as four million DOLLARS a month and sank every real listing in the cohort by
   dragging the median up; the same row with no period read as a monthly price when it may have
   been nightly. Neither is a small error at the edges - each one rewrites the meaning of the
   number by three orders of magnitude, and it does it silently, on rows nobody is looking at.

   I cannot supply the contract that would justify the default. The authoritative stored-data
   default for historical rows is not something I can read from the form that writes new ones,
   and Max said so before I could get it wrong a second time. So a missing unit is now what it
   actually is: UNKNOWN. An unknown price is not comparable, and this function's whole job is to
   answer "is this comparable, and if so at what". It returns null, `valueScore` gives 0.5 -
   the same neutral it already gives a listing with no price at all - and the cohort median is
   computed without it. The listing is still shown, still ranked on every other term, and is
   neither rewarded nor punished for a blank column.

   What has NOT changed, deliberately: an explicitly unsupported currency and a COP row with no
   usable rate still return null exactly as before. This narrows what counts as stated; it does
   not widen what counts as supported. */
function comparablePrice(l: any): number | null {
  const raw = Number(l.price);
  if (!(Number.isFinite(raw) && raw > 0)) return null;

  /* A blank, null or whitespace-only unit is absent, not a default. */
  const stated = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
  };

  const currency = stated(l.currency)?.toUpperCase() ?? null;
  if (currency === null) return null;

  let usd = raw;
  if (currency === "COP") {
    const rate = Number(l.display_fx_rate);
    if (!(Number.isFinite(rate) && rate > 0)) return null;
    usd = raw / rate;
  } else if (currency !== "USD") {
    return null;
  }

  const period = stated(l.price_unit)?.toLowerCase() ?? null;
  if (period === null) return null;

  /* 30 nights is a COMPARISON convention so a nightly and a monthly price can sit on one axis.
     It is not a billing figure, it never reaches a contract, and no stored amount is rewritten. */
  if (period === "night") usd *= 30;
  else if (period !== "month") return null;

  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

/**
 * 3 · PRICE AND VALUE — cheap for what it is, not cheap.
 *
 * Compared against the median of the CURRENT result set, per square metre when both sides have an
 * area and per listing when they do not. Comparing against the whole market would rank a studio
 * above a family flat for a reader who filtered for three bedrooms, which is the opposite of
 * useful. A listing at the median scores 0.5; materially cheaper for the same space scores
 * higher; more expensive scores lower and is still shown, because expensive is a legitimate
 * answer to "what is available".
 */
export function valueScore(l: any, medianUnit: number, useArea: boolean): number {
  if (!(medianUnit > 0)) return 0.5;
  const price = comparablePrice(l);
  if (price == null) return 0.5;
  const parsedArea = Number(l.area_m2);
  const area = Number.isFinite(parsedArea) && parsedArea > 0 ? parsedArea : null;

  /* ⚠️ MAX'S RANKING CORRECTION, 12 Sep 2026, AND HE WAS RIGHT.
     The first version compared a whole-listing price against a price-PER-SQUARE-METRE median
     whenever the cohort had gone area-based. His example: two 100 m² listings at 1,000 and 2,000
     give units of 10 and 20, and a listing with no area at 1,500 is compared as 1,500 against a
     median of 20. It scores zero and is buried — not because it is poor value but because nobody
     typed a size. In Medellín that is a large share of listings, so the defect would have
     quietly sunk a whole class of them.

     A listing with no area is not comparable in an area-based cohort, so it is not compared.
     0.5 is the same neutral this function already gives a listing with no price: it neither
     rewards nor punishes a missing fact. The alternative — dropping it out of the results — hides
     a real listing from a tenant over a blank field, which is worse. */
  if (useArea && area == null) return 0.5;

  const unit = useArea ? price / area! : price;
  /* A ratio of 1 is the median. Half the median scores 1, twice the median scores 0. */
  return clamp01(1 - (unit / medianUnit - 0.5));
}

/**
 * 4 · LOCATION — how precisely it answers the place that was asked for.
 *
 * Only meaningful once a place has been named; with no city and no neighbourhood in the filter
 * every listing is equally on-target and this returns a flat 0.5 rather than inventing a centre
 * of town. A named neighbourhood that matches beats a city-only match, because someone who typed
 * "Laureles" meant Laureles.
 */
export function locationScore(l: any, f: Filters): number {
  const wantHood = f.neighbourhood.trim();
  const wantCity = f.city.trim();
  if (!wantHood && !wantCity) return 0.5;
  if (wantHood) {
    const a = loose(l.neighbourhood), b = loose(wantHood);
    if (a && b && (a.includes(b) || b.includes(a))) return 1;
    return wantCity && loose(l.city).includes(loose(wantCity.split(",")[0])) ? 0.6 : 0.3;
  }
  return loose(l.city).includes(loose(wantCity.split(",")[0])) ? 1 : 0.3;
}

/**
 * 5 · MATCH — how far it EXCEEDS what was asked, not whether it qualifies.
 *
 * `matches()` in FilterSheet has already thrown out everything that fails. Every listing reaching
 * this point qualifies, so the question left is which of them answers the request most generously:
 * three bedrooms when two were asked for, six of the eight amenities on the list rather than
 * exactly the two that were required, a price comfortably inside the ceiling.
 */
export function matchScore(l: any, f: Filters): number {
  const parts: number[] = [];
  const over = (have: unknown, want: number | null, cap: number) => {
    if (want == null) return;
    const h = Number(have);
    if (!Number.isFinite(h)) { parts.push(0.5); return; }
    parts.push(clamp01((h - want) / cap) * 0.5 + 0.5);
  };
  over(l.bedrooms, f.minBeds, 2);
  over(l.bathrooms, f.minBaths, 2);
  over(l.area_m2, f.minArea, 60);
  over(l.max_guests, f.minGuests, 3);
  over(l.parking_spaces, f.minParking, 2);

  if (f.amenityKeys.length) {
    const have = new Set((Array.isArray(l.amenities) ? l.amenities : []).map(loose));
    const extra = [...have].length - f.amenityKeys.length;
    parts.push(clamp01(extra / 6) * 0.5 + 0.5);
  }
  if (f.maxPrice != null) {
    const price = Number(l.price) || 0;
    parts.push(price > 0 && f.maxPrice > 0 ? clamp01(1 - price / f.maxPrice) * 0.5 + 0.5 : 0.5);
  }
  if (!parts.length) return 0.5;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export interface RankedReasons {
  quality: number; popularity: number; value: number; location: number; match: number; total: number;
}

/**
 * THE COHORT — the two numbers the value term is judged against, computed ONCE.
 * ============================================================================================
 * Exported, and that is the point. `rankReasons` takes `medianUnit` and `useArea` as arguments,
 * so any caller wanting to EXPLAIN a result has to produce them — and a caller that computes
 * them slightly differently produces an explanation that disagrees with the order it is
 * explaining. That is Max's RANK-2 finding wearing a different hat: the first time, the
 * explanation used the raw weights while the ranking used the redistributed ones; this is the
 * same failure one argument to the left.
 *
 * One function, both callers, and the guard proves the agreement by executing it.
 *
 * The median is taken over ONE cohort, never a mix. In an area-based cohort only rows that HAVE
 * an area contribute — putting a whole-listing price into a per-square-metre median drags the
 * median up by two orders of magnitude and makes every real listing look like a bargain against
 * it. Rows with no comparable price are excluded rather than counted as zero (see
 * `comparablePrice`, and Max's missing-unit correction above).
 */
export function rankCohort(list: any[]): { medianUnit: number; useArea: boolean } {
  /* Per m² when most of the set has an area. One pass, because this runs on every filter change
     on a phone. */
  const areas = list.filter(l => {
    const area = Number(l.area_m2);
    return Number.isFinite(area) && area > 0;
  }).length;
  const useArea = areas >= Math.ceil(list.length * 0.6);
  const units = list
    .map(l => {
      const p = comparablePrice(l), a = Number(l.area_m2);
      if (p == null) return 0;
      if (useArea) return Number.isFinite(a) && a > 0 ? p / a : 0;
      return p;
    })
    .filter(n => n > 0)
    .sort((a, b) => a - b);
  return { medianUnit: units.length ? units[Math.floor(units.length / 2)] : 0, useArea };
}

/**
 * WHEN THE RANKING RUNS AT ALL — the rule, as a function, so it can be tested rather than read.
 * ============================================================================================
 * Lee's rule, and the whole reason the unfiltered feed is trustworthy: **a reader who has asked
 * no question has not told us what "best" means.** Nothing filtered → newest first, and a new
 * host's first listing is visible the day it goes up. Something filtered → the closest answer
 * first.
 *
 * This lived inline in the feed's `useMemo`, which meant any guard checking it had to
 * re-implement it — and a guard that re-implements the rule tests the guard author's reading of
 * the code rather than the code. Max asked for caller-level cases proving the ranking is invoked
 * ONLY in its intended filtered mode; those cases need something to call.
 *
 * Both conditions are required, deliberately. `sort === "match"` alone would rank an unfiltered
 * feed the moment somebody picked "Best match" from the menu with no filters set, and with no
 * question asked there is nothing to be a good match FOR.
 */
export const rankingApplies = (sort: string, filterCount: number): boolean =>
  sort === "match" && filterCount > 0;

/**
 * The one entry point. Returns a NEW array, newest-first among equals so that two listings which
 * genuinely score the same do not shuffle on every render — an unstable feed reads as a bug, and
 * a host who refreshes and cannot find their own place assumes it was removed.
 *
 * `agentScores` is optional: a map of agent id to published OneScore. Absent, quality simply
 * loses that component for everybody, which is fair rather than partial.
 */
export function rankListings<T extends Record<string, any>>(
  list: T[], f: Filters, agentScores?: Map<string, number | null>,
): T[] {
  if (list.length < 2) return [...list];

  const { medianUnit, useArea } = rankCohort(list);

  const live = liveWeights();

  const scored = list.map((l, i) => {
    const agentScore = agentScores?.get(String(l.agent_id)) ?? null;
    const quality = qualityScore(l, agentScore);
    const popularity = popularityScore(l);
    const value = valueScore(l, medianUnit, useArea);
    const location = locationScore(l, f);
    const match = matchScore(l, f);
    const total =
      quality * live.q + popularity * live.p + value * live.v + location * live.l + match * live.m;
    return { l, i, total, created: String(l.created_at ?? "") };
  });

  scored.sort((a, b) => {
    if (Math.abs(b.total - a.total) > 1e-9) return b.total - a.total;
    const byDate = b.created.localeCompare(a.created);
    /* Same score AND same timestamp: keep the incoming order, so the feed never shuffles. */
    return byDate !== 0 ? byDate : a.i - b.i;
  });
  return scored.map(s => s.l);
}

/** For a "why is this first" panel later, and for the tests. Never shown to a tenant as a number. */
export function rankReasons(
  l: any, f: Filters, medianUnit: number, useArea: boolean, agentScore?: number | null,
): RankedReasons {
  const quality = qualityScore(l, agentScore);
  const popularity = popularityScore(l);
  const value = valueScore(l, medianUnit, useArea);
  const location = locationScore(l, f);
  const match = matchScore(l, f);
  const w = liveWeights();
  return {
    quality, popularity, value, location, match,
    total: quality * w.q + popularity * w.p + value * w.v + location * w.l + match * w.m,
  };
}
