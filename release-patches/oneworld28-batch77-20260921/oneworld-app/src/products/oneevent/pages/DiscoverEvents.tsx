import { ScreenHeading, coverOf, feedLead, feedSlides, W } from "@oneworld/shell";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ArrowRight } from "lucide-react";
import { supabase } from "@evt/lib/supabase";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { currencySymbol } from "@evt/lib/currencies";
import EventBlockCard from "@evt/components/events/EventBlockCard";
import InfoTip from "@evt/components/InfoTip";
import {
  EMPTY_EVENT_FILTERS,
  EventControlRow,
  EventFilterSheet,
  EventMap,
  eventDisplayLocation,
  matchesEvent,
  priceFor,
  sortEvents,
  type DiscoverFilterEvent,
  type EventDiscoverFilters,
  type EventDiscoverLayout,
  type EventDiscoverView,
  type EventSort,
} from "@evt/components/events/EventDiscoverFilters";

interface EvRow extends DiscoverFilterEvent {
  host_id: string;
  /* MEDIA (OneEvent 30) — the OneHome shape on `events`; see lib/listingMedia.ts in the shell. */
  photos?: string[] | null;
  videos?: string[] | null;
  cover_photo?: string | null;
  feed_preview?: { kind: "photo" | "video"; url: string } | null;
}
type Host = { id: string; full_name: string; photo_url: string | null };

