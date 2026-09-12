import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ScreenHeading, useAsync, productHref, supabase } from "@oneworld/shell";
import { useT, dateLocale } from "../lib/dict";
import { useMerchant } from "../lib/useMerchant";
import { fetchOrderAttempts, fetchReceipt, refund, voidOrder, confirmTransfer, cancelAttempt, money, parsePesos, type Order } from "../lib/data";

export default function OrderDetail() {
  const { id = "" } = useParams();
  const { t, lang } = useT();
  const m = useMerchant();
  const [tick, setTick] = useState(0);
  const order = useAsync(async () => { const { data } = await supabase.from("onepay_orders" as never).select("*").eq("id", id).maybeSingle(); return (data as Order | null) ?? null; }, [id, tick]);
  const attempts = useAsync(() => fetchOrderAttempts(id), [id, tick]);
  const receipt = useAsync(() => fetchReceipt(id), [id, tick]);
  const [amt, setAmt] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const isManager = !!m.merchant && (m.merchant.owner_id === m.userId);   // owner always; managers resolved server-side
  const paid = attempts?.find(a => a.state === "paid");
  const live = attempts?.find(a => a.state === "pending" || a.state === "unresolved");
  async function run(fn: () => Promise<unknown>) { setBusy(true); setErr(null); try { await fn(); setTick(x => x + 1); setAmt(""); setReason(""); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }
  if (!order) return <p className="px-4 py-10 text-center text-sm opacity-50">{t("loading")}</p>;
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("order")} #{order.order_no}</ScreenHeading>
      <section className="card mt-4 !rounded-2xl !p-4">
        <p className="text-3xl font-black tabular-nums">{money(order.total_minor, lang)}</p>
        <p className="mt-1 text-[12px] opacity-60">{new Date(order.created_at).toLocaleString(dateLocale(lang))}{order.customer_name ? ` · ${order.customer_name}` : ""}</p>
        {order.note && <p className="mt-1 text-[12.5px]">{order.note}</p>}
        <p className="mt-2 text-[12px]"><span className="opacity-60">{t("status")}:</span> <strong>{order.status}</strong></p>
      </section>
      <h2 className="mt-4 text-sm font-black">{t("method")}</h2>
      <ul className="mt-2 space-y-2">
        {(attempts ?? []).map(a => (
          <li key={a.id} className="card !rounded-2xl !p-3 text-[12.5px]">
            <div className="flex justify-between"><strong>{t(a.method === "cash" ? "cash" : a.method === "transfer" ? "transfer" : a.method === "tap" ? "tap" : a.method === "qr" ? "qr" : "link")}</strong><span>{a.state}</span></div>
            <div className="mt-0.5 flex justify-between opacity-60"><span>{new Date(a.created_at).toLocaleString(dateLocale(lang))}</span><span>{a.provider_ref ?? a.reference ?? ""}</span></div>
            {a.state === "pending" && a.method === "transfer" && (
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => run(() => confirmTransfer(a.id))} className="btn-primary flex-1 !py-2 text-[12.5px] disabled:opacity-50">{t("confirmTransfer")}</button>
                <button type="button" disabled={busy} onClick={() => run(() => cancelAttempt(a.id))} className="ow-tap flex-1 rounded-xl border border-ink/15 text-[12.5px] font-bold dark:border-white/15">{t("cancelAttempt")}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {receipt && <Link to={productHref("onepay", `/receipt/${order.id}`)} className="btn-primary mt-4 block text-center">{t("receipt")} #{receipt.receipt_no}</Link>}
      {paid && order.status !== "refunded" && (paid.method === "cash" || paid.method === "transfer") && (
        <section className="card mt-4 !rounded-2xl !p-4">
          <p className="text-sm font-black">{t("refund")}</p>
          <p className="mt-1 text-[11.5px] opacity-60">{t("refundHint")}</p>
          <input className="field mt-2 w-full tabular-nums" inputMode="numeric" value={amt} onChange={e => setAmt(e.target.value)} placeholder={t("refundAmount")} />
          <input className="field mt-2 w-full" value={reason} onChange={e => setReason(e.target.value)} placeholder={t("refundReason")} />
          <button type="button" disabled={busy || parsePesos(amt) <= 0} onClick={() => run(() => refund(paid.id, parsePesos(amt), reason))} className="btn-primary mt-2 w-full disabled:opacity-50">{t("doRefund")}</button>
        </section>
      )}
      {order.status === "open" && !live && isManager !== undefined && (
        <button type="button" disabled={busy} onClick={() => run(() => voidOrder(order.id))} className="ow-tap mt-4 w-full rounded-xl border border-ink/15 py-3 text-sm font-bold dark:border-white/15">{t("void")}</button>
      )}
      {err && <p role="alert" className="mt-3 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
    </div>
  );
}
