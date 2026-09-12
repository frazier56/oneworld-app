import { Link } from "react-router-dom";
import { NavIcon, useAsync, productHref } from "@oneworld/shell";
import { useT } from "../lib/dict";
import { useBusiness } from "../lib/useBusiness";
import { listSubscriptions, voiceSummary, bogota } from "../lib/data";

const TILE = "card ow-tap flex min-h-[92px] flex-col items-start justify-between !rounded-2xl !p-4";
export default function ProfileTiles() {
  const { t } = useT();
  return (
    <section className="grid grid-cols-3 gap-2">
      <Link to={productHref("onebusiness", "/services")} className={TILE}><NavIcon name="discover" className="text-brand" /><span className="text-[13px] font-bold leading-tight">{t("tileServices")}</span></Link>
      <Link to={productHref("onebusiness", "/leads")} className={TILE}><NavIcon name="people" className="text-brand" /><span className="text-[13px] font-bold leading-tight">{t("tileLeads")}</span></Link>
      <Link to={productHref("onebusiness", "/results")} className={TILE}><NavIcon name="score" className="text-brand" /><span className="text-[13px] font-bold leading-tight">{t("tileResults")}</span></Link>
    </section>
  );
}
export function ProfileStats() {
  const { t } = useT();
  const b = useBusiness();
  const subs = useAsync(async () => b.business ? listSubscriptions(b.business.id) : [], [b.business?.id]);
  const v = useAsync(async () => b.business ? voiceSummary(b.business.id, bogota(), bogota()) : null, [b.business?.id]);
  const cell = (val: string, l: string) => <div className="text-center"><p className="text-base font-black tabular-nums">{val}</p><p className="text-[11px] opacity-60">{l}</p></div>;
  return <div className="grid grid-cols-3 gap-2">{cell(subs ? String(subs.filter(s => s.state === "active").length) : "—", t("statServices"))}{cell(v && v.entitled ? String(v.follow_up_due) : "—", t("followUps"))}{cell(v && v.entitled && v.connected ? String(v.calls) : "—", t("statCalls"))}</div>;
}
