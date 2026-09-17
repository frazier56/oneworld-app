export function rentalMoney(amount: number, currency: string | null | undefined, lang: string) {
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
