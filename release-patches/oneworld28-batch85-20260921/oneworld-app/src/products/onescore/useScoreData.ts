import { supabase, useOneId, useAsync } from "@oneworld/shell";
import {
  type ScoreInput, type AssetInput, type ContractTier, ASSET_CLASSES,
} from "./calculator";

/**
 * THE DATA LAYER — one place the DB becomes a ScoreInput.
 * ============================================================================================
 * The HEADLINE number is `profiles.score_v9_snapshot` and only that — the one published number
 * every sibling reads. The device-local `onescore-state-v2` store shipped 16.1 next to a
 * published 72.5 and is retired with the standalone app; nothing here touches device state.
 *
 * The evidence rows (verified assets, proven deals, endorsements) feed the CHANGE surfaces —
 * the ranked-actions list and the Simulator — through the fresh calculator. They do not, and
 * must not, become a second headline.
 */
export interface ScoreData {
  published: number | null;
  input: ScoreInput;
  loaded: boolean;
}

const KNOWN_TIERS = new Set(["major", "national", "regional", "local"]);

export function useScoreData(): ScoreData {
  const { userId } = useOneId();

  const published = useAsync(async () => {
    const { data } = await supabase.from("profiles")
      .select("score_v9_snapshot").eq("id", userId!).maybeSingle();
    return (data?.score_v9_snapshot ?? null) as number | null;
  }, [userId], !!userId);

  const assets = useAsync(async () => {
    const { data } = await supabase.from("verified_assets")
      .select("asset_class, proof_level, revoked_at")
      .eq("user_id", userId!).is("revoked_at", null);
    return (data ?? [])
      .filter(r => (ASSET_CLASSES as readonly string[]).includes(r.asset_class))
      .map(r => ({ class: r.asset_class, proof: r.proof_level } as AssetInput));
  }, [userId], !!userId);

  const contracts = useAsync(async () => {
    const { data } = await supabase.from("proven_deals")
      .select("counterparty_tier, reviewed_at").eq("user_id", userId!);
    return (data ?? [])
      .filter(r => r.reviewed_at && KNOWN_TIERS.has(r.counterparty_tier))
      .map(r => ({ tier: r.counterparty_tier as ContractTier }));
  }, [userId], !!userId);

  const endorsements = useAsync(async () => {
    const { data } = await supabase.from("endorsements")
      .select("endorser_score_at_time, retracted_at").eq("endorsee_id", userId!);
    return (data ?? []).map(r => ({
      endorserScore: Number(r.endorser_score_at_time ?? 0),
      retracted: !!r.retracted_at,
    }));
  }, [userId], !!userId);

  return {
    published: published ?? null,
    input: {
      assets: assets ?? [],
      contracts: contracts ?? [],
      endorsements: endorsements ?? [],
    },
    loaded: assets !== undefined,
  };
}
