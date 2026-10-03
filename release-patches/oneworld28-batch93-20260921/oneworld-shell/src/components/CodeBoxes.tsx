/**
 * SIX BOXES, ONE PIXEL OF ACTUAL INPUT.
 * ============================================================================================
 * Lee, 4 August 2026: *"that should be six squares, like, six boxes… That's the standard
 * practice."*
 *
 * It took three attempts to make six boxes behave, and each failure looked like a different
 * bug. Both fixes below are load-bearing; neither is decoration.
 *
 * Shared by sign-in and sign-up so normal, focus and error states stay consistent.
 */

export default function CodeBoxes({
  value, onChange, onComplete, label = "Six digit code", invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Fired with the SIX DIGITS THEMSELVES, never with a promise that state has settled. */
  onComplete: (code: string) => void;
  label?: string;
  invalid?: boolean;
}) {
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const take = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 6);
    onChange(v);
    /* ── PASS THE VALUE, DO NOT READ IT BACK ──────────────────────────────────────────────
       Lee, 4 Aug 2026: *"when you put the code in, it still has this red notification: verify
       requires either token or token hash."*

       That is the server saying it received an EMPTY token. Auto-submit fired a callback that
       had closed over the previous render's value — at the moment the sixth digit landed the
       state had not been committed yet, so the caller sent "". The digits are handed straight
       to `onComplete` instead of being read back out of state, which removes the race entirely
       rather than papering over it with a longer timeout.

       The 60ms is not the fix. It exists so the sixth box paints filled before the screen
       changes underneath it — without it the last digit never appears to land. */
    if (v.length === 6) setTimeout(() => onComplete(v), 60);
  };

  return (
    /* ── THE INPUT IS 1px, NOT AN INVISIBLE OVERLAY ───────────────────────────────────────
       Lee, twice, on video: *"the squares fly out to the right."* `overflow-hidden` was not
       enough — a full-size invisible input still gets laid out and still receives the pasted
       text, so the browser scrolls SOMETHING to keep the caret on screen. The only way to stop
       that for good is to leave nothing to scroll: the field is one pixel, pinned to the left
       edge, so six characters have nowhere to push. The label still focuses it on tap, so the
       boxes behave like one big input without being one. */
    <label className="group relative block cursor-pointer overflow-hidden">
      <input
        inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        value={value}
        onChange={e => {
          /* Belt AND braces. The 1px field should give the browser nothing to scroll, but Lee
             still caught movement on video, so the scroll position is stamped back to zero on
             every keystroke — on the field itself and on the row that paints the boxes. One of
             the two is redundant; which one depends on the browser, and neither costs
             anything. */
          e.target.scrollLeft = 0;
          (e.target.parentElement as HTMLElement | null)?.scrollTo?.(0, 0);
          take(e.target.value);
        }}
        onPaste={e => { e.preventDefault(); take(e.clipboardData.getData("text")); }}
        style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1,
                 opacity: 0, border: 0, padding: 0, fontSize: 16 }}
        aria-label={label}
        aria-invalid={invalid}
      />
      <div className="pointer-events-none flex justify-between gap-1 overflow-hidden sm:gap-2">
        {digits.map((d, i) => (
          /* Box definition, two layers, and they are different things:
             · A neutral box-defining BORDER is always on, so the six boxes are visible on the
               light sign-up background. Lee UAT, 7 Aug 2026: on the "Check your email" screen the
               glass cards were near-invisible white-on-white. This is NOT the blue focus ring he
               rejected earlier ("the faint outline doesn't look good… put it back to normal") —
               that was a coloured ring on an UNTOUCHED box that read as an error; this is a plain
               grey edge that just says "this is a box", which is standard practice.
             · A FILLED box additionally gets a soft ring as its progress cue. */
          <span key={i}
            className={`card grid h-14 min-w-0 flex-1 place-items-center rounded-2xl p-0 text-[22px] font-extrabold
                        border shadow-sm transition
                        ${invalid ? "!border-red-500 ring-1 ring-red-500/30" : "border-ink/15 dark:border-white/10 group-focus-within:!border-ink/40 dark:group-focus-within:!border-white/40"}
                        ${d ? "ring-1 ring-ink/20 dark:ring-white/20" : ""}`}>
            {d}
          </span>
        ))}
      </div>
    </label>
  );
}
