import { useEffect, useState } from "react";
import { readPref, writePref } from "./safeStorage";
import { CCY_CODES, fromUsd, fmtCcy, onFxReady, fetchFx, fxNow } from "./fx";

/**
 * THE CURRENCY THE READER READS IN — their choice, not the lister's.
 * ============================================================================================
 * Lee, 12 Aug 2026:
 *
 *   *"The person who's listing should be able to choose whether they list in pesos or dollars.
 *   But then the person looking at it should also be able to choose what currency they want to
 *   see it in — on the feed and in their settings. A Colombian is thinking in pesos, and a
 *   foreigner is thinking in dollars, and neither one should have to do the math in their head."*
 *
 * Two different people with two different questions, and they are both right, so this is TWO
 * settings rather than one:
 *
 *   · The LISTER picks what they type into the form (`listCcy` on the sale form). That is about
 *     the number being accurate, and it is stored with the listing.
 *   · The READER picks what the whole app is drawn in. That is about the number being legible,
 *     it belongs to the person and not to the listing, and it is what lives here.
 *
 * ── EVERY PRICE IS STORED IN USD, AND THAT IS NOT AN OPINION ────────────────────────────────
 * `rental_properties.price` and `sale_properties.asking_price` are USD; `display_currency` and
 * `display_fx_rate` only ever changed what was DRAWN. So this setting cannot and must not touch
 * stored data — it picks a formatter, once, at the edge. Nothing downstream of a `Number(price)`
 * changes, which is the same rule `MoneyInput` follows for the same reason.
 *
 * ── AND THE RATE IS FETCHED, NEVER TYPED ────────────────────────────────────────────────────
 * Lee, 11 Aug: *"we can't allow the user to input the conversion because it could be wrong, and
 * that could be very deceptive."* Conversion here always uses the official TRM from `trm.ts`. If
 * the rate has not loaded, the price is drawn in USD with no peso figure rather than converted at
 * a stale or invented number — a wrong price on a listing is the single most damaging thing this
 * product can print.
 */

/**
 * ⚠️ WIDENED 15 Aug 2026 FROM `"USD" | "COP"`.
 *
 * Lee: *"people are coming into Colombia from all countries… that should be the currency they
 * select. But it always shows the equivalent value in pesos."* Two values could not express
 * that, so this is now any code offered by `fx.ts` — still a closed set, still validated on
 * read, so a stray value in storage cannot make the app draw a currency it has no rate for.
 */
export type ViewerCcy = string;

const KEY = "oneworld-view-ccy";

/* Same-tab subscribers. The `storage` event only fires in OTHER tabs, so a Settings screen and a
   feed mounted in the same document would not see each other's change without this. */
const subs = new Set<(c: ViewerCcy) => void>();

export function readViewerCcy(): ViewerCcy {
  const v = readPref(KEY);
  /* Validated against the offered list rather than trusted. Storage is shared with other tabs,
     survives deploys, and is trivially editable — an unknown code here would mean every price on
     the site drawn in a currency we hold no rate for. */
  return v && CCY_CODES.includes(v) ? v : "USD";
}

export function writeViewerCcy(c: ViewerCcy): void {
  writePref(KEY, c);
  subs.forEach(fn => fn(c));
}

/** The reader's currency, live. Changing it anywhere updates everywhere, in this tab and others. */
export function useViewerCcy(): [ViewerCcy, (c: ViewerCcy) => void] {
  const [ccy, setCcy] = useState<ViewerCcy>(readViewerCcy);
  /* ⚠️ AND THIS IS THE OTHER HALF OF THE SAME BUG. `drawPrice` is synchronous — it has to be,
     it runs inside the render of every price on every card — but the rate table arrives over the
     network after that first paint. Without this, the first render draws dollars and nothing ever
     asks again, so a reader who picked euros keeps looking at dollars forever.
     Fetching here as well as in the header button means any screen using a price warms the table,
     including ones the header is not mounted on. Both calls share one request. */
  const [, bump] = useState(0);
  useEffect(() => {
    if (!fxNow()) fetchFx();
    return onFxReady(() => bump(n => n + 1));
  }, []);
  useEffect(() => {
    const onLocal = (c: ViewerCcy) => setCcy(c);
    subs.add(onLocal);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setCcy(readViewerCcy()); };
    window.addEventListener("storage", onStorage);
    return () => { subs.delete(onLocal); window.removeEventListener("storage", onStorage); };
  }, []);
  return [ccy, writeViewerCcy];
}

/**
 * Draw a USD-denominated amount in whichever currency the reader chose.
 *
 * `rate` is the official TRM. Absent or zero and a COP request falls back to USD — see the header:
 * a price the reader cannot check is worse than a price in the wrong currency.
 *
 * Pesos carry no cents in practice and a Colombian price with two decimal places reads as a
 * foreigner's spreadsheet, so COP is always rounded whole. USD rounds whole too on a listing card,
 * where "$1,900" is the number and "$1,900.00" is noise.
 */
export function drawPrice(usdAmount: number, ccy: ViewerCcy, rate?: number | null): string {
  const n = Number.isFinite(usdAmount) ? usdAmount : 0;

  /* ⚠️ THIS FUNCTION ONLY EVER KNEW TWO CURRENCIES, AND THAT IS THE BUG LEE PHOTOGRAPHED.
     v49 widened `ViewerCcy` to 22 codes and added the whole rate engine, but every price on
     every screen still came through here — and here, anything that was not COP fell straight to
     the dollar formatter. So the header said MXN, the reader had chosen MXN, and the listings
     showed dollars. Euros looked identical to dollars for the same reason.

     Widening the TYPE without widening the FUNCTION is the entire failure: the compiler was
     happy because `ccy === "COP"` is still valid against a string, so nothing anywhere complained.

     THE PESO KEEPS ITS OWN PATH ON PURPOSE. `rate` is the official TRM certified by the
     Superintendencia Financiera; the open feed's peso rate is close but not certified, and on a
     property price "close" is thousands of pesos. See lib/fx.ts. */
  if (ccy === "COP" && rate && rate > 0) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency", currency: "COP", maximumFractionDigits: 0,
    }).format(n * rate);
  }

  if (ccy && ccy !== "USD") {
    const converted = fromUsd(n, ccy, rate);
    /* Null means the table has not landed or does not carry this currency. Dollars, unconverted,
       every time — never a guess. A price the reader cannot check is worse than a price in the
       wrong currency, and that rule is older than this function. */
    if (converted != null) return fmtCcy(converted, ccy);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}
