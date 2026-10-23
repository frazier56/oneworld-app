import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "@oneworld/shell";
import { approximate, loadGoogleMaps, SearchTriad, ListingMap, type MapPin } from "@oneworld/shell";
import { Check, ChevronDown, X } from "lucide-react";
import { FeedControlRow, radioGroupKeys } from "@oneworld/shell";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { currencySymbol } from "@evt/lib/currencies";
import { cn } from "@evt/lib/utils";

export type EventDiscoverView = "list" | "map";
export type EventDiscoverLayout = "cards" | "grid" | "rows";
export type EventSort = "soonest" | "newest" | "price_low" | "price_high" | "spots";
export type EventPriceFilter = "any" | "free" | "paid";
export type EventApprovalFilter = "any" | "instant" | "application";

export type EventDiscoverFilters = {
  where: string;
  startsOn: string | null;
  endsOn: string | null;
  categories: string[];
  eventTypes: string[];
  price: EventPriceFilter;
  approval: EventApprovalFilter;
  minSpots: number | null;
  availableOnly: boolean;
};

export type DiscoverFilterEvent = {
  id: string;
  title: string;
  description?: string | null;
  location: string | null;
  venue_name: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at?: string | null;
  cover_image_url: string | null;
  ticket_price: number | null;
  ga_ticket_price?: number | null;
  vip_ticket_price?: number | null;
  ticket_type: string | null;
  currency?: string | null;
  is_evergreen?: boolean | null;
  category?: string | null;
  event_type?: string | null;
  max_attendees?: number | null;
  ga_ticket_qty?: number | null;
  vip_ticket_qty?: number | null;
  ga_sold?: number | null;
  vip_sold?: number | null;
  requires_application?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  address_visible?: boolean | null;
};

export const EMPTY_EVENT_FILTERS: EventDiscoverFilters = {
  where: "",
  startsOn: null,
  endsOn: null,
  categories: [],
  eventTypes: [],
  price: "any",
  approval: "any",
  minSpots: null,
  availableOnly: false,
};

