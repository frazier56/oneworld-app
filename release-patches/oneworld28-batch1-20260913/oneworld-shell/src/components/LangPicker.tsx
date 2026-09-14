import { flagSrc } from "../lib/flags";
import { useEffect, useRef, useState } from "react";
import { useI18n, ONE_WORLD_LANGS, readyLangs } from "../lib/i18n";

/**
 * THE LANGUAGE PICKER — one control, opening UPWARD.
 * ============================================================================================
 * Lee, 9 Sep 2026: the collapsed control is flag-only. Internal locale keys such as `co` select
 * copy and formatting; they are implementation details and must never appear in the interface.
 *
 * Three things in that, all of them load-bearing:
 *
 * 1. ONE CONTROL, NOT SEVEN. A row of seven flags spends the whole width of a phone on a
 *    decision almost nobody makes twice. Collapsed, the current country's bundled flag is the
 *    complete visual label; the accessible name carries the country in text.
 *
 * 2. IT OPENS UPWARD, because it sits at the bottom of the screen. A menu that opens down from
 *    the last element on a page opens off the bottom of it. This is not a preference; it is the
 *    only direction that fits.
 *
 * 3. IT IS `.ow-menu`, the family's translucent menu — not a bespoke panel. Same blur, same
 *    overlay opacity, same border as every other menu in the eight products. A picker with its
 *    own glass is how a family stops looking like one.
 *
 * Language flags are bundled in `lib/flags.ts`, so the picker does not need a network-dependent
 * flag or a visible two-letter fallback.
 */
export default function LangPicker({ dropUp = true }: { dropUp?: boolean }) {
  const { lang, setLang, t, dict } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  const langs = readyLangs(dict);
  const current = langs.find(l => l.code === lang) ?? langs[0] ?? ONE_WORLD_LANGS[0];

  /* Close on an outside press or Escape. `pointerdown` rather than `click`, so the menu is gone
     before the tap lands on whatever is underneath it. */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (langs.length < 2) return null;

  return (
    <div ref={wrap} className="relative inline-block" data-lang-picker>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("language")}: ${current.country}`}
        className="ow-tap inline-flex items-center gap-2 rounded-xl border border-ink/12 bg-ink/[0.04]
                   px-2.5 py-1.5 transition hover:bg-ink/[0.07] dark:border-white/12 dark:bg-white/[0.06]
                   dark:hover:bg-white/[0.10]"
      >
        <Flag cc={current.cc} />
        {/* The caret points the way the menu will travel. Up when it is going to open upward, and
            it flips once it is open — so the arrow always describes the NEXT action. */}
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden
             className={`opacity-45 transition-transform duration-200 ${
               open ? (dropUp ? "rotate-180" : "-rotate-180") : ""}`}>
          <path d={dropUp ? "M2 8L6 4l4 4" : "M2 4l4 4 4-4"} fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          /* ABSOLUTE, so opening it cannot move the page — the same no-jump rule the marquee
             follows. `left-1/2 -translate-x-1/2` keeps it centred under a centred trigger even
             though the panel is wider than the button. */
          className={`ow-menu absolute left-1/2 z-50 w-[190px] -translate-x-1/2 overflow-hidden p-1
                      ${dropUp ? "bottom-full mb-2" : "top-full mt-2"}`}
        >
          {langs.map(l => {
            const on = l.code === current.code;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`ow-tap flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition
                            hover:bg-ink/[0.06] dark:hover:bg-white/[0.08] ${on ? "bg-brand/10" : ""}`}
              >
                <Flag cc={l.cc} />
                {/* The COUNTRY, not the language — "Español" twice with nothing to tell them
                    apart is the picker Lee already had once. Colombia and España are different
                    Spanish and different markets, and the country is what a person recognises. */}
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{l.country}</span>
                <span className="shrink-0 text-[11px] font-medium opacity-45">{l.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Flag({ cc }: { cc: string }) {
  return (
    <span className="relative block h-[15px] w-[21px] shrink-0 overflow-hidden rounded-[3px]
                     bg-ink/10 ring-1 ring-ink/15 dark:bg-white/15 dark:ring-white/20">
      <img src={flagSrc(cc, "w80")} alt="" aria-hidden
           className="absolute inset-0 h-full w-full object-cover" />
    </span>
  );
}
