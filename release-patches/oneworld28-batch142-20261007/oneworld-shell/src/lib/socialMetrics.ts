/**
 * SOCIAL METRICS — the four numbers at the top of a person's social media (SHELL).
 * ============================================================================================
 * Lee, 9 October 2026:
 *
 *   *"At the header we need to show cross-platform metrics. Total followers, total likes, total
 *   engagement… at least three KPIs, if not four. Followers — that encompasses subscribers.
 *   Likes. Total comments; a like is different from a comment. And engagement percent… your
 *   posts relative to your interactions, but interactions are relative to your likes and
 *   comments, and we weight those differently. Comments are weighted differently than likes.
 *   Then we divide that by your total posts and see what your real engagement is. And it's
 *   always going to be low, but some people are going to be higher than others."*
 *
 * ── WHY IT LIVES HERE AND NOT IN THE COMPONENT ─────────────────────────────────────────────
 * OneScore's External Social bucket scores audience, engagement, volume and verification on the
 * same four fields. Two places computing "engagement" two ways is how a member ends up looking
 * at one number on their profile and a different one behind their score. One function, one
 * answer, imported by both.
 *
 * ── THE NUMBERS COME FROM `social_snapshots`, WHICH ALREADY EXISTS ─────────────────────────
 * `followers`, `total_posts`, `total_likes`, `total_comments`, `total_shares`, `total_saves`,
 * one row per connection per capture. `ConnectedPlatforms` has been reading the first three
 * since August. **No migration, no new table, no new column** — this reads two more fields that
 * were already there and were never displayed. Same fault class as the year_built column that
 * existed, was selected, and was invisible because nothing was typed for it.
 */

export interface PlatformSnapshot {
  platform: string;
  username?: string | null;
  verified?: boolean;
  followers: number;
  posts: number;
  likes: number;
  comments: number;
}

export interface SocialTotals {
  followers: number;
  likes: number;
  comments: number;
  posts: number;
  /** Percent, one decimal. Null when it cannot honestly be computed. */
  engagement: number | null;
  /** The platforms that fed these totals, biggest audience first. */
  by: PlatformSnapshot[];
}

/**
 * ⚠️ A COMMENT IS WORTH MORE THAN A LIKE, AND THE WEIGHT IS NAMED, NOT BURIED.
 * A like costs a thumb. A comment costs a sentence, and it is the signal an advertiser, a
 * hirer and OneScore all actually care about. Three is the weight the industry uses and the
 * one OneScore's External Social bucket assumes; it lives here so changing it changes both.
 */
export const COMMENT_WEIGHT = 3;

/**
 * Engagement rate, the way every platform's own analytics defines it: the average interaction
 * a single post earns, as a percentage of the audience that could have seen it.
 *
 *     ((likes + 3 × comments) ÷ posts) ÷ followers × 100
 *
 * Dividing by posts is what stops somebody who posted four hundred times out-ranking somebody
 * who posted nine. Dividing by followers is what stops a big account out-ranking a small one
 * whose audience actually turns up — which is the entire point of the number.
 *
 * ⚠️ Returns NULL rather than zero when there are no posts or no followers. Zero is a real
 * measurement meaning "nobody engaged"; a blank is "we cannot tell yet". Printing 0.0 percent
 * beside a brand-new account is a lie about them, and on this product that is the one thing we
 * cannot afford to print.
 */
export function engagementRate(t: { likes: number; comments: number; posts: number; followers: number }): number | null {
  if (t.posts <= 0 || t.followers <= 0) return null;
  const perPost = (t.likes + COMMENT_WEIGHT * t.comments) / t.posts;
  return Math.round((perPost / t.followers) * 1000) / 10;
}

/**
 * Adds the platforms up and works out the one derived number.
 *
 * ⚠️ THE OVERALL RATE IS NOT THE RATE OF THE TOTALS, AND GETTING THAT WRONG PRINTS A NUMBER
 * LOWER THAN EVERY PART IT IS MADE OF. Pour four platforms into one pile and the followers add
 * up while the posts also add up, so the average post is divided by an audience four times the
 * size of the one that could actually have seen it. On the founder's own figures that produced
 * 0.7 percent as the "overall" beside four platforms reading 2.8, 3.6, 3.1 and 3.9 — every one
 * of them higher than the summary above them. A member reads that as the product being broken,
 * and they are right to.
 *
 * So the headline is each platform's own rate, averaged and weighted by the audience it
 * speaks to. A hundred-thousand-follower TikTok moves it more than a two-hundred-follower
 * Twitch, and the result always sits between the best and the worst, where a summary belongs.
 */
export function rollUp(rows: PlatformSnapshot[]): SocialTotals {
  const by = [...rows].sort((a, b) => b.followers - a.followers);
  const sum = (f: (r: PlatformSnapshot) => number) => by.reduce((n, r) => n + (f(r) || 0), 0);
  const t = {
    followers: sum(r => r.followers),
    likes: sum(r => r.likes),
    comments: sum(r => r.comments),
    posts: sum(r => r.posts),
  };

  let weighted = 0, audience = 0;
  for (const r of by) {
    const e = engagementRate(r);
    if (e == null) continue;          // a platform we cannot measure sits the average out
    weighted += e * r.followers;
    audience += r.followers;
  }
  const engagement = audience > 0 ? Math.round((weighted / audience) * 10) / 10 : null;

  return { ...t, engagement, by };
}

/** 12400 reads as 12.4K. Nobody wants to count digits on a phone. */
export function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

/**
 * ── THE PERCENTILE, AND WHY IT IS NOT IN THIS RELEASE ──────────────────────────────────────
 * Lee: *"now you can say you're in the top what percentile based on your location, based on
 * your industry… it's 9 percent, but that's still top 10 percent of their location and/or
 * their industry. If you're a beautician or a content creator or a barber or a driver, it makes
 * a difference."*
 *
 * He is right, and it is the half of this that cannot be computed on the phone. A percentile
 * needs everybody else's engagement, and a client that reads every profile to find out is both
 * slow and a privacy problem. It belongs in a database function beside OneScore's existing
 * `get_cohort_rank_filtered`, which already takes a location and an industry and already knows
 * how to rank one person against a cohort — this is the same shape with a different input.
 *
 * So this release ships the four numbers and leaves the rank to light up when that function
 * exists, the way Apple sign-in, Places autocomplete and the writing assist already do. No
 * greyed-out control, no "coming soon" label: the line is simply not drawn.
 */
export interface CohortRank {
  percentile: number;
  scope: "location" | "industry" | "both";
  label: string;
}

/** True once the ranking function is deployed. Until then the line is not drawn at all. */
export function hasCohortRank(): boolean {
  try {
    const e = (import.meta as unknown as { env?: Record<string, string> }).env;
    const v = e?.VITE_SOCIAL_COHORT_RANK;
    return typeof v === "string" && v !== "" && v !== "undefined" && v !== "0";
  } catch { return false; }
}
