import { ScreenHeading } from "@oneworld/shell";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useI18n, useOneId, useBadgeTier, W, ScoreDonut, productHref,
} from "@oneworld/shell";
import {
  computeOneScore, rankedActions, CLASS_VALUE, ASSET_CLASSES, type AssetClass,
} from "./calculator";
import { useScoreData } from "./useScoreData";

/**
 * /onescore/score — THE RAISED CENTRE: your score DASHBOARD.
 * ============================================================================================
 * Lee (9 Aug): the centre button is the screen you come back to daily — the dashboard. So:
 * the published number, your strongest area, and the per-area breakdown live at the top;
 * "How to raise it" is a COLLAPSIBLE section (valuable, not daily); connecting things lives on
 * Connect (tab 2), not here. The Simulator stays one tap away.
 *
 * Honesty on the numbers: the "+X" on an action can never promise more than the distance to
 * 100 from the number the person actually sees — an earlier cut showed "+56" next to a
 * published 72.5, which is arithmetic a user catches instantly.
 */
const AREA_COPY: Record<AssetClass, { en: string; es: string }> = {
  identity: { en: "Identity", es: "Identidad" },
  license: { en: "Licences", es: "Licencias" },
  reviews: { en: "Reviews", es: "Reseñas" },
  paid_work: { en: "Paid work", es: "Trabajo pagado" },
  certification: { en: "Certifications", es: "Certificaciones" },
  audience: { en: "Audience", es: "Audiencia" },
  presence: { en: "Web presence", es: "Presencia web" },
};

const ACTION_COPY: Record<string, { en: string; es: string; to: string }> = {
  verify_identity: { en: "Verify your identity", es: "Verifica tu identidad", to: "/connect" },
  add_license: { en: "Add a professional licence", es: "Agrega tu licencia", to: "/connect" },
  connect_reviews: { en: "Connect your reviews", es: "Conecta tus reseñas", to: "/connect" },
  connect_paid_work: { en: "Connect paid work", es: "Conecta trabajo pagado", to: "/connect" },
  add_certification: { en: "Add a certification", es: "Agrega una certificación", to: "/connect" },
  connect_audience: { en: "Connect your audience", es: "Conecta tu audiencia", to: "/connect" },
  add_presence: { en: "Add your web presence", es: "Agrega tu presencia web", to: "/connect" },
};

