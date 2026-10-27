import { Link } from "react-router-dom";
import { HUES, PRODUCT_PATH, W, Wordmark, LanguageSelect, useI18n, isStoreBuild, oneWorldTagline, trackEvent } from "@oneworld/shell";

/**
 * THE FIRST SCREEN A SIGNED-OUT VISITOR SEES — "PICK AN APP" (Lee, 26–27 October 2026).
 * ============================================================================================
 * Lee: *"The first screen people come to needs to look like D3, the grid pages of 12 with the
 * ones that are active and then grayed out."* Then, round 4: *"we're going to go with option two"*
 * — glass boxes, no coloured square inside, the icon itself drawn in the app's colour. And the
 * frosted panels must *"shine against the background"*, so the ground is One World blue and
 * violet, not a flat grey.
 *
 * Tapping a live app opens the feed on that app's lane (`/feed?lane=…`), where the three tips show
 * once. Coming-soon apps are drawn but not tappable: the public must not reach them in the app
 * (app-launch-status, 5 Oct 2026). A store build shows only what the store build ships.
 *
 * Copy is Lee's: "Look around for free." He cut the rest. And it is an APP you pick, never a
 * "world" — *"it's all one world… it's more like an application."*
 *
 * Pages of twelve: today there are ten tiles, so there is one page and no page dots. The grid
 * pages itself sideways the day there are more than twelve.
 */
type Tile = { key: string; en: string; es: string; icon: keyof typeof ICON; hue: string; to?: string };

const ICON = {
  all:  <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  cal:  <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  bag:  <><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M9 7V5h6v2" /></>,
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  car:  <><path d="M5 16l1.5-5h11L19 16" /><rect x="3" y="16" width="18" height="4" rx="1.5" /></>,
  ppl:  <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  card: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  hand: <><path d="M8 12l3 3 6-6" /><circle cx="12" cy="12" r="8" /></>,
  bld:  <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4" /></>,
};

const hue = (k: string, fallback: string) => ((HUES as Record<string, { bright: string }>)[k]?.bright ?? fallback);

/* Lee's app order everywhere: Events, Jobs, Homes (live), Rides, then the coming-soon five. */
const LIVE: Tile[] = [
  { key: "all",     en: "Everything", es: "Todo",      icon: "all",  hue: "#6D5BE0",                    to: "/feed?lane=all" },
  { key: "oneevent", en: "Events",    es: "Eventos",   icon: "cal",  hue: hue("oneevent", "#E2711D"),   to: "/feed?lane=events" },
  { key: "onejob",  en: "Jobs",       es: "Trabajos",  icon: "bag",  hue: hue("onejob", "#17A45C"),     to: "/feed?lane=jobs" },
  { key: "onehome", en: "Homes",      es: "Casas",     icon: "home", hue: hue("onerental", "#0D9488"),  to: "/feed?lane=home" },
  { key: "oneride", en: "Rides",      es: "Viajes",    icon: "car",  hue: "",                           to: PRODUCT_PATH.oneride },
];
const SOON: Tile[] = [
  { key: "onesocial",   en: "Social",   es: "Social",   icon: "ppl",  hue: "" },
  { key: "onescore",    en: "Score",    es: "Score",    icon: "star", hue: "" },
  { key: "onepay",      en: "Pay",      es: "Pay",      icon: "card", hue: "" },
  { key: "oneagent",    en: "Agent",    es: "Agente",   icon: "hand", hue: "" },
  { key: "onebusiness", en: "Business", es: "Negocios", icon: "bld",  hue: "" },
];

const GLASS = `rounded-[22px] border border-white/70 bg-gradient-to-br from-white/55 to-white/20
  shadow-[0_10px_30px_rgba(50,40,140,.10),inset_0_1px_0_rgba(255,255,255,.8)] backdrop-blur-xl backdrop-saturate-150
  dark:border-white/[0.18] dark:from-white/[0.12] dark:to-white/[0.04]
  dark:shadow-[inset_0_1px_0_rgba(255,255,255,.12)]`;

function Glyph({ icon, color }: { icon: keyof typeof ICON; color?: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICON[icon]}</svg>
  );
}

