import { Link } from "react-router-dom";
import { ScreenHeading, useAsync, productHref, NavIcon } from "@oneworld/shell";
import { useT, dateLocale } from "../lib/dict";
import { useMerchant } from "../lib/useMerchant";
import { daySummary, money } from "../lib/data";
import Setup from "./Setup";

const METHOD: Record<string, { en: string; es: string }> = {
  cash: { en: "Cash", es: "Efectivo" }, transfer: { en: "Transfer", es: "Transferencia" }, link: { en: "Link", es: "Enlace" }, qr: { en: "QR", es: "QR" }, tap: { en: "Card tap", es: "Tarjeta" },
};

export default function Overview() {
  const { t, lang } = useT();
  const m = useMerchant();
  const summary = useAsync(async () => m.merchant ? daySummary(m.merchant.id) : null, [m.merchant?.id]);
  if (m.status === "loading") return <p className="px-4 py-10 text-center text-sm opacity-50">{t("loading")}</p>;
  if (!m.userId) return <p className="px-4 py-10 text-center text-sm opacity-60">{t("signInFirst")}</p>;
  if (m.status === "none") return <Setup onCreated={m.refresh} />;
  if (m.status === "error" || !m.merchant) return <p className="px-4 py-10 text-center text-sm text-rose-600">{m.error ?? t("errGeneric")}</p>;
  const s = summary;
  const date = new Date().toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{m.merchant.name}</ScreenHeading>
      {m.merchants.length > 1 && (
        <select className="field mt-2 w-full" value={m.merchant.id} onChange={e => m.select(e.target.value)} aria-label="Business">
          {m.merchants.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}
      <p className="mt-1 text-[12.5px] opacity-60">{t("today")} · {date}</p>

      <section className="card mt-4 !rounded-2xl !p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-bold uppercase tracking-wide opacity-60">{t("net")}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s?.closed ? "bg-ink/10" : "bg-brand/15 text-brand-deep dark:text-brand-light"}`}>{s?.closed ? t("dayClosed") : t("dayOpen")}</span>
        </div>
        <p className="mt-1 text-3xl font-black tabular-nums">{s ? money(s.net_minor, lang) : "—"}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div><p className="text-[11px] font-bold opacity-60">{t("sales")}</p><p className="text-sm font-black tabular-nums">{s ? money(s.sales_minor, lang) : "—"}</p></div>
          <div><p className="text-[11px] font-bold opacity-60">{t("refunds")}</p><p className="text-sm font-black tabular-nums">{s ? money(s.refunds_minor, lang) : "—"}</p></div>
          <div><p className="text-[11px] font-bold opacity-60">{t("count")}</p><p className="text-sm font-black tabular-nums">{s ? s.count_sales : "—"}{s && s.pending_count > 0 ? <span className="ml-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">+{s.pending_count} {t("pending")}</span> : null}</p></div>
        </div>
        {s && Object.keys(s.by_method).length > 0 && (
          <div className="mt-3 border-t border-ink/10 pt-2 dark:border-white/10">
            <p className="text-[11px] font-bold opacity-60">{t("byMethod")}</p>
            <ul className="mt-1 space-y-0.5 text-[12.5px]">
              {Object.entries(s.by_method).map(([k, v]) => <li key={k} className="flex justify-between"><span>{METHOD[k]?.[lang] ?? k}</span><span className="tabular-nums font-bold">{money(v, lang)}</span></li>)}
            </ul>
          </div>
        )}
        {s && s.count_sales === 0 && <p className="mt-2 text-[12px] opacity-60">{t("noSalesYet")}</p>}
      </section>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to={productHref("onepay", "/charge")} className="btn-primary flex items-center justify-center gap-2"><NavIcon name="money" /> {t("newCharge")}</Link>
        <Link to={productHref("onepay", "/activity")} className="card ow-tap flex items-center justify-center gap-2 !rounded-xl !py-3 text-sm font-bold"><NavIcon name="feed" /> {t("seeActivity")}</Link>
      </div>

      <p className={`mt-4 rounded-xl border p-3 text-[12px] leading-relaxed ${m.merchant.tap_enabled ? "border-brand/30 bg-brand/10" : "border-ink/10 bg-white/40 opacity-80 dark:border-white/10 dark:bg-white/5"}`}>
        {m.merchant.tap_enabled ? t("tapReady") : t("tapNotReady")}
      </p>
      {!s?.closed && (
        <Link to={productHref("onepay", "/closeout")} className="mt-3 block text-center text-[13px] font-bold text-brand-deep underline-offset-2 hover:underline dark:text-brand-light">{t("closeDay")}</Link>
      )}
    </div>
  );
}
