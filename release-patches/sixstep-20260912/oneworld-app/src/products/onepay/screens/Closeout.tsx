import { useState } from "react";
import { ScreenHeading, useAsync } from "@oneworld/shell";
import { useT, dateLocale } from "../lib/dict";
import { useMerchant } from "../lib/useMerchant";
import { daySummary, closeDay, money } from "../lib/data";

export default function Closeout() {
  const { t, lang } = useT();
  const m = useMerchant();
  const [tick, setTick] = useState(0);
  const s = useAsync(async () => m.merchant ? daySummary(m.merchant.id) : null, [m.merchant?.id, tick]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function close() { if (!m.merchant) return; setBusy(true); setErr(null); try { await closeDay(m.merchant.id); setTick(x => x + 1); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("closeoutTitle")}</ScreenHeading>
      <p className="mt-1 text-[13px] leading-relaxed opacity-70">{t("closeoutBody")}</p>
      {s && (
        <section className="card mt-4 !rounded-2xl !p-4">
          <p className="text-[12px] opacity-60">{new Date(s.business_date + "T12:00:00").toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" })}</p>
          <dl className="mt-2 space-y-1 text-[13.5px]">
            <div className="flex justify-between"><dt>{t("sales")}</dt><dd className="tabular-nums font-bold">{money(s.sales_minor, lang)}</dd></div>
            <div className="flex justify-between"><dt>{t("refunds")}</dt><dd className="tabular-nums font-bold">−{money(s.refunds_minor, lang)}</dd></div>
            <div className="flex justify-between border-t border-ink/10 pt-1 text-base font-black dark:border-white/10"><dt>{t("net")}</dt><dd className="tabular-nums">{money(s.net_minor, lang)}</dd></div>
            {Object.entries(s.by_method).map(([k, v]) => <div key={k} className="flex justify-between text-[12.5px] opacity-70"><dt>{k}</dt><dd className="tabular-nums">{money(v, lang)}</dd></div>)}
          </dl>
          {s.pending_count > 0 && <p className="mt-3 rounded-xl bg-amber-500/15 p-2 text-[12px] font-bold text-amber-800 dark:text-amber-200">{t("pendingBlock")} ({s.pending_count})</p>}
          {s.closed
            ? <p className="mt-3 rounded-xl bg-ink/10 p-2 text-center text-[12.5px] font-bold">{t("closed")}</p>
            : <button type="button" onClick={close} disabled={busy || s.pending_count > 0} className="btn-primary mt-3 w-full disabled:opacity-50">{t("closeNow")}</button>}
          {err && <p role="alert" className="mt-2 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
        </section>
      )}
    </div>
  );
}
