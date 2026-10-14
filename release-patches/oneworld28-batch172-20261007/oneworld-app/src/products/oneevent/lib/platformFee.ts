/**
 * Tiered platform fee — replaces the flat 8.99% with a per-badge schedule.
 * Badge holders save. Founder = lowest, near Stripe-only floor.
 *
 * ⚠️ NOT THE FEE SOURCE OF TRUTH, AND NOT USED (PUB30, 13 Oct 2026, from WORLDFEED30's UAT).
 * Nothing imports this file. Every live path charges the shell's `FEE_RATE` (5.99%), which the
 * database's `platform_fee_rate()` agrees with. This tiered schedule is an unshipped idea; wiring
 * it up as-is would charge most hosts 8.99%. Do not import it without Lee deciding the schedule.
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
