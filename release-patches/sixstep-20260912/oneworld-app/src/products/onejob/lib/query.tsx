import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * THE PORTED SCREENS' QUERY CACHE — `useAsync` semantics, react-query's SHAPE.
 * ============================================================================================
 * WHY THIS FILE EXISTS, stated plainly so nobody re-adds the library.
 *
 * The 5-Aug OneJob build read every row through `@tanstack/react-query` — 25 call sites across
 * the feed, My jobs, the contract form and the money screens. The One World foundation rule is
 * that `useAsync` is the sanctioned data hook and react-query is not part of the stack: four
 * products already read Supabase without it, and OneJob arriving with a second data layer is
 * exactly the "tangled web" the shell exists to prevent. It would also have put a query library
 * in the first-load bundle of an app whose other four products never ask for one.
 *
 * Rewriting 25 call sites by hand was the other option, and it was the worse one: three of them
 * are on the money surface and one (`MediaEngagement`) does an optimistic like with a rollback,
 * which is precisely the logic you do not want to re-derive under time pressure. So the CALL
 * SITES are untouched — byte-identical to the build that is live and proven — and the ~90 lines
 * underneath them are ours.
 *
 * ── WHAT IT IMPLEMENTS (and nothing more, deliberately) ─────────────────────────────────────
 *   useQuery({ queryKey, queryFn, enabled?, staleTime? })  → { data, isLoading, error, refetch }
 *   useMutation({ mutationFn, onMutate?, onError?, onSuccess?, onSettled? }) → { mutate, mutateAsync, isPending }
 *   useQueryClient() → { getQueryData, setQueryData, invalidateQueries, cancelQueries }
 *
 * That is the whole surface the ported code uses, verified by grep before this was written. If a
 * future screen needs an option that is not here, ADD IT HERE — do not reach for the library.
 *
 * ── THE THREE THINGS THAT ARE EASY TO GET WRONG, and how they are handled ───────────────────
 *  1. `invalidateQueries({ queryKey: ["feed"] })` is a PREFIX match in react-query. `["feed"]`
 *     must also invalidate `["feed", "near"]`. Exact-match here would silently leave stale rows
 *     on screen after a post — a bug that looks like "my post didn't save".
 *  2. A resolve that lands after the key changed must not overwrite the newer answer. Each fetch
 *     carries a monotonic id and a late one is dropped (the same guard the shell's `useAsync`
 *     documents).
 *  3. `cancelQueries` in an optimistic update exists to stop an in-flight refetch from clobbering
 *     the optimistic value. There is no real abort here, so it marks the in-flight run as
 *     superseded — which produces the same observable behaviour.
 *
 * The cache lives on a provider instance, never at module scope: a module-level store is shared
 * by every mount in a test run and leaks one member's rows into the next.
 */

type Key = readonly unknown[];
const ser = (k: Key) => JSON.stringify(k);

/** Prefix match, react-query's rule: ["feed"] matches ["feed", "near"], never the reverse. */
export function matchesKey(entryKey: Key, filter: Key) {
  if (filter.length > entryKey.length) return false;
  return filter.every((part, i) => JSON.stringify(part) === JSON.stringify(entryKey[i]));
}

type Entry = {
  key: Key;
  data: unknown;
  error: unknown;
  updatedAt: number;
  fetching: boolean;
  /** Bumped on every start; a resolve whose id is stale is discarded. */
  run: number;
  subs: Set<() => void>;
};

/* Exported for `tests/onejob.query.cjs` — the cache rules (prefix invalidation, staleness,
   late-resolve drop) are the part worth testing without a DOM. */
export class Cache {
  private map = new Map<string, Entry>();

  entry(key: Key): Entry {
    const id = ser(key);
    let e = this.map.get(id);
    if (!e) { e = { key, data: undefined, error: undefined, updatedAt: 0, fetching: false, run: 0, subs: new Set() }; this.map.set(id, e); }
    return e;
  }
  notify(e: Entry) { for (const fn of [...e.subs]) fn(); }

  async fetch(key: Key, fn: () => Promise<unknown>) {
    const e = this.entry(key);
    const run = ++e.run;
    e.fetching = true; this.notify(e);
    try {
      const data = await fn();
      if (e.run !== run) return;                       // superseded — drop the late answer
      e.data = data; e.error = undefined; e.updatedAt = Date.now();
    } catch (err) {
      if (e.run !== run) return;
      e.error = err;
    } finally {
      if (e.run === run) { e.fetching = false; this.notify(e); }
    }
  }

