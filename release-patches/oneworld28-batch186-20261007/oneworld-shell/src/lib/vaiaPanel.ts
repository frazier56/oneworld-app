/* ============================================================================================
 * WHERE VAIA'S PANEL PLUGS IN — a registration, not an import.
 * ============================================================================================
 * The shell owns the "Tap for insights" PILL. `VaiaPill` is on every screen of every product and
 * fires `ow-vaia-open`. Something has to listen, and for one night that was a second, plainer
 * panel written into this package. Lee struck it: *"Why would you have different models of VAIA?"*
 *
 * The one real VAIA — voice-first, live transcription, markdown answers — is built on
 * lucide-react and framer-motion, both banned in the shell, so this package can never contain
 * her. And the shell cannot import from the app: that is the dependency arrow pointing backwards,
 * which is how a shared package ends up unbuildable on its own.
 *
 * ── SO THE APP HANDS HER IN, ONCE, AT MODULE LOAD ───────────────────────────────────────────
 * The same module-level-state-plus-registration shape as `viewerCurrency` and `compareStore`,
 * which are the sanctioned pattern here for exactly this reason. `App.tsx` calls
 * `registerVaiaPanel(VaiaChatMount)` at module scope — before React renders a single frame — and
 * `AppShell` renders whatever is registered, INSIDE its own providers.
 *
 * ⚠️ AND "INSIDE ITS OWN PROVIDERS" IS THE WHOLE POINT, found the hard way on 14 Sep 2026.
 * The first attempt mounted her at the app root, above every `AppShell`. She calls `useOneId()`,
 * and the shell's hooks throw rather than guess: *"useOneId() outside <OneIdProvider>"*. A blank
 * screen on every product, caught by opening her in a browser and reading the page error — a type
 * check cannot see a provider that is missing at runtime.
 *
 * Registration happens before the first render, so no re-render is needed to pick it up; if
 * nothing registers, the shell renders nothing and the pill is inert, which is the honest
 * fallback rather than a half-working control.
 */
import type { ComponentType } from "react";

let panel: ComponentType | null = null;

/** Called once, at module scope, by the app that owns VAIA. */
export function registerVaiaPanel(component: ComponentType): void {
  panel = component;
}

/** What `AppShell` renders inside its providers. Null until the app registers one. */
export function getVaiaPanel(): ComponentType | null {
  return panel;
}
