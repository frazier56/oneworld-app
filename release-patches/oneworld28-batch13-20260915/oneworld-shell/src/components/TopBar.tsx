import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { AppConfig } from "../config";
import Wordmark from "./Wordmark";
import ClassicTopBar, { localisedWordmark } from "./ClassicTopBar";
import CountryButton from "./CountryButton";
import NotificationBell from "./NotificationBell";
import Drawer from "./Drawer";
import { useI18n } from "../lib/i18n";
import { shellControlCopy } from "../lib/controlCopy";
import { useChromeHidden, showChrome } from "../lib/chromeVisibility";
import { productHref } from "../routes";
import "./headerReveal.css";
import { useOneId } from "../lib/oneId";

/* ── THE HEADER: GLASS PILL, ALWAYS OPEN, STILL SCROLLS AWAY (Lee, 14 Sep 2026) ─────────────
   I got this wrong once and reverted too far, so the requirement is written out in full.

   Lee: *"All I asked you to do was just move the logo from being expanded and collapsed. Just put
   it back how it was, just make it to where it doesn't expand and collapse horizontally. The
   translucent glass morphism shape, that is the way it should be."*

   So THREE things are kept and exactly ONE is removed:
     ✔ KEEP  the floating translucent glass pill, centred, detached from the page.
     ✔ KEEP  the scroll-away — the pill lifts off the top when the page scrolls down.
     ✔ KEEP  the full lockup + the three controls, visible at all times.
     ✘ REMOVE the horizontal expand/collapse: the tap target, the single-mark state, the
              double-tap-to-pin gesture and its toast. Nothing about the header is a gesture now.

   `classic` (the flat sticky bar) and `center-reveal` (the old tap-to-expand) both still compile
   and are still reachable by flipping one word, which is the only reason this was a one-line
   reversal last time and is a one-line reversal again. */
export const HEADER_MODE: "center-reveal" | "classic" | "static-glass" = "static-glass";

export default function TopBar(props: { config: AppConfig; rightSlot?: React.ReactNode }) {
  if (HEADER_MODE === "classic") return <div className="ow-classic-frost"><ClassicTopBar {...props}/></div>;
  if (HEADER_MODE === "static-glass") return <StaticGlassHeader {...props}/>;
  return <RevealHeader {...props}/>;
}

