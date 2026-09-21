import { useEffect, useMemo, useState } from "react";
import {
  supabase, useAsync, productHref, feedLead, coverOf, mediaRowOf,
  fetchTrm, type Trm, useViewerCcy, fillMissingPoints, type MapPin,
  CO_NEIGHBOURHOODS, coCityKey,
} from "@oneworld/shell";
import {
  type Property, type RentalAgent, FEED_CARD_COLUMNS, CO_CITIES,
  priceLabel, priceOnly, locationShort,
} from "../onerental/lib/rental";
import {
  EMPTY, matches, sortListings, activeCount, type Filters, type Sort,
} from "../onerental/components/FilterSheet";
import { useListingRatings } from "../shared/ListingRatings";
import { D } from "../onerental/lib/detailCopy";
import type { LaneCard } from "./laneCard";

/**
 * THE HOMES LANE.
 * ============================================================================================
 * The classic feed's query, its column list (`FEED_CARD_COLUMNS`, named once and read by both),
 * its filter model, its sort and its map. This module decides nothing about what a listing is.
 *
 * ⚠️ RENT ONLY, TODAY. `sale_properties` is a second table with its own detail screen, its own
 * controls and a different button ("Request a showing"). It joins this lane with the rent-or-sale
 * toggle OneHome already has, in a later batch — half of it now would be a segment control that
 * only works one way round.
 */
const PAGE = 12;

