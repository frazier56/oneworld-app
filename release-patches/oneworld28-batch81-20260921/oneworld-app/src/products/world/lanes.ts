import { HUES, PRODUCT_PATH, type AppKey } from "@oneworld/shell";

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
export type LaneKey = "home" | "events" | "jobs" | "socials";

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
