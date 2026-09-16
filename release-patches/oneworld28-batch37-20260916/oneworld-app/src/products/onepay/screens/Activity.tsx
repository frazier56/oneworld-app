import { useState } from "react";
import { Link } from "react-router-dom";
import { ScreenHeading, useAsync, productHref } from "@oneworld/shell";
import { useT, dateLocale } from "../lib/dict";
import { useMerchant } from "../lib/useMerchant";
import { activity, money, type ActivityRow } from "../lib/data";

const STATE_TONE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  pending: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  unresolved: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-200",
  voided: "bg-ink/10 opacity-70",
};

export default function Activity() {
  const { t, lang } = useT();
  const m = useMerchant();
  const [before, setBefore] = useState<string | undefined>();
  const [older, setOlder] = useState<ActivityRow[]>([]);
  const rows = useAsync(async () => m.merchant ? activity(m.merchant.id) : [], [m.merchant?.id]);
  const all = [...(rows ?? []), ...older];
  async function more() {
    if (!m.merchant || !all.length) return;
    const last = all[all.length - 1].created_at;
    const next = await activity(m.merchant.id, last);
    setOlder(o => [...o, ...next]); setBefore(last);
  }
  const label = (r: ActivityRow) => {
    if (r.status === "void") return t("voided");
    if (r.status === "refunded") return t("refund");
    if (r.status === "partially_refunded") return `${t("paid")} · ${t("refund")}`;
    const s = r.attempt_state; return s === "paid" ? t("paid") : s === "failed" ? t("failed") : s === "unresolved" ? t("unresolved") : s === "voided" ? t("voided") : s ? t("pendingState") : "—";
  };
  const tone = (r: ActivityRow) => STATE_TONE[r.status === "void" ? "voided" : (r.attempt_state ?? "pending")] ?? "";
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("activityTitle")}</ScreenHeading>
      {m.status === "loading" || rows === undefined ? <p className="py-10 text-center text-sm opacity-50">{t("loading")}</p>
      : !all.length ? <p className="py-10 text-center text-sm opacity-60">{t("noActivity")}</p>
      : (
        <ul className="mt-3 space-y-2">
          {all.map(r => (
            <li key={r.order_id}>
              <Link to={productHref("onepay", `/order/${r.order_id}`)} className="card ow-tap flex items-center justify-between gap-3 !rounded-2xl !p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-black">#{r.order_no}{r.customer_name ? ` · ${r.customer_name}` : ""}</p>
                  <p className="text-[11.5px] opacity-60">{new Date(r.created_at).toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{r.method ? ` · ${t(r.method === "cash" ? "cash" : r.method === "transfer" ? "transfer" : r.method === "tap" ? "tap" : r.method === "qr" ? "qr" : "link")}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-black tabular-nums">{money(r.total_minor, lang)}</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${tone(r)}`}>{label(r)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {all.length >= 50 && before !== all[all.length - 1]?.created_at && (
        <button type="button" onClick={more} className="ow-tap mt-3 w-full rounded-xl border border-ink/15 py-3 text-sm font-bold dark:border-white/15">{t("loadMore")}</button>
      )}
    </div>
  );
}
