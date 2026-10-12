/* ── THE ROUTE, BEFORE ANYONE NAMES A PRICE ───────────────────────────────────────────────────
   Lee, 9 Oct 2026: "when a request is sent over to a driver, the map with the route should show …
   Uber doesn't show you the route because they don't want people declining rides. But this is a
   private ride and you want to be able to confirm the price. It's going to tell the distance and
   how long it's going to take."

   Distance and drive time come from Google (the Maps key the shell already loads for addresses).
   Waze has no public drive-time service — its Transport SDK is for approved partners — so Waze is
   one tap away instead: "Open in Waze" with the same destination, and "Open in Google Maps" with
   every stop, so a driver can compare the two themselves.

   If Google can't route it (no network, an address it can't place), the card says so plainly and
   the screen simply has no suggested price — it never invents a distance. */
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, useI18n, W, Wt } from "@oneworld/shell";
import type { Place } from "../lib/data";

export type RouteInfo = { km: number; minutes: number };

const cache = new Map<string, RouteInfo | null>();
const keyOf = (a: string, stops: string[], b: string) => [a, ...stops, b].join(" → ");

/** Distance and drive time for pickup → stops → drop-off. `undefined` while loading, `null` if unroutable. */
export function useRoute(pickup: Place | null, stops: Place[], dropoff: Place | null, departAt?: string | null): RouteInfo | null | undefined {
  const a = pickup?.label?.trim() ?? "", b = dropoff?.label?.trim() ?? "";
  const mids = stops.map(s => s.label?.trim()).filter(Boolean) as string[];
  /* Traffic is predicted for the pickup time (or now, if that has passed). */
  const depart = Math.max(Date.now() + 60_000, departAt ? new Date(departAt).getTime() : 0);
  const key = a && b ? `${keyOf(a, mids, b)}@${Math.round(depart / 900_000)}` : "";
  const [info, setInfo] = useState<RouteInfo | null | undefined>(() => (key ? cache.get(key) : null));
  useEffect(() => {
    if (!key) { setInfo(null); return; }
    if (cache.has(key)) { setInfo(cache.get(key)); return; }
    let alive = true;
    setInfo(undefined);
    loadGoogleMaps().then((g: any) => new g.maps.DirectionsService().route({
      origin: a, destination: b, travelMode: g.maps.TravelMode.DRIVING,
      waypoints: mids.map(m => ({ location: m, stopover: true })),
      drivingOptions: { departureTime: new Date(depart), trafficModel: "bestguess" },
    })).then((res: any) => {
      const legs = res?.routes?.[0]?.legs ?? [];
      const m = legs.reduce((s: number, l: any) => s + (l.distance?.value ?? 0), 0);
      const sec = legs.reduce((s: number, l: any) => s + ((l.duration_in_traffic ?? l.duration)?.value ?? 0), 0);
      const r = m > 0 ? { km: m / 1000, minutes: Math.round(sec / 60) } : null;
      cache.set(key, r); if (alive) setInfo(r);
    }).catch(() => { cache.set(key, null); if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return info;
}

const gmaps = (a: string, stops: string[], b: string) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(a)}&destination=${encodeURIComponent(b)}` +
  (stops.length ? `&waypoints=${encodeURIComponent(stops.join("|"))}` : "");
/* Waze takes one destination; the first leg is where the driver is going first: the pickup. */
const waze = (to: string) => `https://waze.com/ul?q=${encodeURIComponent(to)}&navigate=yes`;

export function fmtKm(km: number, lang: string) {
  return `${km.toLocaleString(lang === "en" ? "en-US" : "es-CO", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}
export function fmtMinutes(min: number, lang: string) {
  if (min < 60) return Wt(lang, "{0} min", "{0} min", [String(min)]);
  const h = Math.floor(min / 60), m = min % 60;
  return m ? Wt(lang, "{0} h {1} min", "{0} h {1} min", [String(h), String(m)]) : Wt(lang, "{0} h", "{0} h", [String(h)]);
}

export default function RouteCard({ pickup, stops, dropoff, info }: {
  pickup: Place; stops: Place[]; dropoff: Place; info: RouteInfo | null | undefined;
}) {
  const { lang } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const mids = stops.map(s => s.label).filter(Boolean);

  /* Draw the route on a small map. Separate from useRoute so the numbers never wait on tiles. */
  useEffect(() => {
    if (!info || !box.current) return;
    let alive = true;
    loadGoogleMaps().then((g: any) => {
      if (!alive || !box.current) return;
      const map = new g.maps.Map(box.current, { disableDefaultUI: true, gestureHandling: "cooperative", clickableIcons: false });
      const renderer = new g.maps.DirectionsRenderer({ map, suppressMarkers: false, polylineOptions: { strokeColor: "#111111", strokeWeight: 5 } });
      new g.maps.DirectionsService().route({
        origin: pickup.label, destination: dropoff.label, travelMode: g.maps.TravelMode.DRIVING,
        waypoints: mids.map(m => ({ location: m, stopover: true })),
      }).then((res: any) => { if (alive) renderer.setDirections(res); }).catch(() => {});
    }).catch(() => {});
    return () => { alive = false; };
  }, [info, pickup.label, dropoff.label, mids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card mt-3 overflow-hidden !rounded-2xl !p-0">
      {info ? <div ref={box} className="h-44 w-full bg-ink/[0.05] dark:bg-white/[0.06]" aria-label={W(lang, "Route map", "Mapa de la ruta")} />
        : <div className={`h-20 w-full ${info === undefined ? "ow-shimmer" : ""} bg-ink/[0.04] dark:bg-white/[0.05]`} />}
      <div className="p-4">
        {info ? (
          <p className="flex items-baseline gap-3 text-[15px] font-extrabold tabular-nums">
            <span>{fmtKm(info.km, lang)}</span><span className="opacity-30">·</span><span>{fmtMinutes(info.minutes, lang)}</span>
            <span className="text-[12px] font-semibold opacity-55">{W(lang, "with traffic at pickup", "con el tráfico de la hora")}</span>
          </p>
        ) : info === null ? (
          <p className="text-[13.5px] font-bold opacity-70">{W(lang, "We couldn't map this route. Check it in Maps or Waze.", "No pudimos trazar esta ruta. Revísela en Maps o Waze.")}</p>
        ) : (
          <p className="text-[13.5px] font-bold opacity-50">{W(lang, "Finding the route…", "Buscando la ruta…")}</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={gmaps(pickup.label, mids, dropoff.label)} target="_blank" rel="noopener noreferrer"
            className="ow-tap ow-edge rounded-xl border py-2.5 text-center text-[13.5px] font-bold">Google Maps</a>
          <a href={waze(pickup.label)} target="_blank" rel="noopener noreferrer"
            className="ow-tap ow-edge rounded-xl border py-2.5 text-center text-[13.5px] font-bold">Waze</a>
        </div>
      </div>
    </section>
  );
}
