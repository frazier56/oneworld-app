import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ⓘ — THE HOUSE EXPLAINER. One button, one centred popup, everywhere.
 * ============================================================================================
 * Lee, 17 August 2026, looking at the listing form: *"Colombia's utility band, one through six —
 * that needs to go on the info button next to Estrato. That way you don't have this unnecessary
 * wrapping… Anytime you have a description like that, just put an info button, so you don't have
 * to put the text on the screen. And when they click it, the info should show up in the MIDDLE of
 * the screen with the X to exit out of it. A lot of times when you put the info button, the
 * information shows NOT on the screen."*
 *
 * Both halves of that matter. The sentence comes off the form, and the popup that replaces it
 * lands in the middle of the screen rather than clipped to an edge.
 *
 * ── WHY THIS EXISTS AS A COMPONENT AND NOT AS A PROP ON `Field` ─────────────────────────────
 * Max confirmed on 17 Aug that the shell has **no exported centred modal at all** — the closest
 * things are `NewMessageSheet` and `AiWritingAssist`, which each build their own. So the choice
 * was to add a third private one inside `Field`, or to add the missing shared one once. Every
 * explainer in the product wants the same object, so it is this.
 *
 * ── WHY A PORTAL, AND WHY NOT AN ANCHORED POPOVER ───────────────────────────────────────────
 * An anchored popover positions itself against the button, so a button near the right edge of a
 * 390-pixel screen produces a bubble that is half off-screen — which is exactly the complaint.
 * A portal to `<body>` cannot be clipped by an ancestor's `overflow: hidden`, and a form is made
 * almost entirely of things with `overflow: hidden`. **Anchored popovers are banned in this
 * codebase for that reason.** Centred, always, on every screen size.
 *
 * ── THE SHAPE, TAKEN FROM `AiWritingAssist` SO IT IS NOT A SECOND DIALECT ────────────────────
 * `createPortal`, a scrim that closes on click, a stop-propagation panel, an X in the corner,
 * centred from `sm` up and a bottom sheet on a phone. The scrim carries NO hue — brand rule.
 */
export default function InfoDot({
  title, body, lang, className,
}: {
  /** The field's own label. The reader needs to know what they tapped. */
  title: string;
  /** The sentence that used to sit under the field. Already translated by the product. */
  body: string;
  lang: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const es = lang === "es" || lang === "co";

  /* Escape closes it, and the page behind does not scroll while it is open — otherwise a phone
     scrolls the form under the popup and the reader loses their place in a long listing form. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const scrollY = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    /* Mobile Chromium can reset the page to y=0 when `overflow:hidden` is applied to a long
       document. Pinning the body at the current offset keeps the form exactly where it was. */
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" as ScrollBehavior });
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* 24px of ink but a 44px tap target — the floor a thumb reliably hits on a 390px screen.
          `type="button"` because this lives inside a form and must never submit it. */}
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={es ? `Qué significa: ${title}` : `What ${title} means`}
        className={`ow-tap -my-2 -mr-1 inline-grid h-11 w-11 shrink-0 place-items-center align-middle ${className ?? ""}`}>
        <span className="grid h-[18px] w-[18px] place-items-center rounded-full border border-current text-[11px] font-black leading-none opacity-45">
          i
        </span>
      </button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={id}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm">
          <div
            onClick={e => e.stopPropagation()}
            className="glass-modal max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id={id} className="min-w-0 text-[16px] font-black leading-tight tracking-tight">
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={es ? "Cerrar" : "Close"}
                className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/5 dark:bg-white/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="mt-2.5 text-[13.5px] leading-relaxed opacity-80">{body}</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