const SORTS: { value: EventSort; label: string }[] = [
  { value: "soonest", label: "Soonest first" },
  { value: "newest", label: "Newest first" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
  { value: "spots", label: "Most spots left" },
];

const EVENT_TYPES = ["conference", "party", "workshop", "meetup", "festival", "networking", "other"];

const loose = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const POSTALISH = /\b\d{4,}(?:-\d+)?\b/g;
const US_STATE_ZIP = /^([A-Z]{2})(?:\s+\d{4,}(?:-\d+)?)?$/;

function cleanAddressPart(part: string) {
  return part.replace(POSTALISH, "").replace(/\s+/g, " ").trim();
}

function uniqueTail(parts: string[]) {
  const out: string[] = [];
  for (const part of parts) {
    const key = loose(part);
    if (key && !out.some((existing) => loose(existing) === key)) out.push(part);
  }
  return out;
}

export function eventDisplayLocation(event: Pick<DiscoverFilterEvent, "location" | "venue_name">) {
  const raw = (event.location || "").trim();
  const venue = (event.venue_name || "").trim();
  if (!raw) return venue || "Online";

  const parts = raw.split(",").map(cleanAddressPart).filter(Boolean);
  if (parts.length>= 4) {
    const country = parts[parts.length - 1];
    const regionRaw = parts[parts.length - 2];
    const city = parts[parts.length - 3];
    const stateMatch = regionRaw.match(US_STATE_ZIP);
    const region = stateMatch ? stateMatch[1] : regionRaw;
    return uniqueTail([city, region, country]).join(", ");
  }
  if (parts.length === 3) return uniqueTail(parts).join(", ");
  if (parts.length === 2) return `${parts[0]}, ${parts[1]}`;

  return venue && loose(venue) !== loose(raw) ? `${venue}, ${raw}` : raw;
}

type EventLatePoint = { lat: number; lng: number; precision: "exact" | "approximate" };

const eventPointCache = new Map<string, EventLatePoint | null>();
const eventPointInflight = new Map<string, Promise<EventLatePoint | null>>();

function eventMapQueries(event: DiscoverFilterEvent) {
  const raw = (event.location || "").trim();
  const venue = (event.venue_name || "").trim();
  const label = eventDisplayLocation(event);
  return uniqueTail([
    venue && raw && !loose(raw).includes(loose(venue)) ? `${venue}, ${raw}` : "",
    raw,
    venue,
    label,
  ].filter(Boolean));
}

async function geocodeEvent(event: DiscoverFilterEvent): Promise<EventLatePoint | null> {
  const cacheKey = `${event.id}:${event.location || ""}:${event.venue_name || ""}`;
  if (eventPointCache.has(cacheKey)) return eventPointCache.get(cacheKey) ?? null;
  const running = eventPointInflight.get(cacheKey);
  if (running) return running;

  const job = (async () => {
    try {
      const g = await loadGoogleMaps();
      const geocoder = new g.maps.Geocoder();
      for (const address of eventMapQueries(event)) {
        const res: any = await new Promise((resolve) => {
          geocoder.geocode({ address }, (rows: any[], status: string) => {
            resolve(status === "OK" && rows?.length ? rows[0] : null);
          });
        });
        const loc = res?.geometry?.location;
        if (loc) {
          const exact = event.address_visible !== false && !!event.location?.trim();
          const point = { lat: loc.lat(), lng: loc.lng() };
          const visible = exact ? point : approximate(point, event.id);
          const out: EventLatePoint = { ...visible, precision: exact ? "exact" : "approximate" };
          eventPointCache.set(cacheKey, out);
          eventPointInflight.delete(cacheKey);
          return out;
        }
      }
    } catch {
      // The list still works if Maps or geocoding does not.
    }
    eventPointCache.set(cacheKey, null);
    eventPointInflight.delete(cacheKey);
    return null;
  })();

  eventPointInflight.set(cacheKey, job);
  return job;
}

export function soldTicketsFor(event: Pick<DiscoverFilterEvent, "ga_sold" | "vip_sold">) {
  return Number(event.ga_sold || 0) + Number(event.vip_sold || 0);
}

export function capacityFor(event: Pick<DiscoverFilterEvent, "max_attendees" | "ga_ticket_qty" | "vip_ticket_qty">) {
  const explicit = Number(event.max_attendees || 0);
  if (explicit> 0) return explicit;
  const ticketQty = Number(event.ga_ticket_qty || 0) + Number(event.vip_ticket_qty || 0);
  return ticketQty> 0 ? ticketQty : null;
}

export function spotsRemaining(event: DiscoverFilterEvent) {
  const cap = capacityFor(event);
  if (cap == null) return Number.POSITIVE_INFINITY;
  return Math.max(0, cap - soldTicketsFor(event));
}

export function priceFor(event: Pick<DiscoverFilterEvent, "ticket_price" | "ga_ticket_price" | "vip_ticket_price" | "ticket_type">) {
  return Math.max(
    0,
    Number(event.ga_ticket_price || 0),
    Number(event.ticket_price || 0),
    Number(event.vip_ticket_price || 0),
  );
}

export function matchesEvent(event: DiscoverFilterEvent, filters: EventDiscoverFilters, query = "") {
  const textNeedle = loose(query);
  if (textNeedle) {
    const hay = [
      event.title,
      event.description,
      event.location,
      event.venue_name,
      event.category,
      event.event_type,
    ].map(loose).join(" ");
    if (!hay.includes(textNeedle)) return false;
  }

  if (filters.where.trim()) {
    const want = loose(filters.where.split(",")[0]);
    const have = [event.location, event.venue_name].map(loose).join(" ");
    if (!have.includes(want)) return false;
  }

  if (filters.startsOn || filters.endsOn) {
    if (event.is_evergreen || !event.start_date) return false;
    const start = event.start_date.slice(0, 10);
    const end = (event.end_date || event.start_date).slice(0, 10);
    if (filters.startsOn && end < filters.startsOn) return false;
    if (filters.endsOn && start> filters.endsOn) return false;
  }

  if (filters.categories.length && !filters.categories.includes(String(event.category || ""))) return false;
  if (filters.eventTypes.length && !filters.eventTypes.includes(String(event.event_type || ""))) return false;

  const price = priceFor(event);
  if (filters.price === "free" && price> 0) return false;
  if (filters.price === "paid" && price <= 0) return false;

  if (filters.approval === "instant" && event.requires_application) return false;
  if (filters.approval === "application" && !event.requires_application) return false;

  const remaining = spotsRemaining(event);
  if (filters.availableOnly && remaining <= 0) return false;
  if (filters.minSpots != null && remaining < filters.minSpots) return false;

  return true;
}

export function sortEvents<T extends DiscoverFilterEvent>(events: T[], sort: EventSort) {
  const out = [...events];
  const dateValue = (e: DiscoverFilterEvent) => e.start_date ? Date.parse(e.start_date) : Number.MAX_SAFE_INTEGER;
  switch (sort) {
    case "newest":
      return out.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    case "price_low":
      return out.sort((a, b) => priceFor(a) - priceFor(b));
    case "price_high":
      return out.sort((a, b) => priceFor(b) - priceFor(a));
    case "spots":
      return out.sort((a, b) => spotsRemaining(b) - spotsRemaining(a));
    default:
      return out.sort((a, b) => dateValue(a) - dateValue(b));
  }
}

export function whenLabel(filters: Pick<EventDiscoverFilters, "startsOn" | "endsOn">, locale: string) {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  };
  const a = filters.startsOn ? fmt(filters.startsOn) : null;
  const b = filters.endsOn ? fmt(filters.endsOn) : null;
  if (a && b) return `${a} - ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Until ${b}`;
  return null;
}

