import { useEffect, useState } from "react";
import { supabase } from "@job/lib/supabase";
import { fmtDateTimeFull, fmtArrivalDay } from "@job/lib/datetime";
import MoneyPlaceIcon, { type MoneyPlace } from "@job/components/MoneyIcons";
import Chevron from "@job/components/Chevron";
import { payoutTiming, payerTimingLines } from "@job/lib/payoutTiming";

import { useI18n, W } from "@job/lib/i18n";
/**
 * WHERE IS MY MONEY? — the seven-step money map, shown at the bottom of every paid contract.
 *
 * Lee, Jul 26 2026: "there should be a little meter... a timeline that shows where the money is.
 * Payer funds authorized. Contract accepted by payee. Funds captured from payer, moved into OneJob's
 * third-party account. Job marked completed by payee, and job marked completed by payer. Funds have
 * moved into the payee's Stripe account. And then the last step is that money has moved from the
 * Stripe account to the payee's bank. It should be on the contract, probably at the very bottom."
 *
 * Lee, Jul 27 2026, on why this file gets more attention than any other: "whatever is happening in
 * Stripe needs to be reflected accurately… we can't be showing that the money is in one place and
 * actually is somewhere else."
 *
 * This is the single most trust-critical piece of UI in the product. A marketplace asks a stranger to
 * hand over money for work that hasn't happened yet, and asks another stranger to do work before
 * being paid. Both of them will ask "where is it right now?" — and until this existed the honest
 * answer was "somewhere in Stripe, trust us."
 *
 * ---------------------------------------------------------------------------------------------
 * THE FOUR PLACES. The rail is not seven equal beads; it is money moving between four real
 * locations, and the copy has to name which one it is in without flattering us:
 *
 *   1. THE CLIENT'S CARD      — authorized only. Nothing has been taken. It is still their money.
 *   2. THE ONEJOB VAULT       — collected and held by OneJob. Neither side can reach it.
 *   3. THE PRO'S OWN STRIPE   — released. This is NOT the Vault. OneJob does not hold it any more,
 *      BALANCE                  it is simply not in a bank yet. Lee is explicit that the copy must
 *                               stop implying we're holding it the moment it lands here.
 *   4. THE PRO'S BANK         — out of every platform, into a real account.
 *
 * ---------------------------------------------------------------------------------------------
 * EVERY ROW IS BACKED BY A REAL TIMESTAMP COLUMN. Nothing here is inferred from status strings, and
 * nothing is drawn as done unless the database says the thing actually happened:
 *   authorized_at  · the card authorization succeeded (money still theirs)
 *   accepted_at    · the payee accepted
 *   captured_at    · we captured — funds are now in OneJob's balance, i.e. the Vault
 *   payee_done_at  · the pro marked it complete
 *   payer_done_at  · the client marked it complete
 *   released_at    · transferred out to the payee's Stripe (Connect) account
 *   paid_out_at    · Stripe paid it into the payee's bank
 *
 * `payment_status` is deliberately NOT trusted for any of this. Four legacy rows carry
 * payment_status='released' with a NULL released_at and no completions at all ("Dch", "Ddd",
 * "Test 333", "Lawn care"); a panel that believed the status string would tell those users their
 * money had moved when nothing ever happened.
 *
 * ---------------------------------------------------------------------------------------------
 * THE BANK LEG IS NOW REAL (Jul 27 2026). `paid_out_at`, `payout_arrival_date` and `payout_status`
 * are written by the `payout.*` handlers in `onejob-stripe-webhook` v3. Before that, step 7 was a
 * dead informational row that could never turn green no matter how long ago the money landed.
 *
 * And the DATE on that step is Stripe's, never ours. Lee: "say, hey, you're scheduled to stay there
 * for up to seven days, or we'll release it at 4:19 AM… whatever timing Stripe can feed back."
 * So: `payout.arrival_date` once a payout exists, and the connected account's own
 * `settings.payouts.schedule` before one does. Nothing in this file hardcodes a number of days.
 *
 * That matters more than it sounds. The handoff notes said a Colombian payout waits ~7 days and a
 * US one ~2. The live accounts say otherwise — US is daily/delay_days 2, Colombia is daily/
 * delay_days 0 — which is exactly why a hardcoded sentence would have been a lie by August.
 */

type Row = {
  key: string;
  label: string;
  detail: string;
  at?: string | null;
  /** Which of the four money locations this step is about. Drives the icon on the rail. */
  place: MoneyPlace;
  /** Shown instead of `detail` once this step is done. */
  doneDetail?: string;
  /** An extra, quieter line under the detail — used for the real scheduled date. */
  note?: string | null;
  /** Render as a quiet fact rather than a step we're tracking. */
  informational?: boolean;
  /** Deep-link into Stripe for this step, when the user can verify it there themselves. */
  stripe?: boolean;
  /** Something went wrong at this step — draw it amber rather than teal. */
  problem?: boolean;
};

type ConnectRow = {
  payout_interval: string | null;
  payout_delay_days: number | null;
  payout_weekly_anchor: string | null;
  payout_monthly_anchor: number | null;
  bank_name: string | null;
  bank_last4: string | null;
  country: string | null;
  payouts_enabled: boolean | null;
};

