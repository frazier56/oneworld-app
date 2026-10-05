import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { REPORT_REASONS, reportContent, blockUser, useRefreshBlocks, type ReportTarget } from "@job/lib/moderation";
import { useI18n, W, Wt } from "@job/lib/i18n";

/** Spanish for the shared reason list and the report target nouns (the English lives in moderation.ts). */
const REASON_ES: Record<string, string> = {
  spam: "Spam o estafa",
  harassment: "Acoso o intimidación",
  hate: "Discurso de odio o discriminación",
  sexual: "Contenido sexual o explícito",
  violence: "Violencia o amenazas",
  impersonation: "Suplantación o perfil falso",
  payment: "Problema de pago o fraude",
  other: "Otra cosa",
};
const TARGET_ES: Record<ReportTarget, string> = {
  post: "esta publicación", message: "este mensaje", review: "esta reseña", profile: "este perfil",
  job: "este trabajo", contract: "este contrato", comment: "este comentario",
};

/**
 * The report / block sheet. One component, reused from every user-generated surface — the feed, a
 * DM thread, a review, a public profile — so the affordance looks and behaves identically wherever
 * someone runs into something they want gone.
 *
 * Apple 1.2 requires BOTH: a way to report content and a way to block the person. Offering only
 * "report" reads as a black hole to the user, since nothing visibly changes for them; blocking is
 * the part that gives them immediate control. So both live here, and blocking is offered right
 * after a report lands rather than being buried on another screen.
 */
export default function ReportBlockSheet({
  open, onClose, targetType, targetId, targetUserId, targetName, onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  targetUserId?: string | null;
  targetName?: string | null;
  /** Fired after a successful block so the parent can drop the content from view immediately. */
  onBlocked?: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [stage, setStage] = useState<"pick" | "sent">("pick");
  const refreshBlocks = useRefreshBlocks();
  const { lang } = useI18n();
  const who = targetName?.trim() || W(lang, "this person", "esta persona");

  useEffect(() => {
    if (!open) return;
    setReason(""); setDetail(""); setErr(""); setStage("pick"); setBusy(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const submitReport = async () => {
    if (!reason || busy) return;
    setBusy(true); setErr("");
    const { error } = await reportContent({ targetType, targetId, targetUserId, reason, detail });
    setBusy(false);
    if (error) { setErr(error); return; }
    setStage("sent");
  };

  const doBlock = async () => {
    if (!targetUserId || busy) return;
    setBusy(true); setErr("");
    const { error } = await blockUser(targetUserId);
    setBusy(false);
    if (error) { setErr(error); return; }
    refreshBlocks();
    onBlocked?.();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[190] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label={W(lang, "Report or block", "Reportar o bloquear")}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-2xl dark:bg-[#141824] sm:m-4 sm:rounded-3xl">
        <button onClick={onClose} aria-label={W(lang, "Close", "Cerrar")} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border ow-edge text-lg">×</button>

        {stage === "pick" ? (
          <>
            <h2 className="text-xl font-extrabold">{W(lang, "Report this", "Reportar") + " " + W(lang, targetType, TARGET_ES[targetType])}</h2>
            <p className="mt-1 text-sm opacity-65">
              {Wt(lang, "Reports are private — {0} is never told who reported them. We review every one.", "Los reportes son privados — nunca se le dice a {0} quién lo reportó. Revisamos cada uno.", [who])}
            </p>

            <fieldset className="mt-4">
              <legend className="label">{W(lang, "What's wrong?", "¿Qué sucede?")}</legend>
              <div className="mt-1 space-y-1.5">
                {REPORT_REASONS.map((r) => (
                  <label key={r.id} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${ reason === r.id ? "border-brand bg-brand/10 ring-1 ring-brand" : "ow-edge hover:bg-brand/5"}`}>
                    <input type="radio" name="report-reason" value={r.id} checked={reason === r.id}
                      onChange={() => setReason(r.id)} className="accent-brand" />
                    {W(lang, r.label, REASON_ES[r.id] ?? r.label)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="label mt-4 block" htmlFor="report-detail">{W(lang, "Anything else? (optional)", "¿Algo más? (opcional)")}</label>
            <textarea id="report-detail" className="input min-h-[80px]" value={detail} maxLength={1000}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={W(lang, "Tell us what happened — it helps us act faster.", "Cuéntenos qué pasó — nos ayuda a actuar más rápido.")} />

            <button onClick={submitReport} disabled={!reason || busy} className="btn-primary mt-4 w-full disabled:opacity-50">
              {busy ? W(lang, "Sending…", "Enviando…") : W(lang, "Submit report", "Enviar reporte")}
            </button>

            {targetUserId && (
              <button onClick={doBlock} disabled={busy}
                className="mt-2 w-full rounded-full border border-red-500/30 py-2.5 text-sm font-bold text-red-500 transition active:scale-[.98]">
                {Wt(lang, "Block {0}", "Bloquear a {0}", [who])}
              </button>
            )}
            <p className="mt-2 text-center text-[11px] leading-snug opacity-55">
              {W(lang, "Blocking hides their posts and messages from you, and stops them contacting you. You can undo it any time in Settings.", "Bloquear oculta sus publicaciones y mensajes, e impide que lo contacte. Puede deshacerlo en cualquier momento en Configuración.")}
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mt-2 grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-3xl text-brand">✓</div>
            <h2 className="mt-4 text-center text-xl font-extrabold">{W(lang, "Report received", "Reporte recibido")}</h2>
            <p className="mt-2 text-center text-sm leading-relaxed opacity-70">
              {Wt(lang, "Thanks — we'll review this. {0} won't know you reported them.", "Gracias — lo revisaremos. {0} no sabrá que usted lo reportó.", [who])}
            </p>
            {targetUserId && (
              <>
                <p className="mt-4 text-center text-sm font-semibold">{W(lang, "Want to stop hearing from them too?", "¿También quiere dejar de recibir noticias de esta persona?")}</p>
                <button onClick={doBlock} disabled={busy}
                  className="mt-2 w-full rounded-full border border-red-500/30 py-2.5 text-sm font-bold text-red-500 transition active:scale-[.98]">
                  {busy ? W(lang, "Blocking…", "Bloqueando…") : Wt(lang, "Block {0}", "Bloquear a {0}", [who])}
                </button>
              </>
            )}
            <button onClick={onClose} className="btn-ghost mt-2 w-full">{W(lang, "Done", "Listo")}</button>
          </>
        )}

        {err && <p className="mt-3 text-center text-sm font-semibold text-red-500">{err}</p>}
      </div>
    </div>,
    document.body,
  );
}
