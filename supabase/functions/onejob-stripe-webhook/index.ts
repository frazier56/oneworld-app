/**
 * onejob-stripe-webhook — disputes, refunds, failed payments, and the PAYOUT leg that makes the last
 * row of the money timeline true.
 *
 * v2 (Jul 26 2026) — REVERSE ON LOSS, NOT ON OPEN:
 *   charge.dispute.created  → flag 'disputed', freeze, log, notify both. NO money movement.
 *   charge.dispute.closed   → won: mark dispute_won. lost: mark dispute_lost AND reverse the transfer.
 *   charge.refunded (full)  → we issued a refund on a released job → reverse the pro's transfer.
 *   transfer.reversed       → sync state if a reversal was initiated elsewhere.
 *
 * v3 (Jul 27 2026) — THE BANK LEG. Step 7 of MoneyTimeline had been a dead informational row since
 * it was written, because NOTHING wrote `paid_out_at`.
 *   payout.created / payout.updated → stamp stripe_payout_id + payout_arrival_date + status.
 *   payout.paid                     → stamp paid_out_at.
 *   payout.failed / payout.canceled → stamp the failure and CLEAR paid_out_at.
 *   account.updated                 → (bug fix) v2 wrote `requirements_due`, a column that does not
 *                                     exist, so every account.updated silently failed to sync.
 *
 * v5 (Jul 27 2026) — SILENT-FAILURE SWEEP, from an adversarial audit. Four ways this could have
 * reported success while doing nothing, all of which end with a pro's timeline frozen and monitoring
 * green:
 *   · the idempotency row was claimed BEFORE processing, so a throw + Stripe retry hit the duplicate
 *     branch and returned 200 without working. The claim is now released in the catch.
 *   · the agreements update discarded its error while the log line still said "1 agreement stamped".
 *     Failures are counted and now return 500 so Stripe retries.
 *   · balanceTransactions.list was capped at 100 with no pagination — Stripe batches a day's balance
 *     into one payout, so job #101 never got stamped. Now paginated.
 *   · `payout.updated` carrying status "failed" fell into the generic branch and left `paid_out_at`
 *     stamped on a bounced payout. Failure is now detected from the STATUS, not the event name.
 *
 * ============================ WHAT CHANGED IN v6 (Jul 28 2026) ============================
 *
 * 1) FAILED PAYMENTS WERE NOT HANDLED ANYWHERE IN THE PRODUCT. Not here, not in a cron, not in the
 *    app. Three event types now land:
 *
 *      payment_intent.payment_failed → payment_status 'failed' + the decline reason, both parties told.
 *      charge.expired                → THE IMPORTANT ONE. See below.
 *      payment_intent.canceled       → the hold is gone; stop claiming it isn't.
 *
 *    `charge.expired` matters more than the other two combined, because OneJob's entire model is an
 *    authorize-now-capture-later hold and a Stripe card authorization dies after about seven days.
 *    When it died uncaptured, NOTHING happened: the contract kept `payment_status = 'authorized'` and
 *    `authorized_at` set, so the money timeline went on telling both parties a hold was in place on a
 *    card that had already released it. A pro could do the work against a hold that no longer
 *    existed, and the first anyone would learn of it is a capture failing days later.
 *
 *    `authorized_at` is deliberately NOT cleared. It happened. The timeline's promise is that every
 *    step carries the moment it actually occurred, so the expiry is recorded as its own later event
 *    (`authorization_expired_at`) rather than by rewriting the earlier one out of history.
 *
 * 2) NOTHING ALERTED ANYONE WHEN THIS FILE'S OWN FAILURE PATHS FIRED. Every one of them
 *    console.error'd and returned, which reaches nobody — and v5's whole point was that a silent
 *    failure here freezes a pro's timeline while monitoring stays green. Failures now also write to
 *    `ops_alerts`, an append-only table that survives Stripe being down, email being down, and the
 *    function itself returning 500.
 *
 * MAPPING A PAYOUT BACK TO A JOB:
 *     payout → balance transactions in that payout → each txn's source charge (py_…)
 *            → charge.source_transfer = tr_… = agreements.stripe_transfer_id
 *
 * v17 (14 Oct 2026, WORLDFEED30 money audit + PUB30, deployed by PUB30) — the v5 sweep, finished.
 * The dispute and refund branches (the two where money moves) now check their contract writes and
 * return 500 + a critical alert if one fails; reverseTransfer checks that it recorded the reversal;
 * refunded_at is stamped only on a FULL refund (a partial one made reverse-contract-payment answer
 * already_refunded forever); a refund no longer erases an earlier dispute status; the lost-dispute
 * message only says "reversed" when it was; the payment_disputes inserts alert on failure.
 *
 * v18 (14 Oct 2026, PUB30, from Max's review of v17) — a reversal whose own record failed is no longer left
 * unrecorded when the dispute/refund stamp then succeeds: both stamps now carry transfer_reversed_at +
 * stripe_reversal_id. reverseTransfer reads the transfer from Stripe first — fully reversed already → record that
 * reversal, move nothing (durable beyond the 24-hour idempotency key); partly reversed → critical alert, no move.
 *
 * v26 (12 Nov 2026, release nov12-orch2) — ONEPAY CARD PAYMENTS. payment_intent.succeeded and
 * payment_intent.payment_failed tagged metadata.purpose = "onepay_send" are settled through the same
 * idempotent database functions onepay-card-pay uses (see ./onepay.ts). Checked FIRST, before the
 * OneJob branches, and only for platform events; every other event is handled exactly as in v25.
 * Requires the onejob-disputes destination (Your account) to send payment_intent.succeeded and
 * payment_intent.payment_failed.
 *
 * SAFETY: the only live money move (transfer reversal) is gated behind DISPUTE_AUTO_REVERSE.
 * Nothing in the payout, failure or OnePay paths moves money at all — they are read-and-stamp only.
 */
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleOnePay, onepaySendId } from "./onepay.ts";

