import { ONE_WORLD_LANGS, type Lang } from "./i18n";
import { CURRENCIES } from "./fx";

/**
 * ONE CONTROL, TWO SETTINGS — the country a reader picks decides their language AND their money.
 * ============================================================================================
 * Lee, 15 August 2026, looking at his own phone:
 *
 *   *"We had already had a requirement that we're not gonna have the language translation and the
 *   currency change in two different places… let's take away the icon for the currency and roll it
 *   into the flag. The flag represents the country. And based on that, this country has this
 *   language and this currency. So we should only have one icon at the top, not two."*
 *
 * ── THE BUG THAT PROVED HIM RIGHT ───────────────────────────────────────────────────────────
 * Two independent controls meant two independently stored values, and they drifted. His screenshot
 * showed the **United States flag** sitting beside **COP**. The header was telling the reader they
 * were American and that their money was Colombian, at the same time, in the same 40 pixels.
 * Neither control was broken. Having two of them was the defect.
 *
 * ── WHY THE COUNTRY IS THE RIGHT KEY, AND NOT THE LANGUAGE ──────────────────────────────────
 * Language does not imply money: Spain and Germany both read euros but Spanish and German; Spain
 * and Colombia share a language and not a currency. Country implies both, every time, with no
 * ambiguity anywhere in the seven One World offers. So the country is the key and the other two
 * are derived.
 *
 * ── ⚠️ AND THE ONE PLACE THE DERIVATION MUST NOT BE FORCED ──────────────────────────────────
 * OneHome's first market is *"expatriates and tourists in Medellín, Bogotá, Cali and Cartagena"*.
 * That reader wants **English text and Colombian peso prices** — the peso is the number they will
 * actually hand over at the counter. If picking the American flag forced dollars on them, the
 * merge would have made the app worse for exactly the person it was built for.
 *
 * So: picking a country sets both, which is what almost everybody will ever do. The currency then
 * remains separately settable **inside the same panel**, one tap deeper, for the minority who need
 * them apart. One icon in the header, one tap for the common case, and no trap for the core
 * customer. `DERIVED` below is a default, never a lock.
 */

export type CountryKey = (typeof ONE_WORLD_LANGS)[number]["code"];

/**
 * The seven countries One World offers, and the currency each one implies.
 *
 * Every code here MUST exist in `CURRENCIES` in `lib/fx.ts`, or the reader lands on a currency the
 * app holds no rate for and every price on the page draws as a missing number. `assertCountryMap()`
 * below is what stops that reaching a browser — a rate we do not have is a number we do not print,
 * never a number we guess.
 */
export const COUNTRY_CCY: Record<CountryKey, string> = {
  en: "USD",   // USA
  co: "COP",   // Colombia
  es: "EUR",   // España
  de: "EUR",   // Deutschland
  ru: "RUB",   // Россия
  zh: "CNY",   // 中国
  pt: "BRL",   // Brasil
};

/** The currency a country implies, or the dollar when a new language lands here before its money. */
export function ccyForCountry(code: string): string {
  return COUNTRY_CCY[code as CountryKey] ?? "USD";
}

/** The country row a language code belongs to — flag, label and country name for the picker. */
export function countryFor(code: string) {
  return ONE_WORLD_LANGS.find(l => l.code === code) ?? ONE_WORLD_LANGS[0];
}

/**
 * Every mapped currency really is one `fx.ts` can price. Called by the unit test, not at runtime —
 * a header is not the place to discover a typo, and throwing inside a paint would take the whole
 * app down over a currency code.
 *
 * This exists because of the `bg-surface` scar in a different costume: a name that looks obviously
 * right, never checked against the file that decides what exists.
 */
export function assertCountryMap(): string[] {
  const known = new Set(CURRENCIES.map(c => c.code));
  const bad: string[] = [];
  for (const l of ONE_WORLD_LANGS) {
    const c = COUNTRY_CCY[l.code as CountryKey];
    if (!c) bad.push(`${l.country}: no currency mapped`);
    else if (!known.has(c)) bad.push(`${l.country}: ${c} is not in CURRENCIES`);
  }
  return bad;
}

export type { Lang };
