import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Family-canon (i) info affordance. The popover renders centered on screen via
 *  a portal (Lee, Jul 22) so it's ALWAYS fully readable — never clipped off the
 *  right edge regardless of where the (i) sits. Tap the (i), read, tap away.
 *  Optional `action` renders above "Got it" (e.g. an Upgrade button). */
export default function InfoTip({ text, label = "More info", dismissLabel = "Got it", action, onAction }: { text: ReactNode; label?: string; dismissLabel?: string; action?: ReactNode; onAction?: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      {/* v23 CU (Lee): "you could barely see the info button — it looks like a piece of
          dirt." Bigger glyph, thicker ring, real fill — reads as an (i), not a speck. */}
      <button type="button" aria-label={label} aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.6px] border-brand/70 bg-brand/10 text-[12px] font-extrabold leading-none text-brand transition hover:bg-brand/20"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        i
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-5" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" />
          <div role="tooltip" onClick={(e) => e.stopPropagation()}
            className="glass-modal relative w-full max-w-sm rounded-2xl p-4 text-left text-sm font-normal leading-relaxed shadow-2xl">
            {text}
            {action && (
              <div className="mt-3" onClick={() => { onAction?.(); setOpen(false); }}>
                {action}
              </div>
            )}
            <button type="button" onClick={() => setOpen(false)}
              className="mt-2 block w-full rounded-full bg-brand/15 py-2 text-center text-xs font-semibold text-brand">
              {dismissLabel}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
