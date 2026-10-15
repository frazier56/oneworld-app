import { createPortal } from "react-dom";
import { W } from "@oneworld/shell";

/* ============================================================================================
 * LEAVING AN UNFINISHED LISTING — keep it or throw it away. Never "lose it silently".
 *
 * Lee, 2 Oct 2026: *"if they click back enough times, it's going to say, do you want to totally
 * discard this listing or delete it? Or do you want to save it?"*
 *
 * It replaces a `window.confirm("Leave without saving? Anything you have typed here will be
 * lost.")` that was both untrue (the draft was already saving itself) and the wrong choice to
 * offer. Three answers, in the order people want them: keep (the safe default, filled), discard
 * (red, because it deletes), and stay.
 * ==========================================================================================*/
export default function LeaveDraftDialog({ open, lang, busy, onKeep, onDiscard, onStay }: {
  open: boolean; lang: string; busy?: false | "keep" | "discard";
  onKeep: () => void; onDiscard: () => void; onStay: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog" aria-modal="true" onClick={() => !busy && onStay()}>
      <div className="glass-modal w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-[17px] font-black tracking-tight">{W(lang, "Keep this listing as a draft?", "¿Guardar este anuncio como borrador?")}</h2>
        <p className="mt-1 text-[13px] leading-relaxed opacity-65">
          {W(lang,
            "Choose Keep draft to save your current photos, videos and details before leaving. If saving fails, you will stay here so you can try again.",
            "Elija Guardar borrador para guardar sus fotos, videos y datos antes de salir. Si no se puede guardar, permanecerá aquí para volver a intentarlo.")}
        </p>
        <div className="mt-4 grid gap-2">
          <button type="button" className="btn-primary w-full" disabled={!!busy} onClick={onKeep}>
            {busy === "keep" ? W(lang, "Saving…", "Guardando…") : W(lang, "Keep draft", "Guardar borrador")}
          </button>
          <button type="button" disabled={!!busy} onClick={onDiscard}
            className="ow-tap w-full rounded-2xl border border-red-500/40 py-3 text-[14.5px] font-bold text-red-600 transition active:scale-[.98] disabled:opacity-50 dark:text-red-400">
            {busy === "discard" ? W(lang, "Discarding…", "Descartando…") : W(lang, "Discard listing", "Descartar anuncio")}
          </button>
          <button type="button" disabled={!!busy} onClick={onStay}
            className="ow-edge ow-tap w-full rounded-2xl border py-3 text-[14.5px] font-bold transition active:scale-[.98]">
            {W(lang, "Keep editing", "Seguir editando")}
          </button>
        </div>
      </div>
    </div>,
    document.body);
}