export function priceFilterLabel(filters: Pick<EventDiscoverFilters, "price" | "approval" | "minSpots">) {
  if (filters.price === "free") return "Free";
  if (filters.price === "paid") return "Paid";
  if (filters.approval === "application") return "Apply";
  if (filters.minSpots != null) return `${filters.minSpots}+ spots`;
  return null;
}

export function activeFilterCount(filters: EventDiscoverFilters) {
  return [
    !!filters.where.trim(),
    !!filters.startsOn,
    !!filters.endsOn,
    filters.categories.length> 0,
    filters.eventTypes.length> 0,
    filters.price !== "any",
    filters.approval !== "any",
    filters.minSpots != null,
    filters.availableOnly,
  ].filter(Boolean).length;
}

export function EventSearchTriad({ filters, openFilters }: {
  filters: EventDiscoverFilters;
  openFilters: () => void;
}) {
  const { t, locale } = useLanguage();
  return (
    <SearchTriad
      where={{
        label: t("de.where", "Where"),
        value: filters.where.trim() || null,
        placeholder: t("de.anywhere", "Anywhere"),
      }}
      when={{
        label: t("de.when", "When"),
        value: whenLabel(filters, locale),
        placeholder: t("de.any_date", "Any date"),
      }}
      who={{
        label: t("de.price", "Price"),
        value: priceFilterLabel(filters),
        placeholder: t("de.any_price", "Any price"),
      }}
      onWhere={openFilters}
      onWhen={openFilters}
      onWho={openFilters}
    />
  );
}


/* ── ONE ROW IN EVERY LANGUAGE, ON EVERY PHONE — the same row as OneHome (Lee, 18 Oct 2026) ──
   Lee: the List/Map · filters · sort · views row still broke onto two rows on the Events side, and
   "I said check all of them." OneHome was fixed on 15 Oct; Events had its own copy of the row, and
   the glass refresh carried a rule (`.ow-event-control-row`, max-width 480px) that deliberately
   split it into two rows. Now it is the SAME row as OneHome: `.ow-feed-controls` (never wraps; the
   glass tiles shrink instead of forcing 48 px), and Sort lives INSIDE the filter sheet — Lee, on
   OneHome: "put the sort inside of the filter… you don't need two boxes." The filter button turns
   dark when a filter is on OR the order is not the default, so a changed sort is never hidden. */
