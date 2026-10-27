import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { CONFIGS, PRODUCT_PATH, W, useI18n, type AppKey } from "@oneworld/shell";
import { LANES, type LaneKey } from "./lanes";

/**
 * THE TWO FOOTER SHEETS (Lee, 27 October 2026). The footer itself is NOT restyled — *"keep the
 * footer that we have, you're just adjusting the functionality of it."*
 *
 *  · Far-left button → "Choose an app": every lane in swipe order, "You're here" on the current
 *    one, Rides below. This is also the way back to any app. (Lee: "the way back is correct.")
 *  · Middle button, signed in → "What brings you to …?": which side of the market you are on.
 *    Signed out, the middle button opens the shared Join sheet FIRST — *"you can't be on either
 *    side unless you sign in or sign up"* — and comes back here after sign-up (`ow_do=start`).
 *
 * Both are see-through glass, light and dark (Lee: *"we want the glassmorphism to really show"*).
 * The consumer side opens the app's own feed; the creator side opens the app's raised centre tab,
 * read from its config — never a retyped path.
 */
const SHEET = `w-full max-w-[440px] rounded-[30px] border p-5 pt-[22px] text-ink shadow-[0_20px_50px_rgba(0,0,0,.35)]
  backdrop-blur-2xl backdrop-saturate-[1.7] dark:text-white
  border-white/75 bg-[linear-gradient(160deg,rgba(255,255,255,.64),rgba(235,232,255,.48))]
  dark:border-white/20 dark:bg-[linear-gradient(160deg,rgba(40,44,80,.64),rgba(20,22,40,.58))]`;
const TILE = `rounded-[22px] border border-white/70 bg-gradient-to-br from-white/55 to-white/20 backdrop-blur-xl
  dark:border-white/[0.18] dark:from-white/[0.12] dark:to-white/[0.04]`;

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  /* Portalled to <body> so nothing in the feed (rail, caption) can paint over the glass. */
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={label}
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/10 px-3
        pb-[calc(max(22px,env(safe-area-inset-bottom))+78px)]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={SHEET}>{children}</div>
    </div>,
    document.body,
  );
}