export default function DiscoverEvents({
  embedded = false,
  filters: filtersProp,
  draftFilters: draftProp,
  sheetOpen: sheetOpenProp,
  sort: sortProp,
  view: viewProp,
  layout: layoutProp,
  onOpenFilters,
  onDraftFilters,
  onCloseFilters,
  onResetFilters,
  onSort,
  onView,
  onLayout,
  query = "",
}: {
  embedded?: boolean;
  query?: string;
  filters?: EventDiscoverFilters;
  draftFilters?: EventDiscoverFilters;
  sheetOpen?: boolean;
  sort?: EventSort;
  view?: EventDiscoverView;
  layout?: EventDiscoverLayout;
  onOpenFilters?: () => void;
  onDraftFilters?: (filters: EventDiscoverFilters) => void;
  onCloseFilters?: () => void;
  onResetFilters?: () => void;
  onSort?: (sort: EventSort) => void;
  onView?: (view: EventDiscoverView) => void;
  onLayout?: (layout: EventDiscoverLayout) => void;
} = {}) {
  const nav = useNavigate();
  const { t, lang, locale } = useLanguage();
  const [events, setEvents] = useState<EvRow[]>([]);
  const [hosts, setHosts] = useState<Record<string, Host>>({});
  const [loading, setLoading] = useState(true);

  const [localFilters, setLocalFilters] = useState<EventDiscoverFilters>(EMPTY_EVENT_FILTERS);
  const [localDraft, setLocalDraft] = useState<EventDiscoverFilters>(EMPTY_EVENT_FILTERS);
  const [localSheetOpen, setLocalSheetOpen] = useState(false);
  const [localSort, setLocalSort] = useState<EventSort>("soonest");
  const [localView, setLocalView] = useState<EventDiscoverView>("list");
  const [localLayout, setLocalLayout] = useState<EventDiscoverLayout>("cards");

  const filters = filtersProp ?? localFilters;
  const draftFilters = draftProp ?? localDraft;
  const sheetOpen = sheetOpenProp ?? localSheetOpen;
  const sort = sortProp ?? localSort;
  const view = viewProp ?? localView;
  const layout = layoutProp ?? localLayout;

  const openFilters = onOpenFilters ?? (() => { setLocalDraft(filters); setLocalSheetOpen(true); });
  const changeDraft = onDraftFilters ?? setLocalDraft;
  const closeFilters = onCloseFilters ?? (() => { setLocalFilters(localDraft); setLocalSheetOpen(false); });
  const changeSort = onSort ?? setLocalSort;
  const changeView = onView ?? setLocalView;
  const changeLayout = onLayout ?? setLocalLayout;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("events").select("*").eq("status", "published").order("start_date", { ascending: true });
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const evts = ((data || []) as EvRow[]).filter(e =>
        e.is_evergreen || !e.start_date || new Date(e.end_date || e.start_date)>= todayStart
      );
      setEvents(evts);
      const ids = [...new Set(evts.map(e => e.host_id).filter(Boolean))];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, photo_url").in("id", ids);
        if (profs) setHosts(Object.fromEntries(profs.map(p => [p.id, p as Host])));
      }
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => [...new Set(events.map(e => (e.category || "").trim()).filter(Boolean))].sort(), [events]);
  const normalizedQuery = useMemo(() => normalizeSearch(query), [query]);
  const matchesSearch = (e: EvRow) => {
    if (!normalizedQuery) return true;
    const hostName = hosts[e.host_id]?.full_name ?? "";
    const haystack = [
      e.title,
      e.description,
      e.category,
      e.event_type,
      e.venue_name,
      e.location,
      hostName,
    ].map(normalizeSearch).join(" ");
    return haystack.includes(normalizedQuery);
  };

  const filtered = useMemo(() => sortEvents(
    events.filter(e => matchesEvent(e, filters) && matchesSearch(e)),
    sort,
  ), [events, filters, hosts, normalizedQuery, sort]);

  const draftCount = useMemo(() => events.filter(e => matchesEvent(e, draftFilters) && matchesSearch(e)).length, [events, draftFilters, hosts, normalizedQuery]);

  const fmtDate = (e: DiscoverFilterEvent) => e.is_evergreen
    ? t("de.anytime", "Available anytime")
    : e.start_date
      ? new Date(e.start_date).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })
      : t("ev.date_tbd", "Date TBD");
  const venueOf = (e: DiscoverFilterEvent) => eventDisplayLocation(e) || t("ev.online", "Online");
  const priceChip = (e: DiscoverFilterEvent) => {
    const p = priceFor(e);
    if (p === 0) return <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">{t("de.free", "Free")}</span>;
    return <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">{currencySymbol(e.currency)}{p}</span>;
  };

  const controls = (
    <>
      <EventFilterSheet
        open={sheetOpen}
        value={draftFilters}
        resultCount={draftCount}
        categories={categories}
        onChange={changeDraft}
        onClose={closeFilters}
      />
      <EventControlRow
        filters={filters}
        sort={sort}
        view={view}
        layout={layout}
        onOpenFilters={openFilters}
        onSort={changeSort}
        onView={changeView}
        onLayout={changeLayout}
      />
    </>
  );

  /* MEDIA (OneEvent 30): the card leads with the host's chosen feed lead — a photo, or a video
     that plays muted while on screen — then the rest of the photos, swipeable. An event saved
     before the media columns existed has only `cover_image_url`, so that is its one slide. */
  const mediaOf = (e: EvRow) => ({
    photos: (e.photos && e.photos.length) ? e.photos : (e.cover_image_url ? [e.cover_image_url] : []),
    videos: e.videos ?? [],
    cover_photo: e.cover_photo ?? null,
    feed_preview: e.feed_preview ?? null,
  });
  const eventCard = (e: EvRow) => (
    <EventBlockCard
      key={e.id}
      slides={feedSlides(mediaOf(e))}
      href={`/events/e/${e.id}`}
      lang={lang}
      cta={W(lang, "View event", "Ver evento")}
      coverUrl={coverOf(mediaOf(e)) ?? e.cover_image_url}
      title={e.title}
      dateLabel={fmtDate(e)}
      venueLabel={venueOf(e)}
      price={priceChip(e)}
    />
  );

  const rowCard = (e: EvRow) => (
    <button key={e.id} onClick={() => nav(`/events/e/${e.id}`)} className="card flex w-full items-center gap-3 !rounded-2xl px-3 py-2.5 text-left">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-brand/10">
        {(() => { const c = coverOf(mediaOf(e)) ?? e.cover_image_url; const lead = feedLead(mediaOf(e));
          return c
            ? <img decoding="async" src={c} alt="" className="h-full w-full object-cover" />
            : lead?.kind === "video"
              ? <video src={lead.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              : <div className="grid h-full w-full place-items-center"><Calendar size={16} className="text-brand/50" /></div>; })()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{e.title}</p>
        <p className="truncate text-xs opacity-60">{fmtDate(e)} - {venueOf(e)}</p>
      </div>
      {priceChip(e)}
      <ArrowRight size={16} className="text-brand" />
    </button>
  );

  return (
    <div className="space-y-4">
      {!embedded && (
        <ScreenHeading right={
          <InfoTip text="Find events, parties and meetups near you. Filter by place, date, price, event type and availability, then tap a card for full details and tickets." />
        }>{t("de.title", "Events")}</ScreenHeading>
      )}

      {controls}

      {loading ? (
        <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="card grid place-items-center gap-2 !rounded-3xl py-14 text-center">
          <Calendar size={40} className="opacity-40" />
          <p className="font-bold">{t("de.no_events", "No events found")}</p>
          <p className="text-sm opacity-60">
            {normalizedQuery
              ? t("de.no_events_search_desc", "Try another search or adjust your filters.")
              : t("de.no_events_desc", "Try adjusting your filters or check back soon.")}
          </p>
          <button type="button" onClick={() => {
            changeDraft(EMPTY_EVENT_FILTERS);
            if (onResetFilters) onResetFilters();
            else setLocalFilters(EMPTY_EVENT_FILTERS);
          }} className="btn-ghost mt-2">
            {t("de.clear_filters", "Clear filters")}
          </button>
        </div>
      ) : view === "map" ? (
        <EventMap events={filtered} formatDate={fmtDate} onOpen={(e) => nav(`/events/e/${e.id}`)} />
      ) : layout === "grid" ? (
        <div className="grid grid-cols-2 gap-2 pb-28">{filtered.map(eventCard)}</div>
      ) : layout === "rows" ? (
        <div className="space-y-1.5 pb-28">{filtered.map(rowCard)}</div>
      ) : (
        <div className="space-y-4 pb-28">{filtered.map(eventCard)}</div>
      )}
    </div>
  );
}

function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
