import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOneId, useI18n, W } from '@oneworld/shell';
import { loadRentalRequests, type RentalRequest } from '../lib/requestNavigation';
import { rentalMoney } from '../lib/requestDisplay';
export default function RentalRequests({ conversationId }: { conversationId?: string }) {
  const { userId } = useOneId();
  const { lang } = useI18n();
  const [state, setState] = useState<{ key: string; rows?: RentalRequest[]; error?: boolean }>({ key: '' });
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState(false);
  const key = `${userId}:${conversationId ?? ''}:${history}`;
  useEffect(() => {
    let alive = true;
    setState({ key });
    if (!userId) return;
    loadRentalRequests(userId, conversationId, history).then(rows => { if (alive) setState({ key, rows }); })
      .catch(() => { if (alive) setState({ key, error: true }); });
    return () => { alive = false; };
  }, [key, retry]);
  if (!userId) return null;
  const rows = state.key === key ? state.rows : undefined;
  const current = (r: RentalRequest) => ['requested', 'accepted'].includes(r.state);
  const shown = rows?.filter(r => conversationId || !history ? current(r) : !current(r));
  const labels: Record<string, [string, string]> = { requested: ['Pending review', 'Pendiente de revisión'], accepted: ['Approved', 'Aprobado'], declined: ['Declined', 'Rechazado'], cancelled: ['Cancelled', 'Cancelado'], expired: ['Expired', 'Vencido'] };
  return <section className="space-y-3" aria-label={W(lang, 'Rental requests', 'Solicitudes de arriendo')}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-bold">{W(lang, 'Rental requests', 'Solicitudes de arriendo')}</h2>
      {!conversationId && <button className="btn-ghost" onClick={() => setHistory(x => !x)}>{history ? W(lang, 'Current requests', 'Solicitudes actuales') : W(lang, 'Request history', 'Historial de solicitudes')}</button>}
    </div>
    {state.key === key && state.error ? <div className="card p-4" role="alert">
      <p>{W(lang, 'Could not load rental requests.', 'No se pudieron cargar las solicitudes.')}</p>
      <button className="btn-ghost mt-2" onClick={() => setRetry(x => x + 1)}>{W(lang, 'Try again', 'Reintentar')}</button>
    </div> : !rows ? <div className="card ow-shimmer h-24" /> : !shown?.length ? <p className="text-sm opacity-60">{history ? W(lang, 'No past requests.', 'Sin solicitudes anteriores.') : W(lang, 'No current rental requests.', 'Sin solicitudes de arriendo actuales.')}</p> : shown.map(r => <article key={r.id} className="card space-y-2 p-4">
      <p className="text-sm font-bold">{r.title}</p>
      <p className="text-sm">{r.guest_name || W(lang, 'Renter', 'Arrendatario')} · {r.starts_on} → {r.ends_on}</p>
      <p className="text-xs font-semibold text-brand">{labels[r.state] ? W(lang, ...labels[r.state]) : r.state}</p>
      <dl className="space-y-1 text-sm">
        {[[W(lang, 'Rent', 'Canon'), r.quoted_total], [W(lang, 'Guest pays', 'El huésped paga'), r.guest_total], [W(lang, 'Host receives', 'El anfitrión recibe'), r.host_net]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-3"><dt>{label}</dt><dd className="font-semibold">{rentalMoney(Number(value), r.currency, lang)}</dd></div>)}
      </dl>
      {current(r) ? <Link className="btn-brand inline-flex min-h-11 items-center" to={r.hostId === userId ? `/rentals/r/${r.property_id}/contract?request=${r.id}` : r.contract_id ? `/rentals/c/${r.contract_id}` : `/rentals/r/${r.property_id}?request=${r.id}`}>{r.hostId === userId ? W(lang, 'Review request', 'Revisar solicitud') : r.contract_id ? W(lang, 'View agreement', 'Ver contrato') : W(lang, 'View request', 'Ver solicitud')}</Link>
        : r.contract_id ? <Link className="btn-ghost inline-flex" to={`/rentals/c/${r.contract_id}`}>{W(lang, 'View agreement', 'Ver contrato')}</Link> : null}
    </article>)}
    {rows?.length === 100 && <p className="text-xs opacity-60">{W(lang, 'Showing the latest 100 requests.', 'Se muestran las últimas 100 solicitudes.')}</p>}
  </section>;
}