export default function ScoreScreen() {
  const { lang, t } = useI18n();
  const { userId } = useOneId();
  const { tier } = useBadgeTier(userId);
  const { published, input, loaded } = useScoreData();
  const [howOpen, setHowOpen] = useState(false);

  const breakdown = useMemo(() => (loaded ? computeOneScore(input) : null), [loaded, input]);

  /* Strongest area = the class contributing the most points right now. */
  const strongest = useMemo(() => {
    if (!breakdown) return null;
    const best = ASSET_CLASSES.map(c => [c, breakdown.perClass[c]] as const)
      .sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : null;
  }, [breakdown]);

  const basis = published ?? breakdown?.score ?? 0;
  const actions = useMemo(() => {
    if (!loaded) return [];
    /* Cap every promise at the distance to 100 from the number on screen. */
    return rankedActions(input)
      .map(a => ({ ...a, points: Math.min(a.points, Math.max(0, 100 - basis)) }))
      .filter(a => a.points > 0.05);
  }, [loaded, input, basis]);

  return (
    <div className="space-y-4">
      <ScreenHeading>{t("myscore")}</ScreenHeading>

      {/* The published number — the one every One World app shows. */}
      <div className="card flex items-center gap-5 p-5">
        <ScoreDonut score={published} size={112} tier={tier ?? undefined} />
        <div className="min-w-0">
          <p className="text-sm font-bold opacity-70">{W(lang, "Your published OneScore", "Tu OneScore publicado")}</p>
          <p className="mt-1 text-[13px] leading-snug opacity-60">
            {W(lang, "One number, the same in every One World app.", "Un solo número, igual en todas las apps de One World.")}
          </p>
          {published == null && (
            <Link to={productHref("onescore", "/connect")} className="mt-2 block text-[13px] font-bold text-brand">
              {W(lang, "Not published yet — connect your world to build it →", "Aún no publicado — conecta tu mundo para construirlo →")}
            </Link>
          )}
        </div>
      </div>

      {/* Strongest area — the standalone build's line Lee liked. */}
      {strongest && (
        <div className="card p-4 text-[13.5px] leading-snug">
          <span className="font-extrabold">{W(lang, AREA_COPY[strongest].en, AREA_COPY[strongest].es)}</span>{" "}
          {W(lang,
            "is your strongest area — it carries the most weight in your score. Everything else adds on top.",
            "es tu área más fuerte — es la que más pesa en tu puntaje. Todo lo demás suma encima.")}
        </div>
      )}

      {/* The breakdown — where the evidence stands, area by area. */}
      {breakdown && (
        <div className="card space-y-3 p-4">
          <p className="font-extrabold">{W(lang, "Where your score comes from", "De dónde viene tu puntaje")}</p>
          {ASSET_CLASSES.map(c => {
            const got = breakdown.perClass[c];
            const max = CLASS_VALUE[c];
            return (
              <div key={c}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold">{W(lang, AREA_COPY[c].en, AREA_COPY[c].es)}</span>
                  <span className="font-extrabold opacity-70">{got.toFixed(1)} / {max}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(100, (got / max) * 100)}%` }} />
                </div>
              </div>
            );
          })}
          {(breakdown.contractBonus > 0 || breakdown.endorsementBonus > 0) && (
            <p className="text-[12.5px] opacity-60">
              {W(lang, "Plus", "Más")}{" "}
              {breakdown.contractBonus > 0 && `+${breakdown.contractBonus.toFixed(1)} ${W(lang, "from proven contracts", "por contratos probados")}`}
              {breakdown.contractBonus > 0 && breakdown.endorsementBonus > 0 && " · "}
              {breakdown.endorsementBonus > 0 && `+${breakdown.endorsementBonus.toFixed(1)} ${W(lang, "from endorsements", "por recomendaciones")}`}
            </p>
          )}
          {!breakdown.identityVerified && (
            <p className="text-[12.5px] font-bold text-brand">
              {W(lang, "Your whole score is held back 10% until your identity is verified.",
                "Todo tu puntaje se retiene un 10% hasta verificar tu identidad.")}
            </p>
          )}
        </div>
      )}

      {/* How to raise it — collapsible: valuable, not daily (Lee, 9 Aug). */}
      <div className="card p-0">
        <button onClick={() => setHowOpen(o => !o)}
          className="flex w-full items-center justify-between px-4 py-3.5">
          <span className="font-extrabold">{W(lang, "How to raise it", "Cómo subirlo")}</span>
          <span className={`transition ${howOpen ? "rotate-180" : ""}`}>▾</span>
        </button>
        {howOpen && (
          <div className="border-t border-ink/5 dark:border-white/5">
            {actions.length ? actions.map((a, i) => {
              const c = ACTION_COPY[a.key];
              return (
                <Link key={a.key} to={productHref("onescore", c?.to ?? "/connect")}
                  className={`flex items-center gap-3 px-4 py-3 transition hover:bg-brand/5 ${i ? "border-t border-ink/5 dark:border-white/5" : ""}`}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink/5 text-[11px] font-extrabold dark:bg-white/10">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{c ? W(lang, c.en, c.es) : a.key}</span>
                  <span className="shrink-0 rounded-full bg-teal/15 px-2.5 py-1 text-[12px] font-extrabold text-teal-deep dark:text-teal-light">
                    +{a.points.toFixed(1)}
                  </span>
                </Link>
              );
            }) : (
              <p className="px-4 py-3 text-[13px] opacity-60">
                {W(lang, "Every lever is pulled — from here it grows with real work and endorsements.",
                  "Todas las palancas activadas — desde aquí crece con trabajo real y recomendaciones.")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* The legally load-bearing boundary, where the person is actually looking. */}
      <p className="px-1 text-[12px] leading-snug opacity-50">{t("termsP2")}</p>

      <Link to={productHref("onescore", "/simulator")} className="btn-ghost block w-full text-center">
        {W(lang, "Open the Simulator — what if I add X?", "Abre el Simulador — ¿y si agrego X?")}
      </Link>
    </div>
  );
}
