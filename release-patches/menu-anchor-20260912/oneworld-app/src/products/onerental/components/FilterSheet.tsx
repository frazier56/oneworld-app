import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  GlassDate,
  useI18n, W, GlassSelect, PlacesInput, Chevron,
  Field, Row, Stepper, MultiChips, ChoiceChips, Toggle,
  MoneyInput, moneyDigits, CO_NEIGHBOURHOODS, coCityKey, PriceHistogram,
} from "@oneworld/shell";
import {
  propertyTypes, amenities, petsOptions, masterBeds, laundryOptions, securityLevels,
  type PropertyType, type PetsAllowed, type AmenityKey,
  type MasterBed, type Laundry, type SecurityLevel,
} from "../lib/attributes";

/**
 * SORT AND FILTER — the two controls the feed had neither of.
 * ============================================================================================
 * Lee, 11 Aug 2026:
 *
 *   *"On the discovery page too, you should have, like, a sort button on there and a filter button
 *    as well… the city should be based on Google places… like Airbnb, I can filter on different
 *    attributes… price range between this amount and this amount… only three bedrooms or greater."*
 *
 * ── WHY THIS SHAPE, AND NOT ZILLOW'S ────────────────────────────────────────────────────────
 * Zillow ships 111 filters, defined as DATA rather than as code, and renders the first few as
 * "pills" above a sheet holding the rest. That is the right architecture at their catalogue size
 * and the wrong one at ours: a filter that always returns zero results is worse than no filter,
 * and with a few hundred listings most of those 111 would. What is copied is the STRUCTURE — a
 * short always-visible row, everything else one tap away, and a footer that says how many results
 * you will get BEFORE you commit — not the length.
 *
 * The count in the footer is the important part. Zillow's "See 10,642 rentals available" is doing
 * the work of an undo: you can see a filter was too tight without applying it, going back, and
 * trying to remember what you changed.
 *
 * ── THE ROW ABOVE, AND WHY IT IS TWO CONTROLS ───────────────────────────────────────────────
 * OneJob's `SearchBar` has the arithmetic written into it: a search field stops working below
 * ~180px, a compact select needs ~130px, and a 360px phone has 328px of content width. So
 * `180 + 130 + 130 + 16 = 456px` does not fit on any phone and TWO CONTROLS PER ROW IS A HARD
 * CEILING. Search already owns one slot on this feed, so Filter and Sort share the second — as a
 * single pair, not two independent controls that would push search off the row.
 */

export type Sort = "newest" | "price_low" | "price_high" | "size";

/** What a listing's price is per. Mirrors the database's `rental_price_unit` enum exactly —
 *  a third value here that the column cannot hold would filter every listing out of existence. */
export type RentalPeriod = "night" | "month";

export type Filters = {
  city: string;
  /** Lee, 12 Aug: *"you should be able to filter by neighbourhood."* Matched loosely — see
   *  `matches` — because "El Poblado" and "Poblado" are the same barrio to everybody but a
   *  string comparison. */
  neighbourhood: string;
  minPrice: number | null;
  maxPrice: number | null;
  /** Which currency the two price numbers ABOVE are written in. See the note in the sheet. */
  priceCcy: "USD" | "COP";
  /* ── PER NIGHT OR PER MONTH — a UNIT, exactly like `priceCcy` above ────────────────────────
     Lee: *"per-day / per-month choice in the filter. Default is per month."*

     ⚠️ AND IT FIXES A REAL COMPARISON BUG. Until now `matches` read `l.price` as a bare number
     and compared it to the reader's range with no regard for the unit the listing is priced in.
     Fifty a night and fifteen hundred a month are both just numbers to a `<`, so "under two
     thousand" swept in every nightly listing in the city and "under two hundred" hid every monthly
     one — silently, both directions, and looking to the customer like we have no inventory.

     Like `priceCcy`, this is the UNIT OF THE QUESTION rather than a filter of its own: it does
     not count towards the badge, and it narrows nothing until a price bound is actually set. */
  period: RentalPeriod;
  /* 15 Aug 2026: the one filter a guest reaches for first, and the only one that was missing. */
  minGuests: number | null;
  /* ── v72 · WHEN ──────────────────────────────────────────────────────────────────────────
     The third of Lee's "where, when, who", and the one the rental filter never had. Both are
     ISO `YYYY-MM-DD` strings, or null for "any".

     ⚠️ These match against `available_from` and `min_nights`, which every listing carries. They
     do NOT exclude places already reserved for the dates — `reservations` holds those ranges but
     the feed loads listings, not reservations, so that arrives with blackout dates. The sheet
     says so on screen, in both languages. */
  arriveOn: string | null;
  departOn: string | null;
  minBeds: number | null;
  minBaths: number | null;
  minArea: number | null;
  types: PropertyType[];
  pets: PetsAllowed | null;
  amenityKeys: AmenityKey[];
  furnishedOnly: boolean;
  /* ── EVERY REMAINING FORM ATTRIBUTE (Lee, 12 Aug 2026) ────────────────────────────────────
     *"All of the attributes that we have on the form need to be filterable."* Taken literally.
     Each of these is a column both listing tables carry and both forms write, so a filter here
     can never ask a question the form did not collect. */
  minParking: number | null;
  minFloor: number | null;
  estratos: number[];
  masterBed: MasterBed | null;
  walkInCloset: boolean;
  dualVanities: boolean;
  acInMaster: boolean;
  minAcUnits: number | null;
  laundry: Laundry | null;
  security: SecurityLevel | null;
  outside: string[];
  schoolsOnly: boolean;
  penthouseOnly: boolean;
  openViewOnly: boolean;
  /** A newest-building filter, asked the way the form asks it: in YEARS, not in a build year. */
  maxAge: number | null;
};

export const EMPTY: Filters = {
  city: "", neighbourhood: "", minPrice: null, maxPrice: null, priceCcy: "USD", period: "month",
  minGuests: null, arriveOn: null, departOn: null,
  minBeds: null, minBaths: null, minArea: null, types: [], pets: null, amenityKeys: [],
  furnishedOnly: false,
  minParking: null, minFloor: null, estratos: [], masterBed: null, walkInCloset: false,
  dualVanities: false, acInMaster: false, minAcUnits: null, laundry: null, security: null,
  outside: [], schoolsOnly: false, penthouseOnly: false, openViewOnly: false, maxAge: null,
};

