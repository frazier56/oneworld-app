/**
 * THE SHARED PROFILE CONTRACT — one definition of what a One World profile IS.
 * ============================================================================================
 * Task 1.3.a. Every app reads and writes the SAME `profiles` row (One ID), so "what is a profile,
 * which fields are public, which the person may edit, and which are computed" must be answered in
 * ONE place — not re-decided per app, where it drifts and a private field leaks onto a public page.
 *
 * This file is that answer. It classifies every column of `public.profiles` (schema read 7 Aug
 * 2026) into exactly one VISIBILITY and one EDITABILITY. Two consumers depend on it:
 *
 *   1. The public profile route (`/p/:id`) and the OneScore/OneJob "view someone" surfaces — they
 *      may render ONLY `PUBLIC_FIELDS`, and only when the owner's `is_public` is true. This is the
 *      allow-list behind the 1.6.d fix (replace the RLS `SELECT true` with an approved surface):
 *      a public read exposes this set and nothing else, so adding a column to `profiles` can never
 *      silently make it public.
 *   2. The profile-edit / settings screens (1.3.c) — they may write ONLY `EDITABLE_FIELDS`.
 *      Everything else is computed by the system (scores, photo grade), owned by billing/auth, or
 *      set by admin/onboarding, and must never appear as an editable input.
 *
 * The test `shell.profile-contract.cjs` asserts EVERY live column is classified, so a new column
 * is a loud failure ("classify me") rather than a silent default to visible-or-editable.
 *
 * SENSITIVE FIELDS: `gender` is optional and PRIVATE by default — it is a personal attribute, not
 * a public credential, and nothing in the marketplace needs it on a public card. `email`/`phone`
 * are private (contact happens in-app). Precise `latitude`/`longitude` are private; only the
 * city-level `location` string is public.
 */

/** Publicly visible on a `is_public` profile. The allow-list — add here deliberately, never by default. */
export const PUBLIC_FIELDS = [
  "id",
  "full_name",
  "photo_url",
  "banner_url",
  "bio",
  "bio_es",
  "job_title",
  "industry",
  "category",
  "subcategory",
  "custom_expertise",
  "years_experience",
  "location",            // city-level text only — NOT latitude/longitude
  "score_v9_snapshot",   // the ONE published score (shown only when the owner opts in)
] as const;

/** Never leaves the server to a public reader. Contact, precise location, billing, identity. */
export const PRIVATE_FIELDS = [
  "email", "phone", "latitude", "longitude", "gender",
  "stripe_customer_id", "stripe_subscription_id",
  "plan", "plan_interval", "plan_current_period_end",
  "wise_handle", "wise_enabled",
  "one_id_notice_seen_at",
] as const;

/** The person may edit these on the profile-edit screen. Nothing else is a writable input. */
export const EDITABLE_FIELDS = [
  "full_name", "photo_url", "banner_url", "bio", "bio_es",
  "job_title", "industry", "category", "subcategory", "custom_expertise",
  "years_experience", "location", "gender",
] as const;

/** User-editable PREFERENCES / toggles (settings screen), distinct from profile content above. */
export const PREFERENCE_FIELDS = [
  "is_public", "suppress_from_talent", "onejob_discoverable",
  "read_receipts_enabled", "show_hosted_events", "show_attended_events",
  "show_testimonials", "show_rolodex_quick_link", "booking_display_mode",
  "vaia_guidance_level", "vaia_collapsed_by_default",
  "dashboard_layout", "sidebar_order",
  "nudge_opted_out",
] as const;

/** Computed by the system — display only, never an input. Scores, grades, timestamps. */
export const DERIVED_FIELDS = [
  "score_v9_snapshot", "score_v9_snapshot_at",
  "photo_quality_score", "photo_quality_graded_at", "photo_quality_url_hash",
  "ai_likelihood_score", "ai_penalty_applied",
  "created_at", "updated_at", "onboarding_completed_at",
  "terms_accepted_at", "terms_version", "age_confirmed_at",
  "capabilities",
] as const;

