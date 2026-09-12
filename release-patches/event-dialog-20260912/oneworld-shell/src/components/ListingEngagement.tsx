import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { W } from "../lib/i18n";
import { useOneId } from "../lib/oneId";

/**
 * LIKE · COMMENT · SHARE — on the LISTING, as one object.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"Remember, you can like, share, comment on each of them still, and they can
 * write a comment, and people can like, share. They gonna share the ENTIRE set."*
 *
 * That last sentence settles the design question the rest of the sentence leaves open. A like per
 * photograph means a property with fifty photos has fifty like counts and not one of them is "how
 * many people liked this place" — which is the only number anybody wants. So the unit of
 * engagement is the LISTING. Somebody looking at photo 34 who taps the heart has liked the home.
 *
 * ── NO NEW TABLES ───────────────────────────────────────────────────────────────────────────
 * `media_likes`, `media_comments` and `media_shares` already carry a `media_source` discriminator
 * next to `media_item_id`, and neither column has a foreign key. So a listing is just another
 * source: `media_source = 'rental_property'` with the listing's own id. Verified against the live
 * policies — INSERT requires `user_id = auth.uid()` and nothing constrains the source value.
 *
 * That is worth more than the saved migration: likes, comments and shares now mean the same thing
 * and are counted the same way whether the subject is a post, an album item or a home. A separate
 * `listing_likes` table would have been a second implementation of a solved problem, and the first
 * feature that wants "everything this person liked" would have to union them.
 *
 * ⚠️ While confirming this, the admin policies on all three tables were found to still carry a
 * HARD-CODED UUID literal — one person, for ever, as the only possible moderator. Fixed to use
 * `is_platform_admin()` in `media_engagement_admin_policies_use_role_table`.
 */

export type EngagementSource = "rental_property" | "sale_property" | "media_post" | "album_item";

