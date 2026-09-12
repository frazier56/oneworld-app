import { flagSrc } from "../lib/flags";
import { useEffect, useRef, useState } from "react";
import { useI18n, readyLangs } from "../lib/i18n";
import { CURRENCIES, metaFor, fetchFx, fxNow, currencyDisplayName } from "../lib/fx";
import { useViewerCcy } from "../lib/viewerCurrency";
import { ccyForCountry, countryFor } from "../lib/countryPrefs";

/**
 * THE COUNTRY CONTROL — ONE icon in the header, replacing two.
 * ============================================================================================
 * Lee, 15 August 2026: *"we should only have one icon at the top, not two… the flag represents
 * the country, and based on that, this country has this language and this currency."*
 *
 * It replaces `CurrencyButton` and the language picker that used to sit beside it. Both of those
 * still exist and are still exported — `CurrencyPicker` is used inside settings screens — but the
 * HEADER now has exactly one of them.
 *
 * ── THREE THINGS THIS FIXES AT ONCE, AND THE THIRD IS THE ONE NOBODY WOULD PREDICT ──────────
 *
 * 1. **The drift.** Two controls, two stored values, no relationship. Lee's screenshot: the
 *    United States flag beside COP.
 *
 * 2. **The clutter.** Bell, currency, flag, hamburger was four controls on a 390px phone.
 *
 * 3. **⚠️ THE HEADER MOVING BETWEEN For rent AND For sale.** This is the one that looks unrelated
 *    and is not. Four controls left less width for the wordmark. OneHome's sale tagline —
 *    "COMPRA Y VENTA CON HISTORIAL" — is a third longer than the rent one, so at phone width it
 *    was the one that ran out of room and wrapped to two lines. A two-line tagline is a taller
 *    lockup, and a taller lockup in a fixed-height bar re-centres and moves everything measured
 *    from the header. Lee circled both headers in red and said they *"should look exactly the same
 *    regardless of which."* Giving a control's width back to the wordmark is half that fix;
 *    `Wordmark.tsx` carries the other half, which is the tagline refusing to wrap at all.
 *
 * ── WHY THE CURRENCY LINE IS STILL IN HERE ──────────────────────────────────────────────────
 * See `lib/countryPrefs.ts`. An American renting in Medellín wants English and pesos, and that
 * person is the core customer, not an edge case. Country sets both; currency stays changeable one
 * tap deeper. Setting the country ALWAYS re-derives the currency, so the drift cannot come back by
 * accident — it can only be chosen, deliberately, after the country is chosen.
 */
