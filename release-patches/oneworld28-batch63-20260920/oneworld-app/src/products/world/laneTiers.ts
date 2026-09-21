import { useMemo } from "react";
import { supabase, useAsync, type BadgeTier } from "@oneworld/shell";

/**
 * THE BADGE TIER FOR EVERY FACE IN A LANE — R16 note 5.
 * ============================================================================================
 * The donut beside a name takes TWO facts: the OneScore, which sets the arc's length and depth,
 * and the BADGE TIER, which sets its colour. The score is a column on `profiles` and every lane
 * already reads it. The tier is not a column — it is `compute_badge_tier(user_id)`, a Postgres
 * function, and it is deliberately not stored anywhere, because the gates it applies (identity,
 * endorsements, completed work) change underneath a row without the row being touched.
 *
 * So it has to be asked for, and the established way of asking is OneJob's own people list:
 * `supabase.rpc("compute_badge_tier", { p_user_id: id })`, one call per person, fired together.
 * This file is that, made shared, so four lanes cannot drift into four subtly different versions
 * of it — and so the colour of a tier ring is identical whether you meet somebody in Homes or in
 * Socials.
 *
 * ── WHY IT IS A SEPARATE ROUND TRIP AND NOT PART OF THE PROFILE READ ────────────────────────
 * It cannot be part of it. There is no column to select. What this DOES avoid is the far worse
 * shape — a call per card per render — by keying on the deduplicated id list and letting
 * `useAsync` hold the answer until that list actually changes.
 *
 * ── FAILING IS ALLOWED, AND FAILS GREY ──────────────────────────────────────────────────────
 * An id with no answer is simply absent from the map, `ScoreDonut` falls back to `member`, and
 * the ring draws slate. A score with an honest grey ring is a fine thing to show; a blank space
 * where a member's score should be is not. Nothing here ever blocks a card from rendering.
 */
export type TierMap = Record<string, BadgeTier>;

/** Batched `compute_badge_tier` over a set of profile ids. Stable while the id set is stable. */
export function useTiers(ids: (string | null | undefined)[], enabled: boolean): TierMap {
  /* Deduplicated AND sorted, so that the same set of people arriving in a different order is the
     same cache key rather than a second round trip. */
  const key = useMemo(
    () => [...new Set(ids.filter(Boolean) as string[])].sort().join(","),
    [ids],
  );

  const map = useAsync(async () => {
    const list = key ? key.split(",") : [];
    if (!list.length) return {} as TierMap;
    const pairs = await Promise.all(list.map(async id => {
      try {
        const { data, error } = await supabase.rpc("compute_badge_tier", { p_user_id: id });
        return error || !data ? null : [id, data as BadgeTier] as const;
      } catch {
        return null;   // grey ring, never a missing card
      }
    }));
    return Object.fromEntries(pairs.filter(Boolean) as (readonly [string, BadgeTier])[]) as TierMap;
  }, [key], enabled && key.length > 0);

  return map ?? {};
}
