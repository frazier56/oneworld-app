/**
 * ONE way for a screen to own its native sign-in attempts (Security R4-A / R5-B, 20 Oct 2026).
 *
 *   const native = useNativeAttempt();
 *   const call = native.begin();                 // right before oauthSignIn
 *   const r = await oauthSignIn(...);
 *   if (!call.live()) return;                    // unmounted, or a newer tap of this screen took over
 *   call.track(r, freeButton, showFailed);       // frees the button when THIS call's attempt ends
 *   if (r.error) { showError(r.error); freeButton(); }
 *
 * Ownership is per CALL (a generation number), not per screen:
 *   · a newer begin() makes every older call dead — its late result and its late outcome are ignored,
 *     whatever order they settle in;
 *   · unmount makes every call dead and removes every subscription, including ones a late track()
 *     would otherwise install;
 *   · the newest call frees the button when its attempt ends without a session — including when
 *     ANOTHER screen's tap superseded it (that screen owns its own button).
 */
import { useEffect, useRef } from "react";
import { onNativeOAuthEnd, type NativeOAuthOutcome } from "./nativeOAuth";

export type NativeCall = {
  live(): boolean;
  track(r: { error: unknown | null; attemptId?: number }, onFree: () => void, onFailed: () => void): void;
};

export function useNativeAttempt() {
  const mounted = useRef(true);
  const gen = useRef(0);
  const off = useRef<(() => void) | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; gen.current++; off.current?.(); off.current = null; };
  }, []);
  return {
    begin(): NativeCall {
      const mine = ++gen.current;
      off.current?.(); off.current = null;            // the previous call's subscription is no longer ours
      const live = () => mounted.current && gen.current === mine;
      return {
        live,
        track(r, onFree, onFailed) {
          if (!live() || r.error || !r.attemptId) return;
          const id = r.attemptId;
          off.current = onNativeOAuthEnd(id, (o: NativeOAuthOutcome) => {
            if (!live()) return;
            off.current = null;
            if (o === "session") return;
            onFree();
            if (o === "failed") onFailed();
          });
        },
      };
    },
  };
}
