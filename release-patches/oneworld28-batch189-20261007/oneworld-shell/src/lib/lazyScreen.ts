import { lazy, type ComponentType } from "react";

/**
 * LAZY SCREENS THAT SURVIVE A DEPLOY.
 * ============================================================================================
 * Lee, 15 August 2026, on his phone, hours after a push:
 *
 *   *"When I tap on a listing it doesn't show the details, it goes to this error page."*
 *   `Failed to fetch dynamically imported module: .../PropertyDetail-J9f6Mblw.js`
 *   `Failed to fetch dynamically imported module: .../Feed-BI0MFXk1.js`
 *
 * Both files returned 404. They were real, and then a deploy replaced them: every build stamps a
 * new hash into every chunk name and deletes the old ones. Anybody holding the previous
 * `index.html` — an open tab, a phone that slept, a page still inside the ten-minute cache the
 * host sets — is asking for filenames that no longer exist. The app then shows a crash screen for
 * something that is not a crash: **the code is fine, the person is simply one version behind.**
 *
 * This is not rare and it is not their fault. It happens to every open session on every deploy,
 * and it looks identical to a real fault, which is how it survived being reported as one.
 *
 * ── WHAT THIS DOES ──────────────────────────────────────────────────────────────────────────
 * 1. Retry once. A chunk request also fails on a flaky mobile connection, and a second attempt
 *    costs nothing and fixes that case without a reload.
 * 2. If it fails again, reload the page ONCE. A reload fetches the new `index.html`, which names
 *    the chunks that do exist, and the person lands on the screen they asked for.
 * 3. Never reload twice. The sentinel is in `sessionStorage` with a timestamp, so a genuinely
 *    broken deploy shows the error screen instead of putting the browser in a loop. A reload loop
 *    is far worse than an error message.
 *
 * ── WHY THE RELOAD HAS TO CHANGE THE URL ────────────────────────────────────────────────────
 * 15 Aug 2026, second pass. Max reported he **cannot** set `Cache-Control` on `index.html`:
 * GitHub Pages serves a static repo and does not let you choose headers, so the shell is stuck on
 * `max-age=600`.
 *
 * That breaks a plain `location.reload()`. A reload re-requests the SAME url, and inside those ten
 * minutes the browser answers it out of its own cache — handing back the very shell that names the
 * deleted chunks. The sentinel then (correctly) refuses a second reload, so the person lands on the
 * error screen anyway. The self-heal would have looked like it did nothing.
 *
 * So the reload goes to a DIFFERENT url — the same path with a throwaway `_v` parameter. A
 * different url is a different cache entry, so the browser has to fetch it, and it gets the current
 * shell naming chunks that exist. `stripCacheBuster()` then takes the parameter back out of the
 * address bar on boot, so nobody ever sees it and nobody can bookmark it.
 *
 * This is a workaround for a hosting limit, not a design. If the app ever moves behind something
 * that can set headers, set `Cache-Control: no-cache` on `index.html` — keep the hashed chunks
 * immutable and long-cached — and this stays harmless.
 */

const SENTINEL = "ow:chunk-reload-at";
/** Long enough that a reload loop cannot form; short enough that a later deploy still self-heals. */
const COOLDOWN_MS = 30_000;

function isChunkError(e: unknown): boolean {
  const m = String((e as any)?.message ?? e ?? "");
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(m);
}

function recentlyReloaded(): boolean {
  try {
    const at = Number(sessionStorage.getItem(SENTINEL) || 0);
    return at > 0 && Date.now() - at < COOLDOWN_MS;
  } catch { return false; }
}

function markReloaded() {
  try { sessionStorage.setItem(SENTINEL, String(Date.now())); } catch { /* private mode */ }
}

const BUSTER = "_v";

/**
 * Reload in a way the browser cannot answer from its own cache.
 * The path and hash are kept, so the person lands exactly where they were.
 */
function hardReload() {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set(BUSTER, String(Date.now()));
    window.location.replace(u.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * Take the throwaway parameter back out of the address bar, without a navigation.
 * Call once at start-up. Cheap, and it keeps the url clean and bookmarkable.
 */
export function stripCacheBuster() {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has(BUSTER)) return;
    u.searchParams.delete(BUSTER);
    const clean = u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : "") + u.hash;
    window.history.replaceState(window.history.state, "", clean);
  } catch { /* nothing here is worth throwing over */ }
}

/**
 * Drop-in replacement for React's `lazy` for any screen loaded with `import()`.
 * Same signature, same behaviour, except it does not punish somebody for being one deploy behind.
 */
export function lazyScreen<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((first) => {
      if (!isChunkError(first)) throw first;
      /* One quiet retry — this alone fixes a dropped request on a phone. */
      return factory().catch((second) => {
        if (!isChunkError(second) || recentlyReloaded()) throw second;
        markReloaded();
        hardReload();
        /* Hold the promise open. Resolving or rejecting here would paint a flash of the wrong
           thing in the moment before the reload takes hold. */
        return new Promise<{ default: T }>(() => {});
      });
    }),
  );
}

export default lazyScreen;
