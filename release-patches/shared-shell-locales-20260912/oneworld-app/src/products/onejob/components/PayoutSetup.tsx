import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@job/lib/supabase";
import { fnError, thrownError } from "@job/lib/fnError";
import Chevron from "./Chevron";
import { payeeTimingLines, instantPayoutAvailable, payoutTiming } from "@job/lib/payoutTiming";

import { useI18n, W } from "@job/lib/i18n";
/**
 * The whole payout-setup experience, in one place — used by the contract form AND Settings so the
 * two can't drift.
 *
 * Built from Lee's walkthrough of his own onboarding (Jul 26 2026). Three things were wrong, and
 * none of them were bugs exactly — they were the app failing to say what was happening:
 *
 *  1. NO WARNING BEFORE LEAVING. You tapped a button and got teleported into a stranger's identity
 *     form. So there's now a briefing first: how long it takes, what Stripe will ask for, that
 *     there may be a CAPTCHA. People abandon flows they weren't prepared for.
 *
 *  2. STRIPE NEVER SAYS "APPROVED". Its last screen is a neutral "thanks, we're reviewing this",
 *     which then vanishes. Lee: "it gives you no definitive message that you're good to go... okay,
 *     what do I do now?" So on return we check the real account status and, if payouts are actually
 *     enabled, say so in a modal they have to acknowledge. We only claim approval when Stripe's own
 *     `payouts_enabled` is true — never on the basis of "they came back from the redirect".
 *
 *  3. NO WAY TO CHANGE ANYTHING LATER. Now there's a Manage link that opens their Express
 *     Dashboard, where they can change the bank account and clear anything Stripe still wants.
 */

type Status = {
  has_account?: boolean;
  payouts_enabled?: boolean;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  bank_last4?: string | null;
  bank_name?: string | null;
  has_debit_card?: boolean;
  /**
   * ISO country of the connected account. Load-bearing, not decorative: payout speed and whether
   * Instant Payouts exist at all are country facts, and this screen used to state US-only numbers to
   * everyone. See src/lib/payoutTiming.ts.
   */
  country?: string | null;
  payout_interval?: string | null;
  payout_delay_days?: number | null;
  requirements_currently_due?: string[];
  requirements_past_due?: string[];
  requirements_pending_verification?: string[];
  requirements_eventually_due?: string[];
  disabled_reason?: string | null;
  /**
   * One name for the situation, decided server-side in stripe-connect-status where the Stripe
   * semantics live. Older cached bundles won't send it, so every branch below still falls back to
   * the individual booleans.
   */
  payout_state?: "ready" | "action_needed" | "under_review" | "blocked" | "not_started";
};

/** Human words for Stripe's requirement keys, so a nudge never reads like a database column. */
const REQUIREMENT_LABELS: Record<string, string> = {
  "individual.dob.day": "date of birth",
  "individual.dob.month": "date of birth",
  "individual.dob.year": "date of birth",
  "individual.ssn_last_4": "last 4 of your SSN",
  "individual.id_number": "a government ID number",
  "individual.verification.document": "a photo of your ID",
  "individual.address.line1": "your address",
  "individual.address.city": "your city",
  "individual.address.postal_code": "your ZIP code",
  "external_account": "a bank account",
  "individual.first_name": "your first name",
  "individual.last_name": "your last name",
  "individual.email": "your email",
  "individual.phone": "your phone number",
  "business_profile.url": "a website",
  "tos_acceptance.date": "accepting Stripe's terms",
};

function humanRequirements(keys: string[]): string[] {
  const out = new Set<string>();
  for (const k of keys) out.add(REQUIREMENT_LABELS[k] ?? k.replace(/[._]/g, " "));
  return [...out];
}

/**
 * Banks come back from Stripe SHOUTING — "JPMORGAN CHASE BANK, NA". Rendered as-is it reads like an
 * error message on a screen that's supposed to feel reassuring. Title-case it, drop the trailing
 * corporate suffix, and keep the initialisms that are genuinely uppercase.
 */