export default function ListingEngagement({
  itemId, source, shareUrl, shareTitle, allowShare = true, lang, compact = false, onDark = false,
  commentCount, onComments, hideComments,
}: {
  itemId: string;
  source: EngagementSource;
  /** Absolute, because this is what gets pasted into WhatsApp. */
  shareUrl: string;
  shareTitle: string;
  /** The owner's toggle. False hides the share control entirely — see the note below. */
  allowShare?: boolean;
  lang: string;
  compact?: boolean;
  /**
   * ── WHEN THE COMMENTS LIVE SOMEWHERE ELSE (13 Aug 2026) ─────────────────────────────────
   * Pass `onComments` and this button stops opening its own `media_comments` panel and simply
   * reports the tap. OneHome does that: its comments are a PROPERTY thread shown below the card
   * by `ListingComments`, and the two were previously separate tables that could never see each
   * other's messages. `commentCount` then comes from that thread so the number beside the icon
   * counts the conversation the reader can actually see.
   *
   * Products with no property thread pass neither and keep the built-in panel unchanged.
   */
  onComments?: () => void;
  commentCount?: number;
  /** v77 · Property surfaces set this. A person's post is a conversation and keeps its comments;
   *  a flat is not, and OneHome's comments were removed. Hidden here rather than deleted from the
   *  component, because OneSocial and OneJob still want the button. */
  hideComments?: boolean;
  /**
   * Rendered on top of a photograph rather than on the paper.
   *
   * The feed card is now the photograph — every fact sits on it against a scrim (Lee, 11 Aug 2026:
   * *"you shouldn't have a white strip at all"*). Inherited `currentColor` there is the app's ink,
   * which is invisible on a dark scrim, so this forces white and swaps the hover tint. It changes
   * colour only: the controls, counts and behaviour are identical.
   */
  onDark?: boolean;
}) {
  const { userId } = useOneId();
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState(0);
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const [{ count: nLikes }, { count: nComments }, mine] = await Promise.all([
        supabase.from("media_likes").select("id", { count: "exact", head: true })
          .eq("media_item_id", itemId).eq("media_source", source),
        /* SKIPPED when the comments live elsewhere. Counting `media_comments` for a listing whose
           conversation is a property thread queries a table the reader will never be shown, and
           the number it returns is a different number from the one the panel would display —
           which is the two-tables bug wearing a smaller hat. Caught by comments-check.mjs
           asserting that the feed card touches the property table and nothing else. */
        onComments
          ? Promise.resolve({ count: null } as any)
          : supabase.from("media_comments").select("id", { count: "exact", head: true })
              .eq("media_item_id", itemId).eq("media_source", source),
        userId
          ? supabase.from("media_likes").select("id")
              .eq("media_item_id", itemId).eq("media_source", source).eq("user_id", userId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (!live) return;
      setLikes(nLikes ?? 0); setComments(nComments ?? 0); setLiked(!!mine?.data);
    })();
    return () => { live = false; };
  }, [itemId, source, userId, onComments]);

  /* OPTIMISTIC, and reverted on failure. A heart that waits for a round trip before it fills reads
     as a broken button, and this is the single most-tapped control on the screen. */
  async function toggleLike() {
    if (!userId) return;
    const was = liked;
    setLiked(!was); setLikes(n => n + (was ? -1 : 1));
    const q = was
      ? supabase.from("media_likes").delete()
          .eq("media_item_id", itemId).eq("media_source", source).eq("user_id", userId)
      : supabase.from("media_likes").insert({ media_item_id: itemId, media_source: source, user_id: userId });
    const { error } = await q;
    if (error) { setLiked(was); setLikes(n => n + (was ? 1 : -1)); }
  }

  async function share() {
    /* Recorded whether or not the person completes the share sheet — the interesting number is how
       many people wanted to send this listing to somebody, and the OS never tells us the rest. */
    supabase.from("media_shares")
      .insert({ media_item_id: itemId, media_source: source, user_id: userId ?? null, share_method: "link" })
      .then(() => {});
    try {
      if (navigator.share) { await navigator.share({ title: shareTitle, url: shareUrl }); return; }
    } catch { /* the person dismissed the sheet — not an error */ }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShared(true); setTimeout(() => setShared(false), 2000);
    } catch { window.prompt(W(lang, "Copy this link", "Copie este enlace"), shareUrl); }
  }

  /* ── THE BUTTONS GOT BIGGER, 13 Aug 2026 ──────────────────────────────────────────────
     Lee, on the feed card: *"I would make those buttons probably a little bit bigger. I'm not
     gonna say probably — they need to be a little bit bigger. They almost get lost, but they are
     worth having. So I would probably double the size of those buttons so people can see that
     you can like, share and comment."*

     `compact` was doing two jobs and both were wrong on a photograph. The glyph goes 16 → 22 and
     the hit area goes from roughly 30px to a genuine 44, which is the accessibility floor these
     were under the whole time. Taken literally, "double" would be a 32px heart on a listing card
     and would outweigh the price; 22px against a 14.5px title is the ratio Instagram uses, and it
     is the size at which the row stops reading as a footnote. */
  const size = compact ? "text-[12.5px]" : "text-[13px]";
  const glyph = compact ? 22 : 20;
  const btn = `ow-tap flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 font-bold transition`;

  return (
    <div>
      <div className={`flex items-center gap-1 ${size} ${onDark ? "text-white" : ""}`}>
        <button type="button" onClick={toggleLike} disabled={!userId}
          aria-pressed={liked} aria-label={W(lang, "Like", "Me gusta")}
          className={`${btn} disabled:opacity-40 ${onDark ? "hover:bg-white/15" : "hover:bg-ink/5 dark:hover:bg-white/10"}`}>
          <svg width={glyph} height={glyph} viewBox="0 0 24 24" strokeWidth="2" aria-hidden
            fill={liked ? "currentColor" : "none"} stroke="currentColor"
            className={liked ? "text-red-500" : ""}>
            <path d="M20.8 6.6a5 5 0 0 0-7.1 0L12 8.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1z" />
          </svg>
          {likes > 0 && <span className="tabular-nums">{likes}</span>}
        </button>

        {/* v77 · U12 · The comment button is not drawn when the surface has no comments. */}
        {!hideComments && (
        <button type="button" onClick={() => (onComments ? onComments() : setOpen(o => !o))}
          aria-expanded={onComments ? undefined : open} aria-label={W(lang, "Comments", "Comentarios")}
          className={`${btn} ${onDark ? "hover:bg-white/15" : "hover:bg-ink/5 dark:hover:bg-white/10"}`}>
          <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
          </svg>
          {(commentCount ?? comments) > 0 && <span className="tabular-nums">{commentCount ?? comments}</span>}
        </button>
        )}

        {/* THE OWNER'S TOGGLE, honoured here. Lee: *"the user can enable through a toggle switch
            for the property to be shared by other people or not."* Hidden rather than disabled —
            a greyed share button advertises sharing and then refuses it, which reads as broken;
            no button reads as a listing that simply is not shareable. */}
        {allowShare && (
          <button type="button" onClick={share} aria-label={W(lang, "Share", "Compartir")}
            className={`${btn} ${onDark ? "hover:bg-white/15" : "hover:bg-ink/5 dark:hover:bg-white/10"}`}>
            <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M8 7l4-4 4 4" />
            </svg>
            {shared && <span className="text-[11.5px]">{W(lang, "Copied", "Copiado")}</span>}
          </button>
        )}
      </div>

      {open && !onComments && (
        <Comments itemId={itemId} source={source} lang={lang}
          onCount={setComments} userId={userId ?? null} />
      )}
    </div>
  );
}

