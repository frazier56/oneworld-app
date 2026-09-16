import { Link } from "react-router-dom";
import { ScreenHeading, productHref, NavIcon } from "@oneworld/shell";
import { useBusinessLoad } from "../lib/useBusinessLoad";
import { serviceTitle, serviceCategory, useT, dateLocale } from "../lib/dict";
import { useBusiness } from "../lib/useBusiness";
import { listServices, listSubscriptions, listAccounts, voiceSummary, bogota } from "../lib/data";
import { StatePill, CARD, Loading, LoadError } from "../lib/ui";
import Setup from "./Setup";

/**
 * OVERVIEW — the returning customer lands on what is useful: the services they have, what is
 * waiting on them, and the flagship's numbers for today. One business at a time; switch above.
 */
export default function Overview() {
  const { t, lang } = useT();
  const b = useBusiness();
  const servicesQuery = useBusinessLoad(listServices, []);
  const subsQuery = useBusinessLoad(async () => b.business ? listSubscriptions(b.business.id) : [], [b.business?.id]);
  const accountsQuery = useBusinessLoad(async () => b.business ? listAccounts(b.business.id) : [], [b.business?.id]);
  const voiceQuery = useBusinessLoad(async () => b.business ? voiceSummary(b.business.id, bogota(), bogota()) : null, [b.business?.id]);
  const services = servicesQuery.data, subs = subsQuery.data, accounts = accountsQuery.data, voice = voiceQuery.data;
  if (b.status === "loading") return <Loading />;
  if (!b.userId) return <p className="px-4 py-10 text-center text-sm opacity-60">{t("signInFirst")}</p>;
  if (b.status === "none") return <Setup onCreated={b.refresh} />;
  if (b.status === "error" || servicesQuery.error || subsQuery.error || accountsQuery.error || voiceQuery.error) return <LoadError />;
  if (!services || !subs || !accounts || voice === undefined) return <Loading />;
  if (!b.business) return <p className="px-4 py-10 text-center text-sm text-rose-600">{b.error ?? t("errGeneric")}</p>;
  const byKey = new Map((services ?? []).map(s => [s.key, s]));
  const live = (subs ?? []).filter(s => s.state !== "cancelled");
  const needsYou = live.filter(s => s.state === "awaiting_info" || s.state === "quoted" || s.state === "ready_for_review" || s.state === "failed");
  const ghl = (accounts ?? []).find(a => a.provider === "ghl");
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{b.business.name}</ScreenHeading>
      {b.businesses.length > 1 && (
        <select className="field mt-2 w-full" value={b.business.id} onChange={e => b.select(e.target.value)} aria-label={t("businessesTitle")}>
          {b.businesses.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}

      {voice?.entitled && (
        <Link to={productHref("onebusiness", "/voice")} className={`${CARD} ow-tap mt-4 block`}>
          <div className="flex items-center justify-between"><p className="text-sm font-black">OneVoice · {t("today")}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${voice.connected ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "bg-amber-500/15 text-amber-800 dark:text-amber-200"}`}>{voice.connected ? t("connectedOn") : t("notConnected")}</span></div>
          {voice.connected ? (
            <div className="mt-2 grid grid-cols-4 gap-1 text-center">
              {[[voice.calls, t("calls")], [voice.missed, t("missed")], [voice.with_lead, t("withLead")], [voice.appointments, t("appointments")]].map(([v, l]) => <div key={String(l)}><p className="text-lg font-black tabular-nums">{v}</p><p className="text-[10.5px] opacity-60">{l}</p></div>)}
            </div>
          ) : <p className="mt-1 text-[12px] opacity-70">{t("voiceNotConnected")}</p>}
          <p className="mt-2 text-[10.5px] opacity-50">{t("lastSync")}: {ghl?.last_sync_at ? new Date(ghl.last_sync_at).toLocaleString(dateLocale(lang)) : t("never")} · {voice.timezone}</p>
        </Link>
      )}

      <section className="mt-4">
        <div className="flex items-center justify-between"><h2 className="text-sm font-black">{t("nextSteps")}</h2></div>
        {needsYou.length === 0 ? <p className="mt-1 text-[12.5px] opacity-60">{t("nothingPending")}</p> : (
          <ul className="mt-2 space-y-2">{needsYou.map(s => (
            <li key={s.id}><Link to={productHref("onebusiness", `/services#${s.service_key}`)} className={`${CARD} ow-tap flex items-center justify-between`}>
              <span className="text-[13.5px] font-bold">{byKey.has(s.service_key) ? serviceTitle(byKey.get(s.service_key)!, lang) : s.service_key}</span><StatePill state={s.state} /></Link></li>
          ))}</ul>
        )}
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-black">{t("yourServices")}</h2><Link to={productHref("onebusiness", "/services")} className="text-[12.5px] font-bold text-brand-deep dark:text-brand-light">{t("browse")}</Link></div>
        {live.length === 0 ? (
          <Link to={productHref("onebusiness", "/services")} className={`${CARD} ow-tap mt-2 flex items-center gap-3`}><NavIcon name="discover" className="text-brand" /><span className="text-[13px] font-bold">{t("noServices")}</span></Link>
        ) : (
          <ul className="mt-2 space-y-2">{live.map(s => { const c = byKey.get(s.service_key); const to = s.service_key === "onevoice" ? "/voice" : s.service_key === "pipeline" ? "/pipeline" : `/services#${s.service_key}`; return (
            <li key={s.id}><Link to={productHref("onebusiness", to)} className={`${CARD} ow-tap flex items-center justify-between gap-3`}>
              <div className="min-w-0"><p className="truncate text-[13.5px] font-black">{c ? serviceTitle(c, lang) : s.service_key}{c?.flagship ? <span className="ml-2 rounded-full bg-brand/15 px-1.5 text-[10px] font-bold text-brand-deep dark:text-brand-light">{t("flagship")}</span> : null}</p>{c?.brand && <p className="text-[11.5px] opacity-60">{serviceCategory(c, lang)}</p>}</div>
              <StatePill state={s.state} /></Link></li>); })}</ul>
        )}
      </section>
    </div>
  );
}
