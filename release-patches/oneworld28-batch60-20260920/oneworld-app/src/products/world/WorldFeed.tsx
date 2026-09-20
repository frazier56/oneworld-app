import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CONFIGS, Drawer, NotificationBell, Avatar, Chevron, I18nProvider,
  useI18n, useAsync, supabase, productHref, W,
  FeedMedia, feedLead, coverOf, mediaRowOf,
  ListingEngagement, ListingMap, type MapPin, fillMissingPoints,
  fetchTrm, type Trm, useViewerCcy, type ViewerCcy,
  useChromeHidden, showChrome, hideChrome,
  CO_NEIGHBOURHOODS, coCityKey,
} from "@oneworld/shell";
import {
  type Property, type RentalAgent, FEED_CARD_COLUMNS, CO_CITIES,
  priceLabel, priceOnly, locationShort,
} from "../onerental/lib/rental";
import {
  FilterSheet, ControlRow, EMPTY, matches, sortListings, activeCount,
  LAYOUTS, LayoutGlyph, type Filters, type Sort,
} from "../onerental/components/FilterSheet";
import { ListingCard } from "../onerental/screens/Feed";
import { useListingRatings } from "../shared/ListingRatings";
import { D } from "../onerental/lib/detailCopy";
import { LANES, laneAt, laneIndex, type Lane } from "./lanes";

/**
 * THE WORLD FEED — `/sandbox`.
 * ============================================================================================
 * Lee approved this after four prototype rounds on 20 September 2026. One screen per thing;
 * swipe up for the next one, sideways for the next lane.
 *
 * ── WHY IT LIVES AT `/sandbox` AND NOT ON A STAGING HOSTNAME ────────────────────────────────
 * Lee: *"a secondary environment, like a sandbox… that looks just like the real environment so
 * we can test without affecting production."* One ID is a SAME-ORIGIN session. A different
 * hostname is a different origin, the session cannot follow it, and the member would be asked
 * to sign in again — so a staging host would not mirror production, it would only look like it.
 * A route mirrors it by construction: same build, same sign-in, same database, same shell.
 * It is linked from nothing; you reach it by typing it. `/` is untouched until Lee says.
 *
 * ── WHAT THIS SCREEN DOES NOT OWN ───────────────────────────────────────────────────────────
 * Almost everything. The rows are the classic feed's rows, read with the classic feed's column
 * list. The media is the shell's. The filters, the sort, the three layouts and the map are
 * OneHome's own controls, rendered inside a frosted pane — not redrawn. The heart, the comment
 * count and the share sheet are the shell's `ListingEngagement`. The drawer is the shell's
 * drawer. Tapping the button opens the existing detail screen. This file is a LAYOUT over
 * things that already work, and the day it starts owning behaviour it has gone wrong.
 *
 * ── WHAT IS IN THIS BATCH ───────────────────────────────────────────────────────────────────
 * The Homes lane, wired end to end: real listings, real media, real controls, the real detail
 * screen and back to the same slide. The other three lanes swipe, name themselves and carry
 * their dot, and each opens its own classic feed while its cards are being wired. Nothing on
 * screen promises a card that is not there.
 */

/* Sound is OFF until the member asks for it, and then it stays on. Module scope rather than a
   stored flag: "for the session" is exactly the life of this module, and a preference written
   to a device is a preference that outlives the intent behind it. */
let soundOn = false;

const PAGE = 12;

/* ── THE DRAWN CARD ──────────────────────────────────────────────────────────────────────────
   Lee: a lane item with no media at all must never be a blank green screen. The card is DRAWN
   from the lane's own hue and carries the title, so it reads as a listing without a photograph
   rather than as a picture that failed to load. */
function DrawnCard({ hue, title }: { hue: string; title: string }) {
  return (
    <div className="absolute inset-0" aria-hidden
      style={{ background: `linear-gradient(160deg, ${hue}, #0B0F1A)` }}>
      <div className="absolute inset-0 opacity-25"
        style={{ backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,.06) 0 2px, transparent 2px 9px)" }} />
      <div className="absolute inset-x-6 top-1/3 text-[26px] font-extrabold leading-tight text-white/90">{title}</div>
    </div>
  );
}

