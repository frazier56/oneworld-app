import { flagSrc } from "../lib/flags";
import { useEffect, useRef, useState } from "react";
import { useI18n, ONE_WORLD_LANGS, readyLangs, type Lang } from "../lib/i18n";

/**
 * LANGUAGE — one dropdown, not a row of flags (Lee, 10 Aug 2026).
 * ============================================================================================
 * *"The language flags — just put those in a dropdown."*
 *
 * Seven flags in a row is a wrap on a 390px screen and it grows every time a language is added.
 * A dropdown shows the ONE that is on and hides the rest until asked, which is what a settings
 * row is supposed to do.
 *
 * It is a custom control rather than a native `<select>` because a native option list cannot
 * carry a flag image on iOS or Android — and the flag is the fastest thing to recognise if you
 * do not read the interface language you are currently stuck in. That is not decoration: it is
 * the whole recovery path for somebody who set the wrong language by accident.
 *
 * Only languages whose dictionary is actually ready are offered (`readyLangs`), so we never show
 * a flag that switches to a half-translated screen.
 */
export default function LanguageSelect() {
  const { lang, setLang, t, dict } = useI18n();
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(316);
  const box = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const langs = readyLangs(dict);
  const list = langs.length ? langs : ONE_WORLD_LANGS.filter(l => l.code === "en");
  const current = list.find(l => l.code === lang) ?? list[0];

  const placeMenu = () => {
    const rect = box.current?.getBoundingClientRect();
    if (rect) {
      const margin = 6;
      const wanted = list.length * 44 + 8;
      const roomAbove = Math.max(0, rect.top - margin);
      const roomBelow = Math.max(0, window.innerHeight - rect.bottom - margin);
      const nextOpenUp = roomBelow < wanted && roomAbove > roomBelow;
      setOpenUp(nextOpenUp);
      setMenuMaxHeight(Math.max(44, Math.floor(nextOpenUp ? roomAbove : roomBelow)));
    }
  };

  const openMenu = () => {
    placeMenu();
    setOpen(true);
  };

  const closeMenu = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => trigger.current?.focus());
  };

  /* Close on an outside tap and on Escape — a dropdown you cannot dismiss is a trap. */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) closeMenu(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(true); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button ref={trigger} onClick={() => open ? closeMenu() : openMenu()}
        aria-haspopup="listbox" aria-expanded={open}
        className="ow-tap flex min-h-[44px] items-center gap-2 rounded-xl border border-ink/10 px-3 py-1.5 text-[13px] font-semibold dark:border-white/15">
        <img src={flagSrc(current?.cc)} alt="" className="h-3 w-4.5 rounded-[2px] object-cover" />
        {current?.country}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" className={`opacity-50 transition ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div role="listbox" aria-label={t("language")}
          style={{ maxHeight: menuMaxHeight }}
          className={`ow-sheet absolute right-0 z-50 w-44 overflow-y-auto rounded-2xl p-1 ${
            openUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}>
          {list.map(l => (
            <button key={l.country} role="option" aria-selected={lang === l.code}
              onClick={() => { setLang(l.code as Lang); closeMenu(true); }}
              className={`ow-tap flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold transition ${
                lang === l.code ? "ow-ink-sel" : "hover:bg-brand/5"}`}>
              <img src={flagSrc(l.cc)} alt="" className="h-3 w-4.5 shrink-0 rounded-[2px] object-cover" />
              {l.country}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
