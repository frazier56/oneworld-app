import { useMemo, useState } from "react";
import { supabase, useAsync, productHref, feedLead, coverOf, mediaRowOf, W } from "@oneworld/shell";
import {
  EventFilterSheet, EMPTY_EVENT_FILTERS, matchesEvent, sortEvents, priceFor, spotsRemaining,
  eventDisplayLocation, type EventDiscoverFilters, type EventSort, type DiscoverFilterEvent,
} from "@evt/components/events/EventDiscoverFilters";
import { currencySymbol } from "@evt/lib/currencies";
import type { LaneCard } from "./laneCard";
import { useTiers } from "./laneTiers";

/**
 * THE EVENTS LANE.
 * ============================================================================================
 * The same rows the Discover screen reads — published, still to come or evergreen, soonest
 * first — and the same filter sheet, the same `matchesEvent` and the same `sortEvents`. The
 * world feed does not own a single rule about what an event is or how events are ordered.
 *
 * Media arrived with OneEvent 30 on 20 September 2026: `photos`, `videos`, `cover_photo` and
 * `feed_preview` on the `events` table, read through the shell's `feedLead`. A flyer is usually
 * a tall 4:5 image and a video usually leads; both fill the screen the same way.
 */
type EvRow = DiscoverFilterEvent & {
  host_id: string | null;
  photos?: string[] | null;
  videos?: string[] | null;
  cover_photo?: string | null;
  feed_preview?: { kind: "photo" | "video"; url: string } | null;
  status?: string | null;
};

/** "Free" · "25 dollars" — the highest real ticket price, the way the Discover card says it. */
function ticketLine(e: EvRow, lang: string) {
  const p = priceFor(e);
  if (!p) return W(lang, "Free", "Gratis");
  return `${currencySymbol(e.currency ?? "USD")}${p.toLocaleString(lang === "en" ? "en-US" : "es-CO")}`;
}

/** When it is, and how many places are left — one sentence, never a raw date. */
function whenAndSpots(e: EvRow, lang: string) {
  const bits: string[] = [];
  if (e.start_date) {
    const d = new Date(e.start_date);
    if (!Number.isNaN(d.getTime())) {
      bits.push(d.toLocaleString(lang === "en" ? "en-US" : "es-CO",
        { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }));
    }
  }
  const where = eventDisplayLocation(e);
  if (where) bits.push(where);
  const left = spotsRemaining(e);
  if (Number.isFinite(left)) {
    bits.push(left> 0
      ? W(lang, `${left} left`, `quedan ${left}`)
      : W(lang, "Sold out", "Agotado"));
  }
  return bits.join(" · ") || null;
}

/**
 * `enabled` is how a lane stays asleep until somebody swipes to it. Four lanes firing eight
 * queries the moment the feed opens would make the FIRST screen slower to pay for three the
 * reader may never reach. ⚠️ It is in the dep array as well as the flag, because `useAsync`
 * does not re-run on `enabled` alone.
 */
export function useEventsLane(lang: string, query: string, enabled: boolean) {
  const [filters, setFilters] = useState<EventDiscoverFilters>(EMPTY_EVENT_FILTERS);
  const [draft, setDraft] = useState<EventDiscoverFilters>(EMPTY_EVENT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<EventSort>("soonest");

  const rows = useAsync(async () => {
    const { data } = await supabase.from("events").select("*")
      .eq("status", "published").order("start_date", { ascending: true });
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    /* The same "is it over" rule the Discover screen uses — an evergreen event never expires and
       an event with no date is not silently dropped. */
    return ((data ?? []) as EvRow[]).filter(e =>
      e.is_evergreen || !e.start_date || new Date(e.end_date || e.start_date)>= todayStart);
  }, [enabled], enabled);

  const hosts = useAsync(async () => {
    const ids = [...new Set((rows ?? []).map(e => e.host_id).filter(Boolean))] as string[];
    if (!ids.length) return {} as Record<string, { full_name: string; photo_url: string | null; score: number | null }>;
    const { data } = await supabase.from("profiles")
      .select("id, full_name, photo_url, score_v9_snapshot").in("id", ids);
    return Object.fromEntries(((data ?? []) as any[]).map(h => [h.id, {
      full_name: h.full_name, photo_url: h.photo_url,
      score: typeof h.score_v9_snapshot === "number" ? h.score_v9_snapshot : null,
    }]));
  }, [rows?.length], enabled && rows !== undefined);

  /* R16 note 5 — badge tiers for the hosts on screen; the donut colours itself from them. */
  const tiers = useTiers(Object.keys(hosts ?? {}), enabled);

  const shown = useMemo(() => {
    const kept = (rows ?? []).filter(e => matchesEvent(e, filters, query));
    return sortEvents(kept, sort);
  }, [rows, filters, query, sort]);

  const cards: LaneCard[] = useMemo(() => shown.map(e => {
    const host = e.host_id ? hosts?.[e.host_id] : undefined;
    return {
      id: e.id,
      media: feedLead(mediaRowOf(e as any)) ?? (e.cover_image_url ? { kind: "photo" as const, url: e.cover_image_url } : null),
      poster: coverOf(e as any) ?? e.cover_image_url,
      who: host ? { name: host.full_name, photo: host.photo_url, score: host.score, tier: tiers[e.host_id!] ?? null } : null,
      title: e.title,
      price: ticketLine(e, lang),
      sub: whenAndSpots(e, lang),
      cta: W(lang, "Get ticket", "Obtener entrada"),
      href: productHref("oneevent", `/e/${e.id}`),
      /* No heart here yet: OneEvent writes its own Save from the event page and there is no
         `media_likes` source for an event. A heart that wrote nowhere would be a lie. */
      engagement: null,
    };
  }), [shown, hosts, lang]);

  const categories = useMemo(
    () => [...new Set((rows ?? []).map(e => (e.category ?? "").trim()).filter(Boolean))].sort(),
    [rows]);

  return {
    ready: rows !== undefined,
    total: rows?.length ?? 0,
    /* This lane reads every published event in one go — the same single read the Discover screen
       does — so there is no next page to ask for. If the table ever grows past what one request
       should carry, BOTH screens page together, not just this one. */
    atEnd: true,
    more: () => {},
    resetKey: `${query}|${JSON.stringify(filters)}|${sort}`,
    cards,
    /* The real sheet, portalled — the same one the Discover screen opens. */
    sheet: (
      <EventFilterSheet open={sheetOpen} value={draft} resultCount={cards.length}
        categories={categories} onChange={setDraft}
        onClose={() => { setFilters(draft); setSheetOpen(false); }} />
    ),
    openFilters: () => { setDraft(filters); setSheetOpen(true); },
    filterCount: (
      (filters.where ? 1 : 0) + (filters.startsOn || filters.endsOn ? 1 : 0) +
      filters.categories.length + filters.eventTypes.length +
      (filters.price !== "any" ? 1 : 0) + (filters.approval !== "any" ? 1 : 0) +
      (filters.minSpots ? 1 : 0) + (filters.availableOnly ? 1 : 0)
    ),
    sort, setSort,
  };
}

export const EVENT_SORTS: { id: EventSort; en: string; es: string }[] = [
  { id: "soonest",    en: "Soonest",      es: "Más próximo" },
  { id: "newest",     en: "Newest",       es: "Más reciente" },
  { id: "price_low",  en: "Cheapest",     es: "Más barato" },
  { id: "price_high", en: "Most costly",  es: "Más caro" },
  { id: "spots",      en: "Most spots",   es: "Más cupos" },
];