export default function Landing() {
  const { lang } = useI18n();
  const store = isStoreBuild();
  /* A store build ships Events, Jobs and Homes only: no Rides, and no coming-soon controls at all. */
  const live = store ? LIVE.filter(t => t.key !== "oneride") : LIVE;
  const tiles = store ? live : [...live, ...SOON];
  const pages: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 12) pages.push(tiles.slice(i, i + 12));

  return (
    <div data-ow="landing"
      className="fixed inset-0 z-0 overflow-y-auto text-ink dark:text-white"
      style={{ background: "var(--ow-landing-ground)" }}>
      {/* The ground: three soft One World lights so the glass has something to catch. */}
      <style>{`
        :root{--ow-landing-ground:radial-gradient(70% 40% at 10% 8%,#9DB0FF 0%,transparent 65%),radial-gradient(65% 40% at 95% 40%,#C3A2FF 0%,transparent 65%),radial-gradient(70% 40% at 20% 92%,#A6C8FF 0%,transparent 65%),#EEF0FB}
        .dark{--ow-landing-ground:radial-gradient(70% 40% at 10% 8%,#3346B8 0%,transparent 65%),radial-gradient(65% 40% at 95% 40%,#6A35C9 0%,transparent 65%),radial-gradient(70% 40% at 20% 92%,#2A5BC4 0%,transparent 65%),#0B0D1C}
      `}</style>
      <div className="mx-auto flex min-h-full w-full max-w-[440px] flex-col gap-4 px-5 pb-[max(26px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
        <div className="flex min-h-[56px] items-center justify-between gap-3">
          <Wordmark wordmark={{ ink: "ne", brand: "World", tagline: oneWorldTagline(lang, store), markSrc: "/mark-oneworld.png" }} h={46} />
          <LanguageSelect />
        </div>

        <div className="mt-1.5 flex flex-col gap-2">
          <h1 className="m-0 whitespace-nowrap text-[27px] font-black leading-[1.1] tracking-[-0.02em]">
            {W(lang, "Welcome to One World.", "Bienvenido a One World.")}
          </h1>
          <p className="m-0 text-[15.5px] leading-[1.45] opacity-75">
            {W(lang, "The world for small businesses and freelancers. Look around for free.",
                     "El mundo para pequeños negocios y freelancers. Mire gratis.")}
          </p>
        </div>

        <div className="mt-1.5 flex flex-col gap-0.5">
          <span className="text-[17px] font-extrabold">{W(lang, "Pick an app", "Elija una app")}</span>
          <span className="text-[13.5px] opacity-75">
            {W(lang, "Tap one to open its feed. Switch any time.", "Toque una para abrir su feed. Cambie cuando quiera.")}
          </span>
        </div>

        <div className={pages.length > 1 ? "flex snap-x snap-mandatory overflow-x-auto" : ""} style={{ scrollbarWidth: "none" }}>
          {pages.map((page, p) => (
            <div key={p} className={`grid w-full shrink-0 grid-cols-3 gap-2.5 py-1 ${pages.length > 1 ? "snap-center" : ""}`}>
              {page.map(t => {
                const label = W(lang, t.en, t.es);
                const inner = (
                  <>
                    <Glyph icon={t.icon} color={t.to ? (t.hue || undefined) : undefined} />
                    <span className={`text-[13.5px] font-extrabold ${t.to ? "" : "opacity-60"}`}>{label}</span>
                    {!t.to && (
                      <span className="-mt-1 text-[10.5px] font-bold opacity-55">{W(lang, "Coming soon", "Muy pronto")}</span>
                    )}
                  </>
                );
                const box = `${GLASS} flex h-[100px] flex-col items-center justify-center gap-2`;
                return t.to ? (
                  <Link key={t.key} to={t.to} data-ow-app={t.key}
                    onClick={() => trackEvent("landing_app_pick", "onboarding", { app: t.key })}
                    className={`ow-tap ${box} transition active:scale-[.97]`}>{inner}</Link>
                ) : (
                  <div key={t.key} data-ow-app={t.key} aria-disabled="true"
                    className={`${box} text-ink/45 opacity-75 dark:text-white/40`}>{inner}</div>
                );
              })}
            </div>
          ))}
        </div>
        {pages.length > 1 && (
          <div className="flex justify-center gap-1.5" aria-hidden>
            {pages.map((_, i) => <i key={i} className={`h-1.5 rounded ${i === 0 ? "w-[18px] bg-current" : "w-1.5 bg-current opacity-40"}`} />)}
          </div>
        )}

        <div className="mt-auto flex justify-center gap-[18px] pt-4 text-[14px] font-bold">
          <Link to="/signin" className="ow-tap">{W(lang, "Sign in", "Ingresar")}</Link>
          <span className="opacity-50" aria-hidden>·</span>
          <Link to="/join" className="ow-tap">{W(lang, "Sign up", "Registrarse")}</Link>
        </div>
      </div>
    </div>
  );
}
