import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  SearchTriad,
  ListingEngagement, appDoorway,
  HomeTop, Avatar, useI18n, useAsync, supabase, productHref, W,
  IconPin, ListingMap, type MapPin, fillMissingPoints,
  fetchTrm, type Trm, CO_NEIGHBOURHOODS, coCityKey, Chevron,
  useViewerCcy, type ViewerCcy,
  drawPrice,
} from "@oneworld/shell";
import {
  type Property, type RentalAgent, PROPERTY_COLUMNS, CO_CITIES, priceLabel, cop,
} from "../lib/rental";
import SegmentToggle from "../../shared/SegmentToggle";
import { listingFacts } from "../../shared/listingFacts";
import { HostAvatar, PhotoCount } from "../../shared/CardChrome";
import { ListingRatings, RatingRetry, useListingRatings, type RatingSet } from "../../shared/ListingRatings";
import FeedMedia from "../components/FeedMedia";
import { coverOf, feedLead, feedSlides } from "../lib/media";
import { useNavigate } from "react-router-dom";
import {
  FilterSheet, ControlRow, EMPTY, matches, sortListings, type Filters, type Sort,
} from "../components/FilterSheet";

/**
 * /rentals — HOME: the public listing feed.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"the feed in the OneRental is gonna show a feed… here's all the people that
 * posted listings in order. Whichever one's next going right to the feed."*
 *
 * So it is chronological, not ranked. A new listing from an unknown agent appears above an old
 * listing from a busy one — which is the only version an agent joining today will trust. The
 * credibility signal is the SCORE ON THE CARD, not a hidden ordering: OneJob's feed was gated on
 * score and 1 job of 1,385 got through, and that lesson is one product old.
 *
 * The head (search · composer · pills) is the shared HomeTop. Only the feed below is ours.
 */
const PAGE = 12;

/* One scrim, used by every layout that puts text on a photograph. Four stops rather than
   Tailwind's three, because `via-*` pins its stop at the exact midpoint and that left the top of
   the text block sitting over almost-clear glass. This is 55% black where the first line starts
   and 94% at the bottom edge. Lee, 11 Aug 2026: *"if you uploaded a photo and the photo is
   white, you can't see the text."* */
const SCRIM = "linear-gradient(to top, rgba(0,0,0,.94) 0%, rgba(0,0,0,.86) 28%, rgba(0,0,0,.55) 62%, rgba(0,0,0,0) 100%)";

/* The three layouts, and the glyph for each. Drawn, never emoji, and never a letter — an icon
   that shows the SHAPE of the result is understood without a label, which is what lets three
   options live in the width one word would need. */
const LAYOUTS = [
  { id: "big"  as const, en: "Large cards",  es: "Tarjetas grandes" },
  { id: "grid" as const, en: "Two per row",  es: "Dos por fila" },
  { id: "row"  as const, en: "Compact list", es: "Lista compacta" },
];

function LayoutGlyph({ id }: { id: "big" | "grid" | "row" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinejoin: "round" as const };
  if (id === "big") return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
    </svg>
  );
  if (id === "grid") return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...p}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.6" />
    </svg>
  );
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...p}>
      <rect x="3.5" y="5" width="6" height="6" rx="1.4" />
      <rect x="3.5" y="13" width="6" height="6" rx="1.4" />
      <path d="M12.5 7h8M12.5 10h5M12.5 15h8M12.5 18h5" strokeLinecap="round" />
    </svg>
  );
}


/**
 * The WHEN segment's caption. Kept out of the component so the string logic is testable and so a
 * reader of the JSX above is not made to parse two ternaries to find out what the row will say.
 *
 * ⚠️ Dates are ISO `YYYY-MM-DD` and are formatted for the reader's locale, never printed raw. A
 * date shown as 2026-09-12 on a consumer screen is a database field that escaped.
 */
export function owWhenLabel(f: { arriveOn?: string | null; departOn?: string | null }, lang: string): string | null {
  const fmt = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(lang === "en" ? "en-US" : "es-CO",
      { day: "numeric", month: "short", timeZone: "UTC" });
  };
  const a = f.arriveOn ? fmt(f.arriveOn) : null;
  const b = f.departOn ? fmt(f.departOn) : null;
  if (a && b) return `${a} – ${b}`;
  if (a) return lang === "en" ? `From ${a}` : `Desde ${a}`;
  if (b) return lang === "en" ? `Until ${b}` : `Hasta ${b}`;
  return null;
}