const LANE_ICON: Record<LaneKey | "ride", ReactNode> = {
  all:     <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  home:    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  events:  <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  jobs:    <><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M9 7V5h6v2" /></>,
  socials: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5" /></>,
  ride:    <><path d="M5 16l1.5-5h11L19 16" /><rect x="3" y="16" width="18" height="4" rx="1.5" /></>,
};
const Ico = ({ k, color, s = 24 }: { k: LaneKey | "ride"; color?: string; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden>{LANE_ICON[k]}</svg>
);
const laneHue = (k: LaneKey) => LANES.find(l => l.key === k)!.hue;

/* ── FAR-LEFT: CHOOSE AN APP ─────────────────────────────────────────────────────────────── */
export function AppSheet({ current, onPick, onClose }: {
  current: LaneKey; onPick: (i: number) => void; onClose: () => void;
}) {
  const { lang } = useI18n();
  const row = "ow-tap flex w-full items-center gap-3.5 rounded-2xl px-2 py-[9px] text-left text-[15.5px] font-extrabold";
  return (
    <Sheet label={W(lang, "Choose an app", "Elija una app")} onClose={onClose}>
      <p className="m-0 mb-3 text-[22px] font-black tracking-[-0.01em]">{W(lang, "Choose an app", "Elija una app")}</p>
      <div className="flex flex-col gap-0.5">
        {LANES.map((l, i) => {
          const here = l.key === current;
          return (
            <button key={l.key} type="button" data-ow-lane={l.key}
              onClick={() => { onPick(i); onClose(); }}
              className={`${row} ${here ? TILE : ""}`} aria-current={here ? "true" : undefined}>
              <Ico k={l.key} color={laneHue(l.key)} />
              <span className="flex-1">{l.key === "all" ? W(lang, "Everything", "Todo") : W(lang, l.en, l.es)}</span>
              {here && (
                <span className="rounded-full bg-[#2C2622] px-2.5 py-1 text-[11.5px] font-extrabold text-white dark:bg-white dark:text-[#201B16]">
                  {W(lang, "You're here", "Está aquí")}</span>
              )}
            </button>
          );
        })}
        <Link to={PRODUCT_PATH.oneride} className={row} onClick={onClose} data-ow-lane="ride">
          <Ico k="ride" />
          <span className="flex-1">{W(lang, "Rides", "Viajes")}</span>
        </Link>
      </div>
    </Sheet>
  );
}

/* ── MIDDLE BUTTON, SIGNED IN: WHICH SIDE ARE YOU ON ─────────────────────────────────────── */
type Side = { en: string; es: string; subEn: string; subEs: string; to: string; icon: LaneKey; hue: string };
const centre = (app: AppKey) => CONFIGS[app].tabs[2].to;

function sidesFor(lane: LaneKey): { titleEn: string; titleEs: string; sides: Side[] } {
  const L = (k: LaneKey) => LANES.find(l => l.key === k)!;
  const find = (k: LaneKey): Side => ({ en: "", es: "", subEn: "", subEs: "", to: L(k).classicPath, icon: k, hue: L(k).hue });
  const make = (k: LaneKey): Side => ({ ...find(k), to: centre(L(k).app) });
  switch (lane) {
    case "events": return { titleEn: "What brings you to Events?", titleEs: "¿Qué lo trae a Eventos?", sides: [
      { ...find("events"), en: "Go to events", es: "Ir a eventos", subEn: "Save, get tickets, follow hosts", subEs: "Guarde, compre entradas, siga anfitriones" },
      { ...make("events"), en: "Host an event", es: "Organizar un evento", subEn: "List it and sell tickets", subEs: "Publíquelo y venda entradas" }] };
    case "jobs": return { titleEn: "What brings you to Jobs?", titleEs: "¿Qué lo trae a Trabajos?", sides: [
      { ...find("jobs"), en: "Find work", es: "Buscar trabajo", subEn: "Browse jobs and get hired", subEs: "Vea trabajos y consiga empleo" },
      { ...make("jobs"), en: "Hire someone", es: "Contratar", subEn: "Post a job and pay safely", subEs: "Publique un trabajo y pague seguro" }] };
    case "home": return { titleEn: "What brings you to Homes?", titleEs: "¿Qué lo trae a Casas?", sides: [
      { ...find("home"), en: "Rent or buy", es: "Arrendar o comprar", subEn: "Find a place to live", subEs: "Encuentre dónde vivir" },
      { ...make("home"), en: "List a home", es: "Publicar un inmueble", subEn: "Rent it out or sell it", subEs: "Arriéndelo o véndalo" }] };
    case "socials": return { titleEn: "What brings you to Socials?", titleEs: "¿Qué lo trae a Sociales?", sides: [
      { ...find("socials"), en: "See profiles", es: "Ver perfiles", subEn: "Follow people and pros", subEs: "Siga personas y profesionales" },
      { ...make("socials"), en: "Create my profile", es: "Crear mi perfil", subEn: "Show your work", subEs: "Muestre su trabajo" }] };
    default: return { titleEn: "What do you want to do?", titleEs: "¿Qué quiere hacer?", sides: [
      { ...make("events"), en: "Host an event", es: "Organizar un evento", subEn: "List it and sell tickets", subEs: "Publíquelo y venda entradas" },
      { ...make("jobs"), en: "Hire someone", es: "Contratar", subEn: "Post a job and pay safely", subEs: "Publique un trabajo y pague seguro" },
      { ...make("home"), en: "List a home", es: "Publicar un inmueble", subEn: "Rent it out or sell it", subEs: "Arriéndelo o véndalo" }] };
  }
}

export function SideSheet({ lane, onClose }: { lane: LaneKey; onClose: () => void }) {
  const { lang } = useI18n();
  const { titleEn, titleEs, sides } = sidesFor(lane);
  const two = sides.length === 2;
  return (
    <Sheet label={W(lang, titleEn, titleEs)} onClose={onClose}>
      <p className="m-0 mb-3.5 text-[22px] font-black leading-tight tracking-[-0.01em]">{W(lang, titleEn, titleEs)}</p>
      <div className={two ? "grid grid-cols-2 gap-2.5" : "flex flex-col gap-2"}>
        {sides.map(s => (
          <Link key={s.en} to={s.to} onClick={onClose}
            className={`ow-tap ${TILE} flex ${two ? "flex-col gap-2.5 p-4" : "items-center gap-3.5 px-4 py-3.5"} text-left transition active:scale-[.98]`}>
            <Ico k={s.icon} color={s.hue} s={28} />
            <span className="flex flex-col gap-1">
              <span className="text-[16px] font-black">{W(lang, s.en, s.es)}</span>
              <span className="text-[12.5px] leading-snug opacity-75">{W(lang, s.subEn, s.subEs)}</span>
            </span>
          </Link>
        ))}
      </div>
      <p className="m-0 mt-3 text-[12.5px] opacity-65">
        {W(lang, "Your feed stays the same.", "Su feed sigue igual.")}</p>
    </Sheet>
  );
}

