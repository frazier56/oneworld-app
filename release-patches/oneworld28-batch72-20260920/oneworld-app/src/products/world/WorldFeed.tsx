import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CONFIGS, Drawer, NotificationBell, Chevron, I18nProvider,
  useI18n, productHref, W, ListingMap, supabase, type MapPin,
  useChromeHidden, showChrome, hideChrome, NavIcon, type AppKey,
} from "@oneworld/shell";
import { FilterSheet, ControlRow, LAYOUTS, LayoutGlyph } from "../onerental/components/FilterSheet";
import { ListingCard } from "../onerental/screens/Feed";
import { SaleCard } from "../onesale/screens/Feed";
import { CO_CITIES } from "../onerental/lib/rental";
import { D } from "../onerental/lib/detailCopy";
import { LANES, laneAt, laneIndex, type Lane, type LaneKey } from "./lanes";
import { Slide, SlideEngagement, RailSave, LaneNote, DROP, DROP_EASE, type LaneCard } from "./laneCard";
import Intro, { introSeen, clearIntroSeen } from "./Intro";
import CommentSheet from "./CommentSheet";

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

  /* ── R17 NOTE 2 · THE MAP IS A PLACE, SO THE BACK BUTTON CLOSES IT ────────────────────────
     Lee, on his phone: *"the map has no back button. Opening the map from the right rail strands
     you. The phone's own back button then signs you out and dumps you on the OneEvent splash
     page, and signing back in lands you in OneEvent, not the feed."*

     Two bugs in one gesture, and the second is caused by the first. The map was component state
     — `homes.view === "map"` — so opening it added NOTHING to the member's history. The phone's
     Back button therefore did the only thing left to it: it left `/sandbox` entirely, for
     whatever page came before, which is why he landed somewhere else and why his place in the
     feed was gone. Nothing was "signing him out"; he was being carried out of the feed.

     The fix is to make opening the map a real history entry, the same way the lane and the slide
     already live in the address. Back then pops that entry, the map closes, and he is standing on
     the slide he left. `pushedMap` records whether THIS session pushed it, because somebody who
     opens `/sandbox?view=map` from a link has no entry to pop and must be closed by rewriting the
     address instead — `nav(-1)` there would take them out of the app, which is the bug again.

     The lane's own `view` state stays the source of truth for WHAT is drawn; the address is the
     source of truth for whether the map is OPEN. One direction each, so they cannot fight. */
  const mapOpen = params.get("view") === "map";
  const pushedMap = useRef(false);

  /* Homes still has its OWN list/grid/map view control inside the search pane, and that one is
     about how the Homes lane is laid out. The feed's map is a different thing — it belongs to
     the whole feed — so the address drives it and the Homes view follows rather than leads. */
  useEffect(() => {
    if (!mapOpen) { pushedMap.current = false; if (homes.view === "map") homes.setView("list"); }
    else if (lane.key === "home" && homes.view !== "map") homes.setView("map");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOpen, lane.key]);


  /** The ONE way the map opens or closes, wherever the tap came from. */
  const chooseView = (v: string) => {
    if (v === "map") {
      if (mapOpen) return;
      const next = new URLSearchParams(params);
      next.set("view", "map");
      pushedMap.current = true;
      setParams(next);                       // pushed, not replaced — this is the history entry
      return;
    }
    if (mapOpen) {
      if (pushedMap.current) { nav(-1); return; }
      const next = new URLSearchParams(params);
      next.delete("view");
      setParams(next, { replace: true });    // arrived on a link: rewrite, never walk backwards
      return;
    }
    homes.setView(v as any);
  };

  /* ── R22 · THE MAP IS THE REAL MAP ────────────────────────────────────────────────────────
     Lee: *"we're going to need roads… a good, like a Google type of map, where people can see
     where the pin is. Approximate locations, put a little circle somewhere in this vicinity —
     kind of like Airbnb does. We already should already be a part of what we're doing."*

     He is right about the last part and my own map was the wrong answer. `ListingMap` in the
     shell already loads Google Maps with roads, already draws a soft circle instead of a pin
     when the poster chose an approximate location, already says so in its legend, and already
     uses price pills with tap-for-card / tap-again-for-listing. Drawing a grid of normalised
     dots threw all of it away and answered none of the question a map is opened to answer.

     So `LaneMap.tsx` is deleted and the map control points here. The one rule my file did get
     right is kept: the map shows THE LANE YOU CAME FROM — homes, events and jobs each on their
     own map — which is exactly what Lee asked for and falls out of the pins being per-lane. */
  const lanePins: MapPin[] = useMemo(() => {
    if (lane.key === "home") return homes.pins;
    if (lane.key === "events") return events.pins;
    if (lane.key === "jobs") return jobs.pins;
    return socials.pins;
  }, [lane.key, homes.pins, events.pins, jobs.pins, socials.pins]);

  /* R24 — comments open over the feed, not inside the rail. */
  const [comments, setComments] = useState(false);
  /* R26 — the comment count for the card on screen. One head-count query per slide, and only
     for a card that has an engagement row to count against. */
  const [commentCount, setCommentCount] = useState<number | undefined>(undefined);
  useEffect(() => { setComments(false); }, [lane.key, idx]);
  /* ⚠️ THE FOOTER GETS OUT OF THE WAY (R25). Lee: *"the comment section can't be exactly the
     same because we have our footer."* Instagram has no tab bar on a reel; ours is a floating
     pill at the bottom of the screen and the composer would have opened underneath it. So the
     sheet borrows the chrome store the header and tab bar already obey — one source of truth,
     and it returns on its own when the sheet closes. */
  useEffect(() => {
    if (comments) hideChrome(); else showChrome();
  }, [comments]);

  useEffect(() => {
    const c = byLane[lane.key].cards[Math.min(idx, Math.max(0, byLane[lane.key].cards.length - 1))];
    if (!c?.engagement) { setCommentCount(undefined); return; }
    let live = true;
    setCommentCount(undefined);
    supabase.from("media_comments")
      .select("id", { count: "exact", head: true })
      .eq("media_item_id", c.id).eq("media_source", c.engagement.source)
      .then(({ count }) => { if (live) setCommentCount(count ?? 0); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lane.key, idx, comments]);

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
  /* The rail belongs to the ITEM, so it is there whenever an item is on screen — every lane,
     not only Homes. It stands down for the two Homes layouts that are lists rather than slides,
     and for the map, which is a screen of its own with its own controls. */
  const railVisible = !!current && !mapOpen && !comments && !(lane.key === "home" && homes.layout !== "big");

  return (
    /* ── THE PHONE FRAME (R19) ───────────────────────────────────────────────────────────────
       Lee, on a desktop: *"everything is so wide… it needs to show in a mobile aspect ratio.
       On the computer things are just too big. It's not designed to be wide like this."*

       He is right, and it is not a styling accident — this screen IS a phone. Full-bleed video
       with a thumb rail down one edge and snap points a flick apart is a design for a hand, and
       stretched to 1600 pixels it stops being that design and becomes a poster. Every other
       full-screen feed does the same thing on a desktop for the same reason.

       So the feed is drawn inside a column the width of a large phone, centred, on a black
       field. `min(100vw, 460px)` means the cap NEVER applies on a phone — the viewport is always
       narrower — so nothing about the mobile design changes by a pixel. The whole screen simply
       stops growing past the width it was designed for.

       The children stay `absolute inset-0` and now inset to THIS box rather than the window,
       which is why the header, the rail, the footer and the map all come along without a single
       edit of their own. */
    <div className="fixed inset-0 z-0 flex justify-center bg-black">
      <div data-ow="phone-frame"
        className="relative h-full w-full overflow-hidden bg-black text-white"
        style={{ maxWidth: "min(100vw, 460px)" }}>

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
          extraRows={
            /* ── THE FEED'S OWN MENU GROUP (R18 note 3) ───────────────────────────────────
               Lee: *"the menu is unpolished. 'Show the intro again' works; the drawer around
               it needs a design pass."*

               He is right, and the fault was mine rather than the drawer's. These two rows were
               written as loose buttons in a different weight and a different shape from every
               other row beside them, hanging off the end of the product's list with nothing to
               say what they belonged to — so the menu read as a tidy list with two strangers at
               the bottom.

               They now use the SHELL's own row shape, letter for letter (same height, same gap,
               same 15px medium type, same 70%-opacity glyph, same hover), and they sit under a
               small heading behind a divider — which is the pattern this drawer already uses to
               separate Apps from Services. Nothing about the shared drawer changes; the rows
               stop pretending they are not rows. */
            <>
              <div className="my-2 h-px bg-ink/10 dark:bg-white/10" />
              <p className="px-3 pb-1 pt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-45">
                {W(lang, "World feed", "Feed del mundo")}
              </p>
              <button type="button"
                onClick={() => { clearIntroSeen(); setDrawer(false); setIntro(true); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition hover:bg-brand/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 opacity-70" aria-hidden>
                  <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
                </svg>
                <span>{W(lang, "Show the intro again", "Ver la introducción otra vez")}</span>
              </button>
              <button type="button"
                onClick={() => { clearOpenerSeen(); window.location.assign(`${(import.meta as any).env?.BASE_URL ?? "/"}`); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition hover:bg-brand/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 opacity-70" aria-hidden>
                  <path d="M4 5.5v13l11-6.5z" /><path d="M19 5v14" />
                </svg>
                <span>{W(lang, "Play the film again", "Ver la película otra vez")}</span>
              </button>
            </>
          } />
      </I18nProvider>

      {comments && current?.engagement && (
        <CommentSheet itemId={current.id} source={current.engagement.source}
          title={current.title} lang={lang} onClose={() => setComments(false)} />
      )}

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
          /* ── R21 · THE VIEW SWITCHER, AND WHY IT FOUGHT THE THUMB ───────────────────────
             Lee: *"when you click on search and you want to modify the view from seeing one
             single post to multiple posts to a list, that is not working very well at all."*

             He is right and the cause is one word in this string. `snap-y snap-mandatory`
             BELONGS on a column of full-screen slides — without it a swipe up leaves two half
             slides on screen, which is the one thing this feed must never do. But the two list
             layouts are not slides. They are a scrolling list of cards of different heights
             inside a container that has been told every scroll MUST come to rest on a snap
             point — so the list shoved itself around under the thumb and would not stop where
             it was put. Mandatory snapping on a free-scrolling list is the defect.

             So the snap rules apply to the SLIDE layouts only. The horizontal `snap-center`
             stays either way: the lane track is still a lane track. */
          const listMode = l.key === "home" && homes.layout !== "big";
          const colClass = `h-full w-full shrink-0 snap-center snap-always overflow-y-auto overscroll-y-contain
            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${listMode ? "" : "snap-y snap-mandatory"}`;
          return (
            <div key={l.key} ref={el => { columns.current[i] = el; }}
              /* ⚠️ AND THE SCROLL LISTENER HAS TO STAND DOWN TOO. It reads `scrollTop /
                 clientHeight` to decide which SLIDE you are on and to ask for the next page
                 three slides early. On a list of cards that division means nothing: scrolling
                 down a list of twelve cards was reporting slide 4, moving the feed's index and
                 firing paging that the list had not asked for. */
              onScroll={listMode ? undefined : onColumnScroll(l.key)} className={colClass}>
              {!data.ready ? (
                <div className="ow-shimmer h-full w-full" aria-busy="true" />
              ) : l.key === "home" && homes.layout !== "big" ? (
                /* The two list layouts are the CLASSIC card in a plain scrolling list — Lee:
                   *"if you click the view… that needs to work."* Same filtered set, same order,
                   same card. A second card design here would be a third OneHome card. */
                /* ⚠️ `text-ink dark:text-paper` IS THE WHOLE BUG IN LEE'S SCREENSHOT (R24).
                   This screen's root is `text-white`, because everything on it sits over video.
                   The two list layouts are the only things on it that sit on PAPER — and they
                   inherited that white, so "$4,500 / month" was white type on a white card and
                   the whole list read as empty boxes with a thumbnail. Exactly the defect the
                   map's empty state had in batch 1, in a second place. Any surface in this file
                   that is not over video has to say its own ink. */
                <div className={`min-h-full bg-paper px-3 pb-28 pt-[calc(env(safe-area-inset-top)+86px)]
                  text-ink dark:bg-ink dark:text-paper
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
                      /* ── THE TWINS DRIFTED AGAIN, AND THE GRID SHOWED IT (R21) ──────────
                         `ListingCard` has three layouts — big, two-up and compact row, each
                         with its own markup. `SaleCard` has ONE. Squeezed into a half-width
                         grid cell it kept drawing its full-width design, so "3 bed · 3 bath ·
                         184 m²" wrapped one word per line and the price printed on top of the
                         location. The photo pass caught it; Lee would have caught it faster.

                         The right fix is three layouts on `SaleCard` to match its twin — the
                         same drift its own file already carries a long note about — and that
                         is OneHome's file, so it is FLAGGED in the submission rather than
                         rebuilt here. What this does is stop the collision now: a sale card
                         gets the full width its one layout needs, and the rentals still sit
                         two-up around it. Honest and ragged beats tidy and unreadable. */
                      ? <div key={m.sale.id} className={homes.layout === "grid" ? "col-span-2" : undefined}>
                        <SaleCard l={m.sale} agent={homes.agents?.[m.sale.agent_id]}
                          lang={lang}
                          /* ⚠️ `SaleCard` still types this as "USD" | "COP" while the reader's
                             currency has been any of 22 codes since the picker grew — its own
                             file says so and calls it the twins drifting. Widening that type is
                             OneHome's file, not this lane's, so it is flagged in the submission
                             rather than changed here. */
                          ccy={homes.viewCcy as "USD" | "COP"} fx={homes.trm?.rate}
                          hostRatings={homes.ratings.host} />
                        </div>
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
                        /* R20 — tapping no longer leaves the feed. On a video the player
                           takes the tap and pauses; on a photo this brings the chrome back, and
                           the ONE way into a listing is the View listing button. */
                        onTap={() => showChrome()} />
                    : <div key={card.id} aria-hidden
                        className="h-full w-full snap-start snap-always bg-black" />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* ── THE MAP, FULL BLEED, ONE LANE AT A TIME (R22) ───────────────────────────────
          `heightClass="h-full"` is the whole of "rebuild it for this screen" — `ListingMap`
          already takes its height from its container, so it needed a container, not a rewrite.
          `period` is the money word stated once above the map instead of on every marker;
          Homes is per month, an event ticket and a job rate are not per anything. */}
      {/* ── WHY THE MAP WAS A WHITE SCREEN (R24) ────────────────────────────────────────
          `ListingMap`'s own root is `<div className="relative">` with no height of its own;
          the map canvas inside it is given `heightClass`. On OneHome that is `h-[62vh]`, a
          viewport unit, so it works anywhere. I passed `h-full` — and `h-full` of a parent
          with no height is ZERO. The script loaded, the map booted into a box nought pixels
          tall, and what showed was the page behind it.

          `[&>div]:h-full` gives that root the height it never had, and the inner `rounded-2xl`
          is squared off because a full-bleed map has no corners. */}
      {mapOpen && (
        <div data-ow="lane-map"
          className="absolute inset-0 z-[25] bg-paper dark:bg-ink [&>div]:h-full [&>div>div]:rounded-none">
          <ListingMap pins={lanePins} heightClass="h-full" gestureHandling="greedy"
            period={lane.key === "home" ? "month" : null}
            onOpen={pin => nav(pin.href)} />
          <button type="button" onClick={() => chooseView("list")}
            className="ow-tap absolute left-4 top-[calc(env(safe-area-inset-top)+64px)] z-[6] inline-flex
              h-[38px] items-center gap-1.5 rounded-full border border-white/25 bg-black/60 px-3.5
              text-[13px] font-extrabold text-white backdrop-blur-md">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {W(lang, "Back to the feed", "Volver al feed")}
          </button>
          {!lanePins.length && (
            <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl
              bg-black/60 px-4 py-3 text-center text-[14px] font-bold text-white backdrop-blur-md">
              {W(lang, `Nothing in ${lane.en} has a location yet.`,
                       `Nada en ${lane.es} tiene ubicación todavía.`)}
            </div>
          )}
        </div>
      )}

      {/* ── THE RIGHT RAIL — ONE SET, AND THE RULE FOR IT (R17 note 4) ──────────────────────
          Lee: *"the right rail is not consistent between lanes. Homes shows five icons. Decide
          one set and apply it to every lane, or state the rule for when an icon is absent."*

          THE RULE, in one line: the rail carries what is true about THE THING YOU ARE LOOKING
          AT, and nothing else.

          That single sentence removes the five-versus-three difference he saw, because the
          fifth icon was the MAP — and a map is not a fact about a home, it is a way of looking
          at the whole lane. It has moved to the lane's own view control in the search pane,
          where list and grid have always lived, so it is no longer in two places at once.

          What is left is the same column everywhere, in the same order, bottom-anchored so the
          sound button sits at the same height in all four lanes and the thumb never hunts:

            Save · Comment · Share · Sound

          · SHARE and SOUND are on every card of every lane. Every card has a URL and every card
            has media, so both are always true.
          · SAVE and COMMENT need somewhere to write. Homes writes to `rental_property` /
            `sale_property` and Socials to `media_post`; Events and Jobs have no such row today,
            so those two lanes show Share and Sound alone.

          ⚠️ AND THEY SHOW NOTHING ELSE — no greyed-out heart. Lee's own standing rule is that a
          control which half works and is called "tracked" is gaslighting. A dead heart on a job
          would be exactly that. Giving Events and Jobs real saves is a migration (one `kind` on
          `saved_items`), it is the honest way to make all four lanes carry four icons, and it is
          named in the submission note as the next step rather than faked here.

          ONE search button and it is in the footer (Lee: *"we don't need two"*), so there is no
          magnifier here either. ─────────────────────────────────────────────────────────────── */}
      {railVisible && (
        /* ⚠️ THE RAIL DOES NOT HIDE. It belongs to the item, like the information block, and it
           drops by exactly the same amount so the two can never separate. Lee: *"the right rail
           is disappearing with the footer and it should not."* Only the header and the tab bar
           hide on a swipe up. */
        <div data-ow="rail"
          /* gap-3 → gap-5. Lee, with Instagram's reel beside ours: *"we probably need to put a
             little bit more space in between them like they have."* Their column breathes
             because each control carries a count under it; ours was spaced for bare glyphs. */
          /* ── NO CIRCLES (R26) ───────────────────────────────────────────────────────────
             Lee: *"take the circle from around all of the icons. You just need the icons. Make
             them maybe 10% bigger, and put a little shadow behind them so they stand out
             against the background."*

             The circles were doing legibility work — a white glyph on an unknown video frame —
             and a drop-shadow does that work without putting a box around everything. One
             `filter` on the column covers every child, including the shell's own like, comment
             and share glyphs, so nothing has to be styled twice. */
          style={{ ...DROP_EASE, transform: chromeHidden ? DROP : undefined,
                   filter: "drop-shadow(0 1px 2px rgba(0,0,0,.55)) drop-shadow(0 2px 7px rgba(0,0,0,.4))" }}
          className="absolute bottom-[calc(120px+env(safe-area-inset-bottom))] right-4 z-20 flex flex-col items-center gap-5">
          <SlideEngagement card={current} lang={lang} href={current?.href} title={current?.title}
            onComments={() => setComments(true)} commentCount={commentCount} />
          <RailSave card={current} lang={lang} />
          {/* ── THE MAP IS BACK IN THE RAIL, AND IT IS ON ALL FOUR LANES (R18 note 1) ───────
              Lee, twice: *"we have five buttons… all five show on the OneHome feed but they
              don't show up on the others. We should see all five buttons."*

              Overlay 6 moved this to the search pane on the argument that a map is a lane view
              rather than an item action. Lee has now overruled that twice, and he is right for
              a reason the argument missed: on a swipe feed the rail IS the control surface, and
              a control that lives somewhere else does not exist. Five, everywhere, same order. */}
          <button type="button" className="ow-tap grid place-items-center text-white"
            onClick={() => chooseView(mapOpen ? "list" : "map")}
            aria-pressed={mapOpen}
            aria-label={W(lang, "Map", "Mapa")}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" />
            </svg>
          </button>
          <button type="button" className="ow-tap grid place-items-center text-white" onClick={toggleSound} aria-pressed={sound}
            aria-label={sound ? W(lang, "Sound on", "Sonido activado") : W(lang, "Sound off", "Sonido desactivado")}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
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
        /* ── R17 NOTE 10 · 85% OPAQUE, NOT 50 ──────────────────────────────────────────────
           Lee: *"the filter sheet is too transparent. You can read the feed through it. Take it
           to roughly fifteen percent transparency — readable, still glass."*

           It was `bg-paper/50` over `dark:bg-ink/60`, which is a tinted window, not a surface:
           a label reading "Bedrooms" sat over whatever photograph the slide behind it happened
           to be showing, so it was legible on one listing and gone on the next. Fifteen percent
           transparency is 85% fill, and that is now BOTH themes — there is no reason for light
           to be ten points thinner than dark.

           ── AND AGAIN AT 92% (R18 note 2). Lee, on the published build: *"the filter sheet is
           still too transparent. You can read the feed through it."* At 85 you still could,
           because what is behind it is not a wall — it is a moving, high-contrast photograph
           under a bright scrim. The shell's own popups sit at 97 for exactly this reason. 92
           keeps a visible frost while putting the text on a surface; if Lee still reads the
           feed through it, the next stop is the shell's 97 and no glass at all.

           The blur and the saturate stay. The frost is the look Lee asked for; what he did not
           ask for is reading two things at once. (This is the same reasoning the shell's own
           `--overlay-bg` token already applies to every popup in the family at 97%, which is
           why the product's real filter SHEET was never the problem — this pane is.) */
        className={`absolute inset-x-0 bottom-0 top-0 z-30 overflow-y-auto bg-paper/[0.92] px-4 pb-28
          pt-[calc(env(safe-area-inset-top)+50px)] text-ink backdrop-blur-2xl backdrop-saturate-150
          transition-transform duration-300 dark:bg-ink/[0.92] dark:text-paper
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

        {/* ── A SLIDING TOGGLE, NOT THREE BUTTONS (R23) ───────────────────────────────────
            Lee: *"it needs to be a toggle, left and right toggle — like I'm switching between
            homes for sale and homes for rent. These two little buttons don't really look
            right."*

            One track, one thumb that slides, three stops. It writes the same `homeKind` filter
            the sheet writes, both copies together, exactly as the neighbourhood dropdown below
            does — so the pane and the sheet can never disagree about what the lane is showing.

            The thumb is a single element moved by `translate`, not three backgrounds turned on
            and off: that is what makes it read as one control sliding rather than three lights
            blinking, and it is the difference Lee is pointing at. */}
        {lane.key === "home" && (() => {
          const KINDS = [
            ["both", W(lang, "Both", "Ambos")],
            ["rent", W(lang, "For rent", "En arriendo")],
            ["sale", W(lang, "For sale", "En venta")],
          ] as const;
          const at = Math.max(0, KINDS.findIndex(([id]) => id === (homes.filters.homeKind ?? "both")));
          return (
            <div className="relative mb-2.5 grid h-[52px] grid-cols-3 overflow-hidden rounded-2xl border ow-edge
              bg-white/70 p-1 dark:bg-white/10" role="group"
              aria-label={W(lang, "For rent or for sale", "En arriendo o en venta")}>
              {/* Lee: *"that blue needs to be more like a midnight blue, and more like a
                  gradient — shiny, with a shimmer. Right now it's real plain and it's the wrong
                  blue."* Flat `lane.hue` is OneHome's bright sky blue. This is a deep
                  midnight ramp with a specular highlight along the top edge and a soft glow
                  under the thumb, so it reads as a lit object sliding rather than a painted
                  rectangle. */}
              <span aria-hidden
                className="absolute bottom-1 left-1 top-1 w-[calc((100%-0.5rem)/3)] rounded-[12px] transition-transform duration-300"
                style={{
                  transform: `translateX(${at * 100}%)`,
                  transitionTimingFunction: "cubic-bezier(.7,0,.25,1)",
                  background: "linear-gradient(160deg,#2B4E9B 0%,#16306B 46%,#0C1B44 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.34), inset 0 -1px 0 rgba(0,0,0,.35), 0 3px 10px rgba(8,18,48,.55)",
                }} />
              {KINDS.map(([id, label], i) => (
                <button key={id} type="button" aria-pressed={at === i}
                  onClick={() => {
                    homes.setFilters(f => ({ ...f, homeKind: id }));
                    homes.setDraftFilters(f => ({ ...f, homeKind: id }));
                  }}
                  className={`relative z-[1] rounded-[12px] text-[14px] font-extrabold transition-colors ${
                    at === i ? "text-white" : "opacity-70"}`}>
                  {label}
                </button>
              ))}
            </div>
          );
        })()}

        {/* HOMES — OneHome's own control row: filters, sort, list or map, three layouts. */}
        {lane.key === "home" && (
          <ControlRow
            filters={homes.filters} sort={homes.sort} view={homes.view} layout={homes.layout}
            layouts={LAYOUTS.map(o => ({ ...o, glyph: <LayoutGlyph id={o.id} /> }))}
            onOpenFilters={homes.openFilters}
            onSort={homes.setSort}
            /* Choosing a view or a layout CLOSES the pane (R21). The pane covers the whole
               screen, so picking "Two per row" changed the feed underneath and showed the
               member nothing at all — which reads exactly like a control that does not work.
               A choice you cannot see the result of is not a choice. */
            onView={v => { chooseView(v); setPane(false); }}
            onLayout={id => { homes.setLayout(id as any); setPane(false); }} />
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

        {/* ── THE FOOT OF THE PANE, TIDIED (Lee, on the published build) ───────────────────
            *"You don't even need to put on here 'open OneHome's feed', like that should be a
            nice button. You got some text going on, but it's not correct."*

            It was a count in grey type with an underlined text link hanging off the bottom —
            two different weights of afterthought where the pane should simply end. The count
            now sits on the same line as the control it describes, and the way out of the lane
            is a real button at full width, which is what it always should have been: it is the
            second most important thing on this screen after the filters. */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink/[0.08] pt-3 dark:border-white/10">
          <p className="text-[12.5px] font-semibold opacity-60">
            {W(lang, `Showing ${cards.length} of ${byLane[lane.key].total}`,
              `Mostrando ${cards.length} de ${byLane[lane.key].total}`)}
          </p>
        </div>
        <Link to={lane.classicPath}
          className="ow-tap mt-2.5 flex h-[52px] w-full items-center justify-between rounded-2xl border ow-edge
            bg-white/70 px-4 text-[14.5px] font-extrabold dark:bg-white/10">
          <span>{W(lang, `Open ${lane.en}`, `Abrir ${lane.es}`)}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" className="opacity-55" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ── THE FOOTER — the world feed, the ONE search button, plus, messages, profile. ──── */}
      <nav aria-hidden={chromeHidden || undefined}
        /* ── GLASS AGAIN, AND NO LANE STRIP (R26) ─────────────────────────────────────────
           Lee: *"take the little colour strip away — it's interfering with the logo. The border
           should be much thinner and much more muted. The pill should be glass morphism and I
           think we've lost that effect; it's just turned dark."*

           He is right on both counts and they had the same cause. The bar was a near-opaque
           navy fill (62%) with the shell's full-strength edge, so it stopped being a lens over
           the video and became a dark plank — and the lane's hue was painted across the top of
           that plank as a 2-pixel bar with a glow, right where the mark now sits.

           The strip is gone: the lane is already named in the header, coloured in the header's
           dot and in the four dots beneath it, so a third statement of it was only ever
           decoration and it was decoration in the worst possible place.

           The fill drops to a white wash at 12%, which is what makes the video read THROUGH the
           bar instead of behind it, and the edge is a hairline at 18% rather than the shell's
           full `ow-edge`. The inner highlight along the top does the work the border used to. */
        className={`absolute inset-x-4 bottom-[max(22px,env(safe-area-inset-bottom))] z-40 flex h-16 items-center
          justify-around rounded-[32px] backdrop-blur-2xl backdrop-saturate-150
          transition-all duration-300 ${chromeHidden ? "translate-y-[150%] opacity-0" : "translate-y-0 opacity-100"}`}
        style={{
          background: "rgba(255,255,255,.12)",
          border: "1px solid rgba(255,255,255,.18)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.26), 0 10px 30px rgba(0,0,0,.34)",
        }}>
        {/* ── FAR LEFT IS HOME (R19) ──────────────────────────────────────────────────────
            Lee: *"move the logo to the middle and keep the home button on the far left of the
            footer."* Same rule as the shell's bar, so the two never disagree: the far left is
            home for wherever you are standing, and on the feed that means the top of the lane
            you are in, with the map closed and the list layout restored. */}
        <button type="button"
          onClick={() => {
            setPane(false); chooseView("list"); homes.setLayout("big");
            setIdxFor(lane.key, 0);
            columns.current[laneI]?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label={W(lang, "Home", "Inicio")}
          className="grid h-[42px] w-[42px] place-items-center rounded-full text-white opacity-75">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" />
          </svg>
        </button>
        <button type="button" onClick={() => setPane(p => !p)} aria-pressed={pane}
          aria-label={W(lang, "Search and filters", "Búsqueda y filtros")}
          className="grid h-[42px] w-[42px] place-items-center rounded-full text-white opacity-60">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
        </button>
        {/* ── THE ONE WORLD MARK, IN THE MIDDLE (R22) ─────────────────────────────────────
            Lee, repeatedly: *"the One Social logo should be in the middle, and then the home
            icon should be on the left in the footer."* Overlay 7 put the lane's own app icon
            here on the argument that it tells you which app you are about to enter. That is a
            defensible idea and it is not the instruction, so it is gone. The header already
            names the lane and colours it, which carries that signal at no cost.

            The button still opens the lane's app — the destination was never in question. */}
        {/* ── IT HAS TO BREAK THE PILL (R24) ──────────────────────────────────────────────
            Lee: *"the centre button should be bigger — bigger than the pill itself, so it's
            almost 3D and sticks out. A thin shadow, almost like a border, but it fades. Be
            careful around those little speckles at the top of the logo."*

            72 pixels against a 64-pixel bar, so it stands proud of the top AND the bottom edge
            rather than sitting inside them. `overflow-hidden` had to come off the bar for that
            to be possible — it was clipping anything that crossed the edge.

            The shadow is FOUR drop-shadows, not one, and that is what the speckles need: a
            `filter: drop-shadow` follows the alpha channel, so each of the seventeen squares
            breaking off the crescent gets its own outline instead of one blurred blob behind
            the whole mark. Three tight offsets at low alpha read as a thin dark edge; the
            fourth is a wide soft light halo that lifts the dark side of the crescent off a dark
            bar. Together they read as a border that fades, which is the ask. */}
        <Link to={centreTab(lane.app).to} aria-label={W(lang, `Open ${lane.en}`, `Abrir ${lane.es}`)}
          className="relative z-[1] grid h-[80px] w-[80px] shrink-0 place-items-center">
          <img aria-hidden alt="" decoding="async"
            /* 72 → 80 and a deeper stack, so it lifts further off the glass (R26). The first
               three shadows are the thin fading edge the speckles need — `drop-shadow` follows
               the alpha channel, so each square gets its own outline. The last two are the
               depth: one close and dark, one wide and soft. */
            className="h-[80px] w-auto object-contain transition active:scale-[.95]"
            style={{ filter: [
              "drop-shadow(0 0 1px rgba(0,0,0,.8))",
              "drop-shadow(0 1px 2px rgba(0,0,0,.6))",
              "drop-shadow(0 4px 10px rgba(0,0,0,.55))",
              "drop-shadow(0 10px 22px rgba(0,0,0,.4))",
              "drop-shadow(0 0 14px rgba(255,255,255,.3))",
            ].join(" ") }}
            src={`${(import.meta as any).env?.BASE_URL ?? "/"}mark-oneworld.png`} />
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
/**
 * THE CENTRE BUTTON — "GO INTO THE APP I AM LOOKING AT" (R17 note 1).
 * ============================================================================================
 * Lee: *"the centre footer button stops being a plus and becomes 'go into the app I'm looking
 * at' — it takes you to whatever that app's centre button opens today, and the footer icons
 * then change to that app's icons."*
 *
 * The footer icons change by themselves, because the destination is a route inside that product
 * and the shell draws that product's own `BottomTabs` when it gets there. Nothing here has to
 * arrange it; the two-button toggle is simply this button going in and the One World mark in
 * slot one coming back out.
 *
 * ⚠️ READ FROM THE PRODUCT'S CONFIG, NEVER RETYPED. This used to be a hand-written table of four
 * paths and it was wrong twice already — `/events/create` and `/jobs/post`, neither of which is
 * a route. "Whatever that app's centre button opens" is a fact the app already states: it is
 * `tabs[2]`, the raised primary slot, which `assertConfig` guarantees exists and is in the
 * middle. Taking it from there means this can never drift from the app again, and the day a
 * product changes its centre action the feed follows with no edit.
 */
const centreTab = (app: AppKey) => CONFIGS[app].tabs[2];
