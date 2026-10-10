import type { Acceptance, Provider } from './acceptance.ts';
import { transitionAttempt, type AttemptState } from './attempt.ts';
import { cop, type CopAmount } from './money.ts';

/**
 * Server-only provider boundary. Provider implementations may use secrets, but callers and
 * browser bundles must receive only these normalized states and safe machine-readable codes.
 */
export type ProviderCapability =
  | 'hosted_card'
  | 'payment_link'
  | 'qr'
  | 'tap_to_phone'
  | 'refund'
  | 'settlement_reporting';

export type ProviderCapabilities = Readonly<Record<ProviderCapability, boolean>>;

export const NO_PROVIDER_CAPABILITIES: ProviderCapabilities = Object.freeze({
  hosted_card: false,
  payment_link: false,
  qr: false,
  tap_to_phone: false,
  refund: false,
  settlement_reporting: false,
});

export type AdapterContext = Readonly<{
  provider: Provider;
  merchantId: string;
  providerAccountId: string;
  country: 'CO';
  currency: 'COP';
  /** Server-configured OneWorld origin; never accept this value from a payment request body. */
  returnOrigin: string;
}>;

export type PaymentHandoff = Readonly<{
  kind: 'redirect' | 'app_handoff' | 'qr' | 'none';
  url?: string;
  payload?: string;
}>;

export type CreatePaymentCommand = Readonly<{
  orderId: string;
  attemptId: string;
  idempotencyKey: string;
  amount: CopAmount;
  capability: Exclude<ProviderCapability, 'refund' | 'settlement_reporting'>;
  returnUrl?: string;
}>;

export type ProviderCreateResult =
  | Readonly<{ kind: 'accepted'; providerPaymentId: string; handoff: PaymentHandoff }>
  | Readonly<{ kind: 'declined'; code: string }>
  | Readonly<{ kind: 'unknown'; code: string }>;

export type RefundCommand = Readonly<{
  paymentId: string;
  refundId: string;
  idempotencyKey: string;
  amount: CopAmount;
}>;

export type ProviderRefundResult =
  | Readonly<{ kind: 'accepted'; providerRefundId: string }>
  | Readonly<{ kind: 'declined'; code: string }>
  | Readonly<{ kind: 'unknown'; code: string }>;

export type RefundSubmissionResult = Readonly<{
  outcome: 'blocked' | 'accepted' | 'declined' | 'unknown';
  reconcile: boolean;
  code: string | null;
  providerRefundId: string | null;
  idempotencyKey: string;
}>;

export type VerifiedProviderObservation = Readonly<{
  verified: true;
  source: 'verified_webhook' | 'authenticated_lookup';
  provider: Provider;
  merchantId: string;
  attemptId: string;
  providerPaymentId: string;
  status: 'pending' | 'paid' | 'failed' | 'unknown';
}>;

export interface ProviderAdapter {
  readonly provider: Provider;
  capabilities(context: AdapterContext): Promise<ProviderCapabilities>;
  createPayment(context: AdapterContext, command: CreatePaymentCommand): Promise<ProviderCreateResult>;
  lookupPayment(
    context: AdapterContext,
    providerPaymentId: string,
  ): Promise<VerifiedProviderObservation>;
  initiateRefund(context: AdapterContext, command: RefundCommand): Promise<ProviderRefundResult>;
  verifyWebhook(
    context: AdapterContext,
    rawBody: Uint8Array,
    headers: Readonly<Record<string, string>>,
  ): Promise<readonly VerifiedProviderObservation[]>;
}

export type AdapterFailureCertainty = 'not_started' | 'declined' | 'unknown';

/** Provider implementations use this only for normalized failures; raw responses stay in logs. */
export class AdapterFailure extends Error {
  readonly code: string;
  readonly certainty: AdapterFailureCertainty;

