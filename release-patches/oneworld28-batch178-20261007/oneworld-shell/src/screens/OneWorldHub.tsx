import { Wt } from "../lib/i18n";
import { W } from "../lib/i18n";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { appProfile, appDoorway, PRODUCT_BRAND, dotEdge, inkText, launcherKey, type AppKey } from "../lib/oneWorld";
import { appHasPublicEvidence, fetchPublicAppEvidence } from "../lib/publicAppEvidence";
import ScoreDonut from "../components/ScoreDonut";
import { IconPin } from "../components/ActionIcons";
import { useBadgeTier } from "../lib/useBadgeTier";

/**
 * THE ONE WORLD PAGE — the destination behind "View my World".
 * ============================================================================================
 * Lee's framing (1 Aug): *"it's similar to Linktree, but we actually SHOW the content from each of
 * the neighbouring apps rather than just linking out… everything in one place. One World."* So the
 * rule that decides every panel: A PANEL MUST SHOW SOMETHING TRUE ABOUT THIS PERSON, OR IT MUST NOT
 * BE HERE. A row of app logos is a link tree; a row of app logos with real numbers under them is a
 * reason to open the next app.
 *
 * Two views, one page:
 *  · OWNER  — every app, connected or not, plus a public-view toggle and a share control.
 *  · PUBLIC — connected apps only. A stranger does not need a list of things you have not done.
 *
 * Each panel wears ITS OWN app's voice (from PRODUCT_BRAND), not this page's — One World is the
 * parent surface and its whole job is to hold the spectrum while each product keeps its one hue.
 * This is a SHELL screen: identical on every app, mounted at `/<product>/world/:userId`.
 */