  get(key: Key) { return this.map.get(ser(key))?.data; }
  set(key: Key, value: unknown) {
    const e = this.entry(key);
    e.data = typeof value === "function" ? (value as (p: unknown) => unknown)(e.data) : value;
    e.updatedAt = Date.now();
    this.notify(e);
  }
  /** Mark stale and re-run whatever is currently on screen under that prefix. */
  invalidate(filter: Key) {
    for (const e of this.map.values()) {
      if (!matchesKey(e.key, filter)) continue;
      e.updatedAt = 0;
      this.notify(e);
    }
  }
  cancel(filter: Key) {
    for (const e of this.map.values()) if (matchesKey(e.key, filter)) { e.run++; e.fetching = false; }
  }
}

const Ctx = createContext<Cache | null>(null);

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [cache] = useState(() => new Cache());
  return <Ctx.Provider value={cache}>{children}</Ctx.Provider>;
}

function useCache(): Cache {
  const c = useContext(Ctx);
  if (!c) throw new Error("[onejob] useQuery/useMutation outside <QueryProvider> — wrap the /jobs routes in it.");
  return c;
}

export function useQueryClient() {
  const cache = useCache();
  return useMemo(() => ({
    getQueryData: (key: Key) => cache.get(key),
    setQueryData: (key: Key, value: unknown) => cache.set(key, value),
    invalidateQueries: (opts: { queryKey: Key }) => { cache.invalidate(opts.queryKey); return Promise.resolve(); },
    cancelQueries: (opts: { queryKey: Key }) => { cache.cancel(opts.queryKey); return Promise.resolve(); },
  }), [cache]);
}

export function useQuery<T>(opts: {
  queryKey: Key;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  /** How long an answer counts as fresh. Default 60s — the app-wide default. */
  staleTime?: number;
}): { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => void } {
  const { queryKey, queryFn, enabled = true, staleTime = 60_000 } = opts;
  const cache = useCache();
  const id = ser(queryKey);
  const [, force] = useState(0);
  /* The latest queryFn, without making it a dependency — a closure recreated every render would
     otherwise re-fetch on every render, which is the classic way this hook melts a database. */
  const fnRef = useRef(queryFn); fnRef.current = queryFn;

  const entry = cache.entry(queryKey);
  useEffect(() => {
    const e = cache.entry(queryKey);
    const sub = () => force(n => n + 1);
    e.subs.add(sub);
    if (enabled && !e.fetching && Date.now() - e.updatedAt > staleTime) {
      void cache.fetch(queryKey, () => fnRef.current());
    }
    return () => { e.subs.delete(sub); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled, staleTime]);

  /* An entry marked stale by invalidateQueries notifies its subscribers; this re-runs on the
     render that follows, which is what makes "post → the feed updates" work. */
  useEffect(() => {
    const e = cache.entry(queryKey);
    if (enabled && !e.fetching && e.updatedAt === 0 && e.data !== undefined) {
      void cache.fetch(queryKey, () => fnRef.current());
    }
  });

  return {
    data: entry.data as T | undefined,
    /* react-query's `isLoading`: a first load with nothing to show. A background refresh of data
       already on screen is NOT loading — flashing a skeleton over content someone is reading is
       worse than a slightly stale row. */
    isLoading: entry.data === undefined && (entry.fetching || (enabled && entry.updatedAt === 0)),
    error: entry.error,
    refetch: () => void cache.fetch(queryKey, () => fnRef.current()),
  };
}

export function useMutation<TVars, TData = unknown, TCtx = unknown>(opts: {
  mutationFn: (vars: TVars) => Promise<TData>;
  onMutate?: (vars: TVars) => Promise<TCtx> | TCtx;
  onError?: (err: unknown, vars: TVars, ctx: TCtx | undefined) => void;
  onSuccess?: (data: TData, vars: TVars, ctx: TCtx | undefined) => void;
  onSettled?: (data: TData | undefined, err: unknown, vars: TVars, ctx: TCtx | undefined) => void;
}) {
  const [isPending, setPending] = useState(false);
  const ref = useRef(opts); ref.current = opts;

  const mutateAsync = async (vars: TVars): Promise<TData | undefined> => {
    setPending(true);
    let ctx: TCtx | undefined;
    try {
      ctx = (await ref.current.onMutate?.(vars)) as TCtx | undefined;
      const data = await ref.current.mutationFn(vars);
      ref.current.onSuccess?.(data, vars, ctx);
      ref.current.onSettled?.(data, null, vars, ctx);
      return data;
    } catch (err) {
      /* The rollback path. It runs BEFORE onSettled, exactly as react-query orders them, because
         onSettled typically invalidates and the invalidation must see the restored value. */
      ref.current.onError?.(err, vars, ctx);
      ref.current.onSettled?.(undefined, err, vars, ctx);
      return undefined;
    } finally {
      setPending(false);
    }
  };

  return {
    isPending,
    mutateAsync,
    /** Fire-and-forget. Never let a rejected mutation become an unhandled rejection — an
     *  unhandled rejection inside an onClick is silent and reads as a frozen button. */
    mutate: (vars: TVars) => { void mutateAsync(vars); },
  };
}
