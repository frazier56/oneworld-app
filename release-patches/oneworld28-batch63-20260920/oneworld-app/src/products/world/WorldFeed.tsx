import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CONFIGS, Drawer, NotificationBell, Chevron, I18nProvider,
  useI18n, productHref, W, ListingMap,
  useChromeHidden, showChrome, hideChrome,
} from "@oneworld/shell";
import { FilterSheet, ControlRow, LAYOUTS, LayoutGlyph } from "../onerental/components/FilterSheet";
import { ListingCard } from "../onerental/screens/Feed";
import { SaleCard } from "../onesale/screens/Feed";
import { CO_CITIES } from "../onerental/lib/rental";
import { D } from "../onerental/lib/detailCopy";
import { LANES, laneAt, laneIndex, type Lane, type LaneKey } from "./lanes";
import { Slide, SlideEngagement, LaneNote, DROP, DROP_EASE, type LaneCard } from "./laneCard";
import Intro, { introSeen, clearIntroSeen } from "./Intro";
import { clearOpenerSeen } from "./Opener";
import { useHomesLane } from "./HomesLane";
import { useEventsLane, EVENT_SORTS } from "./EventsLane";
import { useJobsLane } from "./JobsLane";
import { useSocialsLane } from "./SocialsLane";

/**
 * THE WORLD FEED — `/sandbox`.
 * ============================================================================================
 * Lee approved this after four prototype rounds on 20 September 2026. One screen per thing;
 * swipe up for the next one, sideways for the next lane.
 *
 * ── WHY IT LIVES AT `/sandbox` AND NOT ON A STAGING HOSTNAME ────────────────────────────────
 * One ID is a SAME-ORIGIN session. A different hostname is a different origin, the session cannot
 * follow it, and the member would be asked to sign in again — so a staging host would not mirror
 * production, it would only look like it. A route mirrors it by construction: same build, same
 * sign-in, same database, same shell. It is linked from nothing; you reach it by typing it.
 * `/` is untouched until Lee says.
 *
 * ── WHAT THIS FILE OWNS ─────────────────────────────────────────────────────────────────────
 * The chrome and the two scrollers: a header, a tab bar, a right rail, a search pane, a track of
 * four columns. Nothing else. Each lane's rows, filters, sort and buttons live in its own module
 * beside this one and are the CLASSIC screens' own rules, imported, not rewritten. The day this
 * file starts deciding what an event is, it has gone wrong.
 */

/* Sound is OFF until the member asks for it, and then it stays on. Module scope rather than a
   stored flag: "for the session" is exactly the life of this module, and a preference written to
   a device outlives the intent behind it. */
let soundOn = false;

/* The round glass control in the header and down the right rail — the prototype's `.ico`.
   The hairline is not decoration: a dark glass circle over a dark video is a control you cannot
   see you can press. */
const ICO = "grid h-[38px] w-[38px] place-items-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-md";
/**
 * THE BELL'S CIRCLE — R16 note 4. Lee, on his phone: *"centre the bell in its circle."*
 *
 * It was already `place-items-center`, so the fix is not alignment, it is SIZE. `NotificationBell`
 * is shell chrome and draws itself as a 44 × 44 tap target (`min-h-[44px] min-w-[44px] px-2`) —
 * six pixels wider and taller than this 38 pixel circle. A larger child centred in a smaller box
 * overflows it on every side, and the unread badge, which is pinned to the CHILD's top-right
 * corner, lands clear outside the glass altogether. That is what reads as "not centred".
 *
 * So the circle tells the Link to be exactly the circle. Nothing is lost by it: `.ow-tap::after`
 * in the shell's own tokens already paints an invisible 44 × 44 hit box around any `ow-tap`, and
 * the bell carries that class — the thumb target stays 44, only the PICTURE shrinks to fit.
 *
 * Full-opacity glyph, because the shell's 70% is tuned for a solid header bar and this one sits
 * over a moving photograph.
 *
 * ── AND: DOES THE CIRCLE EARN ITS PLACE? MY ANSWER IS YES, AT THIS WEIGHT. ──────────────────
 * A bare white glyph is the more modern choice and it is the wrong one here, because this header
 * has no bar under it: it floats on whatever frame the video happens to be showing, and one
 * frame in ten is a white kitchen or a midday sky. A glyph with only a shadow behind it is
 * legible on nine of those and gone on the tenth, and the tenth is a notification the member
 * never sees. The circle is the smallest thing that makes the answer "always". What it must not
 * be is HEAVY — so it has been taken down to a hairline edge and less fill than it had.
 */
