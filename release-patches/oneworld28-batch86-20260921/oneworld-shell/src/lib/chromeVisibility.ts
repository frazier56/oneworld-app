import { useSyncExternalStore } from "react";

/**
 * WHETHER THE HEADER AND TAB BAR ARE HIDDEN — and, since 16 Sep 2026, the one place that knows
 * the page is being scrolled at all.
 *
 * ⚠️ THE FLICKER. Lee, repeatedly: *"When you scroll fast with your thumb the screen flickers…
 * something about our entire One World ecosystem."* It is not one bug, it is three costs landing
 * on the same frame, and this file was feeding all three:
 *
 *   1. `body::before/::after` is a FIXED, viewport-sized layer carrying `filter: blur(64px)` and
 *      a 46-second animation that never stops. Every `backdrop-filter` surface in the app —
 *      header, tab pill, every card — samples THAT. A backdrop that changes every frame can
 *      never be cached, so the glass is re-blurred forever, on every screen.
 *   2. Hiding the chrome slides a blurred bar with a 300–500ms transform. While it moves, the
 *      phone re-blurs a 20px radius every frame.
 *   3. This handler ran on EVERY scroll event — more than once per frame on iOS — and each run
 *      did a four-part `document.querySelector`, forcing a style recalculation mid-scroll.
 *
 * And the trigger oscillated: momentum scrolling emits jittering deltas (+3, −1, +4, −2), each
 * sign flip reset `travel`, so a fast flick could start several overlapping slide transitions.
 * Overlapping transitions of a blurred bar, over a backdrop that is itself animating, on a
 * phone GPU, IS the flicker.
 *
 * What changed here:
 *   · one update per animation frame, never per event
 *   · deltas under 2px are momentum jitter and are ignored
 *   · a 350ms cooldown after any change, so the state cannot flip back mid-flick
 *   · the expensive DOM query runs only when a change is actually about to happen
 *   · `data-scrolling` is set on <html> while the finger is moving. The stylesheet uses it to
 *     PAUSE the aurora animation and drop the backdrop blur for those few hundred milliseconds.
 *     Nobody perceives blur quality during a fast flick; everybody perceives a strobing screen.
 *     It is removed 140ms after the last scroll event, so at rest the design is untouched.
 */

let hidden = false;
const listeners = new Set<() => void>();
export function showChrome() { setHidden(false); }
/* ── THE SAME STORE, DRIVEN BY A SCREEN THAT IS NOT THE WINDOW (World Feed 30, 20 Sep 2026) ──
   The world feed scrolls INSIDE a snap container, so the window `scroll` listener below never
   fires for it and the chrome would simply never move. The answer is not a second hide-on-scroll
   — that is the thing Lee has asked for once and been given twice before. It is this one store,
   with a way in for a surface that owns its own scroller: the feed measures its own direction
   and reports it here, so the header, the tab bar and the feed's own chrome are the SAME piece
   of state and cannot disagree. */
export function hideChrome() { setHidden(true); }
/* ⚠️ ON A TOUCH DEVICE THE CHROME NEVER HIDES, AND THIS IS THE FIX FOR LEE'S FOOTER BUG.
   16 Sep 2026: *"The five buttons at the bottom sometimes don't register. It just brings up like
   I'm tapping into a web page."*

   The chain that produced that: scrolling asked the bar to hide → the bar got a class that both
   slides it away AND turns off taps → a CSS rule pinned the bar back in place but left taps off
   → you saw a footer, pressed it, and the press went through to the page behind it. A control
   that is visible and dead is worse than one that is gone, because you keep pressing it.

   Refusing the hide at the source is the only version of this with no in-between state: the
   class is never applied, so it can never be applied wrongly. The bar is always there and always
   live. Desktop keeps the scroll-away — it has a mouse, no momentum, and no reported trouble.

   ⚠️ Read once and cached. A pointer type does not change mid-session, and re-querying per
   scroll event would put a media-query evaluation on the hot path we are here to keep clear. */
/* The pointer-type probe that used to pin the chrome lives in git history; the bars hide on
   every device again. */

