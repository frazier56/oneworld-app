import { Link } from "react-router-dom";
import { NavIcon, useAsync, productHref } from "@oneworld/shell";
import { useT } from "../lib/dict";
import { useMerchant } from "../lib/useMerchant";
import { daySummary, money } from "../lib/data";

const TILE = "card ow-tap flex min-h-[92px] flex-col items-start justify-between !rounded-2xl !p-4";

export default function ProfileTiles() {
  const { t } = useT();
  return (
    <section className="grid grid-cols-3 gap-2">
      <Link to={productHref("onepay", "/charge")} className={TILE}><NavIcon name="money" className="text-brand" /><span className="text-[13px] font-bold leading-tight">{t("tileCharge")}</span></Link>
      <Link to={productHref("onepay", "/activity")} className={TILE}><NavIcon name="feed" className="text-brand" /><span className="text-[13px] font-bold leading-tight">{t("tileActivity")}</span></Link>
      <Link to={productHref("onepay", "/closeout")} className={TILE}><NavIcon name="billing" className="text-brand" /><span className="text-[13px] font-bold leading-tight">{t("tileCloseout")}</span></Link>
    </section>
  );
}
export function ProfileStats() {
  const { t, lang } = useT();
  const m = useMerchant();
  const s = useAsync(async () => m.merchant ? daySummary(m.merchant.id) : null, [m.merchant?.id]);
  const cell = (v: string, l: string) => <div className="text-center"><p className="text-base font-black tabular-nums">{v}</p><p className="text-[11px] opacity-60">{l}</p></div>;
  return <div className="grid grid-cols-3 gap-2">{cell(s ? money(s.sales_minor, lang) : "—", t("statSales"))}{cell(s ? String(s.count_sales) : "—", t("statCharges"))}{cell(s ? String(s.pending_count) : "—", t("statPending"))}</div>;
}
