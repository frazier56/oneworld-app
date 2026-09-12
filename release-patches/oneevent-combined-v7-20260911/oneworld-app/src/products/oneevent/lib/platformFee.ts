/**
 * Tiered platform fee — replaces the flat 8.99% with a per-badge schedule.
 * Badge holders save. Founder = lowest, near Stripe-only floor.
 *
 * Source of truth for any fee math across the app. The legacy
 * `PLATFORM_FEE_PCT` export in `src/lib/agentCommission.ts` continues to
 * resolve to the Member tier so old call sites remain correct.
 */

export type BadgeTier = "member" | "verified" | "trusted" | "authority" | "founder";

/** Fee schedule, in percent of gross. */
export const PLATFORM_FEE_SCHEDULE: Record<BadgeTier, number> = {
  member: 8.99,
  verified: 7.99,
  trusted: 6.99,
  authority: 5.99,
  founder: 4.0, // ~Stripe-only floor
};

/** Default tier used when caller doesn't know the user's badge. */
export const DEFAULT_FEE_TIER: BadgeTier = "member";

export function feePctForBadge(badge?: string | null): number {
  if (!badge) return PLATFORM_FEE_SCHEDULE[DEFAULT_FEE_TIER];
  const key = String(badge).toLowerCase() as BadgeTier;
  return PLATFORM_FEE_SCHEDULE[key] ?? PLATFORM_FEE_SCHEDULE[DEFAULT_FEE_TIER];
}

/** Returns the savings vs Member fee, in percent points. */
export function feeSavingsVsMember(badge?: string | null): number {
  return Math.max(0, PLATFORM_FEE_SCHEDULE.member - feePctForBadge(badge));
}

/** Convenience: compute fee on a gross dollar amount. */
export function computePlatformFee(gross: number, badge?: string | null): number {
  const safe = Math.max(0, Number(gross) || 0);
  return Math.round(safe * (feePctForBadge(badge) / 100) * 100) / 100;
}
