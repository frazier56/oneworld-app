import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { AppConfig } from "../config";
import Wordmark from "./Wordmark";
import ClassicTopBar, { localisedWordmark } from "./ClassicTopBar";
import CountryButton from "./CountryButton";
import NotificationBell from "./NotificationBell";
import Drawer from "./Drawer";
import { useI18n } from "../lib/i18n";
import { shellControlCopy } from "../lib/controlCopy";
import { useChromeHidden, showChrome } from "../lib/chromeVisibility";
import "./headerReveal.css";
import { useOneId } from "../lib/oneId";
/* ── THE HEADER DOES NOT COLLAPSE ANY MORE (Lee, 14 Sep 2026) ──────────────────────────────
   *"The header does this dynamic collapsing expanding mechanism where you tap it and the logo
   expands into the full header. I think we just need to keep the full header up there… the single
   logo is too complicated for people."*

   `center-reveal` is the tap-to-expand header; `classic` is the full horizontal one, kept intact
   for exactly this reversal. Flipping the constant is the whole change — no component is deleted,
   so it can be flipped back in one word if it ever earns its place again. */
export const HEADER_MODE: "center-reveal" | "classic" = "classic";
export default function TopBar(props: { config: AppConfig; rightSlot?: React.ReactNode }) {
  return HEADER_MODE === "classic" ? <div className="ow-classic-frost"><ClassicTopBar {...props}/></div> : <RevealHeader {...props}/>;
}
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
