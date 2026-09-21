import { W } from "@oneworld/shell";
import { D, counted, GUESTS, BEDROOMS, BATHROOMS } from "./detailCopy";
import type { Property } from "./rental";
/* ⚠️ THE DATABASE'S WORDS ARE NOT THE PRODUCT'S WORDS — Max, 12 Sep 2026, from a LIVE audit
   of production. Four of these labels interpolated the raw enum straight into the page, so a
   Colombian tenant read "Lavandería: shared", "Seguridad: part_time" and "Cama principal:
   queen" on a Spanish listing. The translated lists already existed in `attributes.ts` and are
   what the listing FORM offers — the detail screen simply never used them, so the form and the
   page it produces disagreed about what the same value is called.

   `labelFor` falls back to the raw value rather than rendering nothing, which is the right
   trade for an unknown key and is also why this was invisible: an untranslated word looks
   like a translation nobody got to yet, not like a bug. */
import { masterBeds, laundryOptions, securityLevels, petsOptions, labelFor } from "./attributes";

/**
 * WHAT THIS PLACE HAS — and, deliberately, what it does not.
 * ============================================================================================
 * Airbnb audit finding A4, 14 Aug 2026: **OneHome filters on twenty-six attributes and displays
 * none of them.** A renter could narrow a search to places with air conditioning in the master
 * bedroom, open one, and find no mention of air conditioning anywhere on the page. The data was
 * there the whole time; nothing rendered it.
 *
 * ── WHY MISSING THINGS ARE SHOWN, STRUCK THROUGH ────────────────────────────────────────────
 * Airbnb lists an amenity a place does NOT have and draws a line through it — "Carbon monoxide
 * alarm", struck out. It looks odd for about two seconds and then it is obviously right:
 *
 *   · **Silence is ambiguous.** A missing row could mean "no balcony" or "the host did not fill
 *     that in", and those are very different facts to somebody deciding where to sleep.
 *   · **For safety items it is the honest thing to do.** A place with no smoke alarm should say
 *     so, not decline to mention alarms.
 *
 * So there are three states here, not two: **has it**, **explicitly does not have it**, and
 * **never answered** — and only the first two are drawn. A `null` is a question the host skipped
 * and we do not put words in their mouth.
 *
 * ── THE LOCAL ONES ARE THE POINT ────────────────────────────────────────────────────────────
 * Estrato, the floor, security, the school zone. Airbnb has no concept of any of them and they
 * are what a Medellín renter actually decides on. They lead, and the universal ones follow.
 */

export type AmenityState = "yes" | "no" | "unknown";

export type Amenity = {
  key: string;
  /** which of the property's own columns answers this */
  read: (p: Property) => AmenityState;
  /** what it says when it is present — some carry a number */
  label: (p: Property, lang: string) => string;
  /** grouped the way somebody reads a home, not the way the table is laid out */
  group: "space" | "inside" | "outside" | "building" | "rules";
};

const bool = (v: boolean | null | undefined): AmenityState =>
  v === true ? "yes" : v === false ? "no" : "unknown";

const num = (v: number | null | undefined): AmenityState =>
  v == null ? "unknown" : v > 0 ? "yes" : "no";

const text = (v: string | null | undefined): AmenityState =>
  v == null || v === "" ? "unknown" : v.toLowerCase() === "none" || v.toLowerCase() === "ninguno" ? "no" : "yes";

export const AMENITIES: Amenity[] = [
  /* ── the space ─────────────────────────────────────────────────────────────────────────── */
  /* ⛔ `furnished` USED TO LIVE HERE and now lives in `coreSpaceRows` below, because the
     listing's own size facts moved into this section on 18 Sep 2026 and one of them is whether
     the place comes furnished. Leaving it here as well printed it twice on the same screen —
     Lee: *"furnished, which you already duplicated."* It also reads better as a core fact: an
     amenity row can only say "Furnished" struck through, where the fact can just say
     "Unfurnished", which is what a reader is actually being told. */
  { key: "parking", group: "space",
    read: p => num(p.parking_spaces),
    label: (p, l) => p.parking_spaces && p.parking_spaces > 1
      ? W(l, `${p.parking_spaces} parking spaces`, `${p.parking_spaces} parqueaderos`)
      : W(l, "Parking", "Parqueadero") },
  { key: "master_bed", group: "space",
    read: p => text(p.master_bed),
    label: (p, l) => W(l, `Master bed: ${labelFor(masterBeds(l), p.master_bed)}`,
                         `Cama principal: ${labelFor(masterBeds(l), p.master_bed)}`) },
  { key: "walk_in_closet", group: "space",
    read: p => bool(p.walk_in_closet),
    label: (_p, l) => W(l, "Walk-in closet", "Vestier") },

  /* ── inside ────────────────────────────────────────────────────────────────────────────── */
  { key: "air_conditioning", group: "inside",
    read: p => num(p.air_conditioning_units),
    label: (p, l) => p.air_conditioning_units && p.air_conditioning_units > 1
      ? W(l, `Air conditioning · ${p.air_conditioning_units} units`, `Aire acondicionado · ${p.air_conditioning_units} unidades`)
      : W(l, "Air conditioning", "Aire acondicionado") },
  { key: "laundry", group: "inside",
    read: p => text(p.laundry),
    label: (p, l) => W(l, `Laundry: ${labelFor(laundryOptions(l), p.laundry)}`,
                         `Lavandería: ${labelFor(laundryOptions(l), p.laundry)}`) },
  { key: "dual_vanities", group: "inside",
    read: p => bool(p.dual_vanities),
    label: (_p, l) => W(l, "Two sinks in the bathroom", "Dos lavamanos en el baño") },

  /* ── outside ───────────────────────────────────────────────────────────────────────────── */
  { key: "balcony",  group: "outside", read: p => bool(p.has_balcony),
    label: (_p, l) => W(l, "Balcony", "Balcón") },
  { key: "patio",    group: "outside", read: p => bool(p.has_patio),
    label: (_p, l) => W(l, "Patio", "Patio") },
  { key: "backyard", group: "outside", read: p => bool(p.has_backyard),
    label: (_p, l) => W(l, "Garden", "Jardín") },
  { key: "grill",    group: "outside", read: p => bool(p.has_grill),
    label: (_p, l) => W(l, "Barbecue", "Asador") },

  /* ── the building — the local ones, and the reason somebody picks this over Airbnb ─────── */
  { key: "estrato", group: "building",
    read: p => (p.estrato == null ? "unknown" : "yes"),
    label: (p, l) => W(l, `Estrato ${p.estrato}`, `Estrato ${p.estrato}`) },
  { key: "floor", group: "building",
    read: p => (p.floor_number == null ? "unknown" : "yes"),
    label: (p, l) => p.floors_in_building
      ? W(l, `Floor ${p.floor_number} of ${p.floors_in_building}`, `Piso ${p.floor_number} de ${p.floors_in_building}`)
      : W(l, `Floor ${p.floor_number}`, `Piso ${p.floor_number}`) },
  { key: "security", group: "building",
    read: p => text(p.security_level),
    label: (p, l) => W(l, `Security: ${labelFor(securityLevels(l), p.security_level)}`,
                         `Seguridad: ${labelFor(securityLevels(l), p.security_level)}`) },
  { key: "schools", group: "building",
    read: p => bool(p.schools_nearby),
    label: (p, l) => p.school_zone
      ? W(l, `Schools nearby · ${p.school_zone}`, `Colegios cerca · ${p.school_zone}`)
      : W(l, "Schools nearby", "Colegios cerca") },

  /* ── rules ─────────────────────────────────────────────────────────────────────────────── */
  { key: "pets", group: "rules",
    read: p => text(p.pets_allowed),
    label: (p, l) => W(l, `Pets: ${labelFor(petsOptions(l), p.pets_allowed)}`,
                         `Mascotas: ${labelFor(petsOptions(l), p.pets_allowed)}`) },
];

