/**
 * CORE FACTS — which "about the place" answers a listing must give, by property type and country.
 * ============================================================================================
 * Lee, 15 Oct 2026 (screenshot of the rent form): every core fact was tagged Optional, and an
 * unanswered field and a real 0 looked the same. Rule, for rent AND sale:
 *  - a core fact that APPLIES to this property must be answered — blank blocks the step;
 *  - 0 is a real answer only where it means something (parking, air conditioners: shown as "None");
 *  - a fact that does NOT apply to this type is not shown and not required (a house has no
 *    "floor the unit is on"; a lot has no building age) — never a fabricated default;
 *  - estrato only in Colombia, and only for homes.
 * Owner contracts, extra terms and templates stay optional — they are not core facts.
 */
export type CoreFact =
  | "beds" | "baths" | "area" | "buildingAge" | "floor" | "floors" | "parking" | "ac" | "sleeps" | "estrato";

/** Rent and sale use different type keys; both map here. */
const UNIT_IN_BUILDING = new Set(["apartment", "highrise", "studio", "loft", "office", "commercial"]);
const NO_BUILDING = new Set(["land", "lot"]);
const NOT_A_HOME = new Set(["commercial", "office", "land", "lot"]);

export function coreFactApplies(fact: CoreFact, type: string | null | undefined, country: string | null | undefined, form: "rent" | "sale"): boolean {
  const t = (type ?? "").toLowerCase();
  const c = (country ?? "").toUpperCase();
  switch (fact) {
    case "area": return true;
    case "beds": return !NOT_A_HOME.has(t);
    case "baths": return !NO_BUILDING.has(t);
    case "buildingAge":
    case "parking":
    case "ac":
    case "floors": return !NO_BUILDING.has(t);
    case "floor": return UNIT_IN_BUILDING.has(t);
    case "sleeps": return form === "rent" && !NOT_A_HOME.has(t);
    case "estrato": return c === "CO" && !NOT_A_HOME.has(t);
  }
}

/** "Total floors in building" for a unit; "Floors (levels)" for a house. */
export function floorsLabel(type: string | null | undefined, lang: string, W: (l: string, en: string, es: string) => string): string {
  return UNIT_IN_BUILDING.has((type ?? "").toLowerCase())
    ? W(lang, "Total floors in building", "Pisos totales del edificio")
    : W(lang, "Floors (levels)", "Niveles de la casa");
}
