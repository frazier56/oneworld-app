import { useMemo, useRef, useState } from "react";

/**
 * THE SHAPE OF THE MARKET, DRAWN — Airbnb audit pattern five, 14 August 2026
 * ============================================================================================
 * The best single idea in Lee's twenty-one screenshots, and the cheapest to build.
 *
 * ── WHY TWO EMPTY BOXES WERE THE WRONG CONTROL ──────────────────────────────────────────────
 * "Minimum" and "Maximum" ask a question only somebody who already knows the market can answer.
 * A renter arriving from Dubai has no idea whether a two-bedroom in El Poblado is six hundred
 * dollars or six thousand, so they either leave both blank — in which case the filter did
 * nothing — or they guess, and the commonest guess returns an empty list. An empty list reads as
 * "this platform has nothing", which is the most expensive wrong conclusion a search can produce.
 *
 * A histogram answers the question before it is asked. Here is the market; you are here.
 *
 * ── DESIGN DECISIONS WORTH KEEPING ──────────────────────────────────────────────────────────
 * · **The bars are counts, drawn on a square-root scale.** A linear scale on real rental data is
 *   unreadable — one crowded bucket flattens forty others into nothing. Square root keeps the
 *   shape legible without pretending the tall bucket is not tall. It is a picture of a
 *   distribution, not a chart anybody reads a value off.
 * · **Bars outside the chosen range are dimmed, not hidden.** You keep seeing what you excluded,
 *   which is what makes the handles feel like they are doing something.
 * · **The top bucket is inclusive**, so the most expensive listing is never invisible, and the
 *   maximum reads "and above" when it sits at the top.
 * · **The handles are `<input type=range>`**, not divs with pointer handlers. That means arrow
 *   keys, screen readers and the platform's own touch targets, free and correct — a custom
 *   slider is the classic way to build a control nobody can use with a keyboard.
 * · **No canvas, no chart library.** Forty divs. It renders on a cheap Android phone.
 *
 * The component owns no filter state. It is handed the prices, the current range and a setter.
 */

export type PriceHistogramProps = {
  /** Every candidate listing's price, in the SAME unit the min/max are written in. */
  prices: number[];
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  /** Draw a bound the way this screen draws money. */
  money: (n: number) => string;
  /** e.g. "Trip price, includes all fees" — Airbnb's line, and worth copying. */
  caption?: string;
  buckets?: number;
};

/**
 * The buckets, the scale, and the outlier rule — exported so the harness can test the real thing.
 *
 * ── THE OUTLIER RULE, AND WHY THE FIRST VERSION WAS WRONG ───────────────────────────────────
 * The first draft trimmed "the top one percent" by taking the value at the ninety-ninth
 * percentile. On a large catalogue that works. On a SMALL one it does nothing at all: with
 * seventy-three listings the ninety-ninth percentile IS the most expensive listing, so a single
 * eighty-five-thousand-dollar penthouse still flattened every ordinary listing into the leftmost
 * bar. That is precisely the failure the trim existed to prevent, and a small catalogue is
 * exactly what OneHome has today. Caught by `filters-check.mjs`.
 *
 * So the rule is stated in ITEMS, not in percentages: drop the dearest two percent, but always at
 * least one listing once there are twenty of them, and never trim at all below that — with a
 * handful of listings there is no distribution to protect and dropping one would just be lying.
 *
 * A Tukey fence was the other candidate and it over-trims here: on a catalogue with a genuine
 * second band of dearer places, the fence cuts the whole band, not the outlier.
 *
 * Nothing is hidden either way. The top bucket is inclusive and the maximum reads "and above",
 * so the penthouse is still selectable — it just does not get to choose the scale.
 */
export function histogramModel(prices: number[], buckets = 40) {
  const clean = prices.filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (clean.length === 0) return null;

  const drop = clean.length >= 20 ? Math.max(1, Math.floor(clean.length * 0.02)) : 0;
  const cut = clean[clean.length - 1 - drop];
  const lo = clean[0];
  const hi = Math.max(cut, lo + 1);
  const step = (hi - lo) / buckets;

  const counts = new Array(buckets).fill(0);
  for (const p of clean) {
    const i = p >= hi ? buckets - 1 : Math.floor((p - lo) / step);
    counts[Math.max(0, Math.min(buckets - 1, i))]++;
  }
  const peak = Math.max(...counts, 1);
  const heights = counts.map(c => (c === 0 ? 0 : Math.max(0.06, Math.sqrt(c) / Math.sqrt(peak))));
  return { lo, hi, step, counts, heights, total: clean.length, absoluteMax: clean[clean.length - 1] };
}

