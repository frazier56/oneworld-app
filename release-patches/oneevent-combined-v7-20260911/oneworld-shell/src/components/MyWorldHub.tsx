import { useState } from "react";
import Chevron from "./Chevron";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { useAsync } from "../lib/useAsync";
import { PRODUCT_BRAND, appDoorway, launcherKey, type AppKey } from "../lib/oneWorld";
import { appHasPublicEvidence, fetchPublicAppEvidence } from "../lib/publicAppEvidence";

/**
 * MY WORLD — the "string of lights" panel at the top of a profile.
 * ============================================================================================
 * v1 was five crescent logos on a green card — "too many circles… especially with it being green
 * and everything else white." Replaced with a string of lights on the shared neutral frost:
 * lit = connected, grey = not, name under each, NO "connected" caption (the header count already
 * says it). The glow is deliberately faint — it is the only emitting thing on the card.
 *
 * A light carries its PRODUCT's colour (identity, from PRODUCT_BRAND) — that is the entire
 * mechanism by which you know which light is which; it is not the rainbow rule being broken, which
 * governs the paint on a surface (this card's surface is the shared neutral frost). Do not turn
 * these the host app's hue.
 *
 * Order is Lee's: Score, Job, Event, Social, Agent — credibility leads. Do not re-sort.
 * Membership is EVIDENCE from One ID (`has`), never a per-device flag or a settings row.
 */
/* SIX. `onehome` replaces the two section keys — the tile says OneHome once. */
const ORDER: AppKey[] = ["onescore", "onejob", "oneevent", "onesocial", "oneagent", "onehome", "onepay", "onebusiness"];
const SHORT: Record<AppKey, string> = {
  onescore: "Score", onejob: "Job", oneevent: "Event", onesocial: "Social", oneagent: "Agent",
  /* The tile says "Home". The two section short-names stay only to keep the record total. */
  onehome: "Home", onerental: "Rental", onesale: "Sale",
  onevoice: "Voice", onepage: "Page", oneapp: "App",
  onepay: "Pay", onebusiness: "Business",
};