/** Set by admin / onboarding / attribution. Never user-editable, never public. */
export const SYSTEM_FIELDS = [
  "admin_locked", "admin_locked_at", "admin_locked_reason",
  "is_sample", "is_seed", "suspended_at", "suspended_reason",
  "from_waitlist", "waitlist_migrated_at",
  "kickstarter_candidate", "kickstarter_flagged_at",
  "referral_source", "referral_affiliate_id",
  "rolodex_referrer_token", "short_token",
  "signup_intent", "signup_app",
  "entry_product", "entry_campaign", "entry_at",
  "nudge_last_sent_at", "nudge_count",
] as const;

export type ProfileField =
  | (typeof PUBLIC_FIELDS)[number]
  | (typeof PRIVATE_FIELDS)[number]
  | (typeof EDITABLE_FIELDS)[number]
  | (typeof PREFERENCE_FIELDS)[number]
  | (typeof DERIVED_FIELDS)[number]
  | (typeof SYSTEM_FIELDS)[number];

const PUBLIC_SET = new Set<string>(PUBLIC_FIELDS);
const EDITABLE_SET = new Set<string>(EDITABLE_FIELDS);
const PREFERENCE_SET = new Set<string>(PREFERENCE_FIELDS);

/** May this column be shown to a public (possibly signed-out) reader of a public profile? */
export const isPublicField = (col: string): boolean => PUBLIC_SET.has(col);

/** May the owner write this column from the profile-edit screen? */
export const isEditableField = (col: string): boolean => EDITABLE_SET.has(col);

/** Is this a user-settable preference/toggle (settings screen)? */
export const isPreferenceField = (col: string): boolean => PREFERENCE_SET.has(col);

/** Reduce a full profile row to only the fields a public reader may see. */
export function toPublicProfile<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(row)) if (PUBLIC_SET.has(k)) (out as any)[k] = row[k];
  return out;
}

/** Keep only the writable profile-content fields from a form payload (drop anything else). */
export function pickEditable<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(payload)) if (EDITABLE_SET.has(k)) (out as any)[k] = payload[k];
  return out;
}

/** The complete set of live `profiles` columns (schema of record, 7 Aug 2026). The test checks
    every one is classified above — a new column must be placed deliberately, not defaulted. */
export const ALL_PROFILE_COLUMNS = [
  "id", "email", "full_name", "phone", "location", "photo_url", "bio", "job_title",
  "from_waitlist", "waitlist_migrated_at", "onboarding_completed_at", "created_at", "updated_at",
  "industry", "category", "subcategory", "custom_expertise", "capabilities", "dashboard_layout",
  "vaia_guidance_level", "vaia_collapsed_by_default", "banner_url", "years_experience",
  "latitude", "longitude", "is_sample", "gender", "read_receipts_enabled", "show_hosted_events",
  "show_attended_events", "sidebar_order", "referral_source", "referral_affiliate_id",
  "show_testimonials", "nudge_last_sent_at", "nudge_count", "nudge_opted_out",
  "kickstarter_candidate", "kickstarter_flagged_at", "is_public", "admin_locked", "admin_locked_at",
  "admin_locked_reason", "short_token", "bio_es", "score_v9_snapshot", "score_v9_snapshot_at",
  "photo_quality_score", "photo_quality_graded_at", "photo_quality_url_hash", "rolodex_referrer_token",
  "show_rolodex_quick_link", "ai_likelihood_score", "ai_penalty_applied", "suppress_from_talent",
  "wise_handle", "wise_enabled", "booking_display_mode", "plan", "plan_interval",
  "plan_current_period_end", "stripe_customer_id", "stripe_subscription_id", "onejob_discoverable",
  "suspended_at", "suspended_reason", "terms_accepted_at", "terms_version", "age_confirmed_at",
  "signup_intent", "is_seed", "signup_app", "one_id_notice_seen_at", "entry_product",
  "entry_campaign", "entry_at",
] as const;
