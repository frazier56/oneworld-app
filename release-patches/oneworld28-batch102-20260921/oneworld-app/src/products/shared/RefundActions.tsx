import { useEffect, useState } from "react";
import { supabase, W, Wt, POLICY_COPY, type CancelPolicy } from "@oneworld/shell";

/* ============================================================================================
 * REFUNDS AND CANCELLATIONS — overlay 28 (Lee, 2 Oct 2026: "let's keep going with the refunds").
 *
 * ONE component for every money-back moment, rent and sale alike (same experience = same code):
 *   · rental guest  → "Cancel stay", refund set by the booking's cancellation policy
 *   · rental host   → "Cancel stay" (the guest gets everything back) or "Give money back" (any part)
 *   · sale payee    → "Give money back" (the seller for earnest money, the agent for commission)
 *   · sale payer    → nothing. Arras are governed by the signed promesa and Colombian civil law;
 *                     a payer pulling money back would be OneHome deciding a contract dispute.
 *
 * The SERVER decides everything (who you are, what the policy gives, how much is left). This asks
 * `onehome-refund` for a quote, shows its numbers, and sends only the id and the amount typed.
 * ==========================================================================================*/
type Target = { rentalRequestId: string } | { salePaymentId: string };
type Quote = {
  ok: true; kind: "rental" | "sale"; role: "guest" | "host" | "payee" | "payer";
  partyRole?: "seller" | "agent" | "buyer"; currency: string; charged: number; refunded: number; inProgress: boolean;
  policy?: CancelPolicy; policyPct?: number; band?: "full" | "partial" | "none"; daysBefore?: number;
  maxRefundable: number;
  cancel?: { allowed: boolean; refund?: number; holdRelease?: boolean; outsideRail?: boolean; code?: string };
  giveBack?: { allowed: boolean; max?: number; code?: string };
};

const money = (n: number, ccy: string) =>
  `${n.toLocaleString(ccy === "COP" ? "es-CO" : "en-US", { maximumFractionDigits: ccy === "COP" ? 0 : 2, minimumFractionDigits: ccy === "COP" ? 0 : 2 })} ${ccy}`;

/** Copy for every code the server can return (CLIENT_CONTRACT.md §4). */
function codeText(lang: string, code: string | undefined, kind: "rental" | "sale", extra: any): string {
  switch (code) {
    case "unauthenticated": return W(lang, "Please sign in again.", "Inicie sesión de nuevo.");
    case "not_found": return W(lang, "We couldn't find this booking or payment.", "No encontramos esta reserva o pago.");
    case "not_party": return W(lang, "This booking or payment isn't yours.", "Esta reserva o pago no es suyo.");
    case "not_allowed_role": return kind === "rental"
      ? W(lang, "Only the host can give money back. To get money back, cancel before your stay starts or message your host.", "Solo el anfitrión puede devolver dinero. Para recibir un reembolso, cancele antes de que empiece su estadía o escríbale a su anfitrión.")
      : W(lang, "Only the person who received this payment can give it back. Disagreements about the promesa are settled between the parties, outside OneHome.", "Solo quien recibió este pago puede devolverlo. Los desacuerdos sobre la promesa se resuelven entre las partes, fuera de OneHome.");
    case "stay_started": return W(lang, "Your stay has started, so it can't be cancelled here. Message your host — they can give money back.", "Su estadía ya comenzó, así que no se puede cancelar aquí. Escríbale a su anfitrión: puede devolverle dinero.");
    case "stay_ended": return W(lang, "This stay has ended, so it can't be cancelled. You can still give money back.", "Esta estadía ya terminó, así que no se puede cancelar. Aún puede devolver dinero.");
    case "bad_state": return W(lang, "This request has already ended.", "Esta solicitud ya terminó.");
    case "not_card": return W(lang, "This stay wasn't paid by card through OneHome, so OneHome can't refund it. You and the other party settle it between yourselves.", "Esta estadía no se pagó con tarjeta a través de OneHome, así que OneHome no puede reembolsarla. Ustedes lo resuelven directamente entre las partes.");
    case "nothing_to_refund": return W(lang, "There's nothing left to give back.", "No queda nada por devolver.");
    case "amount_too_large": return Wt(lang, "You can give back at most {0}.", "Puede devolver como máximo {0}.", [money(Number(extra?.max) || 0, String(extra?.currency || ""))]);
    case "refund_in_progress": return W(lang, "Another refund for this payment is being processed. Try again in a minute.", "Hay otro reembolso de este pago en proceso. Intente de nuevo en un minuto.");
    case "out_of_sync": return W(lang, "This payment can't be refunded here right now. OneHome support has been alerted.", "Este pago no se puede reembolsar aquí por ahora. El soporte de OneHome ya fue alertado.");
    case "reversal_failed": return W(lang, "We couldn't take the money back from the payout account. Nothing was refunded. OneHome support has been alerted.", "No pudimos recuperar el dinero de la cuenta de pagos. No se reembolsó nada. El soporte de OneHome ya fue alertado.");
    case "refund_failed": return extra?.finishing
      ? W(lang, "The refund didn't go through yet. OneHome support has been alerted and will finish it.", "El reembolso aún no se completó. El soporte de OneHome ya fue alertado y lo terminará.")
      : W(lang, "The refund didn't go through. Nothing was refunded. Try again later.", "El reembolso no se completó. No se reembolsó nada. Intente más tarde.");
    case "record_failed": return W(lang, "Something went wrong saving this. OneHome support has been alerted. Please don't try again more than once.", "Algo falló al guardar esto. El soporte de OneHome ya fue alertado. No lo intente más de una vez.");
    case "not_configured": return W(lang, "Card refunds aren't available right now.", "Los reembolsos con tarjeta no están disponibles en este momento.");
    case "read_failed": return W(lang, "We couldn't load this right now. Nothing was changed. Try again.", "No pudimos cargar esto ahora. No se cambió nada. Intente de nuevo.");
    case "bad_request": return W(lang, "Something in the request is missing. Refresh and try again.", "Falta información en la solicitud. Actualice e intente de nuevo.");
    default: return W(lang, "Something went wrong. If money moved, OneHome support has been alerted.", "Algo salió mal. Si se movió dinero, el soporte de OneHome ya fue alertado.");
  }
}