/* MAX'S LOCALE ADDENDUM, 12 Sep 2026 — the amenity section headings were two-language, so a
   German reader got German chrome above five English headings. They are the reader's first
   orientation on the page, which makes them the worst place to fall back. */
export const GROUP_TITLE = (g: Amenity["group"], lang: string) => ({
  space:    D(lang, "grpSpace"),
  inside:   D(lang, "grpInside"),
  outside:  D(lang, "grpOutside"),
  building: D(lang, "grpBuilding"),
  rules:    D(lang, "grpRules"),
}[g]);

/** One row's text, or null when the host never answered and we have nothing honest to say. */
export function amenityLabel(a: Amenity, p: Property, lang: string) {
  const st = a.read(p);
  if (st === "unknown") return null;
  return { text: a.label(p, lang), has: st === "yes" };
}

/**
 * Everything answered, in reading order, with the "has it" rows first inside each group.
 * A page that opens with four struck-through rows reads as a complaint about the place.
 */
/* ── THE SIZE OF THE PLACE BELONGS TO "THE SPACE" ───────────────────────────────────────────
   Lee, 18 September 2026: *"the two guests, one bedroom, one bathroom, 54 square meters,
   furnished or unfurnished, and then the minimum stay — that's the space. All of that stuff
   belongs to the space. The top area is more like the reviews and the price. Otherwise what do
   you have The space for, if you ain't got nothing in there except for furnished?"*

   These were a row of pills under the price. They are facts about the SHAPE of the place, which
   is exactly what the section called "The space" is for, and putting them there does two things
   at once: it empties the head of the page down to the two questions somebody actually opens a
   listing with — is it any good, what does it cost — and it gives The space something to hold
   besides one word.

   Two that did NOT come with them:
     · "Rented by the month" — Lee: *"what type of metric is that? What else would you put?
       That's not how you categorize places. This is dumb."* He is right. Every listing is rented
       by some period, so the label divides nothing, and "30 nights minimum" already says it.
     · "Available from <date>" — a date that goes stale on its own and quietly misinforms.
       The minimum stay is the durable fact and it stays.

   Always true, never struck through: a number the host typed is not an amenity they lack. */
function coreSpaceRows(p: Property, lang: string) {
  const out: { key: string; text: string; has: boolean; group: Amenity["group"] }[] = [];
  const add = (key: string, text: string) => out.push({ key, text, has: true, group: "space" });

  if (p.max_guests != null) add("core_guests", counted(lang, p.max_guests, GUESTS));
  if (p.bedrooms != null) add("core_bedrooms", counted(lang, p.bedrooms, BEDROOMS));
  if (p.bathrooms != null) add("core_bathrooms", counted(lang, p.bathrooms, BATHROOMS));
  if (p.area_m2 != null) add("core_area", `${p.area_m2} m²`);
  add("core_furnished", p.furnished ? D(lang, "furnished") : D(lang, "unfurnished"));
  /* Beside furnished, which is where Lee asked for it — the two land next to each other in the
     two-column grid, so the shape of the place and the shape of the stay read as one pair. */
  if (p.min_term_days > 1) add("core_min", D(lang, "minStayShort", { d: String(p.min_term_days) }));
  return out;
}

export function amenityRows(p: Property, lang: string) {
  const out = coreSpaceRows(p, lang);
  for (const a of AMENITIES) {
    const r = amenityLabel(a, p, lang);
    if (r) out.push({ key: a.key, text: r.text, has: r.has, group: a.group });
  }
  return out.sort((x, y) => Number(y.has) - Number(x.has));
}
