import { useEffect, useMemo, useState } from "react";
import {
  supabase, useAsync, productHref, feedLead, coverOf, mediaRowOf,
  fetchTrm, type Trm, useViewerCcy, fillMissingPoints, type MapPin, W,
  CO_NEIGHBOURHOODS, coCityKey,
} from "@oneworld/shell";
import {
  type Property, type RentalAgent, FEED_CARD_COLUMNS, CO_CITIES,
  priceLabel, priceOnly, locationShort,
} from "../onerental/lib/rental";
import { type SaleProperty, SALE_COLUMNS } from "../onesale/lib/sale";
import {
  EMPTY, matches, sortListings, activeCount, type Filters, type Sort,
} from "../onerental/components/FilterSheet";
import { useListingRatings } from "../shared/ListingRatings";
import { D } from "../onerental/lib/detailCopy";
import type { LaneCard } from "./laneCard";
import { useTiers } from "./laneTiers";

/**
 * THE HOMES LANE.
 * ============================================================================================
 * The classic feed's query, its column list (`FEED_CARD_COLUMNS`, named once and read by both),
 * its filter model, its sort and its map. This module decides nothing about what a listing is.
 *
 * ── ONE LANE, BOTH HALVES (Lee, 20 September 2026) ──────────────────────────────────────────
 * *"Keep sale and rent in ONE Homes lane, and add For sale / For rent as a filter inside the
 * existing filter sheet — not a separate lane, not a slide toggle. Default shows both."*
 *
 * So this lane reads BOTH tables, merges them newest-first, and the sheet's `homeKind` field
 * decides what survives. A place for rent carries "Request a booking" and opens the rent screen;
 * a place for sale carries "Request a showing" and opens the sale screen. Everything else about
 * the card — the media, the host, the score, the location line — is identical, because to
 * somebody swiping they are the same kind of thing.
 *
 * ⚠️ The sale table has `photos` and nothing else: no videos, no chosen cover, no feed lead. The
 * shell's helpers already answer that shape correctly (first photo as the cover), so no branch is
 * needed here and none should be added when sale media arrives.
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

  /* The sale half, read with the sale feed's own column list and its own published rule. */
  const sales = useAsync(async () => {
    const { data } = await supabase
      .from("sale_properties").select(SALE_COLUMNS)
      .eq("is_public", true).in("status", ["published", "under_offer"])
      .order("created_at", { ascending: false }).limit(take);
    return (data ?? []) as unknown as SaleProperty[];
  }, [take, enabled], enabled);

  const ratings = useListingRatings(listings);

  const agents = useAsync(async () => {
    /* One batched read covering both halves — never one query per card, and never two queries
       for what is one set of people. */
    const ids = [...new Set([
      ...(listings ?? []).map(l => l.agent_id),
      ...(sales ?? []).map(l => l.agent_id),
    ])];
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
  }, [listings?.length, sales?.length], enabled && listings !== undefined && sales !== undefined);

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

  /* The sale half, narrowed by the same search word. The rent filter model does not describe a
     sale listing — it asks about nightly or monthly rent — so it is deliberately NOT run over
     these rows. What a sale listing answers to is the search word and the for-sale-or-for-rent
     choice, and nothing is pretended beyond that. */
  const salesShown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (sales ?? []).filter(s => {
      if (!needle) return true;
      const a = agents?.[s.agent_id];
      return [s.title, s.description, s.city, s.neighbourhood, a?.full_name]
        .some(v => (v ?? "").toLowerCase().includes(needle));
    });
  }, [sales, agents, query]);

  const kind = filters.homeKind ?? "both";

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

  /* ⚠️ THE SALE HALF EARNS PINS TOO. A map that drew only the rentals while the lane showed both
     would be a filter that silently does not apply — the exact defect the rent map already
     carries a paragraph about. */
  const salePins: MapPin[] = useMemo(() => salesShown
    .filter(p => p.display_lat != null && p.display_lng != null)
    .map(p => ({
      id: p.id, lat: p.display_lat as number, lng: p.display_lng as number,
      exact: p.geo_precision === "exact",
      priceLabel: priceOnly({ price: p.asking_price, currency: p.currency }, viewCcy, trm?.rate),
      title: p.title, photo: p.photos?.[0] ?? null,
      facts: locationShort(p, lang) || null,
      href: productHref("onesale", `/s/${p.id}`),
    })), [salesShown, viewCcy, trm?.rate, lang]);

  const allPins = useMemo(
    () => (kind === "sale" ? salePins : kind === "rent" ? pins : [...pins, ...salePins]),
    [kind, pins, salePins]);

  /* R16 note 5 — the donut's colour is the badge tier, which is an RPC and not a column. One
     batched pass over the agents already loaded; a missing answer draws slate, never a gap. */
  const tiers = useTiers(Object.keys(agents ?? {}), enabled);

  const who = (id: string) => {
    const a = agents?.[id];
    return a ? { name: a.full_name, photo: a.photo_url, score: a.score, tier: tiers[id] ?? null } : null;
  };


  const cards: LaneCard[] = useMemo(() => {
    const rent: { at: number; card: LaneCard }[] = kind === "sale" ? [] : shown.map(p => ({
      at: Date.parse(p.created_at ?? "") || 0,
      card: {
        id: p.id,
        media: feedLead(mediaRowOf(p)),
        poster: coverOf(p),
        who: who(p.agent_id),
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
      },
    }));

    const sale: { at: number; card: LaneCard }[] = kind === "rent" ? [] : salesShown.map(p => ({
      at: Date.parse(p.created_at ?? "") || 0,
      card: {
        id: p.id,
        /* `photos` only — the helpers answer that shape with the first photo as the cover, so
           this needs no branch and must not grow one when sale media arrives. */
        media: feedLead(mediaRowOf(p as any)),
        poster: coverOf(p as any),
        who: who(p.agent_id),
        title: p.title,
        /* A sale price has no period, so it is drawn without one — `priceOnly` exists for
           exactly that and carries the reader's own currency. */
        price: priceOnly({ price: p.asking_price, currency: p.currency }, viewCcy, trm?.rate),
        sub: locationShort(p, lang) || null,
        cta: W(lang, "Request a showing", "Solicitar una visita"),
        href: productHref("onesale", `/s/${p.id}`),
        engagement: {
          source: "sale_property" as const,
          savesAs: "sale_property" as const,
          allowShare: (p as any).allow_public_share !== false,
        },
      },
    }));

    /* Newest first across BOTH tables. Interleaving by date rather than showing all the rentals
       and then all the sales is the whole point of one lane: a place that went up an hour ago is
       the next thing you see, whichever half it came from. */
    return [...rent, ...sale].sort((a, b) => b.at - a.at).map(x => x.card);
  }, [kind, shown, salesShown, agents, lang, viewCcy, trm?.rate]);

  /* The same set, in the same order, as ROWS rather than cards — so the two list layouts and the
     map draw exactly what the swipe view draws. Two orderings of one lane is how a filter comes
     to "not apply" in one view and apply in another. */
  const merged = useMemo(() => {
    const rent = (kind === "sale" ? [] : shown).map(r =>
      ({ at: Date.parse(r.created_at ?? "") || 0, kind: "rent" as const, rent: r, sale: undefined as SaleProperty | undefined }));
    const sale = (kind === "rent" ? [] : salesShown).map(r =>
      ({ at: Date.parse(r.created_at ?? "") || 0, kind: "sale" as const, rent: undefined as Property | undefined, sale: r }));
    return [...rent, ...sale].sort((a, b) => b.at - a.at);
  }, [kind, shown, salesShown]);

  /* ── THE NEXT PAGE (fixed 20 September 2026) ──────────────────────────────────────────────
     ⚠️ THE FEED USED TO STOP AT TWELVE. The classic feed pages with a sentinel div after the
     last card; a full-screen swipe feed has no "after the last card" to put one in. So the feed
     asks for more when the reader is three slides from the end instead. `atEnd` is how we know
     there is nothing more: a short page means the table had nothing else to give, so the asking
     stops rather than hammering the database with identical queries forever. */
  const atEnd = (listings?.length ?? 0) < take && (sales?.length ?? 0) < take;

  /* Changes whenever the reader narrows the set — a new search word, a filter, a sort. The feed
     uses it to put them back at the top: filtering forty places down to three while the screen
     stays scrolled to where the ninth used to be is a feed that looks broken. */
  const resetKey = `${query}|${filters.homeKind}|${activeCount(filters)}|${filters.neighbourhood}|${sort}|${view}|${layout}`;

  return {
    ready: listings !== undefined && sales !== undefined,
    total: (listings?.length ?? 0) + (sales?.length ?? 0),
    atEnd, resetKey,
    more: () => setTake(t => t + PAGE),
    cards, shown, listings, agents, ratings,
    filters, setFilters, draftFilters, setDraftFilters, sheetOpen, setSheetOpen,
    openFilters: () => { setDraftFilters(filters); setSheetOpen(true); },
    filterCount: activeCount(filters),
    draftCount, histListings, feedHoods,
    sort, setSort, view, setView, layout, setLayout,
    pins: allPins, merged, trm, viewCcy, setTake,
  };
}