const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function getSecret(key: string, ...envNames: string[]): Promise<string | null> {
  for (const n of envNames) { const v = Deno.env.get(n); if (v) return v; }
  const { data } = await supa.from("app_secrets").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

/**
 * THE ALERT SINK (v6). Never throws — an alert that can take the handler down is worse than no
 * alert. Deliberately the last thing that can fail.
 */
async function alert(code: string, message: string, opts: { severity?: string; agreementId?: string | null; context?: unknown } = {}) {
  try {
    await supa.from("ops_alerts").insert({
      source: "onejob-stripe-webhook",
      code,
      severity: opts.severity ?? "error",
      message,
      agreement_id: opts.agreementId ?? null,
      context: opts.context ?? null,
    });
  } catch (e) {
    console.error("[onejob-webhook] ALERT SINK ITSELF FAILED", code, e);
  }
}

/**
 * TWO DESTINATIONS, TWO SECRETS, ONE FUNCTION.
 *
 * Stripe will not let a single event destination carry both "Your account" and "Connected accounts"
 * scopes — the scope is fixed at creation and greyed out on edit. Disputes and refunds are platform
 * events; payouts and account.updated for a pro are CONNECTED-ACCOUNT events. So OneJob has two
 * destinations pointing at this same URL, and Stripe issues each one its own signing secret:
 *
 *   onejob-disputes         (we_1Txe9wGwkV5KyRSvaAmlm983, Your account)       → onejob_stripe_webhook_secret
 *   onejob-connect-payouts  (we_1TxmV9GwkV5KyRSvf0Ts5Kmb, Connected accounts) → onejob_stripe_connect_webhook_secret
 *
 * Verifying against only one of them would silently 400 every event from the other, which is exactly
 * the kind of failure that looks like "the pro was never paid" on the pro's own screen.
 */
async function signingSecrets(): Promise<string[]> {
  const out = new Set<string>();
  for (const [key, ...envs] of [
    ["onejob_stripe_webhook_secret", "ONEJOB_STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET"],
    ["onejob_stripe_connect_webhook_secret", "ONEJOB_STRIPE_CONNECT_WEBHOOK_SECRET"],
  ] as string[][]) {
    const v = await getSecret(key, ...envs);
    if (v) out.add(v);
  }
  return [...out];
}

async function verifySignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  if (!sigHeader) return false;
  const t = sigHeader.split(",").filter((p) => p.startsWith("t=")).map((p) => p.slice(2))[0];
  const v1 = sigHeader.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || v1.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1.some((sig) => {
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

const ok = (msg: string) =>
  new Response(JSON.stringify({ received: true, msg }), { headers: { "Content-Type": "application/json" } });

async function notify(userId: string | null | undefined, type: string, title: string, body: string, url = "/app/my-jobs") {
  if (!userId) return;
  try { await supa.from("notifications").insert({ user_id: userId, type, title, body, action_url: url }); } catch (_) { /* non-fatal */ }
}

const AG_SELECT = "id, payer_id, payee_id, sender_id, recipient_id, stripe_transfer_id, transfer_reversed_at, title, dispute_status, status, payment_status, authorized_at, captured_at, released_at, accepted_at, refunded_at";

async function findAgreement(chargeId: string | null, piId: string | null) {
  if (chargeId) {
    const { data } = await supa.from("agreements").select(AG_SELECT).eq("stripe_charge_id", chargeId).maybeSingle();
    if (data) return data;
  }
  if (piId) {
    const { data } = await supa.from("agreements").select(AG_SELECT).eq("stripe_payment_intent_id", piId).maybeSingle();
    if (data) return data;
  }
  return null;
}

/** Unix seconds → ISO, or null. Stripe hands out seconds; Postgres wants a timestamp. */
const iso = (unixSeconds?: number | null) =>
  typeof unixSeconds === "number" && unixSeconds > 0 ? new Date(unixSeconds * 1000).toISOString() : null;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const payload = await req.text();
  const secrets = await signingSecrets();
  if (!secrets.length) {
    console.error("[onejob-webhook] no signing secret configured");
    await alert("no_signing_secret", "No Stripe signing secret is configured, so EVERY webhook event is being rejected. Disputes, refunds, payouts and failed payments are all going unrecorded.", { severity: "critical" });
    return new Response("config error", { status: 500 });
  }
  const sigHeader = req.headers.get("stripe-signature") ?? "";
  let signatureOk = false;
  for (const s of secrets) {
    if (await verifySignature(payload, sigHeader, s)) { signatureOk = true; break; }
  }
  if (!signatureOk) return new Response("invalid signature", { status: 400 });

  const event = JSON.parse(payload);
  const type: string = event.type;
  const obj = event.data?.object ?? {};
  /** Present only on CONNECT events — the connected account the event happened on. */
  const connectedAccountId: string | null = event.account ?? null;

  /**
   * IDEMPOTENCY THAT DOESN'T EAT ITS OWN RETRIES.
   *
   * The row is claimed BEFORE processing. If processing then throws — a Stripe API blip, a DB
   * hiccup — we return 500, Stripe retries, and the retry used to hit the duplicate branch and
   * return 200 without doing any work. `paid_out_at` would never be written for that payout, and
   * step 7 of the pro's timeline would sit dead forever with no alert anywhere. So the claim is
   * RELEASED in the catch block, letting Stripe's retry actually retry.
   */
  const { error: dupeErr } = await supa.from("stripe_webhook_events").insert({ event_id: event.id, event_type: type });
  if (dupeErr) {
    if ((dupeErr as { code?: string }).code === "23505") return ok("duplicate event ignored");
    console.error("[onejob-webhook] idempotency insert failed", dupeErr);
  }
  const releaseIdempotencyClaim = async () => {
    try { await supa.from("stripe_webhook_events").delete().eq("event_id", event.id); }
    catch (e) { console.error("[onejob-webhook] could not release idempotency claim", e); }
  };

  const autoFlag = await getSecret("dispute_auto_reverse", "DISPUTE_AUTO_REVERSE");
  const AUTO_REVERSE = (autoFlag || "").trim().toLowerCase() === "true";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;

  async function reverseTransfer(ag: { id: string; stripe_transfer_id: string | null; transfer_reversed_at: string | null }, reason: string) {
    if (!ag.stripe_transfer_id) return { done: false, note: "no transfer to reverse" };
    if (ag.transfer_reversed_at) return { done: false, note: "already reversed" };
    if (!AUTO_REVERSE) return { done: false, note: "would reverse (DISPUTE_AUTO_REVERSE off)" };
    if (!stripe) return { done: false, note: "no stripe key" };
    /* v18 (Max, 14 Oct): reconcile from STRIPE before reversing, not from the idempotency key alone (it lapses
       after 24 hours). If the transfer is already fully reversed, that reversal is the answer: record it, move
       nothing. A partly reversed transfer is not guessed at — it is alerted and left for a person. */
    const tr = await stripe.transfers.retrieve(ag.stripe_transfer_id, { expand: ["reversals"] });
    const reversedSoFar = Number((tr as { amount_reversed?: number }).amount_reversed ?? 0);
    let rev: { id: string };
    if (reversedSoFar >= Number(tr.amount) && Number(tr.amount) > 0) {
      const existing = ((tr as { reversals?: { data?: { id: string }[] } }).reversals?.data ?? [])[0];
      if (!existing) {
        await alert("reversal_state_unclear", `Transfer ${tr.id} on contract ${ag.id} is fully reversed in Stripe but no reversal object was returned.`, { severity: "critical", agreementId: ag.id, context: { transferId: tr.id } });
        return { done: false, note: "already reversed in Stripe; reversal id unknown" };
      }
      rev = existing;
    } else if (reversedSoFar > 0) {
      await alert("reversal_partial_unexpected", `Transfer ${tr.id} on contract ${ag.id} is PARTLY reversed (${reversedSoFar} of ${tr.amount}). Not reversing the rest automatically.`, { severity: "critical", agreementId: ag.id, context: { transferId: tr.id, reversedSoFar, amount: tr.amount } });
      return { done: false, note: "partly reversed already; held for review" };
    } else {
      rev = await stripe.transfers.createReversal(
        ag.stripe_transfer_id,
        { refund_application_fee: false, metadata: { onejob_agreement_id: ag.id, reason } },
        { idempotencyKey: `onejob_reversal_${ag.id}` },
      );
    }
    const { error: revErr } = await supa.from("agreements").update({
      transfer_reversed_at: new Date().toISOString(), stripe_reversal_id: rev.id, updated_at: new Date().toISOString(),
    }).eq("id", ag.id);
    if (revErr) {
      console.error(`[onejob-webhook] REVERSAL ${rev.id} MOVED MONEY on ${ag.id} BUT WAS NOT RECORDED`, revErr.message);
      await alert("reversal_not_recorded",
        `Reversal ${rev.id} pulled the pro's share back on contract ${ag.id} BUT WAS NOT RECORDED: ${revErr.message}. Nothing in the product knows the money moved.`,
        { severity: "critical", agreementId: ag.id, context: { reversalId: rev.id, revErr } });
      return { done: true, reversalId: rev.id, recordFailed: true };
    }
    return { done: true, reversalId: rev.id };
  }

  /**
   * Which OneJob jobs are inside this Stripe payout?
   *
   * A payout object knows nothing about us. The only honest link is the balance transactions it swept
   * up: each one's source is a charge on the connected account, and that charge's `source_transfer` is
   * the platform transfer id we already store on the agreement.
   */
  async function transferIdsInPayout(payoutId: string, acct: string): Promise<string[]> {
    if (!stripe) return [];
    const ids = new Set<string>();
    try {
      // PAGINATE. Stripe batches a whole day's balance into one payout, so a busy pro's payout can
      // hold far more than 100 balance transactions — and job #101 would never get `paid_out_at`,
      // leaving its timeline dead forever.
      const all: unknown[] = [];
      for await (const t of stripe.balanceTransactions.list(
        { payout: payoutId, limit: 100, expand: ["data.source"] },
        { stripeAccount: acct },
      )) {
        all.push(t);
      }
      for (const bt of all) {
        const t = bt as { source?: unknown };
        const src = t.source as unknown;
        if (typeof src === "string") {
          if (src.startsWith("tr_")) ids.add(src);
          continue;
        }
        const s = src as { id?: string; object?: string; source_transfer?: string | { id?: string } } | null;
        if (!s) continue;
        // A charge created on the connected account by our transfer carries `source_transfer`.
        const st = s.source_transfer;
        if (typeof st === "string" && st.startsWith("tr_")) ids.add(st);
        else if (st && typeof st === "object" && st.id) ids.add(st.id);
        else if (s.object === "transfer" && s.id) ids.add(s.id);
      }
    } catch (e) {
      console.error(`[onejob-webhook] balance-transaction lookup failed for payout ${payoutId} on ${acct}`, e);
      await alert("payout_lookup_failed", `Could not read the balance transactions for payout ${payoutId} on ${acct}, so no job could be matched to it. Every job in that payout still shows as not-yet-in-the-bank.`, { context: { payoutId, acct, error: String(e) } });
    }
    return [...ids];
  }

  try {
    /* ------------------------------------------------------------------ *
     * v26 — ONEPAY CARD PAYMENTS (platform PaymentIntents tagged onepay_send).
     * Read-and-stamp only, through the same idempotent DB functions onepay-card-pay uses.
     * ------------------------------------------------------------------ */
    const onepaySend = onepaySendId(type, obj, connectedAccountId);
    if (onepaySend) {
      const res = await handleOnePay(type, obj, onepaySend, async (fn, args) => {
        const { data, error } = await supa.rpc(fn, args);
        return { data, error: error ? { message: error.message } : null };
      });
      if (res.alert) await alert(res.alert.code, res.alert.message, { severity: res.alert.severity, context: res.alert.context });
      console.log(`[onejob-webhook] ${type} onepay send=${onepaySend} pi=${obj.id} -> ${res.status} ${res.msg}`);
      if (res.status === 500) {
        await releaseIdempotencyClaim();
        return new Response(res.msg, { status: 500 });
      }
      return ok(res.msg);
    }

    /* ------------------------------------------------------------------ *
     * v6 — FAILED PAYMENTS AND DEAD AUTHORIZATIONS.
     * Read-and-stamp only. Nothing here moves money.
     * ------------------------------------------------------------------ */
    if (type === "payment_intent.payment_failed" || type === "payment_intent.canceled" || type === "charge.expired") {
      const piId = type === "charge.expired"
        ? ((obj.payment_intent as string) ?? null)
        : ((obj.id as string) ?? null);
      const chargeId = type === "charge.expired" ? ((obj.id as string) ?? null) : ((obj.latest_charge as string) ?? null);
      const ag = await findAgreement(chargeId, piId);

      if (!ag) {
        console.log(`[onejob-webhook] ${type} pi=${piId} — no matching agreement`);
        return ok(`${type}: no matching agreement`);
      }

      // Money that already moved on is not undone by a late failure event. A captured, released or
      // refunded contract is past this point; rewriting it here would be the timeline telling a lie
      // in the other direction.
      if (ag.captured_at || ag.released_at || ag.refunded_at) {
        console.log(`[onejob-webhook] ${type} on ${ag.id} ignored — already captured/released/refunded`);
        return ok(`${type}: agreement already past authorization`);
      }

      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = { updated_at: nowIso };
      let title = "";
      let payerBody = "";
      let payeeBody = "";
      let alertCode = "";

      if (type === "payment_intent.payment_failed") {
        const err = (obj.last_payment_error ?? {}) as { code?: string; decline_code?: string; message?: string };
        patch.payment_status = "failed";
        patch.payment_failed_at = nowIso;
        patch.payment_failure_code = err.decline_code ?? err.code ?? null;
        patch.payment_failure_message = err.message ?? null;
        alertCode = "payment_failed";
        title = "That payment didn't go through";
        payerBody = `The card on "${ag.title ?? "your contract"}" was declined${err.message ? ` — ${err.message}` : ""}. Nothing was charged. Add or pick another card in My Wallet and try again.`;
        payeeBody = `The client's card on "${ag.title ?? "your contract"}" was declined, so there's no payment held for this job yet. They've been asked to try another card — hold off on starting until it clears.`;
      } else {
        // charge.expired, and payment_intent.canceled where the cancellation was automatic, are the
        // SAME real-world event: the ~7-day card authorization died without being captured.
        //
        // authorized_at is left exactly where it is. It happened. Clearing it would rewrite the
        // first rung of the money timeline out of history, and the timeline's one promise is that
        // every step carries the moment it actually occurred.
        const reason = (obj.cancellation_reason as string) ?? null;
        patch.payment_status = "auth_expired";
        patch.authorization_expired_at = nowIso;
        patch.payment_failure_code = reason ?? (type === "charge.expired" ? "authorization_expired" : "canceled");
        patch.payment_failure_message = type === "charge.expired"
          ? "The card authorization expired before the job was accepted."
          : `The payment was canceled (${reason ?? "no reason given"}).`;
        alertCode = type === "charge.expired" ? "authorization_expired" : "payment_canceled";
        title = "The hold on this job has expired";
        payerBody = `The card hold for "${ag.title ?? "your contract"}" expired before the job got going, so your card has released it and you were never charged. If the job is still on, set the payment up again from My Jobs.`;
        payeeBody = `The card hold for "${ag.title ?? "your contract"}" expired, so there is no money held for this job any more. Don't start work until the client sets the payment up again.`;
      }

      const { error: upErr } = await supa.from("agreements").update(patch).eq("id", ag.id);
      if (upErr) {
        console.error(`[onejob-webhook] FAILED to stamp ${type} on ${ag.id}`, upErr);
        await alert("failure_stamp_failed", `Stripe reported ${type} on contract "${ag.title ?? ag.id}" but the contract could not be updated, so both parties are still being shown a hold that no longer exists.`, { severity: "critical", agreementId: ag.id, context: { type, upErr } });
        await releaseIdempotencyClaim();
        return new Response("agreement stamp failed", { status: 500 });
      }

      const payerId = ag.payer_id ?? ag.sender_id;
      const payeeId = ag.payee_id ?? ag.recipient_id;
      await notify(payerId, alertCode, title, payerBody);
      // The pro is only told if they were ever in a position to start — telling someone a hold
      // expired on a contract they never accepted is noise.
      if (payeeId && payeeId !== payerId && ag.accepted_at) {
        await notify(payeeId, alertCode, title, payeeBody);
      }

      // An expired hold on an ACCEPTED job is the shape that costs a pro real work, so it is worth
      // a human looking at it — not just a notification the pro may not read for a day.
      await alert(alertCode, `${type} on contract "${ag.title ?? ag.id}"${ag.accepted_at ? " (already accepted — the pro may be working against a hold that no longer exists)" : ""}.`, {
        severity: ag.accepted_at ? "critical" : "warn",
        agreementId: ag.id,
        context: { type, piId, chargeId, failure: patch.payment_failure_message },
      });

      console.log(`[onejob-webhook] ${type} agreement=${ag.id} status=${patch.payment_status} accepted=${!!ag.accepted_at}`);
      return ok(`${type} handled on ${ag.id}`);
    }

    /* ------------------------------------------------------------------ *
     * PAYOUTS — the bank leg. Read-and-stamp only; nothing here moves money.
     * ------------------------------------------------------------------ */
    if (type.startsWith("payout.")) {
      const payoutId = (obj.id as string) ?? null;
      const status = (obj.status as string) ?? null;
      const arrival = iso(obj.arrival_date as number | undefined);
      const nowIso = new Date().toISOString();

      // No `event.account` = this is OneJob's OWN payout to OneJob's bank, not a pro's. Record it and
      // stop — stamping a pro's timeline off the platform's own bank run would be pure fiction.
      if (!connectedAccountId) {
        await supa.from("payout_events").insert({
          stripe_payout_id: payoutId, stripe_account_id: null, event_type: type, status,
          amount: obj.amount ?? null, currency: obj.currency ?? null, arrival_date: arrival,
          failure_code: obj.failure_code ?? null, failure_message: obj.failure_message ?? null,
          matched_agreements: [], matched_count: 0, raw: obj,
        });
        return ok("platform payout — recorded, no agreement touched");
      }

      const transferIds = payoutId ? await transferIdsInPayout(payoutId, connectedAccountId) : [];
      let matched: { id: string; payee_id: string | null; recipient_id: string | null; title: string | null }[] = [];
      if (transferIds.length) {
        const { data } = await supa.from("agreements")
          .select("id, payee_id, recipient_id, title")
          .in("stripe_transfer_id", transferIds);
        matched = data ?? [];
      }

      const patch: Record<string, unknown> = {
        stripe_payout_id: payoutId,
        payout_status: status,
        payout_arrival_date: arrival,
        updated_at: nowIso,
      };

      // Stripe also emits `payout.updated` carrying status "failed"/"canceled". Branching on the
      // event NAME alone left `paid_out_at` stamped on a payout that had demonstrably bounced —
      // "In your bank" rendered directly above "Stripe couldn't pay this into your bank".
      const failedNow = type === "payout.failed" || type === "payout.canceled"
        || status === "failed" || status === "canceled";

      if (type === "payout.paid" && !failedNow) {
        patch.paid_out_at = nowIso;
        patch.payout_failure_message = null;
        patch.payout_failed_at = null;
      } else if (failedNow) {
        // The money came BACK out of the bank leg. Anything still claiming "in the bank" is now a lie.
        patch.paid_out_at = null;
        patch.payout_failed_at = nowIso;
        patch.payout_failure_message = (obj.failure_message as string) ?? (obj.failure_code as string) ?? null;
      }

      // A DISCARDED ERROR HERE IS THE WHOLE BUG CLASS THIS FILE EXISTS TO PREVENT. If the update
      // silently fails, the log says "1 agreement stamped", monitoring is green, and the pro's
      // timeline never changes. Count the failures and make Stripe retry.
      let updateFailures = 0;
      for (const ag of matched) {
        const { error: upErr } = await supa.from("agreements").update(patch).eq("id", ag.id);
        if (upErr) {
          updateFailures++;
          console.error(`[onejob-webhook] FAILED to stamp agreement ${ag.id} from ${type}`, upErr);
          continue;
        }
        if (type === "payout.paid" && !failedNow) {
          await notify(ag.payee_id ?? ag.recipient_id, "payout_paid", "Your money is on its way to your bank",
            `Stripe sent the payment for "${ag.title ?? "your job"}" to your bank account.`, "/app/wallet");
        } else if (failedNow) {
          await notify(ag.payee_id ?? ag.recipient_id, "payout_failed", "Your bank payout didn't go through",
            `Stripe couldn't pay "${ag.title ?? "your job"}" into your bank. Check your bank details in your Stripe account — the money is still yours and still in your Stripe balance.`, "/app/wallet");
        }
      }

      if (failedNow && matched.length) {
        await alert("payout_failed", `A Stripe payout to a pro's bank failed (${status}) and ${matched.length} job(s) were rolled back out of "in your bank".`, { agreementId: matched[0].id, context: { payoutId, acct: connectedAccountId, status, failure: obj.failure_message ?? obj.failure_code, agreements: matched.map((m) => m.id) } });
      }

      const { error: evErr } = await supa.from("payout_events").insert({
        stripe_payout_id: payoutId, stripe_account_id: connectedAccountId, event_type: type, status,
        amount: obj.amount ?? null, currency: obj.currency ?? null, arrival_date: arrival,
        failure_code: obj.failure_code ?? null, failure_message: obj.failure_message ?? null,
        matched_agreements: matched.map((m) => m.id), matched_count: matched.length, raw: obj,
      });
      // The header of this file promises unmatched payouts are recorded and never swallowed. That
      // promise is only true if the recording itself is checked.
      if (evErr) {
        console.error("[onejob-webhook] payout_events insert FAILED", evErr);
        await alert("payout_event_log_failed", `Could not record payout ${payoutId} in payout_events, so the audit trail for that bank run is missing.`, { severity: "warn", context: { payoutId, acct: connectedAccountId, evErr } });
      }

      console.log(`[onejob-webhook] ${type} payout=${payoutId} acct=${connectedAccountId} status=${status} transfers=${JSON.stringify(transferIds)} matched=${matched.length} updateFailures=${updateFailures}`);
      if (updateFailures > 0) {
        await alert("payout_stamp_failed", `${updateFailures} of ${matched.length} job(s) in payout ${payoutId} could not be stamped. Their timelines are frozen at the previous step.`, { severity: "critical", context: { payoutId, acct: connectedAccountId, type, updateFailures } });
        await releaseIdempotencyClaim();
        return new Response("agreement stamp failed", { status: 500 });
      }
      return ok(`${type} handled; ${matched.length} agreement(s) stamped`);
    }

    if (type === "charge.dispute.created" || type === "charge.dispute.closed") {
      const chargeId = (obj.charge as string) ?? null;
      const piId = (obj.payment_intent as string) ?? null;
      const ag = await findAgreement(chargeId, piId);
      const created = type === "charge.dispute.created";
      const lost = !created && obj.status === "lost";
      const won = !created && obj.status === "won";

      let reversal: { done: boolean; note?: string; reversalId?: string } = { done: false };
      if (ag) {
        if (lost) reversal = await reverseTransfer(ag, "dispute_lost");
        const { error: dispErr } = await supa.from("agreements").update({
          dispute_status: created ? "disputed" : (won ? "dispute_won" : lost ? "dispute_lost" : "disputed"),
          stripe_dispute_id: obj.id ?? null,
          stripe_charge_id: chargeId,
          disputed_at: created ? new Date().toISOString() : undefined,
          dispute_resolved_at: created ? undefined : new Date().toISOString(),
          // v18: carry the reversal on the same write, so a failed reversal-record inside reverseTransfer is
          // repaired here; if THIS write fails the event is retried (500 + claim released).
          ...(reversal.done && reversal.reversalId ? { transfer_reversed_at: new Date().toISOString(), stripe_reversal_id: reversal.reversalId } : {}),
          updated_at: new Date().toISOString(),
        }).eq("id", ag.id);
        if (dispErr) {
          console.error(`[onejob-webhook] FAILED to stamp ${type} on ${ag.id}`, dispErr);
          await alert("dispute_stamp_failed",
            `Stripe reported ${type} on contract "${ag.title ?? ag.id}" but the contract could not be updated${reversal.done ? ` — AND THE PRO'S TRANSFER WAS ALREADY REVERSED (${reversal.reversalId})` : ""}. The contract does not show the dispute.`,
            { severity: "critical", agreementId: ag.id, context: { type, reversal, dispErr } });
          await releaseIdempotencyClaim();
          return new Response("agreement stamp failed", { status: 500 });
        }

        if (created) {
          await notify(ag.payer_id, "dispute_opened", "A payment dispute was opened",
            `A dispute was filed on "${ag.title ?? "your contract"}". We're reviewing it.`);
          await notify(ag.payee_id ?? ag.recipient_id, "dispute_opened", "A payment on your job is disputed",
            `The client's bank opened a dispute on "${ag.title ?? "your contract"}". If you completed the job, add proof so we can fight it — if the dispute is lost, the payout is reversed.`);
        } else if (lost) {
          await notify(ag.payee_id ?? ag.recipient_id, "dispute_lost", "A dispute was lost",
            reversal.done
              ? `The dispute on "${ag.title ?? "your contract"}" was lost, so that payout has been reversed.`
              : `The dispute on "${ag.title ?? "your contract"}" was lost. We'll be in touch about the payout.`);
        } else if (won) {
          await notify(ag.payee_id ?? ag.recipient_id, "dispute_won", "Dispute resolved in your favor ✓",
            `The dispute on "${ag.title ?? "your contract"}" was won — your payout stands.`);
        }
      }

      // A chargeback is money OneJob pays for in full, whether or not we can match it to a job.
      // An UNMATCHED one is worse, not better — it means we cannot even tell which job it came from.
      await alert(created ? "dispute_opened" : (lost ? "dispute_lost" : "dispute_closed"),
        `${type} — ${obj.amount ?? "?"} ${String(obj.currency ?? "").toUpperCase()}, reason "${obj.reason ?? "unknown"}"${ag ? ` on contract "${ag.title ?? ag.id}"` : " — NO MATCHING CONTRACT, we cannot tell which job this is"}.`,
        { severity: ag ? (lost ? "critical" : "warn") : "critical", agreementId: ag?.id ?? null, context: { disputeId: obj.id, chargeId, piId, status: obj.status, reversal } });

      const { error: pdErr } = await supa.from("payment_disputes").insert({
        agreement_id: ag?.id ?? null, stripe_dispute_id: obj.id ?? null, stripe_charge_id: chargeId,
        stripe_payment_intent_id: piId, amount: obj.amount ?? null, currency: obj.currency ?? null,
        reason: obj.reason ?? null, status: obj.status ?? null, event_type: type,
        transfer_reversed: reversal.done, stripe_reversal_id: reversal.reversalId ?? null,
        auto_reverse_enabled: AUTO_REVERSE, raw: obj,
      });
      if (pdErr) await alert("dispute_log_failed", `Could not record ${type} ${obj.id ?? ""} in payment_disputes, so the chargeback audit trail is missing this event.`, { severity: "warn", agreementId: ag?.id ?? null, context: { type, pdErr } });
      console.log(`[onejob-webhook] ${type} dispute=${obj.id} status=${obj.status} agreement=${ag?.id ?? "UNMATCHED"} reversal=${JSON.stringify(reversal)}`);
      return ok(`${type} handled; reversal: ${reversal.note ?? (reversal.done ? "done" : "n/a")}`);
    }

    if (type === "charge.refunded") {
      const chargeId = (obj.id as string) ?? null;
      const piId = (obj.payment_intent as string) ?? null;
      const ag = await findAgreement(chargeId, piId);
      const fullyRefunded = obj.amount_refunded && obj.amount && obj.amount_refunded >= obj.amount;
      let reversal: { done: boolean; note?: string; reversalId?: string } = { done: false };
      if (ag) {
        if (fullyRefunded) reversal = await reverseTransfer(ag, "full_refund");
        /* refunded_at is the moment the payment came BACK IN FULL. Stamping it on a partial refund
           made the timeline read as refunded and, worse, made reverse-contract-payment answer
           "already_refunded" — a partly refunded contract could never be unwound. A partial refund
           is recorded in payment_disputes below and nowhere else. */
        const { error: refErr } = await supa.from("agreements").update({
          payment_status: fullyRefunded ? "refunded" : undefined,
          dispute_status: fullyRefunded && !ag.dispute_status ? "refunded" : undefined,
          refunded_at: fullyRefunded ? new Date().toISOString() : undefined,
          // v18: as in the dispute branch — the reversal is recorded on this write too.
          ...(reversal.done && reversal.reversalId ? { transfer_reversed_at: new Date().toISOString(), stripe_reversal_id: reversal.reversalId } : {}),
          stripe_charge_id: chargeId, updated_at: new Date().toISOString(),
        }).eq("id", ag.id);
        if (refErr) {
          console.error(`[onejob-webhook] FAILED to stamp charge.refunded on ${ag.id}`, refErr);
          await alert("refund_stamp_failed",
            `Stripe reported charge.refunded on contract "${ag.title ?? ag.id}" but the contract could not be updated${reversal.done ? ` — AND THE PRO'S TRANSFER WAS ALREADY REVERSED (${reversal.reversalId})` : ""}. The contract still reads as paid.`,
            { severity: "critical", agreementId: ag.id, context: { fullyRefunded, reversal, refErr } });
          await releaseIdempotencyClaim();
          return new Response("agreement stamp failed", { status: 500 });
        }
      }
      const { error: pdErr } = await supa.from("payment_disputes").insert({
        agreement_id: ag?.id ?? null, stripe_charge_id: chargeId, stripe_payment_intent_id: piId,
        amount: obj.amount_refunded ?? null, currency: obj.currency ?? null, reason: "refund",
        status: fullyRefunded ? "refunded" : "partial_refund", event_type: type,
        transfer_reversed: reversal.done, stripe_reversal_id: reversal.reversalId ?? null,
        auto_reverse_enabled: AUTO_REVERSE, raw: obj,
      });
      if (pdErr) await alert("refund_log_failed", `Could not record charge.refunded ${chargeId ?? ""} in payment_disputes, so the refund audit trail is missing this event.`, { severity: "warn", agreementId: ag?.id ?? null, context: { pdErr } });
      console.log(`[onejob-webhook] charge.refunded charge=${chargeId} agreement=${ag?.id ?? "UNMATCHED"} full=${fullyRefunded} reversal=${JSON.stringify(reversal)}`);
      return ok(`charge.refunded handled; reversal: ${reversal.note ?? (reversal.done ? "done" : "n/a")}`);
    }

    if (type === "transfer.reversed") {
      const transferId = (obj.id as string) ?? null;
      if (transferId) {
        await supa.from("agreements").update({
          transfer_reversed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("stripe_transfer_id", transferId).is("transfer_reversed_at", null);
      }
      return ok("transfer.reversed synced");
    }

    if (type === "account.updated") {
      const acct = obj;
      const reqs: string[] = acct.requirements?.currently_due ?? [];
      const sched = acct.settings?.payouts?.schedule ?? {};
      // The external account the money actually lands in. A pro's may be a BANK ACCOUNT even when they
      // believe they entered a card — so the timeline must read this off Stripe rather than off what
      // the pro thinks they did.
      const ext = (acct.external_accounts?.data ?? []).find((e: { object?: string }) => e.object === "bank_account")
        ?? (acct.external_accounts?.data ?? [])[0];
      const { data, error } = await supa.from("stripe_connect_accounts").update({
        payouts_enabled: !!acct.payouts_enabled,
        charges_enabled: !!acct.charges_enabled,
        details_submitted: !!acct.details_submitted,
        requirements_currently_due: reqs,
        country: acct.country ?? undefined,
        default_currency: acct.default_currency ?? undefined,
        payout_interval: sched.interval ?? null,
        payout_delay_days: typeof sched.delay_days === "number" ? sched.delay_days : null,
        payout_weekly_anchor: sched.weekly_anchor ?? null,
        payout_monthly_anchor: typeof sched.monthly_anchor === "number" ? sched.monthly_anchor : null,
        bank_name: ext?.bank_name ?? null,
        bank_last4: ext?.last4 ?? null,
        payout_schedule_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("stripe_account_id", acct.id).select("id");
      if (error) {
        console.error("[onejob-webhook] account.updated sync failed", error);
        await alert("account_sync_failed", `Could not sync Stripe Connect account ${acct.id}. Payout capability and bank details on that pro's screen are now stale.`, { context: { acct: acct.id, error } });
      }
      // `.eq()` matching zero rows is NOT an error in PostgREST, so a connected account we have no
      // row for would report success while syncing nothing. Say which it was.
      const rows = (data as unknown[] | null)?.length ?? 0;
      if (!error && rows === 0) console.warn(`[onejob-webhook] account.updated matched no local row for ${acct.id}`);
      return ok(error ? "account.updated sync FAILED" : rows === 0 ? "account.updated: no local row" : "account.updated synced");
    }

    return ok("ignored: unhandled event type");
  } catch (e) {
    console.error("[onejob-webhook] processing error", e);
    await alert("handler_threw", `The webhook handler threw while processing ${type}. Stripe will retry, but if this repeats the event is being lost.`, { severity: "critical", context: { type, eventId: event.id, error: String(e) } });
    await releaseIdempotencyClaim();
    return new Response("processing error", { status: 500 });
  }
});
