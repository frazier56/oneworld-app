import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase, useOneId, productHref } from "@oneworld/shell";

type Target = "property" | "host" | "guest";
type Review = { id: string; target: Target; rating: number; body: string | null };
type Context = { contract_id: string; eligible: boolean; targets: Target[]; reviews: Review[] };
const spanish = (lang: string) => lang === "es" || lang === "co";
const targetLabel = (target: Target, es: boolean) => ({ property: es ? "Inmueble" : "Property", host: es ? "Anfitrión" : "Host", guest: es ? "Huésped" : "Guest" })[target];

export default function StayReviews({ contractId, lang }: { contractId: string; lang: string }) {
  const { userId } = useOneId(); const es = spanish(lang); const key = `${userId}:${contractId}`;
  const section = useRef<HTMLElement>(null); const { hash } = useLocation();
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ key: string; data?: Context; error?: boolean }>({ key: "" });
  useEffect(() => {
    let alive = true; setState({ key });
    if (!userId) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("rental_review_context", { p_contract: contractId });
        if (error || !data || data.contract_id !== contractId || !Array.isArray(data.targets) || !Array.isArray(data.reviews)) throw Error("Review context unavailable");
        if (alive) setState({ key, data });
      } catch { if (alive) setState({ key, error: true }); }
    })();
    return () => { alive = false; };
  }, [key, tick]);
  useEffect(() => { if (hash === "#reviews" && state.key === key && state.data) section.current?.scrollIntoView({ block: "start" }); }, [hash, state.data, key]);
  if (!userId) return null;
  const current = state.key === key ? state : undefined;
  return <section ref={section} id="reviews" className="card scroll-mt-24 space-y-3 p-4">
    <h2 className="text-base font-bold">{es ? "Reseñas después de su estadía" : "Reviews after your stay"}</h2>
    {current?.error ? <div role="alert"><p>{es ? "No se pudieron cargar las reseñas." : "Could not load your reviews."}</p><button type="button" className="btn-ghost mt-2" onClick={() => setTick(x => x + 1)}>{es ? "Reintentar" : "Try again"}</button></div>
      : !current?.data ? <p role="status">{es ? "Cargando…" : "Loading…"}</p>
      : !current.data.eligible ? <p className="text-sm opacity-75">{es ? "Podrá escribir una reseña cuando finalice su estadía confirmada." : "You can review once your confirmed stay has finished."}</p>
      : <><p className="text-sm opacity-75">{es ? "Las reseñas son públicas. Puede publicar una por categoría y estadía." : "Reviews are public. You can publish one per category for this stay."}</p>
        {current.data.targets.map(target => <ReviewForm key={`${key}:${target}`} contractId={contractId} target={target} existing={current.data!.reviews.find(r => r.target === target)} lang={lang} />)}
      </>}
  </section>;
}

function ReviewForm({ contractId, target, existing, lang }: { contractId: string; target: Target; existing?: Review; lang: string }) {
  const es = spanish(lang); const label = targetLabel(target, es);
  const [rating, setRating] = useState(0); const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false); const [saved, setSaved] = useState<Review | undefined>(existing);
  async function publish(e: React.FormEvent) {
    e.preventDefault(); if (busy || !rating) return; setBusy(true); setError(false);
    try {
      const { data, error } = await supabase.rpc("submit_rental_review", { p_contract: contractId, p_target: target, p_rating: rating, p_body: body.trim() || null });
      if (error || !data?.id || data.target !== target) throw Error("Review not saved");
      setSaved(data);
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <div className="border-t border-ink/10 pt-3 dark:border-white/15">
    <h3 className="font-bold">{label}</h3>
    {saved ? <div className="mt-2 text-sm"><p role="status">{es ? "Publicada" : "Published"} · {saved.rating}/5</p>{saved.body && <p className="mt-1 whitespace-pre-wrap break-words">{saved.body}</p>}</div>
      : <form onSubmit={publish} className="mt-2 space-y-3"><fieldset disabled={busy} className="min-w-0 space-y-3">
        <fieldset className="min-w-0"><legend className="text-sm">{es ? "Calificación" : "Rating"}</legend>
          <div className="mt-1 flex flex-wrap gap-1">{[1,2,3,4,5].map(n => <label key={n} className="cursor-pointer">
            <input className="peer sr-only" type="radio" name={`${contractId}-${target}-rating`} value={n} checked={rating === n} onChange={() => setRating(n)} required aria-label={`${n} ${es ? (n === 1 ? "estrella" : "estrellas") : (n === 1 ? "star" : "stars")}`} />
            <span className="flex h-11 min-w-11 items-center justify-center rounded-xl border border-brand/30 px-2 text-sm font-bold peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{n}<span aria-hidden="true" className="ml-1">★</span></span>
          </label>)}</div>
        </fieldset>
        <label className="block text-sm">{es ? "Su experiencia (opcional)" : "Your experience (optional)"}<textarea className="input mt-1 w-full" rows={3} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} /></label>
        <button type="submit" disabled={busy || !rating} aria-busy={busy} className="btn-brand w-full disabled:opacity-50">{busy ? (es ? "Publicando…" : "Publishing…") : (es ? "Publicar reseña" : "Publish review")}</button>
      </fieldset>{error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{es ? "No se pudo publicar. Su texto sigue aquí; vuelva a intentarlo." : "Could not publish. Your text is still here; try again."}</p>}</form>}
  </div>;
}

type Task = { contract_id: string; property_title: string; pending_targets: Target[] };
export function StayReviewTasks({ lang }: { lang: string }) {
  const { userId } = useOneId(); const es = spanish(lang); const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ user: string | null; rows?: Task[]; error?: boolean }>({ user: null });
  useEffect(() => {
    let alive = true; setState({ user: userId }); if (!userId) return;
    (async () => { try { const { data, error } = await supabase.rpc("my_rental_review_tasks"); if (error || !Array.isArray(data)) throw Error("Tasks unavailable"); if (alive) setState({ user: userId, rows: data }); } catch { if (alive) setState({ user: userId, error: true }); } })();
    return () => { alive = false; };
  }, [userId, tick]);
  if (!userId) return null;
  const current = state.user === userId ? state : undefined;
  return <section id="reviews" className="space-y-3"><h2 className="text-base font-bold">{es ? "Reseñas después de su estadía" : "Reviews after your stay"}</h2>
    {current?.error ? <div role="alert"><p>{es ? "No se pudieron cargar las estadías." : "Could not load completed stays."}</p><button type="button" className="btn-ghost" onClick={() => setTick(x => x + 1)}>{es ? "Reintentar" : "Try again"}</button></div>
      : !current?.rows ? <p role="status">{es ? "Cargando…" : "Loading…"}</p>
      : !current.rows.length ? <p className="text-sm opacity-70">{es ? "No tiene reseñas pendientes de estadías finalizadas." : "No completed stays are waiting for your review."}</p>
      : current.rows.map(row => <Link key={row.contract_id} to={productHref("onerental", `/c/${row.contract_id}#reviews`)} className="card ow-tap block p-4"><p className="break-words font-bold">{row.property_title}</p><p className="mt-1 text-sm">{row.pending_targets.map(target => targetLabel(target, es)).join(" · ")} <span aria-hidden="true">→</span></p></Link>)}
  </section>;
}
