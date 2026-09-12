import { ScreenHeading } from "@oneworld/shell";
import { useBusinessLoad } from "../lib/useBusinessLoad";
import { serviceTitle, useT, dateLocale } from "../lib/dict";
import { useBusiness } from "../lib/useBusiness";
import { listMetrics, listServices, listAccounts } from "../lib/data";
import { CARD, Loading, LoadError } from "../lib/ui";

/** RESULTS — only what a connected account reported, with its freshness. No estimates, no zeros for "unknown". */
export default function Results() {
  const { t, lang } = useT();
  const b = useBusiness();
  const metricsQuery = useBusinessLoad(async () => b.business ? listMetrics(b.business.id) : [], [b.business?.id]);
  const servicesQuery = useBusinessLoad(listServices, []);
  const accountsQuery = useBusinessLoad(async () => b.business ? listAccounts(b.business.id) : [], [b.business?.id]);
  const metrics = metricsQuery.data, services = servicesQuery.data, accounts = accountsQuery.data;
  if (b.status === "error" || metricsQuery.error || servicesQuery.error || accountsQuery.error) return <LoadError />;
  if (b.status === "loading" || metrics === undefined || !services || !accounts) return <Loading />;
  if (!b.business) return <p className="px-4 py-10 text-center text-sm opacity-60">{t("signInFirst")}</p>;
  const name = (k: string) => { const s = (services ?? []).find(x => x.key === k); return s ? serviceTitle(s, lang) : k; };
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("resultsTitle")}</ScreenHeading>
      <p className="mt-1 text-[13px] opacity-70">{t("resultsBody")}</p>
      {(accounts ?? []).length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">{(accounts ?? []).map(a => <li key={a.id} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${a.status === "connected" ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "bg-ink/8 opacity-70"}`}>{a.provider} · {a.status === "connected" ? t("connectedOn") : t("notConnected")}</li>)}</ul>
      )}
      {metrics.length === 0 ? <p className={`${CARD} mt-4 text-[13px] opacity-70`}>{t("noData")}</p> : (
        <ul className="mt-4 space-y-3">{metrics.map(m => (
          <li key={m.id} className={CARD}>
            <div className="flex items-baseline justify-between"><p className="text-sm font-black">{name(m.service_key)}</p><p className="text-[11px] opacity-60">{m.period_start} → {m.period_end}</p></div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">{Object.entries(m.metrics).map(([k, v]) => <div key={k} className="flex justify-between border-b border-ink/5 py-0.5 dark:border-white/5"><dt className="opacity-60">{k.replace(/_/g, " ")}</dt><dd className="tabular-nums font-bold">{typeof v === "number" ? v.toLocaleString(dateLocale(lang)) : String(v)}</dd></div>)}</dl>
            <p className="mt-2 text-[10.5px] opacity-50">{m.source} · {t("lastSync")} {new Date(m.fetched_at).toLocaleString(dateLocale(lang))}</p>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