/* ── COMMENTS ─────────────────────────────────────────────────────────────────────────────── */

function Comments({
  itemId, source, lang, onCount, userId,
}: {
  itemId: string; source: EngagementSource; lang: string;
  onCount: (n: number) => void; userId: string | null;
}) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    /* Two queries, not a join: `media_comments.user_id` has no foreign key to `profiles`, so
       PostgREST cannot embed the author. Named columns only — `select('*')` on profiles throws
       42501 under the column-level grants. */
    const { data } = await supabase.from("media_comments")
      .select("id, user_id, content, created_at")
      .eq("media_item_id", itemId).eq("media_source", source)
      .order("created_at", { ascending: true }).limit(200);
    const ids = Array.from(new Set((data ?? []).map(c => c.user_id)));
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, full_name, photo_url").in("id", ids)
      : { data: [] as any[] };
    const by = new Map((people ?? []).map((p: any) => [p.id, p]));
    const merged = (data ?? []).map(c => ({ ...c, who: by.get(c.user_id) }));
    setRows(merged);
    onCount(merged.length);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [itemId, source]);

  async function post() {
    const text = body.trim();
    if (!text || !userId) return;
    setBusy(true);
    const { error } = await supabase.from("media_comments")
      .insert({ media_item_id: itemId, media_source: source, user_id: userId, content: text.slice(0, 1000) });
    setBusy(false);
    if (!error) { setBody(""); load(); }
  }

  return (
    <div className="mt-2 border-t border-ink/[0.07] pt-2 dark:border-white/10">
      {rows === null && <div className="ow-shimmer h-12 rounded-xl" />}
      {rows?.length === 0 && (
        <p className="py-1 text-[12.5px] opacity-50">
          {W(lang, "No comments yet.", "Aún no hay comentarios.")}
        </p>
      )}
      {rows?.map(c => (
        <div key={c.id} className="flex gap-2 py-1.5">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/15 text-[11px] font-bold text-brand">
            {c.who?.photo_url
              ? <img src={c.who.photo_url} alt="" className="h-full w-full object-cover" />
              : (c.who?.full_name ?? "?").charAt(0)}
          </span>
          <p className="min-w-0 text-[13px] leading-snug">
            <span className="font-bold">{c.who?.full_name ?? W(lang, "Member", "Miembro")}</span>{" "}
            <span className="opacity-85">{c.content}</span>
          </p>
        </div>
      ))}

      {userId && (
        <div className="mt-1.5 flex gap-2">
          <input className="input w-full" value={body} maxLength={1000}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") post(); }}
            placeholder={W(lang, "Add a comment…", "Agregue un comentario…")} />
          <button type="button" onClick={post} disabled={busy || !body.trim()}
            className="btn-ghost shrink-0 px-4 disabled:opacity-40">
            {W(lang, "Post", "Enviar")}
          </button>
        </div>
      )}
    </div>
  );
}