/** Initialisms that stay fully uppercase. */
const KEEP_UPPER = new Set(["USAA", "PNC", "BMO", "TD", "SVB", "BBVA", "HSBC", "ING", "UBS", "BNP", "US", "BECU", "SECU"]);
/** Connector words stay lowercase mid-name — "Bank of America", not "Bank Of America". */
const KEEP_LOWER = new Set(["of", "and", "the", "for", "at", "de", "del", "la", "y"]);
/** Brands whose real capitalisation no rule can derive. */
const BANK_BRANDS: Record<string, string> = {
  "jpmorgan": "JPMorgan",
  "jpmorgan chase bank": "JPMorgan Chase",
  "bancolombia": "Bancolombia",
  "bbva": "BBVA",
  "capital one": "Capital One",
  "suntrust": "SunTrust",
  "citibank": "Citibank",
  "usbank": "U.S. Bank",
  "us bank": "U.S. Bank",
  "navy federal credit union": "Navy Federal Credit Union",
};

function titleCaseBank(name?: string | null): string {
  if (!name) return "Your bank";
  const stripped = name
    .replace(/,?\s*(N\.?A\.?|NATIONAL ASSOCIATION|INC\.?|LLC)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const whole = BANK_BRANDS[stripped.toLowerCase()];
  if (whole) return whole;

  return stripped
    .split(" ")
    .map((w, i) => {
      const bare = w.replace(/[^A-Za-z]/g, "");
      const lower = bare.toLowerCase();
      if (KEEP_UPPER.has(bare.toUpperCase())) return w.toUpperCase();
      if (BANK_BRANDS[lower]) return BANK_BRANDS[lower];
      if (i > 0 && KEEP_LOWER.has(lower)) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export default function PayoutSetup({
  returnPath,
  onReady,
  onBeforeLeave,
  compact,
}: {
  /** Where Stripe sends them back to. Must start with "/". */
  returnPath: string;
  /** Fired when payouts are confirmed enabled, so a parent form can unblock its Send button. */
  onReady?: (ready: boolean) => void;
  /**
   * Last chance to persist anything before the page is torn down by the redirect. The contract form
   * uses this to snapshot everything the user has typed — a full-page hop to Stripe destroys React
   * state, and Lee lost a half-filled contract to exactly that.
   */
  onBeforeLeave?: () => void;
  /** Settings uses a tighter layout than the contract form. */
  compact?: boolean;
}) {
  const { lang } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);   // null = still checking
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preflight, setPreflight] = useState(false);
  const [approved, setApproved] = useState(false);
  const [justConnected, setJustConnected] = useState(false);   // drives the pop-in animation
  const [timingOpen, setTimingOpen] = useState(false);        // the collapsed "when do I get paid" detail

  const check = async (): Promise<Status | null> => {
    setStatus(null);
    try {
      const { data } = await supabase.functions.invoke("stripe-connect-status");
      const s = (data ?? {}) as Status;
      setStatus(s);
      onReady?.(!!(s.payouts_enabled ?? s.charges_enabled));
      return s;
    } catch {
      const s: Status = { has_account: false, payouts_enabled: false };
      setStatus(s);
      onReady?.(false);
      return s;
    }
  };

  useEffect(() => { check(); }, []);

  /**
   * Coming back from Stripe. We do NOT trust the redirect — a user can hit Back or bail halfway and
   * still land on ?success=1. We ask Stripe, and only celebrate if payouts are genuinely enabled.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const came = params.get("success") || params.get("refresh");
    if (!came) return;

    // Strip the params immediately so a refresh doesn't replay the celebration.
    params.delete("success"); params.delete("refresh");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));

    (async () => {
      const s = await check();
      if (s?.payouts_enabled ?? s?.charges_enabled) {
        setApproved(true);
        setJustConnected(true);
        setTimeout(() => setJustConnected(false), 1400);
      }
    })();
  }, []);

  /**
   * ---------- THE SPINNER MUST NEVER OUTLIVE THE JOURNEY ----------
   *
   * Lee, Jul 26 2026: "the button that says opening Stripe, you just have it still spinning...
   * the problem is if they never finish Stripe, or they exit out of Stripe, it's pending pending
   * pending and it's stuck. So they won't be able to [tap it] again."
   *
   * He's right, and the cause is the fix I made yesterday: `busy` is deliberately left true so the
   * spinner keeps running until the browser actually navigates. But there are three ways the
   * navigation never completes or gets undone, and in all of them the button stayed disabled forever
   * with no way out except a manual reload:
   *
   *   1. BACK FROM STRIPE. The browser restores this page from the back-forward cache, which restores
   *      the entire JS heap — including `busy === true`. `pageshow` with `persisted` is the only
   *      reliable signal for this, and it's exactly the case Lee hit.
   *   2. THEY LEFT AND CAME BACK another way (app switch, tab switch, Stripe opened in a new tab and
   *      they returned to this one). `visibilitychange` catches those.
   *   3. THE NAVIGATION NEVER STARTED. A blocked redirect or a dead network leaves us holding a URL
   *      the browser refused to follow. Nothing fires at all, so a timeout is the only backstop.
   *
   * So: a ref records that we asked to leave, three listeners undo the spinner when we're evidently
   * still here, and each one also re-checks the real Stripe status — because if they DID finish
   * onboarding, coming back is precisely the moment to find out.
   */
  const leaving = useRef(false);
  const leaveTimer = useRef<number | null>(null);

  /** Put the button back in the user's hands and find out what Stripe now thinks. */
  const recoverFromLeave = (why: string) => {
    if (!leaving.current) return;
    leaving.current = false;
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setBusy(false);
    console.log(`[PayoutSetup] back without completing Stripe (${why}) — re-enabling and re-checking`);
    // They may well have finished. Ask, and let the normal approved flow celebrate if so.
    (async () => {
      const s = await check();
      if (s?.payouts_enabled ?? s?.charges_enabled) {
        setApproved(true);
        setJustConnected(true);
        setTimeout(() => setJustConnected(false), 1400);
      }
    })();
  };

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) recoverFromLeave("bfcache restore"); };
    const onVisible = () => { if (document.visibilityState === "visible") recoverFromLeave("tab visible again"); };
    // `focus` is the crude catch-all for embedded webviews where neither of the above fires.
    const onFocus = () => recoverFromLeave("window focus");
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = async (mode: "onboard" | "manage") => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      try { onBeforeLeave?.(); } catch { /* never block the redirect on a save */ }
      const fn = mode === "onboard" ? "stripe-connect-onboard" : "stripe-connect-manage";
      const { data, error } = await supabase.functions.invoke(fn, { body: { returnPath } });
      const url = (data as any)?.url as string | undefined;
      if (url) {
        // Keep `busy` true on purpose so the spinner runs right up to the navigation — but arm the
        // recovery first, so "the navigation never happened" can't strand the button.
        leaving.current = true;
        leaveTimer.current = window.setTimeout(() => {
          if (!leaving.current) return;
          leaving.current = false;
          setBusy(false);
          setErr("Stripe didn't open. Check your connection and tap Set up payout again.");
        }, 12_000) as unknown as number;
        window.location.href = url;
        return;
      }
      setErr((data as any)?.error || await fnError(error, "Couldn't reach Stripe — try again in a moment."));
    } catch (e) {
      setErr(thrownError(e, "Couldn't reach Stripe — try again in a moment."));
    }
    setBusy(false);
  };

  /* Disconnect confirm state. Ported back from production 1 Aug 2026 — the rebuild had branched
     before this shipped and lost it, which left a connected payout account with no way off. On a
     money surface that is a one-way door, so it is not optional. */
  const [askDisconnect, setAskDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectErr, setDisconnectErr] = useState("");

  const ready = !!(status?.payouts_enabled ?? status?.charges_enabled);
  const stillNeeds = humanRequirements(status?.requirements_currently_due ?? []);

  /**
   * ---------- WHAT IF STRIPE HASN'T APPROVED THEM? ----------
   *
   * Lee, Jul 26 2026: "we also need to factor in what happens if Stripe has not approved their
   * account. Then what does it say? And what happens? Does the user continue as normal, or do they
   * pause? ...how do we plan for those edge cases?"
   *
   * THE ANSWER, and it's a good one: YES, THEY CAN WORK. The client's card is charged by OneJob's own
   * platform account, and on acceptance the money is captured into OneJob's balance. None of that
   * touches the pro's Connect account. So a pro whose verification is still pending can accept a job,
   * do the work, and the money is collected into the Vault the entire time — the only thing waiting
   * on Stripe is the last hop out of the holding balance into their bank. `capture-contract-payment` already
   * handles this: no Connect account yet means `pending_connect`, funds stay held, and the
   * nightly sweep releases them once payouts switch on. Nothing is lost and nothing is at risk.
   *
   * What we must NOT do is flatten the three not-yet states into one hopeful "hang tight", which is
   * what this component used to do:
   *   action_needed — STRIPE IS WAITING ON THEM. Nothing will ever happen on its own. Say so.
   *   under_review  — Stripe is genuinely checking. Waiting is the correct action.
   *   blocked       — payouts are disabled for a real reason. They need help, not patience.
   * Telling someone "nothing is blocked" while Stripe sits waiting on their SSN is how a pro finishes
   * a job and only then discovers their money can't move.
   */
  const state: NonNullable<Status["payout_state"]> =
    status?.payout_state ??
    (ready ? "ready"
      : (status?.requirements_currently_due?.length ? "action_needed"
        : status?.details_submitted ? "under_review"
          : "not_started"));
  const needsNow = humanRequirements([
    ...(status?.requirements_past_due ?? []),
    ...(status?.requirements_currently_due ?? []),
  ]);

  /** The same reassurance in all three not-ready states, because it's true in all three. */
  const moneySafetyLine = (
    <p className="mt-2.5 rounded-xl bg-brand/[0.08] px-3 py-2.5 text-[11.5px] leading-relaxed">
      <strong>You can still take jobs right now.</strong> When a client accepts, their payment is
      collected and held by OneJob — it doesn't pass through your Stripe account. The only thing
      waiting on Stripe is the final transfer into your bank, and it goes out automatically the moment
      payouts switch on. Nothing is lost by starting work today.
    </p>
  );

  return (
    <>
      <div className={`${compact ? "p-4" : "p-4"} ${
        status === null ? "rounded-2xl border border-ink/10 bg-ink/[0.03] dark:border-white/10 dark:bg-white/[0.04]"
        : ready ? `oj-payout-ok ${justConnected ? "oj-pop" : ""}`
        : "oj-payout-todo"}`}>

        {status === null ? (
          <p className="flex items-center gap-2.5 text-sm font-semibold opacity-70">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            Checking your payout setup…
          </p>
        ) : ready ? (
          /* Centered, one fact per line, quiet eyebrow over a clear headline — Lee's layout notes,
             Jul 26 2026. Facts sit on their own lines because someone scanning this wants to answer
             three separate questions: am I good, where's it going, and when do I see it. */
          <div className="text-center">
            <p className="oj-eyebrow oj-eyebrow--state">Payouts approved</p>
            <p className="mt-1 text-[17px] font-extrabold leading-snug">You're ready to get paid</p>

            {status?.bank_last4 && (
              <div className="mt-3 space-y-0.5">
                <p className="text-sm font-semibold">{titleCaseBank(status.bank_name)}</p>
                <p className="text-sm opacity-70">Account ending in {status.bank_last4}</p>
              </div>
            )}

            {/* The timing detail is real but it made this panel tall. Collapsed by default behind a
                full-size chevron (Lee: "make all that collapsible... it needs to be one of the
                bigger expands"). One line visible, the rest a tap away. */}
            <button onClick={() => setTimingOpen((v) => !v)}
              aria-expanded={timingOpen}
              className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-semibold opacity-70">
              <span>When do I get my money?</span>
              <Chevron size="sm" open={timingOpen} />
            </button>
            {timingOpen && (
              <div className="mx-auto mt-2 max-w-[36ch] space-y-2 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-left text-[11.5px] leading-relaxed dark:bg-white/[0.06]">
                {/* Timing now comes from the pro's own country instead of a hardcoded "2 business
                    days" that was only ever true in the US. A Colombian pro reading "2 business
                    days" and waiting three is a small lie that costs a lot of trust on the one
                    screen where trust is the product. See src/lib/payoutTiming.ts. */}
                {payeeTimingLines(status?.country).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                {/*
                  INSTANT PAYOUT IS GATED ON THE COUNTRY STRIPE ACTUALLY OFFERS IT IN.

                  This block used to render for everyone: "Want it faster? …instant payout… for a
                  2.99% fee." **Stripe does not offer Instant Payouts in Colombia** — it isn't on
                  their supported list, and no debit card changes that. So the app's launch market
                  was being sold, on its own payouts screen, a product it cannot buy.

                  The 2.99% isn't invented (Lee priced it off dLocal's ~1.9% instant fee, doubled —
                  "as long as that covers the 1.5% Stripe charges us, we make 100% on that resell").
                  It is simply not a Stripe reality outside the supported list today. Re-introduce it
                  everywhere once dLocal confirms Bre-B pricing; verify the 1.9% with dLocal sales
                  before quoting any number.
                */}
                {instantPayoutAvailable(status?.country) && (
                  status?.has_debit_card ? (
                    <p>
                      Want it faster? Your debit card is on file, so you can take an{" "}
                      <strong>instant payout</strong> — usually within <strong>30 minutes</strong>, any day
                      of the week, for a <strong>2.99% fee</strong> on the amount you cash out.
                    </p>
                  ) : (
                    <p>
                      Want it faster? Add a <strong>debit card</strong> to unlock{" "}
                      <strong>instant payouts</strong> — usually within <strong>30 minutes</strong>, any day
                      of the week, for a <strong>2.99% fee</strong> on the amount you cash out.
                    </p>
                  )
                )}
              </div>
            )}

            {!!stillNeeds.length && (
              <p className="mt-3 rounded-xl bg-amber-400/15 px-3 py-2 text-[11px] leading-snug">
                Stripe will need {stillNeeds.join(" and ")} before long to keep payouts running.
                Takes a minute — tap Manage below.
              </p>
            )}

            <button onClick={() => go("manage")} disabled={busy}
              className="mt-3.5 text-xs font-medium text-brand underline underline-offset-2 disabled:opacity-50">
              {busy ? W(lang, "Opening…", "Abriendo…") : "Manage payout details or change bank →"}
            </button>

            {/* ── Stop receiving payouts ──────────────────────────────────────────────────
                Deliberately understated until tapped: this is destructive, and a red button
                sitting permanently under "you're all set" makes a working setup feel fragile.
                The confirm names exactly what does and does not happen — people hesitate here
                because they think we are deleting their Stripe account, and we are not. */}
            <div className="mt-3 border-t border-ink/10 pt-3 dark:border-white/10">
              {askDisconnect ? (
                <div className="rounded-xl bg-ink/[0.04] p-3 dark:bg-white/[0.06]">
                  <p className="text-xs font-bold">Stop sending payouts to this account?</p>
                  <p className="mt-1 text-[11px] leading-relaxed opacity-70">
                    OneJob will stop paying out to it and you’ll show as not set up until you
                    connect an account again. Your Stripe account itself isn’t deleted — any
                    balance and records stay there.
                  </p>
                  {disconnectErr && (
                    <p className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-500">
                      {disconnectErr}
                    </p>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <button onClick={() => { setAskDisconnect(false); setDisconnectErr(""); }}
                      disabled={disconnecting}
                      className="flex-1 rounded-lg bg-ink/5 py-2 text-[11px] font-bold disabled:opacity-50 dark:bg-white/10">
                      Keep it
                    </button>
                    <button disabled={disconnecting}
                      onClick={async () => {
                        setDisconnecting(true); setDisconnectErr("");
                        const { error } = await supabase.rpc("disconnect_payout");
                        setDisconnecting(false);
                        if (error) { setDisconnectErr(error.message || "Couldn't disconnect just now."); return; }
                        setAskDisconnect(false);
                        /* Re-ask Stripe rather than assuming — same rule the redirect path follows. */
                        await check();
                      }}
                      className="flex-1 rounded-lg bg-red-500 py-2 text-[11px] font-bold text-white disabled:opacity-50">
                      {disconnecting ? "…" : "Disconnect"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAskDisconnect(true); setDisconnectErr(""); }}
                  className="text-[11px] font-medium opacity-45 underline underline-offset-2 transition hover:opacity-80">
                  Stop receiving payouts here
                </button>
              )}
            </div>
          </div>
        ) : state === "action_needed" ? (
          /* STRIPE IS WAITING ON THE USER. This must never read like "hang tight" — nothing happens
             until they go back and finish. The missing items are named in plain words. */
          <>
            <p className="oj-eyebrow !text-amber-600 dark:!text-amber-400">Stripe needs one more thing</p>
            <p className="mt-1 text-[15px] font-extrabold leading-snug">Your payouts are waiting on you</p>
            <p className="mt-1.5 text-xs leading-relaxed opacity-75">
              {needsNow.length
                ? <>Stripe still needs <strong>{needsNow.join(", ")}</strong>. Payouts stay off until you add it — this won't resolve on its own.</>
                : <>Stripe needs a little more information before it can turn payouts on. It won't resolve on its own.</>}
            </p>
            {moneySafetyLine}
            <button onClick={() => go("manage")} disabled={busy}
              className="oj-btn-glass mt-3.5 flex items-center justify-center gap-2">
              {busy && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {busy ? W(lang, "Opening Stripe…", "Abriendo Stripe…") : "Finish with Stripe"}
            </button>
            <button onClick={() => check()} className="mt-2.5 w-full text-xs font-medium text-brand underline underline-offset-2">
              I've already done it — check again
            </button>
          </>
        ) : state === "blocked" ? (
          /* Payouts are disabled for a reason that isn't a missing field. Patience won't fix this, so
             we don't ask for patience — we point at the two things that actually can. */
          <>
            <p className="oj-eyebrow !text-red-500">Payouts are on hold</p>
            <p className="mt-1 text-[15px] font-extrabold leading-snug">Stripe couldn't verify this account</p>
            <p className="mt-1.5 text-xs leading-relaxed opacity-75">
              Stripe has paused payouts on your account{status?.disabled_reason ? <> (<code className="text-[10px]">{status.disabled_reason}</code>)</> : null}.
              Open your Stripe dashboard to see what they're asking for, or email us and we'll look at it with you.
            </p>
            {moneySafetyLine}
            <div className="mt-3.5 flex flex-col gap-2.5">
              <button onClick={() => go("manage")} disabled={busy}
                className="oj-btn-glass flex items-center justify-center gap-2">
                {busy && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {busy ? W(lang, "Opening Stripe…", "Abriendo Stripe…") : W(lang, "Open my Stripe dashboard", "Abrir mi panel de Stripe")}
              </button>
              <a href="mailto:support@oneworldlabs.ai?subject=Payouts%20on%20hold"
                className="text-center text-xs font-medium text-brand underline underline-offset-2">
                Email support@oneworldlabs.ai
              </a>
            </div>
          </>
        ) : state === "under_review" ? (
          /* Stripe is genuinely working on it. Waiting IS the right action here — so say how long,
             and say what they can do meanwhile. */
          <>
            <p className="oj-eyebrow">Stripe is reviewing</p>
            <p className="mt-1 text-[15px] font-extrabold leading-snug">You've submitted everything</p>
            <p className="mt-1.5 text-xs leading-relaxed opacity-75">
              Payouts switch on once Stripe finishes checking your details — usually a few minutes,
              occasionally up to a day. There's nothing else for you to do.
            </p>
            {/* Lee, Jul 26 2026: "make sure we have a notice ready in case the people's account stays
                pending... so they know what's going on in case it doesn't get auto approved." Most
                accounts clear in minutes, so the real gap was telling someone what "still pending
                tomorrow" means and who to ask. Silence is what makes people assume they've been
                rejected. */}
            <p className="mt-2.5 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-[11px] leading-relaxed dark:bg-white/[0.06]">
              <strong>Still pending after a day?</strong> That usually means Stripe wants one more
              detail — tap Review my details to see it. If it looks complete and nothing has changed,
              email <a href="mailto:support@oneworldlabs.ai" className="text-brand underline">support@oneworldlabs.ai</a>{" "}
              and we'll chase it with Stripe for you. You won't lose any money that's already been collected for a job.
            </p>
            {moneySafetyLine}
            <div className="mt-3 flex gap-3">
              <button onClick={() => check()} className="text-xs font-bold text-brand underline">Check again</button>
              <button onClick={() => go("manage")} disabled={busy} className="text-xs font-bold text-brand underline disabled:opacity-50">
                {busy ? W(lang, "Opening…", "Abriendo…") : "Review my details →"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[15px] font-extrabold">Set up your payout to get paid</p>
            <p className="mt-1.5 text-xs leading-relaxed opacity-70">
              About two minutes with Stripe, our payments partner. Everything you've typed here is saved.
            </p>
            <button onClick={() => setPreflight(true)} disabled={busy}
              className="oj-btn-glass mt-3.5 flex items-center justify-center gap-2">
              {busy && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {busy ? W(lang, "Opening Stripe…", "Abriendo Stripe…") : "Set up payout"}
            </button>
          </>
        )}

        {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
      </div>

      {/* ---------- BRIEFING, before we hand them to a stranger's form ---------- */}
      {preflight && createPortal(
        <div className="fixed inset-0 z-[195] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Before you continue to Stripe">
          <div className="absolute inset-0 bg-black/55" onClick={() => setPreflight(false)} />
          <div className="oj-pop oj-glass-modal relative max-h-[92vh] w-full max-w-sm overflow-y-auto p-7">
            <h2 className="text-[22px] font-extrabold leading-snug">Here's what happens next</h2>
            {/* The "about 2 minutes" fact lives INSIDE the sentence now. On its own as an eyebrow it
                read as a label with no referent — Lee: "it's not clear what that even means." */}
            <p className="mt-2.5 text-sm leading-relaxed opacity-75">
              We'll hand you to <strong>Stripe</strong>, who handles the money for OneJob. It's about a
              <strong> two-minute</strong> process, and they'll ask you to:
            </p>

            <ol className="mt-5 space-y-4 text-sm">
              {[
                ["1", "Confirm your name, address and phone",
                  "Has to match your bank — it's how they know it's really you."],
                ["2", "Add your ID number",
                  status?.country && status.country !== "US"
                    ? "Your national ID number. If it can't be verified, Stripe accepts a photo of your ID instead."
                    : "An SSN, ITIN or EIN all work. If none can be verified, Stripe accepts a photo of your ID instead."],
                ["3", "Connect a bank account or debit card",
                  // The instant-payout half of this sentence is false wherever Stripe doesn't offer
                  // Instant Payouts — including Colombia, the launch market. The collapsed panel below
                  // already gates it; this modal is the screen MORE pros see, and it was still
                  // promising it to everyone, right before they hand over their ID.
                  instantPayoutAvailable(status?.country)
                    ? "Either one works. A debit card also unlocks instant payouts."
                    : "Either one works — whichever you'd rather be paid into."],
                ["4", "Solve a quick security puzzle",
                  "A CAPTCHA or two. Normal — nothing to worry about."],
              ].map(([n, head, sub]) => (
                <li key={n} className="flex gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[12px] font-extrabold text-brand">{n}</span>
                  <span>
                    <span className="block font-semibold leading-snug">{head}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed opacity-60">{sub}</span>
                  </span>
                </li>
              ))}
            </ol>

            {/* Sets the expectation that Stripe's closing screen is not the verdict — ours is. */}
            <p className="mt-5 rounded-2xl bg-brand/[0.08] px-3.5 py-3 text-[12px] leading-relaxed">
              At the end, Stripe will tell you they're <strong>reviewing your information</strong>, then
              route you back to this screen. We'll check your status right away and tell you whether
              you're approved.
            </p>

            {/* HOW FAST YOU'LL ACTUALLY BE PAID — said BEFORE they hand over their ID, not after.
                Lee, Jul 27 2026: "the notice they see before they enter Stripe… definitely for the
                payee." A pro who learns about a 7-day first payout only once they're waiting on one
                concludes the platform is broken. Told up front, it's just a fact about Stripe.
                Both numbers come from their own country, never a hardcoded US figure. */}
            <div className="mt-3 space-y-2 rounded-2xl border border-ink/10 px-3.5 py-3 text-left text-[12px] leading-relaxed dark:border-white/12">
              <p className="text-[11px] font-extrabold uppercase tracking-wide opacity-55">How fast you get paid</p>
              {payeeTimingLines(status?.country).map((line, i) => (
                <p key={i} className="opacity-80">{line}</p>
              ))}
              <p className="opacity-60">
                That last step is Stripe's schedule, not OneJob's — the money is already yours by then.
              </p>
            </div>

            <button onClick={() => { setPreflight(false); go("onboard"); }} className="oj-btn-glass mt-6">
              Got it — continue to Stripe
            </button>
            {/* Plain underlined text, not a second box. A full-width button for "no thanks" gave a
                minor choice the same visual weight as the main one, and ate vertical space. */}
            <div className="mt-4 text-center">
              <button onClick={() => setPreflight(false)}
                className="text-sm font-medium text-ink/60 underline underline-offset-2 dark:text-white/60">
                Not right now
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ---------- THE DEFINITIVE ANSWER STRIPE NEVER GIVES ---------- */}
      {approved && createPortal(
        <div className="fixed inset-0 z-[196] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Payouts approved">
          <div className="absolute inset-0 bg-black/55" onClick={() => setApproved(false)} />
          <div className="oj-pop oj-glass-modal relative w-full max-w-sm p-7 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand/15 text-4xl text-brand">✓</div>
            <h2 className="mt-4 text-2xl font-extrabold leading-snug">You're approved</h2>
            {/* "Verified" is a banned word unless we ran a check to some standard — we didn't, Stripe
                did, and `payouts_enabled: true` with outstanding `requirements_pending_verification`
                is a perfectly normal Stripe state. Claim only what is true: payouts are on. */}
            <p className="mt-2 text-sm leading-relaxed opacity-75">
              Your payout account is <strong>active</strong>
              {!stillNeeds.length && !(status?.requirements_pending_verification?.length)
                ? <> — nothing is pending and nothing is being reviewed. You can get paid right now.</>
                : <> and you can get paid right now. Stripe still wants a couple of details from you when you get a chance.</>}
            </p>
            {status?.bank_last4 && (
              <div className="mt-3 rounded-xl bg-ink/[0.04] px-3 py-2.5 dark:bg-white/[0.06]">
                <p className="text-sm font-semibold">{titleCaseBank(status.bank_name)}</p>
                <p className="text-sm opacity-70">Account ending in {status.bank_last4}</p>
              </div>
            )}
            {/* Same country-sourced facts as the collapsed panel above — the approval moment is
                exactly when a pro forms their expectation of how fast this is, so it must not be a
                US-only number read by a Colombian. */}
            <p className="mt-3 text-xs leading-relaxed opacity-65">
              Money arrives in your bank {payoutTiming(status?.country).ongoing} after a job is marked
              complete by both sides. Your first payout takes longer — a one-time check Stripe runs on
              every new account.
            </p>
            <button onClick={() => setApproved(false)} className="oj-btn-glass mt-6">Got it</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