/** How many things are actually narrowing the list. Drives the badge on the button. */
export function activeCount(f: Filters): number {
  /* One per NARROWING choice, not one per control — `priceCcy` and `period` each pick the unit of a filter rather
     than being a filter, so it never counts. A badge that says "3" when the reader has chosen two
     things teaches them not to trust the badge. */
  const on = [
    !!f.city, !!f.neighbourhood.trim(), f.minPrice != null, f.maxPrice != null,
    f.minGuests != null, !!f.arriveOn, !!f.departOn,
    f.minBeds != null, f.minBaths != null, f.minArea != null,
    f.types.length > 0, !!f.pets, f.amenityKeys.length > 0, f.furnishedOnly,
    f.minParking != null, f.minFloor != null, f.estratos.length > 0, !!f.masterBed,
    f.walkInCloset, f.dualVanities, f.acInMaster, f.minAcUnits != null, !!f.laundry,
    !!f.security, f.outside.length > 0, f.schoolsOnly, f.penthouseOnly, f.openViewOnly,
    f.maxAge != null,
  ];
  return on.filter(Boolean).length;
}

/**
 * WHAT IS CURRENTLY ON — Airbnb audit pattern six, 14 August 2026.
 * ============================================================================================
 * Airbnb puts the filters you have already chosen at the top of the sheet, as chips with an X.
 * **We need this more than they do, not less.** They have about a dozen filters; we have
 * twenty-six, spread across seven groups that collapse. Somebody can set three of them, collapse
 * the groups, come back an hour later and have no idea why the feed looks empty — and the
 * conclusion they reach is "OneHome has nothing", not "I left a filter on".
 *
 * The badge already told them a number. A number is not actionable. These are.
 *
 * ── ONE LIST, DERIVED, NEVER HAND-MAINTAINED ────────────────────────────────────────────────
 * Every chip is generated from the SAME predicate list `activeCount` uses, so the two can never
 * disagree — a chip row that shows four chips beside a badge reading five is worse than no chip
 * row. Adding a filter means adding one entry here and the count, the chips and the clearing all
 * follow. `clear` returns the patch that switches that one filter off, so removing a chip cannot
 * accidentally reset a neighbour.
 */
type Chip = { key: string; label: string; clear: Partial<Filters> };

export function activeChips(f: Filters, lang: string, money: (n: number) => string): Chip[] {
  const out: Chip[] = [];
  const add = (on: boolean, key: string, label: string, clear: Partial<Filters>) => {
    if (on) out.push({ key, label, clear });
  };

  add(!!f.city, "city", f.city, { city: "" });
  add(!!f.neighbourhood.trim(), "hood", f.neighbourhood, { neighbourhood: "" });

  /* One chip for a range, two for a half-open one — "from 900 dollars" and "900 to 2,000 dollars"
     are one thought each, and splitting the closed range into two chips reads as two filters. */
  if (f.minPrice != null && f.maxPrice != null) {
    add(true, "price", `${money(f.minPrice)} – ${money(f.maxPrice)}`, { minPrice: null, maxPrice: null });
  } else {
    add(f.minPrice != null, "minPrice", W(lang, `From ${money(f.minPrice!)}`, `Desde ${money(f.minPrice!)}`), { minPrice: null });
    add(f.maxPrice != null, "maxPrice", W(lang, `Up to ${money(f.maxPrice!)}`, `Hasta ${money(f.maxPrice!)}`), { maxPrice: null });
  }

  add(f.minGuests != null, "guests", W(lang, `Sleeps ${f.minGuests}+`, `Duermen ${f.minGuests}+`), { minGuests: null });
  add(f.minBeds != null, "beds", W(lang, `${f.minBeds}+ bedrooms`, `${f.minBeds}+ habitaciones`), { minBeds: null });
  add(f.minBaths != null, "baths", W(lang, `${f.minBaths}+ bathrooms`, `${f.minBaths}+ baños`), { minBaths: null });
  add(f.minArea != null, "area", `${f.minArea}+ m²`, { minArea: null });
  add(f.minParking != null, "parking", W(lang, `${f.minParking}+ parking`, `${f.minParking}+ parqueaderos`), { minParking: null });
  add(f.minFloor != null, "floor", W(lang, `Floor ${f.minFloor}+`, `Piso ${f.minFloor}+`), { minFloor: null });
  add(f.maxAge != null, "age", W(lang, `Under ${f.maxAge} years old`, `Menos de ${f.maxAge} años`), { maxAge: null });
  add(f.minAcUnits != null, "ac", W(lang, `${f.minAcUnits}+ AC units`, `${f.minAcUnits}+ aires`), { minAcUnits: null });

  add(f.types.length > 0, "types", f.types.join(", "), { types: [] });
  add(f.estratos.length > 0, "estratos", W(lang, `Estrato ${f.estratos.join(", ")}`, `Estrato ${f.estratos.join(", ")}`), { estratos: [] });
  add(f.outside.length > 0, "outside", f.outside.join(", "), { outside: [] });
  add(f.amenityKeys.length > 0, "amenities",
    W(lang, `${f.amenityKeys.length} amenities`, `${f.amenityKeys.length} comodidades`), { amenityKeys: [] });

  add(!!f.pets, "pets", W(lang, `Pets: ${f.pets}`, `Mascotas: ${f.pets}`), { pets: null });
  add(!!f.masterBed, "masterBed", W(lang, `Master bed: ${f.masterBed}`, `Cama principal: ${f.masterBed}`), { masterBed: null });
  add(!!f.laundry, "laundry", W(lang, `Laundry: ${f.laundry}`, `Lavandería: ${f.laundry}`), { laundry: null });
  add(!!f.security, "security", W(lang, `Security: ${f.security}`, `Seguridad: ${f.security}`), { security: null });

  add(f.furnishedOnly, "furnished", W(lang, "Furnished", "Amoblado"), { furnishedOnly: false });
  add(f.walkInCloset, "closet", W(lang, "Walk-in closet", "Vestier"), { walkInCloset: false });
  add(f.dualVanities, "vanities", W(lang, "Two sinks", "Dos lavamanos"), { dualVanities: false });
  add(f.acInMaster, "acMaster", W(lang, "AC in master", "Aire en la principal"), { acInMaster: false });
  add(f.schoolsOnly, "schools", W(lang, "Near schools", "Cerca de colegios"), { schoolsOnly: false });
  add(f.penthouseOnly, "penthouse", W(lang, "Penthouse only", "Solo penthouse"), { penthouseOnly: false });
  add(f.openViewOnly, "view", W(lang, "Unobstructed view", "Vista despejada"), { openViewOnly: false });

  return out;
}

/** Does one listing survive the filters? Kept here, beside the definition, so the sheet and the
 *  feed can never disagree about what "3+ bedrooms" means. */
