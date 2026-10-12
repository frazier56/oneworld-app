/* ── THE SUGGESTED PRICE ──────────────────────────────────────────────────────────────────────
   Lee, 9 Oct 2026: "we should have a suggested price … time and distance … some type of table that
   we reference … they can always just decide they want to go higher or lower."

   A suggestion, never a rule: the rider can name any price, the driver can answer with any price.
   The table is per currency, because a ride is priced where it happens.

   COP — anchored to Medellín's regulated taxi fare for 2026 (El Colombiano, 2 Feb 2026):
         flag fall 5,900; 200 pesos per 82 m (≈ 2,440 per km); waiting 300 per minute; minimum 8,300.
         A taxi meter charges waiting OR distance, not both, so the per-minute part here is a smaller
         "traffic" allowance (150/min) on top of distance. Minimum rounded up to 9,000.
   USD — a typical US ride-share shape: 2.50 to start, 0.75 per km (≈ 1.20 per mile), 0.25 per
         minute, 8 minimum.
   Every suggestion is rounded to something a person would say out loud (1,000 pesos; 50 cents). */

export type FareTable = { base: number; perKm: number; perMin: number; minimum: number; round: number; step: number };

export const FARES: Record<string, FareTable> = {
  COP: { base: 5900, perKm: 2440, perMin: 150, minimum: 9000, round: 1000, step: 2000 },
  USD: { base: 2.5, perKm: 0.75, perMin: 0.25, minimum: 8, round: 0.5, step: 2.5 },
};

export const fareFor = (currency: string): FareTable => FARES[currency] ?? FARES.USD;

/** The suggested price for a route, in the ride's own currency. */
export function suggestFare(km: number, minutes: number, currency: string): number {
  const t = fareFor(currency);
  const raw = t.base + Math.max(0, km) * t.perKm + Math.max(0, minutes) * t.perMin;
  const rounded = Math.round(Math.max(raw, t.minimum) / t.round) * t.round;
  return Number(rounded.toFixed(2));
}

/** One tap of the + / − buttons, in the ride's currency (Lee: "$2.50 would be pretty good"). */
export const fareStep = (currency: string): number => fareFor(currency).step;