export default function OneWorldHub({ product }: { product: AppKey }) {
  const { lang } = useI18n();
  const { userId: routeId } = useParams();
  const { userId: myId, displayName, photoUrl, has } = useOneId();
  const userId = routeId ?? myId ?? "";
  const isOwner = !!myId && myId === userId;

  const { tier } = useBadgeTier(userId);

  const prof = useAsync(async () => {
    const { data } = await supabase.from("profiles")
      .select("full_name, photo_url, job_title, location, score_v9_snapshot").eq("id", userId).maybeSingle();
    return data as { full_name: string | null; photo_url: string | null; job_title: string | null; location: string | null; score_v9_snapshot: number | null } | null;
  }, [userId], !!userId);

  const evidence = useAsync(async () => fetchPublicAppEvidence(userId), [userId], !!userId);

  const rating = useAsync(async () => {
    const { data } = await supabase.from("job_reviews").select("rating").eq("reviewee_id", userId);
    const r = (data ?? []).map(x => x.rating);
    return r.length ? (r.reduce((a, b) => a + b, 0) / r.length / 7 * 5) : null;
  }, [userId], !!userId);

  const name = prof?.full_name ?? displayName ?? "";
  const first = name.split(" ")[0] || "";
  const photo = prof?.photo_url ?? photoUrl ?? null;
  const score = prof?.score_v9_snapshot ?? null;
  const here = launcherKey(product);
  const connected = (k: AppKey) => isOwner
    ? k === here || has(k)
    : appHasPublicEvidence(k, evidence);

  type Panel = { key: AppKey; tagline: string; stats: { v: string; l: string }[]; donut?: number | null };
  const PANELS: Panel[] = [
    { key: "onescore", tagline: W(lang, "Their credibility", "Su credibilidad"), donut: score, stats: score != null ? [{ v: String(Math.round(score)), l: "OneScore" }] : [] },
    { key: "onejob", tagline: W(lang, "Work & pay", "Trabajo y pagos"), stats: [
      { v: String((evidence?.onejob.completed ?? 0) + (evidence?.onejob.hosted ?? 0)), l: W(lang, "Jobs", "Trabajos") },
      { v: rating != null ? rating.toFixed(1) : "—", l: W(lang, "Rating", "Nota") },
      { v: String(evidence?.onejob.reviews ?? 0), l: W(lang, "Reviews", "Reseñas") },
    ] },
    { key: "oneevent", tagline: W(lang, "Events", "Eventos"), stats: [{ v: String(evidence?.oneevent.hosted ?? 0), l: W(lang, "Events", "Eventos") }] },
    { key: "onesocial", tagline: W(lang, "Their socials", "Sus redes"), stats: [{ v: String(evidence?.onesocial.platforms ?? 0), l: W(lang, "Platforms", "Plataformas") }] },
    { key: "oneagent", tagline: W(lang, "Their agent", "Su agente"), stats: [] },
    { key: "onehome", tagline: W(lang, "Homes", "Inmuebles"), stats: [{ v: String(evidence?.onehome.listings ?? 0), l: W(lang, "Listings", "Anuncios") }] },
    { key: "onepay", tagline: W(lang, "Their payments", "Sus pagos"), stats: [] },
    { key: "onebusiness", tagline: W(lang, "Their business", "Su negocio"), stats: [] },
    { key: "oneride", tagline: W(lang, "Their rides", "Sus viajes"), stats: [] },
  ];

  const visible = isOwner ? PANELS : PANELS.filter(p => connected(p.key));

  return (
    <div className="space-y-4">
      {/* ── Who this is ── */}
      <header className="text-center">
        <div className="mx-auto h-24 w-24 overflow-hidden rounded-3xl border-2 border-brand/40">
          {photo ? <img decoding="async" src={photo} alt="" className="h-full w-full object-cover" />
            : <div className="grid h-full w-full place-items-center bg-brand/15 text-2xl font-extrabold text-brand">{first[0]?.toUpperCase() ?? "?"}</div>}
        </div>
        <h1 className="mt-4 text-[26px] font-extrabold leading-tight">
          {Wt(lang, "{0}'s One World", "El One World de {0}", [first])}
        </h1>
        {prof?.job_title && <p className="mt-1 text-sm opacity-70">{prof.job_title}</p>}
        {prof?.location && (
          <p className="flex items-center gap-1 text-sm opacity-55">
            <IconPin size={13} className="shrink-0" />{prof.location}
          </p>
        )}
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed opacity-70">
          {W(lang, "Everything in one place. One World.", "Todo en un solo lugar. One World.")}
        </p>
      </header>

      {/* ── The apps, each a panel that shows something true ── */}
      <div className="space-y-3">
        {visible.map(p => {
          const brand = PRODUCT_BRAND[p.key];
          const on = connected(p.key);
          if (!on) {
            return (
              <a key={p.key} href={appDoorway(p.key)} target="_blank" rel="noreferrer"
                className="card flex w-full items-center gap-3 border-dashed px-4 py-4 text-left"
                style={{ borderColor: `${brand.dot}52` }}>
                <span className={`h-7 w-7 shrink-0 rounded-full${dotEdge(p.key)}`} style={{ background: brand.dot, opacity: .55 }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold">{brand.name}</p>
                  <p className="truncate text-[12px] opacity-60">{W(lang, "Tap to get the app", "Tócalo para obtener la app")}</p>
                </div>
                {isOwner && <span className={`text-lg font-bold${inkText(p.key)}`} style={{ color: brand.dot }}>+</span>}
              </a>
            );
          }
          const dest = p.key === product ? appProfile(product, userId) : appDoorway(p.key);
          const external = dest.startsWith("http");
          const inner = (
            <>
              <div className="flex items-center gap-3">
                <span className={`h-7 w-7 shrink-0 rounded-full${dotEdge(p.key)}`} style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${brand.dot} 70%)` }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold leading-tight">{brand.name}</p>
                  <p className="truncate text-[12px] opacity-60">{p.tagline}</p>
                </div>
                <span className={`text-sm${inkText(p.key)}`} style={{ color: brand.dot }}>↗</span>
              </div>
              {(p.donut != null || p.stats.length > 0) && (
                <div className="mt-3.5 flex items-center gap-4">
                  {p.donut != null && <div className="shrink-0"><ScoreDonut score={p.donut} size={64} tier={tier ?? undefined} /></div>}
                  {p.stats.length > 0 && (
                    <div className={`grid flex-1 gap-x-4 gap-y-2 ${p.stats.length >= 3 ? "grid-cols-3" : p.stats.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                      {p.stats.map((s, i) => (
                        <div key={i} className="min-w-0">
                          <p className={`text-[19px] font-extrabold leading-none${inkText(p.key)}`} style={{ color: brand.dot }}>{s.v}</p>
                          <p className="mt-1 text-[9.5px] font-semibold uppercase leading-tight tracking-wide opacity-65">{s.l}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          );
          const cls = "card block w-full px-4 py-4 text-left transition-transform active:scale-[.99]";
          return external
            ? <a key={p.key} href={dest} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
            : <Link key={p.key} to={dest} className={cls}>{inner}</Link>;
        })}
      </div>

      <div className="pt-2 text-center">
        <Link to={appProfile(product, userId)} className="text-sm font-semibold text-brand">
          {isOwner ? (W(lang, "← Back to my profile", "← Volver a mi perfil")) : Wt(lang, "See {0}'s profile →", "Ver el perfil de {0} →", [first])}
        </Link>
      </div>
    </div>
  );
}
