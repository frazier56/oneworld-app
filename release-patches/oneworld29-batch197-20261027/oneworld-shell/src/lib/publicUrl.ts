/**
 * PUBLIC LINKS ALWAYS POINT AT THE PUBLIC APP — never at wherever this copy happens to run.
 * (APPSTORE 1, 20 Oct 2026.) Inside the iPhone app `window.location.origin` is
 * `capacitor://app.oneworldlabs.ai`, which nobody else can open; inside Android it is the app's
 * https origin but served from the device. A link that leaves this device — share sheet, QR code,
 * copy link, invite, e-mail — must be built with `publicUrl(path)`. On the web nothing changes:
 * the current origin is returned (so the sandbox keeps sharing sandbox links).
 */
import { isNativeApp } from "./storeBuild";

export const PUBLIC_APP_ORIGIN = "https://app.oneworldlabs.ai";

export function publicOrigin(): string {
  if (isNativeApp()) return PUBLIC_APP_ORIGIN;
  try { return typeof window !== "undefined" && window.location?.origin ? window.location.origin : PUBLIC_APP_ORIGIN; }
  catch { return PUBLIC_APP_ORIGIN; }
}

/** `path` must start with "/". Anything else is returned unchanged (already absolute). */
export function publicUrl(path: string): string {
  return path.startsWith("/") ? `${publicOrigin()}${path}` : path;
}