/** Accent- and case-insensitive containment. "Medellin" has to find "Medellín". */
const loose = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function matches(l: any, f: Filters, fx?: number | null): boolean {
  const price = Number(l.price ?? l.asking_price) || 0;

  /* ── v72 · WHEN ──────────────────────────────────────────────────────────────────────────
     ⚠️ A REVERSED PAIR IS NOT A FILTER, IT IS A TYPO. If "leave" is before "arrive", every
     listing would fail and the reader would get an empty feed with nothing to explain it. A
     nonsense range means "no date filter" — never "no results". */
  const arrive = f.arriveOn || null;
  const depart = f.departOn && f.arriveOn && f.departOn < f.arriveOn ? null : (f.departOn || null);

  /* A place that becomes free AFTER you need it is a place you cannot have. ISO dates compare
     correctly as strings, which is the whole reason this column is stored as one. */
  if (arrive && l.available_from && String(l.available_from) > arrive) return false;

  /* And a thirty-night minimum is not a candidate for a week. Only checked when BOTH dates are
     given, because a stay length needs two ends. */
  if (arrive && depart) {
    const nights = Math.round((Date.parse(depart + "T00:00:00Z") - Date.parse(arrive + "T00:00:00Z")) / 86400000);
    if (Number.isFinite(nights) && nights > 0 && Number(l.min_nights) > nights) return false;
  }
  if (f.city) {
    const want = loose(f.city.split(",")[0]);
    if (!loose(l.city).includes(want)) return false;
  }
  /* Barrio names are typed by two different people on two different days. Match either way round
     so "Poblado" finds "El Poblado" and "El Poblado" finds "Poblado" — an exact comparison here
     would make the filter look broken on real data. */
  if (f.neighbourhood.trim()) {
    const want = loose(f.neighbourhood.split(",")[0]);
    const have = loose(l.neighbourhood);
    if (!have || !(have.includes(want) || want.includes(have))) return false;
  }
  /* ── THE PRICE IS ALWAYS COMPARED IN USD ────────────────────────────────────────────────
     Every listing stores its price in USD (`display_currency` only changes what is DRAWN). So a
     reader who typed pesos has their two numbers converted at the official TRM before comparison
     rather than the listing being converted for each row — one division instead of N, and no
     chance of a listing being compared against a number in a different unit. With no rate yet
     loaded the peso filter cannot be honoured, so it is skipped rather than applied wrongly: a
     silently mis-converted price range is far worse than a range that has not kicked in yet. */
  const rate = f.priceCcy === "COP" ? (fx && fx > 0 ? fx : null) : 1;
  if (f.priceCcy === "USD" || rate) {
    const min = f.minPrice != null && rate ? f.minPrice / rate : null;
    const max = f.maxPrice != null && rate ? f.maxPrice / rate : null;
    /* ── ⚠️ ONLY COMPARE PRICES IN THE SAME UNIT ───────────────────────────────────────────
       A range typed against "per month" must not be tested on a listing priced per night.

       A listing that has not declared a unit is treated as monthly — the same guess the listing
       form and the rest of the product already make. Dropping untyped listings out of every
       priced search would hide real inventory.

       A sale row has an asking price and no period at all, and `matches` is shared between the
       twins, so it is never period-filtered. */
    if (min != null || max != null) {
      const unit = (l.price_unit ?? (l.asking_price != null ? null : "month")) as RentalPeriod | null;
      if (unit != null && unit !== f.period) return false;
    }
    if (min != null && price < min) return false;
    if (max != null && price > max) return false;
  }
  /* `3+ bedrooms` is a MINIMUM, which is Lee's own phrasing — "only three bedrooms or greater".
     A listing that has not stated its bedroom count fails a bedroom filter rather than passing
     it: somebody filtering for three bedrooms would rather see fewer results than open a listing
     that turns out to be a studio. */
  /* A listing that has not said how many it sleeps is EXCLUDED when the filter is on, the same
     way bedrooms behaves. Somebody searching for six beds would rather see fewer results than open
     a listing and find out it sleeps two. */
  if (f.minGuests != null && (l.max_guests == null || l.max_guests < f.minGuests)) return false;
  if (f.minBeds != null && (l.bedrooms == null || l.bedrooms < f.minBeds)) return false;
  if (f.minBaths != null && (l.bathrooms == null || l.bathrooms < f.minBaths)) return false;
  if (f.minArea != null && (l.area_m2 == null || l.area_m2 < f.minArea)) return false;
  if (f.types.length && !f.types.includes(l.property_type)) return false;
  if (f.pets && l.pets_allowed !== f.pets) return false;
  if (f.furnishedOnly && !l.furnished) return false;
  if (f.amenityKeys.length) {
    const have: string[] = l.amenities ?? [];
    if (!f.amenityKeys.every(k => have.includes(k))) return false;
  }

  /* ── THE REST OF THE FORM ────────────────────────────────────────────────────────────────
     Same rule throughout: a listing that has NOT STATED an attribute fails a filter on it. The
     alternative — passing unknowns through — means somebody who filtered for covered parking
     opens six listings that never mentioned parking, and stops using the filter. A boolean
     toggle that is off is not a filter at all, so `false` never excludes anything. */
  if (f.minParking != null && (l.parking_spaces == null || l.parking_spaces < f.minParking)) return false;
  if (f.minFloor != null && (l.floor_number == null || l.floor_number < f.minFloor)) return false;
  if (f.estratos.length && !f.estratos.includes(Number(l.estrato))) return false;
  if (f.masterBed && l.master_bed !== f.masterBed) return false;
  if (f.walkInCloset && !l.walk_in_closet) return false;
  if (f.dualVanities && !l.dual_vanities) return false;
  if (f.acInMaster && !l.ac_in_master) return false;
  if (f.minAcUnits != null && (l.air_conditioning_units == null || l.air_conditioning_units < f.minAcUnits)) return false;
  if (f.laundry && l.laundry !== f.laundry) return false;
  if (f.security && l.security_level !== f.security) return false;
  if (f.outside.length) {
    const col: Record<string, string> = {
      balcony: "has_balcony", patio: "has_patio", backyard: "has_backyard", grill: "has_grill",
    };
    if (!f.outside.every(k => !!l[col[k]])) return false;
  }
  if (f.schoolsOnly && !l.schools_nearby) return false;
  if (f.penthouseOnly && !l.penthouse) return false;
  if (f.openViewOnly && !l.open_view) return false;
  /* Asked in years, stored as a build year — the same conversion the forms do, in reverse. */
  if (f.maxAge != null) {
    if (l.year_built == null) return false;
    if (new Date().getFullYear() - Number(l.year_built) > f.maxAge) return false;
  }
  return true;
}

