import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { shellControlCopy, useI18n } from "@oneworld/shell";

/**
 * GLOBAL INFO POPUP — persistent rule (Lee, Jul 25 2026):
 * every ⓘ in every One World app opens the SAME small popup:
 *   • rendered in a portal, CENTERED in the viewport (never runs off-screen left/right)
 *   • dismiss by tapping ANYWHERE (backdrop or the card itself)
 *   • NO "Got it" button, no close X
 * Do not re-introduce per-call-site anchored popovers — that's what caused the
 * Start-a-job / "Get your money right" tips to clip off the left edge on mobile.
 */

export function InfoPopup({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onTouchStart={onClose}
      /* z-200: above every modal/sheet in the app (Pickers 130, VaiaDescriptionModal 140) —
         an ⓘ opened from inside a modal must still be readable. */
      className="fixed inset-0 z-[200] flex items-center justify-center px-6 animate-[infotipIn_.14s_ease-out]"
      style={{ background: "rgba(0,0,0,.38)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
    >
      <div className="glass-modal w-full max-w-[19rem] rounded-2xl p-4 text-xs leading-relaxed shadow-2xl">
        {title && <div className="mb-1.5 text-sm font-semibold">{title}</div>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export default function InfoTip({
  text,
  title,
  className = "",
  size = 20,
}: {
  text: ReactNode;
  title?: string;
  className?: string;
  size?: number;
}) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <span className={`inline-flex ${className}`}>
      <button
        type="button"
        aria-label={shellControlCopy(lang).moreInfo}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        style={{ height: size, width: size }}
        className="grid shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-[11px] font-bold leading-none text-brand active:scale-95 transition"
      >
        i
      </button>
      <InfoPopup open={open} onClose={() => setOpen(false)} title={title}>
        {text}
      </InfoPopup>
    </span>
  );
}
