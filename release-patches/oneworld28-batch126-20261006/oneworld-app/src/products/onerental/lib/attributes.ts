import { W } from "@oneworld/shell";

/**
 * THE LISTING ATTRIBUTES — one vocabulary, shared by the rent form, the sale form, the detail
 * screen, the feed card and every future filter.
 * ============================================================================================
 * Lee dictated this set on 11 Aug 2026, from the things he has personally been unable to find out
 * about a place before signing for it:
 *
 *   "You never know if it's a king bed or a queen bed in the master. You never know if there's a
 *    backyard, a patio, a grill, or a separate washer and dryer… these are things that are lacking
 *    for most listings."
 *
 * WHY THIS IS A FILE AND NOT INLINE OPTIONS. The same list has to appear in at least four places —
 * the form that captures it, the preview, the public detail screen and the search filter that has
 * not been built yet. Four hand-typed copies of "in-unit, two separate machines" is four chances
 * for one of them to say something slightly different, and the value stored in the database is the
 * key, not the label, so a drifted label is invisible until somebody reads a listing and finds a
 * word nobody uses.
 *
 * Every key here matches a CHECK constraint applied in `onehome_listing_attributes_v1`. Adding an
 * option means adding it in BOTH places, and the constraint is what will tell you if you forget.
 */

export type PropertyType =
  | "apartment" | "highrise" | "house" | "townhouse" | "studio" | "loft" | "country" | "commercial" | "land";
export type MasterBed = "king" | "queen" | "full" | "twin" | "none";
export type Laundry = "in_unit_separate" | "in_unit_combo" | "shared" | "none";
export type SecurityLevel = "full_24h" | "part_time" | "gated" | "none";
export type PetsAllowed = "both" | "cats" | "dogs" | "negotiable" | "no";
export type DepositBasis = "amount" | "months";

type Opt<T extends string> = { value: T; label: string; note?: string };

/** Ordered most-common first, because the first chip is the one most people are looking for. */
export const propertyTypes = (lang: string): Opt<PropertyType>[] => [
  { value: "apartment",  label: W(lang, "Apartment", "Apartamento") },
  { value: "highrise",   label: W(lang, "High-rise", "Torre"), note: W(lang, "Tower building", "Edificio de torre") },
  { value: "house",      label: W(lang, "House", "Casa") },
  { value: "townhouse",  label: W(lang, "Townhouse", "Casa adosada") },
  { value: "studio",     label: W(lang, "Studio", "Apartaestudio") },
  { value: "loft",       label: W(lang, "Loft", "Loft") },
  { value: "country",    label: W(lang, "Country house", "Finca") },
  { value: "commercial", label: W(lang, "Commercial", "Comercial") },
];

export const masterBeds = (lang: string): Opt<MasterBed>[] => [
  { value: "king",  label: W(lang, "King", "King") },
  { value: "queen", label: W(lang, "Queen", "Queen") },
  { value: "full",  label: W(lang, "Double", "Doble") },
  { value: "twin",  label: W(lang, "Single", "Sencilla") },
  { value: "none",  label: W(lang, "No bed", "Sin cama"), note: W(lang, "Unfurnished", "Sin amoblar") },
];

/**
 * LAUNDRY. Lee called this one out by name, twice, and he is right that it is the attribute most
 * listings get wrong: *"washer and dryer needs to be separate items, like separate units… it
 * needs to say single unit or separate units, because sometimes the washer and dryer is one unit."*
 *
 * A combo machine washes and dries in one drum, takes about three hours per load, and is the
 * default in most Medellín apartments. Somebody with a family who reads "washer/dryer" and finds a
 * combo has been genuinely misled, so the two are separate options rather than one tick.
 */
