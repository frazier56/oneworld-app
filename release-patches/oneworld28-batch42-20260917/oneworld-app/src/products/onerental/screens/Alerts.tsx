import ReservationNotificationSettings from "../components/ReservationNotificationSettings";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, useOneId, supabase, W, ScreenHeading } from '@oneworld/shell';
import { notificationPath } from '../lib/requestDisplay';
type Notice = { id: string; type: string; metadata?: { review_role?: string }; title: string; body: string | null; read_at: string | null; action_url: string | null };
/** Family-wide inbox, matching the bell's explicit user scope. */
export default function Alerts() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [state, setState] = useState<{ user: string | null; rows?: Notice[]; error?: boolean }>({ user: null });
  const [retry, setRetry] = useState(0);
  const [readError, setReadError] = useState(false);
  useEffect(() => {
    let alive = true;
    setState({ user: userId }); setReadError(false);
    if (!userId) return;
    const pull = async () => {
      try {
        const { data, error } = await supabase.from('notifications')
          .select('id, type, metadata, title, body, created_at, read_at, action_url')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        if (alive) setState({ user: userId, rows: data ?? [] });
      } catch { if (alive) setState({ user: userId, error: true }); }
    };
    void pull();
    const timer = window.setInterval(pull, 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [userId, retry]);
  const rows = state.user === userId ? state.rows : undefined;
  async function markRead(n: Notice) {
    if (!userId || n.read_at) return;
    try {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() })
        .eq('id', n.id).eq('user_id', userId);
      if (error) throw error;
      window.dispatchEvent(new Event('ow-notifications-changed'));
      setRetry(x => x + 1);
    } catch { setReadError(true); }
  }
  return <div className="space-y-4">
    <ScreenHeading>{W(lang, 'Alerts', 'Avisos')}</ScreenHeading>
    <ReservationNotificationSettings lang={lang} />
    <Link className="btn-ghost inline-flex" to="/rentals/requests">{W(lang, 'Showings & rental requests', 'Visitas y solicitudes de arriendo')}</Link>
    {!userId ? <p>{W(lang, 'Sign in to see your alerts.', 'Inicie sesión para ver sus avisos.')}</p> : <div className="space-y-2">
      {state.user === userId && state.error ? <div role="alert" className="card p-4">
        <p>{W(lang, 'Could not load alerts.', 'No se pudieron cargar los avisos.')}</p>
        <button className="btn-ghost mt-2" onClick={() => setRetry(x => x + 1)}>{W(lang, 'Try again', 'Reintentar')}</button>
      </div> : rows === undefined ? <div className="card ow-shimmer h-16" /> : rows.length === 0 ? <div className="card p-8 text-center">
        <p className="text-sm font-bold">{W(lang, 'Nothing yet.', 'Nada todavía.')}</p>
      </div> : rows.map(n => <article key={n.id} className="card p-4">
        <Link to={notificationPath(n.action_url)} className="ow-tap block">
          <p className="text-sm font-bold">{!n.read_at && <span className="mr-2 text-brand" aria-label={W(lang, 'Unread', 'Sin leer')}>●</span>}{n.type === 'rental_review_due' ? (n.metadata?.review_role === 'guest' ? W(lang, 'Review your stay', 'Reseñe su estadía') : W(lang, 'Review your guest', 'Reseñe a su huésped')) : n.title}<span aria-hidden="true" className="ml-2">→</span></p>
          {n.body && <p className="mt-1 text-sm opacity-70">{n.type === 'rental_review_due' ? (n.metadata?.review_role === 'guest' ? W(lang, 'Share separate feedback about the property and host.', 'Comparta su opinión por separado sobre el inmueble y el anfitrión.') : W(lang, 'Share feedback about the guest from this completed stay.', 'Comparta su opinión sobre el huésped de esta estadía finalizada.')) : n.body}</p>}
        </Link>
        {!n.read_at && <button className="btn-ghost mt-2" onClick={() => void markRead(n)}>{W(lang, 'Mark as read', 'Marcar como leído')}</button>}
      </article>)}
      {readError && <p role="alert">{W(lang, 'Could not mark this alert as read. Try again.', 'No se pudo marcar el aviso como leído. Reintente.')}</p>}
    </div>}
  </div>;
}