  constructor(code: string, certainty: AdapterFailureCertainty) {
    super('Provider adapter operation failed');
    this.name = 'AdapterFailure';
    this.code = safeCode(code) ? code : 'adapter_failure';
    this.certainty = certainty;
  }
}

export type SubmissionResult = Readonly<{
  state: AttemptState;
  outcome: 'blocked' | 'accepted' | 'declined' | 'unknown';
  reconcile: boolean;
  code: string | null;
  providerPaymentId: string | null;
  handoff: PaymentHandoff | null;
  idempotencyKey: string;
}>;

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const OPAQUE_PROVIDER_ID = /^[A-Za-z0-9._:-]{1,200}$/;
const CODE = /^[a-z][a-z0-9_]{0,63}$/;

function safeCode(value: string): boolean {
  return CODE.test(value);
}

export function onePayAttemptIdempotencyKey(orderId: string, attemptId: string): string {
  if (!ID.test(orderId) || !ID.test(attemptId)) throw new Error('Invalid immutable identifier');
  return `onepay:${orderId}:${attemptId}`;
}

export function onePayRefundIdempotencyKey(paymentId: string, refundId: string): string {
  if (!ID.test(paymentId) || !ID.test(refundId)) throw new Error('Invalid immutable identifier');
  return `onepay-refund:${paymentId}:${refundId}`;
}

function validateContext(adapter: Pick<ProviderAdapter, 'provider'>, context: AdapterContext): string | null {
  if (adapter.provider !== context.provider) return 'provider_mismatch';
  if (!ID.test(context.merchantId) || !OPAQUE_PROVIDER_ID.test(context.providerAccountId))
    return 'merchant_context_invalid';
  if (context.country !== 'CO' || context.currency !== 'COP') return 'market_not_supported';
  try {
    const origin = new URL(context.returnOrigin);
    if (origin.protocol !== 'https:' || origin.origin !== context.returnOrigin || origin.username || origin.password)
      return 'return_origin_invalid';
  } catch {
    return 'return_origin_invalid';
  }
  return null;
}

function validateCommand(command: CreatePaymentCommand, context: AdapterContext): string | null {
  if (!ID.test(command.orderId) || !ID.test(command.attemptId)) return 'payment_identity_invalid';
  if (command.idempotencyKey !== onePayAttemptIdempotencyKey(command.orderId, command.attemptId))
    return 'idempotency_key_invalid';
  try {
    cop(command.amount.minor);
  } catch {
    return 'amount_invalid';
  }
  if (command.amount.currency !== 'COP' || command.amount.minor <= 0) return 'amount_invalid';
  if (command.returnUrl) {
    try {
      const target = new URL(command.returnUrl);
      if (target.protocol !== 'https:' || target.origin !== context.returnOrigin || target.username || target.password)
        return 'return_url_invalid';
    } catch {
      return 'return_url_invalid';
    }
  }
  return null;
}

function validHandoff(handoff: PaymentHandoff): boolean {
  if (!handoff || !['redirect', 'app_handoff', 'qr', 'none'].includes(handoff.kind)) return false;
  if (handoff.kind === 'none') return !handoff.url && !handoff.payload;
  if (handoff.kind === 'qr') return typeof handoff.payload === 'string' && handoff.payload.length > 0 && handoff.payload.length <= 4096;
  if (typeof handoff.url !== 'string' || handoff.url.length > 2048) return false;
  try {
    const target = new URL(handoff.url);
    if (target.username || target.password) return false;
    if (handoff.kind === 'redirect') return target.protocol === 'https:';
    return !['javascript:', 'data:', 'file:', 'http:'].includes(target.protocol);
  } catch {
    return false;
  }
}

function validateRefundCommand(command: RefundCommand): string | null {
  if (!ID.test(command.paymentId) || !ID.test(command.refundId)) return 'refund_identity_invalid';
  if (command.idempotencyKey !== onePayRefundIdempotencyKey(command.paymentId, command.refundId))
    return 'idempotency_key_invalid';
  try {
    cop(command.amount.minor);
  } catch {
    return 'amount_invalid';
  }
  if (command.amount.currency !== 'COP' || command.amount.minor <= 0) return 'amount_invalid';
  return null;
}

