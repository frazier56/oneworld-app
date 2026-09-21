import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CONFIGS, Drawer, NotificationBell, Chevron, I18nProvider,
  useI18n, productHref, W, ListingMap,
  useChromeHidden, showChrome, hideChrome,
} from "@oneworld/shell";
import { FilterSheet, ControlRow, LAYOUTS, LayoutGlyph } from "../onerental/components/FilterSheet";
import { ListingCard } from "../onerental/screens/Feed";
import { CO_CITIES } from "../onerental/lib/rental";
import { D } from "../onerental/lib/detailCopy";
import { LANES, laneAt, laneIndex, type Lane, type LaneKey } from "./lanes";
import { Slide, SlideEngagement, LaneNote, type LaneCard } from "./laneCard";
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
        <Drawer config={CONFIGS[lane.app]} open={drawer} onClose={() => setDrawer(false)} />
      </I18nProvider>

      {/* ── HEADER: lane name and dots left, bell and menu right. No wordmark. ───────────────
          One row where there were two. It slides away on swipe up and returns on swipe down. */}
      <header aria-hidden={chromeHidden || pane || undefined}
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 pt-[env(safe-area-inset-top)] transition-all duration-300
          ${chromeHidden || pane ? "-translate-y-[140%] opacity-0" : "translate-y-0 opacity-100"}`}>
        <div className="pointer-events-auto flex items-center justify-between gap-2.5 px-4 pb-1.5 pt-1">
          <LaneHeading lane={lane} lang={lang} idx={laneI} onLight={overLight} />
          <div className="flex items-center gap-2">
            <div className={ICO}>
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
                  {homes.shown.map(p => (
                    <ListingCard key={p.id} l={p} agent={homes.agents?.[p.agent_id]} lang={lang}
                      layout={homes.layout} ccy={homes.viewCcy} fx={homes.trm?.rate}
                      propertyRatings={homes.ratings.property} hostRatings={homes.ratings.host} />
                  ))}
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
                        eager={n < 2} sound={sound} onTap={() => showChrome()} />
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
        <div className={`absolute bottom-[120px] right-4 z-20 flex flex-col items-center gap-3 transition-opacity duration-300
          ${chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"}`}>
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
          className="grid h-[42px] w-[42px] place-items-center rounded-full bg-white/15">
          <span aria-hidden className="h-[22px] w-[22px] rounded-full"
            style={{ background: `conic-gradient(from 210deg, ${LANES[3].hue}, ${LANES[0].hue}, ${LANES[2].hue}, ${LANES[1].hue}, ${LANES[3].hue})`,
              WebkitMask: "radial-gradient(circle, transparent 40%, #000 44%)",
              mask: "radial-gradient(circle, transparent 40%, #000 44%)" }} />
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
