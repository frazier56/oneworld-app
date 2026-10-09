import { supabase } from "./supabase";

export interface Agreement {
  id: string; title: string | null; description: string | null; status: string | null;
  payment_amount: number | null; start_date: string | null; end_date: string | null;
  sender_id: string; recipient_id: string; conversation_id: string | null; payment_status: string | null;
  // Optional enrichment (My Jobs rich cards) — additive, safe for sibling views.
  currency?: string | null; location?: string | null; start_time?: string | null; end_time?: string | null;
  is_recurring?: boolean | null; created_at?: string | null; updated_at?: string | null;
  // Explicit money roles — ALWAYS prefer these over sender/recipient. See rolesOf().
  payer_id?: string | null; payee_id?: string | null; payment_rail?: string | null;
  /** The fee actually collected for this agreement. Receipts must never recompute it later. */
  platform_fee?: number | null;
  /** Accept window (#34): how long the other side has, and the hard deadline the sweeper enforces. */
  accept_window_hours?: number | null; accept_deadline?: string | null;
  /**
   * MONEY TIMELINE STAMPS (#39). Each one is written by the step that actually performed the action —
   * never inferred from a status string, because a status can be corrected while a timestamp is
   * evidence of what happened and when.
   */
  sent_at?: string | null;
  authorized_at?: string | null; accepted_at?: string | null; captured_at?: string | null;
  payee_done_at?: string | null; payer_done_at?: string | null;
  released_at?: string | null; paid_out_at?: string | null; expired_at?: string | null;
  /** Bank leg, written by the payout.* handlers in onejob-stripe-webhook v3 (Jul 27 2026).
   *  Before these existed, step 7 of the money timeline could never turn green. */
  payout_arrival_date?: string | null; payout_status?: string | null;
  payout_failure_message?: string | null;
}
export interface Execution {
  id: string; agreement_id: string | null; job_id: string | null; host_id: string; talent_id: string;
  scheduled_start: string; scheduled_end: string; status: string;
  host_completed: boolean | null; talent_completed: boolean | null;
  agreement?: Agreement | null;
}

/**
 * Send a notification TO SOMEONE ELSE.
 *
 * This used to insert straight into `notifications` — and it never worked for anyone except Lee.
 * The table's RLS INSERT policy is `user_id = auth.uid()`, i.e. you may only create notifications
 * for YOURSELF. Writing one for a counterparty was rejected by Postgres every time, and the bare
 * try/catch swallowed it, so it failed in total silence. Lee's account happens to match a separate
 * "Admin can manage all notifications" policy, so his own testing always looked fine while every
 * ordinary member's contract offers, acceptances, declines, completions, reviews and connection
 * requests vanished. (Proved against the live DB, Jul 25 2026.)
 *
 * `send_notification` is a SECURITY DEFINER RPC that does the write with the checks that belong on
 * the server: the type must be one we ship, and the two people must already share an agreement, a
 * conversation, or a connection — except connection requests, which may target a stranger and are
 * rate-limited instead.
 *
 * Returns true when the notification actually landed, so callers can stop assuming it did.
 */
export async function notify(userId: string, type: string, title: string, body: string, actionUrl?: string): Promise<boolean> {
  if (!userId) return false;
  const { error } = await supabase.rpc("send_notification", {
    target_id: userId,
    n_type: type,
    n_title: title,
    n_body: body ?? null,
    n_action: actionUrl ?? null,
  });
  if (error) {
    // Loud in dev, harmless in prod — but never silent again.
    console.warn("[notify] failed", { type, userId, message: error.message });
    return false;
  }
  return true;
}

