import { useChromeHidden, showChrome } from "../lib/chromeVisibility";
import { useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NavIcon } from "./NavIcons";
import { useI18n } from "../lib/i18n";
import type { AppConfig, TabSpec } from "../config";

/**
 * WHERE THE MASTER FEED LIVES — R17 note 1.
 *
 * Lee, 20 September 2026: *"there is no way back to the master feed from inside an app."*
 *
 * One constant, in the shell, because nine products need to agree on the answer and the answer
 * is going to change exactly once. Today the feed is a route inside the live build at
 * `/sandbox`; the day it takes the front door this becomes `"/"` and every footer in the family
 * follows in the same edit. Hard-coding "/sandbox" into nine configs would make that day a
 * nine-file change with eight chances to miss one.
 */
export const WORLD_FEED_HOME = "/sandbox";

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
  const { t, lang } = useI18n();
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

  /**
   * ── SLOT ONE IS THE WAY OUT (R17 note 1) ────────────────────────────────────────────────
   * Lee: *"the left footer button (home) always returns to the master feed, from any app, from
   * any screen."*
   *
   * It used to be the product's OWN home — `/jobs` inside OneJob, `/rentals` inside OneHome —
   * which meant that once you followed a card out of the feed there was no route back to it
   * except the address bar. The feed is the front door of the company now, so the leftmost slot
   * is the company's mark and it always goes there.
   *
   * ⚠️ RENDERED, NOT RECONFIGURED. Every product's `tabs[0]` is untouched in `products/index.ts`
   * and `assertConfig` still sees the same five tabs it always has; only what this component
   * DRAWS in slot one changes. So the per-app feed screens are not deleted and not orphaned —
   * they keep their routes, deep links to them still work, and the feed's own lane note still
   * links to them. Reverting is deleting this one branch.
   *
   * The real mark rather than a drawn circle, for the same reason the feed's own footer carries
   * it: this is the company's button, and the company has a logo. Two shadows so the crescent's
   * dark half reads on a light bar and its pale half reads on a dark one.
   */
  const WorldSlot = () => (
    <NavLink key="ow-world" to={WORLD_FEED_HOME} end
      aria-label={lang === "en" ? "World feed" : "Feed del mundo"}
      className="ow-floating-tab flex flex-1 items-center justify-center">
      {/* No plate and no ring — Lee, on the feed's own copy of this button: *"it doesn't need to
          stand out from the rest of the icons… just show the icon by itself, much bigger, and
          vivid, with a slight shadow so it stands out from whatever is behind."* Two shadows,
          because the mark's crescent is dark on one side and pale on the other and the bar is
          light in one theme and dark in the other. */}
      <img aria-hidden alt="" decoding="async"
        className="h-[46px] w-auto object-contain transition active:scale-[.96]"
        style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,.5)) drop-shadow(0 0 8px rgba(255,255,255,.34))" }}
        src={`${(import.meta as any).env?.BASE_URL ?? "/"}mark-oneworld.png`} />
    </NavLink>
  );

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

  /* ── THE RAISED CENTRE PAINT IS GONE, AND THE DECLARATION IS NOT (R19) ──────────────────
     The centre slot is now the feed/app switch, so the product's own primary action no longer
     has paint in this bar and carrying a dead copy of it here would be clutter. `tabs[2]` stays
     in every product's config and `assertConfig` still requires it, because it is still the
     single source of truth for "the one action this product exists for" — the world feed reads
     exactly that declaration to decide where its own centre button lands. The fact moved; only
     the rendering left. */

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
        {/* ── HOME FAR LEFT, THE O IN THE MIDDLE (R19, Lee's fifth time asking) ────────────
            *"We still got to upgrade our footers, like I said, move the logo to the middle and
            keep the home button on the far left of the footer."*

            Overlay 6 put the mark in slot one and took the product's Home with it. Wrong slot.
            The rule, stated so it can be argued with in one line:

              · THE FAR LEFT IS ALWAYS HOME — home for wherever you are standing. Inside a
                product that is the product's own home, exactly as it always was.
              · THE CENTRE IS ALWAYS THE SWITCH between the feed and the app. From inside an
                app it is the One World mark and it returns you to the master feed. From the
                feed (that footer is the world feed's own) it is the button that takes you into
                the app you are looking at.

            So the centre slot means one thing everywhere — "change which world you are in" —
            and it is the raised slot because it is the most reachable one on a phone, which is
            what a button you press twenty times a day should be. */}
        {config.tabs.map(tab => (tab.primary ? <WorldSlot key="ow-world" /> : Plain(tab)))}
      </div>
    </nav>
  );
}