export function useHomesLane(lang: string, query: string, enabled: boolean) {
  const [take, setTake] = useState(PAGE);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"list" | "map">("list");
  const [layout, setLayout] = useState<"big" | "grid" | "row">("big");

  const listings = useAsync(async () => {
    const { data } = await supabase
      .from("rental_properties")
      .select(FEED_CARD_COLUMNS)
      .eq("is_public", true)
      .eq("status", "published")
      /* The host's feed switch. Off keeps the listing public — the link, the profile card and
         search still open it — and only the feed skips it. */
      .eq("feed_visible", true)
      .order("created_at", { ascending: false })
      .limit(take);
    return (data ?? []) as unknown as Property[];
  }, [take, enabled], enabled);

  const ratings = useListingRatings(listings);

  const agents = useAsync(async () => {
    const ids = [...new Set((listings ?? []).map(l => l.agent_id))];
    if (!ids.length) return {} as Record<string, RentalAgent>;
    /* One batched, column-named read. Never `select("*")` on profiles — that is a 42501. */
    const { data } = await supabase
      .from("profiles").select("id, full_name, photo_url, score_v9_snapshot").in("id", ids);
    return Object.fromEntries((data ?? []).map((a: any) => [a.id, {
      agent_id: a.id, full_name: a.full_name, photo_url: a.photo_url,
      /* The PUBLISHED score — the same column the property screen shows. Drawn only when there
         is one; nothing here recomputes or interprets it. */
      score: typeof a.score_v9_snapshot === "number" ? a.score_v9_snapshot : null,
      total_listings: 0, active_listings: 0,
    } as RentalAgent]));
  }, [listings?.length], enabled && listings !== undefined);

  const [trm, setTrm] = useState<Trm | null>(null);
  useEffect(() => { if (enabled) void fetchTrm().then(setTrm); }, [enabled]);
  const [viewCcy] = useViewerCcy();

  const narrowed = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (listings ?? []).filter(l => {
      if (!needle) return true;
      const a = agents?.[l.agent_id];
      return [l.title, l.description, l.city, l.neighbourhood, a?.full_name]
        .some(v => (v ?? "").toLowerCase().includes(needle));
    });
  }, [listings, agents, query]);

  const shown = useMemo(
    () => sortListings(narrowed.filter(l => matches(l, filters, trm?.rate)), sort, trm?.rate),
    [narrowed, filters, sort, trm?.rate]);

  /* The number the sheet's footer promises, and the prices the histogram draws. Computed from
     the DRAFT so the footer moves as you tap, against the same text narrowing already in force —
     otherwise it says "Show 40 places" and applying it shows 6. The histogram deliberately runs
     with the PRICE filter off, so the excluded bars dim instead of vanishing. */
  const { draftCount, histListings } = useMemo(() => {
    const noPrice = { ...draftFilters, minPrice: null, maxPrice: null };
    return {
      draftCount: narrowed.filter(l => matches(l, draftFilters, trm?.rate)).length,
      histListings: narrowed.filter(l => matches(l, noPrice, trm?.rate)),
    };
  }, [narrowed, draftFilters, trm?.rate]);

  const feedHoods = useMemo(() => {
    const present = [...new Set((listings ?? [])
      .map(l => (l.neighbourhood ?? "").trim()).filter(Boolean))].sort();
    const curated = CO_NEIGHBOURHOODS[coCityKey(
      CO_CITIES.find(c => c.key === filters.city)?.label ?? "")] ?? [];
    const seen = new Set(present.map(h => h.toLowerCase()));
    return [...present, ...curated.filter(h => !seen.has(h.toLowerCase()))];
  }, [listings, filters.city]);

  /* Pins come off `shown`, never off everything fetched: a filtered map that still shows the
     whole set is a filter that silently does not apply. Legacy listings with no stored point are
     resolved on read, once, so they earn a pin rather than disappearing. */
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
      title: l.title, photo: coverOf(l), facts: locationShort(l, lang) || null,
      href: productHref("onerental", `/r/${l.id}`),
    })), [shown, latePoints, viewCcy, trm?.rate, lang]);

  const cards: LaneCard[] = useMemo(() => shown.map(p => ({
    id: p.id,
    media: feedLead(mediaRowOf(p)),
    poster: coverOf(p),
    who: (() => {
      const a = agents?.[p.agent_id];
      return a ? { name: a.full_name, photo: a.photo_url, score: a.score } : null;
    })(),
    title: p.title,
    price: priceLabel(p, lang, viewCcy, trm?.rate),
    sub: locationShort(p, lang) || null,
    cta: D(lang, "requestBooking"),
    href: productHref("onerental", `/r/${p.id}`),
    engagement: {
      source: "rental_property" as const,
      savesAs: "rental_property" as const,
      allowShare: p.allow_public_share !== false,
    },
  })), [shown, agents, lang, viewCcy, trm?.rate]);

  /* ── THE NEXT PAGE (fixed 20 September 2026) ──────────────────────────────────────────────
     ⚠️ THE FEED USED TO STOP AT TWELVE. The classic feed pages with a sentinel div after the
     last card; a full-screen swipe feed has no "after the last card" to put one in. So the feed
     asks for more when the reader is three slides from the end instead. `atEnd` is how we know
     there is nothing more: a short page means the table had nothing else to give, so the asking
     stops rather than hammering the database with identical queries forever. */
  const atEnd = (listings?.length ?? 0) < take;

  /* Changes whenever the reader narrows the set — a new search word, a filter, a sort. The feed
     uses it to put them back at the top: filtering forty places down to three while the screen
     stays scrolled to where the ninth used to be is a feed that looks broken. */
  const resetKey = `${query}|${activeCount(filters)}|${filters.neighbourhood}|${sort}|${view}|${layout}`;

  return {
    ready: listings !== undefined,
    total: listings?.length ?? 0,
    atEnd, resetKey,
    more: () => setTake(t => t + PAGE),
    cards, shown, listings, agents, ratings,
    filters, setFilters, draftFilters, setDraftFilters, sheetOpen, setSheetOpen,
    openFilters: () => { setDraftFilters(filters); setSheetOpen(true); },
    filterCount: activeCount(filters),
    draftCount, histListings, feedHoods,
    sort, setSort, view, setView, layout, setLayout,
    pins, trm, viewCcy, setTake,
  };
}