export async function fetchPendingAgreements(uid: string): Promise<Agreement[]> {
  const { data } = await supabase.from("agreements")
    .select("id, title, description, status, payment_amount, platform_fee, start_date, end_date, sender_id, recipient_id, conversation_id, payment_status, currency, location, start_time, end_time, is_recurring, created_at, updated_at, payer_id, payee_id, payment_rail, accept_window_hours, accept_deadline, sent_at, authorized_at, accepted_at, captured_at, payee_done_at, payer_done_at, released_at, paid_out_at, expired_at, payout_arrival_date, payout_status, payout_failure_message")
    .or(`recipient_id.eq.${uid},sender_id.eq.${uid}`)
    .in("status", ["sent", "pending"])
    .order("created_at", { ascending: false }).limit(20);
  return (data as Agreement[]) ?? [];
}

export async function fetchActiveExecutions(uid: string): Promise<Execution[]> {
  const { data } = await supabase.from("job_executions")
    .select("id, agreement_id, job_id, host_id, talent_id, scheduled_start, scheduled_end, status, host_completed, talent_completed")
    .or(`host_id.eq.${uid},talent_id.eq.${uid}`)
    .in("status", ["scheduled", "in_progress", "active"])
    .order("scheduled_start", { ascending: true }).limit(20);
  const execs = (data as Execution[]) ?? [];
  const agIds = execs.map(e => e.agreement_id).filter(Boolean) as string[];
  if (agIds.length) {
    const { data: ags } = await supabase.from("agreements")
      .select("id, title, description, status, payment_amount, platform_fee, start_date, end_date, sender_id, recipient_id, conversation_id, payment_status, currency, location, start_time, end_time, is_recurring, created_at, updated_at, payer_id, payee_id, payment_rail, accept_window_hours, accept_deadline, sent_at, authorized_at, accepted_at, captured_at, payee_done_at, payer_done_at, released_at, paid_out_at, expired_at, payout_arrival_date, payout_status, payout_failure_message")
      .in("id", agIds);
    const map = Object.fromEntries(((ags as Agreement[]) ?? []).map(a => [a.id, a]));
    execs.forEach(e => { e.agreement = e.agreement_id ? map[e.agreement_id] ?? null : null; });
  }
  return execs;
}

/**
 * PAYER vs PAYEE (critical, Lee's hard rule): the system must always know who PAYS (the client)
 * and who GETS PAID (the professional). `job_executions.host_id` = the PAYER, `talent_id` = the
 * PAYEE. Prefer the explicit `payer_id`/`payee_id` columns; only fall back to the quick-hire
 * shape (sender hires, recipient does the work) for legacy rows that predate those columns.
 *
 * BUG THIS FIXES (UAT Jul 25 2026): this used to hardcode host=sender, talent=recipient, which
 * INVERTED the roles for every payee-initiated contract — the pro would have been treated as
 * the payer. Never map roles off sender/recipient when payer_id/payee_id exist.
 */
export function rolesOf(a: Partial<Agreement> & { payer_id?: string | null; payee_id?: string | null; sender_id?: string | null; recipient_id?: string | null }) {
  const payer = a.payer_id ?? a.sender_id ?? null;
  const payee = a.payee_id ?? a.recipient_id ?? null;
  return { payer, payee };
}

export interface AcceptResult {
  ok: boolean;
  /** True when money actually left the payer and is now sitting in OneJob's holding balance. */
  captured?: boolean;
  /** Paid outside Stripe (PayPal / Wise) — there was never a hold to capture. */
  external?: boolean;
  /** Payee-initiated contract: the payer hasn't authorized anything yet. */
  awaitingPayment?: boolean;
  amount?: number;
  error?: string;
}

/**
 * Accept a contract — and CAPTURE the payer's hold in the same breath.
 *
 * THE BUG THIS CLOSES (#33): a Stripe card authorization dies after ~7 days. We authorized on SEND
 * and captured only when BOTH sides marked the job complete. Any job that finished more than a week
 * after it was sent — a fence next Saturday, a monthly clean, a two-week remodel — hit a dead hold
 * at capture time. The pro had already done the work and nobody got paid, and the failure surfaced
 * at the very last step where it was most expensive.
 *
 * So capture moves forward to acceptance. Balance funds don't expire, which is what makes a
 * long-running job safe:
 *   send   -> authorize (hold, nothing taken)
 *   accept -> CAPTURE into OneJob's Stripe balance = really held
 *   both complete -> transfer the payee's share out to their Connect account
 *
 * ORDER MATTERS. We capture BEFORE flipping the status to accepted. If the hold has already expired
 * we must not create a scheduled job with no money behind it — the payee would work for free. On
 * that failure the contract stays `sent` and the caller gets a message to show.
 */
