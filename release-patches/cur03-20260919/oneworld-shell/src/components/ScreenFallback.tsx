/**
 * WHAT A SCREEN LOOKS LIKE WHILE ITS CHUNK IS STILL ARRIVING. (16 Sep 2026)
 * ============================================================================================
 * Every product screen is a lazy chunk, and until 16 September every one of the nine Suspense
 * boundaries in this app showed the same thing:
 *
 *     <div className="py-16 text-center text-sm opacity-50">…</div>
 *
 * A transparent div with an ellipsis in it. No background, no height, no pane. So for the whole
 * length of the chunk fetch — which on a phone network is not brief — the content column stopped
 * existing and you saw the bare page colour, then the screen filled back in. Blank, then content,
 * on the first visit to every tab and again after every deploy. That is a white flash in light
 * mode and a black one in dark, and it is a large part of what Lee has been calling flicker.
 *
 * ⚠️ THE FIX IS NOT A NICER SPINNER. A spinner still leaves a hole. What removes the flash is
 * OCCUPYING THE SPACE with something the same shape as what is coming: frosted panes, the same
 * corner radius, roughly the same heights. The column never empties, so there is nothing to
 * flash — the placeholder is simply replaced by the real thing, in place.
 *
 * ⚠️ NO `animate-pulse` ON THE WHOLE STACK. A pulsing full screen is its own blinking, which is
 * the precise complaint. These are still panes; they just have nothing in them yet.
 */
export default function ScreenFallback() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="card h-28" />
      <div className="card h-40" />
      <div className="card h-40" />
    </div>
  );
}
