import { useEffect, useRef, useState } from "react";
import { useI18n, W, Wt } from "../lib/i18n";
import { loadGoogleMaps } from "../lib/places";
import { thumbFor } from "../lib/imageDerivatives";

/**
 * THE MAP — pins, then a card, then the listing.
 * ============================================================================================
 * Lee, 11 Aug 2026:
 *
 *   *"We definitely need a map… like a map view so you could see everything in a map and zoom in…
 *    tap it one time, it shows the thumbnail and the immediate details, and you tap it again, it
 *    takes you to the actual listing."*
 *
 * That two-tap gesture is the whole interaction and it is worth saying why it is right rather than
 * just implementing it. On a phone, one tap → navigate means every mis-tap on a dense map costs a
 * page load and a scroll position. One tap → a card lets you walk five pins in five taps and read
 * five prices without leaving the map. It is also what Zillow does, which means renters already
 * know it.
 *
 * ── WHAT THE PIN IS, AND ISN'T ──────────────────────────────────────────────────────────────
 * A pin is a `display_lat`/`display_lng` pair, and for any listing whose address is not public
 * those numbers were deliberately offset by up to ~250m in the browser before they were ever
 * saved — see `lib/geo.ts`. So an approximate listing draws a soft CIRCLE, not a pin: a pin is a
 * claim about a building, and we do not have one. The legend says so in words, because a map that
 * looks precise and isn't is worse than no map.
 *
 * ── PRICE PILLS, NOT TEARDROPS ──────────────────────────────────────────────────────────────
 * A teardrop marker says "something is here". A pill saying "$1,900" says what it is, and lets
 * somebody read the price distribution of a neighbourhood at a glance without tapping anything.
 * That is the single highest-value thing a property map does and it costs nothing extra.
 *
 * ── NO CLUSTERING YET, ON PURPOSE ───────────────────────────────────────────────────────────
 * Clustering is correct at a few thousand pins and actively harmful at forty: it hides prices
 * behind a count, which throws away the one advantage above. Revisit when a single city view
 * regularly holds more than ~150 listings.
 */

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  /** false → drawn as a blurred circle, never a precise pin. */
  exact: boolean;
  /**
   * The full label, WITH its period — "$1,900 / month". Drawn on the card, where there is room
   * and where a reader who has tapped one specific place wants the whole fact.
   * This component does no money formatting.
   */
  priceLabel: string;
  /**
   * ⚠️ THE MARKER'S LABEL, WITHOUT THE PERIOD — "$1,900". Lee, 15 Aug 2026:
   *
   *   *"On my map the items are plotted, but it says per month, or it has a slash and then month.
   *   We really just need the actual price based on the currency they selected. It doesn't need to
   *   be per month. The per month is implied because every listing is gonna be based on per
   *   month… it's gonna take a lot less horizontal room up that way."*
   *
   * He is right about the room, and that is not a cosmetic point on a map: the pill's width is
   * computed from its character count, so " / month" is ~55px of extra pill on EVERY marker. At
   * forty listings in one neighbourhood that is what turns a readable map into a pile of
   * overlapping lozenges. The period is stated once, above the map, instead of forty times on it.
   *
   * Falls back to `priceLabel` when a caller has not supplied it, so no map ever loses its price.
   */
  pinLabel?: string;
  title: string;
  photo?: string | null;
  facts?: string | null;
  href: string;
  /* ── THE LARGER CARD (ONEHOME30 overlay 46, 4 Oct 2026) — all optional; a caller that sends
     none of them still gets the larger card, it just shows less. */
  /** Up to six photos for the larger card's strip. Falls back to `photo`. */
  photos?: string[];
  /** Short facts drawn as chips: kind, bedrooms, bathrooms, m². */
  stats?: string[];
  /** A few lines of the listing's own description. */
  blurb?: string | null;
  /** "For rent" / "For sale" on a map that carries both. */
  badge?: string | null;
};

/** Medellín. The default view when nothing has coordinates yet. */
const FALLBACK = { lat: 6.2442, lng: -75.5812 };