export const laundryOptions = (lang: string): Opt<Laundry>[] => [
  /* Lee, 11 Aug 2026: *"Washer plus dryer, that should say washer plus SEPARATE dryer. You should
     use the word separate."* He is right, and the note underneath was doing the work the label
     should have been doing — somebody scanning a dropdown reads labels, not notes. */
  { value: "in_unit_separate", label: W(lang, "Washer + separate dryer unit", "Lavadora + secadora aparte"),
    note: W(lang, "Two separate machines", "Dos máquinas separadas") },
  { value: "in_unit_combo",    label: W(lang, "Washer-dryer combo unit", "Lavasecadora (unidad combinada)"),
    note: W(lang, "One machine, both jobs", "Una máquina, ambas funciones") },
  { value: "shared",           label: W(lang, "In the building", "En el edificio"),
    note: W(lang, "Shared laundry", "Lavandería compartida") },
  { value: "none",             label: W(lang, "None", "Ninguna") },
];

/** Lee: *"is it 24-hour security, or partial security, or part-time security?"* Three real answers. */
export const securityLevels = (lang: string): Opt<SecurityLevel>[] => [
  { value: "full_24h",  label: W(lang, "24-hour", "24 horas"),
    note: W(lang, "Someone is always there", "Siempre hay alguien") },
  { value: "part_time", label: W(lang, "Part-time", "Por horas"),
    note: W(lang, "Nights or weekends", "Noches o fines de semana") },
  { value: "gated",     label: W(lang, "Gated only", "Solo portería"),
    note: W(lang, "Controlled entry, no guard", "Entrada controlada, sin guarda") },
  { value: "none",      label: W(lang, "None", "Ninguna") },
];

export const petsOptions = (lang: string): Opt<PetsAllowed>[] => [
  { value: "both",       label: W(lang, "Cats & dogs", "Gatos y perros") },
  { value: "cats",       label: W(lang, "Cats only", "Solo gatos") },
  { value: "dogs",       label: W(lang, "Dogs only", "Solo perros") },
  { value: "negotiable", label: W(lang, "Ask me", "Consultar") },
  { value: "no",         label: W(lang, "No pets", "Sin mascotas") },
];

/**
 * BUILDING AMENITIES — an array column, not fifteen booleans.
 *
 * A new amenity is a new string here, and nothing else: no migration, no form edit, no detail-screen
 * edit. That matters because this is exactly the list that grows every time an agent asks for one
 * more thing, and fifteen booleans would make each of those a database change.
 */
export const AMENITY_KEYS = [
  "pool", "gym", "elevator", "doorman", "parking_visitor", "rooftop", "bbq_area",
  "coworking", "playground", "sauna", "jacuzzi", "pet_area", "generator", "water_tank",
] as const;
export type AmenityKey = (typeof AMENITY_KEYS)[number];

export const amenities = (lang: string): Opt<AmenityKey>[] => [
  { value: "pool",            label: W(lang, "Pool", "Piscina") },
  { value: "gym",             label: W(lang, "Gym", "Gimnasio") },
  { value: "elevator",        label: W(lang, "Elevator", "Ascensor") },
  { value: "doorman",         label: W(lang, "Doorman", "Portería") },
  { value: "parking_visitor", label: W(lang, "Visitor parking", "Parqueadero visitantes") },
  { value: "rooftop",         label: W(lang, "Rooftop terrace", "Terraza") },
  { value: "bbq_area",        label: W(lang, "BBQ area", "Zona BBQ") },
  { value: "coworking",       label: W(lang, "Coworking", "Coworking") },
  { value: "playground",      label: W(lang, "Playground", "Zona infantil") },
  { value: "sauna",           label: W(lang, "Sauna", "Sauna") },
  { value: "jacuzzi",         label: W(lang, "Jacuzzi", "Jacuzzi") },
  { value: "pet_area",        label: W(lang, "Pet area", "Zona de mascotas") },
  { value: "generator",       label: W(lang, "Backup power", "Planta eléctrica") },
  { value: "water_tank",      label: W(lang, "Water tank", "Tanque de agua") },
];

/** Look a key up for display. Falls back to the key itself rather than rendering nothing — a
 *  listing that quietly loses an amenity is worse than one showing a word we forgot to translate. */
export function labelFor<T extends string>(opts: Opt<T>[], value: T | null | undefined): string | null {
  if (!value) return null;
  return opts.find(o => o.value === value)?.label ?? String(value);
}