export default function PriceHistogram({
  prices, min, max, onChange, money, caption, buckets = 40,
}: PriceHistogramProps) {
  /* Drag state lives here so the bars can dim while the thumb is still down. */
  const [live, setLive] = useState<{ lo: number; hi: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const model = useMemo(() => histogramModel(prices, buckets), [prices, buckets]);

  if (!model) return null;

  const { lo, hi, step, counts, heights } = model;
  const loVal = live ? live.lo : (min ?? lo);
  const hiVal = live ? live.hi : (max ?? hi);

  /* A bar is "in" if any part of its bucket falls inside the range. */
  const inRange = (i: number) => {
    const a = lo + i * step, b = a + step;
    return b >= loVal && a <= hiVal;
  };

  const emit = (l: number, h: number) => {
    /* A bound sitting on the end of the scale means "no bound" — sending lo as a minimum would
       exclude nothing while making the filter count claim a filter is on. */
    onChange(l <= lo ? null : Math.round(l), h >= hi ? null : Math.round(h));
  };

  const nudge = (which: "lo" | "hi", v: number) => {
    const l = which === "lo" ? Math.min(v, hiVal - step) : loVal;
    const h = which === "hi" ? Math.max(v, loVal + step) : hiVal;
    setLive({ lo: l, hi: h });
  };

  const commit = () => { if (live) { emit(live.lo, live.hi); setLive(null); } };

  const shown = counts.reduce((n, c, i) => n + (inRange(i) ? c : 0), 0);

  return (
    <div className="ow-hist select-none">
      {caption && <p className="mb-1.5 text-[11.5px] font-semibold opacity-50">{caption}</p>}

      {/* ── the bars ───────────────────────────────────────────────────────────────────── */}
      <div ref={trackRef} className="relative flex h-[68px] items-end gap-[2px] px-[10px]">
        {heights.map((h, i) => (
          <div key={i}
            className={`flex-1 rounded-[2px] transition-colors duration-150 ${
              inRange(i) ? "bg-brand" : "bg-ink/15 dark:bg-white/15"}`}
            style={{ height: `${Math.max(2, h * 100)}%` }}
            aria-hidden="true" />
        ))}
      </div>

      {/* ── the two handles ────────────────────────────────────────────────────────────────
             Stacked native range inputs. The track is drawn by the bars above, so both inputs
             are transparent and share the same row; `pointer-events` is handed to whichever
             half of the row the thumb is nearer, which is the standard way to keep two thumbs
             from fighting over the middle of the track. */}
      <div className="relative mt-1 h-6">
        <div className="absolute inset-x-[10px] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink/12 dark:bg-white/15" />
        <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-brand"
          style={{
            left: `calc(10px + ${((loVal - lo) / (hi - lo)) * 100}% )`,
            right: `calc(10px + ${(1 - (hiVal - lo) / (hi - lo)) * 100}% )`,
          }} />
        <input
          type="range" min={lo} max={hi} step={Math.max(1, Math.round(step))} value={loVal}
          onChange={e => nudge("lo", Number(e.target.value))}
          onPointerUp={commit} onKeyUp={commit} onBlur={commit}
          aria-label="Minimum price"
          className="ow-hist-thumb absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent"
          style={{ zIndex: loVal > (lo + hi) / 2 ? 4 : 3 }} />
        <input
          type="range" min={lo} max={hi} step={Math.max(1, Math.round(step))} value={hiVal}
          onChange={e => nudge("hi", Number(e.target.value))}
          onPointerUp={commit} onKeyUp={commit} onBlur={commit}
          aria-label="Maximum price"
          className="ow-hist-thumb absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent"
          style={{ zIndex: 4 }} />
      </div>

      {/* ── what the handles currently mean, in words ──────────────────────────────────── */}
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[12px] font-bold tabular-nums">
        <span>{loVal <= lo ? money(lo) : money(loVal)}</span>
        <span className="text-[11.5px] font-semibold opacity-50">
          {shown} of {model.total}
        </span>
        <span>{hiVal >= hi ? `${money(hi)}+` : money(hiVal)}</span>
      </div>
    </div>
  );
}