export function sortListings<T extends Record<string, any>>(list: T[], sort: Sort): T[] {
  const p = (x: any) => Number(x.price ?? x.asking_price) || 0;
  const out = [...list];
  switch (sort) {
    case "price_low":  return out.sort((a, b) => p(a) - p(b));
    case "price_high": return out.sort((a, b) => p(b) - p(a));
    case "size":       return out.sort((a, b) => (Number(b.area_m2) || 0) - (Number(a.area_m2) || 0));
    default:           return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
}

/* ============================================================================================
   THE CONTROL ROW — four control groups, one row.
   ============================================================================================
   Lee, 13 Aug 2026, with the row circled on a screenshot:

     *"We need to make try to get all of these elements on the same row… you're gonna have to use
     icons more than likely. We should have list and map — that's one option. And right next to
     it you're gonna have filters, which you're gonna have to just show the icon, you're not
     gonna have room for the actual word. And then next to that you're gonna have your sort, and
     then next to that you're gonna have your view… I circled it in one of the images, there's a
     little icon that looks like a filter but it has a down arrow next to it. That's like a sort.
     So if you just put that, then that'll bring up the box. The thing is all you gotta do is tap
     it. It's gonna bring up the box. So there's no need in having a lot of words right there."*

   It was three rows: filter+sort, then list/map+layout, then currency. Now one, plus currency.

   ── THE ARITHMETIC, BECAUSE THIS ROW EITHER FITS OR IT DOES NOT ─────────────────────────────
   A 390px phone gives 358px of content width inside the page's px-4. The four groups:

       List / Map segmented ....... 112px   (the only words that survive — they name a MODE,
                                             and a mode with no label is a guess)
       Filters, icon only ..........  44px
       Sort, icon only .............  44px
       View, three glyphs .......... 116px
       three 6px gaps ..............  18px
       ────────────────────────────────────
                                     334px   of 358 available

   That is why Filters and Sort lose their words and List/Map keeps them. It is not a style
   preference; 44px is also the minimum tap target, so neither icon button may shrink further.

   ── EVERY ICON-ONLY CONTROL STILL HAS A NAME ────────────────────────────────────────────────
   `aria-label` and `title` on all of them. An icon-only button with no accessible name is
   invisible to a screen reader and unnameable by voice control, and this row is now four of
   them. The tooltip also rescues the sighted person who cannot decode the glyph.
   ============================================================================================ */

/** The sort glyph Lee circled: filter bars with a down arrow beside them. */
function SortGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M3 6h11M3 12h8M3 18h5" />
      <path d="M18 8v10M18 18l-2.5-2.6M18 18l2.5-2.6" />
    </svg>
  );
}

function FilterGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

const SORTS: { value: Sort; en: string; es: string }[] = [
  { value: "newest",     en: "Newest first",       es: "Más recientes" },
  { value: "price_low",  en: "Price: low to high", es: "Precio: menor a mayor" },
  { value: "price_high", en: "Price: high to low", es: "Precio: mayor a menor" },
  { value: "size",       en: "Biggest first",      es: "Más grandes primero" },
];

/**
 * The sort menu. A portal, not a `<select>`: a native select renders as a black wheel on a
 * phone (canon — see `Pickers.tsx`), and `GlassSelect` draws a labelled trigger, which is the
 * one thing this control no longer has room for.
 */