export async function acceptAgreement(a: Agreement, meId: string): Promise<AcceptResult> {
  // 0) Is it still on offer? The payer was promised "no answer in X hours and your card is released",
  // and the sweeper runs every 5 minutes — so there's a window where the deadline has passed but the
  // row hasn't been swept yet. Honouring an accept in that window would charge someone we'd already
  // told wouldn't be charged. The deadline is the promise; enforce it here too.
  if (a.accept_deadline && new Date(a.accept_deadline).getTime() < Date.now()) {
    return {
      ok: false,
      error: "This contract expired before it was accepted, so the hold has been released. Ask them to send it again.",
    };
  }

  // 1) Money first. Never schedule work we can't pay for.
  let cap: AcceptResult = { ok: true };
  try {
    const { data, error } = await supabase.functions.invoke("capture-contract-hold", {
      body: { agreementId: a.id },
    });
    if (error) {
      // Edge functions surface non-2xx as an error whose body holds the real, human sentence.
      let msg = "";
      try { const b = await (error as any).context?.json?.(); msg = b?.error || ""; } catch { /* no body */ }
      return { ok: false, error: msg || "We couldn't collect the payment. Please try accepting again." };
    }
    const d = data as any;
    if (d && d.ok === false) return { ok: false, error: d.error || "We couldn't collect the payment." };
    cap = {
      ok: true,
      captured: !!d?.captured,
      external: !!d?.external,
      awaitingPayment: d?.reason === "no_hold_yet",
      amount: d?.amount,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "We couldn't reach payments just now. Try accepting again in a moment." };
  }

  // 2) Now it's safe to make the job real.
  const stamp = new Date().toISOString();
  await supabase.from("agreements").update({ status: "accepted", responded_at: stamp, accepted_at: stamp }).eq("id", a.id);
  const start = a.start_date ? new Date(a.start_date) : new Date(Date.now() + 86400000);
  const end = a.end_date && a.end_date !== a.start_date ? new Date(a.end_date) : new Date(start.getTime() + 3 * 3600000);
  const { payer, payee } = rolesOf(a as any);
  await supabase.from("job_executions").insert({
    agreement_id: a.id, host_id: payer, talent_id: payee,
    scheduled_start: start.toISOString(), scheduled_end: end.toISOString(), status: "scheduled",
  });

  // Say exactly what happened to the money — the three cases are genuinely different.
  const isFree = a.payment_rail === "promo";
  const moneyLine = isFree
    ? "This contract is free — there's nothing to collect."
    : cap.external
    ? "You two are settling payment outside OneJob."
    : cap.captured
      ? "The payment has been collected into the OneJob Vault and stays there until you both mark the job complete."
      : "Payment still needs to be set up before the job starts.";
  if (a.conversation_id) await supabase.from("messages").insert({
    conversation_id: a.conversation_id, sender_id: meId, message_type: "system",
    content: `✅ Contract accepted: "${a.title}" — the job is scheduled. ${moneyLine}`,
  });
  await notify(a.sender_id, "agreement_accepted", "Contract accepted ✅",
    `"${a.title}" is on.${cap.captured ? " Your payment is now in the OneJob Vault until you both mark it complete." : ""}`,
    "/jobs/calendar");
  return cap;
}

/**
 * Decline a contract AND actually release the payer's card hold.
 * BUG THIS FIXES (UAT Jul 25 2026): this used to promise "the payment hold will be released"
 * while containing no code that released anything — the authorization sat on the payer's card
 * until Stripe's 7-day expiry. Never tell a user money moved without making it move.
 */
