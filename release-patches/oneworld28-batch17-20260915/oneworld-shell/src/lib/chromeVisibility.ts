import { useSyncExternalStore } from "react";

let hidden = false;
const listeners = new Set<() => void>();
export function showChrome() { setHidden(false); }
function setHidden(value: boolean) {
  if (hidden === value) return;
  hidden = value;
  listeners.forEach(fn => fn());
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  let previous = Math.max(0, window.scrollY), travel = 0, direction = 0;
  const onScroll = () => {
    const y = Math.max(0, window.scrollY), delta = y - previous;
    previous = y;
    if (!delta) return;
    if (Math.sign(delta) !== direction) travel = 0;
    direction = Math.sign(delta); travel += delta;
    const busy = document.querySelector('[data-chrome-lock="true"], .ow-reveal-controls [aria-expanded="true"], .ow-floating-tabs :focus-visible, .ow-reveal :focus-visible');
    if (y < 40 || busy || travel < -16) setHidden(false);
    else if (y > window.innerHeight * .5 && travel > 20) setHidden(true);
  };
  // Every subscriber observes the same state; only one window listener runs.
  if (listeners.size === 1) { window.addEventListener('scroll', onScroll, { passive: true }); cleanup = () => window.removeEventListener('scroll', onScroll); }
  return () => { listeners.delete(fn); if (!listeners.size) { cleanup?.(); hidden = false; } };
}
let cleanup: (() => void) | undefined;
export function useChromeHidden() { return useSyncExternalStore(subscribe, () => hidden, () => false); }