async function call(body: Record<string, unknown>): Promise<{ data: any; code?: string; extra?: any }> {
  const { data, error } = await supabase.functions.invoke("onehome-refund", { body });
  if (!error) return { data };
  let ctx: any = null; try { ctx = await (error as any)?.context?.json?.(); } catch { /* not json */ }
  return { data: null, code: ctx?.code ?? "internal", extra: ctx };
}

export default function RefundActions({ target, lang, onDone }: { target: Target; lang: string; onDone?: () => void }) {
  const [q, setQ] = useState<Quote | null>(null);
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<null | "cancel" | "give">(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const key = "rentalRequestId" in target ? target.rentalRequestId : target.salePaymentId;

  useEffect(() => {
    let live = true;
    void call({ mode: "quote", ...target }).then(r => { if (live) setQ(r.data?.ok ? r.data as Quote : null); });
    return () => { live = false; };
  }, [key, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!q) return null;
  const canCancel = !!q.cancel?.allowed;
  const canGive = !!q.giveBack?.allowed;
  if (!canCancel && !canGive && !(q.refunded > 0) && !msg) return null;

  const ccy = q.currency;
  const policyName = q.policy ? POLICY_COPY[q.policy].title[lang === "es" || lang === "co" ? "es" : "en"] : "";


  async function run() {
    setBusy(true); setMsg(null);
    const body = mode === "cancel"
      ? { mode: "cancel_stay", ...target, reason: reason.trim() || undefined }
      : { mode: "give_back", ...target, amount: Number(amount.replace(",", ".")), reason: reason.trim() || undefined };
    const r = await call(body);
    setBusy(false);
    if (!r.data?.ok) { setMsg({ tone: "err", text: codeText(lang, r.code, q!.kind, r.extra) }); return; }
    const ref = r.data.refund ?? {};
    const amt = money(Number(ref.amount) || 0, String(ref.currency || ccy));
    let text: string;
    if (mode === "give") text = q!.kind === "rental"
      ? Wt(lang, "Done. {0} is on its way back to the guest's card.", "Listo. {0} va de vuelta a la tarjeta de su huésped.", [amt])
      : Wt(lang, "Done. {0} is on its way back to the card that paid.", "Listo. {0} va de vuelta a la tarjeta que pagó.", [amt]);
    else if (ref.status === "refunded") text = Wt(lang, "Cancelled. {0} is on its way back to the card. Banks usually show it within 5 to 10 business days.", "Cancelada. {0} va de vuelta a la tarjeta. Los bancos suelen mostrarlo en 5 a 10 días hábiles.", [amt]);
    else if (ref.status === "outside_rail") text = W(lang, "Cancelled. Any money paid outside OneHome is settled directly between you.", "Cancelada. Cualquier dinero pagado fuera de OneHome se arregla directamente entre ustedes.");
    else if (ref.status === "hold_released") text = W(lang, "Cancelled. The hold on the card is released. Nothing was charged.", "Cancelada. Se liberó la retención en la tarjeta. No se cobró nada.");
    else if (ref.status === "hold_release_pending") text = W(lang, "Cancelled. The hold on the card will be released within the hour. Nothing was charged.", "Cancelada. La retención en la tarjeta se liberará dentro de la próxima hora. No se cobró nada.");
    else text = (q!.band === "none" && q!.charged > 0)
      ? W(lang, "Cancelled. Under this booking's cancellation policy no money comes back.", "Cancelada. Según la política de cancelación de esta reserva no hay reembolso.")
      : W(lang, "Cancelled. Nothing was charged.", "Cancelada. No se cobró nada.");
    setMsg({ tone: "ok", text }); setMode(null); setAmount(""); setReason("");
    setTick(t => t + 1); onDone?.();
  }

  const giveMax = q.giveBack?.max ?? 0;
  const amt = Number(amount.replace(",", "."));
  const amtOk = amt > 0 && amt <= giveMax;

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-ink/10 p-3 dark:border-white/10">
      {q.refunded > 0 && (
        <p className="text-[12.5px] font-semibold">{Wt(lang, "Refunded so far: {0} of {1}", "Reembolsado hasta ahora: {0} de {1}", [money(q.refunded, ccy), money(q.charged, ccy)])}
          {q.inProgress && <span className="opacity-60"> · {W(lang, "processing", "en proceso")}</span>}</p>
      )}

      {!mode && (canCancel || canGive) && (
        <div className={`grid gap-2 ${canCancel && canGive ? "grid-cols-2" : "grid-cols-1"}`}>
          {canCancel && <button type="button" className="btn-ghost w-full text-[13.5px] font-bold text-rose-600 dark:text-rose-300" onClick={() => { setMode("cancel"); setMsg(null); }}>
            {W(lang, "Cancel stay", "Cancelar estadía")}</button>}
          {canGive && <button type="button" className="btn-ghost w-full text-[13.5px] font-bold" onClick={() => { setMode("give"); setMsg(null); }}>
            {W(lang, "Give money back", "Devolver dinero")}</button>}
        </div>
      )}

      {mode === "cancel" && q.cancel && (
        <div className="space-y-2">
          <p className="text-[13px] font-bold">
            {q.cancel.outsideRail
              ? W(lang, "This stay was paid outside OneHome. Cancelling moves no money; any money paid is settled directly between you.", "Esta estadía se pagó fuera de OneHome. Cancelar no mueve dinero; lo pagado se arregla directamente entre ustedes.")
              : q.cancel.holdRelease
              ? W(lang, "The hold on the card is released. Nothing is charged.", "Se libera la retención en la tarjeta. No se cobra nada.")
              : q.role === "host"
                ? Wt(lang, "The guest gets everything back: {0}. Your payout for this stay is taken back.", "Su huésped recibe todo de vuelta: {0}. Se recupera su pago por esta estadía.", [money(q.cancel.refund ?? 0, ccy)])
                : (q.cancel.refund ?? 0) > 0
                  ? Wt(lang, "You get back {0} ({1}% under the {2} policy).", "Recibe de vuelta {0} ({1}% según la política {2}).", [money(q.cancel.refund ?? 0, ccy), q.policyPct ?? 0, policyName])
                  : Wt(lang, "Under the {0} policy, no money comes back if you cancel now.", "Según la política {0}, si cancela ahora no hay reembolso.", [policyName])}
          </p>
          <textarea className="input min-h-[64px] w-full text-[13px]" maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
            placeholder={W(lang, "Reason (optional)", "Motivo (opcional)")} aria-label={W(lang, "Reason", "Motivo")} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost w-full text-[13.5px]" disabled={busy} onClick={() => setMode(null)}>{W(lang, "Keep stay", "Mantener estadía")}</button>
            <button type="button" className="btn-primary w-full text-[13.5px] disabled:opacity-50" disabled={busy} onClick={() => void run()}>
              {busy ? "…" : W(lang, "Confirm cancel", "Confirmar")}</button>
          </div>
        </div>
      )}

      {mode === "give" && (
        <div className="space-y-2">
          <label className="block">
            {/* Label and limit on one row, each unbroken: "(up to 49.500.000 COP)" wrapped "COP" onto
                its own line at 390px in the first UAT pass. */}
            <span className="flex items-baseline justify-between gap-2 text-[12px] font-bold">
              <span className="opacity-70">{W(lang, "Amount", "Monto")}</span>
              <span className="whitespace-nowrap opacity-60">{Wt(lang, "up to {0}", "hasta {0}", [money(giveMax, ccy)])}</span>
            </span>
            <input className="input mt-1 h-11 w-full text-[15px]" inputMode="decimal" value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder={String(giveMax)} />
          </label>
          <button type="button" className="text-[12px] font-bold text-brand-deep underline dark:text-brand-light" onClick={() => setAmount(String(giveMax))}>
            {W(lang, "Give back everything left", "Devolver todo lo que queda")}</button>
          <textarea className="input min-h-[64px] w-full text-[13px]" maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
            placeholder={W(lang, "Reason (optional)", "Motivo (opcional)")} aria-label={W(lang, "Reason", "Motivo")} />
          <p className="text-[11.5px] leading-relaxed opacity-60">{W(lang,
            "It goes back to the card that paid. If you were already paid, your share comes back out of your payout first.",
            "Vuelve a la tarjeta que pagó. Si ya recibió el pago, su parte se descuenta primero de su cuenta de pagos.")}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost w-full text-[13.5px]" disabled={busy} onClick={() => setMode(null)}>{W(lang, "Not now", "Ahora no")}</button>
            <button type="button" className="btn-primary w-full text-[13.5px] disabled:opacity-50" disabled={busy || !amtOk} onClick={() => void run()}>
              {busy ? "…" : W(lang, "Send back", "Devolver")}</button>
          </div>
        </div>
      )}

      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-xl p-2.5 text-[12.5px] font-semibold ${
        msg.tone === "ok" ? "bg-teal/10 text-teal-deep dark:text-teal-light" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