export async function declineAgreement(a: Agreement, meId: string): Promise<{ released: boolean; error?: string }> {
  await supabase.from("agreements").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", a.id);

  let released = false, releaseErr: string | undefined;
  try {
    const { data, error } = await supabase.functions.invoke("release-contract-hold", {
      body: { agreementId: a.id, reason: "declined" },
    });
    if (error) {
      try { const b = await (error as any).context?.json?.(); releaseErr = b?.error; } catch { /* no body */ }
      releaseErr = releaseErr || "We couldn't release the card hold automatically.";
    } else released = !!(data as any)?.released;
  } catch (e: any) {
    releaseErr = e?.message || "We couldn't release the card hold automatically.";
  }

  const holdLine = released ? "The payment hold has been released." : "We're releasing the payment hold.";
  if (a.conversation_id) await supabase.from("messages").insert({
    conversation_id: a.conversation_id, sender_id: meId, message_type: "system",
    content: `❌ Contract declined: "${a.title}". ${holdLine}`,
  });
  const { payer } = rolesOf(a as any);
  if (payer) await notify(payer, "agreement_declined", "Contract declined",
    `"${a.title}" was declined. ${released ? "You were not charged — the hold is released." : "We're releasing the hold on your card."}`, "/jobs/jobs");
  return { released, error: releaseErr };
}

export interface CompleteResult {
  both: boolean;
  /** The charge went through (money is in OneJob's balance). NOT the same as the pro being paid. */
  captured?: boolean;
  /** The pro's share actually left the holding balance for their Stripe account. THIS is "paid". */
  released?: boolean;
  /** Why the release didn't happen: payouts_not_enabled | transfer_failed | zero_share. */
  blockedReason?: string;
  amount?: number;
  external?: boolean;
  error?: string;
}

export async function markComplete(e: Execution, meId: string): Promise<CompleteResult> {
  const isHost = e.host_id === meId;
  const otherCompleted = isHost ? !!e.talent_completed : !!e.host_completed;
  const update: any = { updated_at: new Date().toISOString() };
  if (isHost) update.host_completed = true; else update.talent_completed = true;
  if (otherCompleted) { update.status = "completed"; update.completed_at = new Date().toISOString(); }
  await supabase.from("job_executions").update(update).eq("id", e.id);

  // Stamp the money timeline (#39). host_id IS the payer and talent_id IS the payee (see rolesOf),
  // so "who marked it complete" maps directly onto which side of the timeline lights up. Written
  // here rather than derived in the UI, because the timeline's whole promise is that each row is
  // backed by the moment the thing actually happened.
  if (e.agreement_id) {
    const stamp = new Date().toISOString();
    await supabase.from("agreements")
      .update(isHost ? { payer_done_at: stamp } : { payee_done_at: stamp })
      .eq("id", e.agreement_id);
  }

  const otherId = isHost ? e.talent_id : e.host_id;
  if (!otherCompleted) {
    await notify(otherId, "job_marked_complete", "Job marked complete ✔️",
      `${isHost ? "The hirer" : "The professional"} marked "${e.agreement?.title ?? "the job"}" complete — confirm on your side to release payment.`, "/jobs");
    return { both: false };
  }
  let captured = false, released = false, amount: number | undefined, external = false, error: string | undefined;
  let blockedReason: string | undefined;
  if (e.agreement_id) {
    // external-rail contracts (PayPal/Wise direct) have no Stripe hold to capture.
    // NOTE: this used to `return` early with a shape that had no `both`, so the caller's
    // `if (r.both)` was falsy and the review modal never opened. Flag it instead of returning.
    const { data: agRow } = await supabase.from("agreements").select("payment_rail").eq("id", e.agreement_id).maybeSingle();
    // "promo" is a fully-free contract (FOUNDERFREE / FOUNDER100). There is no PaymentIntent at all,
    // so asking capture-contract-payment to release it would fail with "No payment hold found" and
    // show the pro a scary error at the end of a job that was never going to pay. Same shape as the
    // external rail: the job completes, nothing moves, nobody is misled.
    if (agRow?.payment_rail === "external" || agRow?.payment_rail === "promo") {
      external = true;
    } else {
      // Never swallow a payments error — the pro needs to know if their money didn't move.
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("capture-contract-payment", { body: { agreementId: e.agreement_id } });
        if (fnErr) {
          try { const b = await (fnErr as any).context?.json?.(); error = b?.error; } catch { /* no body */ }
          error = error || "The job is complete, but releasing the payment failed. We'll retry automatically.";
        } else {
          // BUG THIS FIXES (UAT Jul 26 2026): this read `captured`, which is true on EVERY success
          // path — including `pending_connect`, where the pro has no usable Stripe account and the
          // transfer never happened. Both parties were then told "the payment has been released 🎉"
          // while the money sat in OneJob's balance, and the money timeline in the same app correctly
          // showed "Sent to the pro's Stripe account" as NOT done. Two screens, two different stories,
          // about somebody's money. `released` is the only field that means the pro was actually paid.
          released = !!data?.released;
          captured = !!data?.captured;
          amount = data?.amount;
          if (!released) blockedReason = data?.blockedReason ?? "not_released";
        }
      } catch (err: any) {
        error = err?.message || "The job is complete, but releasing the payment failed. We'll retry automatically.";
      }
    }
  }
  await notify(otherId, "job_completed", "Job completed 🎉",
    `"${e.agreement?.title ?? "The job"}" is done${released ? " and the payment has been released" : ""}. Leave your review!`, "/jobs");
  // The server owns consent, E.164 validation and idempotency. This handoff is deliberately
  // fail-soft: a marketing review request must never roll back job completion or payment release.
  if (e.agreement_id) {
    void supabase.functions.invoke("review-request", { body: { agreementId: e.agreement_id } })
      .then(({ error: reviewError }) => {
        if (reviewError) console.warn("[review-request] handoff failed", reviewError.message);
      })
      .catch((reviewError) => console.warn("[review-request] handoff failed", reviewError));
  }
  return { both: true, captured, released, blockedReason, amount, external, error };
}

