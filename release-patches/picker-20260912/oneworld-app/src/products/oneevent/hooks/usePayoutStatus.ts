import { useEffect, useState, useCallback } from "react";
import { supabase } from "@evt/integrations/supabase/client";

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
  refresh: () => Promise<void>;
  startOnboarding: (returnPath?: string) => Promise<string | null>;
  disconnect: () => Promise<void>;
}

/**
 * Returns the current user's Stripe Connect Express payout readiness.
 * Use to gate "Publish paid event" and "Accept paid job" actions.
 */
export function usePayoutStatus(): PayoutStatus {
  const [state, setState] = useState({
    has_account: false,
    payouts_enabled: false,
    charges_enabled: false,
    details_submitted: false,
    requirements_currently_due: [] as string[],
    country: null as string | null,
    default_currency: null as string | null,
    bank_last4: null as string | null,
    bank_name: null as string | null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
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
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
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
    return () => window.removeEventListener("onesocial:payouts-changed", handler);
  }, [refresh]);

  return { ...state, refresh, startOnboarding, disconnect };
}
