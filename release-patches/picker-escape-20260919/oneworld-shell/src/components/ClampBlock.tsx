import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../lib/i18n";

/**
 * CLAMPBLOCK — a long block of text shows a few lines, then "More".
 * ============================================================================================
 * Lee, 11 Aug 2026, looking at his own profile on a phone:
 *
 *   *"it looks like the bio or the description section just kind of runs on, and just like in
 *   OneJob it should be abbreviated. You should only show like 4 lines of description before
 *   someone can click More and see the rest, and then if it expands obviously it needs to expand
 *   properly and not behind other elements on the screen… any section that's very long, you
 *   should always show just a summary of it, and then let people expand it if they want to,
 *   especially if there's something below it."*
 *
 * ── THE BUG THIS REPLACES, AND WHY IT LOOKED LIKE "GARBLED TEXT" ────────────────────────────
 * The About block was `className="ow-scroll max-h-44 …"`. `.ow-scroll` is our own utility and it
 * does exactly one thing — hides the scrollbar chrome:
 *
 *     .ow-scroll { scrollbar-width: none; -ms-overflow-style: none; }
 *
 * It never sets `overflow`. So `max-h-44` capped the BOX at 176px while the text kept painting
 * straight out the bottom of it, across the buttons and the card underneath. That is what Lee
 * photographed twice and described as garbled: not a font, not an emoji — one class that was
 * assumed to imply `overflow-y: auto` and does not.
 *
 * That is also why the fix is not `overflow-hidden`. A clipped block silently eats the rest of
 * somebody's bio, and a scroll-inside-a-scroll on a phone is worse than either: the page stops
 * moving under your thumb and nobody knows why. Clamp to N lines, say how to see the rest.
 *
 * ── WHY THE TOGGLE MEASURES INSTEAD OF GUESSING ─────────────────────────────────────────────
 * "More" under a two-line bio is a promise of something that is not there. The button renders
 * only when the content genuinely exceeds the clamp, measured after layout and re-measured on
 * resize and on font load — a bio that fits in portrait can overflow in landscape.
 *
 * ── EXPANSION IS PLAIN FLOW ─────────────────────────────────────────────────────────────────
 * No absolute positioning, no overlay, no portal. Expanding grows the element and pushes what is
 * below it down the page, which is the only behaviour that cannot land on top of anything else.
 * Lee: *"if it expands obviously it needs to expand properly and not behind other elements."*
 */
export default function ClampBlock({
  children, lines = 4, className = "", moreLabel, lessLabel,
}: {
  children: ReactNode;
  /** How many lines before the fade and the More button. Lee's number is 4. */
  lines?: number;
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const { lang } = useI18n();
  const isEs = lang === "es";
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* Measured against the CLAMPED height, so the check has to run while it is clamped. When it
       is open we already know it overflowed — keep the button, or it disappears the moment you
       use it and you cannot collapse again. */
    const measure = () => {
      if (open) return;
      setOverflows(el.scrollHeight > el.clientHeight + 2);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    /* A web font landing after first paint changes the line count under us. */
    (document as any).fonts?.ready?.then?.(measure).catch?.(() => {});
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [open, children, lines]);

  return (
    <div>
      <div
        ref={ref}
        className={`relative whitespace-pre-wrap ${className}`}
        style={open ? undefined : {
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: lines,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="ow-tap mt-1.5 text-[13px] font-bold text-brand"
        >
          {open
            ? (lessLabel ?? (isEs ? "Ver menos" : "Less"))
            : (moreLabel ?? (isEs ? "Ver más" : "More"))}
        </button>
      )}
    </div>
  );
}
