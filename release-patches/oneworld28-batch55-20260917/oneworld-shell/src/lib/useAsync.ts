import { useEffect, useState } from "react";

/**
 * A TINY DATA HOOK — the shell does not depend on react-query.
 * ============================================================================================
 * OneJob's profile subsystem used `@tanstack/react-query` for every Supabase read. Pulling that
 * into the shell would add a dependency (and a provider requirement) that no other shell code
 * needs, so the reads are expressed here instead: run `fn` when `enabled`, re-run when a dep
 * changes, hand back the latest result. No cache, no provider — the shell's own screens
 * (OneWorldSwitcher, AuthGate) already read Supabase this way.
 *
 * Guards the two failure modes that matter: a resolve after unmount is dropped, and a stale
 * response from a superseded dep set never overwrites a newer one (a monotonic run id).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fn().then(v => { if (alive) setData(v); }).catch(() => { if (alive) setData(undefined); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}