function setHidden(value: boolean) {
  /* ⚠️ THE BARS HIDE AGAIN ON PHONES. Lee, 16 Sep 2026: *"We should be able to make our header
     and our footer disappear after you scroll... but keep in mind the flickering. Don't make it
     flicker."*

     They were pinned in batch 28 because a blurred bar that SLIDES has to re-blur on every frame
     of the slide, and at the time that was one of several things all flickering at once. Most of
     those are now gone — the aurora is static, the panes are solid, images decode off the main
     thread, the strips only render the slides you can reach — so the slide is no longer landing
     on a frame that is already late.

     What protects it is the deadband in `evaluate()` above: a 2px jitter floor and a 350ms
     cooldown, so a thumb wobbling mid-flick cannot make the bars chatter. One slide per genuine
     direction change is affordable; a slide every few frames never was.

     ⚠️ IF THE FLICKER COMES BACK WITH THIS, the fix is NOT to pin the bars again — it is to take
     the blur off them, in the touch block of tokens.css. Moving is cheap; moving something
     see-through is not. */
  if (hidden === value) return;
  hidden = value;
  listeners.forEach(fn => fn());
}

/* Marks <html data-scrolling> while the page is moving. Kept out of React entirely: a class
   toggled through state would re-render the tree on every flick, which is the cost we are here
   to remove. */
let idleTimer: number | undefined;
function markScrolling() {
  const root = document.documentElement;
  if (!root.hasAttribute("data-scrolling")) root.setAttribute("data-scrolling", "");
  if (idleTimer) window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    document.documentElement.removeAttribute("data-scrolling");
    idleTimer = undefined;
    /* ~1 second, Lee's call: the background holds still through the whole flick AND the
       momentum that follows it, then eases back in once the page is genuinely at rest. 140ms
       was long enough for the physics and too short for a person — it resumed while the page
       was still coasting. */
  }, 950);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  let previous = Math.max(0, window.scrollY), travel = 0, direction = 0;
  let queued = false, changedAt = 0;

  const evaluate = () => {
    queued = false;
    const y = Math.max(0, window.scrollY), delta = y - previous;
    previous = y;

    /* Momentum jitter. Below 2px it is not a gesture, it is the scroller settling, and acting
       on it is what made `travel` reset over and over during a flick. */
    if (Math.abs(delta) < 2) return;

    if (Math.sign(delta) !== direction) travel = 0;
    direction = Math.sign(delta);
    travel += delta;

    const wantsShown = y < 40 || travel < -16;
    const wantsHidden = y > window.innerHeight * 0.5 && travel > 20;
    const next = wantsShown ? false : wantsHidden ? true : hidden;
    if (next === hidden) return;

    /* HYSTERESIS. One change per 350ms at most. Without it a fast thumb could start a new
       500ms slide before the last one finished — overlapping transitions on a blurred bar. */
    const now = performance.now();
    if (now - changedAt < 350) return;

    /* Only now is the expensive query worth running. It used to run on every scroll event. */
    const busy = document.querySelector(
      '[data-chrome-lock="true"], .ow-reveal-controls [aria-expanded="true"], .ow-floating-tabs :focus-visible, .ow-reveal :focus-visible');
    if (busy && next === true) return;

    changedAt = now;
    setHidden(next);
  };

  const onScroll = () => {
    markScrolling();
    /* One evaluation per frame. iOS fires scroll more often than it paints. */
    if (queued) return;
    queued = true;
    requestAnimationFrame(evaluate);
  };

  // Every subscriber observes the same state; only one window listener runs.
  if (listeners.size === 1) {
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanup = () => {
      window.removeEventListener('scroll', onScroll);
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = undefined;
      document.documentElement.removeAttribute("data-scrolling");
    };
  }
  return () => { listeners.delete(fn); if (!listeners.size) { cleanup?.(); hidden = false; } };
}
let cleanup: (() => void) | undefined;
export function useChromeHidden() { return useSyncExternalStore(subscribe, () => hidden, () => false); }
