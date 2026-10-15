import { useEffect, useState } from "react";
import { useViewerCcy } from "./viewerCurrency";
import { fromUsd, fmtCcy, fxNow, fetchFx, onFxReady } from "./fx";
import { fetchTrm } from "./trm";

/**
 * A SUBSCRIPTION PRICE IN THE READER'S OWN MONEY — AND THE TRUTH ABOUT WHAT IS CHARGED.
 * ============================================================================================
 * Lee, 12 Oct 2026: *"I wonder if the pricing for subscriptions can be shown in Colombian pesos
 * or the language that is based on the flag in the translator in the header. So if someone
 * selects Colombia, then instead of US dollars, the subscription shows in pesos… We got to be
 * accurate with it, too. Can the currency conversion be in real time, or maybe by that day?"*
 *
 * The answer to the hard part is that it is already built and already live, and the plan screens
 * were the last two places not using it:
 *
 *   · THE FLAG ALREADY SETS THE CURRENCY. `CountryButton` calls `setLang` and `setCcy` in the
 *     same handler, deliberately — pick Colombia and the reader's currency is already COP.
 *   · THE RATES ARE ALREADY LIVE. `fx.ts` pulls a published table with a fallback source and a
 *     six-hour cache (inside one publishing cycle either way), and falls back to a stale cached
 *     rate rather than inventing one if both are down.
 *   · PESOS DO NOT USE THAT TABLE. They use the TRM — Colombia's official rate, certified by the
 *     Superintendencia Financiera, the rate Colombian law points at. `trm.ts` already fetches it,
 *     and already handles the trap that one row is not one day (a Friday rate stays in force
 *     through the weekend).
 *
 * So this file is not new machinery. It is the one rule the plan screens were missing.
 *
 * ── THE RULE, AND WHY IT IS NOT "JUST SHOW PESOS" ───────────────────────────────────────────
 * Stripe charges in US dollars. A screen that shows only "40.000 COP" is telling the member a
 * price their card statement will not contain, and the amount that lands there will differ by
 * whatever their bank's own rate and fees are that day. That is the deceptive case Lee has ruled
 * out twice already, in his own words about listing conversions: *"we can't allow the user to
 * input the conversion because it could be wrong, and that could be very deceptive."* The same
 * reasoning applies to us showing one.
 *
 * So: the reader's currency is what they READ, and the dollar amount they are CHARGED is printed
 * with it. That is the shell's existing rule for rentals and rides, and it is how the figure
 * stays both legible and true.
 *
 * ── AND IF A RATE IS MISSING, THERE IS NO CONVERSION ────────────────────────────────────────
 * No guess, no last-known-good-looking number, no silent 4,000. The price is drawn in dollars,
 * exactly as it is today, and nothing else changes. A wrong price is worse than an unconverted
 * one.
 */

export type PlanPrice = {
  /** What the reader reads: their currency when we can convert, dollars when we cannot. */
  shown: string;
  /** "$9.99 USD" — set ONLY when `shown` is in another currency, so it is never printed twice. */
  charged: string | null;
  /** True once a conversion is actually being shown, so a screen can add its rate footnote. */
  converted: boolean;
  /** The currency the reader is reading in. */
  ccy: string;
  /** Where the number came from: Colombia's official TRM, or the published rate feed. */
  source: "trm" | "feed" | null;
  /** The day the TRM in use takes effect (YYYY-MM-DD), for the footnote. COP only. */
  trmFrom: string | null;
};

/**
 * Returns a formatter. Call it with a USD amount; it gives back what to draw.
 *
 * Both rates are fetched once and shared: `fetchFx` de-duplicates its own request, and the TRM is
 * memoised at module scope because every plan card on a screen asks for it in the same paint.
 */
/**
 * THE PESO FIGURE NEVER CHANGES UNDER THE READER.
 *
 * PUB30 caught this on the 168 staging run: on a first visit the peso price briefly used the
 * market feed (3,206.93 → COP 32.037) and then switched to the TRM (3,194.44 → COP 31.912) when
 * the government rate arrived a moment later. The footnote named whichever rate was in use, so
 * nothing on screen was untrue — but two screens opened seconds apart showed two different peso
 * prices for the same plan, and a price that moves while you look at it is not a price.
 *
 * The cause: `fromUsd(usd, "COP", null)` silently falls back to the feed table, so "the TRM has
 * not answered yet" and "there is no TRM" looked identical here.
 *
 * So the TRM is now a three-state thing, and COP is drawn from it alone:
 *   · pending — no peso figure at all. Dollars, which is this file's existing honest fallback.
 *     Nothing is drawn that can later change.
 *   · ready   — the official TRM. The only peso number a reader ever sees in the normal case.
 *   · failed  — the government source is unreachable. ONLY then the market feed, and the footnote
 *     says "today's published rate" rather than claiming the TRM.
 * The one transition a reader can witness is dollars → pesos, which is a figure appearing, not a
 * figure changing. Every other currency is unaffected: they have no second source to disagree with.
 */
type TrmState = { phase: "pending" } | { phase: "ready"; rate: number; from: string } | { phase: "failed" };
let trmMemo: TrmState = { phase: "pending" };

export function usePlanPrice(): (usd: number) => PlanPrice {
  const [ccy] = useViewerCcy();
  const [trm, setTrm] = useState<TrmState>(trmMemo);
  const [, bump] = useState(0);

  useEffect(() => {
    /* The rate table lands AFTER the first paint, and these components render synchronously, so
       without re-rendering on arrival a reader who picked euros would keep seeing dollars for the
       life of the screen. `useViewerCcy` does the same thing for the same reason. */
    if (!fxNow()) fetchFx();
    return onFxReady(() => bump(n => n + 1));
  }, []);

  useEffect(() => {
    if (trmMemo.phase !== "pending" || ccy !== "COP") return;
    let alive = true;
    const settle = (next: TrmState) => { trmMemo = next; if (alive) setTrm(next); };
    fetchTrm()
      .then(t => {
        const v = t as { rate?: number; from?: string } | null;
        /* A response with no usable rate is a FAILURE, not a reason to keep waiting — otherwise a
           Colombian reader sits on dollars for ever with no explanation. */
        settle(v?.rate ? { phase: "ready", rate: v.rate, from: v.from ?? "" } : { phase: "failed" });
      })
      .catch(() => settle({ phase: "failed" }));
    return () => { alive = false; };
  }, [ccy]);

  return (usd: number): PlanPrice => {
    const base = { ccy, source: null as PlanPrice["source"], trmFrom: null as string | null };
    if (!Number.isFinite(usd)) return { shown: "", charged: null, converted: false, ...base };
    if (ccy === "USD") {
      return { shown: fmtCcy(usd, "USD"), charged: null, converted: false, ...base };
    }
    /* Pesos wait for the government rate rather than borrowing the market one for a moment. */
    if (ccy === "COP" && trm.phase === "pending") {
      return { shown: fmtCcy(usd, "USD"), charged: null, converted: false, ...base };
    }
    const official = ccy === "COP" && trm.phase === "ready" ? trm.rate : null;
    const converted = fromUsd(usd, ccy, official);
    if (converted == null) {
      /* No rate for this currency right now. Dollars, unannotated — same as before this existed. */
      return { shown: fmtCcy(usd, "USD"), charged: null, converted: false, ...base };
    }
    return {
      shown: fmtCcy(converted, ccy),
      charged: `${fmtCcy(usd, "USD")} USD`,
      converted: true,
      ccy,
      source: official != null ? "trm" : "feed",
      trmFrom: official != null && trm.phase === "ready" ? trm.from : null,
    };
  };
}
