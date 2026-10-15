/**
 * ADDRESS CHECK — does this address really sit in this city and this country? (overlay 48, 6 Oct 2026)
 * ============================================================================================
 * Lee, on OneHome's "Where it is": *"you can have a street that's in Decatur, Georgia and then the
 * city be Medellín and then the country be Spain… that would never map properly… don't let them
 * click next and think that somehow they can get away with that."*
 *
 * Two pieces, both on Google's own address components (never parsed display text):
 *  · `placeDetails()` — the structured parts of a picked place: country, state, city, neighbourhood.
 *  · `checkAddress()` — for an address TYPED by hand: geocode it inside the chosen country and say
 *    whether it was found, and in which city.
 * Pure comparison helpers are exported for the unit tests.
 */
import { loadGoogleMaps } from "./places";

export type PlaceDetails = {
  country: string;        // ISO-2, upper-case ("" when Google gave none)
  countryName: string;
  region: string;         // state / department
  city: string;
  neighbourhood: string;
  /** True when the place is a real street address or building, not a city or a region. */
  precise: boolean;
};

type Comp = { long_name?: string; short_name?: string; types?: string[] };

const first = (comps: Comp[], ...types: string[]) => {
  for (const t of types) {
    const c = comps.find(x => x.types?.includes(t));
    if (c?.long_name) return c;
  }
  return null;
};

/** Google's address components → the five things a listing stores. */
export function detailsFromComponents(comps: Comp[], resultTypes: string[] = []): PlaceDetails {
  const country = first(comps, "country");
  const city = first(comps, "locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2");
  const PRECISE = ["street_address", "premise", "subpremise", "route", "street_number", "establishment", "point_of_interest", "intersection"];
  return {
    country: String(country?.short_name ?? "").toUpperCase(),
    countryName: String(country?.long_name ?? ""),
    region: String(first(comps, "administrative_area_level_1")?.long_name ?? ""),
    city: String(city?.long_name ?? ""),
    neighbourhood: String(first(comps, "neighborhood", "sublocality_level_1", "sublocality", "colloquial_area")?.long_name ?? ""),
    precise: resultTypes.some(t => PRECISE.includes(t)) || comps.some(c => c.types?.some(t => t === "route" || t === "street_number" || t === "premise")),
  };
}

/** "Medellín" = "medellin" = "Medellin, Antioquia". Accents, case and a trailing region never decide. */
export function samePlaceName(a?: string | null, b?: string | null): boolean {
  const n = (s?: string | null) => String(s ?? "").split(",")[0]
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/^(city of|ciudad de|municipio de|distrito de)\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  const x = n(a), y = n(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

/** The structured parts of a place someone picked from the suggestions. */
export async function placeDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const g = await loadGoogleMaps();
    return await new Promise(resolve => new g.maps.Geocoder().geocode({ placeId }, (res: any[], status: string) => {
      const r = status === "OK" ? res?.[0] : null;
      resolve(r ? detailsFromComponents(r.address_components ?? [], r.types ?? []) : null);
    }));
  } catch { return null; }
}

export type AddressVerdict =
  | { status: "ok"; details: PlaceDetails }
  | { status: "other_city"; details: PlaceDetails }     // found, but in a different city
  | { status: "not_found" }                             // Google cannot place it in that country
  | { status: "unavailable" };                          // Google did not answer — never block on this

/** Judge one geocoder answer against what the form says. Pure, so it is unit-tested. */
export function judge(results: { address_components?: Comp[]; types?: string[]; partial_match?: boolean }[] | null, city: string, country: string): AddressVerdict {
  const r = results?.[0];
  if (!r) return { status: "not_found" };
  const d = detailsFromComponents(r.address_components ?? [], r.types ?? []);
  if (!d.precise || (country && d.country && d.country !== country.toUpperCase())) return { status: "not_found" };
  if (city && d.city && !samePlaceName(d.city, city)) return { status: "other_city", details: d };
  return { status: "ok", details: d };
}

/** An address typed by hand: is it findable inside the chosen country, and in which city? */
export async function checkAddress(address: string, city: string, country: string): Promise<AddressVerdict> {
  if (!address.trim() || !country) return { status: "unavailable" };
  try {
    const g = await loadGoogleMaps();
    return await new Promise<AddressVerdict>(resolve => {
      const t = setTimeout(() => resolve({ status: "unavailable" }), 6000);
      new g.maps.Geocoder().geocode(
        { address: [address, city].filter(Boolean).join(", "), componentRestrictions: { country } },
        (res: any[], status: string) => {
          clearTimeout(t);
          if (status === "ZERO_RESULTS") return resolve({ status: "not_found" });
          if (status !== "OK") return resolve({ status: "unavailable" });
          resolve(judge(res, city, country));
        });
    });
  } catch { return { status: "unavailable" }; }
}

/** Judge a city lookup: found only when Google returns a PLACE with that name inside the country. */
export function judgeCity(results: { address_components?: Comp[]; types?: string[] }[] | null, city: string, country: string): boolean {
  const r = results?.[0];
  if (!r) return false;
  const d = detailsFromComponents(r.address_components ?? [], r.types ?? []);
  if (country && d.country && d.country !== country.toUpperCase()) return false;
  const isPlace = (r.types ?? []).some(t => ["locality", "postal_town", "administrative_area_level_2", "administrative_area_level_3", "sublocality", "neighborhood", "colloquial_area"].includes(t));
  return isPlace && (samePlaceName(d.city, city) || (r.address_components ?? []).some(c => samePlaceName(c.long_name, city)));
}

/** A city TYPED by hand (not picked): does a place by that name exist in the chosen country?
 *  true / false, or null when Google did not answer (never block on that). */
export async function checkCity(city: string, country: string): Promise<boolean | null> {
  if (!city.trim() || !country) return null;
  try {
    const g = await loadGoogleMaps();
    return await new Promise<boolean | null>(resolve => {
      const t = setTimeout(() => resolve(null), 6000);
      new g.maps.Geocoder().geocode({ address: city, componentRestrictions: { country } }, (res: any[], status: string) => {
        clearTimeout(t);
        if (status === "ZERO_RESULTS") return resolve(false);
        if (status !== "OK") return resolve(null);
        resolve(judgeCity(res, city, country));
      });
    });
  } catch { return null; }
}
