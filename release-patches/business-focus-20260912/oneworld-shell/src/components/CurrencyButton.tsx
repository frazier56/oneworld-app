import { useEffect, useRef, useState } from "react";
import { useI18n, W } from "../lib/i18n";
import { CURRENCIES, metaFor, fetchFx, fxNow } from "../lib/fx";
import { useViewerCcy } from "../lib/viewerCurrency";

/**
 * THE CURRENCY CONTROL IN THE HEADER.
 * ============================================================================================
 * Lee, 15 August 2026:
 *
 *   *"We need to have an icon at the top near the bell icon, between the bell icon and the flag
 *   icon… we have a currency conversion on the feed when it comes to the rental listings, but
 *   this can be broader… instead of having a little toggle switch that says USD to COP, we
 *   really need to take that toggle away from the feed page and just put an overall currency
 *   selector in the header, because there are other pages like this — the historical values, the
 *   listing page itself. There are lots of pages."*
 *
 * ── ⚠️ THIS DELIBERATELY BREAKS A STANDING RULE, AND LEE IS THE ONE WHO BROKE IT ────────────
 * `TopBar` has carried a note since 2 August: *"the header reads flag, then hamburger — you
 * don't interrupt those three."* This adds a fourth, between the bell and the flag, because Lee
 * asked for it there by name. Recording it so nobody later reads the old note, assumes drift,
 * and removes this.
 *
 * ── WHY IT BELONGS IN THE HEADER AND NOT ON THE FEED ────────────────────────────────────────
 * The toggle lived under the feed's filters, so it only existed on one screen. The moment a
 * reader opened a listing, a price breakdown or a sale history, their choice vanished and the
 * numbers reverted. A setting that only applies where you set it is not a setting, it is a
 * filter — and currency is a property of the READER, who carries it to every screen.
 *
 * ── WHAT IT SHOWS, AND WHAT IT REFUSES TO SHOW ──────────────────────────────────────────────
 * The code, not the symbol: four currencies here share "$" and a lone dollar sign in a header
 * tells a Mexican, a Chilean, a Colombian and an American exactly the same useless thing.
 */
export default function CurrencyButton() {
  const { lang } = useI18n();
  const [ccy, setCcy] = useViewerCcy();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(!!fxNow());
  const box = useRef<HTMLDivElement | null>(null);

  /* Warm the table on mount rather than when the menu opens: the prices on the page behind this
     button need it too, and a reader should never watch a price change shape after it painted. */
  useEffect(() => { let dead = false; fetchFx().then(() => { if (!dead) setReady(true); }); return () => { dead = true; }; }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const table = fxNow();
  const active = metaFor(ccy);

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="ow-tap flex h-9 items-center gap-1 rounded-full px-2 text-[12px] font-black tracking-wide"
        aria-haspopup="listbox" aria-expanded={open}
        aria-label={W(lang, `Currency: ${active.name}`, `Moneda: ${active.name}`)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3" />
        </svg>
        <span>{active.code}</span>
      </button>

      {open && (
        <div role="listbox"
          /* ⚠️ THIS WAS `bg-surface`, AND THAT CLASS DOES NOT EXIST. 15 Aug 2026.
             Tailwind emits nothing for an unknown utility, so the panel had NO background — Lee's
             screenshot shows the feed readable straight through the currency list. Same mistake
             as the `marks/` path I invented in v40: a name that sounds like it must exist,
             never checked against anything.
             `ow-sheet` is the app's own overlay surface, already used by the language picker
             immediately to the right of this button — 97% opaque by a rule `tokens.css` records
             in full: *"an overlay covers content, so anything under ~88% opacity means reading
             two things at once."* That rule had already been applied once to `.glass-modal` for
             this exact defect. Use the class; do not hand-roll a background. */
          className="ow-sheet absolute right-0 z-50 mt-2 max-h-[62vh] w-60 overflow-y-auto rounded-2xl p-1.5">
          <p className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-black uppercase tracking-wide opacity-45">
            {W(lang, "Show prices in", "Ver precios en")}
          </p>

          {CURRENCIES.map(c => {
            /* A currency with no rate is offered but marked, never silently listed as if it
               worked. COP and USD are always available: dollars are what prices are stored in,
               and pesos come from the official TRM rather than from this feed. */
            const usable = c.code === "USD" || c.code === "COP" || !!table?.perUsd?.[c.code];
            return (
              <button key={c.code} type="button" role="option" aria-selected={c.code === ccy}
                onClick={() => { setCcy(c.code as any); setOpen(false); }}
                className={`ow-tap flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ${
                  c.code === ccy ? "bg-brand/10" : "hover:bg-ink/[0.04] dark:hover:bg-white/[0.06]"}`}>
                <img src={`https://flagcdn.com/w40/${c.flag}.png`} alt=""
                  className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" loading="lazy" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold">{c.code}</span>
                  <span className="block text-[11px] opacity-55">{c.name}</span>
                </span>
                {!usable && (
                  <span className="shrink-0 text-[9.5px] font-bold uppercase opacity-40">
                    {W(lang, "no rate", "sin tasa")}
                  </span>
                )}
                {c.code === ccy && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brand">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}

          {/* ── SAY WHERE THE NUMBER CAME FROM ────────────────────────────────────────────
              Lee, 11 Aug: *"we can't allow the user to input the conversion because it could be
              wrong, and that could be very deceptive."* The same standard applies to us, so the
              provenance is printed rather than assumed. The peso line is separate on purpose: it
              is the certified rate and the others are not. */}
          <div className="mt-1 border-t border-ink/[0.07] px-2.5 pb-1 pt-2 dark:border-white/[0.08]">
            <p className="text-[10.5px] leading-relaxed opacity-50">
              {W(lang,
                "Pesos use the official TRM certified by the Superintendencia Financiera. Other currencies use the daily published rate.",
                "Los pesos usan la TRM oficial certificada por la Superintendencia Financiera. Las demás monedas usan la tasa diaria publicada.")}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed opacity-50">
              {ready && table?.asOf
                ? W(lang, `Rates as at ${table.asOf}.`, `Tasas al ${table.asOf}.`)
                : W(lang, "Rates loading — prices stay in dollars until they arrive, never converted at a guess.",
                          "Cargando tasas — los precios quedan en dólares hasta que lleguen, nunca convertidos a la adivinanza.")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
