/**
 * HOME - /events (index). The shell still owns the page title; OneEvent owns the discover
 * controls because event search and filters have product-specific meanings.
 */
import { useState } from "react";
import { HomeTop } from "@oneworld/shell";
import { Search, X } from "lucide-react";
import DiscoverEvents from "@evt/pages/DiscoverEvents";
import { useLanguage } from "@evt/i18n/LanguageContext";
import {
  EMPTY_EVENT_FILTERS,
  type EventDiscoverFilters,
  type EventDiscoverLayout,
  type EventDiscoverView,
  type EventSort,
} from "@evt/components/events/EventDiscoverFilters";

export default function Home() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<EventDiscoverFilters>(EMPTY_EVENT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<EventDiscoverFilters>(EMPTY_EVENT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<EventSort>("soonest");
  const [view, setView] = useState<EventDiscoverView>("list");
  const [layout, setLayout] = useState<EventDiscoverLayout>("cards");
  const openFilters = () => { setDraftFilters(filters); setSheetOpen(true); };
  const resetFilters = () => {
    setFilters(EMPTY_EVENT_FILTERS);
    setDraftFilters(EMPTY_EVENT_FILTERS);
    setSheetOpen(false);
  };

  return (
    <HomeTop
      product="oneevent"
      noComposer
      searchSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("de.search_placeholder", "Search events, hosts, cities...")}
            aria-label={t("de.search_placeholder", "Search events, hosts, cities...")}
            className="h-14 w-full rounded-[20px] border border-ink/10 bg-white/90 pl-11 pr-11 text-[15px] font-semibold text-foreground shadow-sm outline-none placeholder:font-medium placeholder:text-muted-foreground focus:border-brand/60 focus:ring-2 focus:ring-brand/15 dark:border-white/10 dark:bg-white/[0.08]"
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("de.clear_search", "Clear search")}
              className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-ink/5 hover:text-foreground dark:hover:bg-white/10"
            >
              <X size={16} />
            </button>
          )}
        </div>
      }
      feedSlot={
        <DiscoverEvents
          embedded
          query={query}
          filters={filters}
          draftFilters={draftFilters}
          sheetOpen={sheetOpen}
          sort={sort}
          view={view}
          layout={layout}
          onOpenFilters={openFilters}
          onDraftFilters={setDraftFilters}
          onCloseFilters={() => { setFilters(draftFilters); setSheetOpen(false); }}
          onResetFilters={resetFilters}
          onSort={setSort}
          onView={setView}
          onLayout={setLayout}
        />
      }
    />
  );
}
