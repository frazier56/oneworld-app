import { HUES, ONE_WORLD_HUE, PRODUCT_PATH, type AppKey } from "@oneworld/shell";

/**
 * THE FOUR LANES OF THE WORLD FEED.
 * ============================================================================================
 * Lee, 20 September 2026: *"Homes, Events, Jobs, Socials — sideways changes lane, up and down
 * stays inside it."* Plural, and with no "One" prefix: the lane is the KIND OF THING you are
 * looking at, not the product that happens to store it. A person in Events must never scroll
 * past a job, which was his core objection to one mixed feed.
 *
 * ⛔ There is no OneScore lane. A score is a property of a person, not a thing to swipe through.
 *
 * The hue is the product's own `bright` step — the identity colour, the one chosen to glow — so
 * the dot beside the lane name is the same blue, orange, green and violet the member already
 * knows from the launcher. It is used for the dot, the glow on the tab bar and the drawn card,
 * and NEVER for text: `bright` does not measure for contrast and the ramp says so.
 */
export type LaneKey = "all" | "home" | "events" | "jobs" | "socials";

/** The four lanes that actually FETCH. "all" is derived from these and reads nothing of its own. */
export type SourceLaneKey = Exclude<LaneKey, "all">;
export const SOURCE_LANES: SourceLaneKey[] = ["home", "events", "jobs", "socials"];

export type Lane = {
  key: LaneKey;
  /** The product whose real screens, feed, profile and messages this lane opens. */
  app: AppKey;
  en: string;
  es: string;
  /** The product's identity colour. Decoration only. */
  hue: string;
  /** The classic feed this lane is a different view OF. Never retired — Lee, item 11. */
  classicPath: string;
};

export const LANES: Lane[] = [
  /* ── EVERYTHING, AND WHY IT IS FIRST (Lee, 9 October 2026) ────────────────────────────────
     Lee: *"if you swipe far enough to the left, you get to all everything… homes, jobs,
     socials, events, it all comes into like one hodgepodge feed… and then if you start swiping
     right, you get to the individual ones."* He also agreed it is where a person should LAND.

     This does not reopen his September objection — *"a person in Events must never scroll past
     a job"* — because Events is untouched. Everything is its own lane that you leave by
     swiping, and the four pure lanes still sit to the right of it exactly as they did.

     Why it leads: at launch each single lane is thin, and a thin lane reads as an abandoned
     product. Merged, there is enough to scroll. The reader who knows what they want is one
     swipe from the pure lane, and the start lane is still whatever the address says.

     It FETCHES NOTHING. `byLane.all` in WorldFeed.tsx merges the cards the other four already
     loaded and sorts them newest first, so this lane costs no extra query, no extra row and no
     extra paging path — and it can never show something a pure lane would not. */
  /* The name is the BRAND, not a description, and a brand is not translated — so "One World" in
     both languages. "Feed" is left off because the thing you are looking at is a feed; the word
     would be the label explaining the label (Lee, 9 Oct: *"feed is implied, so just put One
     World there"*). */
  { key: "all",     app: "onesocial", en: "One World feed", es: "Feed de One World", hue: ONE_WORLD_HUE.bright, classicPath: PRODUCT_PATH.onesocial },
  { key: "home",    app: "onerental", en: "Homes",   es: "Casas",     hue: HUES.onerental.bright, classicPath: PRODUCT_PATH.onehome },
  { key: "events",  app: "oneevent",  en: "Events",  es: "Eventos",   hue: HUES.oneevent.bright,  classicPath: PRODUCT_PATH.oneevent },
  { key: "jobs",    app: "onejob",    en: "Jobs",    es: "Trabajos",  hue: HUES.onejob.bright,    classicPath: PRODUCT_PATH.onejob },
  { key: "socials", app: "onesocial", en: "Socials", es: "Sociales",  hue: HUES.onesocial.bright, classicPath: PRODUCT_PATH.onesocial },
];

export const laneAt = (i: number): Lane => LANES[Math.min(Math.max(i, 0), LANES.length - 1)];
export const laneIndex = (key: string | null): number => {
  const i = LANES.findIndex(l => l.key === key);
  return i < 0 ? 0 : i;
};