export function EventControlRow({ filters, sort, view, layout, onOpenFilters, onSort, onView, onLayout }: {
  filters: EventDiscoverFilters;
  sort: EventSort;
  view: EventDiscoverView;
  layout: EventDiscoverLayout;
  onOpenFilters: () => void;
  onSort: (sort: EventSort) => void;
  onView: (view: EventDiscoverView) => void;
  onLayout: (layout: EventDiscoverLayout) => void;
}) {
  const { t } = useLanguage();
  void onSort; // sorting now lives inside the filter sheet — see EventFilterSheet's "Sort by"
  const n = activeFilterCount(filters);
  const sorted = sort !== "soonest";
  const sortLabel = t(`de.sort.${sort}`, SORTS.find((o) => o.value === sort)?.label ?? "Sort");
  /* The SAME row as rent and sale — products/shared/FeedControlRow — so the icons, the selected
     look and every tile size match exactly (Lee, 18 Oct 2026: same experience, same code). */
  return (
    <FeedControlRow
      view={view} onView={onView}
      listLabel={t("de.list", "List")} mapLabel={t("de.map", "Map")}
      filterLabel={t("de.filters_and_sort", "Filters and sort")}
      filterTitle={`${n ? t("de.filters_active_n", "{n} active filters").replace("{n}", String(n)) : t("de.filters", "Filters")} · ${t("de.sort", "Sort")}: ${sortLabel}`}
      activeFilters={n} filterOn={n > 0 || sorted} onOpenFilters={onOpenFilters}
      layouts={[
        { id: "cards", label: t("de.layout.cards", "Large cards"), kind: "big" },
        { id: "grid", label: t("de.layout.grid", "Grid"), kind: "grid" },
        { id: "rows", label: t("de.layout.rows", "Compact list"), kind: "row" },
      ]}
      layout={layout} onLayout={id => onLayout(id as EventDiscoverLayout)} layoutLabel={t("de.layout", "Layout")}
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold opacity-55">{label}</span>
      {children}
    </label>
  );
}

function Chips({ values, options, onChange }: {
  values: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const active = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? values.filter((v) => v !== opt.value) : [...values, opt.value])}
            aria-pressed={active}
            className={cn("ow-tap rounded-xl border px-3 py-2 text-left text-[12.5px] font-bold transition", active ? "ow-ink-sel border-transparent" : "ow-edge")}
>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Group({ title, count, defaultOpen = false, children }: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-ink/[0.07] py-1 last:border-b-0 dark:border-white/10">
      <summary className="ow-tap flex cursor-pointer list-none items-center justify-between py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="text-[13.5px] font-extrabold">{title}</span>
        <span className="flex items-center gap-2">
          {!!count && <span className="rounded-full bg-brand/15 px-1.5 text-[11px] font-black tabular-nums text-brand">{count}</span>}
          <ChevronDown size={15} aria-hidden className="opacity-40 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 pb-2">{children}</div>
    </details>
  );
}

