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
      if (!ids.includes(id) || !Number.isFinite(score) || score < 1 || score > 5 || !Number.isInteger(reviews) || reviews < 1) throw Error("Invalid rating response");
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

function RatingRow({ label, value, status, lang }: { label: string; value?: Rating; status: RatingSet["status"]; lang: string }) {
  const es = lang === "es" || lang === "co";
  const message = status === "error" ? (es ? "No disponible" : "Unavailable") : status === "loading" ? (es ? "Cargando…" : "Loading…") : (es ? "Sin reseñas aún" : "No reviews yet");
  return <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
    <span className="font-semibold">{label}</span>
    {status === "ready" && value ? <span className="inline-flex flex-wrap items-center gap-x-1 tabular-nums">
      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="shrink-0"><path d="m12 2 3.1 6.3 7 .9-5.1 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7L2 9.2l6.9-.9Z" /></svg>
      <span>{value.score.toFixed(1)}/5</span>
      <span>({value.reviews.toLocaleString(es ? "es-CO" : "en-US")})<span className="sr-only"> {es ? "reseñas" : "reviews"}</span></span>
    </span> : <span>{message}</span>}
  </div>;
}

export function ListingRatings({ propertyId, hostId, property, host, lang }: { propertyId?: string; hostId: string; property?: RatingSet; host: RatingSet; lang: string }) {
  const es = lang === "es" || lang === "co";
  return <div className="mt-2 space-y-1 text-[11px]" aria-label={es ? "Calificaciones" : "Ratings"}>
    {propertyId && property && <RatingRow label={es ? "Inmueble" : "Property"} value={property.values[propertyId]} status={property.status} lang={lang} />}
    <RatingRow label={es ? "Anfitrión" : "Host"} value={host.values[hostId]} status={host.status} lang={lang} />
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
