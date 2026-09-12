import { useChromeHidden, showChrome } from "../lib/chromeVisibility";
import { useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NavIcon } from "./NavIcons";
import { useI18n } from "../lib/i18n";
import type { AppConfig, TabSpec } from "../config";

/**
 * THE FOOTER — the one part of the chrome that VARIES by product.
 * ============================================================================================
 * Lee, 3 Aug 2026: *"the header needs to be the same, the hamburger icon needs to reflect the
 * same information, the footer information is going to vary depending on the app… They'll just
 * have different footer information."*
 *
 * Exactly right, and the reason is worth keeping written down: the header and drawer say WHERE
 * YOU ARE and HOW TO LEAVE, which must never differ. The footer is HOW YOU DO THE WORK of this
 * product, and the work genuinely differs — OneJob has five things you do, OneVoice has one
 * dashboard you look at.
 *
 * ── What still does not vary ─────────────────────────────────────────────────────────────────
 * The SHAPE is canon for the five consumer apps and `assertConfig` throws if it is broken:
 * exactly five tabs, Profile last, Messages fourth beside it, and one raised centre slot that is
 * the single action the product exists for. A member who learns "bottom-right is me" in OneJob
 * must find it in the same place in OneEvent, or the family costs them the muscle memory it was
 * supposed to give them.
 *
 * A SERVICE may carry fewer tabs, or none — in which case this renders nothing at all and the
 * page simply has no footer. That is deliberate: an empty bar is worse than no bar.
 *
 * ── Icon-only ────────────────────────────────────────────────────────────────────────────────
 * Lee, 12 Jul 2026: labels removed, icons vertically centred. Five labels in seven languages do
 * not fit on a phone — German and Russian overflow every time — and a label that is sometimes
 * truncated is worse than no label, because it looks broken rather than minimal. The
 * `aria-label` carries the translated name for screen readers, so nothing is actually lost.
 */
