/**
 * NATIVE APP SIGN-IN THROUGH THE SYSTEM BROWSER — one attempt, owned end to end (r5).
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Why: Google refuses sign-in inside a WebView, so inside the native app (Capacitor) the provider
 * page opens in the SYSTEM browser and comes back on the app's own scheme
 * (`ai.oneworldlabs.app://auth<path>`) or the Android App Link (`https://app.oneworldlabs.ai<path>`).
 * The native wrapper (APPSTORE 1, pinned there) maps the return onto the app's own origin and loads
 * it in the WebView; supabase-js completes the PKCE exchange with the verifier it stored in this
 * same WebView. This module never exchanges a code and never invents its own state/nonce.
 *
 * WHAT THE OUTCOMES MEAN — deliberately modest (Security R4-C, 20 Oct 2026):
 *   session    — a signed-in session is AVAILABLE in this app while this attempt was completing
 *                (from the SDK's SIGNED_IN or an existing session after the return). It is NOT a
 *                claim that this exact callback produced it; supabase-js owns that proof.
 *   failed     — could not start, could not open, callback carried an error, or no session within
 *                30 s of the return, or the 60-s startup deadline passed.
 *   cancelled  — the system browser reported it finished (browserFinished). Usually the member
 *                closed it; it can also be a late echo of an earlier programmatic close, which this
 *                bridge cannot tell apart (r8 fail-closed contract, below). Do NOT read it as human intent.
 *   expired    — open for 15 minutes with no return.
 *   superseded — a newer tap took over before this one finished.
 * Each attempt ends exactly once. The outcome is KEPT (last 32), so a caller that subscribes after
 * a very fast ending still receives it (R4-A, terminal replay).
 *
 * ONE PHYSICAL BROWSER AT A TIME — ONE CLOSURE STATE MACHINE (r8, Security R7-CLOSE / R7-EVENT):
 * every Browser.open / Browser.close goes through one queue, and the sheet is in exactly one state:
 *   clean   — a close() we made FULFILLED (a rejection or a throw is not a close) and its settle
 *             window passed. Only then may a new sheet open.
 *   dirty   — a sheet of ours may be open, or its closure is unconfirmed: after any open, after a
 *             rejected close, after a cancel reported by browserFinished. The next open first runs a
 *             confirming close() and opens only if that close fulfils; otherwise the attempt fails
 *             ("native_browser_unavailable") and NO second sheet opens.
 *   pending — an open (20 s) or close (3 s) did not settle in time. Every new attempt is refused
 *             until it settles; then a late open is closed through the same machine, and the state
 *             becomes clean only through a later fulfilled close.
 * browserFinished carries no attempt or sheet identity on this bridge. So the settle window after a
 * fulfilled close (1 s, at most one event consumed as that close's echo) completes INSIDE the queue
 * step, BEFORE the next sheet can open — a member closing the NEW sheet is never mistaken for an
 * echo. An echo delivered later than that window cannot be told apart from a real cancel: it ends the
 * current attempt "cancelled" and leaves the state dirty, so the next tap closes before it opens.
 * That is the fail-closed recovery: a possible spurious cancel, never two sheets. A browserFinished
 * that arrives while open() is still pending ends the attempt "cancelled" when open settles; if open
 * never settles, the attempt fails at the 20-s open deadline instead.
 * Whether close() fulfils with no sheet open, and whether a programmatic close emits browserFinished,
 * are platform facts; this module assumes neither. APPSTORE 1 (22 Oct 2026, @capacitor/browser 8.0.5
 * source + the wrapper patch in oneworld-native): close() with no sheet FULFILS on both platforms
 * (stock iPhone rejected; the wrapper makes "fulfilled close = closed" true); Android emits
 * browserFinished after a programmatic close, iPhone does not. Device confirmation is Testing's gate.
 *
 * DEADLINES: 60 s to get from tap to an open browser (listener registration, SDK, open), 15 min
 * open, 30 s from return to session. Timed-out continuations are stopped by the ownership check.
 * The CALLER is never left waiting on a hung promise: startNativeOAuth settles at whichever comes
 * first — the browser opened, or the attempt ended (R5-A). Internal expiry is never taken as proof
 * that a physical operation was cancelled.
 *
 * AN ATTEMPT OUTLIVES ITS SCREEN: useNativeAttempt stops a screen that unmounted from being touched
 * by a late result, but does not cancel the native attempt itself; a sign-in completed after the
 * screen went away still produces a session, which the app's auth state handles.
 *
 * LISTENERS (R4-B): registered per bridge PAIR (App + Browser) and generation; a replaced bridge's
 * handles are removed (bounded wait) before new ones register; late results from an older
 * generation are removed and ignored.
 */
