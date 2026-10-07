export type AttemptState = 'created' | 'pending' | 'unknown' | 'paid' | 'failed' | 'voided';
export type AttemptSignal = 'submit' | 'transport_lost' | 'provider_paid' | 'provider_failed';
export type Transition = Readonly<{ state: AttemptState; reconcile: boolean }>;

/**
 * Provider signals must come from a verified, tenant-bound server adapter.
 * A return URL, app deep link, screenshot, or client callback is never payment proof.
 * Unknown outcomes keep the original attempt/idempotency key and require reconciliation.
 */
export function transitionAttempt(state: AttemptState, signal: AttemptSignal): Transition {
  if (signal === 'submit') {
    if (state !== 'created') throw new Error('Attempt already submitted; reconcile original attempt');
    return { state: 'pending', reconcile: false };
  }
  if (signal === 'transport_lost') {
    if (state === 'created') throw new Error('Attempt not submitted');
    return state === 'pending' || state === 'unknown'
      ? { state: 'unknown', reconcile: true } : { state, reconcile: false };
  }
  if (state === 'created') throw new Error('Provider event for unsubmitted attempt');
  const target = signal === 'provider_paid' ? 'paid' : 'failed';
  if ((state === 'paid' || state === 'failed' || state === 'voided') && state !== target)
    return { state, reconcile: true }; // Preserve known result and surface contradictory evidence.
  return { state: target, reconcile: false };
}

/** Reserve refunds atomically on the server before calling a processor; unknown refunds stay reserved. */
export function refundableMinor(captured: number, refunded: number, reserved: number): number {
  for (const value of [captured, refunded, reserved])
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid refund amount');
  const available = BigInt(captured) - BigInt(refunded) - BigInt(reserved);
  if (available < 0n) throw new Error('Refund ledger exceeds captured amount');
  return Number(available);
}

export function assertRefund(requested: number, captured: number, refunded: number, reserved: number): void {
  if (!Number.isSafeInteger(requested) || requested <= 0) throw new Error('Invalid requested refund');
  if (requested > refundableMinor(captured, refunded, reserved)) throw new Error('Refund exceeds available amount');
}
