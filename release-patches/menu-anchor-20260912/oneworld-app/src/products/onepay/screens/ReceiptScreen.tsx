import { useParams } from "react-router-dom";
import { ScreenHeading, useAsync } from "@oneworld/shell";
import { useT, dateLocale } from "../lib/dict";
import { fetchReceipt, money } from "../lib/data";

type Snap = { merchant?: { name?: string; legal_name?: string | null; tax_id?: string | null; city?: string | null }; order_no?: number; currency?: string;
  lines?: { name: string; qty: number; unit_minor: number; line_minor: number }[]; subtotal_minor?: number; discount_minor?: number; tip_minor?: number; total_minor?: number;
  method?: string; reference?: string | null; paid_at?: string; customer_name?: string | null; note?: string | null };

/** The receipt is the frozen snapshot the server wrote when the money was confirmed — never a re-render of live rows. */
export default function ReceiptScreen() {
  const { id = "" } = useParams();
  const { t, lang } = useT();
  const r = useAsync(() => fetchReceipt(id), [id]);
  if (r === undefined) return <p className="px-4 py-10 text-center text-sm opacity-50">{t("loading")}</p>;
  if (!r) return <p className="px-4 py-10 text-center text-sm opacity-60">—</p>;
  const s = r.snapshot as Snap;
  const share = async () => {
    const text = `${s.merchant?.name ?? "OnePay"} · ${t("receipt")} #${r.receipt_no} · ${money(s.total_minor ?? 0, lang)} · ${new Date(r.issued_at).toLocaleString(dateLocale(lang))}`;
    try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); } catch { /* user cancelled */ }
  };
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("receiptTitle")} #{r.receipt_no}</ScreenHeading>
      <section className="card mt-4 !rounded-2xl !p-5">
        <p className="text-lg font-black">{s.merchant?.name}</p>
        {s.merchant?.legal_name && <p className="text-[12px] opacity-70">{s.merchant.legal_name}</p>}
        {s.merchant?.tax_id && <p className="text-[12px] opacity-70">NIT {s.merchant.tax_id}</p>}
        <p className="mt-2 text-[12px] opacity-60">{t("issued")} {new Date(r.issued_at).toLocaleString(dateLocale(lang))} · #{s.order_no}</p>
        {s.customer_name && <p className="text-[12px]">{s.customer_name}</p>}
        <ul className="mt-4 space-y-1 border-t border-ink/10 pt-3 text-[13px] dark:border-white/10">
          {(s.lines ?? []).map((l, i) => <li key={i} className="flex justify-between"><span>{l.qty > 1 ? `${l.qty} × ` : ""}{l.name}</span><span className="tabular-nums">{money(l.line_minor, lang)}</span></li>)}
        </ul>
        <div className="mt-3 space-y-1 border-t border-ink/10 pt-3 text-[13px] dark:border-white/10">
          {(s.discount_minor ?? 0) > 0 && <p className="flex justify-between"><span>{t("discount")}</span><span className="tabular-nums">−{money(s.discount_minor ?? 0, lang)}</span></p>}
          {(s.tip_minor ?? 0) > 0 && <p className="flex justify-between"><span>{t("tip")}</span><span className="tabular-nums">{money(s.tip_minor ?? 0, lang)}</span></p>}
          <p className="flex justify-between text-base font-black"><span>{t("total")}</span><span className="tabular-nums">{money(s.total_minor ?? 0, lang)}</span></p>
          <p className="flex justify-between text-[12px] opacity-60"><span>{t("method")}</span><span>{s.method}{s.reference ? ` · ${s.reference}` : ""}</span></p>
        </div>
        {s.note && <p className="mt-3 text-[12px] opacity-70">{s.note}</p>}
        <button type="button" onClick={share} className="btn-primary mt-5 w-full">{t("share")}</button>
      </section>
    </div>
  );
}