import { supabase } from "./supabase";
import { capacitor } from "./storeBuild";
import { controlledAuthError } from "./authErrors";

export const NATIVE_OAUTH_EVENT = "ow:native-oauth";
export type NativeOAuthOutcome = "session" | "failed" | "cancelled" | "expired" | "superseded";
export const APP_ORIGIN = "https://app.oneworldlabs.ai";
export const APP_HOST = "app.oneworldlabs.ai";
export const APP_SCHEME = "ai.oneworldlabs.app:";
const STARTUP_MS = 60_000;
const ATTEMPT_TTL_MS = 15 * 60_000;
const COMPLETE_WITHIN_MS = 30_000;
const CLOSE_WAIT_MS = 3_000;

type Phase = "starting" | "open" | "completing" | "ended";
type Attempt = {
  id: number; path: string; phase: Phase; outcome: NativeOAuthOutcome | null;
  timer: ReturnType<typeof setTimeout> | null; unsub: (() => void) | null; opened: boolean; opening: boolean;
  /** browserFinished arrived while open() was still in flight (Max Event3-r3 case 3, 20 Oct). */
  finishedWhileOpening: boolean;
  browser: any; settled: Promise<void>; settle: () => void;
};
let current: Attempt | null = null;
let seq = 0;
const subscribers = new Map<number, Set<(o: NativeOAuthOutcome) => void>>();
const results = new Map<number, NativeOAuthOutcome>();
const OPEN_WAIT_MS = 20_000;
const SETTLE_MS = 1_000;
let physical: Promise<void> = Promise.resolve();
type SheetState = "clean" | "dirty" | "pending";
const phys: { sheet: SheetState; echo: (() => void) | null } = { sheet: "clean", echo: null };

type OpResult = "fulfilled" | "rejected" | "timeout";
/** Run a bridge call with a deadline. A synchronous throw and a rejection are both "rejected" —
 *  never "done" (R7-CLOSE). `late` reports how an overrun call finally settled. */
function runOp(op: () => unknown, ms: number): { result: Promise<OpResult>; late: Promise<"fulfilled" | "rejected"> } {
  let p: Promise<unknown>;
  try { p = Promise.resolve(op()); } catch (e) { p = Promise.reject(e); }
  const late = p.then(() => "fulfilled" as const, () => "rejected" as const);
  const result = Promise.race([late, new Promise<"timeout">(r => setTimeout(() => r("timeout"), ms))]);
  return { result, late };
}
const bounded = <T,>(p: Promise<T> | T, ms: number): Promise<"done" | "timeout"> =>
  Promise.race([Promise.resolve(p).then(() => "done" as const, () => "done" as const), new Promise<"timeout">(r => setTimeout(() => r("timeout"), ms))]);

/** One physical step at a time. */
function enqueue<T>(step: () => Promise<T>): Promise<T> {
  const run = physical.then(step);
  physical = run.then(() => undefined, () => undefined);
  return run;
}

/** THE ONLY WAY A SHEET IS CLOSED (runs inside a queue step). True = state is now clean. */
async function confirmClosedInQueue(browser: any): Promise<boolean> {
  if (phys.sheet === "pending") return false;
  const { result, late } = runOp(() => browser?.close?.(), CLOSE_WAIT_MS);
  const r = await result;
  if (r === "fulfilled") {
    /* Settle window: at most one browserFinished is consumed as this close's echo, and it ends
       before any new sheet can open (R7-EVENT). */
    await new Promise<void>(res => {
      const t = setTimeout(() => { phys.echo = null; res(); }, SETTLE_MS);
      phys.echo = () => { clearTimeout(t); phys.echo = null; res(); };
    });
    phys.sheet = "clean";
    return true;
  }
  if (r === "rejected") { phys.sheet = "dirty"; return false; }
  phys.sheet = "pending";
  void late.then(() => { phys.sheet = "dirty"; });   // settled late: still needs a confirming close
  return false;
}
function closePhysical(browser: any): Promise<boolean> {
  return enqueue(() => confirmClosedInQueue(browser));
}