export const HOST_QUESTIONS = [
  { key: "clear_expectations", en: "Clear expectations", es: "Expectativas claras" },
  { key: "professionalism", en: "Professionalism as a client", es: "Profesionalismo como cliente" },
  { key: "communication", en: "Communication", es: "Comunicación" },
  { key: "punctuality", en: "On-time payment", es: "Pago puntual" },
  { key: "reliability", en: "Reliability", es: "Confiabilidad" },
  { key: "environment", en: "Work environment", es: "Ambiente de trabajo" },
  { key: "overall", en: "Overall experience", es: "Experiencia general" },
];
export const TALENT_QUESTIONS = [
  { key: "quality", en: "Quality of work", es: "Calidad del trabajo" },
  { key: "professionalism", en: "Professionalism", es: "Profesionalismo" },
  { key: "communication", en: "Communication", es: "Comunicación" },
  { key: "punctuality", en: "Punctuality", es: "Puntualidad" },
  { key: "reliability", en: "Reliability", es: "Confiabilidad" },
  { key: "value", en: "Value for money", es: "Relación calidad-precio" },
  { key: "overall", en: "Overall experience", es: "Experiencia general" },
];

export async function submitReview(executionId: string, reviewerId: string, revieweeId: string, ratings: Record<string, number>, comment: string, jobTitle: string) {
  const keys = Object.keys(ratings);
  const avg = Number((keys.reduce((s, k) => s + ratings[k], 0) / keys.length).toFixed(1));
  const { error } = await supabase.from("job_reviews").insert({
    execution_id: executionId, reviewer_id: reviewerId, reviewee_id: revieweeId,
    rating: avg, comment: comment || null, review_data: ratings,
  });
  if (!error) await notify(revieweeId, "review_received", `New review: ${avg} ⭐`,
    `You received a ${avg}-star review for "${jobTitle}". This impacts your OneScore™.`, "/jobs");
  return { error, avg };
}
