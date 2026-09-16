export const MONTHLY_TERMS_VERSION = 'monthly-v1-20260906';
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
/* ── SIX CLAUSES IN ONE GREY PARAGRAPH IS NOT A TERM SHEET ──────────────────────────────────
   Lee, 14 September 2026, on the request review screen: *"It talks about month-to-month stay… I
   would look at this compared to how Airbnb is doing and figure out, is that too much text?"*

   It was six sentences run together at 12.5px, sitting above the tenant's own name — so the first
   thing a host read about a person was a wall of contract boilerplate. Two of the six said nothing
   a host did not already know from the words "month to month", and "mandatory local law still
   applies" is true of every sentence in every agreement on the platform.

   What is left is the three facts that change what somebody would DO: how much notice, what
   leaving early costs, and what a renewal needs. Returned as lines rather than one block, so the
   screen can lay them out as three facts instead of a paragraph. */
export function monthlyTermLines(es = false): string[] {
  return es
    ? ['Aviso de 15 días, de cualquiera de las partes.',
       'Sin penalización por terminación anticipada.',
       'Cada renovación cubre un mes calendario y requiere aprobación y pago.']
    : ['15 days’ notice, from either side.',
       'No penalty for leaving early.',
       'Each renewal covers one calendar month, and needs approval and payment.'];
}

/** @deprecated Use `monthlyTermLines`. Kept for any caller still rendering one paragraph. */
export function monthlyTerms(es=false) {
  return monthlyTermLines(es).join(' ');
}
