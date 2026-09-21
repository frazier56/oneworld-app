import { useRef, useState, type ReactNode } from "react";

/**
 * THE PROPERTY HUB'S THREE MASTER PANELS.
 * ============================================================================================
 * Lee, 20 September 2026, looking at v54:
 *
 *   *"I don't like this interface… the host profile is 70 percent translucent and renter profile
 *    is 10 percent. They are not consistent and that does not look good… my profile should be an
 *    actual panel, not a section. You tap on one panel and it expands — it vertically expands and
 *    then you see your two options… you can only have one expanded section at a time… That way
 *    people see the buttons. They got the options: my profile stuff, my rent stuff, my for-sale
 *    stuff… And don't use this translucent thing where it's barely see-through. If anything the
 *    reverse would be true — the main panels are more white, 10 or 15 percent translucent, and
 *    the subcategories are your 70 percent."*
 *
 * ── THE TWO THINGS THAT WERE WRONG ──────────────────────────────────────────────────────────
 * 1 · CONSISTENCY. Each group's first tile carried `primary`, which painted a brand gradient
 *     running from 15 percent to 4 percent opacity — nearly invisible against the aurora — while
 *     every other tile used `.card`. Two tiles in the same list, one you can see through and one
 *     you cannot, and no rule a person could infer for which was which.
 *
 * 2 · DIRECTION. The see-through tile was the IMPORTANT one in each group. Weight was being
 *     spent in inverse proportion to significance: the heaviest surface went to the rows a host
 *     touches least. Lee's correction is the right one and it is how depth works everywhere —
 *     the thing in front is solid, the things behind it are not.
 *
 * So: a master panel is `HUB_PANEL` — 85 percent white in light, a hairline in dark, one border,
 * one shadow, and no per-item exceptions. A child row is `HUB_SUBROW` — 40 percent white, a
 * softer border, no shadow. Both live in this file rather than in either hub, because the same
 * complaint arrived twice before about styles that were fixed on the screen Lee was looking at
 * and left wrong on its twin.
 */
/* ⚠️ ONE DEFINITION, IN THE SHELL. This was a Tailwind string here, which meant the only thing
   keeping the rent hub, the sale hub, the portfolio page and the showings list on the same
   surface was me remembering to import it — and the showings list, which lives in the shell,
   could not import it at all. It is `.ow-panel` in shell/tokens.css now; see the note there. */
export const HUB_PANEL = "ow-panel rounded-3xl";

/* ⚠️ A CHILD ROW IS RECESSED, NOT WHITER. The first attempt made the sub-rows 40 percent white
   on an 86 percent white panel, which is literally more translucent — and invisible, because
   inside a near-solid panel there is no aurora left to see through. Weight has to be carried by
   CONTRAST WITH THE PARENT, so a child row is a faint ink wash that reads as pressed into the
   panel. Same intent as Lee's "the subcategories would be your 70 percent", expressed in the
   only way it can be seen once the parent is solid. */
export const HUB_SUBROW =
  "rounded-2xl border border-ink/[0.07] bg-ink/[0.045] " +
  "dark:border-white/[0.06] dark:bg-white/[0.04]";

const Glyph = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split(" M").map((seg, i) => <path key={i} d={i === 0 ? seg : "M" + seg} />)}
  </svg>
);

/** One open at a time — Lee's rule. Returns the current key and a toggle that closes the rest. */
export function useOnePanel<K extends string>(initial: K | null = null) {
  const [open, setOpen] = useState<K | null>(initial);
  return { open, toggle: (key: K) => setOpen(current => (current === key ? null : key)) };
}

/**
 * A master panel. Collapsed it is still useful: the `status` line carries the numbers a host
 * opened the tab for ("1 live · 1 in draft"), so tapping is for ACTING, not for finding out.
 */
