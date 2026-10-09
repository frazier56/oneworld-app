/**
 * Lightweight FX rate fetcher for display-only currency conversion.
 *
 * Source: https://open.er-api.com (free, no key, USD-based, daily refresh).
 * Cached in sessionStorage for 1 hour so the dropdown is instant.
 *
 * Important: this is for *display only* — Stripe handles the actual payout
 * currency conversion based on the host's connected bank account.
 */

const CACHE_KEY = "onesocial:fx-rates:v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface FxSnapshot {
  base: "USD";
  rates: Record<string, number>;
  fetched_at: string; // ISO
  source: string;
}

let inflight: Promise<FxSnapshot> | null = null;

export async function getFxRates(): Promise<FxSnapshot> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as FxSnapshot;
      const age = Date.now() - new Date(parsed.fetched_at).getTime();
      if (age < CACHE_TTL_MS && parsed.rates && Object.keys(parsed.rates).length) {
        return parsed;
      }
    }
  } catch { /* ignore */ }

  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const resp = await fetch("https://open.er-api.com/v6/latest/USD");
      const json = await resp.json();
      if (!json?.rates) throw new Error("No rates in response");
      const snap: FxSnapshot = {
        base: "USD",
        rates: json.rates as Record<string, number>,
        fetched_at: new Date().toISOString(),
        source: "open.er-api.com",
      };
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(snap)); } catch { /* ignore */ }
      return snap;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Convert minor units (cents) from one currency to another using the snapshot. */
export function convertCents(
  amountCents: number,
  from: string,
  to: string,
  snap: FxSnapshot | null,
): number {
  if (!snap || !amountCents) return amountCents;
  const f = (from || "USD").toUpperCase();
  const t = (to || "USD").toUpperCase();
  if (f === t) return amountCents;
  const rFrom = f === "USD" ? 1 : snap.rates[f];
  const rTo = t === "USD" ? 1 : snap.rates[t];
  if (!rFrom || !rTo) return amountCents; // unknown currency → don't lie
  // amount in USD = amountCents / rFrom; convert to target
  return Math.round((amountCents / rFrom) * rTo);
}

/** True if we have a rate for both currencies in the snapshot. */
export function canConvert(from: string, to: string, snap: FxSnapshot | null): boolean {
  if (!snap) return false;
  const f = (from || "USD").toUpperCase();
  const t = (to || "USD").toUpperCase();
  if (f === t) return true;
  return !!(snap.rates[f] || f === "USD") && !!(snap.rates[t] || t === "USD");
}
