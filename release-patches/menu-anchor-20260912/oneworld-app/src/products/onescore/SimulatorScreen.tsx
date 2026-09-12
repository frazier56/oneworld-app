import { ScreenHeading } from "@oneworld/shell";
import { useMemo, useState } from "react";
import { useI18n, useOneId, useBadgeTier, ScoreDonut, W } from "@oneworld/shell";
import {
  ASSET_CLASSES, computeOneScore, CONTRACT_LEVELS,
  type AssetClass, type ContractTier, type ProofLevel, type ScoreInput,
} from "./calculator";
import { useScoreData } from "./useScoreData";

/**
 * /onescore/simulator — TAB 4: "what if I add X?"
 * ============================================================================================
 * Starts from the person's REAL evidence and lets them toggle hypotheticals; the engine is the
 * same `computeOneScore` behind the ranked list, so the what-if and the to-do never disagree.
 * The simulated number is loudly labelled a simulation — the published number stays
 * `score_v9_snapshot` and nothing here writes anything, anywhere.
 */
const SIM_CLASSES: { cls: AssetClass; proof: ProofLevel; en: string; es: string }[] = [
  { cls: "identity", proof: "oauth", en: "Verify identity", es: "Verificar identidad" },
  { cls: "license", proof: "attested", en: "Licence on file", es: "Licencia registrada" },
  { cls: "reviews", proof: "oauth", en: "Reviews connected", es: "Reseñas conectadas" },
  { cls: "paid_work", proof: "oauth", en: "Paid work connected", es: "Trabajo pagado conectado" },
  { cls: "certification", proof: "code_challenge", en: "Certification added", es: "Certificación agregada" },
  { cls: "audience", proof: "oauth", en: "Audience connected", es: "Audiencia conectada" },
  { cls: "presence", proof: "handle_match", en: "Web presence added", es: "Presencia web agregada" },
];

const TIERS: { tier: ContractTier; en: string; es: string }[] = [
  { tier: "local", en: "A neighbour", es: "Un vecino" },
  { tier: "regional", en: "A regional business", es: "Negocio regional" },
  { tier: "national", en: "A national brand", es: "Marca nacional" },
  { tier: "major", en: "Nike-level", es: "Nivel Nike" },
];

export default function SimulatorScreen() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const { tier } = useBadgeTier(userId);
  const { published, input, loaded } = useScoreData();

  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [contract, setContract] = useState<ContractTier | null>(null);
  const [endorser, setEndorser] = useState(0);

  const sim = useMemo(() => {
    const assets = [
      ...input.assets,
      ...SIM_CLASSES.filter(s => added[s.cls]).map(s => ({ class: s.cls, proof: s.proof })),
    ];
    const simInput: ScoreInput = {
      assets,
      contracts: [...(input.contracts ?? []), ...(contract ? [{ tier: contract }] : [])],
      endorsements: [...(input.endorsements ?? []), ...(endorser > 0 ? [{ endorserScore: endorser }] : [])],
    };
    return computeOneScore(simInput);
  }, [input, added, contract, endorser]);

  const baseline = useMemo(() => computeOneScore(input).score, [input]);
  const anyChange = Object.values(added).some(Boolean) || !!contract || endorser > 0;

  return (
    <div className="space-y-4">
      <div>
        <ScreenHeading className="mb-0">{W(lang, "Simulator", "Simulador")}</ScreenHeading>
        <p className="mt-0.5 text-[13px] opacity-60">
          {W(lang, "What would each move be worth? Flip things on and watch.",
            "¿Cuánto valdría cada paso? Actívalos y mira.")}
        </p>
      </div>

      {/* Simulated ring — the tier metal never changes here: tiers are earned by activity,
          not simulated. Only the arc and depth move. */}
      <div className="card flex items-center gap-5 p-5">
        <ScoreDonut score={anyChange ? sim.score : baseline} size={112} tier={tier ?? undefined} />
        <div>
          <p className="text-sm font-bold opacity-70">
            {anyChange
              ? W(lang, "Simulated score", "Puntaje simulado")
              : W(lang, "Your evidence today", "Tu evidencia hoy")}
          </p>
          {anyChange && (
            <p className="mt-1 text-[13px] font-extrabold text-teal-deep dark:text-teal-light">
              {sim.score >= baseline ? "+" : ""}{(sim.score - baseline).toFixed(1)}{" "}
              {W(lang, "vs today", "vs hoy")}
            </p>
          )}
          <p className="mt-1 text-[12px] leading-snug opacity-50">
            {W(lang,
              `Published score stays ${published ?? "—"} until recalculated.`,
              `El puntaje publicado sigue en ${published ?? "—"} hasta recalcular.`)}
          </p>
        </div>
      </div>

      {!loaded ? (
        <div className="card p-6 text-center text-sm opacity-60">…</div>
      ) : (
        <>
          <div className="card divide-y divide-ink/5 p-0 dark:divide-white/5">
            {SIM_CLASSES.map(s => {
              const already = input.assets.some(a => a.class === s.cls);
              const on = already || !!added[s.cls];
              return (
                <button key={s.cls}
                  disabled={already}
                  onClick={() => setAdded(p => ({ ...p, [s.cls]: !p[s.cls] }))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-50">
                  <span className="font-bold">{W(lang, s.en, s.es)}</span>
                  <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-teal" : "bg-ink/20 dark:bg-white/20"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="card p-4">
            <p className="font-extrabold">{W(lang, "A signed contract with…", "Un contrato firmado con…")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TIERS.map(t2 => (
                <button key={t2.tier}
                  onClick={() => setContract(c => c === t2.tier ? null : t2.tier)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${
                    contract === t2.tier ? "bg-teal text-white" : "border border-ink/10 dark:border-white/15"}`}>
                  {W(lang, t2.en, t2.es)}
                </button>
              ))}
            </div>
            {contract && (
              <p className="mt-2 text-[12px] opacity-55">
                {W(lang,
                  `Counterparty level ${CONTRACT_LEVELS[contract]} — the best relationship sets the level.`,
                  `Nivel de contraparte ${CONTRACT_LEVELS[contract]} — la mejor relación fija el nivel.`)}
              </p>
            )}
          </div>

          <div className="card p-4">
            <p className="font-extrabold">{W(lang, "An endorsement from a…", "Una recomendación de un…")}</p>
            <p className="mt-0.5 text-[12px] opacity-55">
              {W(lang, "Their own score is what your endorsement is worth — squared.",
                "Su propio puntaje define el valor — al cuadrado.")}
            </p>
            <input type="range" min={0} max={100} step={5} value={endorser}
              onChange={e => setEndorser(Number(e.target.value))}
              className="mt-3 w-full accent-[#15C2B2]" />
            <p className="mt-1 text-[13px] font-bold">
              {endorser === 0
                ? W(lang, "No endorsement", "Sin recomendación")
                : W(lang, `Endorser scoring ${endorser}`, `Con puntaje ${endorser}`)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