export default function Feed() {
  const { lang } = useI18n();
  const [q, setQ] = useState("");
  const [city, setCity] = useState<string | null>(null);
  /* Lee, 11 Aug 2026: *"on the discovery page too, you should have, like, a sort button on there
     and a filter button as well."* Neither existed. See `components/FilterSheet.tsx`. */
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY);
  const [sheetOpen, setSheetOpen] = useState(false);
  /* ⚠️ Seed the draft from the live filters, then open. The sheet edits a draft and commits on
     close; opening without seeding discards whatever is already chosen. Same two lines the filter
     button uses — deliberately not a second implementation. */
  const openFilters = () => { setDraftFilters(filters); setSheetOpen(true); };
  const [sort, setSort] = useState<Sort>("newest");
  /* Lee, 11 Aug 2026: *"We definitely need a map… like a map view so you could see everything in a
     map and zoom in."* List and map are two views of the SAME filtered set — switching must never
     change what you are looking at, only how. */
  const [view, setView] = useState<"list" | "map">("list");
  /* ── THREE WAYS TO READ THE SAME LIST (Lee, 11 Aug 2026) ────────────────────────────────────
     *"We should have three options — one where you can show two at a time, like a column of two,
     so make them much smaller so you could flip them quicker. And then another view option where
     you have a row, like a row of listings, where the thumbnail's on the left and all the
     information's on the right, kind of like a list basically. That should be three view options
     there… I think we don't have any type of view options at all."*

     `big`  — one card, the photograph. For browsing.
     `grid` — two up. For scanning quickly, which is what he means by "flip them quicker".
     `row`  — thumbnail left, facts right. For comparing prices down a column.

     This is deliberately SEPARATE state from list/map. They are different questions — WHAT am I
     looking at versus HOW is it laid out — and collapsing them into one control is how you end
     up with a Map option that a layout picker has to pretend does not exist. Map simply hides
     the layout picker, because there is no list to shape. */
  const [layout, setLayout] = useState<"big" | "grid" | "row">("big");
  /* Lee's throttle. `PAGE` rows per request; the sentinel below the last card asks for another
     page when it comes into view. Never resets on filter change — the filters run client-side
     over what has been fetched, so throwing the fetched rows away would make filtering slower,
     not faster. */
  const [take, setTake] = useState(PAGE);
  /* Today's official COP/USD rate. Fetched once, handed to the filter sheet so a peso price
     range can be converted before it is compared — never typed, never guessed. See lib/trm.ts. */
  const [trm, setTrm] = useState<Trm | null>(null);
  useEffect(() => { void fetchTrm().then(setTrm); }, []);
  /* Lee, 12 Aug: *"the person looking at it should also be able to choose what currency they want
     to see it in."* One preference, shared with Settings and with the sale feed. */
  const [viewCcy] = useViewerCcy();
  const sentinel = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();

  /* ── WHY THIS SELECT IS NARROW ────────────────────────────────────────────────────────────
     Lee, 11 Aug 2026: *"when I first went to Discover page, it was empty, and it took a long time
     for that feed to show up."*

     It was fetching `PROPERTY_COLUMNS` — the full ~45-column block, including every attribute the
     detail screen needs and the feed card never touches — for sixty rows. The card renders eleven
     fields. So roughly three quarters of the bytes on the slowest request in the app were for
     things nobody was about to look at.

     This is the CARD's columns, plus the four the filter sheet reads. The detail screen still
     reads everything — it just does it when somebody actually opens a listing.

     ── AND THE ROW COUNT (Lee, 11 Aug 2026) ─────────────────────────────────────────────────
     *"From a throttling perspective we may not want to show a 1000 listings on the page, or
     populate a 1000 listings on the page all at one time — would probably only populate maybe
     10 before they scroll to the bottom and get to another 10."*

     Sixty became thirty on the last pass; thirty is now `PAGE` = 12, fetched again as somebody
     reaches the end. The feed is the one screen where scrolling forever is right — Lee: *"if
     there's nothing below it, like on the main homepage where there's just a feed, then yeah,
     let them scroll forever"* — but forever should arrive a page at a time, not in one request
     that decides how long the first paint takes.

     The sentinel is an IntersectionObserver on an empty div after the last card, so the next
     page starts loading slightly BEFORE the end is reached and the scroll does not stall. */
  const listings = useAsync(async () => {
    const { data } = await supabase
      .from("rental_properties")
      .select(
        "id, agent_id, title, description, photos, videos, cover_photo, feed_preview, price, price_unit, currency, " +
        "display_currency, display_fx_rate, city, neighbourhood, bedrooms, bathrooms, area_m2, estrato, " +
        "created_at, allow_public_share, display_lat, display_lng, geo_precision, " +
        /* Read by the filter sheet, not drawn on the card. */
        "property_type, pets_allowed, furnished, amenities")
      .eq("is_public", true)
      .eq("status", "published")
      /* 7 Sep 2026 (media lane): the host's feed switch. Off keeps the listing public — the
         link, the profile card and search still open it — and only the Discover feed skips it. */
      .eq("feed_visible", true)
      .order("created_at", { ascending: false })
      .limit(take);
    return (data ?? []) as unknown as Property[];
  }, [take]);

  /* One batched, column-named read for the agents — never `select("*")` on profiles (42501),
     and never one query per card. */
  const ratings = useListingRatings(listings);
  const agents = useAsync(async () => {
    const ids = [...new Set((listings ?? []).map(l => l.agent_id))];
    if (!ids.length) return {} as Record<string, RentalAgent>;
    const { data } = await supabase
      .from("profiles").select("id, full_name, photo_url").in("id", ids);
    return Object.fromEntries((data ?? []).map((a: any) => [a.id, {
      agent_id: a.id, full_name: a.full_name, photo_url: a.photo_url,
      score: null, total_listings: 0, active_listings: 0,
    } as RentalAgent]));
  }, [listings?.length], listings !== undefined);

  /* City pills are built from what is actually listed, so a filter never returns nothing. */
  const pills = useMemo(() => {
    const present = new Set((listings ?? []).map(l => (l.city ?? "").toLowerCase()).filter(Boolean));
    return [
      { key: "all", label: W(lang, "All", "Todo") },
      ...CO_CITIES.filter(c => present.has(c.label.toLowerCase()) || present.has(c.key))
        .map(c => ({ key: c.key, label: c.label })),
    ];
  }, [listings, lang]);

  /* ── WHAT GOES IN THE LOCATION DROPDOWN ─────────────────────────────────────────────────
     The barrios ACTUALLY PRESENT in what has been loaded, first, so a pick can never return an
     empty feed — the same rule the city pills already follow. The curated list for the chosen
     city is appended behind them, because a barrio with nothing in it today is still the thing
     somebody came looking for, and finding it empty is a truthful answer.

     A native <select> is used here and NOWHERE else in the product: `GlassSelect` is canon
     precisely because a native select renders as a black wheel on a phone — but that ruling is
     about controls inside FORMS, and this one has to survive at 94px inside a search row where
     GlassSelect's portal dropdown would be wider than its own trigger. It carries no styling of
     its own; the box around it is the same box as the search field beside it. */
  const feedHoods = useMemo(() => {
    const present = [...new Set((listings ?? [])
      .map(l => (l.neighbourhood ?? "").trim()).filter(Boolean))].sort();
    const curated = CO_NEIGHBOURHOODS[coCityKey(
      CO_CITIES.find(c => c.key === city)?.label ?? "")] ?? [];
    const seen = new Set(present.map(h => h.toLowerCase()));
    return [...present, ...curated.filter(h => !seen.has(h.toLowerCase()))];
  }, [listings, city]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cityLabel = CO_CITIES.find(c => c.key === city)?.label.toLowerCase();
    return (listings ?? [])
      .filter(l => !cityLabel || (l.city ?? "").toLowerCase() === cityLabel)
      .filter(l => {
        if (!needle) return true;
        const a = agents?.[l.agent_id];
        return [l.title, l.description, l.city, l.neighbourhood, a?.full_name]
          .some(v => (v ?? "").toLowerCase().includes(needle));
      })
      .filter(l => matches(l, filters, trm?.rate));
  }, [listings, agents, q, city, filters, trm]);

  const shown = useMemo(() => sortListings(list, sort), [list, sort]);

  /* ── THE NEXT PAGE ─────────────────────────────────────────────────────────────────────────
     `atEnd` is how we know there is more: a short page means the table had nothing else to give,
     so the observer stops asking. Without that check the sentinel re-fires forever at the bottom
     of a finished list and hammers the database with identical queries.

     `rootMargin` starts the fetch 600px early, so on a normal scroll the next cards are already
     there when the last one leaves the screen. */
  const atEnd = (listings?.length ?? 0) < take;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || atEnd || view === "map" || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) setTake(t => t + PAGE); },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [atEnd, view, listings?.length, take]);

  /* Pins come off `shown`, not off `listings` — a filtered map that still shows everything is a
     filter that silently does not apply. Listings with no coordinates are simply absent; the map
     says so rather than pretending the set is empty. */
  /* ── LEGACY LISTINGS EARN A PIN TOO (Lee, 12 Aug 2026) ────────────────────────────────────
     *"This thing says nothing to map. How's it gonna say nothing to map, when there's an actual
     listing?"* Because coordinates are written when a listing is SAVED and his was created before
     that shipped — so it had an address and no point, and the map was honestly reporting that it
     had nothing to draw. `fillMissingPoints` resolves those on read, once per session, falling
     back to the city so a listing never disappears entirely. */
  const [latePoints, setLatePoints] = useState<Record<string, { lat: number; lng: number; precision: "exact" | "approximate" }>>({});
  useEffect(() => {
    if (view !== "map") return;               // never geocode for a map nobody opened
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
      id: l.id,
      lat: pt!.lat,
      lng: pt!.lng,
      exact: pt!.precision === "exact",
      priceLabel: drawPrice(l.price, viewCcy, trm?.rate), // v86.1 · U27 · number only on the map tag
      title: l.title,
      photo: coverOf(l),   // the still cover — a map pin never plays video
      facts: [
        /* Kind first, exactly as the sale card orders it. */
        rentKind((l as any).property_type, lang),
        l.bedrooms != null ? `${l.bedrooms} ${W(lang, "bd", "hab")}` : null,
        l.bathrooms != null ? `${l.bathrooms} ${W(lang, "ba", "baños")}` : null,
        l.area_m2 != null ? `${l.area_m2} m²` : null,
        /* v94 · R45a · Lee named the SALE card's attribute row as the one place the sale side
           is canonical and this card follows it: kind · beds · baths · m² · estrato.
           Estrato is the half that can be added without reading a type I have not seen — the
           != null guard means an absent column simply draws nothing. `as any` because the
           rent Property type may not declare it, and I would rather compile against either
           shape than assert a field I have not read. The property KIND is the other half and
           it is NOT here: the sale side draws KIND_LABEL[l.kind] and I do not know whether
           this type has that field or what it is called. Paste requested. */
        (l as any).estrato != null ? `Estrato ${(l as any).estrato}` : null,
      ].filter(Boolean).join(" · ") || null,
      href: productHref("onerental", `/r/${l.id}`),
    })), [shown, lang, latePoints]);

  /* The number the sheet's footer promises. Computed from the DRAFT so it moves as you tap,
     against the same text/pill narrowing that is already in force — otherwise the footer says
     "Show 40 places" and applying it shows 6. */
  /**
   * Two things come out of the same narrowing, so they cannot disagree:
   *   · `draftCount` — the number the sheet's footer promises
   *   · `histPrices` — the prices the price histogram draws
   *
   * The histogram is deliberately computed with the PRICE filter switched off while every other
   * filter stays on. If the price filter were included, the chart would redraw itself as the
   * handle moved, so the distribution would appear to change while the reader looked at it and
   * the excluded bars — the whole point of the picture — would vanish instead of dimming.
   */
  const { draftCount, histPrices } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cityLabel = CO_CITIES.find(c => c.key === city)?.label.toLowerCase();
    const narrowed = (listings ?? [])
      .filter(l => !cityLabel || (l.city ?? "").toLowerCase() === cityLabel)
      .filter(l => {
        if (!needle) return true;
        const a = agents?.[l.agent_id];
        return [l.title, l.description, l.city, l.neighbourhood, a?.full_name]
          .some(v => (v ?? "").toLowerCase().includes(needle));
      });

    const noPrice = { ...draftFilters, minPrice: null, maxPrice: null };
    return {
      draftCount: narrowed.filter(l => matches(l, draftFilters, trm?.rate)).length,
      histPrices: narrowed
        .filter(l => matches(l, noPrice, trm?.rate))
        /* Always USD — every listing stores its price in USD and `display_currency` only changes
           what is DRAWN. The sheet converts to pesos itself when the reader asks for pesos. */
        .map(l => Number((l as any).price ?? (l as any).asking_price) || 0)
        .filter(n => n > 0),
    };
  }, [listings, agents, q, city, draftFilters, trm]);

  return (
    <>
    {/* The sheet portals to <body>, so where it sits in this tree is irrelevant to how it paints —
        it lives here purely so its state is next to the feed's. */}
    <FilterSheet
      open={sheetOpen} value={filters} resultCount={draftCount} fx={trm?.rate}
      prices={histPrices}
      onChange={setDraftFilters}
      onClose={() => { setFilters(draftFilters); setSheetOpen(false); }} />
    <HomeTop
      product="onerental"
      /* ── NO COMPOSER ON THIS FEED (Lee, 11 Aug 2026, second time of asking) ──────────────
         *"On the feed page there's a section at the top right under the search that says List a
         place. That needs to go away — it just doesn't belong there at all."*

         He is right and it is not a close call. `HomeTop`'s composer is for a feed you POST to;
         OneHome's feed is one you SEARCH. A create-a-listing bar sitting between the search box
         and the filters is an ad for an action, placed exactly where the control you came for
         should be — and listing a place already has its own tab in the bottom bar, its own hub
         screen, and a button in the empty state, where it genuinely helps somebody looking at
         nothing. `composeTo` is simply not passed, so `HomeTop` renders no composer at all. */
      noComposer
      onSearch={setQ}
      /* ── v73 · R24 · WHERE, WHEN, WHO ────────────────────────────────────────────────────
         Lee: *"the search needs to be laid out as where, when, who."* `SearchTriad` has been in
         the shell since v65.1 waiting for the rental filter to have dates behind "when"; v72 added
         them, so this is the wiring.

         ⚠️ All three open the SAME filter sheet rather than three new ones. A second place to set
         the same thing is a second place for the two to disagree.

         ⚠️ `openFilters` seeds the draft from the live filters first. The sheet edits a draft and
         commits on close, so opening it without seeding would silently throw away whatever the
         reader had already chosen — which is exactly what the existing filter button guards
         against, and the triad has to behave identically or the two controls contradict each
         other. */
      searchSlot={
        <SearchTriad
          where={{
            label: W(lang, "Where", "Dónde"),
            value: filters.neighbourhood?.trim() || filters.city || null,
            placeholder: W(lang, "Anywhere", "En cualquier lugar"),
          }}
          when={{
            label: W(lang, "When", "Cuándo"),
            value: owWhenLabel(filters, lang),
            placeholder: W(lang, "Any dates", "Cualquier fecha"),
          }}
          who={{
            label: W(lang, "Who", "Quién"),
            value: filters.minGuests
              ? W(lang, `${filters.minGuests} guest${filters.minGuests === 1 ? "" : "s"}`,
                       `${filters.minGuests} huésped${filters.minGuests === 1 ? "" : "es"}`)
              : null,
            placeholder: W(lang, "Add guests", "Añadir huéspedes"),
          }}
          onWhere={openFilters} onWhen={openFilters} onWho={openFilters} />
      }
      /* ── 70/30: SEARCH, THEN WHERE (Lee, 12 Aug 2026) ───────────────────────────────────
         *"Split the search bar — seventy percent for the search and thirty percent for the
         location dropdown."*

         The dropdown writes the NEIGHBOURHOOD filter, not a separate piece of state, so the
         barrio picked here and the barrio picked inside the filter sheet are the same thing and
         cannot disagree. The city pills above already narrow by city; this narrows within it,
         which is the question somebody standing on the feed actually has. */
      /* 60/40 now, not 70/30 — Lee, 13 Aug: *"it's still not enough room for a location there…
         I would make the search bar just a little shorter to allow a little bit more room."*
         Measured 253/97 at 70/30 on a 390px screen; 60/40 gives the location ~140px, which is
         the difference between "Anywhe⌄" and a barrio name that can actually be read. */
      searchAside={
        <label className="relative flex h-full items-center rounded-2xl border border-ink/10 bg-white/70 pl-2.5 pr-7 dark:border-white/15 dark:bg-white/10">
          <span className="sr-only">{W(lang, "Neighbourhood", "Barrio")}</span>
          <select
            value={filters.neighbourhood}
            onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, neighbourhood: v })); setDraftFilters(f => ({ ...f, neighbourhood: v })); }}
            className="ow-fade w-full appearance-none bg-transparent text-[13px] font-semibold outline-none">
            <option value="">{W(lang, "Anywhere", "Todo")}</option>
            {feedHoods.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <span className="pointer-events-none absolute right-2 opacity-40"><Chevron /></span>
        </label>
      }
      /* ── THE "ALL / MEDELLÍN" PILL ROW IS GONE, 13 Aug 2026 ───────────────────────────
         Lee: *"you could eliminate it where it says All Medellín. You don't even need that
         there — that's like an unnecessary filter."*

         He is right, and it was worse than redundant. The location dropdown beside the search
         box and the city field inside the filter sheet already narrow by place, so the row was
         a THIRD control answering the same question, able to disagree with the other two: a
         city pill and a barrio from a different city could both be active at once and the feed
         would correctly return nothing, with no way to see why. `pills` is simply not passed,
         so HomeTop renders no pill row at all. `city` state stays — the filter sheet still
         writes it — so nothing downstream changes. */
      feedSlot={
        listings === undefined ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map(i => (
              <div key={i} className="card ow-shimmer h-72 p-0" />
            ))}
          </div>
        ) : shown.length ? (
          /* pb-28 clears the raised centre button. Without it the last card's agent row sits
             under the tab bar, which reads as a rendering bug rather than a scroll position. */
          <div className="space-y-3 pb-28">
            <SegmentToggle current="rent" lang={lang} />
            {/* ── ONE ROW: LIST/MAP · FILTERS · SORT · VIEW (Lee, 13 Aug 2026) ─────────────
                It was three rows before this — filter+sort, then list/map+layout, then
                currency. See the arithmetic in ControlRow for why Filters and Sort lose their
                words while List/Map keeps them. */}
            <ControlRow
              filters={filters} sort={sort} view={view} layout={layout}
              layouts={LAYOUTS.map(o => ({ ...o, glyph: <LayoutGlyph id={o.id} /> }))}
              onOpenFilters={() => { setDraftFilters(filters); setSheetOpen(true); }}
              onSort={setSort} onView={setView} onLayout={id => setLayout(id as any)} />

            {/* ── THE READER'S CURRENCY — FAR LEFT, ITS OWN ROW ───────────────────────────
                Lee, 13 Aug: *"the last thing up here at the top would be your currency, USD
                versus COP. I was trying to see is there a way we can get that on some row, but
                it's probably gonna have to be on its own independent row honestly. But we just
                need to move it to the far left side instead of the far right side."*

                He is right that it cannot join the row above — that row is already at 334px of
                358px. And the move from right to left is not cosmetic: every price it governs is
                left-aligned in the cards below, so on the right it was a control floating away
                from the thing it controls. On the left it sits directly over the column of
                prices it rewrites. */}
            {/* ⚠️ REMOVED IN THE SAME BREATH AS THE SALE SIDE. The header's country control owns
                the reader's currency now, on every screen. Fixing one half of OneHome and not the
                other is the single most repeated defect in this product's history — filters, sort,
                the map, three card layouts, the engagement row, comments, the size stepper, the
                attribute line, the dashboard hub and the showing button, every one of them. */}

            {view === "map"
              ? <ListingMap pins={pins} onOpen={p => nav(p.href)} />
              : <>
                  <RatingRetry {...ratings} lang={lang} />
                  <div className={layout === "grid" ? "grid grid-cols-2 gap-2" : "space-y-3"}>
                    {shown.map(l => (
                      <ListingCard key={l.id} l={l} agent={agents?.[l.agent_id]} lang={lang} layout={layout}
                        ccy={viewCcy} fx={trm?.rate} propertyRatings={ratings.property} hostRatings={ratings.host} />
                    ))}
                  </div>
                  {/* Empty, 1px, and the only thing that triggers the next page. A "Load more"
                      button would be wrong HERE and is right on the profile wall: this is the
                      feed, which has nothing under it, so the scroll should not have to stop. */}
                  <div ref={sentinel} aria-hidden className="h-px w-full" />
                  {!atEnd && (
                    <div className="ow-shimmer h-36 rounded-2xl" aria-label={W(lang, "Loading more", "Cargando más")} />
                  )}
                </>}
          </div>
        ) : (
          <div className="space-y-3 pb-28">
            <SegmentToggle current="rent" lang={lang} />
            <div className="card p-8 text-center">
            <p className="text-sm font-bold">
              {W(lang, "No places here yet.", "Todavía no hay inmuebles aquí.")}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed opacity-55">
              {W(lang,
                "OneHome is starting in Colombia — Medellín, Bogotá, Cali and Cartagena. If you manage a place, yours can be the first one people see.",
                "OneHome está comenzando en Colombia — Medellín, Bogotá, Cali y Cartagena. Si usted administra un inmueble, el suyo puede ser el primero que la gente vea.")}
            </p>
            <Link to={productHref("onerental", "/list")} className="btn-brand mt-4 inline-block">
              {W(lang, "List a place", "Publicar un inmueble")}
            </Link>
            </div>
          </div>
        )
      }
    />
    </>
  );
}

