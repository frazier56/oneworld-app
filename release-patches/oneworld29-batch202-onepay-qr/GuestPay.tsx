import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase, W, useI18n } from "@oneworld/shell";
import { LocalPaySheet, useLocalPayReturn, type LocalPayResult } from "./LocalPaySheet";

/* ============================================================================================
 * PAY WHAT YOU SCANNED — the customer's side of a OnePay QR (Lee, 29 Oct 2026).
 * *"They don't sign up, they go to the payment screen, they pay, and that's it. They just put
 * their name and email so they'll receive a receipt."*
 * Public page: the token in the address is the only key, and it shows only this one sale.
 * ============================================================================================ */
type View = { merchant: string; city: string | null; order_no: number; total_minor: number; state: string;
  lines: { name: string; qty: number; line_minor: number }[] };

const pesos = (minor: number, lang: string) =>
  new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", { style: "currency", currency: "COP", currencyDisplay: "code", maximumFractionDigits: 0 })
    .format(Math.round(minor / 100));

export default function GuestPay() {
  const { token = "" } = useParams();
  const { lang } = useI18n();
  const [view, setView] = useState<View | null>(null);
  const [bad, setBad] = useState(false);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<LocalPayResult | null>(null);
  const back = useLocalPayReturn();

  useEffect(() => {
    supabase.functions.invoke("wompi-pay", { body: { action: "pay_view", pay_token: token } })
      .then(({ data, error }) => { if (error || !data) setBad(true); else setView(data as View); });
  }, [token, done]);

  const result = done ?? (back && back !== "checking" ? back : null);
  const paid = result?.status === "APPROVED" || view?.state === "paid";

  return (
    <div className="mx-auto flex min-h-[85vh] max-w-[440px] flex-col gap-4 px-5 pb-10 pt-8 text-ink dark:text-white" data-ow="guest-pay">
      {bad ? (
        <p className="m-0 text-center text-[16px] font-bold">{W(lang, "This payment link isn't valid.", "Este enlace de pago no es válido.")}</p>
      ) : !view ? (
        <p className="m-0 text-center opacity-60">{W(lang, "Loading…", "Cargando…")}</p>
      ) : (
        <>
          <div className="text-center">
            <p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] opacity-55">{W(lang, "Pay", "Pagar a")}</p>
            <h1 className="m-0 mt-1 text-[26px] font-black leading-tight">{view.merchant}</h1>
            {view.city && <p className="m-0 mt-0.5 text-[13px] opacity-60">{view.city}</p>}
          </div>
          <div className="card divide-y divide-ink/5 p-4 dark:divide-white/10">
            {view.lines.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 py-2 text-[15px]">
                <span>{l.qty > 1 ? `${l.qty} × ` : ""}{l.name}</span>
                <span className="font-bold tabular-nums">{pesos(l.line_minor, lang)}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between pt-3 text-[18px] font-black">
              <span>{W(lang, "Total", "Total")}</span><span className="tabular-nums" data-ow-total>{pesos(view.total_minor, lang)}</span>
            </div>
          </div>
          {back === "checking" ? (
            <p className="m-0 text-center font-bold" data-ow-pay-status="checking">{W(lang, "Checking with your bank…", "Confirmando con su banco…")}</p>
          ) : paid ? (
            <div className="card p-5 text-center" data-ow-pay-status="APPROVED">
              <p className="m-0 text-[22px] font-black">{W(lang, "Paid", "Pagado")} ✓</p>
              <p className="m-0 mt-1 text-[14px] opacity-70">{W(lang, "The business can see your payment. You can close this page.", "El negocio ya ve su pago. Puede cerrar esta página.")}</p>
            </div>
          ) : view.state !== "pending" ? (
            <p className="m-0 text-center font-bold">{W(lang, "This charge was cancelled by the business.", "El negocio canceló este cobro.")}</p>
          ) : (
            <>
              {result && <p className="m-0 text-center text-[14px] font-bold text-red-500" data-ow-pay-status={result.status}>{W(lang, "That payment didn't go through. Try again.", "Ese pago no se realizó. Intente de nuevo.")}</p>}
              <button type="button" onClick={() => setOpen(true)}
                className="ow-tap h-[54px] rounded-[18px] bg-[#2C2622] text-[17px] font-extrabold text-white dark:bg-white dark:text-[#201B16]">
                {W(lang, "Pay", "Pagar")} {pesos(view.total_minor, lang)}
              </button>
              <p className="m-0 text-center text-[12.5px] opacity-60">{W(lang, "Nequi or PSE · no account needed", "Nequi o PSE · sin crear cuenta")}</p>
            </>
          )}
          {open && (
            <LocalPaySheet purpose="onepay" payToken={token} amountLabel={pesos(view.total_minor, lang)}
              returnPath={window.location.pathname} onClose={() => setOpen(false)} onDone={r => { setDone(r); if (r.status === "APPROVED") setOpen(false); }} />
          )}
        </>
      )}
    </div>
  );
}