export function EventFilterSheet({ open, value, resultCount, categories, onChange, onClose, sort, onSort }: {
  /** Sort lives here now (18 Oct 2026), first, like OneHome's sheet. It applies at once. */
  sort?: EventSort;
  onSort?: (sort: EventSort) => void;
  open: boolean;
  value: EventDiscoverFilters;
  resultCount: number;
  categories: string[];
  onChange: (next: EventDiscoverFilters) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  /* The same dialog behaviour as OneHome's sheet (shell useModalFocus): focus moves in, Tab stays
     inside, Escape closes, and focus returns to the button that opened it (Testing, 18 Oct 2026). */
  const dialog = useModalFocus(open, onClose);
  if (!open) return null;

  const set = <K extends keyof EventDiscoverFilters>(key: K, next: EventDiscoverFilters[K]) =>
    onChange({ ...value, [key]: next });
  const clear = () => onChange(EMPTY_EVENT_FILTERS);

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("de.filters_and_sort", "Filters and sort")}
        onClick={(e) => e.stopPropagation()} className="glass-modal max-h-[88svh] w-full max-w-lg overflow-y-auto rounded-t-3xl px-4 pb-3 pt-2 outline-none sm:rounded-3xl">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-ink/[0.07] px-4 py-2 backdrop-blur-xl dark:border-white/10" style={{ background: "var(--overlay-bg)" }}>
          <p className="text-[15px] font-black">{t("de.filters", "Filters")}</p>
 <button type="button" onClick={onClose} className="ow-edge ow-tap grid h-9 w-9 place-items-center rounded-full border" aria-label={t("ev.close", "Close")}>
            <X size={16} />
          </button>
        </div>

        {sort && onSort && (
          <Group defaultOpen title={t("de.sort_by", "Sort by")} count={sort !== "soonest" ? 1 : 0}>
            <div className="grid grid-cols-1 gap-1" role="radiogroup" aria-label={t("de.sort_by", "Sort by")} onKeyDown={radioGroupKeys}>
              {SORTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={sort === opt.value}
                  tabIndex={sort === opt.value ? 0 : -1}
                  onClick={() => onSort(opt.value)}
                  className={cn("ow-tap flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[13.5px] font-bold transition", sort === opt.value ? "ow-ink-sel border-transparent" : "ow-edge")}
                >
                  {t(`de.sort.${opt.value}`, opt.label)}
                  {sort === opt.value && <Check size={16} />}
                </button>
              ))}
            </div>
          </Group>
        )}

        <Group defaultOpen title={t("de.where_when", "Where & when")} count={[!!value.where.trim(), !!value.startsOn, !!value.endsOn].filter(Boolean).length}>
          <Field label={t("de.where", "Where")}>
            <input
              className="input h-11 w-full"
              value={value.where}
              onChange={(e) => set("where", e.target.value)}
              placeholder={t("de.anywhere", "Anywhere")}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("de.starts_after", "Starts after")}>
              <input className="input h-11 w-full" type="date" value={value.startsOn ?? ""} onChange={(e) => set("startsOn", e.target.value || null)} />
            </Field>
            <Field label={t("de.ends_before", "Ends before")}>
              <input className="input h-11 w-full" type="date" value={value.endsOn ?? ""} onChange={(e) => set("endsOn", e.target.value || null)} />
            </Field>
          </div>
        </Group>

        <Group defaultOpen title={t("de.price_access", "Price & access")} count={[value.price !== "any", value.approval !== "any", value.availableOnly, value.minSpots != null].filter(Boolean).length}>
          <Field label={t("de.price", "Price")}>
            <div className="grid grid-cols-3 gap-2">
              {(["any", "free", "paid"] as const).map((p) => (
                <button key={p} type="button" onClick={() => set("price", p)}
                  className={cn("ow-tap rounded-xl border px-3 py-2 text-[12.5px] font-bold capitalize", value.price === p ? "ow-ink-sel border-transparent" : "ow-edge")}>
                  {p === "any" ? t("de.any", "Any") : p === "free" ? t("de.free", "Free") : t("de.paid", "Paid")}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("de.registration", "Registration")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["any", "instant", "application"] as const).map((p) => (
                <button key={p} type="button" onClick={() => set("approval", p)}
                  className={cn("ow-tap rounded-xl border px-3 py-2 text-left text-[12.5px] font-bold", value.approval === p ? "ow-ink-sel border-transparent" : "ow-edge")}>
                  {p === "any" ? t("de.any", "Any") : p === "instant" ? t("de.instant", "Instant ticket") : t("de.application", "Request to join")}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("de.spots_available", "Spots available")}>
            <input
              className="input h-11 w-full"
              inputMode="numeric"
              value={value.minSpots ?? ""}
              onChange={(e) => set("minSpots", e.target.value ? Number(e.target.value) : null)}
              placeholder={t("de.any", "Any")}
            />
          </Field>
          <button type="button" onClick={() => set("availableOnly", !value.availableOnly)}
            className={cn("ow-tap flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-bold", value.availableOnly ? "ow-ink-sel border-transparent" : "ow-edge")}>
            {t("de.available_only", "Hide sold-out events")}
            {value.availableOnly && <Check size={16} />}
          </button>
        </Group>

        <Group title={t("de.event_kind", "Event kind")} count={(value.categories.length ? 1 : 0) + (value.eventTypes.length ? 1 : 0)}>
          {categories.length> 0 && (
            <Field label={t("ev.category", "Category")}>
              <Chips values={value.categories} onChange={(v) => set("categories", v)} options={categories.map((c) => ({ value: c, label: titleCase(c) }))} />
            </Field>
          )}
          <Field label={t("ev.event_type", "Event Type")}>
            <Chips values={value.eventTypes} onChange={(v) => set("eventTypes", v)} options={EVENT_TYPES.map((et) => ({ value: et, label: titleCase(et) }))} />
          </Field>
        </Group>

        <div className="sticky bottom-0 -mx-4 mt-4 flex gap-2 border-t border-ink/[0.07] px-4 pb-1 pt-3 backdrop-blur-xl dark:border-white/10" style={{ background: "var(--overlay-bg)" }}>
 <button type="button" onClick={clear} className="ow-edge ow-tap rounded-xl border px-4 text-[13px] font-bold">
            {t("de.clear_filters", "Clear filters")}
          </button>
          <button type="button" onClick={onClose} className={cn("btn-primary min-w-0 flex-1", resultCount === 0 && "opacity-70")}>
            {resultCount === 0 ? t("de.no_match", "No events match") : (resultCount === 1 ? t("de.show_results_one", "Show 1 event") : t("de.show_results_n", "Show {n} events").replace("{n}", String(resultCount)))}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function EventMap({ events, formatDate, onOpen }: {
  events: DiscoverFilterEvent[];
  formatDate: (event: DiscoverFilterEvent) => string | null;
  onOpen: (event: DiscoverFilterEvent) => void;
}) {
  const { t } = useLanguage();
  const [latePoints, setLatePoints] = useState<Record<string, EventLatePoint>>({});
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const missing = events.filter((event) =>
        (event.latitude == null || event.longitude == null) &&
        (event.location?.trim() || event.venue_name?.trim())
      );
      if (!missing.length) {
        setResolving(false);
        return;
      }

      setResolving(true);
      const next: Record<string, EventLatePoint> = {};
      try {
        for (const event of missing) {
          const point = await geocodeEvent(event);
          if (point) next[event.id] = point;
        }
      } finally {
        if (alive) setResolving(false);
      }
      if (alive && Object.keys(next).length) setLatePoints((prev) => ({ ...prev, ...next }));
    })();
    return () => { alive = false; };
  }, [events]);

  const pins: MapPin[] = useMemo(() => events
    .map((event) => {
      const hasStoredPoint =
        event.latitude != null &&
        event.longitude != null &&
        Number.isFinite(Number(event.latitude)) &&
        Number.isFinite(Number(event.longitude));
      const point = hasStoredPoint
        ? { lat: Number(event.latitude), lng: Number(event.longitude), precision: event.address_visible === false ? "approximate" as const : "exact" as const }
        : latePoints[event.id];
      return { event, point };
    })
    .filter(({ point }) => !!point)
    .map(({ event, point }) => ({
      id: event.id,
      lat: point!.lat,
      lng: point!.lng,
      exact: point!.precision === "exact",
      priceLabel: priceFor(event)> 0 ? `${currencySymbol(event.currency)}${priceFor(event)}` : t("de.free", "Free"),
      title: event.title,
      photo: event.cover_image_url,
      facts: [formatDate(event), eventDisplayLocation(event), event.event_type ? titleCase(event.event_type) : null].filter(Boolean).join(" - "),
      href: `/events/e/${event.id}`,
    })), [events, formatDate, latePoints, t]);

  if (resolving && pins.length === 0) {
    return (
      <div className="grid h-[62vh] place-items-center rounded-2xl border border-ink/10 bg-ink/[0.03] px-6 text-center dark:border-white/10 dark:bg-white/[0.04]">
        <div>
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-[13px] font-bold">{t("de.map_finding_locations", "Finding event locations")}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">{t("de.map_finding_locations_desc", "Checking the addresses for this map view.")}</p>
        </div>
      </div>
    );
  }

  if (events.length> 0 && pins.length === 0) {
    return (
      <div className="grid h-[62vh] place-items-center rounded-2xl border border-ink/10 bg-ink/[0.03] px-6 text-center dark:border-white/10 dark:bg-white/[0.04]">
        <div>
          <p className="text-[13px] font-bold">{t("de.map_no_event_locations", "Nothing to map yet")}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">{t("de.map_no_event_locations_desc", "These events do not have a mappable event address yet. They are still in the list view.")}</p>
        </div>
      </div>
    );
  }

  return <ListingMap pins={pins} onOpen={(pin) => {
    const event = events.find((e) => e.id === pin.id);
    if (event) onOpen(event);
  }} heightClass="h-[62vh]" gestureHandling="cooperative" />;
}