/** Receive `attemptId`'s outcome exactly once — immediately if it has already ended. */
export function onNativeOAuthEnd(attemptId: number, cb: (outcome: NativeOAuthOutcome) => void): () => void {
  /* An id that was issued, is not running and is no longer in the 32-entry window: its outcome is
     unavailable, so it is reported as failed at once instead of waiting forever. */
  const done = results.get(attemptId) ?? (attemptId <= seq && current?.id !== attemptId ? "failed" : undefined);
  if (done) {
    let live = true;
    Promise.resolve().then(() => { if (live) { try { cb(done); } catch { /* caller bug */ } } });
    return () => { live = false; };
  }
  let set = subscribers.get(attemptId);
  if (!set) { set = new Set(); subscribers.set(attemptId, set); }
  set.add(cb);
  return () => { subscribers.get(attemptId)?.delete(cb); };
}

function end(a: Attempt, outcome: NativeOAuthOutcome, closeBrowser: boolean) {
  if (a.phase === "ended") return;              // exactly once
  a.phase = "ended"; a.outcome = outcome;
  results.set(a.id, outcome);
  if (results.size > 32) results.delete(results.keys().next().value as number);
  if (current === a) current = null;
  if (a.timer) { clearTimeout(a.timer); a.timer = null; }
  try { a.unsub?.(); } catch { /* already unsubscribed */ } a.unsub = null;
  if (closeBrowser && a.opened) void closePhysical(a.browser);
  a.settle();
  const set = subscribers.get(a.id); subscribers.delete(a.id);
  set?.forEach(cb => { try { cb(outcome); } catch { /* a caller's bug must not stop the others */ } });
  try { window.dispatchEvent(new CustomEvent(NATIVE_OAUTH_EVENT, { detail: { attemptId: a.id, outcome } })); } catch { /* no window */ }
}

function nativeError(stage: string) {
  return { code: "native_browser_unavailable", message: `native sign-in unavailable (${stage})` };
}

/** The address handed to the provider. iPhone has no https origin (capacitor://), so it uses the
 *  app's own scheme; Android uses the scheme when the build sets VITE_NATIVE_AUTH_SCHEME=1
 *  (APPSTORE 1 does), otherwise the App Link. Needs `ai.oneworldlabs.app://auth/**` on the auth
 *  redirect allow-list. The full path AND query are kept, so a `?next=` survives the round trip. */
export function nativeRedirectFor(pathAndQuery: string): string {
  let ios = false;
  try { ios = capacitor()?.getPlatform?.() === "ios"; } catch { /* treat as not iOS */ }
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return ios || env?.VITE_NATIVE_AUTH_SCHEME === "1" ? `${APP_SCHEME}//auth${pathAndQuery}` : `${APP_ORIGIN}${pathAndQuery}`;
}

