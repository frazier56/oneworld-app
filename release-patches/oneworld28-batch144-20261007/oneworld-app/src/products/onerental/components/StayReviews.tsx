import { W } from "@oneworld/shell";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase, useOneId, productHref } from "@oneworld/shell";

type Target = "property" | "host" | "guest";
type Review = { id: string; target: Target; rating: number; body: string | null };
type Context = { contract_id: string; eligible: boolean; targets: Target[]; reviews: Review[] };
const spanish = (lang: string) => lang === "es" || lang === "co";
const targetLabel = (target: Target, lang: string) => ({ property: W(lang, "Property", "Inmueble"), host: W(lang, "Host", "Anfitrión"), guest: W(lang, "Guest", "Huésped") })[target];

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
    <h2 className="text-base font-bold">{W(lang, "Reviews after your stay", "Reseñas después de su estadía")}</h2>
    {current?.error ? <div role="alert"><p>{W(lang, "Could not load your reviews.", "No se pudieron cargar las reseñas.")}</p><button type="button" className="btn-ghost mt-2" onClick={() => setTick(x => x + 1)}>{W(lang, "Try again", "Reintentar")}</button></div>
      : !current?.data ? <p role="status">{W(lang, "Loading…", "Cargando…")}</p>
      : !current.data.eligible ? <p className="text-sm opacity-75">{W(lang, "You can review once your confirmed stay has finished.", "Podrá escribir una reseña cuando finalice su estadía confirmada.")}</p>
      : <><p className="text-sm opacity-75">{W(lang, "Reviews are public. You can publish one per category for this stay.", "Las reseñas son públicas. Puede publicar una por categoría y estadía.")}</p>
        {current.data.targets.map(target => <ReviewForm key={`${key}:${target}`} contractId={contractId} target={target} existing={current.data!.reviews.find(r => r.target === target)} lang={lang} />)}
      </>}
  </section>;
}

function ReviewForm({ contractId, target, existing, lang }: { contractId: string; target: Target; existing?: Review; lang: string }) {
  const es = spanish(lang); const label = targetLabel(target, lang);
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
    {saved ? <div className="mt-2 text-sm"><p role="status">{W(lang, "Published", "Publicada")} · {saved.rating}/5</p>{saved.body && <p className="mt-1 whitespace-pre-wrap break-words">{saved.body}</p>}</div>
      : <form onSubmit={publish} className="mt-2 space-y-3"><fieldset disabled={busy} className="min-w-0 space-y-3">
        <fieldset className="min-w-0"><legend className="text-sm">{W(lang, "Rating", "Calificación")}</legend>
          <div className="mt-1 flex flex-wrap gap-1">{[1,2,3,4,5].map(n => <label key={n} className="cursor-pointer">
            <input className="peer sr-only" type="radio" name={`${contractId}-${target}-rating`} value={n} checked={rating === n} onChange={() => setRating(n)} required aria-label={`${n} ${es ? (n === 1 ? "estrella" : "estrellas") : (n === 1 ? "star" : "stars")}`} />
            <span className="flex h-11 min-w-11 items-center justify-center rounded-xl border border-brand/30 px-2 text-sm font-bold peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{n}<span aria-hidden="true" className="ml-1">★</span></span>
          </label>)}</div>
        </fieldset>
        <label className="block text-sm">{W(lang, "Your experience (optional)", "Su experiencia (opcional)")}<textarea className="input mt-1 w-full" rows={3} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} /></label>
        <button type="submit" disabled={busy || !rating} aria-busy={busy} className="btn-brand w-full disabled:opacity-50">{busy ? (W(lang, "Publishing…", "Publicando…")) : (W(lang, "Publish review", "Publicar reseña"))}</button>
      </fieldset>{error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{W(lang, "Could not publish. Your text is still here; try again.", "No se pudo publicar. Su texto sigue aquí; vuelva a intentarlo.")}</p>}</form>}
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
  /* ── ⚠️ A SECTION WITH NOTHING IN IT IS STILL A SECTION YOU SCROLL PAST ────────────────────
     This printed its heading unconditionally, so on the requests screen a host with no finished
     stays — which is every host until a lease ends — read "Reviews after your stay" followed by
     a sentence saying there weren't any. Lee, 20 Sep 2026: *"you can't be showing all this on
     the screen at one time."* An empty optional queue costs nothing now.

     The FAILURE still shows, quietly and with a retry. Hiding a section because its query broke
     is how a host silently stops being told about reviews they owe — the same species of quiet
     as a control you cannot see. Loading shows nothing: a spinner for a section that is usually
     empty is a promise of content that is usually not coming. */
  if (!current || (!current.error && (!current.rows || current.rows.length === 0))) return null;
  return <section id="reviews" className="space-y-3"><h2 className="text-base font-bold">{W(lang, "Reviews after your stay", "Reseñas después de su estadía")}</h2>
    {current?.error ? <div role="alert" className="card p-4"><p className="text-[13.5px] font-semibold">{W(lang, "Could not load completed stays.", "No se pudieron cargar las estadías.")}</p><button type="button" className="btn-ghost mt-2" onClick={() => setTick(x => x + 1)}>{W(lang, "Try again", "Reintentar")}</button></div>
      : current.rows!.map(row => <Link key={row.contract_id} to={productHref("onerental", `/c/${row.contract_id}#reviews`)} className="card ow-tap block p-4"><p className="break-words font-bold">{row.property_title}</p><p className="mt-1 text-sm">{row.pending_targets.map(target => targetLabel(target, lang)).join(" · ")} <span aria-hidden="true">→</span></p></Link>)}
  </section>;
}
