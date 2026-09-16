import type { AdapterContext } from './providerAdapter.ts';
import { applyVerifiedObservation, onePayRefundIdempotencyKey } from './providerAdapter.ts';
import type {
  ObservationCommand,
  PaymentObservationPersistence,
  PersistedObservationResult,
  RefundReservationCommand,
  RefundReservationPersistence,
  RefundReservationResult,
} from './paymentOrchestrator.ts';

type RpcResult = Readonly<{ data: unknown; error: unknown }>;

/** Minimal server-client boundary; compatible with a Supabase service-role client's rpc method. */
export interface PostgresRpcClient {
  rpc(functionName: string, parameters: Readonly<Record<string, unknown>>): PromiseLike<RpcResult>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER_ACCOUNT = /^[A-Za-z0-9._:-]{1,200}$/;

export class PaymentPersistenceFailure extends Error {
  readonly code: string;

  constructor(code: string) {
    super('OnePay persistence operation failed');
    this.name = 'PaymentPersistenceFailure';
    this.code = code;
  }
}

function oneRow(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new PaymentPersistenceFailure('rpc_response_invalid');
  return row as Record<string, unknown>;
}

function observationResult(data: unknown): PersistedObservationResult {
  const row = oneRow(data);
  const disposition = row.disposition;
  const state = row.attempt_state;
  if (!['applied', 'duplicate', 'conflict'].includes(String(disposition)))
    throw new PaymentPersistenceFailure('rpc_response_invalid');
  if (!['created', 'pending', 'unknown', 'paid', 'failed', 'voided'].includes(String(state)))
    throw new PaymentPersistenceFailure('rpc_response_invalid');
  return Object.freeze({
    disposition: disposition as PersistedObservationResult['disposition'],
    state: state as PersistedObservationResult['state'],
    reconcile: row.reconcile === true,
    code: typeof row.code === 'string' ? row.code : null,
  });
}

function reservationResult(data: unknown): RefundReservationResult {
  const row = oneRow(data);
  const disposition = row.disposition;
  const reservedMinor = Number(row.reserved_minor);
  if (!['reserved', 'duplicate', 'insufficient'].includes(String(disposition))
    || !Number.isSafeInteger(reservedMinor) || reservedMinor < 0)
    throw new PaymentPersistenceFailure('rpc_response_invalid');
  return Object.freeze({ disposition: disposition as RefundReservationResult['disposition'], reservedMinor });
}

function sameContext(left: AdapterContext, right: AdapterContext): boolean {
  return left.provider === right.provider
    && left.merchantId === right.merchantId
    && left.providerAccountId === right.providerAccountId
    && left.country === right.country
    && left.currency === right.currency;
}

async function safeRpc(
  client: PostgresRpcClient,
  functionName: string,
  parameters: Readonly<Record<string, unknown>>,
  failureCode: string,
): Promise<unknown> {
  try {
    const { data, error } = await client.rpc(functionName, parameters);
    if (error) throw new PaymentPersistenceFailure(failureCode);
    return data;
  } catch (error) {
    if (error instanceof PaymentPersistenceFailure) throw error;
    throw new PaymentPersistenceFailure(failureCode);
  }
}

/**
 * Server-only PostgreSQL repository. The injected RPC client must carry service-role credentials;
 * never instantiate this class in a browser bundle or from request-body merchant identity.
 */
export class PostgresPaymentPersistence implements PaymentObservationPersistence, RefundReservationPersistence {
  readonly #client: PostgresRpcClient;
  readonly #context: AdapterContext;
  readonly #actorId: string;

  constructor(client: PostgresRpcClient, context: AdapterContext, actorId: string) {
    if (!UUID.test(context.merchantId) || !UUID.test(actorId)
      || !PROVIDER_ACCOUNT.test(context.providerAccountId) || context.country !== 'CO' || context.currency !== 'COP')
      throw new Error('Invalid server payment identity');
    this.#client = client;
    this.#context = Object.freeze({ ...context });
    this.#actorId = actorId;
  }

  async recordObservation(command: ObservationCommand): Promise<PersistedObservationResult> {
    if (!sameContext(this.#context, command.context) || !UUID.test(command.attemptId))
      throw new PaymentPersistenceFailure('server_context_mismatch');
    const preflight = applyVerifiedObservation('unknown', this.#context, command.attemptId, command.observation);
    if (preflight.code === 'observation_mismatch')
      throw new PaymentPersistenceFailure('observation_mismatch');
    const data = await safeRpc(this.#client, 'onepay_record_verified_observation', {
      p_merchant: this.#context.merchantId,
      p_provider: this.#context.provider,
      p_provider_account_ref: this.#context.providerAccountId,
      p_event_id: command.eventId,
      p_attempt: command.attemptId,
      p_provider_ref: command.observation.providerPaymentId,
      p_outcome: command.observation.status,
      p_source: command.observation.source,
    }, 'observation_rpc_failed');
    return observationResult(data);
  }

  async reserveRefund(command: RefundReservationCommand): Promise<RefundReservationResult> {
    if (!UUID.test(command.attemptId) || !UUID.test(command.refundId)
      || !Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0)
      throw new PaymentPersistenceFailure('refund_identity_invalid');
    const data = await safeRpc(this.#client, 'onepay_reserve_provider_refund', {
      p_merchant: this.#context.merchantId,
      p_provider: this.#context.provider,
      p_provider_account_ref: this.#context.providerAccountId,
      p_actor: this.#actorId,
      p_attempt: command.attemptId,
      p_refund: command.refundId,
      p_idempotency_key: onePayRefundIdempotencyKey(command.attemptId, command.refundId),
      p_amount_minor: command.amountMinor,
    }, 'refund_rpc_failed');
    return reservationResult(data);
  }
}
