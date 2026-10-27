import { supabase } from "./supabase";
import { systemEvent } from "@oneworld/shell";

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
export async function notify(userId: string, type: string, title: string, body: string, actionUrl?: string, meta?: Record<string, unknown>): Promise<boolean> {
  if (!userId) return false;
  /* `meta` carries the event + params so each READER's screen writes the notice in their language
     (shell lib/systemMessages). The English title/body stay as the fallback. */
  const { error } = await supabase.rpc("send_notification", {
    target_id: userId,
    n_type: type,
    n_title: title,
    n_body: body ?? null,
    n_action: actionUrl ?? null,
    ...(meta ? { n_meta: meta } : {}),
  });
  if (error) {
    // Loud in dev, harmless in prod — but never silent again.
    console.warn("[notify] failed", { type, userId, message: error.message });
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * WRITES THAT FAILED USED TO TELL THE MEMBER THEY SUCCEEDED (TESTING, 14 Oct 2026)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * OJ-173-RECOVERY-05 / ACCEPT02, reported against release 173:
 *   · a job application whose insert returned an error still opened the chat and said "applied";
 *   · a decline whose write returned an error still reported "declined / hold released";
 *   · a completion whose write returned an error still notified the other side "complete".
 *
 * The cause is one line repeated: `await supabase.from(...).update(...)` with the result thrown
 * away. **PostgREST does not throw.** An RLS refusal, a constraint violation and a dropped
 * connection all RESOLVE, with the failure sitting in `error` where nobody was looking. The code
 * then carried on and told both people the thing had happened.
 *
 * On a money path that is the worst class of bug there is: not "it broke", but "it lied".
 *
 * ── AND A RETURNED ERROR IS NOT THE SAME AS A REFUSAL ──────────────────────────────────────
 * `@supabase/postgrest-js` turns a network failure, an abort or a timeout into a returned error
 * whose `code` is the EMPTY STRING. A refusal and a lost answer arrive in the same shape. Only an
 * error carrying a five-character SQLSTATE (`42501`, `23514`) or a `PGRSTnnn` is known NOT to have
 * committed. Anything else leaves the outcome UNKNOWN — and an unknown outcome is settled by
 * READING THE ROW BACK, never by sending the write again. Re-sending is how a second payment, a
 * second booking or a second notification gets made.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

type WriteOutcome = "ok" | "refused" | "unknown";

/* An UPDATE that row-level security filters out does not error — it changes ZERO rows and resolves
   cleanly, which would read as "ok". Every checked update below asks for the ids it changed
   (`.select("id")`) and treats an empty answer as a refusal (ONEWORLD 31, re-applying on 192). */
function outcomeOfUpdate(error: { code?: string; message?: string } | null, rows: unknown, id: string): WriteOutcome {
  const out = outcomeOf(error);
  if (out !== "ok") return out;
  /* Only an array that contains THIS row's id proves the write landed (Max W12: a non-array or an
     unrelated id is not confirmation). */
  return Array.isArray(rows) && rows.some(r => !!r && typeof r === "object" && (r as { id?: unknown }).id === id) ? "ok" : "refused";
}

/** A short, safe reference support can search for (never a payment credential). */
/** The one honest line for a payment step whose outcome we could not confirm (ORCHESTRATOR, 23 Oct 2026, World12
 *  round 4): no absolute claim either way — not "it failed", not "it can never charge twice". */
const PAYMENT_UNKNOWN = (id: string) => `We couldn't confirm this payment. Check Payments before you try again. Contract ${contractRef(id)}.`;

const contractRef = (id: string) => `#${String(id).slice(0, 8)}`;

/** What a PostgREST result actually tells us. */
function outcomeOf(error: { code?: string; message?: string } | null): WriteOutcome {
  if (!error) return "ok";
  const code = (error.code ?? "").trim();
  if (/^[0-9A-Z]{5}$/.test(code) || /^PGRST\d+$/.test(code)) return "refused";
  return "unknown";
}

/**
 * Settle an unknown outcome by reading the row, which is the only honest way to find out.
 * Returns "ok" when the row now looks the way the write intended, "refused" when it plainly does
 * not, and "unknown" when even the read failed — in which case the caller must say so rather
 * than guess in either direction.
 */
async function settleByReading(
  table: string, id: string, columns: string, looksWritten: (row: Record<string, unknown>) => boolean,
): Promise<WriteOutcome> {
  /* Least data (Max W12): only the columns the check needs, never select("*") on a money table. */
  const { data, error } = await supabase.from(table).select(columns).eq("id", id).maybeSingle();
  if (error || !data) return "unknown";
  return looksWritten(data as unknown as Record<string, unknown>) ? "ok" : "refused";
}

/**
 * ONE SUCCESS NOTIFICATION PER THING THAT HAPPENED, however many times the member retries.
 *
 * TESTING: *"Fault → successful retry invokes success notification twice."* Correct, and it is
 * the member's own second tap after a failure — not a server fault. The register is keyed by the
 * RECORD'S OWN id, never by a screen or a route key, because a route can say "latest" and mean a
 * different row an hour later. Module-level so it outlives the screen: leaving and coming back
 * must not re-arm a notification that already went.
 *
 * It is deliberately NOT persisted. The worst case of losing it is one duplicate notification
 * after a full reload; the worst case of persisting it wrongly is a notification that can never
 * be sent again.
 */
const notifiedOnce = new Set<string>();
/* Max W12-NOTIFY: two calls in the same moment both passed the Set check before either finished.
   A call already in flight is now SHARED, so concurrent callers wait for the one request. This is a
   per-page, in-memory guard — not a durable or cross-device "exactly once"; that needs the server. */
const notifyInFlight = new Map<string, Promise<boolean>>();
async function notifyOnce(
  key: string, userId: string, type: string, title: string, body: string, actionUrl?: string, meta?: Record<string, unknown>,
): Promise<boolean> {
  if (notifiedOnce.has(key)) return true;
  const running = notifyInFlight.get(key);
  if (running) return running;
  const p = (async () => {
    const ok = await notify(userId, type, title, body, actionUrl, meta);
    /* Only a landed notification is remembered. A failed one must stay retryable, or a transient
       outage becomes a permanently missing message. */
    if (ok) notifiedOnce.add(key);
    return ok;
  })().finally(() => { notifyInFlight.delete(key); });
  notifyInFlight.set(key, p);
  return p;
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
  /** Why ok is false: "refused" = definitely not done; "unknown" = could not confirm either way (check, don't repeat). */
  outcome?: "refused" | "unknown";
  /** The job_executions row (the calendar entry): true = confirmed written; false = confirmed NOT written. */
  scheduled?: boolean;
  /** The calendar entry could not be confirmed either way (lost answer and failed read-back). */
  scheduleUnknown?: boolean;
  /** Follow-up effects (chat line, notification) that failed after the contract was confirmed accepted. */
  warnings?: string[];
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
      /* Max W12R2-PAYMENT-UNKNOWN. A reply FROM the payments function (an HTTP status with its own
         sentence) is that function's answer: it refused, or it failed and says so. A lost answer (no
         response, relay/fetch failure) is UNKNOWN — the capture may have happened. capture-contract-hold
         captures with a Stripe idempotency key per contract (onejob_capture_accept_<id>), so a second accept
         is not expected to charge again — but the member is NOT promised that (ORCHESTRATOR ruling, 23 Oct
         2026: no absolute claims). They are told the truth: we couldn't confirm, check Payments first. */
      const ctx = (error as any)?.context;
      const isHttp = ctx && typeof ctx.status === "number";
      if (!isHttp) {
        return { ok: false, outcome: "unknown", error: PAYMENT_UNKNOWN(a.id) };
      }
      let msg = "";
      try { const b = await ctx.json?.(); msg = typeof b?.error === "string" ? b.error : ""; } catch { /* no body */ }
      /* A 5xx is the payments function failing, not refusing: the capture may still have happened, so it
         gets the same honest unknown wording and never a definite "not collected" (ORCHESTRATOR, 23 Oct). */
      if (ctx.status >= 500) return { ok: false, outcome: "unknown", error: PAYMENT_UNKNOWN(a.id) };
      return { ok: false, outcome: "refused", error: msg || "We couldn't collect the payment. Please try accepting again." };
    }
    const d = data as any;
    /* Strict success shape (Max W12/W12R2): capture-contract-hold answers success ONLY with ok:true.
       Anything else — missing, {}, ok not exactly true — is not a success: the payment state is unknown. */
    if (!d || typeof d !== "object" || (d.ok !== true && d.ok !== false)) {
      return { ok: false, outcome: "unknown", error: PAYMENT_UNKNOWN(a.id) };
    }
    if (d.ok === false) return { ok: false, outcome: "refused", error: typeof d.error === "string" && d.error ? d.error : "We couldn't collect the payment." };
    cap = {
      ok: true,
      captured: d.captured === true,
      external: d.external === true,
      awaitingPayment: d.reason === "no_hold_yet",
      amount: typeof d.amount === "number" ? d.amount : undefined,
    };
  } catch (e: any) {
    console.error("[jobloop] accept: payments call threw —", e?.message);
    return { ok: false, outcome: "unknown", error: PAYMENT_UNKNOWN(a.id) };
  }

  // 2) Now it's safe to make the job real.
  const stamp = new Date().toISOString();
  /* ⚠️ THE MONEY HAS ALREADY MOVED BY THIS LINE. If this write fails and we carry on, the payer
     has been charged for a contract that still reads "pending" to both people — the single worst
     state this file can produce. It is checked, settled by reading when the outcome is unknown,
     and on a genuine refusal the caller is told the truth instead of being shown an acceptance. */
  {
    /* A THROWN transport error must not erase what we already know about the money (Max W12): it is
       caught here and treated as an unknown outcome, so the result below still carries `captured`. */
    let out: WriteOutcome; let msg: string | undefined;
    try {
      const { data: rows, error } = await supabase.from("agreements")
        .update({ status: "accepted", responded_at: stamp, accepted_at: stamp }).eq("id", a.id).select("id");
      out = outcomeOfUpdate(error, rows, a.id); msg = error?.message;
    } catch (e: any) { out = "unknown"; msg = e?.message; }
    if (out === "unknown") {
      try { out = await settleByReading("agreements", a.id, "id, status", r => r.status === "accepted"); } catch { out = "unknown"; }
    }
    if (out !== "ok") {
      console.error("[jobloop] accept: the contract was not confirmed accepted —", out, msg);
      const ref = contractRef(a.id);
      const paid = cap.captured
        ? `The payment for this contract went through — nobody needs to pay again. `
        : "";
      return {
        ...cap,
        ok: false,
        outcome: out,
        error: out === "unknown"
          ? `${paid}We couldn't confirm the contract was marked accepted. Don't accept again yet — open the contract (${ref}) to check its status, or contact support with ${ref}.`
          : `${paid}We couldn't mark the contract accepted. ${cap.captured ? `Contact support with ${ref} so we can finish it.` : "Open it and try again."}`,
      };
    }
  }
  const start = a.start_date ? new Date(a.start_date) : new Date(Date.now() + 86400000);
  const end = a.end_date && a.end_date !== a.start_date ? new Date(a.end_date) : new Date(start.getTime() + 3 * 3600000);
  const { payer, payee } = rolesOf(a as any);
  /* The scheduled job itself. A failure here leaves an accepted contract with nothing on the
     calendar, which the member discovers days later — so it is reported, not swallowed. The
     contract IS accepted at this point, so this is a warning, not a reversal. */
  /* Max W12-SCHEDULE / W12R2-SCHEDULE-UNKNOWN: three states, never guessed. Confirmed written →
     scheduled. Refused (SQLSTATE/PGRST) → not scheduled. Lost answer → READ BACK by agreement; if the
     read also fails the calendar state is UNKNOWN and the member is told to check before scheduling. */
  let schedOut: WriteOutcome = "unknown";
  try {
    const { data: exRow, error } = await supabase.from("job_executions").insert({
      agreement_id: a.id, host_id: payer, talent_id: payee,
      scheduled_start: start.toISOString(), scheduled_end: end.toISOString(), status: "scheduled",
    }).select("id").maybeSingle();
    const o = outcomeOf(error);
    schedOut = o === "ok" ? (!!exRow && typeof (exRow as { id?: unknown }).id === "string" ? "ok" : "unknown") : o;
  } catch (e: any) { console.error("[jobloop] accept: the calendar insert threw —", e?.message); schedOut = "unknown"; }
  if (schedOut === "unknown") {
    try {
      const { data, error } = await supabase.from("job_executions").select("id").eq("agreement_id", a.id).limit(1);
      if (!error && Array.isArray(data)) schedOut = data.length > 0 ? "ok" : "refused";
    } catch { /* stays unknown */ }
  }
  const scheduled = schedOut === "ok";
  if (!scheduled) console.error("[jobloop] accept: the calendar entry is", schedOut);
  const warnings: string[] = [];

  // Say exactly what happened to the money — the three cases are genuinely different.
  const isFree = a.payment_rail === "promo";
  const moneyLine = isFree
    ? "This contract is free — there's nothing to collect."
    : cap.external
    ? "You two are settling payment outside OneJob."
    : cap.captured
      ? "The payment has been collected into the OneJob Vault and stays there until you both mark the job complete."
      : "Payment still needs to be set up before the job starts.";
  /* Max W12R2-POSTCOMMIT: the contract IS accepted (and maybe paid) by now. A chat line or a
     notification that fails afterwards is a warning — it never erases the confirmed outcome. */
  const calLine = scheduled ? "the job is scheduled." : schedOut === "refused" ? "it is not on the calendar yet; open the contract to set the date." : "open the contract to check the date.";
  try {
    if (a.conversation_id) {
      const { error } = await supabase.from("messages").insert({
        conversation_id: a.conversation_id, sender_id: meId, message_type: "system",
        content: `✅ Contract accepted: "${a.title}" — ${calLine} ${moneyLine}`,
        metadata: systemEvent("contract_accepted_line", { title: a.title ?? "", ...(schedOut === "unknown" ? {} : { scheduled }), money: isFree ? "free" : cap.external ? "external" : cap.captured ? "vault" : "setup" }),
      });
      if (error) warnings.push("chat");
    }
  } catch { warnings.push("chat"); }
  try {
    const sent = await notifyOnce(`accept:${a.id}`, a.sender_id, "agreement_accepted", "Contract accepted ✅",
      `"${a.title}" is on.${cap.captured ? " The payment is now in the OneJob Vault until you both mark it complete." : ""}`,
      "/jobs/calendar", systemEvent("agreement_accepted", { title: a.title ?? "", captured: cap.captured === true }));
    if (!sent) warnings.push("notification");
  } catch { warnings.push("notification"); }
  return {
    ...cap,
    scheduled,
    scheduleUnknown: schedOut === "unknown",
    warnings,
    error: scheduled ? cap.error
      : schedOut === "refused"
        ? `Contract accepted, but it isn't on the calendar yet. Open the contract (${contractRef(a.id)}) to set the date — the payment is not affected.`
        : `Contract accepted. We couldn't confirm the calendar entry — open the contract (${contractRef(a.id)}) to check the date before adding it again. The payment is not affected.`,
  };
}