/* The round glass control used in the header and down the right rail. Same 38px circle, same
   blur, in both themes — the prototype's `.ico`. */
/* The hairline is not decoration. A dark glass circle over a dark video is a control you cannot
   see you can press — the control-contrast rule set on 17 September, applied here from the start
   rather than after a screenshot. */
const ICO = "grid h-[38px] w-[38px] place-items-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-md";

/**
 * ⚠️ `onLight` IS NOT A STYLE PREFERENCE. The same header sits over a video (white text, with a
 * shadow, because the background is a photograph and could be any colour) and over the map and
 * the two list layouts (normal ink on normal paper). White on the light map was unreadable and
 * the prototype has always drawn this header both ways — `.mapov .lanename` uses the theme's
 * text colour. One component, two honest surfaces, never two headers.
 */
function LaneHeading({ lane, lang, idx, onBack, onLight = false }: {
  lane: Lane; lang: string; idx: number; onBack?: () => void; onLight?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <div className={`flex items-center gap-2 text-[22px] font-extrabold leading-tight tracking-tight
        ${onLight ? "text-ink dark:text-paper" : "text-white"}`}
        style={onLight ? undefined : { textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>
        {onBack && (
          <button type="button" onClick={onBack} className={`${ICO} h-[34px] w-[34px]`}
            aria-label={W(lang, "Back", "Atrás")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
        {/* ⚠️ A WHITE RING, NOT A RING OF ITS OWN COLOUR. The orange dot on the orange Events
            card was invisible — a lane marker that disappears on its own lane. */}
        <i className="h-[9px] w-[9px] shrink-0 rounded-full"
          style={{ background: lane.hue, boxShadow: "0 0 0 2px rgba(255,255,255,.8)" }} aria-hidden />
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
     Lee's check for this screen is: tap the button, land on the existing detail screen, press
     Back, and be on THE SAME SLIDE. Component state cannot do that — the component is unmounted
     while the detail screen is open. The address survives, so the address is where it goes. */
  const startLane = useRef(laneIndex(params.get("lane"))).current;
  const startIdx = useRef(Math.max(0, Number(params.get("i") ?? 0) | 0)).current;

  const [laneI, setLaneI] = useState(startLane);
  const [idx, setIdx] = useState(startIdx);
  const lane = laneAt(laneI);

  const [sound, setSound] = useState(soundOn);
  const [drawer, setDrawer] = useState(false);
  const [pane, setPane] = useState(false);
  const chromeHidden = useChromeHidden();

  /* ── THE HOMES LANE'S ROWS ────────────────────────────────────────────────────────────────
     The classic feed's query, its column list and its ordering — newest first, public, published
     and with the host's feed switch on. Not a new query with new columns: `FEED_CARD_COLUMNS`
     is the same constant `screens/Feed.tsx` now reads. */
  const [take, setTake] = useState(PAGE);
  const listings = useAsync(async () => {
    const { data } = await supabase
      .from("rental_properties")
      .select(FEED_CARD_COLUMNS)
      .eq("is_public", true)
      .eq("status", "published")
      .eq("feed_visible", true)
      .order("created_at", { ascending: false })
      .limit(take);
    return (data ?? []) as unknown as Property[];
  }, [take]);

  /* One batched, column-named read. Never `select("*")` on profiles — that is a 42501. */
  const agents = useAsync(async () => {
    const ids = [...new Set((listings ?? []).map(l => l.agent_id))];
    if (!ids.length) return {} as Record<string, RentalAgent>;
    const { data } = await supabase
      .from("profiles").select("id, full_name, photo_url, score_v9_snapshot").in("id", ids);
    return Object.fromEntries((data ?? []).map((a: any) => [a.id, {
      agent_id: a.id, full_name: a.full_name, photo_url: a.photo_url,
      /* The PUBLISHED score — the same column the detail screen shows. It is a snapshot, so it
         is drawn only when there is one, and nothing here recomputes or interprets it. */
      score: typeof a.score_v9_snapshot === "number" ? a.score_v9_snapshot : null,
      total_listings: 0, active_listings: 0,
    } as RentalAgent]));
  }, [listings?.length], listings !== undefined);

  /* The property and host star ratings the classic card draws. One batched read for the page,
     exactly as the classic feed does it — the grid and row layouts below ARE that card. */
  const ratings = useListingRatings(listings);

  /* The reader's currency and today's official rate — the same two the classic feed uses, so a
     price cannot read differently on the two screens. */
  const [trm, setTrm] = useState<Trm | null>(null);
  useEffect(() => { void fetchTrm().then(setTrm); }, []);
  const [viewCcy] = useViewerCcy();

  /* ── THE CONTROLS, WHICH ARE ONEHOME'S ────────────────────────────────────────────────────
     Same state shape, same `matches`, same `sortListings`, same `FilterSheet`. The frosted pane
     is where they are DRAWN; it is not a second filter model. */
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"list" | "map">("list");
  const [layout, setLayout] = useState<"big" | "grid" | "row">("big");
  const filterCount = activeCount(filters);
  const openFilters = () => { setDraftFilters(filters); setSheetOpen(true); };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (listings ?? [])
      .filter(l => {
        if (!needle) return true;
        const a = agents?.[l.agent_id];
        return [l.title, l.description, l.city, l.neighbourhood, a?.full_name]
          .some(v => (v ?? "").toLowerCase().includes(needle));
      })
      .filter(l => matches(l, filters, trm?.rate));
  }, [listings, agents, q, filters, trm]);

  const shown = useMemo(() => sortListings(list, sort, trm?.rate), [list, sort, trm?.rate]);

  /* The barrios actually present, then the curated list for the chosen city — the same rule the
     classic feed's location dropdown follows, so a pick can never return an empty feed. */
  const feedHoods = useMemo(() => {
    const present = [...new Set((listings ?? [])
      .map(l => (l.neighbourhood ?? "").trim()).filter(Boolean))].sort();
    const curated = CO_NEIGHBOURHOODS[coCityKey(
      CO_CITIES.find(c => c.key === filters.city)?.label ?? "")] ?? [];
    const seen = new Set(present.map(h => h.toLowerCase()));
    return [...present, ...curated.filter(h => !seen.has(h.toLowerCase()))];
  }, [listings, filters.city]);

  /* The number the sheet's footer promises, computed from the DRAFT against the same text
     narrowing that is already in force — otherwise it says "Show 40" and applying shows 6. */
  const { draftCount, histListings } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const narrowed = (listings ?? []).filter(l => {
      if (!needle) return true;
      const a = agents?.[l.agent_id];
      return [l.title, l.description, l.city, l.neighbourhood, a?.full_name]
        .some(v => (v ?? "").toLowerCase().includes(needle));
    });
    const noPrice = { ...draftFilters, minPrice: null, maxPrice: null };
    return {
      draftCount: narrowed.filter(l => matches(l, draftFilters, trm?.rate)).length,
      histListings: narrowed.filter(l => matches(l, noPrice, trm?.rate)),
    };
  }, [listings, agents, q, draftFilters, trm]);

  /* ── THE MAP IS THE EXISTING MAP ──────────────────────────────────────────────────────────
     Pins come off `shown`, never off everything fetched: a filtered map that still shows the
     whole set is a filter that silently does not apply. Legacy listings with no stored point are
     resolved on read so they earn a pin rather than disappearing. */
  const [latePoints, setLatePoints] = useState<Record<string, { lat: number; lng: number; precision: "exact" | "approximate" }>>({});
  useEffect(() => {
    if (view !== "map") return;
    let alive = true;
    void fillMissingPoints(shown as any[]).then(m => { if (alive && Object.keys(m).length) setLatePoints(p => ({ ...p, ...m })); });
    return () => { alive = false; };
  }, [view, shown]);

  const pins: MapPin[] = useMemo(() => shown
    .map(l => ({ l, pt: (l.display_lat != null && l.display_lng != null)
      ? { lat: l.display_lat as number, lng: l.display_lng as number, precision: l.geo_precision === "exact" ? "exact" as const : "approximate" as const }
      : latePoints[l.id] }))
    .filter(({ pt }) => !!pt)
    .map(({ l, pt }) => ({
      id: l.id, lat: pt!.lat, lng: pt!.lng, exact: pt!.precision === "exact",
      priceLabel: priceOnly(l, viewCcy, trm?.rate),
      title: l.title,
      photo: coverOf(l),
      facts: locationShort(l, lang) || null,
      href: productHref("onerental", `/r/${l.id}`),
    })), [shown, latePoints, viewCcy, trm?.rate, lang]);

  /* ── ONE SCROLLER PER AXIS ────────────────────────────────────────────────────────────────
     Sideways is the lane track; up and down is the column inside it. Both are CSS scroll-snap
     containers, so the phone does the physics and there is no gesture library to fight with. */
  const track = useRef<HTMLDivElement | null>(null);
  const columns = useRef<(HTMLDivElement | null)[]>([]);

  /* Restore the lane and the slide the member left on, before the first paint they will notice.
     `behavior: "auto"` — a restored position must arrive, not animate. */
  useEffect(() => {
    const t = track.current;
    if (t) t.scrollTo({ left: startLane * t.clientWidth, behavior: "auto" });
    const col = columns.current[startLane];
    if (col) col.scrollTo({ top: startIdx * col.clientHeight, behavior: "auto" });
    /* Once, on mount. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The address follows the thumb, replacing rather than stacking: forty slides must not become
     forty entries in the member's Back history. */
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("lane", laneAt(laneI).key);
    next.set("i", String(idx));
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneI, idx]);

  /* ── HIDE ON SWIPE UP, BACK ON SWIPE DOWN ─────────────────────────────────────────────────
     Reported into the SHELL's chrome store, which is the same state the header and tab bar of
     every classic screen already use. It is published for this screen precisely so there is not
     a second hide-on-scroll: the window listener in that module never fires here, because this
     feed scrolls inside a container. Same store, same behaviour, one truth. */
  const lastTop = useRef(0);
  const onColumnScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const h = Math.max(1, el.clientHeight);
    const n = Math.round(el.scrollTop / h);
    if (n !== idx) setIdx(n);
    const d = el.scrollTop - lastTop.current;
    /* 6px of deadband: momentum scrolling emits jittering deltas and a bar that chatters is the
       flicker Lee has reported three times. */
    if (Math.abs(d) < 6) return;
    lastTop.current = el.scrollTop;
    if (d > 0) hideChrome(); else showChrome();
  };

  const onTrackScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (n !== laneI) {
      setLaneI(n);
      const col = columns.current[n];
      setIdx(col ? Math.round(col.scrollTop / Math.max(1, col.clientHeight)) : 0);
      showChrome();
    }
  };

  /* Which surface the header is sitting on right now — a photograph, or a normal page. */
  const overLight = lane.key === "home" && (view === "map" || layout !== "big");

  const items = lane.key === "home" ? shown : [];
  const current = items[Math.min(idx, Math.max(0, items.length - 1))];

  const toggleSound = () => { soundOn = !soundOn; setSound(soundOn); };

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black text-white"
      style={{ ["--lane-hue" as any]: lane.hue }}>

      {/* The real filter sheet. It portals to <body>, so it paints over the pane it is opened
          from; it lives here so its state sits beside the feed's. */}
      <FilterSheet open={sheetOpen} value={filters} resultCount={draftCount} fx={trm?.rate}
        priceListings={histListings} onChange={setDraftFilters}
        onClose={() => { setFilters(draftFilters); setSheetOpen(false); }} />

      {/* ── THE DRAWER AND THE BELL SPEAK THE LANE'S LANGUAGE ────────────────────────────────
          ⚠️ Caught in the harness: the drawer opened with a row reading "properties" in lower
          case. The screen is mounted on the One World config — it carries four products, so no
          single product's chrome may own it — and `t()` therefore looked OneHome's words up in
          OneJob's dictionary, found nothing, and printed the KEY. A raw key on a member's screen
          is the loudest possible version of this mistake and it would have shipped.

          One nested provider, holding the LANE's dictionary, around the two pieces of shell
          chrome that read from it. The language itself is the member's stored choice and is
          untouched — only which product's words are looked up changes. */}
      <I18nProvider dict={CONFIGS[lane.app].dictionary} defaultLang={CONFIGS[lane.app].defaultLang}>
        <Drawer config={CONFIGS[lane.app]} open={drawer} onClose={() => setDrawer(false)} />
      </I18nProvider>

      {/* ── HEADER: lane name and dots left, bell and menu right. No wordmark. ──────────────
          One row where there were two. It slides away on swipe up and returns on swipe down,
          off the same state as the classic header. */}
      {/* ⚠️ ONE LANE NAME ON THE SCREEN AT A TIME. The pane carries its own heading, and with the
          feed's header still behind the glass the word "Homes" was printed twice, one under the
          other. Caught in the harness at 390 pixels, in both themes, before Lee saw it. */}
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
        {LANES.map((l, i) => (
          <div key={l.key} ref={el => { columns.current[i] = el; }}
            onScroll={i === laneI ? onColumnScroll : undefined}
            /* ⚠️ `snap-y snap-mandatory` BELONGS HERE AND WAS MISSING ON THE FIRST RUN. Without
               it the column scrolled freely and a swipe up left two half-slides on the screen —
               the one thing this feed must never do. Caught in the harness before it was seen.
               Sideways is the track's snap; up and down is this one. */
            className="h-full w-full shrink-0 snap-center snap-always snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {l.key === "home" ? (
              listings === undefined ? (
                <div className="ow-shimmer h-full w-full" aria-busy="true" />
              ) : !shown.length ? (
                <LaneNote lane={l} lang={lang}
                  title={listings.length ? W(lang, "No places match your search.", "Ningún inmueble coincide con su búsqueda.")
                    : D(lang, "noPlacesYet")}
                  body={listings.length ? W(lang, "Change the search or the filters.", "Cambie la búsqueda o los filtros.")
                    : D(lang, "startingInCo")} />
              ) : view === "map" ? (
                /* ── R6 · THE EXISTING MAP, UNDER THIS FEED'S HEADER ──────────────────────
                   ⚠️ Two defects the harness caught here on one screenshot. The map is 62% of
                   the viewport tall by default, which is right in a scrolling feed and leaves a
                   black band on a full-screen one — so it is told to fill. And the map's own
                   empty state came out white-on-light-grey, because this screen's root is
                   `text-white` for text over video and the map inherited it. The map is a
                   normal surface: it gets normal ink on normal paper, in both themes. */
                <div className="min-h-full w-full overflow-y-auto bg-paper px-3 pb-28
                  pt-[calc(env(safe-area-inset-top)+86px)] text-ink dark:bg-ink dark:text-paper">
                  <ListingMap pins={pins} onOpen={p => nav(p.href)} />
                </div>
              ) : layout === "big" ? (
                shown.map((p, n) => (
                  <HomeSlide key={p.id} p={p} agent={agents?.[p.agent_id]} lane={l} lang={lang}
                    eager={n < 2} sound={sound} ccy={viewCcy} fx={trm?.rate}
                    onTap={() => showChrome()} />
                ))
              ) : (
                /* The grid and row layouts are the CLASSIC card, in a plain scrolling list —
                   Lee: *"if you click the view… that needs to work."* Same filtered set, same
                   order, same card. A second card design here would be a third OneHome card. */
                /* ⚠️ `bg-paper dark:bg-ink`, not `bg-ink` twice. The first pass hardcoded the dark
                   surface, so the grid and row layouts were a dark sheet in the light theme —
                   the classic cards were right and the page under them was not. */
                <div className={`min-h-full bg-paper px-3 pb-28 pt-[calc(env(safe-area-inset-top)+86px)] dark:bg-ink
                  ${layout === "grid" ? "grid grid-cols-2 gap-2" : "space-y-3"}`}>
                  {shown.map(p => (
                    <ListingCard key={p.id} l={p} agent={agents?.[p.agent_id]} lang={lang}
                      layout={layout} ccy={viewCcy} fx={trm?.rate}
                      propertyRatings={ratings.property} hostRatings={ratings.host} />
                  ))}
                </div>
              )
            ) : (
              <LaneNote lane={l} lang={lang}
                /* Two short lines that break where the meaning breaks. The first draft read
                   "Events cards are being wired up." and split after "wired". */
                title={W(lang, "Cards come next.", "Las tarjetas vienen después.")}
                body={W(lang, "The lane, its controls and its feed work today.",
                  "El carril, sus controles y su feed ya funcionan hoy.")} />
            )}
          </div>
        ))}
      </div>

      {/* ── THE RIGHT RAIL — save, comments, share, map, sound. ONE search button and it is in
          the footer (Lee: *"we don't need two"*), so there is no magnifier here. ────────── */}
      {lane.key === "home" && current && view === "list" && layout === "big" && (
        <div className={`absolute bottom-[120px] right-4 z-20 flex flex-col items-center gap-3 transition-opacity duration-300
          ${chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <ListingEngagement vertical onDark lang={lang}
            itemId={current.id} source="rental_property" savesAs="rental_property"
            shareUrl={`${window.location.origin}${productHref("onerental", `/r/${current.id}`)}`}
            shareTitle={current.title} allowShare={current.allow_public_share !== false} />
          <button type="button" className={ICO} onClick={() => setView(v => v === "map" ? "list" : "map")}
            aria-label={W(lang, "Map", "Mapa")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" />
            </svg>
          </button>
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
          So the search field, the location dropdown and the whole control row below it are
          OneHome's, rendered here. Filters opens OneHome's filter sheet. Nothing is redrawn. */}
      <div aria-hidden={!pane}
        /* ⚠️ THE PANE STOPS ABOVE THE TAB BAR, AND THE TAB BAR SITS OVER IT. Found in the
           harness on the first run: with the pane covering the whole screen, the ONE search
           button — the thing that opened it — was underneath, so the only way out was the
           Close button in the corner. A control that opens a thing and then cannot close it is
           half a control. The bar stays reachable, the magnifier stays pressed while the pane
           is open, and tapping it again closes it. */
        className={`absolute inset-x-0 top-0 bottom-0 z-30 overflow-y-auto px-4 pb-28 pt-[calc(env(safe-area-inset-top)+50px)]
          text-ink backdrop-blur-2xl backdrop-saturate-150 transition-transform duration-300 dark:text-paper
          bg-paper/50 dark:bg-ink/60
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
            <input value={q} onChange={e => setQ(e.target.value)} type="search"
              /* Short enough to be READ in the field it sits in. The long version was cut off
                 mid-word at 390 pixels, which is a placeholder that teaches nothing. */
              placeholder={W(lang, "Search homes…", "Buscar casas…")}
              className="w-full bg-transparent text-[15px] font-semibold outline-none" />
          </label>
          <label className="relative flex h-[52px] flex-[4] items-center rounded-2xl border ow-edge bg-white/70 pl-2.5 pr-7 dark:bg-white/10">
            <span className="sr-only">{D(lang, "fltHood")}</span>
            <select value={filters.neighbourhood}
              onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, neighbourhood: v })); setDraftFilters(f => ({ ...f, neighbourhood: v })); }}
              className="ow-fade w-full appearance-none bg-transparent text-[13px] font-semibold outline-none">
              <option value="">{D(lang, "fltAnywhere")}</option>
              {feedHoods.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 opacity-40"><Chevron /></span>
          </label>
        </div>

        <ControlRow
          filters={filters} sort={sort} view={view} layout={layout}
          layouts={LAYOUTS.map(o => ({ ...o, glyph: <LayoutGlyph id={o.id} /> }))}
          onOpenFilters={openFilters}
          onSort={setSort} onView={setView} onLayout={id => setLayout(id as any)} />

        <p className="mt-3 text-[12.5px] opacity-60">
          {W(lang, `${shown.length} of ${listings?.length ?? 0} shown.`,
            `${shown.length} de ${listings?.length ?? 0} mostrados.`)}
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
        <button type="button" onClick={() => { setPane(false); setView("list"); setLayout("big"); }}
          aria-label={W(lang, "World feed", "Feed del mundo")}
          className="grid h-[42px] w-[42px] place-items-center rounded-full bg-white/15">
          <span aria-hidden className="h-[22px] w-[22px] rounded-full"
            style={{ background: `conic-gradient(from 210deg, ${LANES[3].hue}, ${LANES[0].hue}, ${LANES[2].hue}, ${LANES[1].hue}, ${LANES[3].hue})`,
              WebkitMask: "radial-gradient(circle, transparent 40%, #000 44%)",
              mask: "radial-gradient(circle, transparent 40%, #000 44%)" }} />
        </button>
        <button type="button" onClick={() => setPane(p => !p)} aria-pressed={pane}
          aria-label={W(lang, "Search and filters", "Búsqueda y filtros")}
          className="grid h-[42px] w-[42px] place-items-center rounded-full opacity-60">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
        </button>
        <Link to={productHref(lane.app, lane.key === "home" ? "/list" : "")}
          aria-label={W(lang, "Add", "Añadir")}
          className="grid h-[50px] w-[50px] place-items-center rounded-full bg-clay text-white">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
        </Link>
        <Link to={productHref(lane.app, "/messages")} aria-label={W(lang, "Messages", "Mensajes")}
          className="grid h-[42px] w-[42px] place-items-center rounded-full opacity-60">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        </Link>
        <Link to={productHref(lane.app, "/profile")} aria-label={W(lang, "Profile", "Perfil")}
          className="grid h-[42px] w-[42px] place-items-center rounded-full opacity-60">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </Link>
      </nav>
    </div>
  );
}

