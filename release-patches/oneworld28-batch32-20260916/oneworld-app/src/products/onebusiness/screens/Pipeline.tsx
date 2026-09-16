import { useState } from "react";
import { Link } from "react-router-dom";
import { ScreenHeading, useAsync, productHref } from "@oneworld/shell";
import { businessError, useT, dateLocale } from "../lib/dict";
import { useBusiness } from "../lib/useBusiness";
import { hasEntitlement, funnel, listStages, setStages, money } from "../lib/data";
import { CARD, Loading } from "../lib/ui";

export default function Pipeline() {
  const { t, lang, locale } = useT();
  const b = useBusiness();
  const [tick, setTick] = useState(0);
  const on = useAsync(async () => b.business ? hasEntitlement(b.business.id, "pipeline") : false, [b.business?.id]);
  const f = useAsync(async () => b.business && on ? funnel(b.business.id) : null, [b.business?.id, on, tick]);
  const stages = useAsync(async () => b.business ? listStages(b.business.id) : [], [b.business?.id, tick]);
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState<{ key: string; label: string; terminal: string | null }[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState<Error | null>(null);
  if (b.status === "loading" || on === undefined) return <Loading />;
  if (!b.business) return <p className="px-4 py-10 text-center text-sm opacity-60">{t("signInFirst")}</p>;
  const business = b.business;
  if (!on) return (
    <div className="px-4 pb-10"><ScreenHeading>{t("pipelineTitle")}</ScreenHeading>
      <div className={`${CARD} mt-4`}><p className="text-[13px] leading-relaxed">{t("pipelineLocked")}</p><Link to={productHref("onebusiness", "/services#pipeline")} className="btn-primary mt-3 block text-center !py-2 text-[12.5px]">{t("askPipeline")}</Link></div></div>
  );
  const max = Math.max(1, ...(f?.stages ?? []).map(s => s.count));
  async function save() { setBusy(true); setErr(null); try { await setStages(business.id, draft.filter(d => d.label.trim())); setEditing(false); setTick(x => x + 1); } catch (x) { setErr(x as Error); } finally { setBusy(false); } }
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("pipelineTitle")}</ScreenHeading>
      <section className={`${CARD} mt-4`}>
        <div className="flex items-baseline justify-between"><p className="text-sm font-black">{t("funnel")}</p><p className="text-[12px] opacity-60">{t("total")}: {f?.total ?? 0} · {t("won")}: {f?.won ?? 0}</p></div>
        <ul className="mt-3 space-y-2">{(f?.stages ?? []).map(s => (
          <li key={s.key}>
            <div className="flex justify-between text-[12.5px]"><span className="font-bold">{s.label}</span><span className="tabular-nums">{s.count}{s.value_minor > 0 ? ` · ${money(s.value_minor, lang)}` : ""}</span></div>
            <div className="mt-1 h-2 rounded-full bg-ink/8 dark:bg-white/10"><div className={`h-2 rounded-full ${s.terminal === "won" ? "bg-emerald-500" : s.terminal === "lost" ? "bg-ink/30" : "bg-brand"}`} style={{ width: `${Math.max(2, (s.count / max) * 100)}%` }} /></div>
          </li>
        ))}</ul>
        <p className="mt-3 text-[10.5px] opacity-50">{t("attribution")} · {new Date().toLocaleDateString(dateLocale(locale))}</p>
      </section>
      <section className={`${CARD} mt-3`}>
        <div className="flex items-center justify-between"><p className="text-sm font-black">{t("stagesTitle")}</p>
          {!editing && <button type="button" onClick={() => { setDraft((stages ?? []).map(s => ({ key: s.key, label: s.label, terminal: s.terminal }))); setEditing(true); }} className="text-[12.5px] font-bold text-brand-deep dark:text-brand-light">{t("editStages")}</button>}</div>
        <p className="mt-1 text-[12px] opacity-60">{t("stagesBody")}</p>
        {editing ? (
          <div className="mt-3 space-y-2">
            {draft.map((d, i) => (
              <div key={d.key} className="flex items-center gap-2"><input className="field flex-1" value={d.label} onChange={e => setDraft(x => x.map((y, j) => j === i ? { ...y, label: e.target.value } : y))} placeholder={t("stageLabel")} />
                <span className="w-14 text-[10.5px] opacity-60">{d.terminal === "won" ? t("won") : d.terminal === "lost" ? t("lost") : ""}</span></div>
            ))}
            <button type="button" onClick={() => setDraft(x => { const won = x.findIndex(y => y.terminal); const n = { key: `s${Date.now().toString(36)}`, label: "", terminal: null }; return won < 0 ? [...x, n] : [...x.slice(0, won), n, ...x.slice(won)]; })} className="ow-tap w-full rounded-xl border border-dashed border-ink/20 py-2 text-[12.5px] font-bold dark:border-white/20">{t("addStage")}</button>
            {err && <p role="alert" className="text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{businessError(err, locale)}</p>}
            <div className="flex gap-2"><button type="button" disabled={busy} onClick={save} className="btn-primary flex-1 !py-2 text-[12.5px] disabled:opacity-50">{t("save")}</button><button type="button" aria-label={t("cancelEditStages")} onClick={() => setEditing(false)} className="ow-tap rounded-xl border border-ink/15 px-3 text-[12.5px] font-bold dark:border-white/15">✕</button></div>
          </div>
        ) : <ol className="mt-2 flex flex-wrap gap-1.5">{(stages ?? []).map(s => <li key={s.key} className="rounded-full bg-ink/8 px-2.5 py-1 text-[11.5px] font-bold dark:bg-white/10">{s.label}</li>)}</ol>}
      </section>
    </div>
  );
}
