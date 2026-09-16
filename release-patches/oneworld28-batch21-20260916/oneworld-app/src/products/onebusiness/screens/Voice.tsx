import { useState } from "react";
import { Link } from "react-router-dom";
import { ScreenHeading, productHref } from "@oneworld/shell";
import { useBusinessLoad } from "../lib/useBusinessLoad";
import { useT, dateLocale } from "../lib/dict";
import { useBusiness } from "../lib/useBusiness";
import { voiceSummary, listCalls, bogota } from "../lib/data";
import { CARD, Loading, LoadError } from "../lib/ui";

/**
 * ONEVOICE MODULE — the flagship's focused workspace. Every number states its scope, period,
 * timezone and source, and an unconnected phone system says so rather than showing zeros.
 * Data arrives through the server-side connector (ob_calls / ob_appointments); nothing here
 * calls the phone provider from the browser.
 */
export default function Voice() {
  const { t, lang } = useT();
  const b = useBusiness();
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const to = bogota(); const from = period === "today" ? to : period === "week" ? bogota(new Date(Date.now() - 6 * 864e5)) : bogota(new Date(Date.now() - 29 * 864e5));
  const summaryQuery = useBusinessLoad(async () => b.business ? voiceSummary(b.business.id, from, to) : null, [b.business?.id, from, to]);
  const s = summaryQuery.data;
  const callsQuery = useBusinessLoad(async () => b.business && s?.entitled && s.connected ? listCalls(b.business.id, from, to) : [], [b.business?.id, from, to, s?.entitled, s?.connected]);
  const calls = callsQuery.data;
  if (b.status === "error" || summaryQuery.error || callsQuery.error) return <LoadError />;
  if (b.status === "loading" || s === undefined) return <Loading />;
  if (!b.business) return <p className="px-4 py-10 text-center text-sm opacity-60">{t("signInFirst")}</p>;
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("voiceTitle")}</ScreenHeading>
      <p className="mt-1 text-[13px] opacity-70">{t("voiceBody")}</p>
      {!s?.entitled ? (
        <div className={`${CARD} mt-4`}><p className="text-[13px]">{t("voiceNotActive")}</p><Link to={productHref("onebusiness", "/services#onevoice")} className="btn-primary mt-3 block text-center !py-2 text-[12.5px]">{t("request")}</Link></div>
      ) : !s.connected ? (
        <div className={`${CARD} mt-4`}><p className="text-[13px] leading-relaxed">{t("voiceNotConnected")}</p><p className="mt-2 text-[11px] opacity-50">{t("notConnected")}</p></div>
      ) : (
        <>
          <div className="mt-3 flex gap-1 rounded-full bg-ink/5 p-1 dark:bg-white/5">{(["today", "week", "month"] as const).map(p => (
            <button key={p} type="button" onClick={() => setPeriod(p)} className={`ow-tap flex-1 rounded-full py-1.5 text-[12px] font-bold ${period === p ? "bg-white shadow dark:bg-white/15" : "opacity-60"}`}>{t(p === "today" ? "today" : p === "week" ? "thisWeek" : "thisMonth")}</button>
          ))}</div>
          <section className={`${CARD} mt-3`}>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[[s.calls, t("calls")], [s.missed, t("missed")], [s.with_lead, t("withLead")], [s.appointments, t("appointments")], [s.follow_up_due, t("followUps")], [s.high_urgency, t("urgent")]].map(([v, l]) => (
                <div key={String(l)}><p className="text-xl font-black tabular-nums">{v}</p><p className="text-[10.5px] opacity-60">{l}</p></div>
              ))}
            </div>
            <p className="mt-3 text-[10.5px] opacity-50">{s.from} → {s.to} · {s.timezone} · {t("lastSync")}: {s.last_sync_at ? new Date(s.last_sync_at).toLocaleString(dateLocale(lang)) : t("never")}</p>
          </section>
          <h2 className="mt-5 text-sm font-black">{t("recentCalls")}</h2>
          {calls === undefined ? <Loading /> : calls.length === 0 ? <p className="mt-2 text-[12.5px] opacity-60">{t("noCalls")}</p> : (
            <ul className="mt-2 space-y-2">{calls.map(c => (
              <li key={c.id} className={`${CARD} !p-3.5`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-black">{c.from_number ?? "—"}</p>
                  <div className="flex items-center gap-1">
                    {c.missed && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 dark:text-rose-200">{t("missed")}</span>}
                    {c.urgency === "high" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-bold text-amber-800 dark:text-amber-200">{t("urgent")}</span>}
                  </div>
                </div>
                <p className="text-[11.5px] opacity-60">{new Date(c.started_at).toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{c.duration_s != null ? ` · ${Math.round(c.duration_s / 60)} min` : ""}</p>
                {c.summary && <p className="mt-1 text-[12.5px]"><span className="opacity-60">{t("summary")}:</span> {c.summary}</p>}
                {c.urgency_reason && <p className="mt-0.5 text-[11.5px] opacity-70"><span className="opacity-60">{t("urgencyWhy")}:</span> {c.urgency_reason}</p>}
                <div className="mt-1 flex gap-3 text-[12px] font-bold text-brand-deep dark:text-brand-light">
                  {c.recording_url && <a href={c.recording_url} target="_blank" rel="noreferrer">{t("recording")}</a>}
                  {c.lead_id && <Link to={productHref("onebusiness", `/leads/${c.lead_id}`)}>{t("leadsTitle")} →</Link>}
                </div>
              </li>
            ))}</ul>
          )}
        </>
      )}
    </div>
  );
}
