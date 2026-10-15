/* ── PAYING IN THE APP: NOT YET (Lee, 15 Oct 2026) ─────────────────────────────────────────────
   OneRide is open to everyone, but local Colombian payments are not set up. A rider who taps
   "Pay in app" gets this small box instead of a payment screen, and pays the driver directly.
   When local payments ship, PaymentPanel calls the real checkout again and this file goes away. */
import { createPortal } from "react-dom";
import { useI18n, useModalFocus, W } from "@oneworld/shell";

export default function LocalPayNotice({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n();
  const dialog = useModalFocus(true, onClose);
  return createPortal(
    <div ref={dialog} tabIndex={-1} className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(11,15,26,.42)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="ow-ride-localpay-title">
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/40 p-5 text-center dark:border-white/[0.12]"
        style={{ background: "var(--overlay-bg)", boxShadow: "var(--frostedge), var(--glass-shadow)" }}>
        <p id="ow-ride-localpay-title" className="text-[16px] font-extrabold">
          {/* Two deliberate lines, so "soon" never wraps alone. */}
          <span className="block">{W(lang, "Local payments for Colombia", "Pagos locales para Colombia")}</span>
          <span className="block">{W(lang, "coming soon", "muy pronto")}</span>
        </p>
        <p className="mt-2 text-[14px] leading-snug opacity-75">
          {W(lang, "For now, pay your driver directly.", "Por ahora, pague directamente a su conductor.")}
        </p>
        <button type="button" onClick={onClose} className="btn-primary mt-4 w-full">{W(lang, "OK", "Entendido")}</button>
      </div>
    </div>,
    document.body,
  );
}
