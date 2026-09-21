import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { loadGoogleMaps } from "@evt/lib/places";
import { useLanguage } from "@evt/i18n/LanguageContext";

/** Real embedded map on every event (Lee, Jul 22). Renders an interactive
 *  Google Map with a pin at the event's coordinates (or geocoded from the
 *  address) using the Maps loader + key already live in the app. Falls back to
 *  the tappable "Open in Maps" card if maps can't load or the address can't be
 *  geocoded. Cooperative gestures so it never hijacks mobile scroll. */
export function LocationMap({ latitude, longitude, location, venueName, addressVisible }: {
  latitude?: any; longitude?: any; location?: string | null; addressVisible?: boolean; venueName?: string | null;
}) {
  const { t } = useLanguage();
  const label = venueName || location || "Location";
  const query = [venueName, location].filter(Boolean).join(", ");
  const q = encodeURIComponent(query || label);
  const mapRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const hasCoords =
    latitude != null && longitude != null &&
    !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude)) &&
    !(Number(latitude) === 0 && Number(longitude) === 0);

  useEffect(() => {
    let cancelled = false;
    if (!query && !hasCoords) { setFailed(true); return; }
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapRef.current) return;
        const render = (center: any) => {
          if (cancelled || !mapRef.current) return;
          const map = new g.maps.Map(mapRef.current, {
            center, zoom: 15,
            disableDefaultUI: true, zoomControl: true, clickableIcons: false,
            gestureHandling: "cooperative",
          });
          new g.maps.Marker({ position: center, map });
        };
        if (hasCoords) {
          render({ lat: Number(latitude), lng: Number(longitude) });
        } else {
          new g.maps.Geocoder().geocode({ address: query }, (res: any, status: string) => {
            if (cancelled) return;
            if (status === "OK" && res?.[0]?.geometry?.location) render(res[0].geometry.location);
            else setFailed(true);
          });
        }
      })
      .catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, [query, hasCoords, latitude, longitude]);

  const detail = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><MapPin size={18} /></span>
      <div className="min-w-0">
        <p className="truncate font-semibold">{label}</p>
        {addressVisible !== false && location && <p className="truncate text-sm opacity-60">{location}</p>}
        <p className="text-xs text-brand">{t("ev.open_maps", "Open in Maps")} →</p>
      </div>
    </>
  );

  // Fallback: original tappable link card if the map can't render.
  if (failed) {
    return (
      <a href={`https://maps.google.com/?q=${q}`} target="_blank" rel="noreferrer" className="card flex items-center gap-3 !rounded-2xl p-4 hover:bg-teal/5">
        {detail}
      </a>
    );
  }

  return (
    <div className="card overflow-hidden !rounded-2xl p-0">
      <div ref={mapRef} className="h-48 w-full bg-teal/5" aria-label={`Map showing ${label}`} />
      <a href={`https://maps.google.com/?q=${q}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 hover:bg-teal/5">
        {detail}
      </a>
    </div>
  );
}
export default LocationMap;
