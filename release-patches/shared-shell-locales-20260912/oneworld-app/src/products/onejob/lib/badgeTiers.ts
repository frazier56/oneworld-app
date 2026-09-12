/** Shim: badge tiers are profile-level and product-independent — shell owns them. */
export {
  BADGE_TIERS, calculateBadgeTier, getTierInfo,
  type BadgeTier, type BadgeTierInfo, type UserBadgeProgress,
} from "@oneworld/shell";
