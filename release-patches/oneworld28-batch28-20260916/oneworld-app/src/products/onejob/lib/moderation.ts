import { useQuery, useQueryClient } from "@job/lib/query";
import { supabase } from "./supabase";
import { useAuth } from "@job/hooks/useAuth";

/**
 * Report and block — the moderation tools every app with user-generated content must ship.
 *
 * Apple's App Review Guideline 1.2 requires apps with UGC to provide "a mechanism to report
 * offensive content and timely responses to concerns" AND "the ability to block abusive users."
 * OneJob has four UGC surfaces (the feed, DMs, reviews, public profiles) and shipped with neither,
 * which is an automatic rejection regardless of how good everything else is.
 *
 * The `content_reports` and `user_blocks` tables and their RLS policies already existed — nothing
 * in the app had ever read or written them. This is the missing half.
 */

/**
 * `comment` added Jul 31 2026 — the last surface where someone could publish text with no way for
 * anyone else to flag it. Apple 1.2 wants a report path on EVERY piece of user-generated content,
 * not just the top-level object, and a comment under someone's photo is exactly the place abuse
 * tends to land. `content_reports.target_type` is free text with no check constraint, so this
 * needed no migration.
 */
export type ReportTarget = "post" | "message" | "review" | "profile" | "job" | "contract" | "comment";

export const REPORT_REASONS = [
  { id: "spam", label: "Spam or scam" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hate speech or discrimination" },
  { id: "sexual", label: "Sexual or explicit content" },
  { id: "violence", label: "Violence or threats" },
  { id: "impersonation", label: "Impersonation or fake profile" },
  { id: "payment", label: "Payment or fraud problem" },
  { id: "other", label: "Something else" },
] as const;

export async function reportContent(input: {
  targetType: ReportTarget;
  targetId: string;
  targetUserId?: string | null;
  reason: string;
  detail?: string;
}): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) return { error: "Please sign in first." };

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: me,
    target_type: input.targetType,
    target_id: input.targetId,
    target_user_id: input.targetUserId ?? null,
    reason: input.reason,
    detail: input.detail?.trim() || null,
    status: "open",
  });
  if (error) {
    console.warn("[report] failed", error.message);
    return { error: "We couldn't file that report just now. Please try again." };
  }
  return {};
}

export async function blockUser(otherId: string): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) return { error: "Please sign in first." };
  if (me === otherId) return { error: "You can't block yourself." };

  const { error } = await supabase.from("user_blocks").insert({ blocker_id: me, blocked_id: otherId });
  // A duplicate just means they're already blocked — that's the desired end state, not an error.
  if (error && error.code !== "23505") {
    console.warn("[block] failed", error.message);
    return { error: "We couldn't block them just now. Please try again." };
  }
  return {};
}

export async function unblockUser(otherId: string): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) return { error: "Please sign in first." };
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", otherId);
  if (error) return { error: "We couldn't unblock them just now. Please try again." };
  return {};
}

/**
 * Everyone in a block relationship with me, in EITHER direction.
 *
 * Blocking has to be symmetric in effect: if I block someone I shouldn't see them, and if they
 * block me I shouldn't be able to reach them either. Returning both directions lets every surface
 * filter with one cheap `has()` check.
 */
export function useBlocks() {
  const { user } = useAuth();
  return useQuery<Set<string>>({
    queryKey: ["user-blocks", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${user!.id},blocked_id.eq.${user!.id}`);
      const set = new Set<string>();
      for (const b of (data ?? []) as Array<{ blocker_id: string; blocked_id: string }>) {
        set.add(b.blocker_id === user!.id ? b.blocked_id : b.blocker_id);
      }
      return set;
    },
  });
}

/** People I blocked (so Settings can offer Unblock) — my direction only. */
export function useMyBlocked() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-blocked", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user!.id);
      const ids = (data ?? []).map((b: { blocked_id: string }) => b.blocked_id);
      if (!ids.length) return [] as Array<{ id: string; full_name: string | null; photo_url: string | null }>;
      const { data: profs } = await supabase.from("profiles").select("id, full_name, photo_url").in("id", ids);
      return (profs ?? []) as Array<{ id: string; full_name: string | null; photo_url: string | null }>;
    },
  });
}

/** Invalidate both block queries after a block/unblock so every surface updates at once. */
export function useRefreshBlocks() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return () => {
    qc.invalidateQueries({ queryKey: ["user-blocks", user?.id] });
    qc.invalidateQueries({ queryKey: ["my-blocked", user?.id] });
  };
}
