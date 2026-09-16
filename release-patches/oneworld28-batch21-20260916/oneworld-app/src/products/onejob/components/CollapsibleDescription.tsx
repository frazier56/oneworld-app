import { useEffect, useRef, useState } from "react";

/**
 * A contract description that starts collapsed once the contract is out the door.
 *
 * Lee, 31 Jul 2026: while you're WRITING a contract, and on the preview right before you send it,
 * the full description should be there — that's the moment it needs reading. But afterwards, in
 * My Jobs and in the inbox, both people have already read it, and a long scope turns every visit
 * to that job into a long scroll past text they know, just to reach the money and the buttons.
 *
 * So: clamped by default here, with Show more / Show less. Deliberately NOT used on the create
 * form or the pre-send preview.
 *
 * Two details that matter more than they look:
 *
 * · It only clamps if the text ACTUALLY overflows. A three-line description with a "Show more"
 *   link under it that reveals nothing is worse than no control at all, so the height is measured
 *   after render and the control only appears when there's something hidden. It re-measures on
 *   resize and after fonts load, because both change where the text wraps.
 *
 * · Collapsing scrolls the top of the description back into view. Without that, closing a long
 *   description from the bottom leaves you somewhere far down the page with no idea where you are.
 */
export default function CollapsibleDescription({
  html, text, collapsedLines = 6, className = "",
}: {
  /** Rich-text HTML, already sanitized by the caller. */
  html?: string | null;
  /** Plain-text alternative, for older contracts saved before the rich editor. */
  text?: string | null;
  collapsedLines?: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    /**
     * Measure against the height the clamp WOULD impose, not against the box's current height.
     *
     * The obvious version of this — `scrollHeight > clientHeight` — is wrong here, and wrong in a
     * way that looks right: on first render nothing is clamped yet (we don't know whether to clamp
     * until we've measured), so the box is its full height, scrollHeight equals clientHeight, and
     * every description reports "fits". Deployed once and every Show more vanished. (Jul 31 2026)
     *
     * So: work out what six lines actually come to at this font size, and compare the real content
     * height to that. It's stable in both states, which also means toggling open doesn't make the
     * control disappear.
     */
    const measure = () => {
      const el = box.current;
      if (!el) return;
      // Drop the clamp for the duration of the read. A clamped -webkit-box reports its CLAMPED
      // height as scrollHeight, so measuring in place would say "fits" the moment it's collapsed —
      // and on the next resize the control would vanish. Read the natural height, then put it back;
      // both happen inside one frame, so nothing paints in between.
      const s = el.style as any;
      const prev = [s.display, s.webkitLineClamp, s.webkitBoxOrient];
      s.display = ""; s.webkitLineClamp = ""; s.webkitBoxOrient = "";
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      const full = el.scrollHeight;
      [s.display, s.webkitLineClamp, s.webkitBoxOrient] = prev;
      setOverflows(full > lh * collapsedLines + 4);
    };
    measure();
    window.addEventListener("resize", measure);
    (document as any).fonts?.ready?.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [html, text, collapsedLines]);

  const clamp = !open && overflows;

  return (
    <div className={className}>
      <div
        ref={box}
        className={
          "relative text-sm leading-relaxed opacity-85 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 " +
          "[&_strong]:font-bold [&_ul]:mb-2 " + (clamp ? "overflow-hidden" : "")
        }
        style={clamp ? {
          display: "-webkit-box",
          WebkitLineClamp: collapsedLines,
          WebkitBoxOrient: "vertical",
        } : undefined}
        {...(html
          ? { dangerouslySetInnerHTML: { __html: html } }
          : { children: <p className="whitespace-pre-wrap">{text}</p> })}
      />

      {overflows && (
        <button
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            // Closing from the bottom of a long scope otherwise strands you mid-page.
            if (!next) box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }}
          className="mt-1.5 text-[13px] font-bold text-brand transition active:scale-95"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
