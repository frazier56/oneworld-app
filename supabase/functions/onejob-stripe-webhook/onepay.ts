/**
 * onejob-stripe-webhook · OnePay block (v26, 12 Nov 2026, release nov12-orch2).
 *
 * OnePay's saved-card payments (edge function `onepay-card-pay` v1) are Stripe PaymentIntents on the
 * PLATFORM account, tagged metadata.purpose = "onepay_send" + metadata.onepay_send_id. The function
 * records the payment itself while the payer waits — but if the page closes during the bank's 3-D
 * Secure check, or the write fails after Stripe took the money (it answers 500 + a critical alert),
 * nothing else would ever record it. Stripe's own notice is the safety net:
 *
 *   payment_intent.succeeded      -> public.onepay_send_card_paid(send, amount_received, pi)
 *   payment_intent.payment_failed -> public.onepay_send_card_failed(send, pi, reason)
 *
 * Both database functions are idempotent and are the SAME ones onepay-card-pay calls, so a payment
 * recorded twice (function + webhook) settles once; a duplicate, a payment after cancel or a wrong
 * amount goes to the OnePay refund queue with an alert (onepay_send_wompi_paid's own rules).
 *
 * Nothing here moves money. A failed write answers 500 so Stripe retries (the caller releases the
 * idempotency claim). Events that are not OnePay's fall through to the existing OneJob branches
 * untouched.
 */

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
export type OnePayOutcome = {
  status: 200 | 500;
  msg: string;
  alert?: { code: string; message: string; severity: "warn" | "error" | "critical"; context: Record<string, unknown> };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The OnePay send this event is about, or null when the event is not a OnePay card payment. */
export function onepaySendId(type: string, obj: any, connectedAccountId: string | null): string | null {
  if (type !== "payment_intent.succeeded" && type !== "payment_intent.payment_failed") return null;
  if (connectedAccountId) return null; // OnePay card payments are platform PaymentIntents only.
  const md = obj?.metadata ?? {};
  if (md.purpose !== "onepay_send") return null;
  const id = String(md.onepay_send_id ?? "");
  return UUID.test(id) ? id : null;
}

export async function handleOnePay(type: string, obj: any, sendId: string, rpc: Rpc): Promise<OnePayOutcome> {
  const pi = String(obj?.id ?? "");
  if (!/^pi_[A-Za-z0-9]+$/.test(pi)) {
    return { status: 200, msg: "onepay: no payment intent id", alert: { code: "onepay_webhook_bad_pi", message: `OnePay webhook ${type} for send ${sendId} carried no usable PaymentIntent id`, severity: "error", context: { type, sendId } } };
  }

  if (type === "payment_intent.succeeded") {
    const amount = Number(obj.amount_received ?? obj.amount);
    const currency = String(obj.currency ?? "").toLowerCase();
    if (currency !== "cop" || !Number.isSafeInteger(amount) || amount <= 0) {
      return { status: 200, msg: "onepay: not recorded (currency/amount)", alert: { code: "onepay_card_unexpected", message: `OnePay: card payment ${pi} succeeded in ${currency || "?"} ${obj.amount_received ?? obj.amount} for send ${sendId} — not a pesos amount, check it by hand`, severity: "critical", context: { type, sendId, pi, currency, amount: obj.amount_received ?? obj.amount } } };
    }
    const { data, error } = await rpc("onepay_send_card_paid", { p_send: sendId, p_amount_minor: amount, p_pi: pi });
    if (error) {
      return { status: 500, msg: "onepay: record failed", alert: { code: "onepay_card_not_recorded", message: `OnePay: card payment ${pi} succeeded but send ${sendId} could not be updated from the webhook — Stripe will retry: ${error.message ?? "error"}`, severity: "critical", context: { type, sendId, pi, amount, error: error.message ?? null } } };
    }
    return { status: 200, msg: `onepay: ${String(data)}` };
  }

  // payment_intent.payment_failed
  const reason = String(obj?.last_payment_error?.message ?? obj?.last_payment_error?.code ?? "declined").slice(0, 200);
  const { error } = await rpc("onepay_send_card_failed", { p_send: sendId, p_pi: pi, p_reason: reason });
  if (error) {
    return { status: 500, msg: "onepay: failure stamp failed", alert: { code: "onepay_card_failure_not_recorded", message: `OnePay: a declined card ${pi} on send ${sendId} could not be recorded — Stripe will retry: ${error.message ?? "error"}`, severity: "error", context: { type, sendId, pi, error: error.message ?? null } } };
  }
  return { status: 200, msg: "onepay: failure recorded" };
}
