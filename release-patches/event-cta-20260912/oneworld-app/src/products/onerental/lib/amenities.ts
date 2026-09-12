import { W } from "@oneworld/shell";
import type { Property } from "./rental";

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
  { key: "furnished", group: "space",
    read: p => bool(p.furnished),
    label: (_p, l) => W(l, "Furnished", "Amoblado") },
  { key: "parking", group: "space",
    read: p => num(p.parking_spaces),
    label: (p, l) => p.parking_spaces && p.parking_spaces > 1
      ? W(l, `${p.parking_spaces} parking spaces`, `${p.parking_spaces} parqueaderos`)
      : W(l, "Parking", "Parqueadero") },
  { key: "master_bed", group: "space",
    read: p => text(p.master_bed),
    label: (p, l) => W(l, `Master bed: ${p.master_bed}`, `Cama principal: ${p.master_bed}`) },
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
    label: (p, l) => W(l, `Laundry: ${p.laundry}`, `Lavandería: ${p.laundry}`) },
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
    label: (p, l) => W(l, `Security: ${p.security_level}`, `Seguridad: ${p.security_level}`) },
  { key: "schools", group: "building",
    read: p => bool(p.schools_nearby),
    label: (p, l) => p.school_zone
      ? W(l, `Schools nearby · ${p.school_zone}`, `Colegios cerca · ${p.school_zone}`)
      : W(l, "Schools nearby", "Colegios cerca") },

  /* ── rules ─────────────────────────────────────────────────────────────────────────────── */
  { key: "pets", group: "rules",
    read: p => text(p.pets_allowed),
    label: (p, l) => W(l, `Pets: ${p.pets_allowed}`, `Mascotas: ${p.pets_allowed}`) },
];

export const GROUP_TITLE = (g: Amenity["group"], lang: string) => ({
  space:    W(lang, "The space", "El espacio"),
  inside:   W(lang, "Inside", "Adentro"),
  outside:  W(lang, "Outside", "Afuera"),
  building: W(lang, "The building and around it", "El edificio y su entorno"),
  rules:    W(lang, "House rules", "Reglas de la casa"),
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
export function amenityRows(p: Property, lang: string) {
  const out: { key: string; text: string; has: boolean; group: Amenity["group"] }[] = [];
  for (const a of AMENITIES) {
    const r = amenityLabel(a, p, lang);
    if (r) out.push({ key: a.key, text: r.text, has: r.has, group: a.group });
  }
  return out.sort((x, y) => Number(y.has) - Number(x.has));
}
