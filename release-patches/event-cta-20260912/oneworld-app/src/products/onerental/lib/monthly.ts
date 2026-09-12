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
export function monthlyTerms(es=false) {
  return es
    ? 'Mes a mes. Aviso de 15 días por cualquiera de las partes. Sin penalización por terminación anticipada. El canon de un mes parcial se acuerda por separado. Cada renovación cubre un mes calendario y requiere aprobación y confirmación de pago. La legislación obligatoria sigue aplicando.'
    : 'Month to month. Either party gives 15 days’ notice. No early-termination penalty. Partial-month rent is agreed separately. Each renewal covers one calendar month and requires approval and payment confirmation. Mandatory local law still applies.';
}