/**
 * Stripe's payout schedule, said out loud, from the account's own settings.
 * "daily, 2 days after each payment settles" · "every Friday" · "on the 1st of each month".
 * Returns "" when we genuinely don't know — an empty string is better than a plausible invention.
 */
function describeSchedule(c: ConnectRow | null): string {
  if (!c?.payout_interval) return "";
  const delay = typeof c.payout_delay_days === "number" ? c.payout_delay_days : null;
  const after =
    delay === null ? ""
    : delay === 0 ? ", as soon as each payment settles"
    : delay === 1 ? ", 1 day after each payment settles"
    : `, ${delay} days after each payment settles`;
  switch (c.payout_interval) {
    case "manual":
      return "Stripe holds this in your balance until you ask for a payout.";
    case "daily":
      return `Stripe pays your bank daily${after}.`;
    case "weekly": {
      const day = c.payout_weekly_anchor
        ? c.payout_weekly_anchor.charAt(0).toUpperCase() + c.payout_weekly_anchor.slice(1)
        : "week";
      return `Stripe pays your bank every ${day}${after}.`;
    }
    case "monthly": {
      const d = c.payout_monthly_anchor;
      const ord = d === 1 ? "1st" : d === 2 ? "2nd" : d === 3 ? "3rd" : d ? `${d}th` : "month";
      return `Stripe pays your bank on the ${ord} of each month${after}.`;
    }
    default:
      return "";
  }
}

