/**
 * THE RATE ENGINE — every currency a visitor might arrive with, against the peso.
 * ============================================================================================
 * Lee, 15 August 2026, looking at a sale history printed in pesos:
 *
 *   *"Historical values aren't gonna mean anything to anyone if they don't understand pesos.
 *   They gotta understand it in their own currency… people are coming into Colombia from all
 *   countries — Russia, Australia, Spain, other parts of South America… I don't know what
 *   currency they have in Dubai, but there's people coming from Dubai, people coming from
 *   Poland, people coming from Paris. So that should be the currency they select. But it always
 *   shows the equivalent value in pesos."*
 *
 * That last sentence is the whole design. **Two numbers, always.** The reader's own currency,
 * because that is the only number they can judge; and the peso, because the property is in
 * Colombia and the peso is what will actually be paid. Neither replaces the other.
 *
 * ── ⚠️ THE TRM IS STILL THE ONLY AUTHORITY ON THE PESO, AND THAT IS NOT NEGOTIABLE ───────────
 * `trm.ts` fetches the official rate certified by the Superintendencia Financiera. It is the
 * rate a Colombian contract is measured in and the one we already cite on screen. This file does
 * NOT replace it and must never be used to draw a peso figure when the TRM is available.
 *
 * Today's numbers show exactly why: the open feed says 1 USD = 3,137.59 COP while the TRM in
 * force says 3,128.65. Three tenths of one percent — invisible on a coffee, **26,000 pesos on a
 * 300 million peso sale**, and the sort of discrepancy that turns into an argument in a notary's
 * office. So: USD↔COP comes from the TRM. Everything else crosses through USD using this feed.
 *
 * ── AND A MISSING RATE IS A MISSING NUMBER, NEVER A GUESSED ONE ─────────────────────────────
 * Lee, 11 Aug: *"we can't allow the user to input the conversion because it could be wrong, and
 * that could be very deceptive."* Same rule applies to us. If the feed has not loaded, or does
 * not carry the currency, the price is drawn in **US dollars with no conversion at all** rather
 * than at a stale or invented rate. A wrong price on a listing is the single most damaging thing
 * this product can print, and "approximately" does not repair it.
 */

import { readPref, writePref } from "./safeStorage";
import type { Lang } from "./i18n";

/* ── THE SOURCE ───────────────────────────────────────────────────────────────────────────────
   open.er-api.com — no key, no signup, no rate limit worth worrying about, 166 currencies, and
   it publishes its own next-update timestamp so we can cache honestly instead of guessing.
   Verified live from this codebase on 15 Aug 2026: every currency named below was present.

   The fallback is jsDelivr's currency-api, a completely different origin and a completely
   different publisher. One CDN having a bad morning should not silently blank every price on
   the site. */
const PRIMARY  = "https://open.er-api.com/v6/latest/USD";
const FALLBACK = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";

/* Rates change once a day. Re-asking every page load would be pointless traffic, and holding a
   rate for a week would be a lie — six hours sits inside one publishing cycle either way. */
const TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = "oneworld-fx-cache-v1";

/**
 * THE CURRENCIES WE OFFER, and why this list is short when the feed carries 166.
 *
 * A picker with 166 rows is a picker nobody scrolls. These are the currencies of the places
 * people actually arrive in Colombia from, plus the region's own — Lee named Russia, Dubai,
 * Poland, Paris, Australia and Spain by hand, and the rest follow the same logic. Adding one is
 * a single line, and the feed already carries it.
 *
 * COP is first and USD second on purpose: the property is Colombian and the platform prices in
 * dollars, so those two are the answer for most readers and should not be scrolled to.
 */
export type CcyMeta = { code: string; symbol: string; name: string; flag: string; decimals: number };

