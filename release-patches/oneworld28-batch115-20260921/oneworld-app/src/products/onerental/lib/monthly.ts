import type { Property } from './rental';

export const MONTHLY_TERMS_VERSION = 'monthly-v2-20260917';

export function nextMonth(start: string): string {
  if (!/^\d{4}-\d{2}-01$/.test(start)) throw new Error('Choose the first of a calendar month');
  const date = new Date(`${start}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== start) throw new Error('Invalid month');
  date.setUTCMonth(date.getUTCMonth()+1);
  return date.toISOString().slice(0,10);
}

export function monthlyStay(start: string, amount: number) {
  if (!Number.isFinite(amount) || amount<=0) throw new Error('Invalid monthly rent');
  const end = nextMonth(start);
  return {starts_on:start,ends_on:end,nights:Math.round((Date.parse(end)-Date.parse(start))/86400000),total:amount};
}

/* ── ⛔ `monthlyTermLines()` AND `monthlyTerms()` ARE GONE. 17 September 2026. ────────────────
   They returned three sentences that were written into this file and shown on EVERY monthly
   listing on the platform, word for word, whoever owned it:

     "15 days' notice, from either side."
     "No penalty for leaving early."
     "Each renewal covers one calendar month, and needs approval and payment."

   Lee took them apart line by line and was right on all three. Notice of what, agreed by whom?
   There is no penalty because the month is already paid, so the sentence says nothing. And
   forcing a renewal into calendar months is a product decision imposed on a tenant, dressed up
   as a term they agreed to.

   A term nobody set is not a term. The replacement below reads the numbers a HOST actually
   typed — `lease_notice_days`, `payment_window_business_days`, `breach_penalty_months`, the
   columns the contract drafter has been using since 10 September — and returns nothing at all
   when the host has not turned their own terms on. Where there is no term, no term is shown. */

export type OwnerTermLine = { key: 'notice' | 'payWindow' | 'breach'; n: number };

/**
 * The host's own terms for this listing, or an empty list.
 *
 * Empty means one of two honest things: the host never switched their own terms on, or they
 * left every number at OneHome's fallback and therefore stated nothing of their own. Either
 * way the caller renders no section — never a placeholder, never an invented line.
 *
 * Returns keys and numbers rather than sentences so the seven-language copy table stays the one
 * place any wording lives. See the reason `detailCopy.ts` exists at all.
 */
export function ownerTermLines(p: Pick<Property,
  'owner_terms_enabled' | 'lease_notice_days' | 'payment_window_business_days' | 'breach_penalty_months'
> | null | undefined): OwnerTermLine[] {
  if (!p || p.owner_terms_enabled !== true) return [];
  const lines: OwnerTermLine[] = [];
  const notice = Number(p.lease_notice_days);
  const pay = Number(p.payment_window_business_days);
  const breach = Number(p.breach_penalty_months);
  if (Number.isFinite(notice) && notice > 0) lines.push({ key: 'notice', n: notice });
  if (Number.isFinite(pay) && pay > 0) lines.push({ key: 'payWindow', n: pay });
  if (Number.isFinite(breach) && breach > 0) lines.push({ key: 'breach', n: breach });
  return lines;
}
