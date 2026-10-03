import { useEffect, useRef, useState } from "react";
import { useI18n, W, Wt } from "../lib/i18n";
import { loadGoogleMaps } from "../lib/places";
import { APPROX_METRES } from "../lib/geo";

/**
 * PLACE MAP — one place, on the page about that place.
 * ============================================================================================
 * Lee, 28 September 2026, about the property page:
 *
 *   *"We need a map on there, just similar to how we have a map on our OneEvent page… same type
 *    of code, it should look the same. There's a section, as you scroll down, you're ultimately
 *    gonna get to the map… we already have the map on the feed page, but this is a different map
 *    on the actual listing itself. Let's not reinvent the wheel."*
 *
 * ── THIS IS NOT `ListingMap`, AND THE DIFFERENCE IS THE WHOLE POINT ──────────────────────────
 * `ListingMap` is the MANY-pin map: a screen you browse, price pills, tap a pin to get a card,
 * tap the card to open a listing. It answers "what is around here and what does it cost".
 *
 * This answers a different question — "where is THIS one" — for somebody who has already chosen
 * the place and scrolled to the bottom of its page. One point, no cards, no routing, no
 * selection state. Trying to serve both from one component would have meant a `pins` array of
 * length one, a price pill nobody needs, and an `onOpen` that navigates to the page you are
 * already on.
 *
 * ── WHY IT LIVES IN THE SHELL ────────────────────────────────────────────────────────────────
 * It began as OneEvent's `LocationMap`, on the event page, and OneHome now needs the same thing
 * on the property page. Same experience = same code: it moves here and OneEvent's file becomes a
 * thin adapter, rather than the two drifting apart the way two copies always do.
 *
 * ── ⚠️ THE ONE THING THAT HAD TO CHANGE: PRECISION ───────────────────────────────────────────
 * An event has a venue. A venue is a public fact — that is what a ticket is for — so a marker
 * dropped on the building is a true statement.
 *
 * A OneHome listing is not. For any property whose address is not public, `display_lat` and
 * `display_lng` were deliberately moved up to 250m in the browser BEFORE they were saved, so the
 * true coordinate is not in the database at all (see `lib/geo.ts`). Dropping OneEvent's marker
 * on that pair would put a pin on a specific building that is NOT the property — the map would
 * be at its most confident exactly where it is least entitled to be, and some stranger's front
 * door would be shown as somebody's home.
 *
 * So precision is a prop, and it changes the SHAPE, which is readable without the caption:
 *
 *   exact       → a marker. "It is here." Events, and any listing published with a public address.
 *   approximate → a circle of exactly `APPROX_METRES`. "It is somewhere in this." Everything else.
 *
 * The radius is imported rather than typed as 250, so the circle and the offset can never drift
 * apart. And the sentence under an approximate map says it in words as well, because a claim
 * about where somebody lives should not rest on a reader knowing what a circle means.
 *
 * ── COOPERATIVE GESTURES, ALWAYS ─────────────────────────────────────────────────────────────
 * This map always sits inside a long scrolling page. `greedy` would let one finger on the map
 * pan it instead of scrolling the page, which on a phone means the page traps you halfway down.
 * `ListingMap` uses `greedy` because there the map IS the screen; here it never is.
 */
