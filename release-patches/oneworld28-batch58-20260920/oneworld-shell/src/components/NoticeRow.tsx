import { useState } from "react";

/**
 * ONE COLLAPSED ROW for "what this product does and does not do".
 * ============================================================================================
 * Lee, 15 August 2026, on the sale feed's opening panel:
 *
 *   *"This big piece of paragraph situation sitting here talking about listing and documents are
 *   live. First of all, this needs to be written a lot better because no one knows what that
 *   means if you read it. And then that needs to be something that's like a little info button,
 *   or maybe it's a collapsible situation — it's taking away too much vertical space right here
 *   in the front. It should be one little row that you can expand and collapse."*
 *
 * The panel it replaces was four lines of prose in a bordered box, above the first property, on
 * the screen whose entire job is showing properties. It cost roughly a third of a phone screen to
 * say something a reader only needs once.
 *
 * ── WHY THIS IS IN THE SHELL AND NOT ON THE SALE FEED ───────────────────────────────────────
 * Because of the twins. Every single time something has been built into one half of OneHome as a
 * local piece of markup, the other half has never received it — filters, sort, the map, three card
 * layouts, the engagement row, comments, the size stepper, the attribute line, the dashboard hub
 * and the request-a-showing button, all the same story, all because there was nothing to import.
 * A collapsible notice is exactly the shape of thing that happens to again. So it is importable
 * from the first commit.
 *
 * ── WHAT IT DELIBERATELY IS NOT ─────────────────────────────────────────────────────────────
 * It is not a dismissible banner. A promise about whose money we do and do not touch is not
 * something to hide permanently behind a tick — it is a standing fact about the product that a
 * reader should be able to re-open on any visit. Collapsed is not dismissed.
 *
 * ── ⚠️ THE SPACE IS RESERVED, SO EXPANDING DOES NOT SHOVE THE PAGE ─────────────────────────
 * Standing rule: *"reserve the space for anything that appears on tap — if expanding shifts the
 * page, the control feels broken."* The row itself is a fixed height and the body grows below it,
 * so the first property card moves down and nothing above it ever moves.
 */
export default function NoticeRow({
  title, body, defaultOpen = false,
}: {
  /** One short line. If it does not fit on a phone in one line, it is not a title, it is the body. */
  title: string;
  body: string;
  /** Almost always false. True only where a reader genuinely must read it before acting. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-brand/25 bg-brand/[0.06]">
      <button type="button" onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="ow-tap flex min-h-[44px] w-full items-center gap-2 px-3 text-left">
        {/* The information mark Lee asked for by name — *"a little eye with a circle around it"* —
           drawn rather than imported, because the shell carries no icon library by rule. */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className="shrink-0 text-brand">
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.6h.01" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-brand">{title}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className={`shrink-0 text-brand transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <p className="px-3 pb-3 pl-[42px] text-[12px] leading-relaxed opacity-75">{body}</p>
      )}
    </div>
  );
}