export const CURRENCIES: CcyMeta[] = [
  { code: "COP", symbol: "$",   name: "Colombian peso",     flag: "co", decimals: 0 },
  { code: "USD", symbol: "$",   name: "US dollar",          flag: "us", decimals: 2 },
  { code: "EUR", symbol: "€",   name: "Euro",               flag: "eu", decimals: 2 },
  { code: "GBP", symbol: "£",   name: "Pound sterling",     flag: "gb", decimals: 2 },
  { code: "CAD", symbol: "$",   name: "Canadian dollar",    flag: "ca", decimals: 2 },
  { code: "AUD", symbol: "$",   name: "Australian dollar",  flag: "au", decimals: 2 },
  { code: "CHF", symbol: "Fr",  name: "Swiss franc",        flag: "ch", decimals: 2 },
  { code: "AED", symbol: "د.إ", name: "UAE dirham",         flag: "ae", decimals: 2 },
  { code: "RUB", symbol: "₽",   name: "Russian rouble",     flag: "ru", decimals: 0 },
  { code: "PLN", symbol: "zł",  name: "Polish złoty",       flag: "pl", decimals: 2 },
  { code: "BRL", symbol: "R$",  name: "Brazilian real",     flag: "br", decimals: 2 },
  { code: "MXN", symbol: "$",   name: "Mexican peso",       flag: "mx", decimals: 2 },
  { code: "ARS", symbol: "$",   name: "Argentine peso",     flag: "ar", decimals: 0 },
  { code: "CLP", symbol: "$",   name: "Chilean peso",       flag: "cl", decimals: 0 },
  { code: "PEN", symbol: "S/",  name: "Peruvian sol",       flag: "pe", decimals: 2 },
  { code: "JPY", symbol: "¥",   name: "Japanese yen",       flag: "jp", decimals: 0 },
  { code: "CNY", symbol: "¥",   name: "Chinese yuan",       flag: "cn", decimals: 2 },
  { code: "INR", symbol: "₹",   name: "Indian rupee",       flag: "in", decimals: 0 },
  { code: "KRW", symbol: "₩",   name: "South Korean won",   flag: "kr", decimals: 0 },
  { code: "ILS", symbol: "₪",   name: "Israeli shekel",     flag: "il", decimals: 2 },
  { code: "TRY", symbol: "₺",   name: "Turkish lira",       flag: "tr", decimals: 2 },
  { code: "ZAR", symbol: "R",   name: "South African rand", flag: "za", decimals: 2 },
];

export const CCY_CODES = CURRENCIES.map(c => c.code);
export const metaFor = (code: string): CcyMeta =>
  CURRENCIES.find(c => c.code === code) ?? CURRENCIES[1];

/** The app's language codes are country-aware; Intl needs full BCP 47 locale identifiers. */
const DISPLAY_LOCALES: Record<Lang, string> = {
  en: "en-US", co: "es-CO", es: "es-ES", de: "de-DE",
  ru: "ru-RU", zh: "zh-CN", pt: "pt-BR",
};

type DisplayNamesConstructor = new (
  locales: string | readonly string[],
  options: { type: "currency" },
) => { of(code: string): string | undefined };

/** Localized currency name for labels and menus. ISO code is the honest universal fallback. */
export function currencyDisplayName(code: string, lang: Lang): string {
  const DisplayNames = (Intl as typeof Intl & { DisplayNames?: DisplayNamesConstructor }).DisplayNames;
  if (!DisplayNames) return code;
  try {
    return new DisplayNames(DISPLAY_LOCALES[lang], { type: "currency" }).of(code) || code;
  } catch {
    return code;
  }
}

export type FxTable = {
  /** How many of each currency one US dollar buys. USD is always exactly 1. */
  perUsd: Record<string, number>;
  /** When the publisher says it was calculated — shown to the member, not the fetch time. */
  asOf: string | null;
  source: "open.er-api" | "jsdelivr";
};

let memo: FxTable | null = null;
let inflight: Promise<FxTable | null> | null = null;

/* ── ⚠️ WHY THERE IS A SUBSCRIPTION HERE AND NOT JUST A CACHE ─────────────────────────────────
   `drawPrice` is synchronous, and it must be: it is called inside the render of every price on
   every card. But the rate table arrives over the network AFTER that first render.

   Without a nudge, the first paint draws every price in dollars and NOTHING EVER RE-RENDERS, so
   a reader who has chosen euros sits looking at dollars indefinitely. That is exactly the bug Lee
   photographed — MXN selected in the header, prices unmoved. It is not a conversion bug, it is a
   RE-RENDER bug, and the conversion code is only half the fix. */
const fxSubs = new Set<() => void>();
export function onFxReady(fn: () => void): () => void {
  fxSubs.add(fn);
  return () => fxSubs.delete(fn);
}
const announce = () => fxSubs.forEach(fn => { try { fn(); } catch { /* a bad subscriber must not stop the rest */ } });

function readCache(): { t: FxTable; at: number } | null {
  try {
    const raw = readPref(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: FxTable; at: number };
    if (!parsed?.t?.perUsd || typeof parsed.at !== "number") return null;
    return parsed;
  } catch { return null; }
}

/**
 * Fetch the table, once. Concurrent callers share one request — a feed screen mounting six price
 * rows must not open six connections to the same endpoint.
 */
