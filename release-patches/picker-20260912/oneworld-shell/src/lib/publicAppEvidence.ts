import { supabase } from "./supabase";
import { launcherKey, type AppKey } from "./oneWorld";

export type PublicAppEvidence = {
  onescore: { score: number | null };
  onejob: { completed: number; hosted: number; reviews: number };
  oneevent: { hosted: number };
  onesocial: { platforms: number; media: number };
  oneagent: { active: boolean };
  onehome: { listings: number };
  onepay: { active: boolean };
  onebusiness: { active: boolean };
};

const count = (value: number | null | undefined) => value ?? 0;

export async function fetchPublicAppEvidence(userId: string): Promise<PublicAppEvidence> {
  const [
    profile,
    jobTalent,
    jobHost,
    jobReviews,
    events,
    platforms,
    media,
    rentals,
    sales,
  ] = await Promise.all([
    supabase.from("profiles")
      .select("score_v9_snapshot")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("job_executions")
      .select("id", { count: "exact", head: true })
      .eq("talent_id", userId)
      .eq("status", "completed"),
    supabase.from("job_executions")
      .select("id", { count: "exact", head: true })
      .eq("host_id", userId)
      .eq("status", "completed"),
    supabase.from("job_reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewee_id", userId),
    supabase.from("events")
      .select("id", { count: "exact", head: true })
      .eq("host_id", userId)
      .eq("status", "published"),
    supabase.from("social_connections_public")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase.from("media_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("moderation_status", "visible"),
    supabase.from("rental_properties")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", userId)
      .eq("is_public", true)
      .eq("status", "published"),
    supabase.from("sale_properties")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", userId)
      .eq("is_public", true)
      .in("status", ["published", "under_offer"]),
  ]);

  return {
    onescore: { score: (profile.data as { score_v9_snapshot?: number | null } | null)?.score_v9_snapshot ?? null },
    onejob: {
      completed: count(jobTalent.count),
      hosted: count(jobHost.count),
      reviews: count(jobReviews.count),
    },
    oneevent: { hosted: count(events.count) },
    onesocial: {
      platforms: count(platforms.count),
      media: count(media.count),
    },
    oneagent: { active: false },
    onehome: { listings: count(rentals.count) + count(sales.count) },
    /* Merchant and business records are private to their members — nothing public to count. */
    onepay: { active: false },
    onebusiness: { active: false },
  };
}

export function appHasPublicEvidence(app: AppKey, evidence: PublicAppEvidence | null | undefined): boolean {
  if (!evidence) return false;
  switch (launcherKey(app)) {
    case "onescore":
      return evidence.onescore.score != null;
    case "onejob":
      return evidence.onejob.completed + evidence.onejob.hosted + evidence.onejob.reviews > 0;
    case "oneevent":
      return evidence.oneevent.hosted > 0;
    case "onesocial":
      return evidence.onesocial.platforms + evidence.onesocial.media > 0;
    case "oneagent":
      return evidence.oneagent.active;
    case "onehome":
      return evidence.onehome.listings > 0;
    default:
      return false;
  }
}
