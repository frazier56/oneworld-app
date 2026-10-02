import { D } from './detailCopy';

/**
 * WHAT HAS HAPPENED, WHAT HAPPENS NEXT — as a sequence, not a paragraph.
 * ============================================================================================
 * Lee, 17 September 2026, reading the request card out loud: *"these should be sometimes steps,
 * sometimes information… request sent, waiting for the host to review it — that's kind of like
 * step one, right? Well, that's already done. It's not even a step one."*
 *
 * He is drawing the line this file exists to hold:
 *
 *   · **done**  — it already happened. It gets a tick and NO number, because numbering something
 *                 that is finished tells somebody to go and do it.
 *   · **step**  — somebody still has to do it. It gets the next number.
 *   · **warn**  — it went wrong, and the only useful instruction is to stop.
 * "A copy is in your Messages" is a footnote rather than any of these, so it is not in this list
 * at all — the panel prints it last, under everything, where a footnote goes. It sat between a
 * numbered step and the money actions, which is the one place a reader cannot skip it.
 *
 * The deadline is NOT its own line either. *"It says the host has up until the 17th. Again, that
 * will all be a part of the same step."* A date sitting on its own is a fact nobody can act on;
 * inside the step it is the thing that makes the step urgent.
 *
 * Likewise "wait for the host to accept before you send money" is not a floating warning — it IS
 * the payment step, for as long as the host has not accepted. When they have, the same slot
 * becomes "send the rent by Remitly". One position in the list, one instruction at a time.
 */
export type RequestStep = { kind: 'done' | 'step' | 'warn'; text: string };

export type RequestState = {
  state: string;
  approval_stage: string;
  identity_status: string;
  payment_rail: string | null;
  payment_status: string;
  payment_declared_at: string | null;
  payment_received_at: string | null;
  expires_at: string;
  preapproval_expires_at: string | null;
};

const RAIL_NAME: Record<string, string> = {
  remitly: 'Remitly', wise: 'Wise', paypal: 'PayPal', stripe: 'card',
  western_union: 'Western Union', bank_transfer: 'bank transfer', cash: 'cash',
};

export function requestSteps(
  r: RequestState,
  lang: string,
  when: (iso: string) => string,
  now = Date.now(),
): RequestStep[] {
  const preapproved = ['preapproved_id_required', 'preapproved_ready'].includes(r.approval_stage);
  const accepted = r.state === 'accepted';
  const declared = !!r.payment_declared_at;
  const received = !!r.payment_received_at || r.payment_status === 'received'
    || ['captured'].includes(r.payment_status);
  const lapsed = r.state === 'expired'
    || (!declared && !received && r.state === 'requested'
        && new Date(r.preapproval_expires_at || r.expires_at).getTime() <= now);

  const out: RequestStep[] = [{ kind: 'done', text: D(lang, 'sentAndWaiting') }];

  if (lapsed) {
    out.push({ kind: 'warn', text: D(lang, 'stepLapsed') });
    return out;
  }


  out.push(accepted || preapproved
    ? { kind: 'done', text: D(lang, 'stepHostAccepted') }
    : { kind: 'step', text: D(lang, 'stepHostAnswers', { when: when(r.expires_at) }) });

  /* ONE SLOT FOR MONEY, and what it says depends entirely on where the money is. The old card
     printed "pending approval", "payment not confirmed" and "wait before you pay" as three
     separate lines that could all be on screen together, so the reader had to work out which one
     was current. Only one of these can ever be true at a time. */
  if (received) {
    out.push({ kind: 'done', text: D(lang, 'stepPaymentIn') });
  } else if (declared) {
    out.push({ kind: 'step', text: D(lang, 'stepYouSent', { when: when(r.payment_declared_at!) }) });
  } else if (preapproved && r.payment_rail === 'stripe') {
    out.push({ kind: 'step', text: D(lang, 'stepPayCard', { when: when(r.preapproval_expires_at || r.expires_at) }) });
  } else if (preapproved) {
    out.push({ kind: 'step', text: D(lang, 'stepPayNow', {
      rail: RAIL_NAME[r.payment_rail ?? ''] ?? r.payment_rail ?? '',
      when: when(r.preapproval_expires_at || r.expires_at) }) });
  } else {
    out.push({ kind: 'step', text: D(lang, 'stepDontPayYet') });
  }

  if (preapproved && !['submitted', 'approved'].includes(r.identity_status)) {
    out.push({ kind: 'step', text: D(lang, 'stepSendId') });
  }
  if (accepted) out.push({ kind: 'done', text: D(lang, 'stepConfirmed') });

  return out;
}