export default function CountryButton({
  dictionary,
}: { dictionary: Record<string, Record<string, string>> }) {
  const { lang, setLang, t } = useI18n();
  const [ccy, setCcy] = useViewerCcy();
  const [open, setOpen] = useState(false);
  const [ccyOpen, setCcyOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  /* Warm the rate table on mount, not when the menu opens: the prices on the page behind this
     button need it too, and a reader should never watch a price change shape after it painted.
     `useViewerCcy` subscribes to the same table, so the repaint is already handled — this call
     only makes sure the request has started. Both calls share one request. */
  useEffect(() => { void fetchFx(); }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setCcyOpen(false); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setCcyOpen(false); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  /* Only countries this product actually carries a dictionary for. A member who taps a flag and
     sees no change concludes the app is broken, and on a screen that moves money a silent English
     fallback is a defect rather than a rough edge. */
  const countries = readyLangs(dictionary);
  const current = countryFor(lang);
  const active = metaFor(ccy);
  const activeName = currencyDisplayName(active.code, lang);

  /* ⚠️ ONE ACTION, BOTH SETTINGS. This is the whole point of the component — if a future edit ever
     splits these two calls apart, the drift Lee photographed comes straight back. */
  const pickCountry = (code: string) => {
    setLang(code as typeof lang);
    setCcy(ccyForCountry(code));
    setOpen(false);
    setCcyOpen(false);
  };

  return (
    <div className="relative" ref={box}>
      {/* 44px minimum, because this is now the single most-reached-for control in the header
         (11 Aug 2026 rule: the flag and the menu were both under the height a thumb reliably
         hits on a 390px viewport). */}
      <button type="button" onClick={() => setOpen(o => !o)}
        className="ow-tap grid min-h-[44px] min-w-[44px] place-items-center rounded-lg px-2"
        aria-haspopup="listbox" aria-expanded={open}
        aria-label={`${t("country")}: ${current.country}; ${t("currency")}: ${activeName}`}>
        {/* THE LANGUAGE CODE IS THE BASE LAYER; THE FLAG SITS ON TOP OF IT.
           Two failure modes, one structure. flagcdn unreachable — blocked on corporate wifi,
           blocked in some countries, or simply down — leaves an empty white rectangle where a
           control should be. flagcdn merely SLOW leaves it blank for a measured 1.5 seconds even
           on a working connection, and no `onError` can help with that one because nothing has
           errored. Painting the code underneath and covering it once the image loads makes both
           cases correct: never empty, and never a flash. */}
        <span className="relative grid h-4 w-6 place-items-center overflow-hidden rounded-[3px] bg-ink/10 text-[9px] font-bold leading-none dark:bg-white/15">
          {lang.toUpperCase()}
          <img src={flagSrc(current.cc)} alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200"
            onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </span>
      </button>

      {open && (
        /* ⚠️ `ow-sheet`, NOT `bg-surface`. `bg-surface` is in neither `tailwind-preset.cjs` nor
           `tokens.css`, Tailwind emits nothing for an unknown utility and warns about nothing, and
           it shipped twice — most recently on the currency menu this component replaces, where the
           feed was readable straight through the list. `ow-sheet` is the app's own overlay surface
           and is 97% opaque by a rule tokens.css records in full. */
        /* ⚠️ `z-50` AND `rounded-2xl` ARE BOTH LOAD-BEARING — I shipped this without either.
            Lee found it on the live site: the panel opened, all seven countries were there, and
            the search box, the For sale tab and the layout icons all painted straight THROUGH it.

            It reads as translucency and it is not. `.ow-sheet` and `.ow-menu` share the same
            `--overlay-bg`, which is 97% opaque by a rule tokens.css states in full. The panel was
            not see-through — **the page was drawing on top of it**, because this element had no
            z-index at all. Every other menu in the shell carries `z-50` explicitly: the old
            currency button, `LanguageSelect`, `LangPicker`. Mine was the only one that did not,
            and the header's own `z-40` does not travel down to a child that never asks for a layer.

            `.ow-sheet` also carries no border-radius of its own — it is written for full-width
            sheets that get their corners from the caller. So this panel had square corners while
            every other menu in the product is rounded. `overflow-hidden` makes the rounding clip
            the rows inside it rather than just the box.

            The lesson, and it is the third time this exact shape has cost a version: a class that
            LOOKS like the right surface is not the same as the class the neighbouring component
            actually uses. Read what the thing next to it does. */
        <div role="listbox" translate="no"
          /* ⚠️ NESTED backdrop-filter IS WHY THIS PANEL LOOKED SEE-THROUGH, and it is not what I
             said it was last time. I blamed a missing z-index, added one, and the ghosting stayed.
             So I stopped reasoning and measured it on the live page instead.

             What the browser actually reported: the panel is `rgba(255,255,255,.97)`, `z-index: 50`,
             and `elementFromPoint` returns the PANEL at every point inside it. It was on top the
             whole time. The layer was never the problem.

             The header carries `backdrop-filter: blur(30px)` and this panel carried
             `blur(26px)` of its own from `.ow-sheet`. A backdrop-filter inside another
             backdrop-filter resets the backdrop root, and the child's own background then
             composites against a re-sampled backdrop. Turning the HEADER's filter off in the live
             page made the panel instantly solid — that experiment is the proof, not the theory.

             So the panel drops its own filter and goes fully opaque. A dropdown that covers a feed
             should be read, not admired: `.ow-sheet` is written for sheets where translucency is
             wanted, and 3% of a near-black tab showing through a country list is not a style, it
             is a legibility bug.

             `translate="no"` because these are ENDONYMS — a country's name in its own language.
             Chrome was rewriting España to Spain, Deutschland to Germany and Россия to Russia,
             which defeats the entire point of showing somebody their own country. Same family of
             defect as the wordmark being read as the Spanish word "o" and rendered "EITHERne". */
          style={{ backdropFilter: "none", WebkitBackdropFilter: "none" }}
          className="ow-sheet notranslate absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-2xl bg-white p-1 text-sm dark:bg-[#141A24]">
          {countries.map(({ code, cc, country }) => (
            <button key={country} type="button" onClick={() => pickCountry(code)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-brand/10 ${lang === code ? "font-semibold" : ""}`}>
              <img src={flagSrc(cc)} alt="" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
              <span className="min-w-0 flex-1 truncate">{country}</span>
              {/* The currency the country implies, shown next to it, so the consequence of the tap
                 is visible BEFORE the tap rather than discovered afterwards on a price. */}
              <span className="shrink-0 text-[11px] font-bold opacity-55">{ccyForCountry(code)}</span>
            </button>
          ))}

          <div className="my-1 h-px bg-ink/10 dark:bg-white/10" />

          {/* THE ESCAPE HATCH, one tap deeper. Collapsed by default so the common path is
             uncluttered; the person who needs English text and peso prices can still get there. */}
          <button type="button" onClick={() => setCcyOpen(v => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-brand/10">
            <span className="min-w-0 flex-1 truncate text-[12px] opacity-70">
              {t("pricesIn")}
            </span>
            <span className="shrink-0 text-[12px] font-black tracking-wide">{active.code}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              className={`shrink-0 transition-transform ${ccyOpen ? "rotate-180" : ""}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {ccyOpen && (
            <div className="max-h-56 overflow-y-auto">
              {CURRENCIES.map(c => (
                <button key={c.code} type="button"
                  onClick={() => { setCcy(c.code); setCcyOpen(false); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left hover:bg-brand/10 ${ccy === c.code ? "font-semibold" : ""}`}>
                  <img src={`https://flagcdn.com/w40/${c.flag}.png`} alt="" className="h-3 w-4 shrink-0 rounded-[2px] object-cover" />
                  <span className="w-10 shrink-0 text-[11px] font-black tracking-wide">{c.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] opacity-70">{currencyDisplayName(c.code, lang)}</span>
                </button>
              ))}
              {!fxNow() && (
                /* A rate we do not have is a number we do not print. Never a guessed one. */
                <p className="px-3 py-2 text-[11px] opacity-55">
                  {t("ratesLoading")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
