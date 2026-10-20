/**
 * STORE BUILD AND NATIVE APP — one answer for the whole family (APPSTORE 1, 19 Oct 2026).
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * The App Store / Google Play build is the same web app inside a Capacitor wrapper. Two questions
 * get asked all over the shell, and each must be answered in exactly one place:
 *
 *   · `isNativeApp()`  — are we running inside the native wrapper right now? (Google refuses
 *     sign-in inside a WebView, so OAuth must go out to the system browser.)
 *   · `isStoreBuild()` — must this build obey store rules? True for a build made with
 *     `VITE_STORE_BUILD=1` OR any native run. A store build renders NOTHING for digital plans,
 *     upgrade screens and "Coming soon" controls — hidden, not disabled (ORCHESTRATOR, 19 Oct).
 *
 * No npm import of Capacitor: the native bridge injects `window.Capacitor`, so the web bundle
 * never carries it and a browser always answers `false`.
 */
type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, any>;
};

export function capacitor(): CapacitorBridge | null {
  try {
    const c = (globalThis as { Capacitor?: unknown }).Capacitor;
    return c && typeof c === "object" ? (c as CapacitorBridge) : null;
  } catch {
    return null;
  }
}

export function isNativeApp(): boolean {
  try { return !!capacitor()?.isNativePlatform?.(); } catch { return false; }
}

export function isStoreBuild(): boolean {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_STORE_BUILD === "1" || isNativeApp();
}
