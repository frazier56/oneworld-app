import { ScreenHeading } from "@oneworld/shell";
import { Link } from "react-router-dom";
import { useI18n, productHref, W } from "@oneworld/shell";
import { CLASS_VALUE, ASSET_CLASSES } from "./calculator";

/**
 * /onescore/how — drawer extra: the explanation, for the people who want one.
 * ============================================================================================
 * Deliberately NOT the centre screen. The centre answers "how do I raise it"; this answers
 * "how does it work" — the two were once one screen and the actionable half drowned.
 */
export default function HowScreen() {
  const { lang, t } = useI18n();
  const NAMES: Record<string, [string, string]> = {
    identity: ["Identity", "Identidad"], license: ["Licence", "Licencia"],
    reviews: ["Reviews", "Reseñas"], paid_work: ["Paid work (money received)", "Trabajo pagado (dinero recibido)"],
    certification: ["Certifications", "Certificaciones"], audience: ["Audience", "Audiencia"],
    presence: ["Web presence", "Presencia web"],
  };
  return (
    <div className="space-y-4">
      <ScreenHeading>{t("howItWorks")}</ScreenHeading>

      <div className="card space-y-2 p-4 text-[13.5px] leading-relaxed">
        <p>{W(lang,
          "Your OneScore is one published number built from evidence: what you've connected, how strongly it's verified, who has endorsed you, and the contracts you've proven.",
          "Tu OneScore es un número publicado construido con evidencia: lo que conectaste, qué tan verificado está, quién te recomendó y los contratos que probaste.")}</p>
        <p>{W(lang,
          "Verification is the biggest lever. The same account is worth six times more account-verified than self-reported — and with no identity verification at all, your whole score is held back 10%.",
          "La verificación es la palanca más grande. La misma cuenta vale seis veces más verificada que auto-declarada — y sin verificación de identidad, todo tu puntaje se retiene un 10%.")}</p>
        <p>{W(lang,
          "There are multiple ways to a high score: a licensed tradesperson with no social media and a creator with no licence can land within a few points of each other.",
          "Hay varios caminos a un puntaje alto: un profesional con licencia sin redes y un creador sin licencia pueden quedar a pocos puntos de distancia.")}</p>
      </div>

      <div className="card p-4">
        <p className="font-extrabold">{W(lang, "What each area is worth", "Cuánto vale cada área")}</p>
        <div className="mt-2 space-y-1.5">
          {ASSET_CLASSES.map(c => (
            <div key={c} className="flex items-center justify-between text-[13px]">
              <span>{W(lang, NAMES[c][0], NAMES[c][1])}</span>
              <span className="font-extrabold opacity-70">{CLASS_VALUE[c]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-2 p-4 text-[13.5px] leading-relaxed">
        <p>{W(lang,
          "Your badge — Member, Verified, Trusted, Authority — is a separate, parallel track earned by activity. The ring's colour is the badge; the arc is the score. Neither drives the other.",
          "Tu insignia — Member, Verified, Trusted, Authority — es una vía paralela, ganada por actividad. El color del anillo es la insignia; el arco es el puntaje. Ninguno controla al otro.")}</p>
        {/* The legally load-bearing line, verbatim from the terms gate. */}
        <p className="font-bold">{t("termsP2")}</p>
      </div>

      <Link to={productHref("onescore", "/score")} className="btn-brand block w-full text-center">
        {W(lang, "See how to raise yours", "Mira cómo subir el tuyo")}
      </Link>
    </div>
  );
}
