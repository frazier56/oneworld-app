import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { radioGroupKeys } from "../lib/radioKeys";

/* ── ONE CONTROL ROW FOR EVERY FEED — A SHELL COMPONENT (Lee, 18 Oct 2026) ─────────────────────
   Lee: "it's a shell-level change… I don't want individual apps making individual changes to
   something that's a shell. That's the whole point of a shell." So the row lives HERE, in the
   shell, and every app (rent, sale, Events, the World feed) imports it from `@oneworld/shell`.
   A change to how the row looks or behaves is made once, here, and applies to every app.

   List / Map · Filters · layouts. Rent, sale and Events each had their own copy, and the copies
   drifted: different filter and layout icons, a different "selected" look on Events, and a filter
   button that was a 40 × 40 box beside 36 × 34 layout tiles. Lee: "all the buttons the same size,
   one row, under every phone width" — and same experience means same code. Each feed now passes
   only its words, its counts and its handlers; how the row LOOKS lives here, once.

   EVERY TILE IS THE SAME TILE. Each control is a 34 px tall tile inside the same 2 px frame, so
   every frame is 40 px tall. The four ICON controls (filter + three layouts) are identical tiles;
   List and Map carry words, so they are an equal pair sized to the wider word (never under 44 px). The filter button is a frame of one, so its tile is exactly the size of
   a layout tile (44 × 34 from 360 px up, 36 × 34 at 320) and it lines up with them. The frames carry `ow-refresh-layout` so the glass
   refresh sizes the filter tile by the same rule as the layout tiles.

   The row never wraps (`ow-feed-controls` + `flex-nowrap`); Sort lives inside the filter sheet. */

export type FeedLayoutKind = "big" | "grid" | "row";

export function FeedFilterGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

export function FeedLayoutGlyph({ kind }: { kind: FeedLayoutKind }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinejoin: "round" as const };
  if (kind === "big") return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
    </svg>
  );
  if (kind === "grid") return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...p}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.6" />
    </svg>
  );
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...p}>
      <rect x="3.5" y="5" width="6" height="6" rx="1.4" />
      <rect x="3.5" y="13" width="6" height="6" rx="1.4" />
      <path d="M12.5 7h8M12.5 10h5M12.5 15h8M12.5 18h5" strokeLinecap="round" />
    </svg>
  );
}

const FRAME = "ow-refresh-layout inline-flex rounded-xl border ow-edge p-0.5";
const SELECTED = "bg-ink text-paper dark:bg-white dark:text-ink";
/* TOUCH TARGETS — 44 × 44 AT EVERY WIDTH (Max, 18 Oct: no exception below 360 px). Every tile is 44 px
   wide and 34 px tall; `ow-tap` gives it a 44 px-tall hit box that is never wider than the tile, and
   tiles touch but never overlap, so each control owns a distinct 44 × 44 area. Tiles never shrink.

   FITTING ON ONE ROW: when the phone is too narrow for all six controls at that size (measured, not
   guessed from a breakpoint — so every language and the currency control are covered), the three
   layout buttons fold into ONE 44 px button showing the current layout. It opens a small menu with
   the same three choices. Nothing is lost, the row stays one line, every target stays 44 × 44. */
const TILE = "ow-tap grid h-[34px] w-11 min-w-11 shrink-0 place-items-center rounded-[10px] transition after:min-w-0";

type LayoutOpt = { id: string; label: string; kind: FeedLayoutKind };

