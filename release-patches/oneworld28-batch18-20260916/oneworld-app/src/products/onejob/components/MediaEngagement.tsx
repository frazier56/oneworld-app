import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@job/lib/query";
import { supabase } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import { useI18n } from "@job/lib/i18n";
import Avatar from "./Avatar";
import ReportBlockSheet from "./ReportBlockSheet";

/**
 * Like · comment · share for a media post.
 *
 * Lee has asked for this repeatedly: you could upload a photo or video and write a caption, but
 * once it was posted there was nothing under it — no likes, no comments, no share. The thing you
 * put up was a dead end for everyone who saw it.
 *
 * NONE of this needed new database work. `media_likes`, `media_comments` and `media_shares` have
 * existed on wseblr the whole time, with correct row-level security (you may only insert a row
 * as yourself, and only delete your own), and an AFTER trigger — `bump_media_post_count` — that
 * keeps `likes_count` / `comments_count` / `shares_count` on `media_posts` in step. So this
 * component inserts and deletes, and lets the database do the counting. It never writes a count
 * itself, which is what stops two tabs from disagreeing.
 *
 * `media_source` is the string `'media_post'` — the convention already present in the one row
 * that existed. It matters: the same tables serve other media sources, and the trigger keys off
 * `media_item_id` alone, so a wrong source silently attaches engagement to the wrong thing.
 *
 * The like is optimistic. A heart that waits for a round trip before filling feels broken even
 * when it's working, and if the write fails we roll it straight back.
 */

type Props = {
  postId: string;
  /** Where a share should point. Falls back to the current URL. */
  shareUrl?: string;
  /** Rendered on a dark photo backdrop rather than on a pane. */
  onDark?: boolean;
};

const HEART_OUTLINE =
  "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z";