export default function MoneyTimeline({
  ag,
  youAre,
  className = "",
}: {
  ag: {
    payment_rail?: string | null;
    payment_status?: string | null;
    payment_amount?: number | null;
    currency?: string | null;
    authorized_at?: string | null;
    accepted_at?: string | null;
    captured_at?: string | null;
    payee_done_at?: string | null;
    payer_done_at?: string | null;
    released_at?: string | null;
    paid_out_at?: string | null;
    expired_at?: string | null;
    payout_arrival_date?: string | null;
    payout_status?: string | null;
    payout_failure_message?: string | null;
    /**
     * MONEY THAT CAME BACK. The webhook writes all three and, until Jul 27 2026, this panel read
     * none of them — so a fully refunded contract went on saying "$X is in the OneJob Vault. Neither
     * side can touch it" forever, because `captured_at` is never cleared. That is precisely the
     * "money is in one place and actually is somewhere else" failure this component exists to
     * prevent, and it was sitting in the component itself.
     */
    refunded_at?: string | null;
    transfer_reversed_at?: string | null;
    dispute_status?: string | null;
  };
  /** Changes the wording only — the steps and their order are identical for both sides. */
  youAre?: "payer" | "payee" | null;
  className?: string;
}) {
  const { lang } = useI18n();
  // Hooks first, unconditionally — the "no money to track" bail-out below must not sit above them or
  // React's hook order breaks on the first free/external contract rendered.
  const [stripeBusy, setStripeBusy] = useState(false);
  const [stripeErr, setStripeErr] = useState("");
  const [connect, setConnect] = useState<ConnectRow | null>(null);
  const [whatNextOpen, setWhatNextOpen] = useState(false);

  const isPayee = youAre === "payee";

  /**
   * The pro's own payout schedule, read from their own row (RLS: a user can only ever see their own
   * connect account). A payer never loads this — the pro's bank and cadence are the pro's business,
   * and the payer gets the arrival DATE off the shared contract instead, which is about their job.
   */
  useEffect(() => {
    if (!isPayee) { setConnect(null); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("stripe_connect_accounts")
        .select("payout_interval, payout_delay_days, payout_weekly_anchor, payout_monthly_anchor, bank_name, bank_last4, country, payouts_enabled")
        .maybeSingle();
      if (alive) setConnect((data as ConnectRow) ?? null);
    })();
    return () => { alive = false; };
  }, [isPayee]);

  // Contracts with no card behind them have no money to track, and drawing a seven-step journey for
  // them would be a lie. "external" = settled off-platform; "promo" = free via a founder code, where
  // nothing is ever charged, captured or paid out.
  // A contract with no card behind it has no money to track. "external" = settled off-platform;
  // "promo" = free via a founder code. The third case was missing and is the common one: a contract
  // that was never paid for at all — no rail, no amount, no authorization. It rendered the full
  // seven-step map with "Now" on "A hold goes on your card — nothing is taken yet", narrating a card
  // hold that does not exist and never will.
  const nothingToTrack =
    ag.payment_rail === "external" ||
    ag.payment_rail === "promo" ||
    (!ag.authorized_at && !ag.captured_at && ag.payment_amount == null);

  // Both sides have said the job is done, and the money still hasn't left. Until Jul 27 2026 the
  // release row went on promising "released the moment both of you have marked it complete" in that
  // state — describing, in the present tense, a thing that had visibly already failed to happen.
  // Johana Vigo's contract sat exactly here for four days. In a panel whose header promises that
  // nothing is a guess, the honest move is to name what's actually holding it.
  const refundedEarly = !!ag.refunded_at;
  const reversedEarly = !!ag.transfer_reversed_at;
  const bothMarkedComplete = !!ag.payee_done_at && !!ag.payer_done_at;
  const releaseStalled = bothMarkedComplete && !ag.released_at && !refundedEarly && !reversedEarly;
  /**
   * WHY it's stalled is only stated when we actually know why.
   *
   * The panel used to assert a cause as fact — "It can't be sent until your payout account is
   * finished" — from nothing but "both stamps set, no release". But the webhook also freezes released
   * contracts on `charge.dispute.created`, and a reversal produces the same shape. A pro whose payouts
   * are fully enabled and whose job is frozen by a client's chargeback was being told their own
   * paperwork was the problem, on a panel headed "nothing here is a guess". `connect.payouts_enabled`
   * is already loaded; use it, and fall back to a neutral sentence when it isn't the cause.
   */
  const payoutSetupIsTheBlocker = releaseStalled && connect?.payouts_enabled === false;

  const amount = ag.payment_amount != null
    ? new Intl.NumberFormat("en", {
        style: "currency",
        currency: ag.currency || "USD",
        // COP is quoted in whole pesos everywhere in Colombia; forcing ".00" onto 400,000 reads as a
        // conversion error to the exact users this market is being built for.
        maximumFractionDigits: Number.isInteger(ag.payment_amount) ? 0 : 2,
      }).format(ag.payment_amount)
    : null;

  const payoutFailed = ag.payout_status === "failed" || ag.payout_status === "canceled";
  /**
   * A FAILED PAYOUT IS NOT A PAID PAYOUT, even if `paid_out_at` is still stamped.
   *
   * Stripe can send `payout.updated` carrying `status: "failed"`, and webhooks can arrive out of
   * order, so the two columns can genuinely disagree. When they do, the failure is the newer truth:
   * the money bounced back into the pro's Stripe balance. Reading `paid_out_at` on its own put
   * "In your bank — Bancolombia ••••9761 · It's yours and it's out of Stripe" directly above an amber
   * banner saying Stripe couldn't pay it. Everything below reads the failure-aware value.
   */
  const paidOutAt = payoutFailed ? null : ag.paid_out_at;
  const payoutInTransit = !!ag.payout_arrival_date && !paidOutAt && !payoutFailed;

  /** The money came back out. Refund → the client's card. Reversal → clawed back off the pro. */
  const refunded = !!ag.refunded_at;
  const reversed = !!ag.transfer_reversed_at;
  const cameBack = refunded || reversed;

  /* ---------------------------------------------------------------------- *
   * WHERE IS IT RIGHT NOW — one of the four places, decided only from stamps.
   * ---------------------------------------------------------------------- */
  const bankLabel = connect?.bank_name
    ? `${connect.bank_name}${connect.bank_last4 ? ` ••••${connect.bank_last4}` : ""}`
    : "the bank";

  // A refund or a reversal OVERRIDES everything below it — the money physically moved back, and the
  // forward-progress stamps are now history rather than a description of where it is.
  const nowPlace: MoneyPlace | null =
    refunded ? "card"
    : reversed ? "vault"
    : paidOutAt ? "bank"
    : ag.released_at ? "balance"
    : ag.captured_at ? "vault"
    : ag.authorized_at ? "card"
    : null;

  const nowHeadline =
    refunded ? (isPayee ? W(lang, "Refunded to the client", "Reembolsado al cliente") : W(lang, "Refunded to your card", "Reembolsado a tu tarjeta"))
    : reversed ? W(lang, "Pulled back from the professional", "Retirado del profesional")
    : nowPlace === "bank" ? (isPayee ? `In your bank — ${bankLabel}` : W(lang, "Paid into the professional's bank", "Depositado en el banco del profesional"))
    : nowPlace === "balance" ? (isPayee ? W(lang, "In your own Stripe balance", "En tu propio saldo de Stripe") : W(lang, "In the professional's own Stripe balance", "En el saldo de Stripe del profesional"))
    : nowPlace === "vault" ? W(lang, "In the OneJob Vault", "En la Bóveda de OneJob")
    : nowPlace === "card" ? (isPayee ? W(lang, "Held on the client's card", "Retenido en la tarjeta del cliente") : W(lang, "Held on your card", "Retenido en tu tarjeta"))
    : "";

  const nowSub =
    refunded ? (isPayee
        ? "This payment was refunded. Nothing is being held for you on this job."
        : "This payment was refunded to the card you paid with. Your bank decides how quickly it shows up.")
    : reversed ? (isPayee
        ? "This payout was reversed after a dispute or refund. It is no longer in your Stripe balance."
        : W(lang, "The professional's payout was reversed.", "El pago al profesional fue revertido."))
    : nowPlace === "bank" ? (isPayee ? W(lang, "It's yours and it's out of Stripe.", "Es tuyo y ya salió de Stripe.") : W(lang, "OneJob is not holding anything.", "OneJob ya no retiene nada."))
    : nowPlace === "balance" ? (isPayee
        ? W(lang, "OneJob no longer holds this — it's yours, it just isn't in a bank yet.", "OneJob ya no retiene esto — es tuyo, solo que todavía no está en un banco.")
        : W(lang, "OneJob no longer holds this. It belongs to the professional, in their own Stripe account.", "OneJob ya no retiene esto. Es del profesional, en su propia cuenta de Stripe."))
    : nowPlace === "vault" ? W(lang, "Collected and held by OneJob. Neither of you can touch it.", "Cobrado y resguardado por OneJob. Ninguno de los dos puede tocarlo.")
    : nowPlace === "card" ? W(lang, "Authorized only. Nothing has been taken yet.", "Solo autorizado. Todavía no se ha cobrado nada.")
    : "";

  const nowAt =
    refunded ? ag.refunded_at
    : reversed ? ag.transfer_reversed_at
    : nowPlace === "bank" ? paidOutAt
    : nowPlace === "balance" ? ag.released_at
    : nowPlace === "vault" ? ag.captured_at
    : nowPlace === "card" ? ag.authorized_at
    : null;

  /* ---------------------------------------------------------------------- *
   * THE SCHEDULED NEXT STEP — a real date from Stripe, or nothing at all.
   * ---------------------------------------------------------------------- */
  let bankNote: string | null = null;
  if (paidOutAt) {
    bankNote = isPayee && connect?.bank_name ? `Sent to ${bankLabel}.` : null;
  } else if (payoutFailed) {
    bankNote = ag.payout_failure_message
      ? `Stripe couldn't complete it: ${ag.payout_failure_message}`
      : "Stripe couldn't complete this payout. The money is still yours, sitting in your Stripe balance.";
  } else if (ag.payout_arrival_date) {
    bankNote = `Scheduled to arrive ${fmtArrivalDay(ag.payout_arrival_date)}.`;
  } else if (ag.released_at && isPayee) {
    // No payout exists yet, so there is no real date to show. The next most honest thing is the
    // account's OWN schedule, plus the one-time hold on a brand-new account — named as one-time,
    // because an earlier round described that 7-day check as though every Colombian payout waited a
    // week, which makes the product look four times slower than it is.
    const s = describeSchedule(connect);
    const first = payoutTiming(connect?.country).firstPayout;
    bankNote = [s, first ? `If this is your first payout, Stripe holds it ${first} while it checks a new account — once only.` : null]
      .filter(Boolean).join(" ") || null;
  }

  const rows: Row[] = [
    {
      key: "authorized",
      label: W(lang, "Payment authorized", "Pago autorizado"),
      at: ag.authorized_at,
      place: "card",
      detail: isPayee ? W(lang, "Waiting for the client's card to be authorized.", "Esperando que se autorice la tarjeta del cliente.") : W(lang, "A hold goes on your card — nothing is taken yet.", "Se hace una retención en tu tarjeta — todavía no se cobra nada."),
      doneDetail: isPayee ? W(lang, "The client's card is authorized — the money is committed.", "La tarjeta del cliente está autorizada — el dinero está comprometido.") : W(lang, "Held on your card. Not charged yet.", "Retenido en tu tarjeta. Aún sin cobrar."),
    },
    {
      key: "accepted",
      label: W(lang, "Contract accepted", "Contrato aceptado"),
      at: ag.accepted_at,
      place: "handshake",
      detail: isPayee ? W(lang, "Accept to start the job.", "Acepta para iniciar el trabajo.") : W(lang, "Waiting for them to accept.", "Esperando que acepte."),
      doneDetail: W(lang, "The job is on.", "El trabajo va."),
    },
    {
      key: "captured",
      label: W(lang, "Collected into the OneJob Vault", "Cobrado en la Bóveda de OneJob"),
      at: ag.captured_at,
      place: "vault",
      detail: W(lang, "On acceptance the payment is collected and held by OneJob — not by either of you.", "Al aceptar, el pago se cobra y lo resguarda OneJob — no ninguno de ustedes dos."),
      // Once it's released this row must stop speaking in the present tense. Saying "$124.67 is held
      // by OneJob" while the money is demonstrably sitting in the pro's own Stripe balance is the
      // exact "money is in one place and actually is somewhere else" problem Lee called out.
      doneDetail: ag.released_at
        ? (amount ? `${amount} was held in the Vault until you both marked the job complete.` : W(lang, "Held in the Vault until you both marked the job complete.", "Estuvo en la Bóveda hasta que ambos marcaron el trabajo como completado."))
        : (amount ? `${amount} is in the OneJob Vault. Neither side can touch it.` : W(lang, "In the OneJob Vault. Neither side can touch it.", "En la Bóveda de OneJob. Ninguna de las partes puede tocarlo.")),
    },
    {
      key: "payeeDone",
      label: W(lang, "Marked complete by the professional", "Marcado como completado por el profesional"),
      at: ag.payee_done_at,
      place: "check",
      detail: isPayee ? W(lang, "Mark it complete when you've finished the work.", "Márcalo como completado cuando termines el trabajo.") : W(lang, "The professional confirms the work is done.", "El profesional confirma que el trabajo está hecho."),
      doneDetail: W(lang, "The professional says the work is done.", "El profesional dice que el trabajo está hecho."),
    },
    {
      key: "payerDone",
      label: W(lang, "Marked complete by the client", "Marcado como completado por el cliente"),
      at: ag.payer_done_at,
      place: "check",
      detail: isPayee ? W(lang, "The client confirms — this is what releases the money.", "El cliente confirma — esto es lo que libera el dinero.") : W(lang, "Your confirmation is what releases the money.", "Tu confirmación es lo que libera el dinero."),
      // NOT "Payment released" — either side may mark complete first, and this step alone releases
      // nothing. When the client went first this row claimed the money had moved while the two rows
      // below it (pro's confirmation, transfer out) were still undone. (UAT Jul 26 2026)
      doneDetail: W(lang, "Confirmed by the client.", "Confirmado por el cliente."),
    },
    {
      key: "released",
      label: isPayee ? W(lang, "Released to your own Stripe account", "Liberado a tu propia cuenta de Stripe") : W(lang, "Released to the professional's own Stripe account", "Liberado a la cuenta de Stripe del profesional"),
      at: ag.released_at,
      place: "balance",
      detail: releaseStalled
        ? (payoutSetupIsTheBlocker
            ? (isPayee
                ? W(lang, "You've both marked this complete. It can't be sent until your payout account is finished — once it is, this releases automatically.", "Ambos lo marcaron como completado. No se puede enviar hasta que termines de configurar tu cuenta de pagos — en cuanto lo hagas, se libera solo.")
                : W(lang, "You've both marked this complete. The money is still in the OneJob Vault while the professional finishes setting up their payout account. Nothing for you to do.", "Ambos lo marcaron como completado. El dinero sigue en la Bóveda de OneJob mientras el profesional termina de configurar su cuenta de pagos. No tienes que hacer nada."))
            : (isPayee
                ? W(lang, "You've both marked this complete and this hasn't been released yet. We're looking into it — your money is still collected and safe.", "Ambos lo marcaron como completado y esto aún no se ha liberado. Lo estamos revisando — tu dinero sigue cobrado y seguro.")
                : W(lang, "You've both marked this complete and the payment hasn't been released yet. It is still in the OneJob Vault. Nothing for you to do.", "Ambos lo marcaron como completado y el pago aún no se ha liberado. Sigue en la Bóveda de OneJob. No tienes que hacer nada.")))
        : W(lang, "Released the moment both of you have marked it complete.", "Se libera en cuanto ambos lo marcan como completado."),
      doneDetail: isPayee
        ? W(lang, "Out of the OneJob Vault and into your own Stripe balance. OneJob isn't holding it any more.", "Salió de la Bóveda de OneJob y entró a tu propio saldo de Stripe. OneJob ya no lo retiene.")
        : W(lang, "Out of the OneJob Vault and into the professional's own Stripe balance. OneJob isn't holding it any more.", "Salió de la Bóveda de OneJob y entró al saldo de Stripe del profesional. OneJob ya no lo retiene."),
      problem: releaseStalled,
      stripe: true,
    },
    {
      key: "paidOut",
      label: payoutFailed
        ? W(lang, "Bank payout didn't go through", "El pago al banco no se completó")
        : isPayee ? W(lang, "Paid into your bank", "Depositado en tu banco") : W(lang, "Paid into the professional's bank", "Depositado en el banco del profesional"),
      at: paidOutAt,
      place: "bank",
      detail: payoutFailed
        ? (isPayee
            ? W(lang, "Stripe tried to pay your bank and couldn't. Your money is safe — it went back to your Stripe balance. Fix your bank details in Stripe and it will try again.", "Stripe intentó pagar a tu banco y no pudo. Tu dinero está seguro — volvió a tu saldo de Stripe. Corrige los datos de tu banco en Stripe y lo intentará de nuevo.")
            : W(lang, "Stripe couldn't pay the professional's bank. The money is still the professional's, in their Stripe account. Nothing for you to do.", "Stripe no pudo pagar al banco del profesional. El dinero sigue siendo suyo, en su cuenta de Stripe. No tienes que hacer nada."))
        : payoutInTransit
          ? (isPayee ? W(lang, "Stripe has sent this to your bank.", "Stripe ya envió esto a tu banco.") : W(lang, "Stripe has sent this to the professional's bank.", "Stripe ya envió esto al banco del profesional."))
          : (isPayee
              ? W(lang, "Stripe moves this from your Stripe balance to your bank on its own schedule, not OneJob's.", "Stripe mueve esto de tu saldo de Stripe a tu banco según su propio calendario, no el de OneJob.")
              : W(lang, "Stripe moves this to the professional's bank on its own schedule, not OneJob's.", "Stripe mueve esto al banco del profesional según su propio calendario, no el de OneJob.")),
      doneDetail: isPayee ? W(lang, "In your bank.", "En tu banco.") : W(lang, "In the professional's bank.", "En el banco del profesional."),
      note: bankNote,
      problem: payoutFailed,
      /**
       * Before the `payout.*` webhooks existed nothing ever wrote `paid_out_at`, so this row could
       * only ever be informational. It is now a real tracked step — but only once there is something
       * real to track. With no payout id, no arrival date and no stamp, we still know nothing about
       * the bank leg, and a hopeful pending dot would be a guess.
       */
      informational: !paidOutAt && !ag.payout_arrival_date && !payoutFailed,
      stripe: true,
    },
  ];

  /**
   * THE TWO COMPLETION ROWS GO IN THE ORDER THEY ACTUALLY HAPPENED.
   *
   * They were hardcoded pro-then-client, so a job where the client confirmed first rendered 10:55 PM
   * above 10:53 PM. On a panel that is explicitly an audit trail, a stamp out of sequence is worse
   * than no stamp: it makes a reader doubt every other row on the screen.
   *
   * Ties and un-stamped rows keep the original order — a step that hasn't happened has no place in
   * time to be sorted into.
   */
  const [payeeRow, payerRow] = [rows[3], rows[4]];
  if (payeeRow.at && payerRow.at && new Date(payerRow.at).getTime() < new Date(payeeRow.at).getTime()) {
    rows[3] = payerRow;
    rows[4] = payeeRow;
  }

  // Where the money is right now = the first undone step AFTER the last done one.
  //
  // This used to be `findIndex(r => !r.at)`, i.e. the first gap. But the two completion steps can
  // happen in either order, and a 3DS authorization could land unstamped, so a gap is not the same
  // thing as the frontier. The old version pointed "Now" at a step that sat ABOVE rows already
  // rendered with real timestamps — the rail drew teal, grey, teal. (UAT Jul 26 2026)
  const lastDone = rows.reduce((acc, r, i) => (r.at ? i : acc), -1);
  /**
   * "Now" is the FIRST step still outstanding, not the first gap after the furthest-along stamp.
   *
   * The old rule (`i > lastDone`) skipped straight past an earlier unfinished step. Client marks
   * complete first and the pro hasn't: `payer_done_at` is stamped at index 4, `payee_done_at` is null
   * at index 3, so lastDone = 4 and "Now" landed on "Released to the pro's own Stripe account" —
   * telling the client a transfer was in flight when nothing at all would happen until the pro tapped
   * a button, while the row that WAS waiting sat greyed out above it with no marker.
   *
   * `lastDone` is kept as the tiebreak for the case where every tracked step is stamped.
   */
  const firstUndone = rows.findIndex((r) => !r.at && !r.informational);
  const currentIdx = firstUndone !== -1
    ? firstUndone
    : rows.findIndex((r, i) => i > lastDone && !r.at);
  // Only claim a HOLD expired if there ever was one. `expired_at` alone is also set on contracts that
  // never had an authorization (payee-initiated, recurring, promo), and telling that payer their card
  // hold expired describes a charge that never existed. (UAT Jul 26 2026)
  const holdExpired = (ag.payment_status === "hold_expired" || !!ag.expired_at) && !!ag.authorized_at;
  const expiredNoHold = !!ag.expired_at && !ag.authorized_at;

  /**
   * ---------- "LET ME SEE IT MYSELF" ----------
   *
   * Lee, Jul 26 2026: "people need a button or some link to go back into Stripe to see their money.
   * Say their money is sitting there and it hasn't moved — they should be able to log back into Stripe
   * and see it... they'll have more peace of mind knowing they can look in Stripe and see it."
   *
   * Exactly right, and it's the strongest trust move available: the last two steps of this timeline are
   * the ones OneJob can't fully narrate (Stripe's own balance and its payout schedule), so instead of
   * asking the pro to take our word for it we hand them the ledger. `stripe-connect-manage` mints a
   * one-time Express Dashboard login link, so there's no password to remember.
   *
   * Only shown to the PAYEE — it's their Stripe account. A payer clicking it would land nowhere.
   */
  const canSeeInStripe = isPayee;
  const openStripe = async () => {
    if (stripeBusy) return;
    setStripeBusy(true); setStripeErr("");
    try {
      const { data } = await supabase.functions.invoke("stripe-connect-manage", { body: {} });
      const url = (data as any)?.url as string | undefined;
      if (url) { window.location.href = url; return; }
      setStripeErr((data as any)?.error || W(lang, "Couldn’t open Stripe just now — try again in a moment.", "No pudimos abrir Stripe ahora — inténtalo de nuevo en un momento."));
    } catch {
      setStripeErr(W(lang, "Couldn’t open Stripe just now — try again in a moment.", "No pudimos abrir Stripe ahora — inténtalo de nuevo en un momento."));
    }
    setStripeBusy(false);
  };

  if (nothingToTrack) return null;

  return (
    <section className={`card p-4 ${className}`}>
      <h3 className="text-sm font-extrabold">Where your money is</h3>
      <p className="mt-0.5 text-[11px] leading-snug opacity-55">
        Every step below is stamped when it actually happens — nothing here is a guess.
      </p>

      {/* ONE GLANCE. Lee's whole ask for the icon pass was that a person shouldn't have to read seven
          rows to learn where their money is sitting. This is that answer, in one line, with the
          picture of the place it's in. */}
      {nowPlace && !holdExpired && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand/25 bg-brand/[0.06] px-3 py-2.5">
          <MoneyPlaceIcon place={nowPlace} state="current" size={34} title={nowHeadline} />
          <div className="min-w-0 flex-1">
            <p className="oj-eyebrow !text-brand">Right now</p>
            <p className="text-[13px] font-extrabold leading-tight">{nowHeadline}</p>
            <p className="mt-0.5 text-[11px] leading-snug opacity-65">{nowSub}</p>
            {nowAt && <p className="mt-0.5 text-[11px] font-semibold text-brand">Since {fmtDateTimeFull(nowAt)}</p>}
          </div>
        </div>
      )}

      {holdExpired && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-600 dark:text-amber-400">
          The card hold on this contract expired before it was accepted. No money was taken. Send it again to restart.
        </p>
      )}
      {releaseStalled && !holdExpired && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-600 dark:text-amber-400">
          {payoutSetupIsTheBlocker
            ? (isPayee
                ? "Your money is collected and waiting in the OneJob Vault. It sends as soon as your payout account is finished."
                : W(lang, "The job is done on both sides. The payment is still in the OneJob Vault until the professional's payout account is ready.", "El trabajo está hecho por ambas partes. El pago sigue en la Bóveda de OneJob hasta que la cuenta de pagos del profesional esté lista."))
            : (isPayee
                ? "Your money is collected and waiting in the OneJob Vault. It hasn't sent yet and we're looking into why."
                : "The job is done on both sides and the payment hasn't been released yet. It is still in the OneJob Vault.")}
        </p>
      )}
      {payoutFailed && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-600 dark:text-amber-400">
          {isPayee
            ? "Stripe couldn't pay this into your bank. Nothing was lost — it's back in your Stripe balance. Check your bank details and it will try again."
            : W(lang, "Stripe couldn't pay this into the professional's bank. The money is still theirs, in their Stripe account. Nothing for you to do.", "Stripe no pudo depositar esto en el banco del profesional. El dinero sigue siendo suyo, en su cuenta de Stripe. No tienes que hacer nada.")}
        </p>
      )}
      {cameBack && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-600 dark:text-amber-400">
          {refunded
            ? (isPayee
                ? W(lang, "This payment was refunded to the client. Nothing on this job is being held for you.", "Este pago se reembolsó al cliente. En este trabajo no se está reteniendo nada para ti.")
                : W(lang, "This payment was refunded to your card. How quickly it appears is up to your bank.", "Este pago se reembolsó a tu tarjeta. La rapidez con que aparezca depende de tu banco."))
            : (isPayee
                ? W(lang, "This payout was reversed. It is no longer in your Stripe balance.", "Este pago fue revertido. Ya no está en tu saldo de Stripe.")
                : W(lang, "The professional's payout on this job was reversed.", "El pago al profesional de este trabajo fue revertido."))}
        </p>
      )}
      {expiredNoHold && (
        <p className="mt-3 rounded-xl border border-ink/15 bg-ink/[0.04] px-3 py-2 text-[12px] font-semibold opacity-70 dark:border-white/15 dark:bg-white/[0.06]">
          This contract expired before it was accepted. No payment was ever set up, so nothing was charged.
        </p>
      )}

      <ol className="mt-3 space-y-0">
        {rows.map((r, i) => {
          /**
           * DONE-NESS IS MONOTONIC. Money cannot be in the pro's bank without having been released,
           * and cannot have been released without having been collected — so any step BELOW the
           * furthest-along stamp is done whether or not its own column was ever written.
           *
           * Per-row done-ness drew the rail teal → teal → grey → teal on a contract with `released_at`
           * set and `captured_at` null, while the Vault row narrated the future tense: "On acceptance
           * the payment is collected and held by OneJob." An audit trail that says money was released
           * but never collected is worse than one that admits a missing stamp, which is what the row
           * now does.
           */
          const done = !!r.at || i < lastDone;
          const missingStamp = done && !r.at;
          // An informational row is never the pending "Now" step — see the paidOut row's comment.
          const current = !done && !r.informational && i === currentIdx && !holdExpired && !expiredNoHold;
          const last = i === rows.length - 1;
          const iconState = done ? "done" : current ? "current" : "pending";
          return (
            <li key={r.key} className="flex gap-3">
              {/* Rail: the PLACE this step puts the money, plus the connector down to the next one. */}
              <div className="flex flex-col items-center">
                {/* ── SMALL DOTS ON A LINE, NOT A COLUMN OF BADGES ──────────────────────────
                    Lee, 4 Aug 2026: *"our graphics are a lot bigger in that section and they
                    should be smaller, like the check marks we have right above it. And honestly
                    you don't even need a check mark — you just need the green, because the green
                    effectively IS the check mark, so you don't need both. Open holes when that
                    stage hasn't completed, and a line connecting them as they flow through."*

                    Right on both counts. A 36px badge carrying a tick inside a tinted square says
                    "done" three times — the fill, the ring and the glyph — and three signals for
                    one fact is what made the section feel heavy next to the acceptance stamps
                    above it. Filled means done. Hollow means not yet. The ring means you are here.
                    Nothing else is needed, and at 18px the whole rail reads in one glance.

                    The PROBLEM state keeps its glyph, because amber has to say what is wrong
                    rather than just that something is. */}
                <span
                  className={
                    "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full transition-colors " +
                    (r.problem
                      ? "bg-amber-500/15 ring-2 ring-amber-500/70"
                      : done
                        ? ""
                        : current
                          ? "bg-transparent ring-2 ring-brand"
                          : "bg-transparent ring-2 ring-ink/15 dark:ring-white/15")
                  }
                  style={done && !r.problem ? {
                    background: "linear-gradient(160deg, #15C2B2 0%, #0F766E 100%)",
                    boxShadow: "0 2px 6px -2px rgba(14,155,142,.7)",
                  } : undefined}
                  title={r.label}
                >
                  {/* The CURRENT step gets a small solid centre inside its ring — "the money is
                      here right now" is different from "this has not happened", and an empty ring
                      cannot say both. */}
                  {r.problem ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="3.4" strokeLinecap="round" className="text-amber-600" aria-hidden>
                      <path d="M12 7v6" /><path d="M12 17h.01" />
                    </svg>
                  ) : current ? (
                    <span className="h-[7px] w-[7px] rounded-full bg-brand" />
                  ) : null}
                </span>
                {!last && (
                  <span
                    className={`w-px flex-1 ${done ? "bg-teal/60" : "bg-ink/12 dark:bg-white/12"}`}
                    style={{ minHeight: 14 }}
                  />
                )}
              </div>

              <div className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-4"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className={`text-[13px] font-bold ${done || current || r.problem ? "" : "opacity-45"}`}>{r.label}</p>
                  {current && <span className="oj-eyebrow shrink-0 !text-brand">Now</span>}
                </div>
                {/* The stamp gets its own line and never abbreviates. In the one panel whose promise is
                    that nothing is a guess, "3:14 PM" with no date is a guess about which day. */}
                {done && r.at && (
                  <p className="mt-0.5 text-[11px] font-semibold text-brand">{fmtDateTimeFull(r.at)}</p>
                )}
                {missingStamp && (
                  <p className="mt-0.5 text-[11px] font-semibold opacity-45">
                    This happened, but we don&apos;t have the exact time for it.
                  </p>
                )}
                <p className={`mt-0.5 text-[11px] leading-snug ${done ? "opacity-60" : current ? "opacity-75" : r.informational ? "opacity-60" : "opacity-40"}`}>
                  {done ? (r.doneDetail ?? r.detail) : r.detail}
                </p>
                {r.note && (
                  <p className={`mt-0.5 text-[11px] font-semibold leading-snug ${r.problem ? "text-amber-600 dark:text-amber-400" : "text-brand"}`}>
                    {r.note}
                  </p>
                )}

                {/* The pro can verify the last two steps in Stripe's own ledger rather than taking our
                    word for it — the whole point of the link Lee asked for. */}
                {r.stripe && canSeeInStripe && (
                  <button onClick={openStripe} disabled={stripeBusy}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-brand underline underline-offset-2 disabled:opacity-50">
                    {stripeBusy ? W(lang, "Opening Stripe…", "Abriendo Stripe…") : W(lang, "See this in Stripe →", "Verlo en Stripe →")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {stripeErr && <p className="mt-2 text-[11px] text-red-500">{stripeErr}</p>}

      {/* THE CLIENT'S BRIEFING. Lee, Jul 27 2026: "a similar notice for the payer, so when they click
          setup they see what's about to happen."
          A client has no Stripe account and no reason to know why there's a gap between marking a job
          complete and the pro actually having the money. Without this, that gap reads as OneJob
          sitting on their payment. Collapsed by default behind a full-size chevron, because the
          panel is already tall and Lee's standing note on long screens is "it is long". */}
      {!isPayee && (
        <>
          <button
            onClick={() => setWhatNextOpen((v) => !v)}
            aria-expanded={whatNextOpen}
            className="mt-3 flex w-full items-center justify-center gap-1.5 border-t border-ink/5 pt-3 text-[12px] font-bold opacity-75 dark:border-white/10"
          >
            <span>What happens to my money, and when</span>
            <Chevron size="sm" open={whatNextOpen} />
          </button>
          {whatNextOpen && (
            <ul className="mt-2 space-y-2 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-[11.5px] leading-relaxed dark:bg-white/[0.06]">
              {payerTimingLines(connect?.country).map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <span className="opacity-80">{line}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {canSeeInStripe && (
        <p className="mt-3 border-t border-ink/5 pt-3 text-[11px] leading-snug opacity-55 dark:border-white/10">
          Your money is always visible in your own Stripe dashboard, even before it reaches your bank.
          {" "}
          <button onClick={openStripe} disabled={stripeBusy} className="font-bold text-brand underline underline-offset-2 disabled:opacity-50">
            {stripeBusy ? W(lang, "Opening…", "Abriendo…") : W(lang, "Open my Stripe dashboard", "Abrir mi panel de Stripe")}
          </button>
        </p>
      )}
    </section>
  );
}