export default function PlaceMap({
  lat, lng, precision = "exact", label, sublabel, query,
  heightClass = "h-[350px]", panelClass = "ow-panel", spacingClass = "mt-3", labelChip = false,
}: {
  lat?: number | string | null;
  lng?: number | string | null;
  /** `"approximate"` draws a circle instead of a marker. Anything falsy is treated as exact. */
  precision?: "exact" | "approximate" | null;
  /** The place's name — the venue, or the neighbourhood and city. Always shown. */
  label: string;
  /** A second line under it. Pass it ONLY when the address is public. */
  sublabel?: string | null;
  /**
   * What "Open in Maps" searches for, and what gets geocoded when there are no coordinates.
   * ⚠️ On an approximate listing this must be the AREA (neighbourhood, city) and never a street
   * address — the link leaves our app, so whatever is in it is disclosed.
   */
  query?: string | null;
  heightClass?: string;
  /**
   * The panel weight. OneHome is on `ow-panel`, the one panel weight for that product. OneEvent
   * passes `card`, which is what its page was already built on — promoting this component out of
   * OneEvent must not silently restyle a live page in somebody else's lane.
   */
  panelClass?: string;
  /** Outer margin. OneEvent's page spaces its own sections, so it passes "". */
  spacingClass?: string;
  /**
   * The place-name chip on the map. OFF by default since 2 Oct 2026 — Lee, on the listing page:
   * *"the person already knows… there's no point in putting the city, state and country on
   * there."* The listing page names the place above the map. OneEvent passes `true`: its venue
   * name and address are the event's own information, in another lane.
   */
  labelChip?: boolean;
}) {
  const { lang } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const approx = precision === "approximate";
  const q = encodeURIComponent(query || label);

  const nLat = Number(lat), nLng = Number(lng);
  const hasCoords =
    lat != null && lng != null &&
    Number.isFinite(nLat) && Number.isFinite(nLng) &&
    !(nLat === 0 && nLng === 0);

  useEffect(() => {
    let dead = false;
    if (!hasCoords && !query) { setFailed(true); return; }

    loadGoogleMaps().then(g => {
      if (dead || !host.current) return;

      const draw = (center: any) => {
        if (dead || !host.current) return;
        const map = new g.maps.Map(host.current, {
          center,
          /* One step out on an approximate map, so the whole circle is in frame rather than
             filling the box and reading as a solid tint. */
          zoom: approx ? 14 : 15,
          disableDefaultUI: true,
          zoomControl: true,
          /* Drops Google's "Keyboard shortcuts" link from the footer (Lee, 2 Oct 2026: take the
             footer clutter off). The Google logo, "Map data ©Google" and "Terms" stay: Google's
             Maps Platform terms require them on every Google map, and hiding them would put the
             whole Maps key at risk. */
          keyboardShortcuts: false,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        if (approx) {
          new g.maps.Circle({
            map, center, radius: APPROX_METRES,
            strokeColor: "#0F766E", strokeOpacity: 0.55, strokeWeight: 1.5,
            fillColor: "#0F766E", fillOpacity: 0.18,
            clickable: false,
          });
        } else {
          new g.maps.Marker({ position: center, map });
        }
      };

      if (hasCoords) { draw({ lat: nLat, lng: nLng }); return; }
      new g.maps.Geocoder().geocode({ address: query }, (res: any, status: string) => {
        if (dead) return;
        if (status === "OK" && res?.[0]?.geometry?.location) draw(res[0].geometry.location);
        else setFailed(true);
      });
    }).catch(() => { if (!dead) setFailed(true); });

    return () => { dead = true; };
  }, [hasCoords, nLat, nLng, query, approx]);

  const detail = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
        </svg>
      </span>
      <div className="min-w-0">
        {/* ⚠️ NOT `truncate`. The detail page carries all four segments — "El Poblado, Medellín,
            Antioquia, Colombia" — and at 390px that clipped to "El Poblado, Medellín, Antioqui…",
            which drops the country and breaks a word to do it. Two lines, whole words, and the
            row grows rather than the name shrinking. */}
        <p className="line-clamp-2 text-[14px] font-bold leading-snug">{label}</p>
        {sublabel && <p className="truncate text-[12.5px] opacity-60">{sublabel}</p>}
        <p className="text-[11.5px] font-bold text-brand">{W(lang, "Open in Maps", "Abrir en Maps")} →</p>
      </div>
    </>
  );

  /* Nothing to draw, or Google would not load. The address card still works and still opens
     Maps, so the section degrades to what it was before there was a map rather than vanishing. */
  if (failed) {
    return (
      <a href={`https://maps.google.com/?q=${q}`} target="_blank" rel="noreferrer"
        className={`${panelClass} ${spacingClass} flex items-center gap-3 rounded-2xl p-4`}>
        {detail}
      </a>
    );
  }

  return (
    <section className={`${panelClass} ${spacingClass} relative overflow-hidden rounded-2xl p-0`}>
      <div ref={host} className={`${heightClass} w-full bg-ink/5 dark:bg-white/5`}
        aria-label={Wt(lang, "Map showing {0}", "Mapa de {0}", [label])} />

      {/* ⚠️ THE PANEL IS THE MAP. Lee, 28 September 2026: *"We need to take that white bar for
          information at the bottom of the map off. That entire panel is supposed to be the map.
          Right now you have a white piece depicting what the map is. No, don't do that. It should
          be 100 percent of the map."*

          He is right, and the reason is worth keeping: the bar was repeating the place name that
          the section already establishes and that the map itself draws, in a band of solid colour
          that made the map look like a thumbnail inside a card rather than the thing itself. What
          the bar carried that the map does not — the name, and the way out to Maps — now rides ON
          the map as two small chips. Nothing was dropped; the frame was.

          The height moved from 192 to 240 pixels in the same change, so the panel keeps roughly
          the weight it had when the bar was part of it. A panel that shrank by a third would have
          read as the map having been demoted rather than promoted. */}

      {/* The place-name chip only where a caller asks for it (OneEvent). See `labelChip`. */}
      {labelChip && (
        <div className="pointer-events-none absolute left-2 top-2 max-w-[56%] rounded-lg border border-ink/10 bg-paper/95 px-2 py-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-ink/95">
          <p className="line-clamp-2 text-[11.5px] font-bold leading-snug">{label}</p>
          {sublabel && <p className="truncate text-[10.5px] leading-snug opacity-65">{sublabel}</p>}
        </div>
      )}

      {/* Top RIGHT on purpose: Google puts its own zoom control bottom-right and its logo and
          terms bottom-left, and a control of ours in either corner would sit on top of theirs. */}
      <a href={`https://maps.google.com/?q=${q}`} target="_blank" rel="noreferrer"
        className="ow-tap absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg border border-ink/10 bg-paper/95 px-2 py-1 text-[11px] font-bold text-brand shadow-sm backdrop-blur dark:border-white/10 dark:bg-ink/95">
        {W(lang, "Open in Maps", "Abrir en Maps")}
        <span aria-hidden>↗</span>
      </a>

      {/* ⚠️ UNDER the map, not on it. Lee, 2 Oct 2026: *"that terminology is good, but it doesn't
          need to be on the map… put that right under the map in some little text."* On the map it
          covered a third of the visible streets at 390px. The promise is unchanged, word for word.
          Height: 240 → 300 (overlay 27, "about 25 percent longer") → 350 the same evening: Lee asked
          for the map to grow by the height of that note's strip as well. */}
      {approx && (
        <p className="px-4 pb-3 pt-2 text-[11.5px] leading-snug opacity-65">
          {W(lang,
            "Approximate area — the exact address stays private until there's a contract.",
            "Zona aproximada — la dirección exacta es privada hasta que haya contrato.")}
        </p>
      )}
    </section>
  );
}
