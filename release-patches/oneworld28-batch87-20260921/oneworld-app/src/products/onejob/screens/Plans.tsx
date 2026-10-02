import { ScreenHeading } from "@oneworld/shell";
import { useState } from "react";
import { useQuery } from "@job/lib/query";
import { supabase, FEE_PCT } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import { useI18n, W } from "@job/lib/i18n";
import { fnError, thrownError } from "@job/lib/fnError";

/** Pricing & Plans — the engine's live billing rails, finally surfaced in V2.
 *  Backend fns (already deployed): check-subscription, create-checkout {plan}, customer-portal.
 *  Scout/Monster AI add-ons = Coming Soon (Lee decision). */

const TIERS = [
  { key: "basic", monthly: 0 },
  { key: "pro", monthly: 9.99, cycle: 29.97, months: 3 },
  { key: "vip", monthly: 19.99, cycle: 119.94, months: 6 },
] as const;

export default function Plans() {
  const { session } = useAuth();
  const { t, lang } = useI18n();
  const usd = (amount: number) => `${new Intl.NumberFormat(lang === "co" ? "es-CO" : lang === "es" ? "es-ES" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} USD`;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const { data: sub } = useQuery({
    queryKey: ["subscription"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (error) return { subscribed: false, plan: null };
      return data as { subscribed: boolean; plan: string | null };
    },
  });
  const current = sub?.plan ?? "basic";

  const go = async (fn: string, body?: any, key?: string) => {
    setBusy(key ?? fn); setErr("");
    try {
      const { data, error } = await supabase.functions.invoke(fn, {
        headers: { Authorization: `Bearer ${session!.access_token}` }, body,
      });
      if (error) throw error;
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error("No URL");
    } catch (e: any) { setErr(thrownError(e, W(lang, "Couldn’t open billing right now — try again in a moment.", "No pudimos abrir la facturación. Inténtalo de nuevo en un momento."))); }
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <ScreenHeading>💳 {t("plansTitle")}</ScreenHeading>
      <p className="text-sm opacity-60">{t("plansSub")}</p>

      {TIERS.map(tier => {
        const isCurrent = current === tier.key || (tier.key === "basic" && !sub?.subscribed);
        return (
          <div key={tier.key} className={`card p-5 ${isCurrent ? "border-brand ring-1 ring-brand" : ""}`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-extrabold">{t(("plan_" + tier.key) as any)}</h2>
                <p className="mt-0.5 text-sm opacity-60">{t(("plan_" + tier.key + "_desc") as any)}</p>
              </div>
              {isCurrent && <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">✓ {t("currentPlan")}</span>}
            </div>
            <p className="mt-3 text-2xl font-extrabold">
              {tier.monthly === 0 ? t("freeForever") : <>{usd(tier.monthly)}<span className="text-sm font-semibold opacity-60">/{t("perMonth")}</span></>}
            </p>
            {"cycle" in tier && <p className="text-xs opacity-50">{t("billedAs").replace("{amt}", usd(tier.cycle!)).replace("{n}", String(tier.months))}</p>}
            {!isCurrent && tier.key !== "basic" && (
              <button onClick={() => go("create-checkout", { plan: tier.key }, tier.key)} disabled={!!busy}
                className="btn-primary mt-3 w-full">{busy === tier.key ? "…" : t("upgradeCta")}</button>
            )}
          </div>
        );
      })}

      <div className="card p-5 opacity-70">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold">🤖 Scout & Monster AI</h2>
          <span className="rounded-full bg-ink/10 px-2.5 py-1 text-xs font-bold uppercase opacity-70 dark:bg-white/15">{t("soon")}</span>
        </div>
        <p className="mt-1 text-sm opacity-60">{t("aiAddonsDesc")}</p>
      </div>

      {sub?.subscribed && (
        <button onClick={() => go("customer-portal", undefined, "portal")} disabled={!!busy}
          className="btn-ghost w-full">{busy === "portal" ? "…" : `⚙️ ${t("manageBilling")}`}</button>
      )}
      {err && <p className="text-sm text-red-500">{err}</p>}
      <p className="text-center text-xs opacity-40">{W(lang, `Job service fee: ${FEE_PCT}. Plan prices are shown in USD.`, `Tarifa de servicio por trabajo: ${FEE_PCT}. Los precios de los planes se muestran en USD.`)}</p>
    </div>
  );
}