export default function BottomTabs({
  config, badges = {},
}: {
  config: AppConfig;
  /** Optional per-tab count, keyed by `TabSpec.to`. The product owns its own counting. */
  badges?: Record<string, number>;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const hidden = useChromeHidden();

  /* ── `end` ON THE INDEX TAB, OR TWO TABS LIGHT UP AT ONCE ──────────────────────────────────
     React Router's NavLink matches by PREFIX. The Home tab is `/job`, and every other tab in the
     product — `/job/jobs`, `/job/messages`, `/job/profile` — starts with `/job`. Without `end`,
     Home is active on every screen in the product, so a person on their profile sees Home AND
     Profile both lit, and a screen reader announces two `aria-current="page"` links.

     Only the product ROOT needs it. A deeper tab should stay lit on its own sub-routes — someone
     inside a message thread is still in Messages. So: `end` exactly when the path has no segment
     under the product root. */
  const isIndex = (to: string) => to.split("/").filter(Boolean).length <= 1;

  const base = "ow-floating-tab flex items-center justify-center flex-1 transition-colors";
  const cls = ({ isActive }: { isActive: boolean }) =>
    `${base} ${isActive ? "text-brand-deep dark:text-brand-light" : "opacity-75"}`;

  /** A normal slot. */
  const Plain = (tab: TabSpec) => {
    const n = badges[tab.to] ?? 0;
    return (
      <NavLink key={tab.to} to={tab.to} end={isIndex(tab.to)} aria-label={t(tab.labelKey)} className={cls}>
        <span className="relative">
          <NavIcon name={tab.icon} size={25} />
          {/* A BADGE MUST BE ANSWERABLE BY THE SCREEN IT SITS ON, or people learn to ignore it.
              OneJob's Messages badge used to count pending CONTRACTS — so a red dot appeared on
              Messages, and opening it showed an empty inbox, because the thing being counted
              lived in My Jobs. Whatever a product passes in here has to be visible on the screen
              the tab leads to. */}
          {!!n && (
            <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {n > 99 ? "99+" : n}
            </span>
          )}
        </span>
      </NavLink>
    );
  };

  /** The raised centre slot: the ONE action the product exists for. */
  const Primary = (tab: TabSpec) => (
    <NavLink key={tab.to} to={tab.to} end={isIndex(tab.to)} aria-label={t(tab.labelKey)}
      className="ow-floating-tab flex flex-1 items-center justify-center">
      {({ isActive }) => (
        /* The only thing on this bar that is not flat: a gradient in the product's own hue, a
           shadow it casts down onto the strip, an inset highlight along the top edge, and a
           sheen resting on the upper half. It is where the product's work starts — it should
           look like it lifts off the glass, because it does.

           The gradient runs `bright → dark → darkest`, so the white glyph sits past the
           midpoint and measures. A flat fill of the identity hue would fail contrast — that is
           the contrast trap in tokens.css, and this is the control most likely to hit it. */
        /* Paint lives in tokens.css (`.ow-tab-primary`), because LIGHT and DARK want different
           treatments and inline styles cannot theme. Light keeps the hue gradient. DARK was
           redesigned 8 Aug 2026 after Lee's review — the bright→darkest hue gradient read
           harsh on ink ("the orange button is not the right color in dark mode"), so on dark
           the button becomes deep frosted glass with a thin hue ring, a soft hue glow, and
           the ICON carrying the voice in the hue's light step. It still wins the eye — by
           glowing, not by shouting. */
        <span className={`ow-tab-primary relative grid h-[50px] w-[50px] place-items-center overflow-hidden rounded-full transition active:scale-[.96] ${isActive ? "ow-tab-primary-active" : ""}`}>
          <span aria-hidden className="ow-tab-primary-sheen pointer-events-none absolute inset-x-0 top-0 h-[42%]" />
          <NavIcon name={tab.icon} size={26} className="opacity-100" />
        </span>
      )}
    </NavLink>
  );

  /* ── v88.1 · U28 · PUBLISH THE TAB BAR'S HEIGHT ──────────────────────────────────
     `BookingBar` has always positioned itself with `bottom: calc(var(--ow-tabs,0px) + …)`
     — it was BUILT to sit above these tabs. Nothing ever set the variable, so it fell
     back to 0 and this bar, at z-40, covered the sticky price bar completely.
     Lee: *"it's sticky, but it's being covered up by the footer."*
  
     Measured rather than hard-coded, so it stays right if the tabs ever change height,
     and cleared on unmount so a screen without tabs keeps no dead band. */
  const barRef = useRef<HTMLElement | null>(null);
  useEffect(() => { showChrome(); }, [location.pathname]);
  useLayoutEffect(() => {
    // Off-screen navigation must not remain in the keyboard/accessibility order.
    if (hidden) barRef.current?.setAttribute("inert", "");
    else barRef.current?.removeAttribute("inert");
  }, [hidden]);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    // Keep sticky booking/actions above both the pill and its floating safe-area gap.
    const publish = () => document.documentElement.style.setProperty("--ow-tabs", (el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0)) + "px");
    publish();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); document.documentElement.style.removeProperty("--ow-tabs"); };
  }, [config.tabs.length]);

  if (config.tabs.length === 0) return null;

  return (
    /* Glass, not a painted bar: the same frost as the header, in the .34–.52 nav fill band, with
       the specular edge along the top. Content scrolls UNDER it and stays faintly visible, which
       is what makes the app feel like layers rather than pages. */
    <nav ref={barRef} aria-hidden={hidden || undefined} onFocusCapture={showChrome}
      className={`ow-floating-tabs fixed z-40 ${hidden ? "ow-floating-tabs-hidden" : ""}`}>
      <div className="flex h-full items-center px-1.5">
        {config.tabs.map(tab => (tab.primary ? Primary(tab) : Plain(tab)))}
      </div>
    </nav>
  );
}
