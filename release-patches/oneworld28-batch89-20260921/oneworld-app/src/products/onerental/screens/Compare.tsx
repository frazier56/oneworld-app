import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, Wt, ScreenHeading, thumbFor, coverOf, VaiaFace,
  IconSparkle, IconCheck,
} from "@oneworld/shell";
import { priceLabel, type Property } from "../lib/rental";
import { salePriceOnly } from "../../onesale/lib/sale";
import {
  decodePick, encodePick, loadProfile, myAccess, runCompare, lastComparison, compareErrorText,
  type Access, type CompareResult, type Fit,
} from "../lib/homeCompare";
import { useHomeProduct } from "../lib/homeCompare";

/**
 * AI COMPARE — VAIA ranks two or three saved homes against YOUR ideal home. (Lee, 2 Oct 2026)
 * ============================================================================================
 * *"Instead of having a basic matrix… it gives them a conclusion: these are the main things that
 * are different, and this is why this property is better or worse… I rank this one the best, this
 * is the reason why."* Free for every member for now; later part of Pro (Lee, 2 Oct 2026).
 *
 * The order of the screen is the order of the decision: what you are comparing → what you told
 * VAIA matters → the verdict → why, home by home → what differs → what to ask the owner.
 * Access is decided by the database (`my_home_compare_access`): a monthly allowance by plan —
 * Free 3, Pro 10, VIP 30 (Lee, 2 Oct 2026). Nothing here can grant it — the edge function checks again
 * before it spends a token. A comparison of the same homes in the last 24 hours is shown again
 * instead of being re-run, so Back, refresh and re-visits are instant and free.
 */
const FIT_STYLE: Record<Fit["level"], string> = {
  strong: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  weak: "bg-red-500/10 text-red-600 dark:text-red-400",
  unknown: "bg-ink/[0.06] text-ink/60 dark:bg-white/10 dark:text-white/60",
};