/** True only for the callback of the attempt that expects `expectedPath`. */
export function isOurAuthReturn(raw: string | undefined, expectedPath: string): boolean {
  return classifyReturn(raw, expectedPath) !== null;
}
function classifyReturn(raw: string | undefined, expectedPath: string): "success" | "error" | null {
  if (!raw || !expectedPath) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.username || u.password) return null;
  const web = u.protocol === "https:" && u.origin === APP_ORIGIN;
  const scheme = u.protocol === APP_SCHEME && u.host === "auth";
  if (!web && !scheme) return null;
  if ((u.pathname || "/") !== expectedPath) return null;
  const q = new URLSearchParams(u.search), h = new URLSearchParams(u.hash.replace(/^#/, ""));
  const val = (k: string) => (q.get(k) || h.get(k) || "").trim();
  if (val("error")) return "error";
  if (val("code") || val("access_token")) return "success";
  return null;
}

/* ── listeners: one registration per (App, Browser) pair and generation ─────────────────────── */
type Reg = { app: any; browser: any; gen: number; handles: Array<{ remove?: () => unknown } | undefined>; ready: Promise<boolean> };
let reg: Reg | null = null;
let regGen = 0;
function removeAll(handles: Reg["handles"]) {
  return bounded(Promise.all(handles.map(h => { try { return Promise.resolve(h?.remove?.()); } catch { return undefined; } })), 2_000);
}
function ensureListeners(app: any, browser: any): Promise<boolean> {
  if (reg && reg.app === app && reg.browser === browser) return reg.ready;
  const old = reg;
  const gen = ++regGen;
  const mine: Reg = { app, browser, gen, handles: [], ready: Promise.resolve(false) };
  reg = mine;
  const live = () => reg === mine;
  mine.ready = (async () => {
    if (old) { await removeAll(old.handles); old.handles = []; }
    try {
      const h1 = await Promise.resolve(app.addListener("appUrlOpen", (event: { url?: string } | undefined) => {
        if (!live()) return;
        onReturn(event?.url);
      }));
      if (!live()) { await removeAll([h1]); return false; }
      mine.handles.push(h1);
      const h2 = await Promise.resolve(browser.addListener("browserFinished", () => {
        if (!live()) return;
        if (phys.echo) { phys.echo(); return; }        // the echo of the close we are settling
        const a = current;
        if (!a) return;
        /* No sheet identity on this event: the attempt ends, the state stays DIRTY, and the next
           open confirms closure first (R7-EVENT fail-closed recovery). */
        if (a.phase === "open") end(a, "cancelled", false);
        /* R7: the sheet can be dismissed before Browser.open() resolves. Remember it; the attempt
           ends "cancelled" the moment open settles, instead of waiting out the 15-min TTL. */
        else if (a.phase === "starting" && a.opening) a.finishedWhileOpening = true;
      }));
      if (!live()) { await removeAll([h2]); return false; }
      mine.handles.push(h2);
      return true;
    } catch {
      await removeAll(mine.handles); mine.handles = [];
      if (live()) reg = null;
      return false;
    }
  })();
  return mine.ready;
}

function onReturn(url: string | undefined) {
  const a = current;
  if (!a || (a.phase !== "open" && !(a.phase === "starting" && a.opening))) return;
  const kind = classifyReturn(url, a.path);
  if (!kind) return;
  if (kind === "error") { end(a, "failed", true); return; }
  a.phase = "completing";
  void closePhysical(a.browser);
  if (a.timer) clearTimeout(a.timer);
  a.timer = setTimeout(() => end(a, "failed", false), COMPLETE_WITHIN_MS);
  /* The SDK may already have the session (its SIGNED_IN can arrive before this event). */
  void Promise.resolve().then(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session && a.phase === "completing") end(a, "session", false);
    } catch { /* the SIGNED_IN subscription or the 30-s deadline decides */ }
  });
}

/** Start a native sign-in. Settles as soon as EITHER the system browser is open OR the attempt has
 *  ended (startup deadline, failure, replacement) — never later (R5-A). Resolves
 *  `{ error, attemptId?, outcome?, superseded? }`; subscribe with onNativeOAuthEnd(attemptId), which
 *  replays an outcome that already happened. `superseded` is true ONLY when a newer tap took over. */
