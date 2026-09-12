export type Provider = 'bold' | 'wompi' | 'dlocal' | 'credibanco' | 'stripe';
export type Acceptance = 'phone_nfc' | 'external_terminal' | 'online';
export type Runtime = 'web' | 'android' | 'ios';
export type IntegrationEvidence = Readonly<{
  provider: Provider;
  country: 'CO';
  currency: 'COP';
  acceptance: Acceptance;
  runtime: Runtime;
  // Evidence belongs to the server-side approved integration registry, never browser settings.
  approvalReference: string;
  expiresAt: number;
}>;
export type MerchantReadiness = Readonly<{
  provider: Provider;
  country: string;
  currency: string;
  onboarded: boolean;
  acceptanceEnabled: boolean;
  deviceCertified: boolean;
}>;
export type GateResult = Readonly<{ allowed: boolean; reasons: readonly string[] }>;

/** Capability checklist only. An authorization service and official SDK are still required. */
export function phoneAcceptanceGate(
  evidence: IntegrationEvidence | null, merchant: MerchantReadiness, runtime: Runtime, now: number,
): GateResult {
  const reasons: string[] = [];
  if (!Number.isFinite(now)) reasons.push('invalid_clock');
  if (!evidence || !evidence.approvalReference.trim()) reasons.push('integration_unverified');
  if (evidence) {
    if (!Number.isFinite(evidence.expiresAt) || evidence.expiresAt <= now) reasons.push('approval_expired');
    if (evidence.provider !== merchant.provider) reasons.push('provider_mismatch');
    if (evidence.country !== 'CO' || evidence.currency !== 'COP') reasons.push('integration_market_mismatch');
    if (evidence.acceptance !== 'phone_nfc') reasons.push('not_phone_only');
    if (evidence.runtime !== runtime) reasons.push('runtime_mismatch');
  }
  if (runtime === 'web') reasons.push('browser_nfc_not_supported');
  if (merchant.country !== 'CO' || merchant.currency !== 'COP') reasons.push('merchant_market_mismatch');
  if (!merchant.onboarded || !merchant.acceptanceEnabled) reasons.push('merchant_not_ready');
  if (!merchant.deviceCertified) reasons.push('device_not_certified');
  return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons) });
}

/** No Colombia native integration has been verified for OnePay. Marketing is not approval. */
export const APPROVED_ONEPAY_PHONE_INTEGRATION: IntegrationEvidence | null = null;