function rgbOf(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export default function MyWorldHub({
  product, worldHref, publicView = false, publiclyVisible = true, onTogglePublic, userId,
}: {
  /** The app rendering this panel — its own bulb is always lit, and it is never a link. */
  product: AppKey;
  /** Where "View my World →" goes — the person's public world page. */
  worldHref: string;
  publicView?: boolean;
  /** PUBLIC VIEW ONLY — the profile owner whose lights are being evaluated. */
  userId?: string;
  /** OWNER ONLY — whether strangers see this section at all. */
  publiclyVisible?: boolean;
  onTogglePublic?: (next: boolean) => void;
}) {
  const { lang } = useI18n();
  const isEs = lang === "es";
  const { has } = useOneId();

  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem("ow:world-open") !== "0"; } catch { return true; }
  });
  const toggleOpen = () => setOpen(v => {
    try { localStorage.setItem("ow:world-open", v ? "0" : "1"); } catch { /* storage blocked */ }
    return !v;
  });

  /* `launcherKey` so standing in `/rentals` or `/sales` marks ONEHOME as the current app.
     Without it a member inside OneHome sees OneHome listed as not-connected — the bug in Lee's
     screenshot, one level up from the duplicate rows. */
  const here = launcherKey(product);
  const publicEvidence = useAsync(
    async () => userId ? fetchPublicAppEvidence(userId) : null,
    [userId],
    publicView && !!userId,
  );
  const connected = (k: AppKey) => publicView
    ? appHasPublicEvidence(k, publicEvidence)
    : k === here || has(k);
  const count = ORDER.filter(connected).length;
  const shown = publicView ? ORDER.filter(connected) : ORDER;

  const title = publicView ? (isEs ? "Su mundo" : "Their World") : (isEs ? "Mi mundo" : "My World");
  const cta = publicView ? (isEs ? "Ver su mundo" : "View their World") : (isEs ? "Ver mi mundo" : "View my World");

  if (publicView && !shown.length) return null;

  return (
    <div className="card relative overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3.5">
        <button type="button" onClick={toggleOpen} aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0">
            <span className="block text-[14.5px] font-extrabold leading-tight">{title}</span>
            <span className="mt-0.5 block text-[11.5px] leading-snug opacity-60">
              {publicView
                ? (isEs ? `${count} ${count === 1 ? "app conectada" : "apps conectadas"}` : `${count} ${count === 1 ? "app" : "apps"} connected`)
                : (isEs ? `${count} de 6 apps conectadas` : `${count} of 6 apps connected`)}
            </span>
          </span>
        </button>

        <span className="flex shrink-0 items-center gap-2.5">
          {!publicView && onTogglePublic && (
            <button type="button" role="switch" aria-checked={publiclyVisible}
              aria-label={isEs ? "Mostrar mi mundo en mi perfil público" : "Show my World on my public profile"}
              onClick={() => onTogglePublic(!publiclyVisible)}
              className="ow-tap -my-2 flex min-h-[40px] items-center gap-1.5">
              <span className={`text-[9.5px] font-bold uppercase tracking-wide ${publiclyVisible ? "text-teal" : "opacity-40"}`}>
                {isEs ? "Público" : "Public"}
              </span>
              <span className={`relative h-5 w-9 rounded-full transition ${publiclyVisible ? "bg-teal" : "bg-ink/20 dark:bg-white/20"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${publiclyVisible ? "left-[18px]" : "left-0.5"}`} />
              </span>
            </button>
          )}
          {/* ── A DRAWN CHEVRON, AND A TAP TARGET (11 Aug 2026) ──────────────────────────
                 This was the bare text glyph "▾" — the exact thing `Chevron` was written to
                 delete. Lee, 26 Jul: *"we need to have the same arrows across all of them…
                 they're all tiny, you can't even see it."* A text glyph follows the font's
                 metrics rather than your CSS, so it measured 8×24 here: the only control that
                 opens this card was eight pixels wide. */}
          <button type="button" onClick={toggleOpen} aria-label={open ? "Collapse" : "Expand"}
            className="ow-tap -mr-1.5 grid h-10 w-10 shrink-0 place-items-center">
            <Chevron size="sm" open={open} className="text-brand" />
          </button>
        </span>
      </div>

      {open && (
        <div className="relative px-4 pb-4 pt-1">
          {/* In-app client navigation to the person's world — a Link, not an <a>, so it never
              full-reloads the app (and works under the router in every context). */}
          <Link to={worldHref} aria-label={cta} className="absolute inset-0 z-0" />
          <div className="pointer-events-none relative z-[1]">
            <div className={`mt-1.5 flex ${shown.length >= 4 ? "justify-between" : "gap-6"} px-0.5`}>
              {shown.map(k => {
                const on = connected(k);
                const hex = PRODUCT_BRAND[k].dot;
                const rgb = rgbOf(hex);
                const bulb = (
                  <>
                    <span aria-hidden className="block h-[22px] w-[22px] rounded-full"
                      style={on ? {
                        background: `radial-gradient(circle at 35% 30%, #fff6, ${hex} 68%)`,
                        boxShadow: `0 0 0 1.5px rgba(${rgb},.16), 0 0 7px 1px rgba(${rgb},.38), inset 0 -2px 3px rgba(0,0,0,.22), inset 0 2px 2px rgba(255,255,255,.45)`,
                      } : {
                        background: "rgba(120,120,120,.16)",
                        boxShadow: "inset 0 1px 2px rgba(0,0,0,.14)",
                      }} />
                    <span className={`mt-2 block max-w-full truncate text-[9.5px] font-bold leading-none ${on ? "" : "opacity-40"}`}>
                      <span className="hidden min-[360px]:inline">{PRODUCT_BRAND[k].name}</span>
                      <span className="min-[360px]:hidden">{SHORT[k]}</span>
                    </span>
                  </>
                );
                const box = "flex min-h-[44px] w-[62px] flex-col items-center justify-start pt-0.5 text-center";

                if (on && k !== product) return (
                  <a key={k} href={appDoorway(k)} target="_blank" rel="noreferrer"
                     aria-label={PRODUCT_BRAND[k].name} className={`pointer-events-auto ${box}`}>{bulb}</a>
                );
                if (!on && !publicView) return (
                  <a key={k} href={appDoorway(k)} target="_blank" rel="noreferrer"
                    aria-label={`Get ${PRODUCT_BRAND[k].name}`} className={`pointer-events-auto ${box}`}>{bulb}</a>
                );
                return <span key={k} className={box} aria-hidden={!on}>{bulb}</span>;
              })}
            </div>

            <span className="mt-3.5 block w-full text-center text-sm font-semibold text-brand">{cta} →</span>

            {!publicView && !publiclyVisible && (
              <p className="mt-2 text-center text-[10.5px] leading-snug opacity-45">
                {isEs ? "Oculto en tu perfil público." : "Hidden on your public profile."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
