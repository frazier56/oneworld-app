import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { W } from "../lib/i18n";
import { PRODUCT_BRAND, type AppKey } from "../lib/oneWorld";
import ScreenHeading from "../components/ScreenHeading";
import { supabase } from "../lib/supabase";
import { useOneId } from "../lib/oneId";

/**
 * PLANS — the shared paid-tier screen (SHELL, Lee 9 Aug: "every one of our apps is going to
 * have some level of enhanced experience if you pay a small monthly fee").
 * ============================================================================================
 * One screen, every product: free is real and stays free; the paid tiers say exactly what they
 * add; a product passes its own tier copy or inherits the default ladder. Reached from the
 * drawer ("Plans") and, later, from the onboarding pricing step.
 *
 * ── CHECKOUT IS WIRED NOW (18 September 2026) ───────────────────────────────────────────────
 * It was inert for six weeks — every paid tier said "Checkout opening soon", so both tiers were
 * described, limited and enforced everywhere while nobody could buy either, and every account in
 * the product was on Free by construction.
 *
 * The rail already existed: `create-plan-checkout` makes a Stripe subscription session and
 * `verify-plan-checkout` applies the plan when Stripe redirects back. Only the button was
 * missing. The button now names the plan and its price rather than the word "Upgrade", because
 * the one thing somebody needs to be sure of before a payment screen opens is what they are
 * about to be charged.
 *
 * ── ⚠️ THE TWO TIERS HAVE DIFFERENT SHAPES (Lee, 18 September 2026) ─────────────────────────
 * *"we have pro plans that are per app, but then if you go VIP, it's across all apps… they just
 * pay that one cost."*
 *
 *   PRO → this product only. Buying OneHome Pro does nothing in OneJob.
 *   VIP → every app, one price. It is an account-level purchase, not a product one.
 *
 * So the cards cannot both say "upgrade" and leave it there — the scope IS the product
 * difference, and it is the thing somebody is most likely to get wrong in the direction that
 * costs them money. Each card says what it covers, above the button, in one line.
 *
 * `one_world_plan` in the database holds the precedence (VIP always wins over a per-app row);
 * this screen asks `my_plan(product)` rather than working any of it out itself.
 *
 * HONESTY RULE, still standing: no fee figures beyond the subscription price appear here, ever.
 */
type Sub = { app: string; plan: string; plan_interval: string | null; current_period_end: string | null; redundant: boolean };