/**
 * ONE LISTING CARD.
 *
 * Each card separates property reviews from host reviews. OneScore is not a browse-card rating.
 * The photo wall is a horizontal scroller rather
 * than a grid: on a phone, fifty photos in a grid is a wall of thumbnails nobody looks at, and
 * swiping through them is what people already do.
 */
/* v96 · R45b · THE PROPERTY KIND, THE LAST PIECE OF THE SALE CARD'S ATTRIBUTE ROW.
 * Lee named that row as the one place the SALE side is canonical and this card follows it:
 * kind · beds · baths · m² · estrato.
 *
 * The four values are not a guess — they are what the column actually holds:
 *     select distinct property_type from rental_properties  →  apartment, house, loft, studio
 *
 * ⚠️ NOT imported from onesale. `KIND_LABEL` lives in onesale/lib/sale.ts and describes SALE
 * kinds; these are RENT's values and the two sets are not the same. Products importing each
 * other is the drift this codebase keeps paying for. When a second screen needs this, it
 * moves to the shell — until then it sits beside its only consumer.
 *
 * The fallback is deliberate: an unrecognised value is capitalised rather than dropped, so a
 * listing type nobody anticipated still says what it is instead of silently vanishing. */
const RENT_KIND: Record<string, { en: string; es: string }> = {
  apartment: { en: "Apartment", es: "Apartamento" },
  house:     { en: "House",     es: "Casa" },
  loft:      { en: "Loft",      es: "Loft" },
  studio:    { en: "Studio",    es: "Estudio" },
};
const rentKind = (v: string | null | undefined, lang: string) => {
  if (!v) return null;
  const hit = RENT_KIND[v];
  if (hit) return lang === "es" || lang === "co" ? hit.es : hit.en;
  return v.charAt(0).toUpperCase() + v.slice(1);
};