export default function MediaEngagement({ postId, shareUrl, onDark }: Props) {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [openComments, setOpenComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [shared, setShared] = useState(false);

  /** Counts come from the post row, which the trigger maintains. */
  const { data: counts } = useQuery({
    queryKey: ["media-counts", postId],
    queryFn: async () => {
      const { data } = await supabase.from("media_posts")
        .select("likes_count, comments_count, shares_count").eq("id", postId).maybeSingle();
      return data ?? { likes_count: 0, comments_count: 0, shares_count: 0 };
    },
  });

  /** "Have I liked this?" needs a session — a signed-out viewer sees the count, not the state. */
  const { data: liked } = useQuery({
    queryKey: ["media-liked", postId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("media_likes").select("id")
        .eq("media_item_id", postId).eq("media_source", "media_post").eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const toggleLike = useMutation({
    mutationFn: async (next: boolean) => {
      if (!user) throw new Error("sign-in-required");
      if (next) {
        const { error } = await supabase.from("media_likes")
          .insert({ media_item_id: postId, media_source: "media_post", user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("media_likes").delete()
          .eq("media_item_id", postId).eq("media_source", "media_post").eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onMutate: async (next: boolean) => {
      await qc.cancelQueries({ queryKey: ["media-liked", postId, user?.id] });
      const prevLiked = qc.getQueryData(["media-liked", postId, user?.id]);
      const prevCounts: any = qc.getQueryData(["media-counts", postId]);
      qc.setQueryData(["media-liked", postId, user?.id], next);
      if (prevCounts) {
        qc.setQueryData(["media-counts", postId], {
          ...prevCounts,
          likes_count: Math.max(0, (prevCounts.likes_count ?? 0) + (next ? 1 : -1)),
        });
      }
      return { prevLiked, prevCounts };
    },
    onError: (_e, _v, ctx) => {
      // Put it back exactly as it was — a heart that stays filled after a failed write is a lie.
      qc.setQueryData(["media-liked", postId, user?.id], ctx?.prevLiked);
      if (ctx?.prevCounts) qc.setQueryData(["media-counts", postId], ctx.prevCounts);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["media-counts", postId] });
      qc.invalidateQueries({ queryKey: ["media-liked", postId, user?.id] });
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["media-comments", postId],
    enabled: openComments,
    queryFn: async () => {
      const { data: rows } = await supabase.from("media_comments")
        .select("id, user_id, content, created_at")
        .eq("media_item_id", postId).eq("media_source", "media_post")
        .order("created_at", { ascending: true }).limit(200);
      const ids = [...new Set((rows ?? []).map(r => r.user_id))];
      // Comments carry a user_id, not a name — one extra read rather than a join, because the
      // profiles table is read through its own policy.
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id, full_name, photo_url").in("id", ids)
        : { data: [] as any[] };
      const byId = new Map((people ?? []).map(p => [p.id, p]));
      return (rows ?? []).map(r => ({ ...r, author: byId.get(r.user_id) ?? null }));
    },
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("sign-in-required");
      const { error } = await supabase.from("media_comments")
        .insert({ media_item_id: postId, media_source: "media_post", user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["media-comments", postId] });
      qc.invalidateQueries({ queryKey: ["media-counts", postId] });
    },
  });

  /**
   * Delete your own comment.
   *
   * RLS already allows exactly this ("Users can delete own comments" — `user_id = auth.uid()`), so
   * no server work was needed; the affordance simply didn't exist. Being able to take back
   * something you wrote is the other half of Apple 1.2 — reporting handles other people's content,
   * this handles your own.
   *
   * The comment count on media_posts is maintained by the AFTER trigger on media_comments, so the
   * count corrects itself; we just re-read it.
   */
  const delComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("media_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-comments", postId] });
      qc.invalidateQueries({ queryKey: ["media-counts", postId] });
    },
  });

  const share = async () => {
    const url = shareUrl || window.location.href;
    let method = "link";
    try {
      if (navigator.share) { await navigator.share({ url }); method = "native"; }
      else { await navigator.clipboard.writeText(url); }
    } catch {
      // A cancelled share sheet throws. That is not a failure, and it must not be counted.
      return;
    }
    setShared(true);
    setTimeout(() => setShared(false), 1800);
    await supabase.from("media_shares")
      .insert({ media_item_id: postId, media_source: "media_post", user_id: user?.id ?? null, share_method: method });
    qc.invalidateQueries({ queryKey: ["media-counts", postId] });
  };

  const tone = onDark ? "text-white" : "text-ink dark:text-paper";
  const quiet = onDark ? "text-white/70" : "opacity-60";
  /** The comment currently being reported, or null. */
  const [reportComment, setReportComment] = useState<{ id: string; userId: string; name: string | null } | null>(null);
  const btn = `flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold transition active:scale-95 ${
    onDark ? "hover:bg-white/10" : "hover:bg-brand/10"}`;

  return (
    <>
      <div className={`flex items-center gap-1 ${tone}`} onClick={e => e.stopPropagation()}>
        {/* LIKE — teal when it's true of you, because that's what teal means everywhere else */}
        <button className={btn} onClick={() => toggleLike.mutate(!liked)}
          aria-pressed={!!liked} aria-label={liked ? "Unlike" : "Like"} disabled={!user}>
          <svg width="20" height="20" viewBox="0 0 24 24"
               fill={liked ? "#15C2B2" : "none"} stroke={liked ? "#15C2B2" : "currentColor"}
               strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d={HEART_OUTLINE} />
          </svg>
          <span>{counts?.likes_count ?? 0}</span>
        </button>

        <button className={btn} onClick={() => setOpenComments(true)} aria-label="Comments">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-4.2a8.38 8.38 0 0 1-1-4.3 8.5 8.5 0 1 1 17 0z" />
          </svg>
          <span>{counts?.comments_count ?? 0}</span>
        </button>

        <button className={btn} onClick={share} aria-label="Share">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" />
          </svg>
          <span>{shared ? "✓" : (counts?.shares_count ?? 0)}</span>
        </button>
      </div>

      {/* ── Comments ─────────────────────────────────────────────────────────────────────────
          A sheet rather than a route: you are looking at a photo, and reading what people said
          about it should not take you away from the photo. */}
      {openComments && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center" onClick={e => { e.stopPropagation(); setOpenComments(false); }}>
          <div className="absolute inset-0" style={{ background: "rgba(11,15,26,.5)", backdropFilter: "blur(3px)" }} />
          <div className="oj-glass-modal relative flex max-h-[78vh] w-full max-w-lg flex-col rounded-b-none pb-[env(safe-area-inset-bottom)]"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4">
              <p className="text-[15px] font-extrabold">
                {counts?.comments_count ?? 0} {(counts?.comments_count ?? 0) === 1 ? "comment" : "comments"}
              </p>
              <button onClick={() => setOpenComments(false)}
                className="grid h-8 w-8 place-items-center rounded-full border border-brand/25 text-lg" aria-label="Close">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {!comments?.length && (
                <p className="py-8 text-center text-[13px] opacity-55">
                  No comments yet. Be the first to say something.
                </p>
              )}
              {/* Each comment carries its own action, and WHICH action depends on whose it is.
                  Your own comment offers Delete; someone else's offers Report. Never both, because
                  the pair invites the wrong tap on the one control people reach for in a hurry —
                  and "report" on your own words is meaningless.

                  Apple 1.2 requires a report path on every piece of user-generated content. The
                  post had one; the comments under it did not, which is precisely where abuse lands.
                  (Jul 31 2026) */}
              {comments?.map(c => {
                const mine = !!user && c.user_id === user.id;
                return (
                  <div key={c.id} className="group flex gap-2.5 py-2.5">
                    <Avatar src={c.author?.photo_url} name={c.author?.full_name} size={32} rounded="rounded-full" textSize="text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold leading-tight">{c.author?.full_name ?? "Someone"}</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug">{c.content}</p>
                    </div>
                    {user && (
                      mine ? (
                        <button
                          onClick={() => delComment.mutate(c.id)}
                          disabled={delComment.isPending}
                          aria-label="Delete your comment"
                          className={`h-7 shrink-0 self-start rounded-full px-2 text-[11px] font-bold transition disabled:opacity-40 ${quiet} hover:text-red-500`}>
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => setReportComment({ id: c.id, userId: c.user_id, name: c.author?.full_name ?? null })}
                          aria-label="Report this comment"
                          className={`h-7 shrink-0 self-start rounded-full px-2 text-[11px] font-bold transition ${quiet} hover:text-red-500`}>
                          Report
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {user ? (
              <form className="flex items-center gap-2 border-t border-brand/12 px-5 py-3"
                onSubmit={e => { e.preventDefault(); const v = draft.trim(); if (v) addComment.mutate(v); }}>
                <Avatar src={profile?.photo_url} name={profile?.full_name} size={30} rounded="rounded-full" textSize="text-xs" />
                <input className="input !py-2.5 flex-1" value={draft} maxLength={500}
                  onChange={e => setDraft(e.target.value)} placeholder="Add a comment…" />
                <button type="submit" disabled={!draft.trim() || addComment.isPending}
                  className="btn-primary !px-4 !py-2.5 !text-[13px]">
                  {addComment.isPending ? "…" : "Post"}
                </button>
              </form>
            ) : (
              <p className={`border-t border-brand/12 px-5 py-4 text-center text-[13px] ${quiet}`}>
                Sign in to join the conversation.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Reporting a comment also offers to block its author — Apple 1.2 wants both, and blocking
          is the half that changes something the reporter can immediately see. */}
      <ReportBlockSheet
        open={!!reportComment}
        onClose={() => setReportComment(null)}
        targetType="comment"
        targetId={reportComment?.id ?? ""}
        targetUserId={reportComment?.userId}
        targetName={reportComment?.name}
        onBlocked={() => {
          setReportComment(null);
          qc.invalidateQueries({ queryKey: ["media-comments", postId] });
        }}
      />
    </>
  );
}
