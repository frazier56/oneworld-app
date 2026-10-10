import { Link } from "react-router-dom";
import { useState } from "react";
import { useI18n, useOneId, useAsyncResult, supabase, productHref, W, ScreenHeading,} from "@oneworld/shell";
import { notificationPath } from "../../onerental/lib/requestDisplay";

/**
 * /rentals/alerts — the bell.
 * ============================================================================================
 * A product that names a `notificationsPath` and then 404s on it is a broken control in the
 * header of every screen. This reads the shared `notifications` table filtered to this product,
 * so nothing new is invented for OneRental's bell.
 */
export default function Alerts() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [retry, setRetry] = useState(0);

  const [readError, setReadError] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const { data: result, error } = useAsyncResult(async () => {
    if (!userId) return { ownerId: userId, rows: [] };
    const { data, error: readError } = await supabase.from("notifications")
      .select("id, title, body, created_at, read_at, action_url")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    if (readError) throw readError;
    return { ownerId: userId, rows: data ?? [] };
  }, [userId, retry]);
  const rows = result?.ownerId === userId ? result.rows : undefined;
  async function markRead(id: string) {
    if (!userId || marking) return;
    setMarking(id); setReadError(false);
    try {
      const { error } = await supabase.from("notifications")
        .update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
      if (error) throw error;
      window.dispatchEvent(new Event("ow-notifications-changed"));
      setRetry(n => n + 1);
    } catch { setReadError(true); }
    finally { setMarking(null); }
  }

  return (
    <div className="space-y-4">
      <ScreenHeading>{W(lang, "Alerts", "Avisos")}</ScreenHeading>
      <div className="mt-4 space-y-2">
        {!!error && <div role="alert" className="card p-4">
          <p>{W(lang, "Could not load alerts.", "No se pudieron cargar los avisos.")}</p>
          <button type="button" className="btn-ghost mt-2" onClick={() => setRetry(n => n + 1)}>{W(lang, "Try again", "Reintentar")}</button>
        </div>}
        {rows === undefined && !error && [0, 1].map(i => <div key={i} className="card ow-shimmer h-16" />)}
        {!error && rows?.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm font-bold">{W(lang, "Nothing yet.", "Nada todavía.")}</p>
            <p className="mt-1 text-[12.5px] opacity-55">
              {W(lang,
                "You will hear from us when someone asks about a place, signs a contract, or answers your walkthrough photos.",
                "Le avisaremos cuando alguien pregunte por un inmueble, firme un contrato o responda las fotos del acta.")}
            </p>
          </div>
        )}
        {rows?.map((n: any) => (
          <article key={n.id} className="card p-3">
          <Link to={notificationPath(n.action_url, productHref("onesale"))} className="ow-tap block">
            <p className="text-[13.5px] font-bold">{!n.read_at && <span className="mr-2 text-brand" aria-label={W(lang, "Unread", "Sin leer")}>●</span>}{n.title}</p>
            {n.body && <p className="mt-0.5 text-[12.5px] leading-snug opacity-70">{n.body}</p>}
          </Link>
          {!n.read_at && <button type="button" className="btn-ghost mt-2" disabled={marking !== null} onClick={() => void markRead(n.id)}>{W(lang, "Mark as read", "Marcar como leído")}</button>}
          </article>
        ))}
        {readError && <p role="alert">{W(lang, "Could not mark this alert as read. Try again.", "No se pudo marcar el aviso como leído. Reintente.")}</p>}
      </div>
    </div>
  );
}
