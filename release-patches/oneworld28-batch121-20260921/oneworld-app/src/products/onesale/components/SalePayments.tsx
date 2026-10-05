import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase, useOneId, W, Wt, productHref, COMMISSION_FEE_PCT, SALE_FEE_PCT } from "@oneworld/shell";
import { saleMoney } from "../lib/sale";
import RefundActions from "../../shared/RefundActions";

/* ============================================================================================
 * PAYMENTS ON A SIGNED PROMESA — earnest money and the agent's commission (Lee, 2 Oct 2026).
 *
 *   · Cards only, through Stripe. PayPal and Wise are never used for this.
 *   · OneHome never holds the money: the card is charged and the payee is paid straight away.
 *   · The payee bears the cost: commission → the agent, earnest money → the seller. OneHome keeps
 *     2.99 percent of a commission / 5.99 percent of earnest money, plus the card processing fee.
 *   · Every amount comes from the SIGNED agreement on the server; this screen only shows and asks.
 * ==========================================================================================*/
export type PayableAgreement = {
  id: string; status: string; currency: string | null; price: number | null; down_payment: number | null;
  commission_pct: number | null; commission_paid_by: string | null; lister_role: string | null;
  seller_id: string | null; buyer_id: string | null; agent_id: string | null; created_by: string | null;
  down_payment_due?: string | null; closing_date?: string | null;
};
type Row = { id: string; kind: "commission" | "earnest"; payer_id: string; payee_id: string; amount: number; currency: string; status: string; paid_at: string | null; transferred_at: string | null };
type Kind = "commission" | "earnest";

/* Can the signed-in member be paid by card? Their own Stripe payout row (RLS: own row only).
   null while loading. Shared by the payments panel and the promesa form. */
export function useMyPayoutReady(): boolean | null {
  const { userId } = useOneId();
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) { setReady(null); return; }
    let live = true;
    void supabase.from("stripe_connect_accounts").select("payouts_enabled").eq("user_id", userId).maybeSingle()
      .then(({ data, error }) => { if (live) setReady(error ? null : !!data?.payouts_enabled); });
    return () => { live = false; };
  }, [userId]);
  return ready;
}

/* The one "you can't be paid yet" card: amber, says why, one button to the payout screen. */
export function PayoutSetupNote({ lang, what }: { lang: string; what: "commission" | "earnest" }) {
  return (
    <div role="status" className="rounded-xl bg-amber-500/10 p-3 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
      <p className="font-bold">{W(lang, "Set up payouts to get paid by card", "Configure sus pagos para recibir con tarjeta")}</p>
      <p className="mt-0.5 opacity-90">{what === "commission"
        ? W(lang, "Until your payout account is ready, nobody can pay your commission in the app.", "Hasta que su cuenta de pagos esté lista, nadie puede pagarle la comisión en la app.")
        : W(lang, "Until your payout account is ready, the buyer cannot pay the earnest money in the app.", "Hasta que su cuenta de pagos esté lista, el comprador no puede pagar las arras en la app.")}</p>
      <Link to={productHref("onerental", "/host-profile")} className="btn-primary mt-2 inline-block px-4 text-[13px]">
        {W(lang, "Set up payouts", "Configurar pagos")}</Link>
    </div>
  );
}