export function ListingCard({ l, agent, lang, layout = "big", ccy = "USD", fx, propertyRatings, hostRatings }:
  { l: Property; agent?: RentalAgent; lang: string; layout?: "big" | "grid" | "row";
    /* The READER's currency and today's official rate — passed down rather than read from the
       hook here, so every card in one render is drawn at one rate. */
    ccy?: ViewerCcy; fx?: number | null; propertyRatings: RatingSet; hostRatings: RatingSet }) {
  const href = productHref("onerental", `/r/${l.id}`);
  const where = [l.neighbourhood, l.city].filter(Boolean).join(", ");
  /* v77 · U12 · The comment thread and its open/closed state are gone. Lee: comments on a
     property do not make sense; reviews take this space in a later version. */
  const [idx, setIdx] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  const facts = listingFacts(rentKind((l as any).property_type, lang), l as any, lang).join(" · ");

  /* ── WHAT THE CARD LEADS WITH (7 Sep 2026, media lane) ───────────────────────────────────
     `lead` is the host's chosen feed preview — a photo or one of their public videos — falling
     back to the cover, then the first photo, exactly what the first photo used to be. `slides` is
     the lead followed by the remaining photos in cover order, so the swipe strip still shows
     every photograph and the counter still counts them. See lib/media.ts. */
  const lead = feedLead(l);
  const slides = feedSlides(l);

  /* ── COMPACT LIST ROW — thumbnail left, facts right ────────────────────────────────────────
     Lee: *"a row of listings where the thumbnail's on the left and all the information's on the
     right, kind of like a list."* Text on a SURFACE here, not on the photograph: the whole point
     of this layout is scanning prices down a column, and a price over a photo is a price whose
     legibility depends on the photo. */
  if (layout === "row") {
    return (
      <Link to={href}
        className="ow-tap flex items-stretch gap-3 overflow-hidden rounded-2xl border border-ink/[0.08] p-2 dark:border-white/10">
        {lead
          ? <FeedMedia media={lead} className="h-[86px] w-[110px] shrink-0 rounded-xl object-cover" />
          : <div className="h-[86px] w-[110px] shrink-0 rounded-xl bg-ink/5 dark:bg-white/5" />}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="text-[15px] font-black leading-none tracking-tight">{priceLabel(l, lang, ccy, fx)}</p>
          {facts && <p className="mt-1 text-[12px] font-semibold opacity-70">{facts}</p>}
          <p className="mt-0.5 line-clamp-1 text-[12.5px] font-bold">{l.title}</p>
          {where && <p className="mt-0.5 truncate text-[11.5px] opacity-55">{where}</p>}
          <ListingRatings propertyId={l.id} hostId={l.agent_id} property={propertyRatings} host={hostRatings} lang={lang} />
        </div>
      </Link>
    );
  }

  /* ── TWO UP — the "flip them quicker" layout ───────────────────────────────────────────────
     Half the width, so the title comes off entirely. Lee made the same call about the profile
     tiles and it applies with more force here: *"you need to be strategic about what you're
     showing. You don't need to show the property title at that point, because there's not enough
     space on a little thumbnail like that. You just need to show the city, the rent, and the
     bedroom, bathroom."* Price, facts, city. Nothing else fits and nothing else is needed to
     decide whether to tap. */
  if (layout === "grid") {
    return (
      <Link to={href}
        className="ow-tap relative block overflow-hidden rounded-2xl border border-ink/[0.08] dark:border-white/10">
        {lead
          ? <FeedMedia media={lead} className="aspect-[4/5] w-full object-cover" />
          : <div className="aspect-[4/5] w-full bg-ink/5 dark:bg-white/5" />}
        {slides.length > 1 && (
          <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-ink/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white backdrop-blur-sm">
            {slides.length}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-2 pt-10 text-white"
          style={{ background: SCRIM }}>
          <p className="text-[14px] font-black leading-none tracking-tight">{priceLabel(l, lang, ccy, fx)}</p>
          {facts && <p className="mt-1 truncate text-[11px] font-semibold opacity-90">{facts}</p>}
          {where && <p className="truncate text-[11px] opacity-80">{where}</p>}
          <ListingRatings propertyId={l.id} hostId={l.agent_id} property={propertyRatings} host={hostRatings} lang={lang} />
        </div>
      </Link>
    );
  }

  return (
    /* ── ONE PHOTOGRAPH, NOTHING BESIDE IT ────────────────────────────────────────────────────
       Lee, 11 Aug 2026: *"on the main discovery feed page, you still have a white bar at the
       bottom that shows the conversion to pesos and charging USD and a like comment and share.
       All that's in a white section. That should not be — everything should be within the picture.
       It should all be white text overlaid on top of the picture, and the bottom should be a
       little bit darker so the white text shows. You shouldn't have a white strip at all."*

       So the card IS the photograph. Every fact, the peso line, the description and the engagement
       row now sit inside it against a scrim. Nothing renders below the image.

       ── AND IT SWIPES ──────────────────────────────────────────────────────────────────────
       *"From the main feed, I should be able to scroll sideways to see the listing pictures. I
       shouldn't have to click on the picture."*

       An earlier note in this file argued the opposite — that a horizontal strip inside a vertical
       feed steals the scroll. That was wrong in one specific way: it was reasoning about a strip of
       small thumbnails, which is a different gesture from swiping ONE full-bleed photo. Instagram
       does exactly this and nobody loses their place, because `scroll-snap` with full-width
       children means a horizontal drag either turns the page or does nothing — it never leaves you
       stranded between two photos. `touch-action: pan-x pan-y` keeps the vertical feed scroll
       working from anywhere on the card.

       The counter is derived from scroll position rather than tracked, so it cannot disagree with
       what is on screen. */
    <div>
    <article className="relative overflow-hidden rounded-2xl border border-ink/[0.08] bg-ink/5 dark:border-white/10 dark:bg-white/5">
      {slides.length > 0 ? (
        <div
          ref={strip}
          onScroll={e => {
            const el = e.currentTarget;
            const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (n !== idx) setIdx(n);
          }}
          className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]{display:none}"
          style={{ touchAction: "pan-x pan-y", scrollbarWidth: "none" }}>
          {slides.map((m, i) => (
            <Link key={m.url} to={href} className="block h-full w-full shrink-0 snap-center">
              {/* Only the first slide is eager — a feed of ten cards would otherwise fetch every
                  photo of every listing before the reader has scrolled past the first. A video
                  lead streams only while it is on screen (FeedMedia). */}
              <FeedMedia media={m} eager={i === 0} className="h-full w-full object-cover" />
            </Link>
          ))}
        </div>
      ) : (
        <Link to={href} className="block aspect-square w-full" />
      )}

      {/* TOP LEFT: who listed it. TOP RIGHT: how many photos.
          Lee: *"swap the picture count and the profile photo. The profile photo should be at the
          top left, and the picture count should be at the top right."* */}
      <HostAvatar to={productHref("onerental", `/p/${l.agent_id}`)} agent={agent} />

      <PhotoCount idx={idx} total={slides.length} />

      {/* ── THE SCRIM, WITH A FLOOR (Lee, 11 Aug 2026) ────────────────────────────────────────
          *"The information at the bottom needs to have a dark translucent tint to it so the white
          text shows up, because the white text doesn't show up on white backgrounds if you have a
          picture. If you uploaded a photo and the photo is white, you can't see the text."*

          There WAS a gradient here, and it was not enough: Tailwind's `via-black/70` puts the 70%
          stop at the MIDPOINT, so the top third of the text block — which is where the title
          sits — was over 0–35% black. On his sunset photograph the title was the hardest line on
          the card to read, and on a white kitchen it would have disappeared entirely.

          `SCRIM` is an explicit four-stop gradient that is already at 55% where the first line of
          text starts and never drops below it underneath. Shared with the two-up layout so the
          two cannot drift, because "readable" is not a per-layout opinion. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-2 pt-16 text-white"
        style={{ background: SCRIM }}>
        {/* ── THE TWO COLUMNS, BOTTOM-ALIGNED (Lee, 13 Aug 2026) ──────────────────────────
            *"We need to do a better job at lining up the text at the bottom. The text on the
            right is not quite lined up with the text on the left — one is higher than the
            other."*

            It was `items-end`, which aligns the two BOXES, and the boxes were different heights
            because the right column carried a peso line the left column had no equivalent for.
            Both columns are now one flex column each with `justify-end`, sharing one baseline
            at the bottom of the row — so they line up whatever either one contains.

            THE RIGHT COLUMN ALSO REORDERS. Lee: *"the city you have right above that Medellín —
            really you should put the city at the TOP of the price. So on the right side it would
            show the city first, then the price per month, and below that the equivalent COP
            value."* City → price → pesos, top to bottom, which also puts the largest type in the
            middle of the block where the eye lands.

            And "charged in USD" is gone: *"just remove that, and you keep the little approximately
            equal to whatever Colombian value… just put COP and that's all you need."* */}
        <Link to={href} className="pointer-events-auto block">
          <div className="flex items-stretch justify-between gap-3">
            <div className="flex min-w-0 flex-col justify-end">
              {/* A long title gets an ellipsis rather than overflowing — Lee: *"if someone has a
                  long title that can't fit on the left side… it should just say dot dot dot."* */}
              <p className="line-clamp-2 text-[14.5px] font-extrabold leading-tight">{l.title}</p>
              {facts && <p className="mt-0.5 text-[12.5px] font-semibold opacity-90">{facts}</p>}
            </div>
            <div className="flex shrink-0 flex-col justify-end text-right">
              {where && <p className="max-w-[38vw] truncate text-[11.5px] font-semibold opacity-90">{where}</p>}
              <p className="mt-0.5 text-[17px] font-black leading-none tracking-tight">{priceLabel(l, lang, ccy, fx)}</p>
              {l.display_currency === "COP" && l.display_fx_rate && (
                <p className="mt-1 text-[11px] leading-none opacity-75">
                  ≈ {cop(l.price, l.display_fx_rate)}
                </p>
              )}
            </div>
          </div>

          <ListingRatings propertyId={l.id} hostId={l.agent_id} property={propertyRatings} host={hostRatings} lang={lang} />
          {/* v78 · R36 · The description is gone from the card. A feed is a set of decisions
              about which card to open; the title, the facts, the place and the price are the
              decision, and the description is the detail the reader gets in full the moment they
              tap. It is still SEARCHED — see the filter above. */}
        </Link>

        {/* ── v90 · U36 · THE HEART, ALONE ────────────────────────────────────────────────
            Lee, after testing v87: *"I think we should have at least a like button somewhere on
            the main screen, and you could share it from the listing once you click on it… I would
            say the same place, on the right side, middle towards the bottom."*

            `allowShare={false}` and `hideComments` together leave the heart on its own — that
            is the component's own documented behaviour, not a hack.

            ⚠️ `onComments` is still passed even though no comment button is drawn. Inside
            ListingEngagement that prop is what makes the count query SKIP `media_comments`;
            drop it and every card in the feed runs a count for a button nobody sees. That note is
            Max's, from the rent card, and it applies identically here.

            Positioned on the right edge below the middle, clear of the scrim text on the left. */}
        <div className="pointer-events-auto absolute right-2 top-[58%] z-10">
          <ListingEngagement
            itemId={l.id} source="rental_property"
            shareUrl={`${appDoorway("onehome")}/r/${l.id}`}
            shareTitle={l.title}
            allowShare={false}
            hideComments
            onComments={() => {}}
            lang={lang} compact onDark />
        </div>
      </div>
    </article>


    </div>
  );
}
