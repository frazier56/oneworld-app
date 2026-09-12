import { useState } from "react";
import { Link } from "react-router-dom";
import Wordmark from "./Wordmark";
import Drawer from "./Drawer";
import NotificationBell from "./NotificationBell";
import CountryButton from "./CountryButton";
import { useI18n, type Lang } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { productHref } from "../routes";
import type { AppConfig } from "../config";

export const ONEBUSINESS_TAGLINES: Record<Lang, string> = {
  en: "Every service, one account",
  co: "Todos los servicios, una cuenta",
  es: "Todos los servicios, una cuenta",
  de: "Alle Services, ein Konto",
  ru: "Все услуги — один аккаунт",
  zh: "所有服务，一个账户",
  pt: "Todos os serviços, uma conta",
};

/**
 * THE HEADER — identical in all eight products.
 * ============================================================================================
 * Lee, 3 Aug 2026: *"the header needs to be the same, the hamburger icon needs to reflect the
 * same information."* So this component has exactly one product-shaped input — the config — and
 * no way to vary anything else. If you want to add something here for one app, that is drift
 * starting: put it on the app's own screen, or put it in every app.
 *
 * ── The order of the right-hand controls is fixed ────────────────────────────────────────────
 * Lee, 2 Aug 2026: the header reads flag, then hamburger — *"you don't interrupt those three."*
 * As of 15 Aug 2026 the flag IS the currency control too (`CountryButton`), so the header is back
 * to three: bell, country, menu. The separate currency button that briefly sat between the bell
 * and the flag is gone — Lee: *"we should only have one icon at the top, not two."*
 * (Light/dark was the third; it moved into the drawer, because it is set once and not used
 * daily.) Anything a product wants to add goes to their LEFT, via `rightSlot`, which is the one
 * concession here — a notification bell needs to be in the header and does not exist in every
 * product.
 */
export default function TopBar({
  config, rightSlot,
}: { config: AppConfig; rightSlot?: React.ReactNode }) {
  const { lang, t } = useI18n();                    /* kept mounted so a language change still repaints the bar */
  useOneId(); // session subscription keeps the header live across sign-in/out
  const [drawer, setDrawer] = useState(false);


  /* THE BACK CONTROL — Lee, 2 Aug 2026: *"there's no back button. I can't get back to the
     screen that I came from."*

     Shown on every screen that is NOT one of this product's tab roots. On a root the tabs
     already ARE the navigation, so a back arrow there is either dead or walks someone out of
     the app; on a detail screen its absence is a dead end, because the tabs cannot return you
     to the list you came from with its state intact.

     `navigate(-1)` when there is history to pop, and this product's home otherwise — landing on
     a contract link from a message should still have a way up, and a history length of 1 means
     there is nothing behind us. */
  const home = productHref(config.key);
  /* The shared One World surfaces — "Your World" (/yourworld) and the switcher (/switch) — are
     DESTINATIONS, not detail screens (Lee, Aug 2026: *"the back button shouldn't be in the header
     on View my World."*). Your World is usually opened from a shared link, where a header
     back-arrow leads nowhere sensible; when it is your own, the tabs and the page's own controls
     return you. So no header back-arrow on either. */
  /* (header back logic retired 17 Aug 2026 — see the note in the JSX below) */
  /* ⚠️ `window.history.length` WAS THE WRONG QUESTION, AND IT WALKED PEOPLE OUT OF THE APP.
     It counts the whole TAB's session — every page visited before anybody arrived here — so it is
     greater than one almost always, including on the very first screen of the app. `navigate(-1)`
     then steps back to whatever was open before, which is not our app.

     That is the defect Lee logged as *"Back from the error screen leaves the app entirely."* It is
     not specific to the error screen; the error screen is simply where a first-load failure puts
     you, which is exactly the case where there is nothing behind us.

     `location.key` is the right question. React Router stamps every entry it pushes with a unique
     key and leaves the FIRST entry of a session as `"default"`. So `key !== "default"` means
     precisely "this app pushed at least one screen and there is somewhere of ours to go back to".
     Anything else goes home, or to the product's landing page when signed out. */


  return (
    <header className="ow-chrome sticky top-0 z-40 border-b border-white/40 dark:border-white/10">
      {/* ⚠️ THE CLIP GOES ON THE WORDMARK SIDE ONLY — NEVER ON THE BAR.
           Version 57.1 put `overflow-hidden` on this row to stop a tall lockup growing the header.
           It worked, and it also clipped every menu that opens out of the header, because those
           panels are absolutely positioned INSIDE this row. Found by opening the country picker on
           the live site: the seven countries were all present in the page and all invisible, with
           only a two-pixel sliver showing under the bar.

           That is the same shape as the `bg-surface` scar — a change that is correct about the
           thing it was aimed at and silently breaks something adjacent, and is only ever found by
           a human looking at the screen.

           So the clip moved down one level, onto the wordmark's own container. The height problem
           was always the tagline, which lives on that side; the control cluster on the right needs
           to overflow, because that is where every dropdown in the product hangs from. */}
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
          {/* ── NO BACK BUTTON IN THE HEADER — Lee, 17 Aug 2026 ─────────────────────────
              His screenshot: the header chevron sat directly above OneEvent's own in-page
              "Back to Events" — two back buttons on one screen. Ruling: "there should never
              be a back button there." The way back is each screen's own in-page control;
              detail screens without one add their own (flagged per lane in coordination). */}
          <Link to={home} aria-label={config.wordmark.ink + config.wordmark.brand}>
            <Wordmark wordmark={config.key === "onebusiness" ? { ...config.wordmark, tagline: ONEBUSINESS_TAGLINES[lang] ?? ONEBUSINESS_TAGLINES.en } : config.wordmark} h={38} />
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {rightSlot}
          <NotificationBell to={config.notificationsPath} />
          {/* ⚠️ ONE CONTROL, NOT TWO — and it is a THREE-icon header again: bell, country, menu.
              Lee, 15 August 2026: *"we're not gonna have the language translation and the currency
              change in two different places... let's take away the icon for the currency and roll
              it into the flag. So we should only have one icon at the top, not two."*

              His own screenshot is the evidence: the United States flag beside COP. Two controls
              meant two independently stored values with no relationship between them, and they
              drifted. `CountryButton` sets both in one action, so that state is now unreachable by
              accident. See `lib/countryPrefs.ts` for why the country is the key and not the
              language, and why the currency stays separately settable one tap deeper.

              This also gives the wordmark back the width that the fourth control took, which is
              half of why the header stopped changing height between For rent and For sale. The
              other half is `Wordmark.tsx` refusing to let a tagline wrap.

              THE ORIGINAL RULE, restored: Lee, 2 August 2026, *"the header reads flag, then
              hamburger — you don't interrupt those three."* Anything a product adds goes to their
              LEFT, via `rightSlot`. The currency button that briefly interrupted them on 15 August
              is now inside the flag. */}
          <CountryButton dictionary={config.dictionary} />

          <button onClick={() => setDrawer(true)} className="ow-tap grid min-h-[44px] min-w-[44px] place-items-center rounded-lg px-2" aria-label={t("menu")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </div>
      </div>

      <Drawer config={config} open={drawer} onClose={() => setDrawer(false)} />
    </header>
  );
}
