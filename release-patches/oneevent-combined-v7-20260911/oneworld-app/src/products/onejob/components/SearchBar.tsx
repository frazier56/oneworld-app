import type { ReactNode } from "react";

/**
 * THE search / filter / sort row. One component, every screen that lists things.
 *
 * Lee, Jul 31 2026: "we've got three different screens and three different ways to show the
 * information… there's filtering by certain things like location, there's sorting, and then there's
 * searching. What's the best way to do all three? And we need to optimize it for the mobile phone."
 *
 * ── The constraint, measured rather than guessed ────────────────────────────────────────────
 * A search field stops being usable below about 180px — shorter than that and you can't see what
 * you typed. A compact select needs ~130px to show its longest label plus the chevron. On a 360px
 * phone with 16px page padding and an 8px gap that is 328px of content width, so:
 *
 *     search + ONE control  = 180 + 130 + 8  = 318px  ✓ fits
 *     search + TWO controls = 180 + 130 + 130 + 16 = 456px  ✗ doesn't, on any phone
 *
 * So two controls per row is a hard ceiling, not a preference. That settles Lee's "can everything
 * fit on one line" — on Find work, which has all three, it cannot.
 *
 * ── The rule ────────────────────────────────────────────────────────────────────────────────
 * Search is always top-left and always paired with the screen's PRIMARY modifier. Anything left
 * over wraps to a full-width row beneath. Predictable across screens, and it degrades in one
 * direction only:
 *
 *     Hire        [search][location]
 *     Find work   [search][location] / [sort]
 *     My jobs     [search][sort]
 *     Messages    [search]
 *
 * Location is what pairs with search wherever it exists, because filtering changes WHICH results
 * you get and sorting only changes their order — the narrower operation earns the prominent slot.
 *
 * ── Why not the collapsing magnifier ────────────────────────────────────────────────────────
 * Lee floated hiding search behind an icon that expands on tap. Tempting, and wrong here: search is
 * the primary action on these screens, and hiding a primary action costs a tap EVERY time to buy
 * space that is only short once (Find work). It also removes the standing cue that a filter is
 * active — a collapsed magnifier looks identical whether or not you're filtered to three of forty
 * results, which is exactly the confusion that makes people think the app has lost their data.
 * Wrapping a third control costs 44px once; collapsing costs a tap forever.
 */
export default function SearchBar({
  value,
  onChange,
  placeholder,
  primary,
  secondary,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** The one control that shares the search row — location where a screen has it, else sort. */
  primary?: ReactNode;
  /** Anything further, on its own full-width row beneath. */
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-full border border-brand/40 bg-brand/[0.04] py-2.5 pl-10 pr-9 text-sm outline-none placeholder:opacity-60 focus:ring-2 focus:ring-brand/40 dark:border-brand/30 dark:bg-brand/[0.06]"
          />
          {value && (
            <button
              onClick={() => onChange("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-ink/10 text-[11px] font-bold dark:bg-white/15"
            >
              ×
            </button>
          )}
        </div>
        {/* Fixed rather than flex-1: a select that grows to half the row looks like a peer of the
            search field, and it isn't one. */}
        {primary && <div className="w-[132px] shrink-0">{primary}</div>}
      </div>
      {secondary}
    </div>
  );
}
