import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAsyncResult } from "../lib/useAsync";
import { useOneId } from "../lib/oneId";
import { W } from "../lib/i18n";
import "../lib/identityCopy";

/**
 * ONE ID VERIFIED — the ONE identity check every app uses (overlay 47, 5 Oct 2026).
 * ============================================================================================
 * Lee: "can't have people posing as agents taking people's money… Veriff is going to be bigger
 * than one app… spine level." So this lives in the shell, once: OneHome, OneJob, OneAgent and
 * OneScore render the same chip, the same button and the same words.
 *
 *  · ONE PERSON, ONE CHECK. The status comes from `my_identity_status()` — the person, not the app.
 *    Someone verified for a OneJob payout is already verified for a OneHome commission.
 *  · THE SERVER DECIDES. This component only opens the check and shows where it stands; every money
 *    endpoint asks the database (`identity_ok`) itself. Hiding this button protects nothing.
 *  · Opens Veriff's own page (redirect) in the reader's language; Veriff sends the person back to
 *    `returnPath` on this app. ID photos never touch OneWorld's servers.
 */
export type IdentityStatus = {
  verified: boolean; since: string | null; valid_until: string | null; first_name: string | null; last_name: string | null;
  last_status: string | null; last_status_at: string | null; open_session_url: string | null;
};

/** Veriff's language codes for OneWorld's seven. */
const VERIFF_LANG: Record<string, string> = { en: "en", es: "es-latam", co: "es-latam", de: "de", pt: "pt", ru: "ru", zh: "zh" };

export function useIdentityStatus() {
  const { userId } = useOneId();
  const r = useAsyncResult<IdentityStatus | null>(async () => {
    const { data, error } = await supabase.rpc("my_identity_status");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return (row ?? null) as IdentityStatus | null;
  }, [userId], !!userId);
  return r;
}

export default function VerifyIdentity({ purpose, lang, returnPath, compact = false }: {
  /** Must be a row in identity_gates (sale_payee, rental_host_payout, onejob_payout, …). */
  purpose: string; lang: string; returnPath?: string; compact?: boolean;
}) {
  const { data: st, error, loading, retry } = useIdentityStatus();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMsg(null);
    try {
      const path = returnPath ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
      const { data, error: e } = await supabase.functions.invoke("identity-start", { body: { purpose, returnPath: path } });
      if (e || !data) {
        let code = ""; try { code = (await (e as { context?: { json?: () => Promise<{ code?: string }> } })?.context?.json?.())?.code ?? ""; } catch { /* not json */ }
        setMsg(code === "not_configured"
          ? W(lang, "Identity checks are not switched on yet.", "La verificación de identidad aún no está activada.")
          : W(lang, "The identity check could not be opened. Try again.", "No se pudo abrir la verificación. Inténtelo de nuevo."));
        return;
      }
      if (data.verified) { retry(); return; }
      if (data.url) {
        const u = new URL(String(data.url));
        u.searchParams.set("lang", VERIFF_LANG[lang] ?? "en");
        window.location.assign(u.toString());
      }
    } finally { inFlight.current = false; setBusy(false); }
  }

  if (loading) return null;
  if (error) return (
    <button type="button" className="btn-ghost text-[13px]" onClick={retry}>{W(lang, "Identity status didn't load. Try again", "No cargó el estado de identidad. Reintentar")}</button>
  );

  if (st?.verified) return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2.5 py-1 text-[12.5px] font-bold text-emerald-700 dark:text-emerald-300" data-ow="identity-verified">
      <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor"><path d="M10 1.5l2.3 1.7 2.8-.2.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.2L10 18.5l-2.3-1.7-2.8.2-.9-2.7L1.7 12.7l.9-2.7-.9-2.7L4 5.7l.9-2.7 2.8.2z" opacity=".25"/><path d="M8.6 12.6L6.2 10.2l-1 1 3.4 3.4 6.2-6.2-1-1z"/></svg>
      {W(lang, "ID verified", "Identidad verificada")}
    </span>
  );

  const s = st?.last_status ?? null;
  const pending = s === "submitted" || s === "review" || (s === "approved" && !st?.verified);
  const line = pending
    ? W(lang, "Your ID is being reviewed. We'll let you know.", "Su identificación está en revisión. Le avisaremos.")
    : s === "declined" ? W(lang, "The last check didn't pass. Try again with a valid document.", "La última verificación no pasó. Inténtelo con un documento válido.")
    : s === "resubmission_requested" ? W(lang, "The photo wasn't clear. Retake it to finish.", "La foto no se veía bien. Tómela de nuevo para terminar.")
    : W(lang, "Verify your identity once with a photo of your ID and a selfie. It works across every OneWorld app.", "Verifique su identidad una sola vez con una foto de su documento y una selfie. Sirve en todas las apps de OneWorld.");

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2 rounded-2xl border border-ink/10 p-3 dark:border-white/10"} data-ow="identity-verify">
      <p className="text-[13px]">{line}</p>
      {!pending && (
        <button type="button" className="btn-primary w-full text-[13.5px] disabled:opacity-50" disabled={busy} onClick={() => void start()}>
          {s === "resubmission_requested" ? W(lang, "Retake photo", "Tomar foto de nuevo")
            : s === "declined" ? W(lang, "Try again", "Intentar de nuevo")
            : W(lang, "Verify identity", "Verificar identidad")}
        </button>
      )}
      {!compact && !pending && (
        <p className="text-[11.5px] opacity-70">{W(lang, "Checked by Veriff, our identity partner. Your ID photos stay with Veriff; OneWorld keeps only the result and your verified name.", "Lo verifica Veriff, nuestro socio de identidad. Las fotos de su documento quedan con Veriff; OneWorld guarda solo el resultado y su nombre verificado.")}</p>
      )}
      {msg && <p className="text-[12.5px] font-semibold text-rose-600 dark:text-rose-300" role="alert">{msg}</p>}
    </div>
  );
}
