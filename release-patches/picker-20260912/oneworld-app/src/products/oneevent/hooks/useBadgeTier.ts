import { useEffect, useState } from "react";
import { supabase } from "@evt/lib/supabase";
import type { BadgeTier } from "@evt/lib/badgeTiers";

/**
 * Single source of truth for a user's badge tier.
 *
 * Calls the `compute_badge_tier(user_id)` Postgres RPC, which applies the
 * exact same gate logic everywhere — profile header, public passport, and
 * embedded SVG badge image. No more drift between surfaces.
 *
 * Returns null until resolved, so callers can render a skeleton instead of
 * flashing the wrong tier.
 */
export function useBadgeTier(userId: string | null | undefined) {
  const [tier, setTier] = useState<BadgeTier | null>(null);
  const [loading, setLoading] = useState<boolean>(!!userId);

  useEffect(() => {
    if (!userId) {
      setTier(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("compute_badge_tier", { p_user_id: userId });
      if (!active) return;
      if (error || typeof data !== "string") {
        setTier("member"); // safe fallback — never overstate
      } else {
        setTier(data as BadgeTier);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  return { tier, loading };
}
