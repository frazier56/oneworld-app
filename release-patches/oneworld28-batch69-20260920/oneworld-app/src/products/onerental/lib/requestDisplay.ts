/* ⚠️ THIS PRINTED "COPNaN" ON A LIVE MONEY ROW. 20 September 2026.
   `Intl.NumberFormat.format(NaN)` does not throw — it renders the currency code followed by the
   word NaN, which is how the rental requests screen came to show "Host receives COPNaN" the
   moment one amount was missing. A money figure the app cannot compute must not be rendered as a
   word that looks like a figure: an em dash says "not known" and cannot be misread as an amount.

   The trigger here was a preview fixture with no `host_net`, and every real row has one — but a
   formatter that turns a missing number into text on a screen about somebody's rent is a defect
   whatever fed it. Guarded at the formatter, so no call site has to remember. */
export function rentalMoney(amount: number, currency: string | null | undefined, lang: string) {
  if (!Number.isFinite(amount)) return '—';
  const code = currency || 'COP';
  return new Intl.NumberFormat(lang === 'es' || lang === 'co' ? 'es-CO' : 'en-US', {
    style: 'currency', currency: code, currencyDisplay: 'code', maximumFractionDigits: code === 'COP' ? 0 : 2,
  }).format(amount);
}
export function contractStatus(status: string, lang: string) {
  const labels: Record<string, [string, string]> = {
    draft: ['Draft — not sent yet', 'Borrador — aún no enviado'], sent: ['Sent for signing', 'Enviado para firma'],
    active: ['Active', 'Activo'], awaiting_first_payment: ['Awaiting first payment', 'Pendiente del primer pago'],
    declined: ['Declined', 'Rechazado'], cancelled: ['Cancelled', 'Cancelado'], ended: ['Ended', 'Finalizado'], expired: ['Expired', 'Vencido'],
  };
  return labels[status]?.[lang === 'es' || lang === 'co' ? 1 : 0] ?? status;
}
export function unsignedTenantStatus(status: string, lang: string) {
  const es = lang === 'es' || lang === 'co';
  if (status === 'draft') return es ? 'No enviado para firma.' : 'Not sent for signing.';
  if (status === 'sent') return es ? 'Esperando la firma del arrendatario.' : "Waiting on the tenant's signature.";
  return es ? 'Sin firma del arrendatario registrada.' : 'No tenant signature recorded.';
}
export function notificationPath(value: string | null | undefined, fallback = '/rentals') {
  if (!value) return fallback;
  try {
    const url = new URL(value, 'https://app.oneworldlabs.ai');
    return url.origin === 'https://app.oneworldlabs.ai' ? url.pathname + url.search + url.hash : fallback;
  } catch { return fallback; }
}