function SortMenu({ value, onChange, onClose }: {
  value: Sort; onChange: (s: Sort) => void; onClose: () => void;
}) {
  const { lang } = useI18n();
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="glass-modal w-full max-w-sm rounded-t-3xl px-3 pb-3 pt-2 sm:rounded-3xl">
        <p className="px-2 py-2 text-[12px] font-black uppercase tracking-wide opacity-50">
          {W(lang, "Sort by", "Ordenar por")}
        </p>
        {SORTS.map(o => (
          <button key={o.value} type="button"
            onClick={() => { onChange(o.value); onClose(); }}
            aria-pressed={value === o.value}
            className={`ow-tap flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-[14.5px] font-bold ${
              value === o.value ? "bg-ink/[0.07] dark:bg-white/10" : ""}`}>
            {W(lang, o.en, o.es)}
            {value === o.value && (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" aria-hidden className="text-brand">
                <path d="m5 13 4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

export function ControlRow({
  filters, sort, view, layout, layouts, onOpenFilters, onSort, onView, onLayout,
}: {
  filters: Filters;
  sort: Sort;
  /**
   * List/Map and the layout picker are OPTIONAL, and that is a temporary state of affairs worth
   * naming: the sale feed has neither a map nor the three card layouts the rent feed grew on
   * 11 Aug, so it renders this row with two controls instead of four. Lee's twin rule says the
   * two feeds should match, and they will once the sale side gets a map — but shipping a dead
   * "Map" button that switches to nothing would be worse than the asymmetry. Flagged for Max.
   */
  view?: "list" | "map";
  layout?: string;
  /** The layout glyphs, supplied by the feed so this file owns no product artwork. */
  layouts?: { id: string; en: string; es: string; glyph: ReactNode }[];
  onOpenFilters: () => void;
  onSort: (s: Sort) => void;
  onView?: (v: "list" | "map") => void;
  onLayout?: (id: string) => void;
}) {
  const { lang } = useI18n();
  const [sortOpen, setSortOpen] = useState(false);
  const n = activeCount(filters);
  const sortLabel = W(lang, SORTS.find(o => o.value === sort)?.en ?? "Sort",
                            SORTS.find(o => o.value === sort)?.es ?? "Ordenar");

  const iconBtn = "ow-tap grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition";

  return (
    <>
      {sortOpen && <SortMenu value={sort} onChange={onSort} onClose={() => setSortOpen(false)} />}
      <div className="flex items-center gap-1.5">
        {/* LIST / MAP — the only group that keeps its words. */}
        {view && onView && (
        <div className="inline-flex shrink-0 rounded-xl border border-ink/12 p-0.5 dark:border-white/15">
          {(["list", "map"] as const).map(v => (
            <button key={v} type="button" onClick={() => onView(v)} aria-pressed={view === v}
              className={`ow-tap min-h-[40px] rounded-[10px] px-2.5 text-[12.5px] font-bold transition ${
                view === v ? "bg-ink text-paper dark:bg-white dark:text-ink" : "opacity-60"}`}>
              {v === "list" ? W(lang, "List", "Lista") : W(lang, "Map", "Mapa")}
            </button>
          ))}
        </div>
        )}

        {/* FILTERS — icon only, with the active count as a dot rather than a number beside a
            word. The count still has to be visible or a filter gets forgotten and then blamed. */}
        <button type="button" onClick={onOpenFilters}
          aria-label={W(lang, "Filters", "Filtros")}
          title={n > 0 ? W(lang, `Filters (${n} active)`, `Filtros (${n} activos)`)
                       : W(lang, "Filters", "Filtros")}
          className={`${iconBtn} relative ${
            n > 0 ? "border-transparent bg-ink text-paper dark:bg-white dark:text-ink"
                  : "border-ink/12 dark:border-white/15"}`}>
          <FilterGlyph />
          {n > 0 && (
            <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-black tabular-nums text-white">
              {n}
            </span>
          )}
        </button>

        {/* SORT — the glyph Lee circled. Tapping opens the box; nothing is written here. */}
        <button type="button" onClick={() => setSortOpen(true)}
          aria-label={W(lang, "Sort", "Ordenar")}
          title={`${W(lang, "Sort", "Ordenar")}: ${sortLabel}`}
          className={`${iconBtn} ${
            sort !== "newest" ? "border-transparent bg-ink text-paper dark:bg-white dark:text-ink"
                              : "border-ink/12 dark:border-white/15"}`}>
          <SortGlyph />
        </button>

        {/* VIEW — three layouts. Hidden on Map, because there is no list to lay out. */}
        {view === "list" && layouts && onLayout && (
          <div className="ml-auto inline-flex shrink-0 rounded-xl border border-ink/12 p-0.5 dark:border-white/15"
            role="radiogroup" aria-label={W(lang, "Layout", "Diseño")}>
            {layouts.map(o => (
              <button key={o.id} type="button" role="radio" aria-checked={layout === o.id}
                aria-label={W(lang, o.en, o.es)} title={W(lang, o.en, o.es)}
                onClick={() => onLayout(o.id)}
                className={`ow-tap grid h-10 w-9 place-items-center rounded-[10px] transition ${
                  layout === o.id ? "bg-ink text-paper dark:bg-white dark:text-ink" : "opacity-50"}`}>
                {o.glyph}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================================================
   A COLLAPSIBLE GROUP — Lee, 12 Aug 2026:
     *"On the filters, you should be able to expand and collapse the sections. Otherwise it's just
     one long list and you're scrolling forever."*

   He asked for this the moment the sheet grew past a screenful, and the sheet has since grown to
   twenty-six filters. Two decisions inside it are worth stating:

   · WHAT OPENS BY DEFAULT. Where, price and size — the three things somebody has already decided
     before they opened the sheet. Everything else starts shut, so the sheet is about a screen and
     a half rather than six, and the reader scrolls past HEADINGS rather than past controls.
   · A SHUT SECTION STILL SHOWS ITS COUNT. Collapsing is how a filter gets forgotten and then
     blamed for an empty result. The number on the right says a shut section is still narrowing
     the list, without opening it.

   Native <details> deliberately: it is keyboard- and screen-reader-correct for nothing, it
   survives a re-render without state of its own, and it costs no JavaScript.
   ============================================================================================ */
function Group({ title, count, defaultOpen = false, children }: {
  title: string; count?: number; defaultOpen?: boolean; children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-ink/[0.07] py-1 last:border-b-0 dark:border-white/10">
      <summary className="ow-tap flex cursor-pointer list-none items-center justify-between py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="text-[13.5px] font-extrabold">{title}</span>
        <span className="flex items-center gap-2">
          {!!count && (
            <span className="rounded-full bg-brand/15 px-1.5 text-[11px] font-black tabular-nums text-brand">
              {count}
            </span>
          )}
          {/* `group-open:` is Tailwind's own variant for a parent <details open>. An arbitrary
              `[details[open]_&]` selector compiles but never matches. */}
          <span className="opacity-40 transition-transform group-open:rotate-180">
            <Chevron />
          </span>
        </span>
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

/* ============================================================================================
   THE SHEET.
   ============================================================================================ */
export function FilterSheet({ open, value, resultCount, fx, prices = [], onChange, onClose }: {
  open: boolean;
  value: Filters;
  /** How many listings the DRAFT filters would return. Computed by the feed, shown in the footer. */
  resultCount: number;
  /** Today's official COP/USD rate, if it has loaded. Only used to explain a peso range. */
  fx?: number | null;
  /**
   * Every candidate listing's price, in USD, for the histogram to draw.
   *
   * Deliberately the prices of listings BEFORE the price filter is applied but AFTER the other
   * filters — otherwise the chart redraws itself every time the handle moves, which makes the
   * distribution appear to change as you look at it. The feed computes that set; see `Feed.tsx`.
   */
  prices?: number[];
  onChange: (f: Filters) => void;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  /* Edited as a DRAFT and applied on close, so the feed does not re-sort under the reader's
     thumb on every tap of a stepper. The count still updates live, which is the whole point. */
  const [draft, setDraft] = useState<Filters>(value);
  /* How this sheet draws money, in whichever unit the two boxes are currently in. Passed to the
     histogram and to the chips so all three agree — a chip reading "$900" beside a handle reading
     "900.000" would be two different filters as far as the reader is concerned. */
  const drawMoney = (n: number) =>
    draft.priceCcy === "COP"
      ? `$${Math.round(n).toLocaleString("es-CO")}`
      : `$${Math.round(n).toLocaleString("en-US")}`;

  const chips = activeChips(draft, lang, drawMoney);

  /* The histogram draws in the unit of the boxes, so peso mode converts once, here, at the same
     official rate `matches` uses. Without a rate loaded there is nothing honest to draw. */
  const histPrices = draft.priceCcy === "COP"
    ? (fx && fx > 0 ? prices.map(p => p * fx) : [])
    : prices;

  /* Barrio suggestions follow whichever city is in the box above. */
  const hoods = CO_NEIGHBOURHOODS[coCityKey(draft.city)] ?? CO_NEIGHBOURHOODS.medellin ?? [];
  if (!open) return null;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    onChange(next); // live count
  };

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/45" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="glass-modal max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl px-4 pb-4 pt-3 sm:mb-6 sm:rounded-3xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold">{W(lang, "Filters", "Filtros")}</h2>
          <button onClick={() => { setDraft(EMPTY); onChange(EMPTY); }}
            className="ow-tap text-[12.5px] font-bold text-brand">
            {W(lang, "Clear all", "Limpiar todo")}
          </button>
        </div>

        {/* ── WHERE ────────────────────────────────────────────────────────────────────── */}
        {/* ── WHAT IS CURRENTLY ON (Airbnb audit pattern six) ────────────────────────────
             First thing in the sheet, before any group. With twenty-six filters across seven
             collapsible groups, a person can bury three choices and never find them again — and
             the conclusion they draw is that OneHome has nothing, not that a filter is on. */}
        {chips.length > 0 && (
          <div className="-mx-1 mb-3 rounded-2xl bg-ink/[0.04] p-3 dark:bg-white/[0.06]">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[11.5px] font-black uppercase tracking-wide opacity-55">
                {W(lang, "Selected", "Seleccionado")}
              </span>
              <button type="button"
                onClick={() => { setDraft(EMPTY); onChange(EMPTY); }}
                className="ow-tap text-[12px] font-bold underline underline-offset-2 opacity-60">
                {W(lang, "Clear all", "Borrar todo")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map(c => (
                <button key={c.key} type="button"
                  onClick={() => setDraft(d => { const next = { ...d, ...c.clear }; onChange(next); return next; })}
                  className="ow-tap inline-flex max-w-full items-center gap-1.5 rounded-full border border-ink/15 bg-paper px-2.5 py-1 text-[12px] font-bold dark:border-white/20 dark:bg-transparent">
                  <span className="truncate">{c.label}</span>
                  <span aria-hidden="true" className="shrink-0 text-[13px] leading-none opacity-55">×</span>
                  <span className="sr-only">{W(lang, "Remove this filter", "Quitar este filtro")}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Group defaultOpen title={W(lang, "Where", "Dónde")}
          count={(draft.city ? 1 : 0) + (draft.neighbourhood.trim() ? 1 : 0)}>
          <Field label={W(lang, "City", "Ciudad")}>
            <PlacesInput variant="city" countries={["co"]}
              value={draft.city} onChange={v => set("city", v)}
              onSelectParts={({ name }) => set("city", name)}
              placeholder={W(lang, "Anywhere", "En cualquier lugar")} />
          </Field>

          {/* ── NEIGHBOURHOOD (Lee, 12 Aug 2026) ──────────────────────────────────────────
              *"When you type in the neighbourhood it should give you the Google places for the
              neighbourhood… and you should be able to filter by neighbourhood."*

              Both halves of that, in one control: Google's `(regions)` predictions, biased to
              whichever city is above, PLUS the curated barrio list as a datalist underneath so
              the six names people actually search for are one tap away even when Places is slow,
              refused, or offline. Typing anything is still allowed — the barrio a listing was
              filed under is free text, so a closed list would silently exclude real places. */}
          <Field label={W(lang, "Neighbourhood", "Barrio")}
            hint={W(lang, "Matches loosely — “Poblado” finds “El Poblado”.",
                          "Coincide de forma flexible — «Poblado» encuentra «El Poblado».")}>
            <PlacesInput variant="neighbourhood" countries={["co"]} bias={draft.city || "Medellín"}
              value={draft.neighbourhood} onChange={v => set("neighbourhood", v)}
              onSelectParts={({ name }) => set("neighbourhood", name)}
              placeholder={hoods[0] ?? W(lang, "Any neighbourhood", "Cualquier barrio")} />
            {hoods.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hoods.map(h => (
                  <button key={h} type="button"
                    onClick={() => set("neighbourhood", draft.neighbourhood === h ? "" : h)}
                    className={`ow-tap rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${
                      draft.neighbourhood === h
                        ? "border-transparent bg-ink text-paper dark:bg-white dark:text-ink"
                        : "border-ink/12 opacity-70 dark:border-white/15"}`}>
                    {h}
                  </button>
                ))}
              </div>
            )}
          </Field>
        </Group>

        {/* ── PRICE ────────────────────────────────────────────────────────────────────── */}
        <Group defaultOpen title={W(lang, "Price", "Precio")}
          count={(draft.minPrice != null ? 1 : 0) + (draft.maxPrice != null ? 1 : 0)}>
          {/* ── THE READER PICKS THE CURRENCY (Lee, 12 Aug 2026) ──────────────────────────
              *"They should be able to choose their currency… a Colombian is thinking in pesos
              and a foreigner is thinking in dollars, and neither one should have to do the
              math."*

              The toggle changes the UNIT OF THE TWO BOXES, not the listings. Both numbers are
              converted to USD once, at the official TRM, before anything is compared — see
              `matches`. Switching the toggle deliberately CLEARS the two numbers rather than
              converting them: "2,000" typed as dollars becoming "8,240,000" pesos under your
              thumb is startling, and a half-converted range that looks deliberate is worse than
              an empty one. */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold opacity-55">
              {W(lang, "Show and enter prices in", "Ver e ingresar precios en")}
            </span>
            <div className="flex overflow-hidden rounded-xl border border-ink/12 dark:border-white/15">
              {(["USD", "COP"] as const).map(c => (
                <button key={c} type="button"
                  onClick={() => { if (draft.priceCcy !== c) setDraft(d => { const next = { ...d, priceCcy: c, minPrice: null, maxPrice: null }; onChange(next); return next; }); }}
                  className={`ow-tap px-3 py-1.5 text-[12px] font-black ${
                    draft.priceCcy === c ? "bg-ink text-paper dark:bg-white dark:text-ink" : "opacity-55"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* ── PER NIGHT OR PER MONTH ────────────────────────────────────────────────────
              The same shape as the currency toggle directly above, for the same reason: it sets
              the unit the two boxes are asking in. Switching it clears the numbers, because
              "2,000" meaning per month and then silently meaning per night is the same startling
              jump as an unconverted currency swap. Defaulted to per month on Lee's instruction. */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold opacity-55">
              {W(lang, "Priced per", "Precio por")}
            </span>
            <div className="flex overflow-hidden rounded-xl border border-ink/12 dark:border-white/15">
              {([["month", W(lang, "Month", "Mes")], ["night", W(lang, "Night", "Noche")]] as const).map(([id, label]) => (
                <button key={id} type="button"
                  onClick={() => { if (draft.period !== id) setDraft(d => { const next = { ...d, period: id as RentalPeriod, minPrice: null, maxPrice: null }; onChange(next); return next; }); }}
                  className={`ow-tap px-3 py-1.5 text-[12px] font-black ${
                    draft.period === id ? "bg-ink text-paper dark:bg-white dark:text-ink" : "opacity-55"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {draft.priceCcy === "COP" && !fx && (
            <p className="mb-2 text-[11.5px] font-semibold leading-snug text-amber-600 dark:text-amber-400">
              {W(lang,
                "Waiting for today's official rate — a peso range can't be applied until it loads.",
                "Esperando la TRM oficial de hoy — no se puede aplicar un rango en pesos hasta que cargue.")}
            </p>
          )}

          {/* ── THE SHAPE OF THE MARKET (Airbnb audit pattern five) ──────────────────────
                 Two empty boxes ask a question only somebody who already knows Medellín can
                 answer. A renter arriving from abroad either leaves both blank, so the filter did
                 nothing, or guesses — and the commonest guess returns an empty list, which reads
                 as "this platform has nothing". The chart answers the question before it is
                 asked. The boxes stay underneath for anybody who does know their number. */}
          {histPrices.length >= 4 && (
            <div className="mb-3">
              <PriceHistogram
                prices={histPrices}
                min={draft.minPrice} max={draft.maxPrice}
                money={drawMoney}
                caption={W(lang, "What places actually cost here", "Lo que cuestan los inmuebles aquí")}
                onChange={(lo, hi) => setDraft(d => {
                  const next = { ...d, minPrice: lo, maxPrice: hi };
                  onChange(next); return next;
                })} />
            </div>
          )}

          <Row>
            <Field label={W(lang, "No min", "Sin mínimo")}>
              <MoneyInput currency={draft.priceCcy}
                value={draft.minPrice == null ? "" : String(draft.minPrice)}
                onChange={v => set("minPrice", v ? Number(moneyDigits(v, draft.priceCcy)) : null)}
                ariaLabel={W(lang, "Minimum price", "Precio mínimo")} />
            </Field>
            <Field label={W(lang, "No max", "Sin máximo")}>
              <MoneyInput currency={draft.priceCcy}
                value={draft.maxPrice == null ? "" : String(draft.maxPrice)}
                onChange={v => set("maxPrice", v ? Number(moneyDigits(v, draft.priceCcy)) : null)}
                ariaLabel={W(lang, "Maximum price", "Precio máximo")} />
            </Field>
          </Row>
        </Group>

        {/* ── SIZE AND ROOMS ───────────────────────────────────────────────────────────── */}
        <Group defaultOpen title={W(lang, "Size & rooms", "Tamaño y habitaciones")}
          count={[draft.minGuests, draft.minBeds, draft.minBaths, draft.minArea, draft.minParking, draft.minFloor]
            .filter(v => v != null).length + (draft.types.length ? 1 : 0)}>
          {/* Minimums, not exact matches. Lee: "only three bedrooms or greater." */}
          {/* Guests first — it is the question that gets asked before bedrooms. */}
          {/* ── v72 · WHEN ────────────────────────────────────────────────────────────────
              ⚠️ The note is not decoration. This filter matches on when a place becomes free and
              on its minimum stay; it cannot yet see a host's existing bookings. Saying so here is
              the difference between a guest blaming a host's calendar and blaming us. */}
          <Row>
            <Field label={W(lang, "Arrive on", "Llegada")}>
              <GlassDate value={draft.arriveOn ?? ""} onChange={v => set("arriveOn", v || null)} />
            </Field>
            <Field label={W(lang, "Leave on", "Salida")}>
              <GlassDate value={draft.departOn ?? ""} onChange={v => set("departOn", v || null)} />
            </Field>
          </Row>
          <p className="-mt-1 mb-2 text-[11.5px] leading-relaxed opacity-55">
            {W(lang,
              "Shows places free from your arrival date whose minimum stay fits. It cannot see a host's existing bookings yet, so confirm the dates with them.",
              "Muestra lugares libres desde su fecha de llegada cuya estadía mínima le sirva. Aún no ve las reservas del anfitrión, así que confirme las fechas con él.")}
          </p>

          <Row>
            <Field label={W(lang, "Sleeps at least", "Duermen al menos")}>
              <Stepper value={draft.minGuests} onChange={v => set("minGuests", v)} min={1} max={20} placeholder={W(lang, "Any", "Cualquiera")} />
            </Field>
            <Field label={W(lang, "Bedrooms (min)", "Habitaciones (mín.)")}>
              <Stepper value={draft.minBeds} onChange={v => set("minBeds", v)} min={0} max={8} placeholder={W(lang, "Any", "Todas")} />
            </Field>
            <Field label={W(lang, "Bathrooms (min)", "Baños (mín.)")}>
              <Stepper value={draft.minBaths} onChange={v => set("minBaths", v)} min={0} max={8} step={0.5} placeholder={W(lang, "Any", "Todos")} />
            </Field>
          </Row>

          <Row>
            <Field label={W(lang, "Parking (min)", "Parqueaderos (mín.)")}>
              <Stepper value={draft.minParking} onChange={v => set("minParking", v)} min={0} max={6} placeholder={W(lang, "Any", "Todos")} />
            </Field>
            <Field label={W(lang, "Floor (min)", "Piso (mín.)")}>
              <Stepper value={draft.minFloor} onChange={v => set("minFloor", v)} min={0} max={40} placeholder={W(lang, "Any", "Todos")} />
            </Field>
          </Row>

          <Field label={W(lang, "Size (min m²)", "Área (mín. m²)")}>
            <input className="input h-11 w-full" inputMode="numeric" placeholder={W(lang, "Any", "Cualquiera")}
              value={draft.minArea ?? ""} onChange={e => set("minArea", e.target.value ? Number(e.target.value) : null)} />
          </Field>

          <Field label={W(lang, "Type of place", "Tipo de inmueble")}>
            <MultiChips values={draft.types} onChange={v => set("types", v as PropertyType[])}
              options={propertyTypes(lang).map(o => ({ value: o.value, label: o.label }))} />
          </Field>
        </Group>

        {/* ── THE BEDROOM AND BATH ─────────────────────────────────────────────────────── */}
        <Group title={W(lang, "Bedroom & bath", "Alcoba y baño")}
          count={[!!draft.masterBed, draft.walkInCloset, draft.dualVanities, draft.acInMaster].filter(Boolean).length}>
          <Field label={W(lang, "Master bed", "Cama principal")}>
            <ChoiceChips value={draft.masterBed} onChange={v => set("masterBed", v)}
              options={masterBeds(lang)} allowClear />
          </Field>
          <Toggle on={draft.acInMaster} onChange={v => set("acInMaster", v)}
            label={W(lang, "Air conditioning in the master", "Aire acondicionado en la principal")} />
          <Toggle on={draft.walkInCloset} onChange={v => set("walkInCloset", v)}
            label={W(lang, "Walk-in closet", "Vestier")} />
          <Toggle on={draft.dualVanities} onChange={v => set("dualVanities", v)}
            label={W(lang, "Two sinks", "Dos lavamanos")} />
        </Group>

        {/* ── INSIDE ───────────────────────────────────────────────────────────────────── */}
        <Group title={W(lang, "Inside", "Interior")}
          count={[draft.furnishedOnly, !!draft.laundry, draft.minAcUnits != null].filter(Boolean).length}>
          <Toggle on={draft.furnishedOnly} onChange={v => set("furnishedOnly", v)}
            label={W(lang, "Furnished only", "Solo amoblados")} />
          <Field label={W(lang, "Laundry", "Lavandería")}>
            <ChoiceChips value={draft.laundry} onChange={v => set("laundry", v)}
              options={laundryOptions(lang)} allowClear />
          </Field>
          <Field label={W(lang, "Air conditioning units (min)", "Unidades de aire (mín.)")}>
            <Stepper value={draft.minAcUnits} onChange={v => set("minAcUnits", v)} min={0} max={8}
              placeholder={W(lang, "Any", "Cualquiera")} />
          </Field>
        </Group>

        {/* ── OUTSIDE AND THE BUILDING ─────────────────────────────────────────────────── */}
        <Group title={W(lang, "Outside & the building", "Exterior y el edificio")}
          count={(draft.outside.length ? 1 : 0) + (draft.amenityKeys.length ? 1 : 0)
            + (draft.estratos.length ? 1 : 0) + (draft.maxAge != null ? 1 : 0)
            + (draft.penthouseOnly ? 1 : 0) + (draft.openViewOnly ? 1 : 0)}>
          <Field label={W(lang, "Outdoor space", "Espacio exterior")}>
            <MultiChips values={draft.outside} onChange={v => set("outside", v as string[])}
              options={[
                { value: "balcony",  label: W(lang, "Balcony", "Balcón") },
                { value: "patio",    label: W(lang, "Patio", "Patio") },
                { value: "backyard", label: W(lang, "Backyard", "Jardín") },
                { value: "grill",    label: W(lang, "Grill", "Asador") },
              ]} />
          </Field>

          <Field label={W(lang, "Must have", "Debe tener")}>
            <MultiChips values={draft.amenityKeys} onChange={v => set("amenityKeys", v as AmenityKey[])}
              options={amenities(lang)} />
          </Field>

          {/* Estrato is a MULTI-select, not a minimum. It is a utility-tariff band, not a quality
              score — somebody looking for estrato 4 is not looking for "4 or better", they are
              looking for the bill that comes with a 4. */}
          <Field label={W(lang, "Estrato", "Estrato")}>
            <MultiChips values={draft.estratos.map(String)}
              onChange={v => set("estratos", (v as string[]).map(Number))}
              options={[1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: String(n) }))} cols={3} />
          </Field>

          <Field label={W(lang, "Building age (max years)", "Antigüedad del edificio (máx. años)")}>
            <input className="input h-11 w-full" inputMode="numeric" placeholder={W(lang, "Any", "Cualquiera")}
              value={draft.maxAge ?? ""} onChange={e => set("maxAge", e.target.value ? Number(e.target.value) : null)} />
          </Field>

          <Toggle on={draft.penthouseOnly} onChange={v => set("penthouseOnly", v)}
            label={W(lang, "Penthouse only", "Solo penthouse")} />
          <Toggle on={draft.openViewOnly} onChange={v => set("openViewOnly", v)}
            label={W(lang, "Unobstructed view only", "Solo vista despejada")} />
        </Group>

        {/* ── SAFETY, PETS, SCHOOLS ────────────────────────────────────────────────────── */}
        <Group title={W(lang, "Safety, pets & schools", "Seguridad, mascotas y colegios")}
          count={[!!draft.security, !!draft.pets, draft.schoolsOnly].filter(Boolean).length}>
          <Field label={W(lang, "Security", "Seguridad")}>
            <ChoiceChips value={draft.security} onChange={v => set("security", v)}
              options={securityLevels(lang)} allowClear />
          </Field>
          <Field label={W(lang, "Pets", "Mascotas")}>
            <ChoiceChips value={draft.pets} onChange={v => set("pets", v)} options={petsOptions(lang)} allowClear />
          </Field>
          <Toggle on={draft.schoolsOnly} onChange={v => set("schoolsOnly", v)}
            label={W(lang, "Near schools", "Cerca de colegios")} />
        </Group>

        {/* THE COUNT, BEFORE YOU COMMIT. Zillow's best idea in this sheet. */}
        <div className="sticky bottom-0 -mx-4 mt-4 border-t border-ink/[0.07] px-4 pb-1 pt-3 backdrop-blur-xl dark:border-white/10"
          style={{ background: "var(--overlay-bg)" }}>
          <button onClick={onClose}
            className={`btn-primary w-full ${resultCount === 0 ? "opacity-70" : ""}`}>
            {resultCount === 0
              ? W(lang, "No places match — loosen a filter", "Ningún inmueble coincide — afloje un filtro")
              : W(lang, `Show ${resultCount} ${resultCount === 1 ? "place" : "places"}`,
                        `Ver ${resultCount} ${resultCount === 1 ? "inmueble" : "inmuebles"}`)}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export { Chevron };

/* ════════════════════════════════════════════════════════════════════════════════════════════
   THE THREE LAYOUTS — moved here 15 Aug 2026 so both feeds share ONE definition.
   ════════════════════════════════════════════════════════════════════════════════════════════
   Lee: *"the listing style for for-sale and for-rent should be identical. Remember? So we should
   have the same sort and mapping and view capabilities that we have on the rent side — that whole
   list of items right at the top. List, map, sort, filter, view. For sale, you only got filter and
   sort. What about the rest? Remember, they're twins."*

   These lived as module-local constants in the rent feed, which is exactly why the sale feed never
   got them: there was nothing to import. The note two hundred lines above this one — *"flagged for
   Max rather than done here"* — has now been outstanding through four versions while the two feeds
   drifted, so it is done. `ControlRow` already accepted `layouts`; only the artwork was private.

   An icon that shows the SHAPE of the result is understood without a label, which is what lets
   three options live in the width one word would need. Drawn, never emoji, never a letter.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

export type LayoutId = "big" | "grid" | "row";

export const LAYOUTS: { id: LayoutId; en: string; es: string }[] = [
  { id: "big",  en: "Large cards",  es: "Tarjetas grandes" },
  { id: "grid", en: "Two per row",  es: "Dos por fila" },
  { id: "row",  en: "Compact list", es: "Lista compacta" },
];

export function LayoutGlyph({ id }: { id: LayoutId }) {
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

/** Ready for `ControlRow`'s `layouts` prop — one call, so neither feed hand-assembles it. */
export const layoutOptions = () =>
  LAYOUTS.map(o => ({ ...o, glyph: <LayoutGlyph id={o.id} /> }));