/** A product key as a person would say it. Never the raw key — "onerental" is not a word. */
function appName(app: string) {
  const names: Record<string, string> = {
    all: "One World", onerental: "OneHome", onesale: "OneHome", oneevent: "OneEvent",
    onejob: "OneJob", onescore: "OneScore", onesocial: "OneSocial", oneagent: "OneAgent",
    onepay: "OnePay", onebusiness: "OneBusiness", onevoice: "OneVoice",
  };
  return names[app] ?? app;
}

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
  const { userId } = useOneId();
  const T = tiers ?? DEFAULT_TIERS;
  const brand = PRODUCT_BRAND[product].name;

  const [plan, setPlan] = useState<string>("free");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /* What this person is actually on. Without it the screen cannot tell somebody they already
     bought the thing it is offering to sell them. */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void Promise.all([
      supabase.rpc("my_plan", { p_app: product }),
      supabase.rpc("my_plan_subscriptions"),
    ]).then(([p, s]) => {
      if (!live) return;
      setPlan(typeof p.data === "string" ? p.data.toLowerCase() : "free");
      setSubs(Array.isArray(s.data) ? (s.data as Sub[]) : []);
    });
    return () => { live = false; };
  }, [userId, product, tick]);

  /* Coming back from Stripe. The session id in the URL is the proof; `verify-plan-checkout`
     re-reads it server-side and only then writes the plan, so a doctored URL grants nothing. */
  useEffect(() => {
    const url = new URL(window.location.href);
    const sid = url.searchParams.get("session_id");
    if (!sid || url.searchParams.get("upgraded") !== "1") return;
    void supabase.functions.invoke("verify-plan-checkout", { body: { sessionId: sid } })
      .then(({ data, error }) => {
        if (!error && (data as any)?.plan) {
          setPlan(String((data as any).plan).toLowerCase());
          setTick(x => x + 1);
        }
        url.searchParams.delete("session_id");
        url.searchParams.delete("upgraded");
        window.history.replaceState({}, "", url.toString());
      });
  }, []);

  async function buy(tierKey: string) {
    setBusy(tierKey); setErr(null);
    const { data, error } = await supabase.functions.invoke("create-plan-checkout", {
      body: { plan: tierKey, interval: "monthly", product, returnUrl: window.location.href.split("?")[0] },
    });
    setBusy(null);
    const url = (data as any)?.url;
    if (error || !url) {
      /* The server refuses a purchase somebody already has, and says which case it is. Showing
         its reason beats a generic failure, because "you already have this" is not a failure. */
      const code = (data as any)?.error;
      setErr(code === "already_vip"
        ? W(lang, "VIP already covers every app, including this one.", "VIP ya cubre todas las apps, incluida esta.")
        : code === "already_on_plan"
          ? W(lang, "You are already on this plan.", "Ya estás en este plan.")
          : W(lang, "Checkout could not be opened. Please try again.", "No se pudo abrir el pago. Inténtalo de nuevo."));
      return;
    }
    window.location.href = url;
  }

  /** End a subscription at the end of the period already paid for. */
  async function cancel(app: string) {
    setBusy("cancel:" + app); setErr(null); setNote(null);
    const { data, error } = await supabase.functions.invoke("cancel-plan-subscription", { body: { app } });
    setBusy(null);
    if (error || !(data as any)?.ok) {
      setErr(W(lang, "That could not be cancelled. Please try again.", "No se pudo cancelar. Inténtalo de nuevo."));
      return;
    }
    setNote(W(lang, "Cancelled. It stays active until the period you have already paid for ends.",
                    "Cancelado. Sigue activo hasta que termine el periodo que ya pagaste."));
    setTick(x => x + 1);
  }

  const redundant = subs.filter(s => s.redundant);

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
          {/* ⚠️ THE SCOPE, ON EVERY PAID CARD. The difference between these two tiers is not only
              how much they give you — it is whether it follows you into the other apps. Somebody
              who misses that buys Pro three times. */}
          {t.key !== "free" && (
            <p className="mt-3 text-[12px] font-bold uppercase tracking-wide text-brand-deep dark:text-brand-light">
              {t.key === "vip"
                ? W(lang, "Covers every One World app", "Cubre todas las apps de One World")
                /* ⚠️ THE APP'S NAME, NOT ITS TAGLINE. `PRODUCT_BRAND.name` for OneHome is the
                   marketing phrase "For Rent", so this line first read "FOR RENT ONLY" — which
                   says the plan does not cover the for-sale half of the same product, and that
                   is not true. A scope line that gets the scope wrong is worse than no scope
                   line, so it uses the product's real name. */
                : W(lang, `${appName(product)} only`, `Solo ${appName(product)}`)}
            </p>
          )}
          {plan === t.key ? (
            <div className="mt-4 space-y-2">
              <div className="btn-ghost w-full text-center opacity-70">
                {W(lang, "✓ Your current plan", "✓ Tu plan actual")}
              </div>
              {/* ⚠️ NOT ON FREE. The first version put "Cancel this plan" under every current
                  plan, including Free — a control offering to cancel something nobody is paying
                  for, which reads as an offer to close the account. Free has nothing to stop. */}
              {t.key !== "free" && (
                <button type="button" disabled={busy !== null}
                  onClick={() => void cancel(t.key === "vip" ? "all" : product)}
                  className="ow-tap w-full text-center text-[12px] font-bold underline underline-offset-4 opacity-55 disabled:opacity-35">
                  {busy === "cancel:" + (t.key === "vip" ? "all" : product)
                    ? "…"
                    : W(lang, "Cancel this plan", "Cancelar este plan")}
                </button>
              )}
            </div>
          ) : t.key === "free" ? (
            /* Nothing to sell, and nothing to click. Somebody on a paid plan who wants to drop
               back down does it in billing, where a cancellation belongs, not behind a button
               on a pricing page. */
            <div className="btn-ghost mt-4 w-full text-center opacity-55">
              {W(lang, "Included with every account", "Incluido en toda cuenta")}
            </div>
          ) : (
            <button type="button" disabled={busy !== null || !userId}
              onClick={() => void buy(t.key)}
              className="btn-brand ow-tap mt-4 w-full disabled:opacity-45">
              {busy === t.key
                ? "…"
                : !userId
                  ? W(lang, "Sign in to upgrade", "Inicia sesión para mejorar")
                  : W(lang, `Get ${t.nameEn} — ${t.price}${t.perEn ? " " + t.perEn : ""}`,
                            `Obtener ${t.nameEs} — ${t.price}${t.perEs ?? t.perEn ? " " + (t.perEs ?? t.perEn) : ""}`)}
            </button>
          )}
        </div>
      ))}

      {/* ⚠️ THE ONE CASE THAT COSTS SOMEBODY REAL MONEY. VIP already includes everything Pro gives
          in every app, so a per-app Pro running alongside it is a second charge for the same
          thing. It is NOT cancelled automatically — ending somebody's paid subscription without
          them asking is not a decision this code gets to make. It is said plainly and offered. */}
      {redundant.map(s => (
        <div key={s.app} className="card border-amber-500/40 bg-amber-500/[0.07]">
          <p className="text-[13.5px] font-bold leading-snug">
            {W(lang, `VIP already covers ${appName(s.app)}, so your ${appName(s.app)} Pro subscription is charging you for something you have.`,
                     `VIP ya cubre ${appName(s.app)}, así que tu suscripción Pro de ${appName(s.app)} te cobra por algo que ya tienes.`)}
          </p>
          <button type="button" disabled={busy !== null} onClick={() => void cancel(s.app)}
            className="btn-ghost ow-tap mt-3 w-full px-4 py-3 disabled:opacity-45">
            {busy === "cancel:" + s.app ? "…" : W(lang, `Cancel ${appName(s.app)} Pro`, `Cancelar Pro de ${appName(s.app)}`)}
          </button>
        </div>
      ))}

      {note && <p className="px-1 text-[12.5px] font-semibold text-brand-deep dark:text-brand-light">{note}</p>}
      {err && <p className="px-1 text-[12.5px] font-semibold text-rose-600 dark:text-rose-300">{err}</p>}

      <p className="px-1 text-[12px] leading-snug opacity-50">
        {W(lang,
          "Pro applies to this app. VIP applies to every One World app for one price. Both renew monthly, and cancelling keeps you on the plan until the period you have already paid for ends.",
          "Pro aplica a esta app. VIP aplica a todas las apps de One World por un solo precio. Ambos se renuevan cada mes, y al cancelar sigues con el plan hasta que termine el periodo que ya pagaste.")}
      </p>
    </div>
  );
}
