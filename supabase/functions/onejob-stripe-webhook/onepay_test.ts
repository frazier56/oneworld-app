// Proof for v26's OnePay block: routing, settlement calls, retries on failure, non-OnePay events untouched.
import { handleOnePay, onepaySendId, type Rpc } from "./onepay.ts";
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };
const SEND = "0b6d1d1e-3a3f-4c55-9f1a-2c8b8f0a1e11";
const pi = (o: Record<string, unknown> = {}) => ({ id: "pi_3Abc", amount: 5000000, amount_received: 5000000, currency: "cop", metadata: { purpose: "onepay_send", onepay_send_id: SEND, onepay_payer_id: "x" }, ...o });
const spy = (res: { data?: unknown; error?: { message: string } | null } = { data: "paid", error: null }) => {
  const calls: [string, Record<string, unknown>][] = [];
  const rpc: Rpc = async (fn, args) => { calls.push([fn, args]); return { data: res.data ?? null, error: res.error ?? null }; };
  return { rpc, calls };
};
Deno.test("routing: only platform payment_intent.succeeded/payment_failed tagged onepay_send", () => {
  eq(onepaySendId("payment_intent.succeeded", pi(), null), SEND, "succeeded routed");
  eq(onepaySendId("payment_intent.payment_failed", pi(), null), SEND, "failed routed");
  eq(onepaySendId("payment_intent.succeeded", pi(), "acct_1"), null, "connect event ignored");
  eq(onepaySendId("payment_intent.canceled", pi(), null), null, "canceled not OnePay's");
  eq(onepaySendId("payment_intent.succeeded", pi({ metadata: { purpose: "onejob" } }), null), null, "OneJob PI falls through");
  eq(onepaySendId("payment_intent.payment_failed", pi({ metadata: {} }), null), null, "untagged PI falls through to v6 agreements branch");
  eq(onepaySendId("payment_intent.succeeded", pi({ metadata: { purpose: "onepay_send", onepay_send_id: "1; drop" } }), null), null, "bad send id refused");
});
Deno.test("succeeded -> onepay_send_card_paid with amount_received and pi", async () => {
  const s = spy();
  const r = await handleOnePay("payment_intent.succeeded", pi({ amount_received: 4999900 }), SEND, s.rpc);
  eq(s.calls, [["onepay_send_card_paid", { p_send: SEND, p_amount_minor: 4999900, p_pi: "pi_3Abc" }]], "call");
  eq([r.status, r.msg, r.alert], [200, "onepay: paid", undefined], "outcome");
});
Deno.test("succeeded but DB write fails -> 500 (Stripe retries) + critical alert", async () => {
  const r = await handleOnePay("payment_intent.succeeded", pi(), SEND, spy({ error: { message: "boom" } }).rpc);
  eq([r.status, r.alert?.code, r.alert?.severity], [500, "onepay_card_not_recorded", "critical"], "retry");
});
Deno.test("already recorded by onepay-card-pay -> 200, settles once (DB fn is idempotent)", async () => {
  const r = await handleOnePay("payment_intent.succeeded", pi(), SEND, spy({ data: "already_recorded" }).rpc);
  eq([r.status, r.msg], [200, "onepay: already_recorded"], "idempotent");
});
Deno.test("non-peso success is not recorded, critical alert, no retry loop", async () => {
  const s = spy();
  const r = await handleOnePay("payment_intent.succeeded", pi({ currency: "usd" }), SEND, s.rpc);
  eq([s.calls.length, r.status, r.alert?.severity], [0, 200, "critical"], "usd");
});
Deno.test("payment_failed -> onepay_send_card_failed with the decline message; failure to stamp -> 500", async () => {
  const s = spy({ data: null });
  const r = await handleOnePay("payment_intent.payment_failed", pi({ last_payment_error: { message: "Your card was declined." } }), SEND, s.rpc);
  eq(s.calls, [["onepay_send_card_failed", { p_send: SEND, p_pi: "pi_3Abc", p_reason: "Your card was declined." }]], "call");
  eq(r.status, 200, "ok");
  eq((await handleOnePay("payment_intent.payment_failed", pi(), SEND, spy({ error: { message: "x" } }).rpc)).status, 500, "retry");
});
