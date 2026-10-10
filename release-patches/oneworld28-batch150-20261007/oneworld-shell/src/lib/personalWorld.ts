/**
 * PERSONAL WORLD TITLE — the signed-in hub heading, made the member's own.
 * ============================================================================================
 * Lee's product direction (Max `MAX-20260805-1831`): once we know the person, the `/yourworld`
 * heading becomes THEIR world — "Isaac's World", "Joanna's World" — instead of a generic chooser.
 * Signed-out users never reach this; `OneWorldEntry` shows them the splash.
 *
 * Pure, no React, no client — so it is unit-testable and cannot throw. It reads ONLY the
 * `displayName` the shared `useOneId()` already exposes; it adds no data source. Graceful
 * fallbacks are the whole point: a missing name must never render a broken possessive.
 *
 * i18n: the possessive is language-shaped, not machine-translated word order. English uses "'s"
 * (and a bare apostrophe when the name already ends in s); Spanish/Portuguese use "el mundo de
 * {name}"; German appends "s" (apostrophe after s/ß/x/z); Chinese uses the 的 particle; Russian
 * keeps it simple with "Мир {name}". Anything we don't have a pattern for falls back to English,
 * and no name at all falls back to the caller's generic localized "Your World".
 */

/** First name for the heading: full name → first token; single word → itself; empty/blank/null →
 *  null, so the caller uses the generic fallback. */
export function firstNameOf(displayName: string | null | undefined): string | null {
  if (!displayName) return null;
  const first = displayName.trim().split(/\s+/)[0] ?? "";
  return first.length ? first : null;
}

type Pattern = (name: string) => string;

/** One clean, launch-ready possessive per shell language. Not perfect grammar in every case, but
 *  natural enough to ship, and never awkward. */
const OWNED_TITLE: Record<string, Pattern> = {
  en: (n) => `${n}${/s$/i.test(n) ? "'" : "'s"} World`,
  es: (n) => `El mundo de ${n}`,
  co: (n) => `El mundo de ${n}`,
  de: (n) => `${n}${/[sßxz]$/i.test(n) ? "'" : "s"} Welt`,
  ru: (n) => `Мир ${n}`,
  zh: (n) => `${n}的世界`,
  pt: (n) => `O mundo de ${n}`,
};

/**
 * The signed-in hub heading. When we know the member's name it is THEIR world, in their language;
 * otherwise the caller's generic fallback (the localized "Your World"). Never throws.
 */
export function personalWorldTitle(
  displayName: string | null | undefined,
  lang: string,
  fallback: string,
): string {
  const name = firstNameOf(displayName);
  if (!name) return fallback;
  return (OWNED_TITLE[lang] ?? OWNED_TITLE.en)(name);
}