export function HubPanel({ d, title, status, open, onToggle, children }: {
  d: string; title: string; status: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  const box = useRef<HTMLElement | null>(null);

  /* ── ⚠️ OPENING A PANEL MOVED THE PAGE OUT FROM UNDER IT (Lee, 20 September 2026) ─────────
     *"When you click on each section it kind of pops to the top… if you have my profile open and
     then you scroll down to my properties for rent, the top part of it just cuts off, it's too
     high on the page… what's happening is the top part is collapsing while my properties for
     rent is expanding, and it's throwing off the vertical alignment. You have to scroll back up
     so you can see the whole section."*

     Exactly right, and it is arithmetic rather than taste. Tapping a second panel does two
     things at once: the open one loses its rows, so everything below it JUMPS UP by that height,
     and the tapped one gains rows, so it grows DOWNWARD from wherever it landed. The scroll
     position does not move, so the panel you just asked for ends up above the fold by roughly the
     height of the section you just closed. The further down the page you were, the worse it is.

     So the panel puts itself back. `scroll-mt-24` is the floating header's height, which
     `scrollIntoView` respects through `scroll-margin-top`, and the double `requestAnimationFrame`
     waits for the collapse AND the expansion to be laid out — scrolling on the same frame as the
     state change measures the old layout and lands in the wrong place, which looks identical to
     the bug it is meant to fix.

     Only on OPEN. Scrolling somebody's page when they close something is the kind of help
     nobody asked for. */
  const toggle = () => {
    const wasOpen = open;
    onToggle();
    if (wasOpen) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  };

  return (
    <section ref={box} className={`${HUB_PANEL} scroll-mt-24 overflow-hidden`}>
      <button type="button" onClick={toggle} aria-expanded={open}
        className="ow-tap flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.995]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-deep dark:bg-white/10 dark:text-brand-light">
          <Glyph d={d} size={21} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-black leading-tight">{title}</span>
          <span className="mt-0.5 block text-[12px] leading-snug opacity-55">{status}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className={`shrink-0 opacity-45 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {/* ⚠️ RENDERED, NOT UNMOUNTED, so the panel does not lose a row's focus ring on collapse
          and a screen reader can still be told the region exists. `hidden` keeps it out of the
          layout and out of the tab order entirely. */}
      <div hidden={!open} className="space-y-2 px-3 pb-3">
        {children}
      </div>
    </section>
  );
}

/**
 * A child row inside a panel. Deliberately lighter than its parent — see the note above.
 *
 * ── ⚠️ EVERY ROW IS THE SAME HEIGHT (Lee, 20 September 2026) ───────────────────────────────
 * *"When you click on my properties for rent, the panels are different sizes, because you got
 * one row describing my rental properties and you got three rows describing draft listings. So
 * we need to make sure that each section is the same… three rows is just too much."*
 *
 * The heights were equal under My profile only by luck — four descriptions that happened to wrap
 * to two lines each. One longer sentence anywhere and the list goes ragged, which is what the
 * draft row did: it printed the draft's TITLE inside the description, so a listing called
 * "Apartamento de 1 habitación en Ciudad del Río" pushed that one row to three lines while its
 * neighbour sat at one.
 *
 * The description is now a fixed two-line box: `line-clamp-2` caps it and `min-h` floors it, so
 * a one-line sub and a three-line sub both occupy exactly two. Not a rule applied at each call
 * site — a shape the component cannot be talked out of.
 *
 * `count` exists so a row can carry a number without spending the title's width on a chip. It
 * goes in the title, in brackets. The chip on the right was tried on these hubs in September and
 * removed: it is `shrink-0`, so it takes its width first and the title — the only flexible thing
 * in the row — pays by wrapping.
 */
export function HubRow({ d, title, sub, count, onClick }: {
  d: string; title: string; sub: string; count?: number; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`${HUB_SUBROW} ow-tap flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[0.99]`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-deep dark:text-brand-light">
        <Glyph d={d} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold leading-tight">
          {title}{count != null && count > 0 ? ` (${count})` : ""}
        </span>
        <span className="mt-0.5 line-clamp-2 block min-h-[2.75em] text-[12px] leading-snug opacity-55">
          {sub}
        </span>
      </span>
    </button>
  );
}