const ICO_BELL = `${ICO} [&>a]:h-[38px] [&>a]:w-[38px] [&>a]:min-h-0 [&>a]:min-w-0 [&>a]:rounded-full [&>a]:px-0 [&_svg]:opacity-100`;
/* A pill in the search pane: sorts, the jobs/people switch, the platform filters. */
const PILL = "ow-tap h-9 rounded-full border ow-edge px-3 text-[13px] font-bold";
const PILL_ON = "bg-ink text-paper dark:bg-white dark:text-ink";

/**
 * ⚠️ `onLight` IS NOT A STYLE PREFERENCE. The same header sits over a video (white, with a
 * shadow, because the background is a photograph and could be any colour) and over the map and
 * the two list layouts (normal ink on normal paper). White on the light map was unreadable.
 */
function LaneHeading({ lane, lang, idx, onLight = false }: {
  lane: Lane; lang: string; idx: number; onLight?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <div className={`flex items-center gap-2 text-[22px] font-extrabold leading-tight tracking-tight
        ${onLight ? "text-ink dark:text-paper" : "text-white"}`}
        style={onLight ? undefined : { textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>
        {/* A WHITE ring, not a ring of its own colour: the orange dot on the orange Events card
            was invisible — a lane marker that disappears on its own lane. */}
        <i className="h-[9px] w-[9px] shrink-0 rounded-full"
          style={{ background: lane.hue,
            boxShadow: "0 0 0 2px rgba(255,255,255,.85), 0 0 0 3.5px rgba(0,0,0,.35)" }} aria-hidden />
        <span>{lang === "en" ? lane.en : lane.es}</span>
      </div>
      <div className="flex gap-[5px] pl-px" aria-hidden>
        {LANES.map((l, i) => (
          <i key={l.key} className={`h-[5px] rounded-full ${i === idx ? "w-4" : "w-[5px]"} ${
            onLight
              ? (i === idx ? "bg-ink dark:bg-paper" : "bg-ink/35 dark:bg-paper/40")
              : (i === idx ? "bg-white" : "bg-white/40")}`} />
        ))}
      </div>
    </div>
  );
}

export default function WorldFeed() {
  const { lang } = useI18n();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  /* ── LANE AND SLIDE LIVE IN THE ADDRESS, NOT IN THIS COMPONENT ────────────────────────────
     Lee's check: tap the button, land on the existing screen, press Back, be on THE SAME SLIDE.
     Component state cannot do that — this component is unmounted while that screen is open. */
  const startLane = useRef(laneIndex(params.get("lane"))).current;
  const startIdx = useRef(Math.max(0, Number(params.get("i") ?? 0) | 0)).current;

  const [laneI, setLaneI] = useState(startLane);
  /* ⚠️ A POSITION PER LANE, NOT ONE FOR THE SCREEN. With a single index, swiping sideways
     carried the Homes position into Events, and — worse — only the active lane could know which
     of its slides to keep alive. Each column remembers where its own reader was. */
  const [idxs, setIdxs] = useState<Record<LaneKey, number>>(() => {
    const base = { home: 0, events: 0, jobs: 0, socials: 0 } as Record<LaneKey, number>;
    base[laneAt(startLane).key] = startIdx;
    return base;
  });
  const lane = laneAt(laneI);
  const idx = idxs[lane.key];
  const setIdxFor = (k: LaneKey, n: number) => setIdxs(s => (s[k] === n ? s : { ...s, [k]: n }));

  const [sound, setSound] = useState(soundOn);
  /* The three cards, once per person — and replayable from the menu, because Lee needs to watch
     them repeatedly while they are being designed and there was no way back to them. */
  const [intro, setIntro] = useState(() => !introSeen());
  const [drawer, setDrawer] = useState(false);
  const [pane, setPane] = useState(false);
  const chromeHidden = useChromeHidden();

  /* One search box per lane. A word typed while looking at Homes must not silently narrow
     Events three swipes later. */
  const [queries, setQueries] = useState<Record<LaneKey, string>>(
    { home: "", events: "", jobs: "", socials: "" });
  const q = queries[lane.key];
  const setQ = (v: string) => setQueries(s => ({ ...s, [lane.key]: v }));

  /* A lane sleeps until it has been reached once. Four lanes firing their queries on open would
     make the FIRST screen slower to pay for three the reader may never see. Once woken it stays
     awake, so swiping back is instant. */
  const [woken, setWoken] = useState<Record<LaneKey, boolean>>(() => {
    const base = { home: false, events: false, jobs: false, socials: false } as Record<LaneKey, boolean>;
    base[laneAt(startLane).key] = true;
    return base;
  });
  const wake = (k: LaneKey) => setWoken(w => (w[k] ? w : { ...w, [k]: true }));

  const homes   = useHomesLane(lang, queries.home, woken.home);
  const events  = useEventsLane(lang, queries.events, woken.events);
  const jobs    = useJobsLane(lang, queries.jobs, woken.jobs);
  const socials = useSocialsLane(lang, queries.socials, woken.socials);

  const byLane: Record<LaneKey, {
    ready: boolean; total: number; cards: LaneCard[];
    atEnd: boolean; more: () => void; resetKey: string;
  }> = { home: homes, events, jobs, socials };

  /* ── ONE SCROLLER PER AXIS ────────────────────────────────────────────────────────────────
     Sideways is the lane track; up and down is the column inside it. Both are CSS scroll-snap
     containers, so the phone does the physics and there is no gesture library to fight with. */
  const track = useRef<HTMLDivElement | null>(null);
  const columns = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const t = track.current;
    if (t) t.scrollTo({ left: startLane * t.clientWidth, behavior: "auto" });
    const col = columns.current[startLane];
    if (col) col.scrollTo({ top: startIdx * col.clientHeight, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── A NEW SEARCH OR FILTER PUTS YOU BACK AT THE TOP ──────────────────────────────────────
     ⚠️ Filtering forty places down to three while the column stayed scrolled to where the ninth
     used to be showed an empty screen with working chrome on it. Each lane reports a key that
     changes when the READER narrows the set — not when a new page arrives, which must never
     move anybody. */
  const lastReset = useRef<Record<string, string>>({});
  useEffect(() => {
    for (let i = 0; i < LANES.length; i++) {
      const k = LANES[i].key;
      const key = byLane[k].resetKey;
      if (lastReset.current[k] === undefined) { lastReset.current[k] = key; continue; }
      if (lastReset.current[k] === key) continue;
      lastReset.current[k] = key;
      columns.current[i]?.scrollTo({ top: 0, behavior: "auto" });
      setIdxFor(k, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homes.resetKey, events.resetKey, jobs.resetKey, socials.resetKey]);

  /* The address follows the thumb, REPLACING rather than stacking: forty slides must not become
     forty entries in the member's Back history. */
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("lane", laneAt(laneI).key);
    next.set("i", String(idx));
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneI, idx]);

  /* ── HIDE ON SWIPE UP, BACK ON SWIPE DOWN ─────────────────────────────────────────────────
     Reported into the SHELL's chrome store — the same state the header and tab bar of every
     classic screen use. Published for this screen precisely so there is not a second
     hide-on-scroll: the window listener in that module never fires here, because this feed
     scrolls inside a container. */
  const lastTop = useRef(0);
  const askedAt = useRef<Record<string, number>>({});
  const onColumnScroll = (key: LaneKey) => (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const n = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    setIdxFor(key, n);

    /* ── THE NEXT PAGE, THREE SLIDES EARLY ──────────────────────────────────────────────────
       ⚠️ THE FEED USED TO SIMPLY STOP. Homes read twelve places and nothing ever asked for the
       next twelve, because the classic feed's trigger is a sentinel div AFTER the last card and
       a full-screen feed has no "after". Three early is the whole point: the next slide has to
       already be there when the thumb arrives, or the scroll stalls on a loading screen. */
    const d0 = byLane[key];
    /* ⚠️ ASK ONCE PER PAGE, NOT ONCE PER SCROLL EVENT. A single flick crosses several slides and
       fired `more()` two and three times, so one page of twelve became a request for
       twenty-four or thirty-six. The guard remembers how many cards were on screen when we last
       asked and will not ask again until that number has actually moved. */
    if (!d0.atEnd && n >= d0.cards.length - 3 && askedAt.current[key] !== d0.cards.length) {
      askedAt.current[key] = d0.cards.length;
      d0.more();
    }

    const d = el.scrollTop - lastTop.current;
    /* 6px of deadband: momentum scrolling emits jittering deltas and a bar that chatters is the
       flicker Lee has reported three times. */
    if (Math.abs(d) < 6) return;
    lastTop.current = el.scrollTop;
    if (d> 0) hideChrome(); else showChrome();
  };

  const onTrackScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (n !== laneI) {
      setLaneI(n);
      wake(laneAt(n).key);
      showChrome();
    }
  };

  const cards = byLane[lane.key].cards;
  const current = cards[Math.min(idx, Math.max(0, cards.length - 1))];
  const toggleSound = () => { soundOn = !soundOn; setSound(soundOn); };

  /* ── R16 NOTE 6 · THE PHONE'S VOLUME-UP KEY ────────────────────────────────────────────────
     Lee, on his phone: *"volume up should act the same as tapping the sound button."*

     ⚠️ READ THIS BEFORE ASSUMING IT WORKS. On the web today it will not fire on the device Lee
     is holding, and that is a platform fact rather than a thing left unfinished:

       · iOS Safari dispatches NOTHING for the hardware volume buttons. They are wired to the
         system ringer and media volume below the browser; no key event, no API, no permission
         that changes it. `HTMLMediaElement.volume` is read-only there for the same reason.
       · Chrome for Android consumes them in the same way — the page never sees the keystroke.

     So a listener is all that can honestly exist here, and it is written so the day the app is
     wrapped natively (Capacitor's volume-button plugin injects exactly these key codes into the
     web view) the behaviour is already correct and nothing needs finding again. On a desktop
     keyboard with media keys it works today, which is also how it can be tested.

     VOLUME UP ONLY, and it never calls `preventDefault`: taking a person's volume key away from
     their operating system to use it as an app button would be a worse bug than not having it. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key === "AudioVolumeUp" || e.key === "VolumeUp";
      if (!k || e.repeat) return;
      if (soundOn) return;                 // already on; volume up is then just volume up
      soundOn = true;
      setSound(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Which surface the header is sitting on right now — a photograph, or a normal page. */
  const overLight = lane.key === "home" && (homes.view === "map" || homes.layout !== "big");
  /* The rail belongs to a full-screen media slide and nothing else. */
  const railVisible = !!current && !(lane.key === "home" && (homes.view === "map" || homes.layout !== "big"));

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black text-white">

      {/* OneHome's real filter sheet and OneEvent's real filter sheet. Both portal to <body>, so
          they paint over the pane they are opened from. */}
      <FilterSheet open={homes.sheetOpen} value={homes.filters} resultCount={homes.draftCount}
        fx={homes.trm?.rate} priceListings={homes.histListings} onChange={homes.setDraftFilters}
        onClose={() => { homes.setFilters(homes.draftFilters); homes.setSheetOpen(false); }} />
      {events.sheet}

      {/* ── THE DRAWER AND THE BELL SPEAK THE LANE'S LANGUAGE ────────────────────────────────
          ⚠️ This screen is mounted on the One World config, because it carries four products and
          no single product's chrome may own it. So `t()` would look OneHome's words up in
          OneJob's dictionary, find nothing and print the KEY — the drawer showed "properties" in
          lower case. One nested provider holding the LANE's dictionary fixes it. The member's
          chosen language is untouched; only which product's words are looked up changes. */}
      <I18nProvider dict={CONFIGS[lane.app].dictionary} defaultLang={CONFIGS[lane.app].defaultLang}>
        <Drawer config={CONFIGS[lane.app]} open={drawer} onClose={() => setDrawer(false)}
          /* A row that belongs to the FEED, not to any product — so it is passed in rather than
             put in a product's config, which would hand it to products with no feed. */
          extraRows={<>
            <button type="button"
              onClick={() => { clearIntroSeen(); setDrawer(false); setIntro(true); }}
              className="ow-tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0 opacity-70" aria-hidden>
                <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
              </svg>
              <span>{W(lang, "Show the intro again", "Ver la introducción otra vez")}</span>
            </button>
            {/* R16 note 1's other half. The film plays once per device on production, which left
               nobody — Lee included — a way back to it. Same reasoning as the intro row above:
               something that is being designed has to be watchable more than once. Clearing the
               flag and reloading is the whole of it; the opener arms itself at the root. */}
            <button type="button"
              onClick={() => { clearOpenerSeen(); window.location.assign(`${(import.meta as any).env?.BASE_URL ?? "/"}`); }}
              className="ow-tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0 opacity-70" aria-hidden>
                <path d="M4 5.5v13l11-6.5z" /><path d="M19 5v14" />
              </svg>
              <span>{W(lang, "Play the film again", "Ver la película otra vez")}</span>
            </button>
          </>} />
      </I18nProvider>

      {/* Above the drawer and the panes: it is the first thing a new member meets. */}
      <Intro open={intro} onClose={() => setIntro(false)} />

      {/* ── HEADER: lane name and dots left, bell and menu right. No wordmark. ───────────────
          One row where there were two. It slides away on swipe up and returns on swipe down. */}
      <header aria-hidden={chromeHidden || pane || undefined}
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 pt-[env(safe-area-inset-top)] transition-all duration-300
          ${chromeHidden || pane ? "-translate-y-[140%] opacity-0" : "translate-y-0 opacity-100"}`}>
        {/* R16 note 3 — Lee, on his phone: *"drop the whole header row about seven pixels off
            the top edge."* `pt-1` sat the lane name and the two circles hard against the safe
            area on a notchless phone. 4 + 7 = 11. The safe-area inset stays OVER this, so a
            device with a notch keeps its own clearance and gets the seven pixels as well. */}
        <div className="pointer-events-auto flex items-center justify-between gap-2.5 px-4 pb-1.5 pt-[11px]">
          <LaneHeading lane={lane} lang={lang} idx={laneI} onLight={overLight} />
          <div className="flex items-center gap-2">
            <div className={ICO_BELL}>
              <I18nProvider dict={CONFIGS[lane.app].dictionary} defaultLang={CONFIGS[lane.app].defaultLang}>
                <NotificationBell to={CONFIGS[lane.app].notificationsPath} />
              </I18nProvider>
            </div>
            <button type="button" className={ICO} onClick={() => setDrawer(true)}
              aria-label={W(lang, "Menu", "Menú")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" aria-hidden><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── THE LANE TRACK ───────────────────────────────────────────────────────────────── */}
      <div ref={track} onScroll={onTrackScroll}
        className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LANES.map((l, i) => {
          const data = byLane[l.key];
          /* ⚠️ `snap-y snap-mandatory` BELONGS HERE. Without it the column scrolled freely and a
             swipe up left two half-slides on screen — the one thing this feed must never do. */
          const colClass = "h-full w-full shrink-0 snap-center snap-always snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
          return (
            <div key={l.key} ref={el => { columns.current[i] = el; }}
              onScroll={onColumnScroll(l.key)} className={colClass}>
              {!data.ready ? (
                <div className="ow-shimmer h-full w-full" aria-busy="true" />
              ) : l.key === "home" && homes.view === "map" ? (
                /* ── R6 · THE EXISTING MAP, UNDER THIS FEED'S HEADER ──────────────────────
                   The map is 62% of the viewport by default, which is right in a scrolling feed
                   and left a black band on a full-screen one, so it is given the page to sit in.
                   And it gets normal ink on normal paper: this screen's root is `text-white` for
                   text over video, and the map's own empty state inherited it — white on white. */
                <div className="min-h-full w-full overflow-y-auto bg-paper px-3 pb-28
                  pt-[calc(env(safe-area-inset-top)+86px)] text-ink dark:bg-ink dark:text-paper">
                  <ListingMap pins={homes.pins} onOpen={p => nav(p.href)} />
                </div>
              ) : l.key === "home" && homes.layout !== "big" ? (
                /* The two list layouts are the CLASSIC card in a plain scrolling list — Lee:
                   *"if you click the view… that needs to work."* Same filtered set, same order,
                   same card. A second card design here would be a third OneHome card. */
                <div className={`min-h-full bg-paper px-3 pb-28 pt-[calc(env(safe-area-inset-top)+86px)] dark:bg-ink
                  ${homes.layout === "grid" ? "grid grid-cols-2 gap-2" : "space-y-3"}`}>
                  {/* ⚠️ BOTH HALVES, IN THE LANE'S OWN ORDER. Drawing only the rentals here
                      while the swipe view showed both would be the for-sale filter applying in
                      one view and not the other — and each half keeps ITS OWN card, because a
                      sale listing and a rental say different things. */}
                  {homes.merged.map(m => m.rent
                    ? <ListingCard key={m.rent.id} l={m.rent} agent={homes.agents?.[m.rent.agent_id]}
                        lang={lang} layout={homes.layout} ccy={homes.viewCcy} fx={homes.trm?.rate}
                        propertyRatings={homes.ratings.property} hostRatings={homes.ratings.host} />
                    : m.sale
                      ? <SaleCard key={m.sale.id} l={m.sale} agent={homes.agents?.[m.sale.agent_id]}
                          lang={lang}
                          /* ⚠️ `SaleCard` still types this as "USD" | "COP" while the reader's
                             currency has been any of 22 codes since the picker grew — its own
                             file says so and calls it the twins drifting. Widening that type is
                             OneHome's file, not this lane's, so it is flagged in the submission
                             rather than changed here. */
                          ccy={homes.viewCcy as "USD" | "COP"} fx={homes.trm?.rate}
                          hostRatings={homes.ratings.host} />
                      : null)}
                </div>
              ) : !data.cards.length ? (
                <LaneNote lane={l} lang={lang}
                  title={data.total
                    ? W(lang, "Nothing matches your search.", "Nada coincide con su búsqueda.")
                    : W(lang, `No ${l.en.toLowerCase()} here yet.`, `Aún no hay nada en ${l.es}.`)}
                  body={data.total
                    ? W(lang, "Change the search or the filters.", "Cambie la búsqueda o los filtros.")
                    : W(lang, "Be the first one here.", "Sea el primero aquí.")} />
              ) : (
                /* ── ONLY THE SLIDES YOU CAN REACH ARE REAL ─────────────────────────────
                   ⚠️ Every card in the lane used to be a live <video> or <img> behind the one
                   you were looking at. Fifty listings meant fifty video players running at once,
                   which is the stutter Lee reported on the listing photos in September, and it
                   would be worse here because these are full screen.

                   The card you are on, plus one above and one below, is real. The rest are empty
                   boxes of exactly the same height with the same snap point, so the scroll bar,
                   the snapping and the position are unchanged and nothing jumps. One either
                   side, not zero: the next slide has to exist before the thumb arrives. */
                data.cards.map((card, n) => (
                  Math.abs(n - idxs[l.key]) <= 1
                    ? <Slide key={card.id} card={card} lane={l} lang={lang}
                        eager={n < 2} sound={sound} chromeHidden={chromeHidden}
                        /* R16 note 2 — Lee: *"tapping anywhere on a slide should open that
                           listing, same as the button."* The slide decides what a tap IS (see
                           laneCard.tsx); this decides what it DOES, and it does exactly what the
                           card's own button does, because there is only one destination per card
                           and two ways to reach it is already one more than the design has.

                           `showChrome()` first, so the header and the tab bar are back when the
                           browser's back button returns them to a feed they left mid-swipe. */
                        onTap={() => { showChrome(); nav(card.href); }} />
                    : <div key={card.id} aria-hidden
                        className="h-full w-full snap-start snap-always bg-black" />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* ── THE RIGHT RAIL — save, comments, share, map, sound. ONE search button and it is in
          the footer (Lee: *"we don't need two"*), so there is no magnifier here. ───────────── */}
      {railVisible && (
        /* ⚠️ THE RAIL DOES NOT HIDE. It belongs to the item, like the information block, and it
           drops by exactly the same amount so the two can never separate. Lee: *"the right rail
           is disappearing with the footer and it should not."* Only the header and the tab bar
           hide on a swipe up. */
        <div data-ow="rail"
          className="absolute bottom-[calc(120px+env(safe-area-inset-bottom))] right-4 z-20 flex flex-col items-center gap-3"
          style={{ ...DROP_EASE, transform: chromeHidden ? DROP : undefined }}>
          <SlideEngagement card={current} lang={lang} />
          {lane.key === "home" && (
            <button type="button" className={ICO}
              onClick={() => homes.setView(v => v === "map" ? "list" : "map")}
              aria-label={W(lang, "Map", "Mapa")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" />
              </svg>
            </button>
          )}
          <button type="button" className={ICO} onClick={toggleSound} aria-pressed={sound}
            aria-label={sound ? W(lang, "Sound on", "Sonido activado") : W(lang, "Sound off", "Sonido desactivado")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H2v6h4l5 4z" />
              {sound ? <path d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13" /> : <path d="M23 9l-6 6M17 9l6 6" />}
            </svg>
          </button>
        </div>
      )}

      {/* ── THE SEARCH PANE — the lane's OWN controls, on frosted glass over the video. ─────
          Lee: *"we spent a lot of time designing the search section… use that same section."*
          ⚠️ It stops above the tab bar and the tab bar sits over it: with the pane covering the
          whole screen, the ONE search button that opened it was underneath, so the only way out
          was a Close button in the corner. A control that opens a thing and cannot close it is
          half a control. */}
      <div aria-hidden={!pane}
        className={`absolute inset-x-0 bottom-0 top-0 z-30 overflow-y-auto bg-paper/50 px-4 pb-28
          pt-[calc(env(safe-area-inset-top)+50px)] text-ink backdrop-blur-2xl backdrop-saturate-150
          transition-transform duration-300 dark:bg-ink/60 dark:text-paper
          ${pane ? "translate-y-0" : "pointer-events-none -translate-y-[105%]"}`}>
        <div className="mb-3 flex items-center justify-between">
          <b className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight">
            <i className="h-[9px] w-[9px] rounded-full" style={{ background: lane.hue }} aria-hidden />
            {lang === "en" ? lane.en : lane.es}
          </b>
          <button type="button" className="ow-tap rounded-full border ow-edge px-3 py-2 text-[13px] font-bold"
            onClick={() => setPane(false)}>{W(lang, "Close", "Cerrar")}</button>
        </div>

        <div className="mb-2.5 flex gap-2">
          <label className="flex h-[52px] flex-[6] items-center gap-2 rounded-2xl border ow-edge bg-white/70 px-3.5 dark:bg-white/10">
            <span className="sr-only">{W(lang, "Search", "Buscar")}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" className="opacity-50" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
            {/* Short enough to be READ in the field it sits in. The long version was cut off
                mid-word at 390 pixels, which is a placeholder that teaches nothing. */}
            <input value={q} onChange={e => setQ(e.target.value)} type="search"
              placeholder={lane.key === "home" ? W(lang, "Search homes…", "Buscar casas…")
                : lane.key === "events" ? W(lang, "Search events…", "Buscar eventos…")
                : lane.key === "jobs" ? W(lang, "Search work…", "Buscar trabajo…")
                : W(lang, "Search posts…", "Buscar publicaciones…")}
              className="w-full bg-transparent text-[15px] font-semibold outline-none" />
          </label>

          {/* Homes keeps its 60/40 location dropdown, which writes the SAME neighbourhood filter
              the sheet writes, so the two can never disagree. */}
          {lane.key === "home" && (
            <label className="relative flex h-[52px] flex-[4] items-center rounded-2xl border ow-edge bg-white/70 pl-2.5 pr-7 dark:bg-white/10">
              <span className="sr-only">{D(lang, "fltHood")}</span>
              <select value={homes.filters.neighbourhood}
                onChange={e => {
                  const v = e.target.value;
                  homes.setFilters(f => ({ ...f, neighbourhood: v }));
                  homes.setDraftFilters(f => ({ ...f, neighbourhood: v }));
                }}
                className="ow-fade w-full appearance-none bg-transparent text-[13px] font-semibold outline-none">
                <option value="">{D(lang, "fltAnywhere")}</option>
                {homes.feedHoods.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="pointer-events-none absolute right-2 opacity-40"><Chevron /></span>
            </label>
          )}
        </div>

        {/* HOMES — OneHome's own control row: filters, sort, list or map, three layouts. */}
        {lane.key === "home" && (
          <ControlRow
            filters={homes.filters} sort={homes.sort} view={homes.view} layout={homes.layout}
            layouts={LAYOUTS.map(o => ({ ...o, glyph: <LayoutGlyph id={o.id} /> }))}
            onOpenFilters={homes.openFilters}
            onSort={homes.setSort} onView={homes.setView} onLayout={id => homes.setLayout(id as any)} />
        )}

        {/* EVENTS — OneEvent's own filter sheet, and its own five sorts. */}
        {lane.key === "events" && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${PILL} inline-flex items-center gap-1.5`}
              onClick={events.openFilters}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" aria-hidden><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              {W(lang, "Filters", "Filtros")}
              {events.filterCount> 0 && (
                <span className="rounded-full bg-teal px-1.5 text-[11px] font-black text-ink">{events.filterCount}</span>
              )}
            </button>
            {EVENT_SORTS.map(s => (
              <button key={s.id} type="button" aria-pressed={events.sort === s.id}
                onClick={() => events.setSort(s.id)}
                className={`${PILL} ${events.sort === s.id ? PILL_ON : ""}`}>
                {W(lang, s.en, s.es)}
              </button>
            ))}
          </div>
        )}

        {/* JOBS — the same two sets the classic Jobs screen puts behind a segmented control. */}
        {lane.key === "jobs" && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={jobs.kind === "jobs"} onClick={() => jobs.setKind("jobs")}
              className={`${PILL} ${jobs.kind === "jobs" ? PILL_ON : ""}`}>
              {W(lang, "Jobs", "Trabajos")}
            </button>
            <button type="button" aria-pressed={jobs.kind === "people"} onClick={() => jobs.setKind("people")}
              className={`${PILL} ${jobs.kind === "people" ? PILL_ON : ""}`}>
              {W(lang, "People for hire", "Personas disponibles")}
            </button>
          </div>
        )}

        {/* SOCIALS — the platform pills, built from what is actually in the feed, so a filter
            never appears for a platform with nothing behind it. */}
        {lane.key === "socials" && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={socials.platforms.length === 0}
              onClick={() => socials.setPlatforms([])}
              className={`${PILL} ${socials.platforms.length === 0 ? PILL_ON : ""}`}>
              {W(lang, "All", "Todo")}
            </button>
            {socials.platformPills.map(p => {
              const on = socials.platforms.includes(p.key);
              return (
                <button key={p.key} type="button" aria-pressed={on}
                  onClick={() => socials.setPlatforms(s => on ? s.filter(k => k !== p.key) : [...s, p.key])}
                  className={`${PILL} ${on ? PILL_ON : ""}`}>{p.label}</button>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[12.5px] opacity-60">
          {W(lang, `${cards.length} of ${byLane[lane.key].total} shown.`,
            `${cards.length} de ${byLane[lane.key].total} mostrados.`)}
        </p>

        <Link to={lane.classicPath} className="mt-4 inline-block text-[13px] font-bold underline underline-offset-4">
          {W(lang, `Open the ${lane.en} feed`, `Abrir el feed de ${lane.es}`)}
        </Link>
      </div>

      {/* ── THE FOOTER — the world feed, the ONE search button, plus, messages, profile. ──── */}
      <nav aria-hidden={chromeHidden || undefined}
        className={`absolute inset-x-4 bottom-[max(22px,env(safe-area-inset-bottom))] z-40 flex h-16 items-center
          justify-around overflow-hidden rounded-[32px] border ow-edge backdrop-blur-xl backdrop-saturate-150
          transition-all duration-300 ${chromeHidden ? "translate-y-[150%] opacity-0" : "translate-y-0 opacity-100"}`}
        style={{ background: "rgba(17,23,38,.62)" }}>
        <span aria-hidden className="absolute inset-x-[18%] top-0 h-[2px] rounded"
          style={{ background: lane.hue, boxShadow: `0 0 18px 4px ${lane.hue}73` }} />
        <button type="button"
          onClick={() => { setPane(false); homes.setView("list"); homes.setLayout("big"); }}
          aria-label={W(lang, "World feed", "Feed del mundo")}
          /* NO PLATE AND NO BORDER — Lee, on seeing the first version: *"it doesn't need to
             stand out from the rest of the icons… it looks like it has a different background
             on it. You could just show the icon like the others, by themselves. Make it much
             bigger — if you take the border away, the icon should be as big as the circular
             border was — and vivid, with a slight shadow so it stands out from whatever is
             behind."* So the button is now nothing but the mark, at the full 42 the plate used
             to occupy, and the shadow below is what replaces the plate's job of separating it
             from a bright video frame. */
          className="grid h-[42px] w-[42px] place-items-center rounded-full">
          {/* ── THE REAL MARK, NOT A DRAWING OF ONE (R16 note 7) ───────────────────────────
              Lee: *"our footer has a generic circle for the O, but it should be our actual asset
              that's there instead. It's just the O — not the text, but just the O."*

              It was a conic gradient masked into a ring: four lane colours swept round a circle.
              Close enough to pass at a glance and wrong in the one place it matters, because the
              company's mark is not a ring — it is a crescent with the pixels breaking off the top
              right, and no amount of CSS is going to be that.

              `/mark-oneworld.png` is the same file `OneWorldEntry` and the switcher already put on
              screen, so the feed's O and the front door's O are now one asset by construction.
              Resolved through `BASE_URL` for the same reason the shell's `TopBar` does it: the
              sandbox is served from a sub-path and a bare "/mark-…" would 404 there.

              420 × 512, so it is sized by HEIGHT and left to find its own width — forcing it
              square would squash the crescent. */}
          <img aria-hidden alt="" decoding="async"
            className="h-[42px] w-auto object-contain"
            /* Two shadows, not one: a tight dark halo that lifts the mark's pale right-hand side
               off a light frame, and a wider soft light one that lifts its dark left-hand crescent
               off a dark frame. The mark is legible either way without a plate under it. */
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.55)) drop-shadow(0 0 7px rgba(255,255,255,.38))" }}
            src={`${(import.meta as any).env?.BASE_URL ?? "/"}mark-oneworld.png`} />
        </button>
        <button type="button" onClick={() => setPane(p => !p)} aria-pressed={pane}
          aria-label={W(lang, "Search and filters", "Búsqueda y filtros")}
          className="grid h-[42px] w-[42px] place-items-center rounded-full text-white opacity-60">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
        </button>
        {/* The plus adds to the CURRENT lane — Lee, R7. "Everything else" joins it next batch. */}
        <Link to={ADD_TO[lane.key]} aria-label={W(lang, "Add", "Añadir")}
          className="grid h-[50px] w-[50px] place-items-center rounded-full bg-clay text-white">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
        </Link>
        <Link to={productHref(lane.app, "/messages")} aria-label={W(lang, "Messages", "Mensajes")}
          className="grid h-[42px] w-[42px] place-items-center rounded-full text-white opacity-60">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        </Link>
        <Link to={productHref(lane.app, "/profile")} aria-label={W(lang, "Profile", "Perfil")}
          className="grid h-[42px] w-[42px] place-items-center rounded-full text-white opacity-60">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </Link>
      </nav>
    </div>
  );
}

/**
 * WHERE THE PLUS GOES IN EACH LANE — the EXISTING create screen, never a new one.
 *
 * ⚠️ Every one of these was checked against the product's own route table, not guessed. The
 * first draft had `/events/create` and `/jobs/post`; neither route exists, so the plus would
 * have been a button that opened Not found in two lanes out of four. Creating an event happens
 * on My Events, and every job on the platform starts at OneJob's raised money button.
 */
const ADD_TO: Record<LaneKey, string> = {
  home:    productHref("onerental", "/list"),    // List a place — OneHome's own raised centre
  events:  productHref("oneevent", "/events"),   // My Events = create an event + your events
  jobs:    productHref("onejob", "/qr"),         // Start a job — readiness, contract, Quick-Hire
  socials: productHref("onesocial", "/post"),    // New post
};