/**
 * Decline a contract AND actually release the payer's card hold.
 * BUG THIS FIXES (UAT Jul 25 2026): this used to promise "the payment hold will be released"
 * while containing no code that released anything — the authorization sat on the payer's card
 * until Stripe's 7-day expiry. Never tell a user money moved without making it move.
 */
export async function declineAgreement(
  a: Agreement, meId: string,
): Promise<{ ok: boolean; released: boolean; error?: string; outcome?: "refused" | "unknown" }> {
  /* ⚠️ CHECKED BEFORE ANYTHING IS ANNOUNCED (TESTING OJ-173-RECOVERY-05). This write used to be
     fire-and-forget, so a refused decline still told the payer their hold was being released and
     still posted "Contract declined" into the thread — while the contract sat live and the
     authorization stayed on the card. Nothing below runs unless the decline actually landed. */
  {
    let out: WriteOutcome; let msg: string | undefined;
    try {
      const { data: rows, error } = await supabase.from("agreements")
        .update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", a.id).select("id");
      out = outcomeOfUpdate(error, rows, a.id); msg = error?.message;
    } catch (e: any) { out = "unknown"; msg = e?.message; }
    if (out === "unknown") {
      try { out = await settleByReading("agreements", a.id, "id, status", r => r.status === "declined"); } catch { out = "unknown"; }
    }
    if (out !== "ok") {
      console.error("[jobloop] decline: the contract was not confirmed declined —", out, msg);
      /* `ok: false` is the part the screen needs. Refused and UNKNOWN are different (Max W12-UNKNOWN):
         only a refusal may say "nothing has changed". */
      return {
        ok: false, released: false, outcome: out,
        error: out === "unknown"
          ? `We couldn't confirm whether the contract was declined. Open it (${contractRef(a.id)}) to check before trying again.`
          : "We couldn't decline this contract. Nothing has changed — please try again.",
      };
    }
  }

  let released = false, releaseErr: string | undefined;
  try {
    const { data, error } = await supabase.functions.invoke("release-contract-hold", {
      body: { agreementId: a.id, reason: "declined" },
    });
    if (error) {
      try { const b = await (error as any).context?.json?.(); releaseErr = b?.error; } catch { /* no body */ }
      releaseErr = releaseErr || "We couldn't release the card hold automatically.";
    } else released = (data as any)?.released === true;
  } catch (e: any) {
    releaseErr = e?.message || "We couldn't release the card hold automatically.";
  }

  /* Max W12: a failed release must not be announced as "releasing". A card authorization that is never
     collected lapses on its own (Stripe: within 7 days); say that, and point to support. */
  const holdLine = released
    ? "The payment hold has been released."
    : "The payment hold wasn't released automatically. An uncollected hold lapses on its own within 7 days; contact support if it is still there.";
  /* Post-commit effects never erase the confirmed decline (Max W12R2-POSTCOMMIT). */
  try {
    if (a.conversation_id) await supabase.from("messages").insert({
      conversation_id: a.conversation_id, sender_id: meId, message_type: "system",
      content: `❌ Contract declined: "${a.title}". ${holdLine}`,
      metadata: systemEvent("contract_declined_line", { title: a.title ?? "", released }),
    });
  } catch (e: any) { console.error("[jobloop] decline: chat line failed —", e?.message); }
  const { payer } = rolesOf(a as any);
  if (payer) await notifyOnce(`decline:${a.id}`, payer, "agreement_declined", "Contract declined",
    `"${a.title}" was declined. ${released ? "You were not charged — the hold is released." : "You were not charged. The hold on your card wasn't released automatically; it lapses on its own within 7 days — contact support if it stays."}`, "/jobs/jobs",
    systemEvent("agreement_declined", { title: a.title ?? "", released })).catch(() => false);
  return { ok: true, released, error: releaseErr };
}