export default function ListingMap({
  pins, onOpen, heightClass = "h-[62vh]", period = null, gestureHandling = "greedy", chromeInsets,
  frame = "area",
}: {
  pins: MapPin[];
  /** Second tap. The caller navigates — the map does not own routing. */
  onOpen: (pin: MapPin) => void;
  heightClass?: string;
  /**
   * What every price on this map is per. Stated ONCE at the top of the map instead of repeated
   * on every marker — see `pinLabel`. Null on a sale map, where an asking price is not per
   * anything and a caption would be noise.
   */
  period?: "month" | "night" | null;
  /**
   * OneHome uses the map as the screen and keeps one-finger panning. OneEvent sits inside a
   * longer discover page, so it can opt into cooperative gestures and let one finger scroll.
   */
  gestureHandling?: "cooperative" | "greedy" | "none" | "auto";
  /**
   * FULL-SCREEN MAPS UNDER FLOATING CHROME (ONEHOME30 overlay 45, 4 Oct 2026). Lee: the property
   * card "is supposed to come up from the bottom … it's stuck down at the bottom and you can't
   * click on it". On the world feed the map is full bleed and the feed's floating footer sits ON
   * TOP of it, so a card pinned to `bottom-2` was drawn under the footer and every tap on it
   * landed on the footer instead. A caller whose map runs under its own header and footer passes
   * how much of the top and bottom that chrome covers (CSS lengths); the caption, the card and the
   * zoom buttons then sit inside the clear area. Omitted = the old placement, unchanged.
   */
  chromeInsets?: { top?: string; bottom?: string };
  /**
   * HOW THE CAMERA OPENS (ONEHOME30 overlay 46). Lee, 4 Oct: fitting every pin showed the whole
   * country when listings sit in three cities, and the older single-pin view showed two streets.
   * He wants "one click in from the city": the neighbourhood readable, the city around it still
   * recognisable. `"area"` (the default) centres on where most of the listings are and opens at
   * zoom 13; `"fit"` is the old fit-every-pin behaviour for a caller that needs it.
   */
  frame?: "area" | "fit";
}) {
  const { lang } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [ready, setReady] = useState<"loading" | "ok" | "failed">("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Keep selection identity while reading current labels, facts and navigation from the latest pins.
  const selected = pins.find(p => p.id === selectedId) ?? null;
  /* STEP TWO of three (overlay 46): pin → small card → LARGER card → full listing. Each step is
     a smaller commitment than opening the listing, and every step can be backed out of. */
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [selectedId]);
  /* On a map that sits INSIDE a scrolling page (OneHome's own rent and sale maps, 62vh tall), the
     bottom of the map is often under the app's floating tab bar — the same trap the feed's map
     had. Bring the card that just opened into view, clear of the tab bar. Not on a full-screen
     map (chromeInsets), where nothing scrolls and the insets already keep it clear. */
  const cardRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (chromeInsets || !selectedId) return;
    /* window.scrollBy rather than scrollIntoView: next to a live Google map, scrollIntoView did
       nothing in testing, while the page itself scrolled fine. 110 px clears the tab bar. */
    const t = setTimeout(() => {
      const r = cardRef.current?.getBoundingClientRect();
      if (!r) return;
      const over = r.bottom + 110 - window.innerHeight;
      if (over > 0) window.scrollBy({ top: over, behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [selectedId, expanded, chromeInsets]);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);
  /* v88.1 · U26 · ow-map-boot-retry. Bumped when the host node is not mounted yet, so the
     boot effect below runs again instead of giving up in silence. See the note there. */
  const [bootTry, setBootTry] = useState(0);

  /* Boot the map once. `loadGoogleMaps` is the shared singleton — six products loading the script
     six times would race on `window.google` and burn the referrer-restricted key six ways. */
  useEffect(() => {
    let dead = false;
    loadGoogleMaps().then(g => {
      if (dead) return;
      /* v88.1 · U26 · THE BUG THIS FIXES. If the host node is not in the DOM at the moment
         the Google script resolves, the old line here returned and NOTHING ever retried:
         `ready` stayed "loading", the pin effect returned at its first line, and the
         container was an empty grey box for the life of the screen — no error, no log.
         Bounded retry, then an honest failure the reader can actually see. */
      if (!host.current) {
        if (bootTry < 60) { const t = setTimeout(() => setBootTry(n => n + 1), 50); return () => clearTimeout(t); }
        setReady("failed"); return;
      }
      map.current = new g.maps.Map(host.current, {
        center: FALLBACK,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        /* Under a floating footer the default bottom-right zoom buttons are covered by it. */
        ...(chromeInsets?.bottom ? { zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_CENTER } } : {}),
        gestureHandling,
        clickableIcons: false,        // Google's own POIs must not steal a tap from a listing
        styles: [
          /* Quiet the base map so the price pills are the brightest thing on it. */
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        ],
      });
      /* A tap on empty map closes the card — the same gesture as tapping outside any sheet. */
      map.current.addListener("click", () => setSelectedId(null));
      setReady("ok");
    }).catch(() => { if (!dead) setReady("failed"); });
    return () => { dead = true; };
  }, [bootTry]);

  /* Draw the pins, and refit whenever the set changes — a filter that narrows to three listings
     should move the camera to those three, not leave the reader looking at an empty city. */
  useEffect(() => {
    if (ready !== "ok" || !map.current) return;
    const g = (window as any).google;
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];
    if (!pins.length) return;

    const bounds = new g.maps.LatLngBounds();
    for (const p of pins) {
      const marker = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: map.current,
        title: p.title,
        /* An approximate listing gets a soft translucent disc; an exact one gets a solid pill.
           Two different shapes for two different claims, so the difference is visible without
           reading the legend. */
        icon: p.exact ? pricePill(p.pinLabel || p.priceLabel)
                      : blurDisc(p.pinLabel || p.priceLabel),
      });
      marker.addListener("click", () => setSelectedId(p.id));
      markers.current.push(marker);
      bounds.extend({ lat: p.lat, lng: p.lng });
    }
    if (frame === "area") {
      const c = busiestArea(pins);
      map.current.setCenter(c);
      map.current.setZoom(AREA_ZOOM);
    } else if (pins.length === 1) {
      map.current.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
      map.current.setZoom(15);
    } else {
      map.current.fitBounds(bounds, 48);
    }
  }, [pins, ready, frame]);

  const hasApprox = pins.some(p => !p.exact);

  if (ready === "failed") {
    return (
      <div className={`grid ${heightClass} place-items-center rounded-2xl border border-ink/10 bg-ink/[0.03] px-6 text-center dark:border-white/10 dark:bg-white/[0.04]`}>
        <p className="text-[13px] leading-relaxed opacity-60">
          {W(lang,
            "The map couldn't load just now. Everything is still here in the list.",
            "El mapa no se pudo cargar en este momento. Todo sigue disponible en la lista.")}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={host} className={`${heightClass} w-full overflow-hidden rounded-2xl bg-ink/5 dark:bg-white/5`} />

      {ready === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="text-[12px] font-semibold opacity-50">
            {W(lang, "Loading the map…", "Cargando el mapa…")}
          </span>
        </div>
      )}

      {/* ── THE LEGEND, AND THE PERIOD, IN ONE PLACE ───────────────────────────────────────
          Two things a reader needs and neither of which belongs on a marker: what the faded
          circles mean, and what every price on this map is PER.

          Lee, 15 Aug 2026: *"somewhere right above the map, or inside the map"* — inside, because
          a caption that scrolls away from the thing it explains has stopped explaining it. The
          period sentence leads, because it changes how every number on screen is read; the
          privacy sentence follows, because it is reassurance rather than instruction.

          Still conditional on there being something to say. A map that explains a distinction it
          is not drawing trains people to skip captions. */}
      {ready === "ok" && (period || hasApprox) && (
        <div className="pointer-events-none absolute left-2 top-2 max-w-[74%] rounded-lg bg-paper/95 px-2 py-1 text-ink backdrop-blur dark:bg-ink/95 dark:text-paper"
          style={chromeInsets?.top ? { top: chromeInsets.top } : undefined}>
          {period && (
            <p className="text-[10.5px] font-black leading-snug">
              {period === "night"
                ? W(lang, "Every price shown is per night.", "Todos los precios mostrados son por noche.")
                : W(lang, "Every price shown is per month.", "Todos los precios mostrados son por mes.")}
            </p>
          )}
          {hasApprox && (
            <p className="text-[10.5px] font-semibold leading-snug opacity-75">
              {W(lang,
                "Circles are approximate — the exact address stays private until there's a contract.",
                "Los círculos son aproximados — la dirección exacta es privada hasta que haya contrato.")}
            </p>
          )}
        </div>
      )}

      {ready === "ok" && pins.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-paper/90 p-4 text-center text-ink backdrop-blur dark:bg-ink/90 dark:text-paper">
          <p className="text-[13px] font-bold">
            {W(lang, "Nothing to map yet", "Todavía no hay nada que mapear")}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">
            {W(lang,
              "These listings don't have a location on them yet. They're all still in the list view.",
              "Estos anuncios aún no tienen ubicación. Siguen todos en la vista de lista.")}
          </p>
        </div>
      )}

      {/* ── FIRST TAP: THE CARD ────────────────────────────────────────────────────────────
          Sits over the map rather than replacing it, so the surrounding pins stay visible and
          comparing two places is two taps rather than two page loads. Tapping it opens the LARGER
          card below (overlay 46), not the listing. */}
      {selected && !expanded && (
        <button type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          data-ow="map-card"
          ref={el => { cardRef.current = el; }}
          key={selected.id}
          className={`ow-tap absolute inset-x-2 bottom-2 flex items-center gap-3 rounded-2xl bg-paper p-2 text-left text-ink shadow-2xl ring-1 ring-ink/10 dark:bg-ink dark:text-paper dark:ring-white/15${chromeInsets?.bottom ? " ow-map-card-rise" : ""}`}
          style={chromeInsets?.bottom ? { bottom: chromeInsets.bottom } : { scrollMarginBottom: 110 }}>
          <span className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-ink/5 dark:bg-white/10">
            {selected.photo && (
              <img decoding="async" src={thumbFor(selected.photo)} alt="" loading="lazy"
                onError={e => { const t = e.currentTarget; if (t.src !== selected.photo) t.src = selected.photo!; }}
                className="h-full w-full object-cover" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-black tracking-tight">{selected.priceLabel}</span>
            <span className="block truncate text-[12.5px] font-semibold opacity-80">{selected.title}</span>
            {selected.facts && (
              <span className="block truncate text-[11.5px] opacity-55">{selected.facts}</span>
            )}
          </span>
          <span className="shrink-0 pr-1 text-[11px] font-bold opacity-45">
            {W(lang, "More ›", "Más ›")}
          </span>
        </button>
      )}

      {/* ── SECOND TAP: THE LARGER CARD (ONEHOME30 overlay 46) ────────────────────────────────
          Lee, 4 Oct: *"tap the price, you see the small card. Tap the small card, you see a larger
          card. Tap the larger card, you see the full listing… you can exit out of any one of
          them."* An X at the top right, a tap on the dimmed map around it, or Escape closes it and
          leaves the reader on the map exactly where they were — no trip to a listing and back
          through the feed to find out a place is not for them. */}
      {selected && expanded && (() => {
        const photos = (selected.photos?.length ? selected.photos : selected.photo ? [selected.photo] : []).slice(0, 6);
        return (
          <>
            <button type="button" aria-label={W(lang, "Close", "Cerrar")}
              onClick={() => setExpanded(false)}
              className="absolute inset-0 z-[3] cursor-default bg-black/30" />
            <div role="dialog" aria-modal="true" aria-label={selected.title} data-ow="map-card-large"
              ref={el => { cardRef.current = el; }}
              className="ow-map-card-rise absolute inset-x-2 z-[4] flex flex-col overflow-hidden rounded-3xl bg-paper text-ink shadow-2xl ring-1 ring-ink/10 dark:bg-ink dark:text-paper dark:ring-white/15"
              /* Radius inline: the feed squares off every direct child of the map with
                 `[&>div>div]:rounded-none` (meant for the map canvas), which caught this card. */
              style={{ borderRadius: 24, scrollMarginBottom: chromeInsets ? undefined : 110, bottom: chromeInsets?.bottom ?? "8px",
                       maxHeight: `calc(100% - ${chromeInsets?.bottom ?? "8px"} - ${chromeInsets?.top ?? "8px"})` }}>
              <div className="relative shrink-0">
                {photos.length > 0 ? (
                  <div className="flex h-48 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {photos.map((src, i) => (
                      <img key={src + i} decoding="async" src={thumbFor(src)} alt="" loading={i ? "lazy" : "eager"}
                        onError={e => { const t = e.currentTarget; if (t.src !== src) t.src = src; }}
                        onClick={() => onOpen(selected)}
                        className="h-48 w-full shrink-0 snap-center cursor-pointer object-cover" />
                    ))}
                  </div>
                ) : <div className="h-20 bg-ink/5 dark:bg-white/10" />}
                {photos.length > 1 && (
                  <span className="pointer-events-none absolute bottom-2 left-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
                    {Wt(lang, "{0} photos · swipe", "{0} fotos · desliza", [photos.length])}
                  </span>
                )}
                <button type="button" aria-label={W(lang, "Close", "Cerrar")}
                  onClick={() => setExpanded(false)}
                  className="ow-tap absolute right-2.5 top-2.5 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white shadow-lg ring-1 ring-white/30 backdrop-blur-md">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <button type="button" onClick={() => onOpen(selected)}
                className="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-4 pb-4 pt-3 text-left">
                <span className="flex items-center gap-2">
                  <span className="text-[20px] font-black tracking-tight">{selected.priceLabel}</span>
                  {selected.badge && (
                    <span className="rounded-full bg-ink/[0.07] px-2 py-0.5 text-[11px] font-bold dark:bg-white/10">{selected.badge}</span>
                  )}
                </span>
                <span className="line-clamp-2 text-[15px] font-bold leading-snug">{selected.title}</span>
                {selected.facts && <span className="text-[12.5px] opacity-65">{selected.facts}</span>}
                {!!selected.stats?.length && (
                  <span className="mt-0.5 flex flex-wrap gap-1.5">
                    {selected.stats.map(st => (
                      <span key={st} className="rounded-full border border-ink/15 px-2.5 py-1 text-[12px] font-semibold dark:border-white/20">{st}</span>
                    ))}
                  </span>
                )}
                {selected.blurb && (
                  <span className="line-clamp-3 text-[13px] leading-relaxed opacity-75">{selected.blurb}</span>
                )}
                <span className="mt-1.5 grid h-12 w-full place-items-center rounded-2xl bg-ink text-[15px] font-extrabold text-paper dark:bg-paper dark:text-ink">
                  {W(lang, "See the full listing", "Ver el anuncio completo")}
                </span>
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

/* ── WHERE THE CAMERA OPENS (overlay 46) ─────────────────────────────────────────────────────
   The busiest area: the listing with the most other listings within ~6 km, and the middle of
   that group. Ties go to the first listing, which is the feed's own order. Zoom 13 is "one click
   in from the city" — a neighbourhood with the city's landmarks still on screen. */
const AREA_ZOOM = 13;
function busiestArea(pins: MapPin[]): { lat: number; lng: number } {
  const km = (a: MapPin, b: MapPin) => {
    const dy = (a.lat - b.lat) * 111;
    const dx = (a.lng - b.lng) * 111 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    return Math.hypot(dx, dy);
  };
  let best = pins[0], bestN = -1;
  for (const p of pins) {
    const n = pins.reduce((acc, q) => acc + (km(p, q) <= 6 ? 1 : 0), 0);
    if (n > bestN) { best = p; bestN = n; }
  }
  const group = pins.filter(q => km(best, q) <= 6);
  return {
    lat: group.reduce((a, q) => a + q.lat, 0) / group.length,
    lng: group.reduce((a, q) => a + q.lng, 0) / group.length,
  };
}

/* ── MARKER ART ──────────────────────────────────────────────────────────────────────────────
   Inline SVG data URLs rather than image files: the pill has to carry the price, so it has to be
   generated per marker anyway, and a data URL needs no network round trip per pin. */

function pricePill(label: string) {
  /* Width from the label length. Google needs the size up front — an SVG that overflows its
     declared box is clipped, which is how a "$1,900" becomes "$1,9". */
  const w = Math.max(52, 13 + label.length * 7.6);
  const h = 26;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + 6}" viewBox="0 0 ${w} ${h + 6}">` +
    `<g filter="url(#s)">` +
    `<rect x="1" y="1" rx="${h / 2}" width="${w - 2}" height="${h}" fill="#0F766E"/>` +
    `<path d="M${w / 2 - 5} ${h} L${w / 2} ${h + 5} L${w / 2 + 5} ${h}Z" fill="#0F766E"/>` +
    `</g>` +
    `<text x="${w / 2}" y="${h / 2 + 4.5}" text-anchor="middle" ` +
    `font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" ` +
    `font-weight="800" fill="#ffffff">${escapeXml(label)}</text>` +
    `<defs><filter id="s" x="-20%" y="-20%" width="140%" height="160%">` +
    `<feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-color="#000" flood-opacity="0.30"/>` +
    `</filter></defs></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new (window as any).google.maps.Size(w, h + 6),
    anchor: new (window as any).google.maps.Point(w / 2, h + 6),
  };
}

/**
 * ⚠️ 15 Aug 2026 — THE PRICE WAS INVISIBLE ON EVERY SINGLE LISTING.
 * The note at the top of this file calls the price pill "the single highest-value thing a property
 * map does". It was only ever drawn for `exact` pins. But a listing is only `exact` when its street
 * address is public, and OneHome deliberately keeps street addresses private — so in practice **no
 * listing has ever shown its price on the map**. The one feature that earns the map its place was
 * switched off everywhere by a privacy rule it has nothing to do with.
 *
 * The address is the secret. The price is not. An approximate listing draws a soft circle — the
 * honest "we are not claiming a building" signal — with the price above it.
 *
 * ── AND THE DASHES ARE GONE. 15 Aug 2026 ────────────────────────────────────────────────────
 * Lee: *"I don't like the dash line… just make that a solid line."*
 *
 * The dashes were carrying a real idea — dashed meant "around here", solid meant "this building"
 * — and it is worth writing down why removing them costs nothing. **Nothing on this map is ever
 * `exact`**, because OneHome keeps street addresses private by design. So the dashed variant was
 * not one of two contrasting signals; it was the only signal on the map, contrasting with
 * nothing, and a 3px dash pattern on a 1.5px stroke at map scale reads as a rendering fault
 * rather than as a claim about precision.
 *
 * The distinction is not lost, it is carried by the SHAPE instead, which survives at any zoom:
 * a pointed pill drops on a building, a soft filled disc hovers over an area. And the sentence in
 * the legend says it in words, which is where a claim about somebody's address belongs anyway.
 */
function blurDisc(label?: string) {
  const d = 34;
  if (label) {
    /* 14px of air each side, not 4.5 — at 11.5px bold, "$1,050" touched the pill edge. */
    const w = Math.max(52, 28 + label.length * 7.4), ph = 20, gap = 3;
    const W2 = Math.max(w, d), H = ph + gap + d;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W2}" height="${H}" viewBox="0 0 ${W2} ${H}">` +
      `<g transform="translate(${(W2 - w) / 2},0)">` +
      `<rect x="0.75" y="0.75" width="${w - 1.5}" height="${ph - 1.5}" rx="${(ph - 1.5) / 2}" ` +
      `fill="#ffffff" fill-opacity="0.94" stroke="#0F766E" stroke-opacity="0.65" ` +
      `stroke-width="1.5"/>` +
      `<text x="${w / 2}" y="${ph / 2 + 4}" text-anchor="middle" ` +
      `font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="11.5" ` +
      `font-weight="800" fill="#0F766E">${escapeXml(label)}</text></g>` +
      `<g transform="translate(${(W2 - d) / 2},${ph + gap})">` +
      `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 1}" fill="#0F766E" fill-opacity="0.18"/>` +
      `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 1}" fill="none" stroke="#0F766E" ` +
      `stroke-opacity="0.55" stroke-width="1.5"/>` +
      `<circle cx="${d / 2}" cy="${d / 2}" r="3.2" fill="#0F766E"/></g></svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new (window as any).google.maps.Size(W2, H),
      anchor: new (window as any).google.maps.Point(W2 / 2, ph + gap + d / 2),
    };
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}" viewBox="0 0 ${d} ${d}">` +
    `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 1}" fill="#0F766E" fill-opacity="0.18"/>` +
    `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 1}" fill="none" stroke="#0F766E" ` +
    `stroke-opacity="0.55" stroke-width="1.5"/>` +
    `<circle cx="${d / 2}" cy="${d / 2}" r="3.2" fill="#0F766E"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new (window as any).google.maps.Size(d, d),
    anchor: new (window as any).google.maps.Point(d / 2, d / 2),
  };
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}
