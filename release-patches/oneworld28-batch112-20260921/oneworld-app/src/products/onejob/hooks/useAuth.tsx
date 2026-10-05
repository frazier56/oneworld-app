import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, useOneId } from "@oneworld/shell";

/**
 * COMPAT ADAPTER — the ported OneJob screens' `useAuth`, re-based on ONE ID.
 * ============================================================================================
 * The 5 Aug OneJob build shipped its own AuthProvider: its own session listener, its own
 * sign-in/sign-up/OAuth entry points, its own `profiles` read. Every one of those is SHELL now.
 * A second sign-in path splits identity — the member is "signed in" in OneJob and a guest in
 * OneScore, which is the precise bug the single-origin shell was built to delete.
 *
 * So this file keeps the old hook's SHAPE and deletes its mechanics. Screens keep calling
 * `useAuth()` and get `{ user, session, profile, loading, signOut, refreshProfile }`; the session
 * underneath is the one shared by all eight products.
 *
 * Two things the old hook did that the current column grants forbid:
 *   · `select('*')` (or a private-column list) straight off `profiles` — those columns are not
 *     granted to `authenticated` and the select throws 42501 for every signed-in member. Public
 *     columns are named explicitly; the owner's private half comes back from the sanctioned
 *     `my_private_profile()` RPC and degrades to null rather than taking the screen down.
 *   · expose sign-in / sign-up / OAuth. Auth entry points are shell-owned. They are gone, and a
 *     compile error on a missed call site is exactly what we want.
 */
export interface Profile {
  id: string; full_name: string | null; photo_url: string | null; job_title: string | null;
  bio: string | null; email: string | null; is_public: boolean | null; short_token: string | null;
  /** OneJob's "Get discovered" switch. A GRANTED public column (checked against the live
   *  column grants, 9 Aug 2026) — it is the app's own field, not a private one. */
  onejob_discoverable: boolean | null;
  location: string | null; category: string | null; created_at?: string | null;
  plan?: string | null; plan_interval?: string | null; plan_current_period_end?: string | null;
}

interface AuthCtx {
  user: { id: string; email?: string | null } | null;
  /** The live Supabase session — the money screens send its access token to the edge functions. */
  session: { access_token: string } | null;
  profile: Profile | null;
  loading: boolean;
  subscription: { plan: string; interval: string | null; periodEnd: string | null };
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { userId, email, loading: idLoading, signOutEverywhere } = useOneId();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  /* The access token, kept fresh. The money path (`stripe-connect-onboard`,
     `stripe-connect-status`) sends it as an explicit Authorization header, so it has to be the
     CURRENT one — a token read once at mount is stale after the first silent refresh, and a
     stale token on a payout call fails in a way that reads as "payouts are broken". */
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session ? { access_token: data.session.access_token } : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (alive) setSession(s ? { access_token: s.access_token } : null);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const loadProfile = useCallback(async (uid: string, mail: string | null) => {
    /* Granted columns only — never `select('*')` on `profiles`. */
    const { data: pub } = await supabase.from("profiles")
      .select("id, full_name, photo_url, job_title, bio, is_public, onejob_discoverable, location, category, created_at")
      .eq("id", uid).maybeSingle();
    let priv: Record<string, unknown> = {};
    try {
      const { data } = await supabase.rpc("my_private_profile");
      const row = Array.isArray(data) ? data[0] : data;
      if (row && typeof row === "object") priv = row as Record<string, unknown>;
    } catch { /* degrade to free — never take a screen down over a plan read */ }
    setProfile({
      id: uid,
      full_name: (pub?.full_name as string | null) ?? null,
      photo_url: (pub?.photo_url as string | null) ?? null,
      job_title: (pub?.job_title as string | null) ?? null,
      bio: (pub?.bio as string | null) ?? null,
      is_public: (pub?.is_public as boolean | null) ?? null,
      onejob_discoverable: (pub?.onejob_discoverable as boolean | null) ?? null,
      location: (pub?.location as string | null) ?? null,
      category: (pub?.category as string | null) ?? null,
      created_at: (pub?.created_at as string | null) ?? null,
      email: (priv.email as string | null) ?? mail ?? null,
      short_token: (priv.short_token as string | null) ?? null,
      plan: (priv.plan as string | null) ?? null,
      plan_interval: (priv.plan_interval as string | null) ?? null,
      plan_current_period_end: (priv.plan_current_period_end as string | null) ?? null,
    });
  }, []);

  useEffect(() => {
    let alive = true;
    if (idLoading) return;
    if (!userId) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    loadProfile(userId, email).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, email, idLoading, loadProfile]);

  const value = useMemo<AuthCtx>(() => ({
    user: userId ? { id: userId, email } : null,
    session,
    profile,
    loading: idLoading || loading,
    subscription: {
      plan: profile?.plan || "free",
      interval: profile?.plan_interval ?? null,
      periodEnd: profile?.plan_current_period_end ?? null,
    },
    signOut: async () => { await signOutEverywhere(); },
    refreshProfile: async () => { if (userId) await loadProfile(userId, email); },
  }), [userId, email, session, profile, loading, idLoading, signOutEverywhere, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("[onejob] useAuth() outside <AuthProvider> — wrap the /jobs routes in it.");
  return v;
}
