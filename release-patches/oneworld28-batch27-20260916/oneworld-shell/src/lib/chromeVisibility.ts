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
function setHidden(value: boolean) {
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