function result(
  command: CreatePaymentCommand,
  state: AttemptState,
  outcome: SubmissionResult['outcome'],
  reconcile: boolean,
  code: string | null,
  providerPaymentId: string | null = null,
  handoff: PaymentHandoff | null = null,
): SubmissionResult {
  return Object.freeze({
    state,
    outcome,
    reconcile,
    code,
    providerPaymentId,
    handoff,
    idempotencyKey: command.idempotencyKey,
  });
}

/**
 * Calls an adapter at most once. Unknown transport/provider outcomes are never retried here;
 * callers must reconcile the original idempotency key first.
 */
export async function submitPayment(
  adapter: ProviderAdapter,
  context: AdapterContext,
  command: CreatePaymentCommand,
  currentState: AttemptState = 'created',
): Promise<SubmissionResult> {
  if (currentState !== 'created') return result(command, currentState, 'blocked', true, 'attempt_already_submitted');
  const validation = validateContext(adapter, context) ?? validateCommand(command, context);
  if (validation) return result(command, 'created', 'blocked', false, validation);

  let capabilities: ProviderCapabilities;
  try {
    capabilities = await adapter.capabilities(context);
    if (!capabilities || capabilities[command.capability] !== true)
      return result(command, 'created', 'blocked', false, 'capability_not_supported');
  } catch {
    return result(command, 'created', 'blocked', false, 'capability_unavailable');
  }

  const pending = transitionAttempt('created', 'submit').state;
  try {
    const providerResult = await adapter.createPayment(context, command);
    if (providerResult.kind === 'accepted') {
      if (!OPAQUE_PROVIDER_ID.test(providerResult.providerPaymentId) || !validHandoff(providerResult.handoff))
        return result(command, 'unknown', 'unknown', true, 'provider_response_invalid');
      return result(command, pending, 'accepted', false, null, providerResult.providerPaymentId, providerResult.handoff);
    }
    if (providerResult.kind === 'declined') {
      const failed = transitionAttempt(pending, 'provider_failed');
      return result(command, failed.state, 'declined', failed.reconcile, safeCode(providerResult.code) ? providerResult.code : 'provider_declined');
    }
    return result(command, 'unknown', 'unknown', true, safeCode(providerResult.code) ? providerResult.code : 'provider_unknown');
  } catch (error) {
    if (error instanceof AdapterFailure && error.certainty === 'not_started')
      return result(command, 'created', 'blocked', false, error.code);
    if (error instanceof AdapterFailure && error.certainty === 'declined')
      return result(command, 'failed', 'declined', false, error.code);
    return result(command, 'unknown', 'unknown', true, error instanceof AdapterFailure ? error.code : 'adapter_exception');
  }
}

/**
 * Starts a previously reserved refund at most once. The database must reserve the amount and
 * persist refundId before this function is called; unknown results stay reserved for lookup.
 */
