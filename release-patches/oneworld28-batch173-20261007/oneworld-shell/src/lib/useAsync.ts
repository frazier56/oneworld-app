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
 *
 * ⚠️ `useAsync` CANNOT TELL YOU IT FAILED, BY CONSTRUCTION. It returns `T | undefined`, and a
 * rejection sets `undefined` — the same value as "still loading". Every screen built on it
 * therefore shows a spinner forever, or an "it's empty here" message, when the read actually
 * failed. Use `useAsyncResult` below on any surface where a person would otherwise be told
 * their world is empty when the truth is that the request broke. — 22 Sep 2026
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

/**
 * The same hook, with the failure visible.
 * ============================================================================================
 * Additive on purpose: `useAsync` has many callers and its signature does not change. This one
 * hands back `{ data, error, loading }` so a screen can say "that did not load, try again"
 * instead of lying about an empty result. `retry` bumps an internal nonce, so a caller gets a
 * real retry without remounting anything.
 */
export function useAsyncResult<T>(fn: () => Promise<T>, deps: unknown[], enabled = true) {
  const [state, setState] = useState<{ data: T | undefined; error: unknown }>(
    { data: undefined, error: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState(s => (s.error ? { data: s.data, error: null } : s));
    fn().then(v => { if (alive) setState({ data: v, error: null }); })
        /* ⚠️ A FAILED REFRESH MUST NOT THROW AWAY THE PAGE ALREADY ON SCREEN. — 22 Sep 2026
           This used to set `data: undefined` alongside the error. `take` is a dependency on
           every paging lane, so: a reader twelve cards deep, the feed asks for the next twelve
           three slides early, that one request fails on a flaky connection — and the twelve
           cards they were reading vanished, replaced by "That didn't load", with their position
           gone. Try again then reloaded the lane from the top. A feed that was working was
           destroyed by the failure of a page nobody had reached yet.

           So the error rides ALONGSIDE the last good data, which is what the success path at
           the line above already does while the next page loads. Callers decide what a failure
           means when they still have something to show — see each lane's `failed`, which is
           now gated on having nothing. */
        .catch(e => { if (alive) setState(s => ({ data: s.data, error: e ?? new Error("failed") })); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return {
    data: state.data,
    error: state.error,
    /* Loading is the honest middle: enabled, nothing back yet, and nothing has gone wrong. */
    loading: enabled && state.data === undefined && !state.error,
    retry: () => setNonce(n => n + 1),
  };
}
