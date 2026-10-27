/**
 * WHERE THE SESSION LIVES — so a member stays signed in until they tap Sign out
 * (ONEWORLD 31, 23 Oct 2026; Lee, 22 Oct 9:29 PM: "always stay signed in, like Instagram").
 * ============================================================================================
 * Web: `localStorage` on app.oneworldlabs.ai, which survives closing the tab and the browser. This was
 * already the default; it is now written down so nobody swaps in sessionStorage or memory.
 *
 * Native (the Capacitor store app): the WebView's localStorage is NOT a safe home. iOS may purge
 * WKWebView storage under pressure, and an app reinstall or WebView data reset clears it. When the
 * native wrapper provides the Preferences plugin (`@capacitor/preferences`, registered by the
 * native project), the session is kept there instead. It survives an app kill and a reboot. An
 * existing WebView session is adopted on first read, so nobody is signed out by the switch. Without
 * the plugin it falls back to localStorage, exactly as before.
 *
 * SESSION-LOSS BREADCRUMB. Lee reported signing in with Google again every time. Production showed
 * a fresh session each day from the same phone and browser while the previous one was still alive
 * on the server, so something on the device lost the stored session. `noteSignedIn()` records
 * "this browser has been signed in" separately from the session. If a later boot finds the mark but
 * no session, and the member never signed out, `sessionWasLost()` says so, so the loss can be
 * counted (analytics `session_lost`) instead of guessed at.
 */
import { capacitor, isNativeApp } from "./storeBuild";

type AsyncStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type PreferencesPlugin = {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
};

function preferences(): PreferencesPlugin | null {
  try {
    const p = capacitor()?.Plugins?.Preferences as PreferencesPlugin | undefined;
    /* All three methods, or none (Max W13: a bridge without `remove` cannot sign anybody out). */
    return p && typeof p.get === "function" && typeof p.set === "function" && typeof p.remove === "function" ? p : null;
  } catch { return null; }
}

const local = {
  getItem: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string): boolean => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  removeItem: (k: string): boolean => { try { localStorage.removeItem(k); return true; } catch { return false; } },
};

/* ── ONE AUTHORITY, AND FAILURES THAT CANNOT RESURRECT AN OLD SESSION (Max/Security W13, 23 Oct) ──
   Native keeps the session in Preferences. Three rules make a failed write or remove safe:
   · STALE: when a Preferences write fails, the newer value is kept in localStorage and Preferences is
     marked stale. While marked, reads ignore Preferences (it holds an OLDER session, possibly another
     account's) and try to repair it from the newer copy.
   · TOMBSTONE: when Sign out cannot remove the Preferences copy, a tombstone makes every read answer
     "no session" and keeps retrying the removal. A failed sign-out can never bring the old session back.
   · ADOPT ONCE: the one-time move of a pre-existing WebView session into Preferences happens once per
     install (flag kept in Preferences). A WebView copy that a failed removal left behind is never
     re-adopted later. */
const staleKey = (k: string) => `ow.authstore.stale.${k}`;
const tombKey = (k: string) => `ow.authstore.removed.${k}`;
const ADOPTED = "ow.authstore.adopted";
let lastProblem: string | null = null;
/** The last storage problem seen (diagnostics; never a credential). */
export function authStorageProblem(): string | null { return lastProblem; }

/** The storage the Supabase client uses for the session. */
export function authStorage(): typeof local | AsyncStorage {
  const prefs = isNativeApp() ? preferences() : null;
  if (!prefs) return local;
  return {
    async getItem(k) {
      if (local.getItem(tombKey(k)) != null) {
        try { await prefs.set({ key: ADOPTED, value: "1" }); } catch { /* best effort */ }
      try { await prefs.remove({ key: k }); local.removeItem(tombKey(k)); } catch { lastProblem = "remove_pending"; }
        return null;                                   // signed out, whatever Preferences still holds
      }
      if (local.getItem(staleKey(k)) != null) {
        const newer = local.getItem(k);
        try {
          if (newer != null) await prefs.set({ key: k, value: newer }); else await prefs.remove({ key: k });
          local.removeItem(staleKey(k));
        } catch { lastProblem = "repair_pending"; }
        return newer;                                  // the newer copy wins while Preferences is stale
      }
      try {
        const { value } = await prefs.get({ key: k });
        if (value != null) return value;
        const adopted = (await prefs.get({ key: ADOPTED })).value != null;
        if (!adopted) {
          const old = local.getItem(k);
          if (old != null) await prefs.set({ key: k, value: old });
          await prefs.set({ key: ADOPTED, value: "1" });
          return old;
        }
        return null;
      } catch { lastProblem = "read_failed"; return local.getItem(k); }
    },
    async setItem(k, v) {
      local.removeItem(tombKey(k));                    // a NEW session after a failed sign-out supersedes the tombstone
      const mirrored = local.setItem(k, v);
      try {
        await prefs.set({ key: k, value: v });
        local.removeItem(staleKey(k));
        /* Preferences now owns the session: the one-time adoption is over for this install. */
        try { await prefs.set({ key: ADOPTED, value: "1" }); } catch { /* retried on the next write */ }
      } catch {
        lastProblem = "write_failed";
        /* Preferences still holds the OLDER value. Mark it stale so it can never win a later read.
           If even the mark cannot be written, remove the older value outright. */
        if (!(mirrored && local.setItem(staleKey(k), "1"))) { try { await prefs.remove({ key: k }); } catch { /* nothing more we can do */ } }
      }
    },
    async removeItem(k) {
      const localGone = local.removeItem(k);
      local.removeItem(staleKey(k));
      try { await prefs.set({ key: ADOPTED, value: "1" }); } catch { /* best effort */ }
      try { await prefs.remove({ key: k }); local.removeItem(tombKey(k)); }
      catch {
        lastProblem = "remove_failed";
        local.setItem(tombKey(k), "1");                // reads now answer "no session" and keep retrying
        console.warn("[authStorage] sign-out could not clear the stored session yet; it will be retried");
      }
      if (!localGone) lastProblem = "local_remove_failed"; // never re-adopted: adoption happens once
    },
  };
}

const MARK = "ow.signedInOnThisDevice";
/** Called on SIGNED_IN: this browser holds a session. */
export function noteSignedIn(): void { local.setItem(MARK, String(Date.now())); }
/** Called on a deliberate Sign out: the next empty boot is expected, not a loss. */
export function noteSignedOut(): void { local.removeItem(MARK); }
/** True when this device was signed in, nobody signed out, and the session is gone. */
export function sessionWasLost(hasSession: boolean): boolean {
  if (hasSession) return false;
  return local.getItem(MARK) != null;
}
