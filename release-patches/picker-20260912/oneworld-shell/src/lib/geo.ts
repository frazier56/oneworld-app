import { loadGoogleMaps } from "./places";

/**
 * TURNING AN ADDRESS INTO A MAP PIN, WITHOUT GIVING THE ADDRESS AWAY.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"where the property is is a huge, huge, huge thing."*
 *
 * He is right, and it is also the thing most likely to break a promise the listing form makes in
 * writing: *"Private. Only the neighbourhood is shown publicly — the exact address goes to the
 * tenant once a contract exists."*
 *
 * A pin dropped on the geocoded address breaks that promise for every listing, more thoroughly
 * than printing the address would: the pin IS the address, at better precision than the text
 * field, and reverse-geocoding it is one call. Zillow, Idealista and Rightmove all solved this the
 * same way — an approximate marker for anything not published exactly — and so does this.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────────────────────
 * When the agent has NOT made the address public, the true coordinate is offset here, in the
 * browser, BEFORE it is ever sent. The database never receives it. That is deliberately stronger
 * than storing it behind a policy: a column that does not hold the secret cannot leak it through a
 * future join, a view, a CSV export, or an RLS policy somebody widens by accident in a year.
 *
 * ── WHY THE OFFSET IS DETERMINISTIC ─────────────────────────────────────────────────────────
 * A random offset re-rolled on every save is worse than none. Save the listing five times and you
 * publish five points scattered around the true one; their centroid IS the address, and the
 * scatter tells an observer the radius to look in. Seeding the offset from the listing's own id
 * means the same listing always lands on the same false point — one point, no centroid, nothing to
 * average away.
 *
 * ~250m is chosen to be larger than a city block in El Poblado and smaller than a barrio, so the
 * map still answers "is this near the metro, is this up the hill" — which is the question — while
 * refusing to answer "which building".
 */

const APPROX_METRES = 250;
const GEOCODE_TIMEOUT_MS = 8_000;

/** Degrees of latitude per metre. Constant everywhere. */
const DEG_PER_M_LAT = 1 / 111_320;

export type GeoPoint = { lat: number; lng: number };

/**
 * A stable pseudo-random pair in [0,1) derived from a string. FNV-1a, then two different
 * multipliers — the same seed must give the same offset on every device and every save, which
 * rules out `Math.random()` entirely.
 */
function seeded(seed: string): [number, number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const a = ((h >>> 0) % 100_000) / 100_000;
  const b = ((Math.imul(h, 0x27220a95) >>> 0) % 100_000) / 100_000;
  return [a, b];
}

/**
 * Move a point to a stable false position within ~250m.
 *
 * The offset is drawn on a disc rather than a square (`sqrt` on the radius), so the false points
 * of many listings are evenly spread rather than clustering toward the corners — a square offset
 * leaves a visible grid artefact once there are a few hundred pins on one screen.
 */
export function approximate(point: GeoPoint, seed: string): GeoPoint {
  const [u, v] = seeded(seed);
  const r = APPROX_METRES * Math.sqrt(u);
  const theta = 2 * Math.PI * v;
  const dLat = (r * Math.cos(theta)) * DEG_PER_M_LAT;
  /* Longitude degrees shrink with latitude. At Medellín's 6.2°N the cosine is ~0.994, so ignoring
     it would be a rounding error — but this runs anywhere, and at 60° it would be a 2× error. */
  const dLng = (r * Math.sin(theta)) * DEG_PER_M_LAT / Math.cos((point.lat * Math.PI) / 180);
  return { lat: point.lat + dLat, lng: point.lng + dLng };
}

/**
 * Address (or neighbourhood, or city) → coordinates, via Google's geocoder.
 *
 * Returns null on any failure, and NULL IS FINE: a listing with no coordinates simply does not
 * appear on the map and is completely normal everywhere else. Geocoding must never be able to
 * block publishing — an agent whose building confuses the geocoder still has a listing.
 */
export async function geocode(query: string): Promise<GeoPoint | null> {
  const q = (query || "").trim();
  if (q.length < 4) return null;
  try {
    const g = await loadGoogleMaps();
    const geocoder = new g.maps.Geocoder();
    const res: any = await new Promise(resolve => {
      let finished = false;
      const finish = (value: unknown) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        resolve(value);
      };
      /* Google occasionally loads its script but never invokes the geocoder callback. A map pin
         is optional; publishing is not. Fall back to no point instead of leaving Save/Publish
         spinning forever. */
      const timeout = window.setTimeout(() => finish(null), GEOCODE_TIMEOUT_MS);
      geocoder.geocode(
        { address: q, componentRestrictions: { country: "co" } },
        (r: any[], status: string) => finish(status === "OK" && r?.length ? r[0] : null));
    });
    const loc = res?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat(), lng: loc.lng() };
  } catch {
    return null;
  }
}

/**
 * The whole job in one call: geocode, then blur if the address is not public.
 *
 * `seed` should be something stable and specific to the listing — its id once saved, or the
 * address text before it has one. Two listings in the same building must not share a seed, or
 * they land on the same false point and look like a duplicate.
 */
export async function displayPointFor(
  { address, neighbourhood, city, addressIsPublic, seed }:
  { address?: string | null; neighbourhood?: string | null; city?: string | null;
    addressIsPublic: boolean; seed: string },
): Promise<{ lat: number; lng: number; precision: "exact" | "approximate" } | null> {
  /* Best available string, in descending specificity. A listing with only a barrio still earns a
     pin — a barrio-level point is honest and useful, and it is what most Medellín listings on
     other portals amount to anyway. */
  const parts = [address, neighbourhood, city, "Colombia"].filter(Boolean) as string[];
  const target = parts.join(", ");
  const point = await geocode(target);
  if (!point) return null;

  /* Only a published address may be shown exactly. The database enforces this again on write —
     see `enforce_geo_precision` — because this promise must not depend on the client. */
  if (addressIsPublic && address && address.trim().length > 5) {
    return { ...point, precision: "exact" };
  }
  return { ...approximate(point, seed), precision: "approximate" };
}
