import { useEffect, useRef, useState } from 'react';
import { W, supabase } from '@oneworld/shell';

type HelpContext = {
  request_id: string;
  eligible: boolean;
  receipt_confirmed: boolean;
  payment_reported_at: string | null;
  case: null | { id: string; status: 'open' | 'in_review'; created_at: string; version: number };
};

function valid(value: unknown, requestId: string): value is HelpContext {
  if (!value || typeof value !== 'object') return false;
  const v = value as HelpContext;
  return v.request_id === requestId && typeof v.eligible === 'boolean' && typeof v.receipt_confirmed === 'boolean'
    && (v.payment_reported_at === null || typeof v.payment_reported_at === 'string')
    && (v.case === null || (typeof v.case === 'object' && typeof v.case.id === 'string'
      && ['open', 'in_review'].includes(v.case.status)));
}

// Candidate component: wire only after the case RPCs and real Admin Ops queue ship together.
export default function ReservationPaymentHelp({ requestId, lang }: { requestId: string; lang: string }) {
  const [context, setContext] = useState<HelpContext | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const submitting = useRef(false);
  const activeRequest = useRef(requestId);
  activeRequest.current = requestId;

  useEffect(() => {
    const current = ++generation.current;
    let stopped = false;
    setContext(null); setError(false);
    async function load() {
      try {
        const { data, error: rpcError } = await supabase.rpc('rental_payment_help_context', { p_request_id: requestId });
        if (stopped || generation.current !== current || activeRequest.current !== requestId) return;
        if (rpcError || !valid(data, requestId)) throw new Error('Unavailable');
        setContext(data);
      } catch {
        if (!stopped && generation.current === current && activeRequest.current === requestId) setError(true);
      }
    }
    void load();
    return () => { stopped = true; };
  }, [requestId, refresh]);

  useEffect(() => {
    const reload = () => { if (!submitting.current) setRefresh(value => value + 1); };
    const timer = window.setInterval(reload, 60000);
    window.addEventListener('pageshow', reload);
    return () => { window.clearInterval(timer); window.removeEventListener('pageshow', reload); };
  }, []);

  async function requestHelp() {
    if (submitting.current || !context?.eligible || context.case || context.receipt_confirmed) return;
    submitting.current = true; setBusy(true); setError(false);
    const current = ++generation.current;
    try {
      const { data, error: rpcError } = await supabase.rpc('request_rental_payment_help', { p_request_id: requestId });
      if (generation.current !== current || activeRequest.current !== requestId) return;
      if (rpcError || !valid(data, requestId)) throw new Error('Unavailable');
      setContext(data);
    } catch {
      if (generation.current === current && activeRequest.current === requestId) {
        setContext(null); setError(true);
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  const current = context?.request_id === requestId ? context : null;
  return <section className="mt-3 min-w-0 rounded-xl border p-3 text-sm" aria-label={W(lang, 'Payment help', 'Ayuda con el pago')}>
    <h3 className="font-bold">{W(lang, 'Payment help', 'Ayuda con el pago')}</h3>
    {error ? <div role="alert">
      <p>{W(lang, 'Could not check payment help. Refresh before trying again.', 'No se pudo consultar la ayuda con el pago. Actualice antes de intentarlo de nuevo.')}</p>
      <button type="button" className="btn-primary mt-2" style={{ minHeight: 44, padding: '8px 16px' }} disabled={busy} onClick={() => setRefresh(v => v + 1)}>{W(lang, 'Refresh status', 'Actualizar estado')}</button>
    </div> : !current ? <p role="status">{W(lang, 'Checking payment status…', 'Consultando el estado del pago…')}</p>
      : current.receipt_confirmed ? <p role="status">{W(lang, 'The host confirmed receipt. Check the reservation status for any remaining steps.', 'El anfitrión confirmó la recepción. Consulte el estado de la reserva para ver los pasos pendientes.')}</p>
        : current.case ? <p role="status">{current.case.status === 'in_review'
          ? W(lang, 'Your payment help request is marked in review. Receipt is still unconfirmed.', 'Su solicitud de ayuda con el pago está marcada en revisión. La recepción sigue sin confirmar.')
          : W(lang, 'Your help request is saved. Receipt is still unconfirmed.', 'Su solicitud de ayuda quedó guardada. La recepción sigue sin confirmar.')}</p>
          : current.eligible ? <>
            <p>{W(lang, 'The host has not confirmed receipt after 24 hours. You can request help with this payment report.', 'El anfitrión no ha confirmado la recepción después de 24 horas. Puede solicitar ayuda con este reporte de pago.')}</p>
            <button type="button" className="btn-primary mt-2 w-full" style={{ minHeight: 44, padding: '8px 16px' }} disabled={busy} onClick={() => void requestHelp()}>{busy ? W(lang, 'Saving…', 'Guardando…') : W(lang, 'Request payment help', 'Solicitar ayuda con el pago')}</button>
          </> : <p>{W(lang, 'Help requests open 24 hours after reporting an external payment, while receipt remains unconfirmed.', 'Las solicitudes de ayuda se habilitan 24 horas después de reportar un pago externo, mientras la recepción siga sin confirmar.')}</p>}
    <p className="mt-2 text-xs opacity-70">{W(lang, 'A help request does not confirm payment, change your reservation or guarantee recovery of an external transfer.', 'Una solicitud de ayuda no confirma el pago, no cambia su reserva ni garantiza la recuperación de una transferencia externa.')}</p>
  </section>;
}