export default function Compare() {
  const { lang } = useI18n();
  const prod = useHomeProduct();
  const { userId } = useOneId();
  const [params, setParams] = useSearchParams();
  const pick = decodePick(params.get("ids"));
  const [access, setAccess] = useState<Access | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resultAt, setResultAt] = useState<string | null>(null);

  const profile = useAsync(() => (userId ? loadProfile(userId) : Promise.resolve(null)), [userId], !!userId);

  const checkAccess = () => { setAccess(null); void myAccess().then(setAccess); };
  useEffect(() => { if (userId) checkAccess(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Same homes, same language, same ideal home, in the last 24 hours? Show that answer — no
     wait, no second AI call. */
  const [cacheChecked, setCacheChecked] = useState(false);
  useEffect(() => {
    if (!userId || pick.length < 2 || profile === undefined) return;
    setCacheChecked(false);
    void lastComparison(userId, pick, lang, profile?.updated_at).then(c => {
      if (c) { setResult(c.result); setResultAt(c.created_at); }
      setCacheChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, params.get("ids"), lang, profile?.updated_at, profile === undefined]);
  /* Back from "Define my ideal home" with ?go=1: run it — the person already asked to compare. */
  const autoGo = params.get("go") === "1";
  const [autoDone, setAutoDone] = useState(false);
  useEffect(() => {
    if (!autoGo || autoDone || !cacheChecked || result || running || !access?.allowed || !(profile?.priorities?.length)) return;
    setAutoDone(true);
    const next = new URLSearchParams(params); next.delete("go"); setParams(next, { replace: true });
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGo, autoDone, cacheChecked, result, running, access, profile]);

  const homes = useAsync(async () => {
    const rentIds = pick.filter(p => p.kind === "rent").map(p => p.id);
    const saleIds = pick.filter(p => p.kind === "sale").map(p => p.id);
    const [r, s] = await Promise.all([
      rentIds.length ? supabase.from("rental_properties").select("id, title, photos, cover_photo, price, price_unit, city, neighbourhood, display_currency, display_fx_rate").in("id", rentIds) : Promise.resolve({ data: [] as any[] }),
      saleIds.length ? supabase.from("sale_properties").select("id, title, photos, cover_photo, asking_price, currency, city, neighbourhood").in("id", saleIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const m = new Map<string, any>();
    for (const x of r.data ?? []) m.set(`rent:${x.id}`, { ...x, _kind: "rent" });
    for (const x of s.data ?? []) m.set(`sale:${x.id}`, { ...x, _kind: "sale" });
    return m;
  }, [params.get("ids")], pick.length > 0);

  const home = (kind: string, id: string) => homes?.get(`${kind}:${id}`);
  const price = (h: any) => !h ? "" : h._kind === "rent" ? priceLabel(h as Property, lang) : salePriceOnly(h, h.currency === "COP" ? "COP" : "USD", null);
  const here = `/compare?ids=${encodeURIComponent(encodePick(pick))}&go=1`;

  async function go() {
    setRunning(true); setErr(null);
    try {
      const r = await runCompare(pick, lang);
      setResult(r.result); setResultAt(r.created_at);
      void myAccess().then(setAccess);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      if (e?.code === "monthly_limit" || e?.code === "needs_plan") void myAccess().then(setAccess);
      else setErr(compareErrorText(lang, e?.code));
    } finally { setRunning(false); }
  }

  if (pick.length < 2) {
    return (
      <div className="space-y-4 pb-28">
        <ScreenHeading>{W(lang, "Compare with VAIA", "Comparar con VAIA")}</ScreenHeading>
        <div className="card p-6 text-center">
          <p className="text-[14px] font-bold">{W(lang, "Pick two or three saved places to compare.", "Elija dos o tres guardados para comparar.")}</p>
          <Link to={productHref(prod, "/saved")} className="btn-primary mt-4 inline-block">{W(lang, "Go to Saved", "Ir a Guardados")}</Link>
        </div>
      </div>
    );
  }

  const prios = profile?.priorities ?? [];
  const resetDay = access?.resets_on
    ? new Date(`${access.resets_on}T12:00:00`).toLocaleDateString(lang === "en" ? "en-US" : "es-CO", { day: "numeric", month: "long" })
    : "";

  return (
    <div className="space-y-4 pb-32">
      <ScreenHeading>{W(lang, "Compare with VAIA", "Comparar con VAIA")}</ScreenHeading>

      {/* What is being compared */}
      <div className={`grid gap-2 ${pick.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {pick.map((p, i) => {
          const h = home(p.kind, p.id);
          return (
            <div key={i} className="overflow-hidden rounded-2xl border ow-edge">
              <div className="relative aspect-[4/3] bg-ink/5 dark:bg-white/5">
                {h && coverOf(h) && <img src={thumbFor(coverOf(h)!)} alt="" onError={e => { const t = e.currentTarget; if (t.src !== coverOf(h)) t.src = coverOf(h)!; }} className="h-full w-full object-cover" />}
                <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink/75 text-[12px] font-black text-white">{"ABC"[i]}</span>
              </div>
              <div className="p-1.5">
                <p className="truncate text-[12px] font-black">{price(h)}</p>
                <p className="truncate text-[11px] opacity-60">{h?.title ?? "…"}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Your ideal home */}
      {profile === undefined ? <div className="ow-shimmer h-20 rounded-2xl" /> : !prios.length ? (
        <div className="card p-4">
          <p className="text-[14px] font-black">{W(lang, "First, what matters to you?", "Primero, ¿qué le importa?")}</p>
          <p className="mt-1 text-[12.5px] leading-snug opacity-65">{W(lang, "VAIA ranks these homes against your top five priorities. It takes a minute — speak or type.", "VAIA ordena estos inmuebles según sus cinco prioridades. Toma un minuto — hable o escriba.")}</p>
          <Link to={productHref(prod, `/ideal-home?return=${encodeURIComponent(productHref(prod, here))}`)} className="btn-primary mt-3 inline-block">
            {W(lang, "Define my ideal home", "Definir mi hogar ideal")}
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand/30 bg-brand/[0.06] p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-black uppercase tracking-wide opacity-70">{W(lang, "Judged against your ideal home", "Según su hogar ideal")}</p>
            <Link to={productHref(prod, `/ideal-home?return=${encodeURIComponent(productHref(prod, here))}`)} className="text-[12px] font-bold text-brand-deep dark:text-brand-light">{W(lang, "Edit", "Editar")}</Link>
          </div>
          <ol className="mt-2 flex flex-wrap gap-1.5">
            {prios.map((p, i) => (
              <li key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11.5px] font-semibold dark:bg-white/10">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-brand text-[9.5px] font-black text-white">{i + 1}</span>{p.label}
              </li>
            ))}
          </ol>
        </div>
      )}

      {err && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[12.5px] font-semibold text-red-600 dark:text-red-400">{err}</p>}

      {/* The gate, the button, the wait */}
      {prios.length > 0 && !result && (access === null ? <div className="ow-shimmer h-24 rounded-2xl" /> : access.reason === "error" ? (
        <div className="card p-4 text-center">
          <p className="text-[13.5px] font-bold">{W(lang, "Couldn't reach VAIA just now.", "No se pudo conectar con VAIA.")}</p>
          <button type="button" onClick={checkAccess} className="btn-primary mt-3">{W(lang, "Try again", "Reintentar")}</button>
        </div>
      ) : !access.allowed ? (
        /* THE MONTHLY ALLOWANCE (Lee, 2 Oct 2026): Free 3 · Pro 10 · VIP 30 a month. Out of
           comparisons → say how many they had, when it resets, and what the next plan gives. */
        <section className="card overflow-hidden p-0">
          <div className="bg-gradient-to-br from-brand/15 to-transparent p-4">
            <p className="text-[12px] font-black uppercase tracking-wide text-brand-deep dark:text-brand-light">{W(lang, "Compare with VAIA", "Comparar con VAIA")}</p>
            <p className="mt-1 text-[19px] font-black leading-snug tracking-tight">
              {Wt(lang, "You've used your {0} comparisons this month", "Ya usó sus {0} comparaciones de este mes", [access.limit ?? 3])}
            </p>
            {access.resets_on && <p className="mt-0.5 text-[12.5px] opacity-65">{Wt(lang, "More on {0}.", "Más el {0}.", [resetDay])}</p>}
          </div>
          {access.plan !== "vip" ? (
            <>
              <ul className="space-y-2 p-4 text-[13px]">
                {access.plan !== "pro" && <li className="flex gap-2"><span className="mt-0.5 text-brand"><IconCheck size={15} /></span><span>{W(lang, "Pro: 10 comparisons a month", "Pro: 10 comparaciones al mes")}</span></li>}
                <li className="flex gap-2"><span className="mt-0.5 text-brand"><IconCheck size={15} /></span><span>{W(lang, "VIP: 30 comparisons a month, and VIP in every One World app", "VIP: 30 comparaciones al mes, y VIP en todas las apps de One World")}</span></li>
              </ul>
              <div className="px-4 pb-4">
                {/* Always the OneHome plans (Free · Pro · VIP). A OneHome Pro/VIP covers rent AND sale, and
                    /sales/plans still shows the generic Basic/Pro ladder, which has no VIP. */}
                <Link to={productHref("onerental", "/plans")} className="btn-primary block w-full text-center">{W(lang, "See plans", "Ver planes")}</Link>
              </div>
            </>
          ) : (
            <div className="p-4">
              <Link to={productHref(prod, "/saved")} className="btn-ghost block w-full text-center text-[13px]">{W(lang, "Back to Saved", "Volver a Guardados")}</Link>
            </div>
          )}
        </section>
      ) : running ? (
        <div className="card flex flex-col items-center gap-3 px-4 py-10 text-center">
          <VaiaFace size={72} />
          <p className="text-[14px] font-bold">{W(lang, "VAIA is looking at the photos and the details…", "VAIA está mirando las fotos y los detalles…")}</p>
          <p className="text-[12px] opacity-55">{W(lang, "About 20 seconds.", "Unos 20 segundos.")}</p>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => void go()} className="btn-primary inline-flex w-full items-center justify-center gap-2">
            <IconSparkle size={17} />{W(lang, "Compare now", "Comparar ahora")}
          </button>
          {typeof access.left === "number" && typeof access.limit === "number" && (
            <p className="mt-2 text-center text-[12px] font-semibold opacity-65">
              {Wt(lang, "{0} of {1} left this month", "Le quedan {0} de {1} este mes", [access.left, access.limit])}
            </p>
          )}
        </div>
      ))}

      {/* The verdict */}
      {result && (
        <>
          <section className="card p-4">
            <div className="flex items-center gap-2.5">
              <VaiaFace size={36} />
              <p className="text-[12px] font-black uppercase tracking-wide opacity-70">{W(lang, "VAIA's verdict", "El veredicto de VAIA")}</p>
              {resultAt && <span className="ml-auto text-[11px] opacity-50">{new Date(resultAt).toLocaleString(lang === "en" ? "en-US" : "es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>}
            </div>
            <p className="mt-2 text-[15px] font-semibold leading-relaxed">{result.summary}</p>
          </section>

          <ol className="space-y-3">
            {result.ranking.map(r => {
              const h = home(r.kind, r.id);
              const href = productHref(r.kind === "rent" ? "onerental" : "onesale", `${r.kind === "rent" ? "/r/" : "/s/"}${r.id}`);
              return (
                <li key={r.letter} className={`card overflow-hidden p-0 ${r.rank === 1 ? "ring-2 ring-brand" : ""}`}>
                  <Link to={href} className="flex gap-3 p-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink/5 dark:bg-white/5">
                      {h && coverOf(h) && <img src={thumbFor(coverOf(h)!)} alt="" onError={e => { const t = e.currentTarget; if (t.src !== coverOf(h)) t.src = coverOf(h)!; }} className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-black uppercase tracking-wide text-brand-deep dark:text-brand-light">
                        {r.rank === 1 ? W(lang, "Best match", "Mejor opción") : Wt(lang, "#{0}", "#{0}", [r.rank])} · {r.letter}
                      </p>
                      <p className="truncate text-[14px] font-black">{price(h)}</p>
                      <p className="truncate text-[12px] opacity-60">{h?.title}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${r.score}%` }} />
                        </div>
                        <span className="text-[12px] font-black tabular-nums">{r.score}<span className="font-semibold opacity-50">/100</span></span>
                      </div>
                    </div>
                  </Link>
                  <div className="space-y-3 border-t border-ink/[0.06] p-3 text-[13px] dark:border-white/[0.08]">
                    <p className="font-semibold">{r.verdict}</p>
                    {r.fit.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {r.fit.map((f, i) => (
                          <span key={i} className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${FIT_STYLE[f.level]}`}>
                            {f.level === "strong" ? "✓ " : f.level === "weak" ? "✕ " : f.level === "partial" ? "~ " : "? "}{f.priority}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Phones have no hover: the reason behind each priority is printed, not a tooltip. */}
                    {r.fit.some(f => f.note) && (
                      <ul className="space-y-1 text-[12px] leading-snug">
                        {r.fit.filter(f => f.note).map((f, i) => (
                          <li key={i}><span className="font-bold">{f.priority}:</span> <span className="opacity-75">{f.note}</span></li>
                        ))}
                      </ul>
                    )}
                    {r.why.length > 0 && (
                      <div>
                        <p className="text-[11.5px] font-black uppercase tracking-wide opacity-55">{W(lang, "Why", "Por qué")}</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">{r.why.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                    {r.drawbacks.length > 0 && (
                      <div>
                        <p className="text-[11.5px] font-black uppercase tracking-wide opacity-55">{W(lang, "Watch out for", "Tenga en cuenta")}</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">{r.drawbacks.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                    {r.ask_owner.length > 0 && (
                      <div className="rounded-xl bg-ink/[0.04] p-2.5 dark:bg-white/[0.06]">
                        <p className="text-[11.5px] font-black uppercase tracking-wide opacity-55">{W(lang, "Ask the owner", "Pregúntele al dueño")}</p>
                        <ul className="mt-1 space-y-1">{r.ask_owner.map((t, i) => <li key={i}>• {t}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {result.key_differences.length > 0 && (
            <section className="card p-4">
              <p className="text-[12px] font-black uppercase tracking-wide opacity-70">{W(lang, "What actually differs", "Lo que realmente cambia")}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px]">{result.key_differences.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </section>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Link to={productHref(prod, "/saved")} className="btn-ghost whitespace-nowrap text-center text-[13px]">{W(lang, "Saved", "Guardados")}</Link>
            <button type="button" onClick={() => { setResult(null); setResultAt(null); }} className="btn-ghost whitespace-nowrap text-[13px]">{W(lang, "Run again", "Repetir")}</button>
          </div>
        </>
      )}
    </div>
  );
}
