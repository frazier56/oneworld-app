import type { AttemptState } from './attempt.ts';
import type { AdapterContext, VerifiedProviderObservation } from './providerAdapter.ts';
import { applyVerifiedObservation } from './providerAdapter.ts';
import type { ProviderAdapterRegistry } from './adapterRegistry.ts';

export type ObservationCommand = Readonly<{
  eventId: string;
  context: AdapterContext;
  attemptId: string;
  observation: VerifiedProviderObservation;
}>;

export type PersistedObservationResult = Readonly<{
  disposition: 'applied' | 'duplicate' | 'conflict';
  state: AttemptState;
  reconcile: boolean;
  code: string | null;
}>;

/**
 * The implementation must claim (provider,eventId), lock/load the attempt, apply the state
 * transition, and persist the resulting state/reconciliation marker in one database transaction.
 */
export interface PaymentObservationPersistence {
  recordObservation(command: ObservationCommand): Promise<PersistedObservationResult>;
}

export type UnknownLookupCommand = Readonly<{
  attemptId: string;
  providerPaymentId: string;
}>;

function rejectedLookup(code: string): PersistedObservationResult {
  return Object.freeze({ disposition: 'conflict', state: 'unknown', reconcile: true, code });
}

async function lookupObservationEventId(
  context: AdapterContext,
  command: UnknownLookupCommand,
  observation: VerifiedProviderObservation,
): Promise<string> {
  const canonical = [context.provider, command.attemptId, command.providerPaymentId, observation.status].join('\u0000');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const hex = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
  return `lookup:${context.provider}:${hex}`;
}

/** Verified webhooks and authenticated lookups share one atomic persistence path. */
export async function orchestrateProviderObservation(
  persistence: PaymentObservationPersistence,
  command: ObservationCommand,
): Promise<PersistedObservationResult> {
  if (!command.eventId || command.eventId.length > 240) throw new Error('Invalid provider event identifier');
  const preflight = applyVerifiedObservation('unknown', command.context, command.attemptId, command.observation);
  if (preflight.code === 'observation_mismatch') return rejectedLookup(preflight.code);
  return persistence.recordObservation(command);
}

/** Unknown results are looked up once, never resubmitted as a new payment. */
export async function reconcileUnknownPayment(
  registry: ProviderAdapterRegistry,
  persistence: PaymentObservationPersistence,
  context: AdapterContext,
  command: UnknownLookupCommand,
): Promise<PersistedObservationResult> {
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(command.providerPaymentId))
    throw new Error('Invalid provider payment identifier');
  const adapter = registry.resolve(context.provider);
  const observation = await adapter.lookupPayment(context, command.providerPaymentId);
  if (observation.providerPaymentId !== command.providerPaymentId)
    return rejectedLookup('provider_payment_mismatch');
  return orchestrateProviderObservation(persistence, {
    eventId: await lookupObservationEventId(context, command, observation),
    context,
    attemptId: command.attemptId,
    observation,
  });
}

export type RefundReservationCommand = Readonly<{
  attemptId: string;
  refundId: string;
  amountMinor: number;
}>;

export type RefundReservationResult = Readonly<{
  disposition: 'reserved' | 'duplicate' | 'insufficient';
  reservedMinor: number;
}>;

/** Implementations must serialize the captured/refunded/reserved check with the insert. */
export interface RefundReservationPersistence {
  reserveRefund(command: RefundReservationCommand): Promise<RefundReservationResult>;
}

export async function reserveRefundBeforeProviderCall(
  persistence: RefundReservationPersistence,
  command: RefundReservationCommand,
): Promise<RefundReservationResult> {
  if (!Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0) throw new Error('Invalid refund amount');
  return persistence.reserveRefund(command);
}
