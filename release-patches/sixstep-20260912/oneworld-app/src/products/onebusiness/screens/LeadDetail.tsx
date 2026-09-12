import { useState } from "react";
import { useParams } from "react-router-dom";
import { ScreenHeading, useAsync } from "@oneworld/shell";
import { businessError, eventLabel, useT, dateLocale } from "../lib/dict";
import { fetchLead, leadEvents, listStages, moveLead, addNote, money } from "../lib/data";
import { CARD, Loading } from "../lib/ui";
import { SRC_KEY } from "./Leads";

export default function LeadDetail() {
  const { id = "" } = useParams();
  const { t, lang } = useT();
  const [tick, setTick] = useState(0);
  const lead = useAsync(() => fetchLead(id), [id, tick]);
  const events = useAsync(() => leadEvents(id), [id, tick]);
  const stages = useAsync(async () => lead ? listStages(lead.business_id) : [], [lead?.business_id]);
  const [note, setNote] = useState(""); const [next, setNext] = useState(""); const [nextOn, setNextOn] = useState(""); const [value, setValue] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<Error | null>(null);
  async function run(fn: () => Promise<unknown>) { setBusy(true); setErr(null); try { await fn(); setNote(""); setNext(""); setNextOn(""); setTick(x => x + 1); } catch (x) { setErr(x as Error); } finally { setBusy(false); } }
  if (lead === undefined) return <Loading />;
  if (!lead) return <p className="px-4 py-10 text-center text-sm opacity-60">—</p>;
  const cur = (stages ?? []).find(s => s.key === lead.stage_key);
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{lead.name ?? lead.phone ?? lead.email ?? "—"}</ScreenHeading>
      <section className={`${CARD} mt-4 text-[13px]`}>
        {lead.phone && <p><a className="font-bold underline-offset-2 hover:underline" href={`tel:${lead.phone}`}>{lead.phone}</a></p>}
        {lead.email && <p><a className="font-bold underline-offset-2 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a></p>}
        <p className="mt-1 opacity-60">{t("source")}: {t(SRC_KEY[lead.source])} · {new Date(lead.first_seen_at).toLocaleDateString(dateLocale(lang))}</p>
        <p className="mt-1"><span className="opacity-60">{t("stage")}:</span> <strong>{cur?.label ?? lead.stage_key}</strong>{lead.value_minor != null ? ` · ${money(lead.value_minor, lang)}` : ""}</p>
        {lead.next_action && <p className="mt-1"><span className="opacity-60">{t("nextAction")}:</span> {lead.next_action}{lead.next_action_on ? ` (${lead.next_action_on})` : ""}</p>}
      </section>
      {(stages ?? []).length > 0 && !lead.outcome && (
        <section className={`${CARD} mt-3`}>
          <p className="text-[12px] font-bold opacity-65">{t("moveTo")}</p>
          <div className="mt-2 flex flex-wrap gap-2">{(stages ?? []).filter(s => s.key !== lead.stage_key).map(s => (
            <button key={s.key} type="button" disabled={busy} onClick={() => run(() => moveLead(lead.id, s.key, "", s.terminal === "won" && value ? Number(value.replace(/[^0-9]/g, "")) * 100 : null))}
              className={`ow-tap rounded-full border px-3 py-1.5 text-[12px] font-bold ${s.terminal === "won" ? "border-emerald-600/40" : s.terminal === "lost" ? "border-ink/20 opacity-70" : "border-brand/40"}`}>{s.label}</button>
          ))}</div>
          <input className="field mt-2 w-full tabular-nums" inputMode="numeric" value={value} onChange={e => setValue(e.target.value)} placeholder={t("value")} />
        </section>
      )}
      <section className={`${CARD} mt-3`}>
        <textarea className="field w-full" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={t("note")} maxLength={1000} />
        <div className="mt-2 flex gap-2"><input className="field flex-1" value={next} onChange={e => setNext(e.target.value)} placeholder={t("nextAction")} /><input type="date" className="field w-36" value={nextOn} onChange={e => setNextOn(e.target.value)} aria-label={t("nextOn")} /></div>
        <button type="button" disabled={busy || !note.trim()} onClick={() => run(() => addNote(lead.id, note.trim(), next, nextOn))} className="btn-primary mt-2 w-full !py-2 text-[12.5px] disabled:opacity-50">{t("addNote")}</button>
        {err && <p role="alert" className="mt-2 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{businessError(err, lang)}</p>}
      </section>
      <h2 className="mt-5 text-sm font-black">{t("history")}</h2>
      <ul className="mt-2 space-y-1.5">{(events ?? []).map(e => (
        <li key={e.id} className="text-[12.5px]"><span className="opacity-50">{new Date(e.occurred_at).toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> · <strong>{eventLabel(e.kind, lang)}</strong>{typeof e.payload.note === "string" ? ` — ${e.payload.note}` : ""}{typeof e.payload.to === "string" ? ` → ${(stages ?? []).find(s => s.key === e.payload.to)?.label ?? (lang === "es" ? "Etapa no disponible" : "Stage unavailable")}` : ""}{typeof e.payload.summary === "string" ? ` — ${e.payload.summary}` : ""}</li>
      ))}</ul>
    </div>
  );
}