/** An honest full-screen card: what this lane is, and the way into its classic feed. */
function LaneNote({ lane, lang, title, body }: { lane: Lane; lang: string; title: string; body: string }) {
  return (
    <div className="relative grid h-full w-full place-items-center px-8 text-center">
      <DrawnCard hue={lane.hue} title="" />
      <div className="relative z-[1]">
        <p className="text-[19px] font-extrabold leading-tight text-white">{title}</p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-white/70">{body}</p>
        <Link to={lane.classicPath}
          className="mt-5 inline-flex h-[42px] items-center rounded-[14px] bg-clay px-5 text-[14px] font-extrabold text-white">
          {W(lang, `Open the ${lane.en} feed`, `Abrir el feed de ${lane.es}`)}
        </Link>
      </div>
    </div>
  );
}

/**
 * ONE HOME, ONE SCREEN.
 *
 * The media fills it; the information block sits above the button; the price is IN that block
 * and never on the video (Lee, item 2 of version four). One button, and it opens the property
 * screen that already exists.
 */
function HomeSlide({ p, agent, lane, lang, eager, sound, ccy, fx, onTap }: {
  p: Property; agent?: RentalAgent; lane: Lane; lang: string; eager: boolean; sound: boolean;
  ccy: ViewerCcy; fx?: number | null; onTap: () => void;
}) {
  const lead = feedLead(mediaRowOf(p));
  const cover = coverOf(p);
  const where = locationShort(p, lang);
  return (
    <section className="relative h-full w-full snap-start snap-always bg-black" onPointerUp={onTap}>
      {lead
        ? <FeedMedia media={lead} poster={cover} eager={eager} sound={sound}
            className="absolute inset-0 h-full w-full object-cover" />
        : <DrawnCard hue={lane.hue} title={p.title} />}
      {/* One scrim, four stops — the same one every OneHome surface puts under text on a photo. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%]"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,.94) 0%, rgba(0,0,0,.86) 28%, rgba(0,0,0,.55) 62%, rgba(0,0,0,0) 100%)" }} />

      <div className="absolute bottom-[112px] left-[18px] right-20 z-[3] text-white">
        <div className="mb-1.5 flex items-center gap-2">
          <Avatar name={agent?.full_name ?? ""} src={agent?.photo_url ?? null} size={34} />
          <span className="text-[15px] font-extrabold">{agent?.full_name ?? W(lang, "One World host", "Anfitrión One World")}</span>
          {agent?.score != null && (
            <span className="inline-flex items-center gap-1 text-[12px] font-extrabold text-amber-400">
              <i aria-hidden className="inline-block h-[15px] w-[15px] rounded-full border-2 border-amber-400" />
              {Math.round(agent.score)}
            </span>
          )}
        </div>
        <p className="mb-1 text-[19px] font-extrabold leading-tight tracking-tight">{p.title}</p>
        <p className="mb-0.5 text-[15px] font-extrabold">{priceLabel(p, lang, ccy, fx)}</p>
        {where && <p className="mb-3 text-[13px] text-white/85">{where}</p>}
        <Link to={productHref("onerental", `/r/${p.id}`)}
          className="inline-flex h-[42px] items-center justify-center rounded-[14px] bg-clay px-[18px] text-[14px] font-extrabold text-white">
          {D(lang, "requestBooking")}
        </Link>
      </div>
    </section>
  );
}