/** The folded layout picker: one tile, and a menu of the three layouts. */
function LayoutMenu({ layouts, layout, onLayout, label }: {
  layouts: LayoutOpt[]; layout?: string; onLayout: (id: string) => void; label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = layouts.find(o => o.id === layout) ?? layouts[0];
  const close = (focusBack = true) => { setOpen(false); if (focusBack) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) close(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const keys = (e: ReactKeyboardEvent) => {
    const items = [...(wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus(); }
    else if (e.key === "Home" || e.key === "End") { e.preventDefault(); items[e.key === "Home" ? 0 : items.length - 1]?.focus(); }
    else if (e.key === "Tab") close(false);
  };
  return (
    <div ref={wrap} className="relative shrink-0" onKeyDown={open ? keys : undefined}>
      <div className={`${FRAME} shrink-0`}>
        <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open}
          aria-label={`${label}: ${current.label}`} title={`${label}: ${current.label}`}
          onClick={() => setOpen(o => !o)} className={`${TILE} ${SELECTED}`}>
          <FeedLayoutGlyph kind={current.kind} />
        </button>
      </div>
      {open && (
        <div role="menu" aria-label={label}
          className="absolute right-0 top-full z-40 mt-1.5 min-w-[188px] rounded-2xl border ow-edge bg-white p-1 shadow-lg dark:bg-[#1c1d24]">
          {layouts.map(o => (
            <button key={o.id} type="button" role="menuitemradio" aria-checked={o.id === current.id}
              tabIndex={o.id === current.id ? 0 : -1}
              onClick={() => { onLayout(o.id); close(); }}
              className={`ow-tap flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13px] font-bold transition ${
                o.id === current.id ? SELECTED : ""}`}>
              <FeedLayoutGlyph kind={o.kind} />{o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FeedControlRow({
  view, onView, listLabel, mapLabel,
  filterLabel, filterTitle, activeFilters, filterOn, onOpenFilters,
  currency, layouts, layout, onLayout, layoutLabel,
}: {
  view?: "list" | "map";
  onView?: (v: "list" | "map") => void;
  listLabel: string;
  mapLabel: string;
  /** The button's accessible name ("Filters and sort"). */
  filterLabel: string;
  /** Hover text: the active count and the current sort. */
  filterTitle: string;
  /** Shown as a badge on the frame; 0 hides it. */
  activeFilters: number;
  /** Dark when any filter is on OR the sort is not the default, so a changed sort is never hidden. */
  filterOn: boolean;
  onOpenFilters: () => void;
  currency?: ReactNode;
  layouts?: LayoutOpt[];
  layout?: string;
  onLayout?: (id: string) => void;
  layoutLabel: string;
}) {
  const row = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const showLayouts = view === "list" && !!layouts && !!onLayout;
  /* ── FOLD OR NOT: ONE INTRINSIC MEASUREMENT (r8, Max ov57r6) ───────────────────────────────
     The decision is the same sum in both states: the row's CONTENT width — every child's own width
     plus the gaps, never the free space — with the layout group counted at its FULL width (when
     folded, the menu button is swapped for the three-tile width last seen, or the computed one).
     Fold when that does not fit, unfold when it does. Because it is recomputed from the real
     children whenever any of them changes size (labels, language, currency, a font arriving) as
     well as the row, a narrower currency or shorter word unfolds the row without a resize. */
  const [compact, setCompact] = useState(false);
  const fullGroupWidth = useRef(0);
  const refocus = useRef(false);
  useLayoutEffect(() => {
    const el = row.current;
    if (!el || !showLayouts) { if (compact) setCompact(false); return; }
    const check = () => {
      const g = group.current;
      const kids = Array.from(el.children) as HTMLElement[];
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      let content = kids.reduce((w, k) => w + k.getBoundingClientRect().width, 0) + gap * Math.max(0, kids.length - 1);
      const groupNow = g ? g.getBoundingClientRect().width : 0;
      if (!compact) fullGroupWidth.current = groupNow;
      else content += (fullGroupWidth.current || (layouts!.length * 44 + 6)) - groupNow;
      const shouldFold = content > el.clientWidth + 0.5;
      if (shouldFold !== compact) {
        /* Focus inside the layouts moves to its counterpart, never to the page (r8). */
        refocus.current = !!g && g.contains(document.activeElement);
        setCompact(shouldFold);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    Array.from(el.children).forEach(k => ro.observe(k));
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.addEventListener?.("loadingdone", check);
    return () => { ro.disconnect(); fonts?.removeEventListener?.("loadingdone", check); };
  }, [compact, showLayouts, view, !!currency, layouts?.length]);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    group.current?.querySelector<HTMLElement>(compact ? '[aria-haspopup="menu"]' : '[role="radio"][aria-checked="true"]')?.focus();
  }, [compact]);

  return (
    <div ref={row} className="ow-feed-controls flex flex-nowrap items-center gap-1.5" data-compact={compact || undefined}>
      {/* LIST / MAP — the only group that keeps its words. */}
      {view && onView && (
        /* An equal pair: both halves take the wider word's width (grid-cols-2), never under 44 px. */
        <div className="inline-grid shrink-0 grid-cols-2 rounded-xl border ow-edge p-0.5">
          {(["list", "map"] as const).map(v => (
            <button key={v} type="button" onClick={() => onView(v)} aria-pressed={view === v}
              className={`ow-tap min-h-[34px] min-w-11 whitespace-nowrap rounded-[10px] px-2 text-[12.5px] font-bold transition after:min-w-0 ${
                view === v ? SELECTED : "opacity-60"}`}>
              {v === "list" ? listLabel : mapLabel}
            </button>
          ))}
        </div>
      )}

      {/* FILTERS — a frame of one tile, the same size as a layout tile. */}
      <div className={`${FRAME} relative shrink-0`}>
        <button type="button" onClick={onOpenFilters} aria-label={filterLabel} title={filterTitle}
          className={`${TILE} ${filterOn ? SELECTED : ""}`}>
          <FeedFilterGlyph />
        </button>
        {activeFilters > 0 && (
          <span className="pointer-events-none absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-black tabular-nums text-white">
            {activeFilters}
          </span>
        )}
      </div>

      {currency && <div className="shrink-0">{currency}</div>}

      {/* LAYOUTS — only on List: there is no list to lay out on Map. Folded into one menu button
          when the row cannot fit all three at 44 px. */}
      {showLayouts && (
        <div ref={group} className="ml-auto shrink-0">{compact
        ? <LayoutMenu layouts={layouts!} layout={layout} onLayout={onLayout!} label={layoutLabel} />
        : (
          <div className={`${FRAME} shrink-0`} role="radiogroup" aria-label={layoutLabel} onKeyDown={radioGroupKeys}>
            {layouts!.map(o => (
              <button key={o.id} type="button" role="radio" aria-checked={layout === o.id}
                tabIndex={layout === o.id ? 0 : -1} aria-label={o.label} title={o.label}
                onClick={() => onLayout!(o.id)}
                className={`${TILE} ${layout === o.id ? SELECTED : "opacity-50"}`}>
                <FeedLayoutGlyph kind={o.kind} />
              </button>
            ))}
          </div>
        )}</div>
      )}
    </div>
  );
}