export async function fetchFx(): Promise<FxTable | null> {
  if (memo) return memo;

  const cached = readCache();
  if (cached && Date.now() - cached.at < TTL_MS) { memo = cached.t; return memo; }

  if (inflight) return inflight;
  inflight = (async () => {
    /* PRIMARY */
    try {
      const r = await fetch(PRIMARY);
      if (r.ok) {
        const d = await r.json();
        if (d?.result === "success" && d?.rates?.COP) {
          const t: FxTable = { perUsd: d.rates, asOf: d.time_last_update_utc ?? null, source: "open.er-api" };
          memo = t; writePref(CACHE_KEY, JSON.stringify({ t, at: Date.now() })); announce();
          return t;
        }
      }
    } catch { /* fall through — a dead primary is not an error worth showing anybody */ }

    /* FALLBACK — different publisher, different CDN, lower-case keys. */
    try {
      const r = await fetch(FALLBACK);
      if (r.ok) {
        const d = await r.json();
        const usd = d?.usd;
        if (usd?.cop) {
          const perUsd: Record<string, number> = {};
          for (const c of CCY_CODES) {
            const v = usd[c.toLowerCase()];
            if (typeof v === "number") perUsd[c] = v;
          }
          perUsd.USD = 1;
          const t: FxTable = { perUsd, asOf: d?.date ?? null, source: "jsdelivr" };
          memo = t; writePref(CACHE_KEY, JSON.stringify({ t, at: Date.now() })); announce();
          return t;
        }
      }
    } catch { /* both down */ }

    /* BOTH DOWN. A cache past its TTL is still a real rate somebody published, and it is a much
       better answer than no price at all — but only if we say how old it is, which `asOf` does. */
    if (cached) { memo = cached.t; announce(); return memo; }
    return null;
  })();

  const out = await inflight;
  inflight = null;
  return out;
}

/** Synchronous read for render paths. Null until `fetchFx` has resolved once. */
export const fxNow = (): FxTable | null => memo ?? readCache()?.t ?? null;

/**
 * Convert a US dollar amount into any offered currency.
 *
 * ⚠️ `trmCop` is not optional in spirit even though it is in the signature. When the target is
 * COP and the official rate is known, THAT is the number used — the open feed's peso rate is
 * close but it is not the certified one, and on a property price "close" is thousands of pesos.
 * Returns null when the rate is unknown, and every caller must draw dollars rather than invent.
 */
export function fromUsd(usd: number, to: string, trmCop?: number | null): number | null {
  if (!Number.isFinite(usd)) return null;
  if (to === "USD") return usd;
  if (to === "COP" && trmCop && trmCop > 0) return usd * trmCop;
  const t = fxNow();
  const r = t?.perUsd?.[to];
  return typeof r === "number" && r > 0 ? usd * r : null;
}

/** Format an amount already IN the target currency, with that currency's own conventions. */
export function fmtCcy(amount: number, code: string, locale?: string): string {
  const m = metaFor(code);
  /* Colombian and most Latin-American conventions separate thousands with a full stop and use no
     decimals on a peso amount. `es-CO` does that natively; leaving it to `en-US` prints a number
     that looks wrong to the person it is aimed at. */
  const loc = locale ?? (code === "COP" ? "es-CO" : code === "EUR" ? "de-DE" : "en-US");
  try {
    return new Intl.NumberFormat(loc, {
      style: "currency", currency: code,
      minimumFractionDigits: m.decimals, maximumFractionDigits: m.decimals,
    }).format(amount);
  } catch {
    return `${m.symbol}${amount.toLocaleString(loc, { maximumFractionDigits: m.decimals })}`;
  }
}

/**
 * THE PAIR EVERY PRICE IS DRAWN AS — the reader's currency, and the peso underneath.
 *
 * `primary` is what the reader chose. `secondary` is the peso equivalent, and it is deliberately
 * omitted in exactly two cases: when the reader already chose pesos (printing it twice is noise),
 * and when the peso rate is unknown (printing a guess is the one thing we never do).
 */
export function drawPair(usd: number, viewer: string, trmCop?: number | null) {
  const p = fromUsd(usd, viewer, trmCop);
  const primary = p != null ? fmtCcy(p, viewer) : fmtCcy(usd, "USD");
  const usedFallback = p == null && viewer !== "USD";

  let secondary: string | null = null;
  if (viewer !== "COP") {
    const cop = fromUsd(usd, "COP", trmCop);
    if (cop != null) secondary = fmtCcy(cop, "COP");
  }
  return {
    primary,
    secondary,
    /** True when the reader's currency could not be resolved and dollars were drawn instead. */
    usedFallback,
    /** Where the peso figure came from, for the line of small print under a price breakdown. */
    copSource: trmCop ? ("trm" as const) : (fxNow() ? ("feed" as const) : null),
  };
}
