/**
 * Capability & tier system for OneSocial.
 *
 * Everyone is a Professional by default.
 * Capabilities (host events, agent mode) are unlocked via subscription.
 * Usage limits are enforced per month based on plan tier.
 *
 * VAIA tiers:
 *   Free  – basic profile completion guidance + upsell
 *   Pro   – positioning analytics, general guidance, safeguards
 *   VIP   – proactive monitoring, history, strategic planning, full analytics
 *   Scout addon – 8–12 high-converting, pre-engaged leads/mo ($199)
 *   Monster addon – 50–100 verified, high-converting leads/mo ($499)
 */

export interface Capabilities {
  host_events: boolean;
  post_jobs: boolean;
  agent: boolean;
  video_calls: boolean;
  scheduling: boolean;
}

export interface UsageLimits {
  job_posts: number;
  event_posts: number;
  job_applications: number;
}

export type PlanTier = "free" | "pro" | "vip";
export type AddonTier = "scout" | "monster" | null;

/** What VAIA can do per plan tier */
export type VaiaTier = "free" | "pro" | "vip";

export interface VaiaCapabilities {
  profileGuidance: boolean;
  upsellMessaging: boolean;
  positioningAnalytics: boolean;
  generalGuidance: boolean;
  safeguards: boolean;
  scoreCoaching: boolean;
  proactiveMonitoring: boolean;
  historyTracking: boolean;
  strategicPlanning: boolean;
  jobRecommendations: boolean;
  fullAnalytics: boolean;
  leadGeneration: boolean;
  unlimitedLeads: boolean;
  multiTierFunnels: boolean;
}

export const VAIA_CAPABILITIES: Record<VaiaTier, VaiaCapabilities> = {
  free: {
    profileGuidance: true,
    upsellMessaging: true,
    positioningAnalytics: false,
    generalGuidance: false,
    safeguards: false,
    scoreCoaching: false,
    proactiveMonitoring: false,
    historyTracking: false,
    strategicPlanning: false,
    jobRecommendations: false,
    fullAnalytics: false,
    leadGeneration: false,
    unlimitedLeads: false,
    multiTierFunnels: false,
  },
  pro: {
    profileGuidance: true,
    upsellMessaging: true,
    positioningAnalytics: true,
    generalGuidance: true,
    safeguards: true,
    scoreCoaching: true,
    proactiveMonitoring: false,
    historyTracking: false,
    strategicPlanning: false,
    jobRecommendations: false,
    fullAnalytics: false,
    leadGeneration: false,
    unlimitedLeads: false,
    multiTierFunnels: false,
  },
  vip: {
    profileGuidance: true,
    upsellMessaging: false,
    positioningAnalytics: true,
    generalGuidance: true,
    safeguards: true,
    scoreCoaching: true,
    proactiveMonitoring: true,
    historyTracking: true,
    strategicPlanning: true,
    jobRecommendations: true,
    fullAnalytics: true,
    leadGeneration: false,
    unlimitedLeads: false,
    multiTierFunnels: false,
  },
};

/** Check lead gen access based on addon */
export function hasLeadGenAccess(addon: AddonTier): boolean {
  return addon === "scout" || addon === "monster";
}

export function hasUnlimitedLeads(addon: AddonTier): boolean {
  return addon === "monster";
}

export function getVaiaCapabilities(plan: PlanTier, addon: AddonTier): VaiaCapabilities {
  const base = { ...VAIA_CAPABILITIES[plan] };
  if (addon === "scout") {
    base.leadGeneration = true;
  }
  if (addon === "monster") {
    base.leadGeneration = true;
    base.unlimitedLeads = true;
    base.multiTierFunnels = true;
  }
  return base;
}

export const PLAN_LIMITS: Record<PlanTier, UsageLimits> = {
  free:  { job_posts: 1, event_posts: 1, job_applications: 3 },
  pro:   { job_posts: 5, event_posts: 3, job_applications: 10 },
  vip:   { job_posts: 999, event_posts: 999, job_applications: 999 },
};

export const PROFILE_BIO_LIMITS: Record<PlanTier, number> = {
  free: 300,
  pro: 750,
  vip: 3000,
};

/** Per-user bio limit overrides (keyed by profile/user id). */
export const PROFILE_BIO_LIMIT_OVERRIDES: Record<string, number> = {
  // Mike J. Rosenfeld — VIP, extended limit
  "568cc613-3b48-4c59-a213-5b47a2d228eb": 4000,
};

export const DEFAULT_CAPABILITIES: Capabilities = {
  host_events: false,
  post_jobs: true,
  agent: false,
  video_calls: false,
  scheduling: false,
};

/** Which plan tier unlocks which capabilities */
export const CAPABILITY_REQUIREMENTS: Record<keyof Capabilities, PlanTier> = {
  host_events: "pro",
  post_jobs: "free",
  agent: "pro",
  video_calls: "vip",
  scheduling: "pro",
};

export function getPlanTier(plan: string | null | undefined): PlanTier {
  if (!plan) return "free";
  const lower = plan.toLowerCase();
  if (lower === "vip") return "vip";
  if (lower === "pro") return "pro";
  return "free";
}

export function getAddonTier(addon: string | null | undefined): AddonTier {
  if (!addon) return null;
  const lower = addon.toLowerCase();
  if (lower === "monster") return "monster";
  if (lower === "scout") return "scout";
  return null;
}

export function getLimitsForPlan(plan: string | null | undefined): UsageLimits {
  return PLAN_LIMITS[getPlanTier(plan)];
}

export function getProfileBioLimit(plan: string | null | undefined, userId?: string | null) {
  if (userId && PROFILE_BIO_LIMIT_OVERRIDES[userId]) {
    return PROFILE_BIO_LIMIT_OVERRIDES[userId];
  }
  return PROFILE_BIO_LIMITS[getPlanTier(plan)];
}

/** Check if a capability is unlocked for a given plan */
export function isCapabilityUnlocked(
  capability: keyof Capabilities,
  plan: PlanTier,
  capabilities: Capabilities
): boolean {
  if (capabilities[capability]) return true;
  if (capability === "post_jobs") return true;
  const required = CAPABILITY_REQUIREMENTS[capability];
  const tierOrder: PlanTier[] = ["free", "pro", "vip"];
  return tierOrder.indexOf(plan) >= tierOrder.indexOf(required);
}