export interface CompleteResult {
  /** The completion mark actually landed in the database. False means nothing changed at all. */
  ok: boolean;
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
  /** Why ok is false: "refused" = definitely not marked; "unknown" = could not confirm either way. */
  outcome?: "refused" | "unknown";
}

export async function markComplete(e: Execution, meId: string): Promise<CompleteResult> {
  const isHost = e.host_id === meId;
  const otherCompleted = isHost ? !!e.talent_completed : !!e.host_completed;
  const update: any = { updated_at: new Date().toISOString() };
  if (isHost) update.host_completed = true; else update.talent_completed = true;
  if (otherCompleted) { update.status = "completed"; update.completed_at = new Date().toISOString(); }
  /* ⚠️ CHECKED BEFORE EITHER SIDE IS TOLD (TESTING OJ-173-RECOVERY-05). A refused write here used
     to still notify the other person that the job was complete — and when both sides are marked
     complete this is the write that unlocks the payout. Telling somebody their job is finished
     when the record says otherwise is how a pro waits for money that was never released. */
  {
    let out: WriteOutcome; let msg: string | undefined;
    try {
      const { data: rows, error } = await supabase.from("job_executions").update(update).eq("id", e.id).select("id");
      out = outcomeOfUpdate(error, rows, e.id); msg = error?.message;
    } catch (err: any) { out = "unknown"; msg = err?.message; }
    if (out === "unknown") {
      try {
        out = await settleByReading("job_executions", e.id, "id, host_completed, talent_completed",
          r => (isHost ? r.host_completed : r.talent_completed) === true);
      } catch { out = "unknown"; }
    }
    if (out !== "ok") {
      console.error("[jobloop] complete: the job was not confirmed complete —", out, msg);
      return {
        ok: false, both: false, outcome: out,
        error: out === "unknown"
          ? "We couldn't confirm whether this was marked complete. Open the job to check before trying again."
          : "We couldn't mark this complete. Nothing has changed — please try again.",
      };
    }
  }

  // Stamp the money timeline (#39). host_id IS the payer and talent_id IS the payee (see rolesOf),
  // so "who marked it complete" maps directly onto which side of the timeline lights up. Written
  // here rather than derived in the UI, because the timeline's whole promise is that each row is
  // backed by the moment the thing actually happened.
  if (e.agreement_id) {
    const stamp = new Date().toISOString();
    /* The money timeline is evidence, not decoration — a missing stamp makes a step that really
       happened look as though it never did. The job IS marked complete by now, so a failure here
       is reported rather than reversed. */
    try {
      const { error } = await supabase.from("agreements")
        .update(isHost ? { payer_done_at: stamp } : { payee_done_at: stamp })
        .eq("id", e.agreement_id);
      if (outcomeOf(error) !== "ok") console.error("[jobloop] complete: the timeline stamp was not written —", error?.message);
    } catch (err: any) { console.error("[jobloop] complete: the timeline stamp threw —", err?.message); }
  }

  const otherId = isHost ? e.talent_id : e.host_id;
  if (!otherCompleted) {
    await notifyOnce(`complete:${e.id}:${meId}`, otherId, "job_marked_complete", "Job marked complete ✔️",
      `${isHost ? "The hirer" : "The professional"} marked "${e.agreement?.title ?? "the job"}" complete — confirm on your side to release payment.`, "/jobs",
      systemEvent("job_marked_complete", { title: e.agreement?.title ?? "", by: isHost ? "hirer" : "professional" })).catch(() => false);
    return { ok: true, both: false };
  }
  let captured = false, released = false, amount: number | undefined, external = false, error: string | undefined;
  let blockedReason: string | undefined;
  if (e.agreement_id) {
    // external-rail contracts (PayPal/Wise direct) have no Stripe hold to capture.
    // NOTE: this used to `return` early with a shape that had no `both`, so the caller's
    // `if (r.both)` was falsy and the review modal never opened. Flag it instead of returning.
    let agRow: { payment_rail?: string | null } | null = null;
    try { ({ data: agRow } = await supabase.from("agreements").select("payment_rail").eq("id", e.agreement_id).maybeSingle()); }
    catch (err: any) { console.error("[jobloop] complete: rail read threw —", err?.message); }
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
          error = error || `The job is complete, but the payment was not released yet. Contact support with ${contractRef(e.agreement_id)} if it isn't released soon.`;
        } else {
          // BUG THIS FIXES (UAT Jul 26 2026): this read `captured`, which is true on EVERY success
          // path — including `pending_connect`, where the pro has no usable Stripe account and the
          // transfer never happened. Both parties were then told "the payment has been released 🎉"
          // while the money sat in OneJob's balance, and the money timeline in the same app correctly
          // showed "Sent to the pro's Stripe account" as NOT done. Two screens, two different stories,
          // about somebody's money. `released` is the only field that means the pro was actually paid.
          released = data?.released === true;
          captured = data?.captured === true;
          amount = typeof data?.amount === "number" ? data.amount : undefined;
          if (!released) blockedReason = data?.blockedReason ?? "not_released";
        }
      } catch (err: any) {
        error = err?.message || `The job is complete, but we couldn't confirm the payment was released. Contact support with ${contractRef(e.agreement_id)}.`;
      }
    }
  }
  /* Max W12-NOTIFY: the final notice is once per job too, like the others. */
  await notifyOnce(`completed:${e.id}`, otherId, "job_completed", "Job completed 🎉",
    `"${e.agreement?.title ?? "The job"}" is done${released ? " and the payment has been released" : ""}. Leave your review!`, "/jobs",
    systemEvent("job_completed", { title: e.agreement?.title ?? "", released })).catch(() => false);
  // The server owns consent, E.164 validation and idempotency. This handoff is deliberately
  // fail-soft: a marketing review request must never roll back job completion or payment release.
  if (e.agreement_id) {
    void supabase.functions.invoke("review-request", { body: { agreementId: e.agreement_id } })
      .then(({ error: reviewError }) => {
        if (reviewError) console.warn("[review-request] handoff failed", reviewError.message);
      })
      .catch((reviewError) => console.warn("[review-request] handoff failed", reviewError));
  }
  return { ok: true, both: true, captured, released, blockedReason, amount, external, error };
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
