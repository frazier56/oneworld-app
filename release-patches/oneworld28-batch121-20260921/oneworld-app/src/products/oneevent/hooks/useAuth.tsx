import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, useOneId } from "@oneworld/shell";

/**
 * COMPAT ADAPTER — the ported OneEvent screens' `useAuth`, re-based on One ID.
 * ============================================================================================
 * The 2026-07-23 OneEvent build carried its own AuthProvider (Google OAuth, e-mail codes, its
 * own session listener). All of that is SHELL now — 00d's table is explicit that a second
 * sign-in path splits identity — so this file keeps the old hook's SHAPE and deletes its
 * mechanics. Screens keep calling `useAuth()` and get the same fields; the session underneath
 * is the one shared by all eight products.
 *
 * Two things the old hook did that current grants forbid:
 *   · `select('plan, email, short_token, …')` straight off `profiles` — those columns are NOT
 *     granted to `authenticated` any more and the select would throw 42501 for everyone. The
 *     owner's private columns come back from the `my_private_profile()` RPC, the ONE sanctioned
 *     path (00d). If the RPC is missing a field we degrade to `free`/null rather than break the
 *     screen — a plan gate that fails open to "free" merely hides paid features.
 *   · expose `signInGoogle` / `sendEmailCode` / `verifyEmailCode` — auth entry points are
 *     shell-owned. Nothing ported calls them (AuthPage was not ported); they are gone, and a
 *     compile error on a missed call-site is exactly what we want.
 */
export interface Profile {
  id: string; full_name: string | null; photo_url: string | null; job_title: string | null;
  bio: string | null; email: string | null; is_public: boolean | null; short_token: string | null;
  location: string | null; category: string | null; created_at?: string | null;
  plan?: string | null; plan_interval?: string | null; plan_current_period_end?: string | null;
}

interface AuthCtx {
  user: { id: string; email?: string | null } | null;
  profile: Profile | null;
  loading: boolean;
  /** Current plan snapshot (free/pro/vip), via my_private_profile(). */
  subscription: { plan: string; interval: string | null; periodEnd: string | null };
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { userId, email, loading: idLoading, signOutEverywhere } = useOneId();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string, mail: string | null) => {
    /* Public half: granted columns only — `select('*')` on profiles throws 42501. */
    const { data: pub } = await supabase.from("profiles")
      .select("id, full_name, photo_url, job_title, bio, is_public, location, category, created_at")
      .eq("id", uid).maybeSingle();
    /* Private half (owner only): plan and friends live behind the RPC. */
    let priv: Record<string, unknown> = {};
    try {
      const { data } = await supabase.rpc("my_private_profile");
      const row = Array.isArray(data) ? data[0] : data;
      if (row && typeof row === "object") priv = row as Record<string, unknown>;
    } catch { /* degrade to free — never take the screen down over a plan read */ }
    /* PER-APP SUBSCRIPTION (Lee, 9 Aug 2026): one shared profile, but VIP on OneEvent is a
       different product from VIP on OneJob — paid for separately. `my_app_plan('oneevent')`
       is the app-specific truth (expiry-aware; reverts to free at read time). The legacy
       shared `profiles.plan` remains the RPC's own server-side fallback for accounts granted
       before the split, so this replaces the client-side plan fields wholesale when present. */
    try {
      const { data } = await supabase.rpc("my_app_plan", { p_app: "oneevent" });
      const row = Array.isArray(data) ? data[0] : data;
      if (row && typeof row === "object" && (row as Record<string, unknown>).plan) {
        const r = row as Record<string, unknown>;
        priv = { ...priv, plan: r.plan, plan_interval: r.plan_interval,
                 plan_current_period_end: r.current_period_end };
      }
    } catch { /* older DB without the RPC — the my_private_profile fields above still rule */ }
    setProfile({
      id: uid,
      full_name: (pub?.full_name as string | null) ?? null,
      photo_url: (pub?.photo_url as string | null) ?? null,
      job_title: (pub?.job_title as string | null) ?? null,
      bio: (pub?.bio as string | null) ?? null,
      is_public: (pub?.is_public as boolean | null) ?? null,
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
    profile,
    loading: idLoading || loading,
    subscription: {
      plan: profile?.plan || "free",
      interval: profile?.plan_interval ?? null,
      periodEnd: profile?.plan_current_period_end ?? null,
    },
    signOut: async () => { await signOutEverywhere(); },
    refreshProfile: async () => { if (userId) await loadProfile(userId, email); },
  }), [userId, email, profile, loading, idLoading, signOutEverywhere, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("[oneevent] useAuth() outside <AuthProvider> — wrap the /events routes in it.");
  return v;
}