export async function submitRefund(
  adapter: ProviderAdapter,
  context: AdapterContext,
  command: RefundCommand,
): Promise<RefundSubmissionResult> {
  const response = (
    outcome: RefundSubmissionResult['outcome'],
    reconcile: boolean,
    code: string | null,
    providerRefundId: string | null = null,
  ): RefundSubmissionResult => Object.freeze({
    outcome,
    reconcile,
    code,
    providerRefundId,
    idempotencyKey: command.idempotencyKey,
  });

  const validation = validateContext(adapter, context) ?? validateRefundCommand(command);
  if (validation) return response('blocked', false, validation);
  try {
    const capabilities = await adapter.capabilities(context);
    if (!capabilities || capabilities.refund !== true)
      return response('blocked', false, 'capability_not_supported');
  } catch {
    return response('blocked', false, 'capability_unavailable');
  }

  try {
    const providerResult = await adapter.initiateRefund(context, command);
    if (providerResult.kind === 'accepted') {
      if (!OPAQUE_PROVIDER_ID.test(providerResult.providerRefundId))
        return response('unknown', true, 'provider_response_invalid');
      return response('accepted', false, null, providerResult.providerRefundId);
    }
    if (providerResult.kind === 'declined')
      return response('declined', false, safeCode(providerResult.code) ? providerResult.code : 'provider_declined');
    return response('unknown', true, safeCode(providerResult.code) ? providerResult.code : 'provider_unknown');
  } catch (error) {
    if (error instanceof AdapterFailure && error.certainty === 'not_started')
      return response('blocked', false, error.code);
    if (error instanceof AdapterFailure && error.certainty === 'declined')
      return response('declined', false, error.code);
    return response('unknown', true, error instanceof AdapterFailure ? error.code : 'adapter_exception');
  }
}

export type ObservationResult = Readonly<{
  state: AttemptState;
  reconcile: boolean;
  code: string | null;
}>;

/** Client returns/deep links are deliberately not accepted by this boundary. */
export function applyVerifiedObservation(
  currentState: AttemptState,
  context: AdapterContext,
  attemptId: string,
  observation: VerifiedProviderObservation,
): ObservationResult {
  if (
    observation?.verified !== true
    || !['verified_webhook', 'authenticated_lookup'].includes(observation.source)
    || !['pending', 'paid', 'failed', 'unknown'].includes(observation.status)
    || validateContext({ provider: context.provider }, context) !== null
    || observation.provider !== context.provider
    || observation.merchantId !== context.merchantId
    || observation.attemptId !== attemptId
    || !OPAQUE_PROVIDER_ID.test(observation.providerPaymentId)
  ) return Object.freeze({ state: currentState, reconcile: true, code: 'observation_mismatch' });

  if (observation.status === 'pending') {
    if (currentState === 'paid' || currentState === 'failed' || currentState === 'voided')
      return Object.freeze({ state: currentState, reconcile: true, code: 'provider_state_conflict' });
    return Object.freeze({
      state: 'pending',
      reconcile: currentState === 'created',
      code: currentState === 'created' ? 'provider_state_conflict' : null,
    });
  }
  if (observation.status === 'unknown') {
    if (currentState === 'paid' || currentState === 'failed' || currentState === 'voided')
      return Object.freeze({ state: currentState, reconcile: false, code: null });
    return Object.freeze({ state: 'unknown', reconcile: true, code: 'provider_unknown' });
  }
  if (currentState === 'created')
    return Object.freeze({ state: currentState, reconcile: true, code: 'provider_state_conflict' });

  const transition = transitionAttempt(currentState, observation.status === 'paid' ? 'provider_paid' : 'provider_failed');
  return Object.freeze({
    state: transition.state,
    reconcile: transition.reconcile,
    code: transition.reconcile ? 'provider_state_conflict' : null,
  });
}

/** Safe default used until a provider implementation and merchant configuration are approved. */
export function disabledProviderAdapter(provider: Provider): ProviderAdapter {
  const disabled = async (): Promise<never> => {
    throw new AdapterFailure('adapter_disabled', 'not_started');
  };
  return Object.freeze({
    provider,
    capabilities: async () => NO_PROVIDER_CAPABILITIES,
    createPayment: disabled,
    lookupPayment: disabled,
    initiateRefund: disabled,
    verifyWebhook: disabled,
  });
}

/** Maps provider capability names to the existing phone-acceptance vocabulary without enabling it. */
export function acceptanceForCapability(capability: ProviderCapability): Acceptance | null {
  if (capability === 'tap_to_phone') return 'phone_nfc';
  if (capability === 'hosted_card' || capability === 'payment_link' || capability === 'qr') return 'online';
  return null;
}
