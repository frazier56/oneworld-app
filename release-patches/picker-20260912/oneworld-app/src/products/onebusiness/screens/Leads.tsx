import { useState } from "react";
import { Link } from "react-router-dom";
import { ScreenHeading, useAsync, productHref } from "@oneworld/shell";
import { businessError, useT, dateLocale } from "../lib/dict";
import { useBusiness } from "../lib/useBusiness";
import { listLeads, listStages, hasEntitlement, upsertLead, type Lead } from "../lib/data";
import { CARD, Loading } from "../lib/ui";
import Setup from "./Setup";

export const SRC_KEY = { call: "srcCall", form: "srcForm", chat: "srcChat", ads: "srcAds", manual: "srcManual", other: "srcOther" } as const;

export default function Leads() {
  const { t, lang, locale } = useT();
  const b = useBusiness();
  const [tick, setTick] = useState(0);
  const pipeline = useAsync(async () => b.business ? hasEntitlement(b.business.id, "pipeline") : false, [b.business?.id]);
  const voice = useAsync(async () => b.business ? hasEntitlement(b.business.id, "onevoice") : false, [b.business?.id]);
  const leads = useAsync(async () => b.business && (pipeline || voice) ? listLeads(b.business.id) : [], [b.business?.id, pipeline, voice, tick]);
  const stages = useAsync(async () => b.business ? listStages(b.business.id) : [], [b.business?.id]);
  const [adding, setAdding] = useState(false); const [f, setF] = useState({ name: "", phone: "", email: "" }); const [busy, setBusy] = useState(false); const [err, setErr] = useState<Error | null>(null);
  if (b.status === "loading") return <Loading />;
  if (!b.userId) return <p className="px-4 py-10 text-center text-sm opacity-60">{t("signInFirst")}</p>;
  if (b.status === "none") return <Setup onCreated={b.refresh} />;
  if (!b.business) return null;
  const business = b.business;
  const stageLabel = (k: string) => (stages ?? []).find(s => s.key === k)?.label ?? k;
  async function add() { setBusy(true); setErr(null); try { await upsertLead(business.id, "manual", f.name, f.phone, f.email); setF({ name: "", phone: "", email: "" }); setAdding(false); setTick(x => x + 1); } catch (x) { setErr(x as Error); } finally { setBusy(false); } }
  const gated = pipeline === false && voice === false;
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("leadsTitle")}</ScreenHeading>
      <p className="mt-1 text-[13px] opacity-70">{t("leadsBody")}</p>
      {gated && (
        <div className={`${CARD} mt-4`}><p className="text-[13px] leading-relaxed">{t("pipelineLocked")}</p>
          <Link to={productHref("onebusiness", "/services#pipeline")} className="btn-primary mt-3 block text-center !py-2 text-[12.5px]">{t("askPipeline")}</Link></div>
      )}
      {!gated && (
        <>
          {pipeline && (adding ? (
            <div className={`${CARD} mt-4`}>
              <input className="field w-full" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder={t("leadName")} />
              <input className="field mt-2 w-full" inputMode="tel" value={f.phone} onChange={e => setF(x => ({ ...x, phone: e.target.value }))} placeholder={t("leadPhone")} />
              <input className="field mt-2 w-full" inputMode="email" value={f.email} onChange={e => setF(x => ({ ...x, email: e.target.value }))} placeholder={t("leadEmail")} />
              {err && <p role="alert" className="mt-2 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{businessError(err, locale)}</p>}
              <div className="mt-2 flex gap-2"><button type="button" disabled={busy || !(f.name || f.phone || f.email)} onClick={add} className="btn-primary flex-1 !py-2 text-[12.5px] disabled:opacity-50">{t("save")}</button><button type="button" aria-label={t("cancelAddLead")} onClick={() => setAdding(false)} className="ow-tap rounded-xl border border-ink/15 px-3 text-[12.5px] font-bold dark:border-white/15">✕</button></div>
            </div>
          ) : <button type="button" onClick={() => setAdding(true)} className="btn-primary mt-4 w-full">{t("addLead")}</button>)}
          {leads === undefined ? <Loading /> : leads.length === 0 ? <p className="mt-6 text-center text-[13px] opacity-60">{voice ? t("noLeadsVoice") : t("noLeads")}</p> : (
            <ul className="mt-3 space-y-2">{leads.map((l: Lead) => (
              <li key={l.id}><Link to={productHref("onebusiness", `/leads/${l.id}`)} className={`${CARD} ow-tap flex items-center justify-between gap-3 !p-3.5`}>
                <div className="min-w-0"><p className="truncate text-[13.5px] font-black">{l.name ?? l.phone ?? l.email ?? "—"}</p>
                  <p className="text-[11.5px] opacity-60">{t(SRC_KEY[l.source])} · {new Date(l.last_activity_at).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "short" })}{l.next_action ? ` · ${l.next_action}` : ""}</p></div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${l.outcome === "won" ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : l.outcome === "lost" ? "bg-ink/10 opacity-60" : "bg-brand/15 text-brand-deep dark:text-brand-light"}`}>{stageLabel(l.stage_key)}</span>
              </Link></li>
            ))}</ul>
          )}
        </>
      )}
    </div>
  );
}
