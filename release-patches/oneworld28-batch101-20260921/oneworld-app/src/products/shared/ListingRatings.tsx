import { useEffect, useState } from "react";
import { supabase } from "@oneworld/shell";

export type Rating = { score: number; reviews: number };
export type RatingSet = { status: "loading" | "ready" | "error"; values: Record<string, Rating> };
const loading: RatingSet = { status: "loading", values: {} };

export async function fetchRatingSet(client: typeof supabase, kind: "property" | "host", ids: string[]): Promise<RatingSet> {
  if (!ids.length) return { status: "ready", values: {} };
  const key = kind === "property" ? "property_id" : "user_id";
  try {
    const { data, error } = await client.from(`${kind}_rating_summary` as never).select(`${key},score,reviews`).in(key, ids);
    if (error) throw error;
    if (!Array.isArray(data)) throw Error("Missing rating response");
    const values: Record<string, Rating> = {};
    for (const row of data as unknown as Record<string, unknown>[]) {
      const id = String(row[key]), score = Number(row.score), reviews = Number(row.reviews);
      if (!ids.includes(id) || !Number.isFinite(score) || score < 1 || score> 5 || !Number.isInteger(reviews) || reviews < 1) throw Error("Invalid rating response");
      values[id] = { score, reviews };
    }
    return { status: "ready", values };
  } catch { return { status: "error", values: {} }; }
}

/** Two batched reads per rental page; sale needs only the host read. */
export function useListingRatings(listings: { id: string; agent_id: string }[] | undefined, includeProperty = true) {
  const propertyKey = includeProperty ? [...new Set((listings ?? []).map(x => x.id))].sort().join(",") : "";
  const hostKey = [...new Set((listings ?? []).map(x => x.agent_id))].sort().join(",");
  const requestKey = propertyKey + ";" + hostKey;
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; property: RatingSet; host: RatingSet }>({ key: "", property: loading, host: loading });
  useEffect(() => {
    let active = true;
    setState({ key: requestKey, property: loading, host: loading });
    Promise.all([
      fetchRatingSet(supabase, "property", propertyKey ? propertyKey.split(",") : []),
      fetchRatingSet(supabase, "host", hostKey ? hostKey.split(",") : []),
    ]).then(([property, host]) => { if (active) setState({ key: requestKey, property, host }); });
    return () => { active = false; };
  }, [requestKey, retry]);
  const current = state.key === requestKey ? state : { property: loading, host: loading };
  return { ...current, retry: () => setRetry(x => x + 1) };
}

/* ── FIVE STARS, AND THE HALF ONES ARE REAL ────────────────────────────────────────────────
   Lee, 18 September 2026: *"when you have property and host for the stars, you should actually
   indicate the graphic for the stars — if it's four and a half stars or 4.6 stars, I should
   actually see four and a half stars up there, and they should be yellow."*

   It was one star glyph beside the number, which is a decoration rather than a rating: the glyph
   said nothing, so every score from 1.1 to 5.0 looked identical at a glance. Five stars filled to
   the score is the thing people actually read — the number becomes the confirmation rather than
   the only information.

   ── HOW THE PARTIAL STAR IS DRAWN ──────────────────────────────────────────────────────────
   Not by rounding to a half. 4.6 draws as 4.6, with the fifth star sixty percent filled, because
   rounding a rating is quietly lying about it — 4.4 and 4.6 both become "four and a half" and a
   host loses the difference they earned. One `<linearGradient>` per row, with a hard stop at the
   fraction: everything left of the stop is filled, everything right is the empty track.

   ── AND THE COLOUR ─────────────────────────────────────────────────────────────────────────
   Amber, not black. Lee wondered aloud whether black might read better on a white card. It would
   certainly be legible, but a filled star is doing two jobs at once — saying how many, and being
   spotted at all — and in a page of black text a black star is found last. Amber is also what a
   rating means everywhere else, so nobody has to learn it. The empty track is ink at 18%, which
   is a shape rather than a colour, so the contrast between full and empty survives dark mode
   where a light-grey track would disappear. */
const STAR_PATH = "m12 2 3.1 6.3 7 .9-5.1 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7L2 9.2l6.9-.9Z";

function Stars({ score, id }: { score: number; id: string }) {
  /* Clamped, because a score outside 0–5 would draw a gradient stop outside the box and silently
     render as five full stars — the most flattering possible failure, which is the worst kind. */
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  return (
    <svg width="66" height="13" viewBox="0 0 120 24" className="shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${pct}%`} stopColor="#F59E0B" />
          <stop offset={`${pct}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map(i => (
        <g key={i} transform={`translate(${i * 24} 0)`}>
          {/* The empty track first, then the filled layer over it — so a part-filled star shows
              its own outline on the unfilled side rather than a gap. */}
          <path d={STAR_PATH} className="fill-ink/[0.18] dark:fill-white/25" />
          <path d={STAR_PATH} fill={`url(#${id})`} />
        </g>
      ))}
    </svg>
  );
}

function RatingRow({ label, value, status, lang, idBase }: { label: string; value?: Rating; status: RatingSet["status"]; lang: string; idBase: string }) {
  const es = lang === "es" || lang === "co";
  const message = status === "error" ? (es ? "No disponible" : "Unavailable") : status === "loading" ? (es ? "Cargando…" : "Loading…") : (es ? "Sin reseñas aún" : "No reviews yet");
  return <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
    <span className="font-semibold">{label}</span>
    {status === "ready" && value ? <span className="inline-flex flex-wrap items-center gap-x-1.5 tabular-nums">
      {/* The gradient is referenced by id, so two rows on one page need two ids or the second
          row silently borrows the first row's fill — the host would wear the property's score. */}
      <Stars score={value.score} id={idBase} />
      <span className="font-bold">{value.score.toFixed(1)}</span>
      <span className="opacity-70">({value.reviews.toLocaleString(es ? "es-CO" : "en-US")})<span className="sr-only"> {es ? "reseñas" : "reviews"}</span></span>
    </span> : <span>{message}</span>}
  </div>;
}

export function ListingRatings({ propertyId, hostId, property, host, lang, onDark = false }: { propertyId?: string; hostId: string; property?: RatingSet; host: RatingSet; lang: string;
  /** On the feed card these sit on the dark scrim over a photograph, where the normal muted ink
   *  is unreadable and the top margin is already supplied by the column's own gap. */
  onDark?: boolean }) {
  const es = lang === "es" || lang === "co";
  return <div className={`${onDark ? "space-y-0.5 text-white" : "mt-2 space-y-1"} text-[11px]`} aria-label={es ? "Calificaciones" : "Ratings"}>
    {propertyId && property && <RatingRow label={es ? "Inmueble" : "Property"} value={property.values[propertyId]} status={property.status} lang={lang} idBase={`ows-p-${propertyId}`} />}
    <RatingRow label={es ? "Anfitrión" : "Host"} value={host.values[hostId]} status={host.status} lang={lang} idBase={`ows-h-${hostId}`} />
  </div>;
}

export function RatingRetry({ property, host, retry, lang }: { property?: RatingSet; host: RatingSet; retry: () => void; lang: string }) {
  if (property?.status !== "error" && host.status !== "error") return null;
  const es = lang === "es" || lang === "co";
  return <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" role="status">
    <span>{es ? "No se pudieron cargar algunas calificaciones." : "Some ratings could not be loaded."}</span>
    <button type="button" onClick={retry} className="ow-tap rounded-full border border-brand/25 px-3 py-2 font-semibold">{es ? "Reintentar" : "Try again"}</button>
  </div>;
}
