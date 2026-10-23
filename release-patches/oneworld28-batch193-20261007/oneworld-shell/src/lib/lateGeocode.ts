import { displayPointFor } from "./geo";

/**
 * PUTTING LEGACY LISTINGS ON THE MAP, AT READ TIME.
 * ============================================================================================
 * Lee, 12 Aug 2026: *"This thing says nothing to map. How's it gonna say nothing to map, when
 * there's an actual listing? The listing has an address."*
 *
 * The map was telling the truth. His listing:
 *
 *     id            22fbd930-…
 *     title         "Beautiful first listing on OneHomeb🏡"
 *     city          Medellín
 *     address_line  "Contree las"
 *     display_lat   NULL
 *     display_lng   NULL
 *     created_at    2026-08-11 07:07 UTC
 *
 * Two things, and only one of them is a bug.
 *
 * 1. **It predates geocoding.** Coordinates are computed when a listing is SAVED, and that
 *    shipped later the same day. Every listing created before then has an address and no point,
 *    and always will, because nothing ever goes back for them. The map was correctly reporting
 *    that it had nothing with coordinates — which is useless to somebody looking at a listing
 *    that plainly has an address.
 *
 * 2. **The address was typed, not chosen.** "Contree las" is a fragment. Geocoding at save time
 *    assumed a Places selection; it has to cope with whatever somebody actually types.
 *
 * ── WHY THIS RUNS ON READ AND NOT AS A BACKFILL ─────────────────────────────────────────────
 * A migration cannot geocode: geocoding needs the Google JS client, which needs a browser, and
 * the browser-key referrer restriction means it will not answer a server anyway. Writing back
 * from the reader is also out — RLS says a person may only write their OWN listings, and the map
 * is mostly other people's.
 *
 * So the point is computed where it is needed and cached for the session. It costs one geocode
 * per legacy listing per session, it needs no migration, and it is self-limiting: everything
 * created from now on already has coordinates and never reaches this path at all.
 *
 * ── AND IT DEGRADES TO THE CITY, DELIBERATELY ───────────────────────────────────────────────
 * If the address will not resolve, the CITY does. A pin on Medellín is a worse answer than a pin
 * on the building and a much better one than the listing vanishing off the map — which is what
 * "nothing to map" was. It comes back marked `approximate`, so `ListingMap` draws it as the
 * dashed circle it already draws for blurred addresses rather than as a precise pin. The map
 * never claims to know more than it does.
 */

export type LatePoint = { lat: number; lng: number; precision: "exact" | "approximate" };

/* One geocode per listing per session. `null` is cached too — a listing whose address cannot be
   resolved must not be retried on every scroll. */
const cache = new Map<string, LatePoint | null>();
const inflight = new Map<string, Promise<LatePoint | null>>();

export async function lateGeocode(row: {
  id: string;
  address_line?: string | null;
  neighbourhood?: string | null;
  city?: string | null;
  allow_public_share?: boolean | null;
}): Promise<LatePoint | null> {
  if (cache.has(row.id)) return cache.get(row.id) ?? null;
  const running = inflight.get(row.id);
  if (running) return running;

  const job = (async () => {
    /* Never exact for a late-geocoded row. The address that produced it was never verified
       against Places, and `enforce_geo_precision` on the server would refuse it anyway. */
    let point = await displayPointFor({
      address: row.address_line, neighbourhood: row.neighbourhood, city: row.city,
      addressIsPublic: false, seed: row.id,
    });
    /* The city on its own, if the address fragment defeated the geocoder. */
    if (!point && row.city) {
      point = await displayPointFor({
        address: null, neighbourhood: null, city: row.city,
        addressIsPublic: false, seed: row.id,
      });
    }
    cache.set(row.id, point);
    inflight.delete(row.id);
    return point;
  })();

  inflight.set(row.id, job);
  return job;
}

/** Resolve a whole page of listings at once, skipping any that already have a point. */
export async function fillMissingPoints<T extends {
  id: string; display_lat?: number | null; display_lng?: number | null;
  address_line?: string | null; neighbourhood?: string | null; city?: string | null;
}>(rows: T[]): Promise<Record<string, LatePoint>> {
  const need = rows.filter(r => r.display_lat == null || r.display_lng == null);
  if (!need.length) return {};
  /* Sequential, not parallel. Google rate-limits geocoding hard and a feed of thirty legacy
     listings firing at once is how a key starts returning OVER_QUERY_LIMIT for everybody. */
  const out: Record<string, LatePoint> = {};
  for (const r of need) {
    const p = await lateGeocode(r);
    if (p) out[r.id] = p;
  }
  return out;
}