export async function startNativeOAuth(
  provider: "google" | "apple",
  redirectTo: string,
  extra: Record<string, unknown>,
): Promise<{ error: unknown | null; attemptId?: number; superseded?: boolean; outcome?: NativeOAuthOutcome }> {
  let pathAndQuery: string, path: string;
  try {
    const r = new URL(redirectTo);
    /* Callers build redirectTo from window.location.origin, which is capacitor://app.oneworldlabs.ai
       on iPhone and https://app.oneworldlabs.ai on Android: both are this app. */
    if (!(r.protocol === "https:" || r.protocol === "capacitor:") || r.hostname !== APP_HOST || r.port || r.username || r.password) {
      return { error: nativeError("redirect") };
    }
    path = r.pathname || "/";
    pathAndQuery = path + r.search;
  } catch { return { error: nativeError("redirect") }; }

  /* Fail closed while a previous physical open/close has not settled (R5-C / r8). */
  if (phys.sheet === "pending") return { error: nativeError("browser state unknown") };

  // OWNERSHIP FIRST: the previous attempt ends before anything is awaited; its browser (if it was
  // opened) is closed through the physical queue, ahead of this attempt's open.
  const previous = current;
  let settle!: () => void;
  const settled = new Promise<void>(r => { settle = r; });
  const a: Attempt = { id: ++seq, path, phase: "starting", outcome: null, timer: null, unsub: null,
    opened: false, opening: false, finishedWhileOpening: false, browser: null, settled, settle };
  if (previous) end(previous, "superseded", true);
  current = a;
  a.timer = setTimeout(() => end(a, "failed", true), STARTUP_MS);
  const owns = () => current === a && a.phase !== "ended";
  let lastError: unknown = null;
  const result = () => ({
    error: a.outcome && a.outcome !== "superseded" && a.phase === "ended" && a.outcome === "failed" ? (lastError ?? nativeError("startup")) : null,
    attemptId: a.id, outcome: a.outcome ?? undefined, superseded: a.outcome === "superseded",
  });
  const failWith = (err: unknown) => { lastError = err; if (owns()) end(a, "failed", false); return result(); };

  const work = (async () => {
    try {
      const plugins = capacitor()?.Plugins;
      const browser = plugins?.Browser, app = plugins?.App;
      if (!browser || typeof browser.open !== "function" || typeof browser.close !== "function"
          || typeof browser.addListener !== "function" || !app || typeof app.addListener !== "function") {
        return failWith(nativeError("plugins missing"));
      }
      a.browser = browser;
      if (!(await ensureListeners(app, browser))) return failWith(nativeError("listener"));
      if (!owns()) return result();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: nativeRedirectFor(pathAndQuery), skipBrowserRedirect: true, ...extra },
      });
      if (!owns()) return result();
      if (error) return failWith(controlledAuthError(error, "oauth_failed"));
      const url = data?.url;
      if (!url) return failWith(nativeError("no url"));

      try {
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN" && a.phase === "completing") end(a, "session", false);
        });
        a.unsub = () => sub?.subscription?.unsubscribe?.();
      } catch { /* the post-return getSession check and the 30-s deadline still decide */ }

      if (phys.sheet === "pending") return failWith(nativeError("browser state unknown"));
      let openError = false, blocked = false, timedOut = false;
      await enqueue(async () => {
        if (!owns()) return;
        /* An earlier sheet may still be open: it must be CLOSED (fulfilled) before this one opens. */
        if (phys.sheet !== "clean" && !(await confirmClosedInQueue(browser))) { blocked = true; return; }
        if (!owns()) return;
        phys.sheet = "dirty";                          // from here a sheet of ours may exist
        a.opening = true;
        const { result, late } = runOp(() => browser.open({ url }), OPEN_WAIT_MS);
        const r = await result;
        a.opening = false;
        if (r === "fulfilled") {
          a.opened = true;
          if (!owns()) await confirmClosedInQueue(browser);   // superseded / expired while opening
        } else if (r === "rejected") {
          openError = true;
        } else {
          timedOut = true;
          phys.sheet = "pending";
          /* A late open is closed through the same machine; a late rejection leaves it dirty. */
          void late.then(res => {
            phys.sheet = "dirty";
            if (res === "fulfilled") { a.opened = true; void closePhysical(browser); }
          });
        }
      });
      if (timedOut) return failWith(nativeError("open timed out"));
      if (blocked) return failWith(nativeError("browser state unknown"));
      if (openError) return failWith(nativeError("open"));
      if (!owns() || !a.opened) return result();
      /* R7: a callback that arrived while opening already moved us to "completing" — keep it. */
      if (a.phase === "completing") return result();
      /* R7: dismissed before open resolved — the browser is already gone, nothing to close. */
      if (a.finishedWhileOpening) { end(a, "cancelled", false); return result(); }
      a.phase = "open";
      if (a.timer) clearTimeout(a.timer);
      a.timer = setTimeout(() => end(a, "expired", true), ATTEMPT_TTL_MS);
      return result();
    } catch (e) {
      return failWith(controlledAuthError(e, "native_browser_unavailable"));
    }
  })();
  /* The caller gets an answer at the first of: work finished, or the attempt ended (deadline,
     replacement). A hung SDK/open/listener can never keep a button busy. */
  return Promise.race([work, settled.then(() => result())]);
}

/** Test seam: forget all state (never called by the app). */
export function __resetNativeOAuthForTests() {
  if (current?.timer) clearTimeout(current.timer);
  current = null; subscribers.clear(); results.clear(); reg = null; physical = Promise.resolve(); phys.sheet = "clean"; phys.echo = null;
}
