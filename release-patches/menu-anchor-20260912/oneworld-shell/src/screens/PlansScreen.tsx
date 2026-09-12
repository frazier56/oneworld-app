import { useI18n } from "../lib/i18n";
import { W } from "../lib/i18n";
import { PRODUCT_BRAND, type AppKey } from "../lib/oneWorld";
import ScreenHeading from "../components/ScreenHeading";

/**
 * PLANS — the shared paid-tier screen (SHELL, Lee 9 Aug: "every one of our apps is going to
 * have some level of enhanced experience if you pay a small monthly fee").
 * ============================================================================================
 * One screen, every product: free is real and stays free; the paid tiers say exactly what they
 * add; a product passes its own tier copy or inherits the default ladder. Reached from the
 * drawer ("Plans") and, later, from the onboarding pricing step.
 *
 * HONESTY RULE: checkout is NOT wired yet — Stripe products/prices and the promo-code leg are
 * a protected-money build with its own review. Until then the button says so instead of
 * pretending. No fee figures beyond the subscription price appear here, ever.
 */
export interface PlanTier {
  key: string;
  nameEn: string; nameEs: string;
  price: string;              // "$4.99" — display only
  perEn?: string; perEs?: string;
  tagEn?: string; tagEs?: string;
  popular?: boolean;
  bulletsEn: string[]; bulletsEs: string[];
}

export const DEFAULT_TIERS: PlanTier[] = [
  {
    key: "free", nameEn: "Free", nameEs: "Gratis", price: "$0",
    perEn: "forever", perEs: "para siempre",
    bulletsEn: [
      "Everything the product does today",
      "Connect unlimited sources",
      "Share cards and public profile",
      "Manual refresh anytime",
    ],
    bulletsEs: [
      "Todo lo que el producto hace hoy",
      "Conecta fuentes ilimitadas",
      "Comparte tarjetas y perfil público",
      "Actualización manual cuando quieras",
    ],
  },
  {
    key: "basic", nameEn: "Basic", nameEs: "Básico", price: "$4.99",
    perEn: "/month", perEs: "/mes", tagEn: "Always current", tagEs: "Siempre al día",
    bulletsEn: [
      "Everything in Free",
      "Auto-updates — new activity detected automatically",
      "Fresh data every week, no taps",
      "Change history",
    ],
    bulletsEs: [
      "Todo lo del plan Gratis",
      "Actualización automática de tu actividad",
      "Datos frescos cada semana, sin tocar nada",
      "Historial de cambios",
    ],
  },
  {
    key: "pro", nameEn: "Pro", nameEs: "Pro", price: "$9.99",
    perEn: "/month", perEs: "/mes", tagEn: "Optimize & protect", tagEs: "Optimiza y protege",
    popular: true,
    bulletsEn: [
      "Everything in Basic",
      "Ranked, personalized moves to improve",
      "Email + text alerts the moment something changes",
      "Priority refresh",
    ],
    bulletsEs: [
      "Todo lo del plan Básico",
      "Sugerencias personalizadas y priorizadas",
      "Alertas por correo y SMS al instante",
      "Actualización prioritaria",
    ],
  },
];

export default function PlansScreen({ product, tiers }: {
  product: AppKey;
  /** Product-specific ladder; omit to inherit the default Free/Basic/Pro. */
  tiers?: PlanTier[];
}) {
  const { lang } = useI18n();
  const T = tiers ?? DEFAULT_TIERS;
  const brand = PRODUCT_BRAND[product].name;

  return (
    <div className="space-y-4">
      <div>
        <ScreenHeading className="mb-0">{W(lang, "Plans", "Planes")}</ScreenHeading>
        <p className="mt-0.5 text-[13px] opacity-60">
          {W(lang,
            `${brand} is free forever. Upgrade when you want it working for you automatically.`,
            `${brand} es gratis para siempre. Mejora cuando quieras que trabaje por ti automáticamente.`)}
        </p>
      </div>

      {T.map(t => (
        <div key={t.key} className={`card p-5 ${t.popular ? "ring-2 ring-teal" : ""}`}>
          {t.popular && (
            <span className="mb-2 inline-block rounded-full bg-teal px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-white">
              {W(lang, "Most popular", "Más popular")}
            </span>
          )}
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-lg font-extrabold">{W(lang, t.nameEn, t.nameEs)}</p>
              {t.tagEn && (
                <p className="text-[11px] font-extrabold uppercase tracking-widest opacity-45">
                  {W(lang, t.tagEn, t.tagEs ?? t.tagEn)}
                </p>
              )}
            </div>
            <p className="text-2xl font-extrabold">
              {t.price}
              <span className="text-[12px] font-bold opacity-50"> {W(lang, t.perEn ?? "", t.perEs ?? t.perEn ?? "")}</span>
            </p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {(lang === "es" || lang === "co" ? t.bulletsEs : t.bulletsEn).map(b => (
              <li key={b} className="flex items-start gap-2 text-[13.5px] leading-snug">
                <span className="mt-0.5 text-teal-deep dark:text-teal-light">✓</span>{b}
              </li>
            ))}
          </ul>
          {t.key === "free" ? (
            <div className="btn-ghost mt-4 w-full text-center opacity-70">
              {W(lang, "✓ Your current plan", "✓ Tu plan actual")}
            </div>
          ) : (
            <button disabled
              className="btn-brand mt-4 w-full cursor-not-allowed opacity-60"
              title={W(lang, "Billing opens with the checkout rollout", "El cobro abre con el despliegue del checkout")}>
              {W(lang, "Checkout opening soon", "Checkout muy pronto")}
            </button>
          )}
        </div>
      ))}

      <p className="px-1 text-[12px] leading-snug opacity-50">
        {W(lang,
          "Billing, promo codes and the onboarding pricing step arrive with the checkout rollout — nothing is charged today.",
          "El cobro, los códigos promocionales y el paso de precios en el registro llegan con el despliegue del checkout — hoy no se cobra nada.")}
      </p>
    </div>
  );
}
