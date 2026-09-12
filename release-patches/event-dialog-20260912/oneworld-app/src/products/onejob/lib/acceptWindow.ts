/**
 * HOW LONG DO THEY GET TO ACCEPT? — the accept window.
 *
 * Lee, Jul 26 2026: "you can put a time frame around how long you want to give people to accept the
 * job before the job expires... six hours, twelve hours, twenty four hours, forty eight hours. And
 * the job itself will have an expiration — if it wasn't accepted, it would just fall off."
 *
 * WHY IT MATTERS FOR MONEY, not just tidiness. When a payer sends a contract we put a real
 * authorization on their card. That hold reduces their available balance and Stripe kills it after
 * roughly 7 days. A contract nobody ever accepts therefore sits there quietly tying up someone's
 * money for a week. The accept window is the promise we make to the payer: if they don't answer
 * inside this many hours, we release your card and close the contract.
 *
 * The same value drives three separate things, which is exactly why it lives in one file:
 *   • the picker on the contract form (what the payer chooses)
 *   • the countdown both parties see while it's pending
 *   • the server-side sweeper that actually releases the hold when it runs out
 */

export const ACCEPT_WINDOWS = [6, 12, 24, 48] as const;
export type AcceptWindow = (typeof ACCEPT_WINDOWS)[number];

/** 24 hours is the default: long enough to survive a night's sleep, short enough to keep a card free. */
export const DEFAULT_ACCEPT_HOURS: AcceptWindow = 24;

export const windowLabel = (h: number) => (h === 48 ? "2 days" : h === 24 ? "1 day" : `${h} hours`);

/** ISO deadline for a window starting now. */
export const deadlineFrom = (hours: number, from: Date = new Date()) =>
  new Date(from.getTime() + hours * 3600_000).toISOString();

export type TimeLeft = { expired: boolean; ms: number; text: string; urgent: boolean };

/**
 * Human countdown. Deliberately coarse above an hour — "expires in 7h" is easier to act on than
 * "6:59:41", and a ticking second hand on someone's money reads as pressure, not information.
 * Under an hour we do show minutes, because that's when it genuinely matters.
 */
export function timeLeft(deadline?: string | null, now: Date = new Date()): TimeLeft | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return { expired: true, ms: 0, text: "expired", urgent: true };
  const mins = Math.floor(ms / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const text =
    days >= 1 ? `${days}d ${hrs % 24}h left`
    : hrs >= 1 ? `${hrs}h ${mins % 60}m left`
    : `${Math.max(1, mins)}m left`;
  return { expired: false, ms, text, urgent: hrs < 2 };
}
