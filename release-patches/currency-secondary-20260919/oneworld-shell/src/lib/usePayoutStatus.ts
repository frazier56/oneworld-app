/**
 * STRIPE CONNECT PAYOUT READINESS — one hook for every product (shell-owned since 11 Sep 2026).
 * ============================================================================================
 * Lifted unchanged from OneEvent's `hooks/usePayoutStatus.ts` (OneHome 27, Batch 2): OneHome's
 * host profile was importing it across products, which is the import graph this codebase keeps
 * paying for. OneEvent's file now re-exports this one.
 *
 * `payouts_enabled` is the ONLY readiness signal a money flow may use. `charges_enabled` means
 * Stripe will let this account TAKE card payments; it says nothing about paying money OUT to a
 * bank. The two have been conflated once already (OneJob's PayoutSetup fell back to
 * charges_enabled) and Max ruled on 11 Sep 2026 that they never are again.
 *
 * ── STATE IS BOUND TO THE ACCOUNT THAT PRODUCED IT (Max's Batch 2 review, finding 2) ──────────
 * The lifted hook kept the previous answer when the session was gone or the status call failed,
 * and never noticed a sign-out or an account switch. On a shared phone that is one person's bank
 * summary and "ready" flag shown to the next. Now:
 *   · no session        → the state RESETS to "no account" (nothing stale survives a sign-out)
 *   · call fails        → the state RESETS and carries `error`; a previous success is not kept
 *   · account changes   → `onAuthStateChange` refreshes; every answer is tagged with the user it
 *                         was fetched FOR and dropped if a different user is signed in by the time
 *                         it arrives (a slow answer for A can never land on B)
 *   · `user_id` exposes who the state belongs to, so a screen can refuse to act on a mismatch
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabase";

export interface PayoutStatus {
  has_account: boolean;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
  requirements_currently_due?: string[];
  country?: string | null;
  default_currency?: string | null;
  bank_last4?: string | null;
  bank_name?: string | null;
  loading: boolean;
  /** The signed-in user this answer was fetched for; null when signed out. */
  user_id: string | null;
  /** Set when the last status call failed; the readiness fields are then all false. */
  error: string | null;
  refresh: () => Promise<void>;
  startOnboarding: (returnPath?: string) => Promise<string | null>;
  disconnect: () => Promise<void>;
}

/**
 * Returns the current user's Stripe Connect Express payout readiness.
 * Use to gate "Publish paid event" and "Accept paid job" actions.
 */
const EMPTY = {
  has_account: false,
  payouts_enabled: false,
  charges_enabled: false,
  details_submitted: false,
  requirements_currently_due: [] as string[],
  country: null as string | null,
  default_currency: null as string | null,
  bank_last4: null as string | null,
  bank_name: null as string | null,
  user_id: null as string | null,
  error: null as string | null,
};

export function usePayoutStatus(): PayoutStatus {
  const [state, setState] = useState({ ...EMPTY, loading: true });
  /* Monotonic request counter: only the newest in-flight refresh may write state. */
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    let uid: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      uid = session?.user?.id ?? null;
      if (!session || !uid) {
        if (mine === seq.current) setState({ ...EMPTY, loading: false });
        return;
      }
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (mine !== seq.current) return;                       // a newer refresh (or a sign-out) superseded this answer
      const { data: { session: now } } = await supabase.auth.getSession();
      if ((now?.user?.id ?? null) !== uid) return;            // the account changed while the answer was in flight
      setState({
        has_account: !!data?.has_account,
        payouts_enabled: !!data?.payouts_enabled,
        charges_enabled: !!data?.charges_enabled,
        details_submitted: !!data?.details_submitted,
        requirements_currently_due: data?.requirements_currently_due ?? [],
        country: data?.country ?? null,
        default_currency: data?.default_currency ?? null,
        bank_last4: data?.bank_last4 ?? null,
        bank_name: data?.bank_name ?? null,
        user_id: uid,
        error: null,
        loading: false,
      });
    } catch (e) {
      if (mine !== seq.current) return;
      /* A failed refresh must not leave the PREVIOUS account's (or the previous call's) summary
         and "ready" flag on screen. Reset, and say why. */
      setState({ ...EMPTY, user_id: uid, error: (e as { message?: string })?.message || "Could not read payout status.", loading: false });
    }
  }, []);

  const startOnboarding = useCallback(async (returnPath?: string) => {
    const body: Record<string, unknown> = {};
    if (returnPath) {
      // The app is served under a base path (e.g. /oneevents-preview/), but Stripe's
      // return_url = origin + returnPath. Without the base, Stripe sent hosts to
      // oneworldlabs.ai/app/events (nonexistent) → the old homepage. Prefix the base
      // so they land back inside OneEvent. (Lee, Jul 23)
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      body.returnPath = base && !returnPath.startsWith(base + "/") ? base + returnPath : returnPath;
    }
    const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", { body });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      let serverMsg = "";
      if (ctx && typeof ctx.text === "function") {
        try {
          const raw = await ctx.text();
          const parsed = raw ? JSON.parse(raw) : null;
          serverMsg = parsed?.error || raw || "";
        } catch { /* body wasn't JSON */ }
      }
      throw new Error(serverMsg || (error as { message?: string }).message || "Could not start payout onboarding.");
    }
    if (!data?.url) {
      throw new Error(data?.error || "Stripe did not return an onboarding link. Check Stripe Connect key permissions.");
    }
    return data.url as string;
  }, []);

  const disconnect = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("stripe-connect-disconnect", { body: {} });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      let serverMsg = "";
      if (ctx && typeof ctx.text === "function") {
        try {
          const raw = await ctx.text();
          const parsed = raw ? JSON.parse(raw) : null;
          serverMsg = parsed?.error || raw || "";
        } catch { /* not json */ }
      }
      throw new Error(serverMsg || (error as { message?: string }).message || "Could not disconnect payouts.");
    }
    if (data?.error) throw new Error(data.error);
    await refresh();
    // Broadcast so other usePayoutStatus consumers (e.g. PayoutStatusCard)
    // re-fetch without a manual page refresh.
    try { window.dispatchEvent(new CustomEvent("onesocial:payouts-changed")); } catch { /* noop */ }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const handler = () => { refresh(); };
    window.addEventListener("onesocial:payouts-changed", handler);
    /* Sign-out, sign-in and account switch all re-run the refresh; a sign-out resets to EMPTY
       inside refresh() because getSession() then has no session. */
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") refresh();
    });
    return () => { window.removeEventListener("onesocial:payouts-changed", handler); sub?.subscription?.unsubscribe?.(); };
  }, [refresh]);

  return { ...state, refresh, startOnboarding, disconnect };
}