export default function SalePayments({ a, lang }: { a: PayableAgreement; lang: string }) {
  const { userId } = useOneId();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [params, setParams] = useSearchParams();
  const [tick, setTick] = useState(0);
  const payoutReady = useMyPayoutReady();

  useEffect(() => {
    if (!userId) return;
    void supabase.from("sale_payments")
      .select("id, kind, payer_id, payee_id, amount, currency, status, paid_at, transferred_at")
      .eq("agreement_id", a.id).neq("status", "cancelled")
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [a.id, userId, tick]);

  /* Back from the card page: confirm with the server (it checks Stripe itself), then refresh. */
  useEffect(() => {
    const done = params.get("sale_payment"); const sid = params.get("session_id");
    if (!done) return;
    const next = new URLSearchParams(params); next.delete("sale_payment"); next.delete("session_id"); setParams(next, { replace: true });
    if (done === "cancelled") { setMsg({ tone: "warn", text: W(lang, "Payment cancelled. Nothing was charged.", "Pago cancelado. No se cobró nada.") }); return; }
    if (!sid) return;
    void supabase.functions.invoke("sale-payment", { body: { mode: "confirm", sessionId: sid } }).then(({ data, error }) => {
      const d = (data ?? {}) as any;
      if (error && !d.status) setMsg({ tone: "warn", text: W(lang, "We're confirming your payment. This page updates on its own within the hour.", "Estamos confirmando su pago. Esta página se actualiza sola dentro de la hora.") });
      else if (d.status === "transferred") setMsg({ tone: "ok", text: W(lang, "Paid. The money is on its way to the recipient.", "Pagado. El dinero va en camino a quien lo recibe.") });
      else if (d.status === "payee_not_ready") setMsg({ tone: "warn", text: W(lang, "Paid. The recipient still has to finish payout setup; we'll send it as soon as they do.", "Pagado. Quien recibe aún debe terminar su configuración de pagos; lo enviaremos en cuanto lo haga.") });
      else setMsg({ tone: "ok", text: W(lang, "Payment received.", "Pago recibido.") });
      setTick(t => t + 1);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (a.status !== "signed" || !userId) return null;
  const ccy = (a.currency === "COP" ? "COP" : "USD") as "USD" | "COP";
  const agentId = a.agent_id ?? (a.lister_role === "agent" ? a.created_by : null);
  const commission = (Number(a.price) || 0) * (Number(a.commission_pct) || 0) / 100;
  const earnest = Number(a.down_payment) || 0;
  const by = a.commission_paid_by;
  const myCommissionShare = by === "split"
    ? ((userId === a.seller_id || userId === a.buyer_id) ? commission / 2 : 0)
    : (by === "buyer" && userId === a.buyer_id) || (by === "seller" && userId === a.seller_id) ? commission : 0;

  const lines: { kind: Kind; label: string; amount: number; iPay: boolean; iReceive: boolean; feeNote: string; due: string | null }[] = [];
  const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(lang === "en" ? "en" : "es", { day: "numeric", month: "short", year: "numeric" });
  if (earnest > 0) lines.push({ kind: "earnest", label: W(lang, "Earnest money", "Arras"), amount: earnest,
    iPay: userId === a.buyer_id, iReceive: userId === a.seller_id, due: a.down_payment_due ?? null,
    feeNote: Wt(lang, "Goes straight to the seller. OneHome keeps {0} plus card processing.", "Va directo al vendedor. OneHome retiene {0} más el costo de la tarjeta.", [SALE_FEE_PCT]) });
  if (commission > 0 && agentId) lines.push({ kind: "commission", label: by === "split" && myCommissionShare > 0 ? W(lang, "Agent's commission · your half", "Comisión del agente · su mitad") : W(lang, "Agent's commission", "Comisión del agente"),
    amount: myCommissionShare || commission, iPay: myCommissionShare > 0, iReceive: userId === agentId, due: a.closing_date ?? null,
    feeNote: Wt(lang, "Goes straight to the agent. OneHome keeps {0} plus card processing, from the commission.", "Va directo al agente. OneHome retiene {0} más el costo de la tarjeta, de la comisión.", [COMMISSION_FEE_PCT]) });
  if (!lines.length) return null;

  async function pay(kind: Kind) {
    setBusy(kind); setMsg(null);
    const { data, error } = await supabase.functions.invoke("sale-payment", { body: { mode: "start", agreementId: a.id, kind } });
    const d = (data ?? {}) as any;
    if (d.url) { window.location.assign(d.url); return; }
    setBusy(null);
    let ctx: any = null; try { ctx = await (error as any)?.context?.json?.(); } catch { /* not json */ }
    const code = d.code ?? ctx?.code;
    setMsg({ tone: code === "payee_not_ready" || code === "terms_mismatch" ? "warn" : "err", text: code === "payee_not_ready"
      ? (kind === "commission"
          ? W(lang, "The agent hasn't set up card payouts yet, so nothing was charged. We've told them; try again once they finish it.", "El agente aún no configura sus pagos con tarjeta, así que no se cobró nada. Ya le avisamos; intente de nuevo cuando lo termine.")
          : W(lang, "The seller hasn't set up card payouts yet, so nothing was charged. We've told them; try again once they finish it.", "El vendedor aún no configura sus pagos con tarjeta, así que no se cobró nada. Ya le avisamos; intente de nuevo cuando lo termine."))
      : code === "terms_mismatch" ? W(lang, "The promesa text doesn't state this amount, so nothing was charged. Ask the agent to send a corrected promesa.", "El texto de la promesa no indica este monto, así que no se cobró nada. Pídale al agente que envíe una promesa corregida.")
      : (ctx?.error ?? d.error ?? W(lang, "The payment could not start. Try again.", "No se pudo iniciar el pago. Intente de nuevo.")) });
  }

  const rowFor = (k: Kind) => rows?.filter(r => r.kind === k) ?? [];
  const when = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(lang === "en" ? "en" : "es", { day: "numeric", month: "short" }) : "";

  return (
    <section className="ow-panel space-y-3 p-4" aria-label={W(lang, "Payments", "Pagos")}>
      <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{W(lang, "Payments", "Pagos")}</h2>
      {lines.map(l => {
        const mine = rowFor(l.kind).filter(r => r.payer_id === userId);
        const all = rowFor(l.kind);
        const paidMine = mine.find(r => ["paid", "transferred", "payee_not_ready", "transfer_failed"].includes(r.status));
        const sent = all.filter(r => r.status === "transferred");
        return (
          <div key={l.kind} className="rounded-2xl border border-ink/10 p-3 dark:border-white/10">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-bold">{l.label}</p>
              <p className="text-[15px] font-black tabular-nums">{saleMoney(l.amount, ccy)}</p>
            </div>
            {l.due && <p className="mt-0.5 text-[12px] font-semibold opacity-75">{Wt(lang, "Due by {0}, as the promesa says", "Vence el {0}, según la promesa", [day(l.due)])}</p>}
            <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">{l.feeNote}</p>
            {l.iPay && ccy === "COP" && l.amount > 9_999_999 && (
              <p className="mt-1 text-[11.5px] leading-relaxed opacity-60">{W(lang,
                "Use Visa or Mastercard: American Express does not take a single peso charge this large.",
                "Use Visa o Mastercard: American Express no acepta un cargo en pesos de este tamaño.")}</p>
            )}
            {l.iPay && !paidMine && (
              <button type="button" disabled={busy !== null} onClick={() => void pay(l.kind)}
                className="btn-primary mt-3 w-full disabled:opacity-50">
                {busy === l.kind ? W(lang, "Opening…", "Abriendo…")
                  : l.kind === "earnest" ? W(lang, "Pay earnest money", "Pagar las arras") : W(lang, "Pay commission", "Pagar la comisión")}
              </button>
            )}
            {paidMine && (
              <p className="mt-2 text-[12.5px] font-semibold text-teal-deep dark:text-teal-light">
                {paidMine.status === "transferred"
                  ? Wt(lang, "Paid {0} · sent to the recipient", "Pagado el {0} · enviado a quien recibe", [when(paidMine.paid_at)])
                  : Wt(lang, "Paid {0} · on its way", "Pagado el {0} · en camino", [when(paidMine.paid_at)])}
              </p>
            )}
            {!l.iPay && !l.iReceive && (
              <p className="mt-2 text-[12.5px] font-semibold opacity-75">
                {sent.length
                  ? Wt(lang, "Paid {0} · sent to the recipient", "Pagado el {0} · enviado a quien recibe", [when(sent[sent.length - 1].paid_at)])
                  : all.some(r => ["paid", "payee_not_ready", "transfer_failed"].includes(r.status))
                    ? W(lang, "Paid · on its way to the recipient", "Pagado · en camino a quien recibe")
                    : W(lang, "Not paid yet", "Aún no se ha pagado")}
              </p>
            )}
            {l.iReceive && payoutReady === false && !sent.length && <div className="mt-2"><PayoutSetupNote lang={lang} what={l.kind} /></div>}
            {l.iReceive && (payoutReady !== false || sent.length > 0) && (
              <p className="mt-2 text-[12.5px] font-semibold">
                {sent.length
                  ? Wt(lang, "Received {0} · sent to your payout account", "Recibido el {0} · enviado a su cuenta de pagos", [when(sent[sent.length - 1].transferred_at)])
                  : W(lang, "Not paid yet. You'll get a notification when it is.", "Aún no se ha pagado. Le avisaremos cuando se pague.")}
                {" "}<Link to={productHref("onerental", "/host-profile")} className="font-bold text-brand-deep underline dark:text-brand-light">
                  {W(lang, "Payout account", "Cuenta de pagos")}</Link>
              </p>
            )}
            {/* Overlay 28: the payee can give money back; a payer sees what came back. The server
                refuses a payer's give-back (arras follow the signed promesa, settled off-platform). */}
            {all.filter(r => (r.payee_id === userId || r.payer_id === userId) && ["paid", "transferred", "payee_not_ready", "transfer_failed"].includes(r.status))
              .map(r => <RefundActions key={r.id} target={{ salePaymentId: r.id }} lang={lang} onDone={() => setTick(t => t + 1)} />)}
          </div>
        );
      })}
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-xl p-2.5 text-[12.5px] font-semibold ${
        msg.tone === "ok" ? "bg-teal/10 text-teal-deep dark:text-teal-light" : msg.tone === "warn" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>{msg.text}</p>}
      <p className="text-[11px] leading-relaxed opacity-50">{W(lang,
        "Card only. OneHome never holds the money: it goes to the recipient as soon as the card is charged.",
        "Solo tarjeta. OneHome nunca retiene el dinero: va a quien lo recibe en cuanto se cobra la tarjeta.")}</p>
    </section>
  );
}