/* The shipping header. No state except the drawer and the scroll-away the shell already owns. */
function StaticGlassHeader({ config, rightSlot }: { config: AppConfig; rightSlot?: React.ReactNode }) {
  const { userId } = useOneId();
  const { t, lang } = useI18n();
  const location = useLocation();
  const hidden = useChromeHidden();
  const [drawer, setDrawer] = useState(false);
  const header = useRef<HTMLElement>(null);
  /* A drawer held open while the page scrolls must not take its own header away underneath it. */
  const away = hidden && !drawer;

  useEffect(() => { showChrome(); }, [location.pathname, userId]);
  /* `inert` and not just `aria-hidden`: a header that has slid off the top is still in the tab
     order, so a keyboard user lands on an invisible menu button. */
  useLayoutEffect(() => { header.current?.toggleAttribute("inert", away); }, [away]);

  const wordmark = localisedWordmark(config, lang);

  return (
    <>
      <div className="ow-reveal-space"/>
      <header
        ref={header}
        data-brand={wordmark.brand}
        data-chrome-lock={drawer ? "true" : undefined}
        aria-hidden={away || undefined}
        className={`ow-reveal is-static has-glass ${away ? "is-away" : ""}`}
      >
        <Link to={productHref(config.key)} className="ow-reveal-logo" aria-label={wordmark.ink + wordmark.brand}>
          <span className="ow-reveal-wordmark"><Wordmark wordmark={wordmark} h={38}/></span>
        </Link>
        <div className="ow-reveal-controls">
          {rightSlot}
          <NotificationBell to={config.notificationsPath}/>
          <CountryButton dictionary={config.dictionary}/>
          <button className="ow-tap ow-reveal-menu" aria-label={t("menu")} onClick={() => setDrawer(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </div>
      </header>
      <Drawer config={config} open={drawer} onClose={() => setDrawer(false)}/>
    </>
  );
}

/* Retained, unmounted: the tap-to-expand header. See HEADER_MODE above. */
function RevealHeader({ config, rightSlot }: { config: AppConfig; rightSlot?: React.ReactNode }) {
  const { userId } = useOneId();
  const { t, lang } = useI18n(); const location = useLocation(); const hidden = useChromeHidden();
  const [expanded, setExpanded] = useState(false), [pinned, setPinned] = useState(false);
  const [glass, setGlass] = useState(false), [drawer, setDrawer] = useState(false), [notice, setNotice] = useState<"headerPinned" | "autoHideRestored" | "doubleTapToPin" | "">("");
  const header = useRef<HTMLElement>(null), controls = useRef<HTMLDivElement>(null), logo = useRef<HTMLButtonElement>(null);
  const single = useRef<ReturnType<typeof setTimeout>>(), lastTap = useRef(0);
  const copy = shellControlCopy(lang); const away = hidden && !pinned && !drawer;
  useEffect(() => { clearTimeout(single.current); lastTap.current = 0; showChrome(); setExpanded(false); setPinned(false); }, [location.pathname, userId]);
  useEffect(() => { if (away) { clearTimeout(single.current); lastTap.current = 0; setExpanded(false); } }, [away]);
  useEffect(() => { if (expanded) { setGlass(true); return; } const id = setTimeout(() => setGlass(false), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 520); return () => clearTimeout(id); }, [expanded]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(""), 1800); return () => clearTimeout(id); }, [notice]);
  useEffect(() => () => clearTimeout(single.current), []);
  useLayoutEffect(() => { header.current?.toggleAttribute("inert", away); controls.current?.toggleAttribute("inert", !expanded || away); }, [away, expanded]);
  const togglePin = () => { clearTimeout(single.current); lastTap.current = 0; const next = !pinned; setPinned(next); setExpanded(next); showChrome(); setNotice(next ? "headerPinned" : "autoHideRestored"); };
  const tap = (detail: number) => { if (detail === 0) { setExpanded(v => !v); setPinned(false); return; } const now = Date.now(); if (now - lastTap.current < 320) { togglePin(); return; } lastTap.current = now; single.current = setTimeout(() => { setExpanded(v => !v); setPinned(false); setNotice("doubleTapToPin"); lastTap.current = 0; }, 320); };
  // Lee selected the blue Home preview, consistently across rent and sale.
  const wordmark = localisedWordmark(config, lang);
  const src = /^(data:|https?:)/.test(wordmark.markSrc) ? wordmark.markSrc : `${(import.meta as any).env?.BASE_URL ?? "/"}${wordmark.markSrc.replace(/^\//, "")}`;
  return <><div className="ow-reveal-space"/><header data-brand={wordmark.brand} ref={header} data-chrome-lock={drawer ? "true" : undefined} data-expanded={expanded} data-pinned={pinned} aria-hidden={away || undefined} className={`ow-reveal ${expanded ? "is-expanded" : ""} ${glass ? "has-glass" : ""} ${away ? "is-away" : ""}`} onKeyDown={e => { if (e.key === "Escape" && !drawer && !header.current?.querySelector('[role="listbox"]')) { clearTimeout(single.current); setExpanded(false); setPinned(false); logo.current?.focus(); } }}>
    <button ref={logo} className="ow-reveal-logo" aria-expanded={expanded} aria-controls="ow-header-controls" aria-label={expanded ? copy.collapseHeader : copy.expandHeader} title={copy.doubleTapHelp} onClick={e => tap(e.detail)}><img className="ow-reveal-mark" src={src} alt=""/><span className="ow-reveal-wordmark"><Wordmark wordmark={wordmark} h={38}/></span></button>
    <div ref={controls} id="ow-header-controls" className="ow-reveal-controls" aria-hidden={!expanded || undefined}>{rightSlot}<NotificationBell to={config.notificationsPath}/><CountryButton dictionary={config.dictionary}/><button className="ow-tap ow-reveal-menu" aria-label={t("menu")} onClick={() => setDrawer(true)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><button className="ow-reveal-pin" aria-pressed={pinned} onClick={togglePin} title={copy.pinHelp}>{pinned ? copy.unpin : copy.pin}</button></div>
  </header><div role="status" className="ow-reveal-notice">{notice ? copy[notice] : ""}</div><Drawer config={config} open={drawer} onClose={() => setDrawer(false)}/></>;
}
