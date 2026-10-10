import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { W, useI18n } from "../lib/i18n";
import PlatformMark from "./PlatformMark";
import {
  addComment, deleteComment, deletePost, fetchComments, fetchMyLikes, isVideo, sharePost,
  toggleLike, updateCaption, type MediaComment, type MediaItem, type MediaPost,
} from "../lib/mediaPosts";

/**
 * FULL SCREEN — one photo or clip at a time, swipe left and right, like, comment, share (SHELL).
 * ============================================================================================
 * Ported from the original OneSocial app's `MediaLightbox` + `ProfileMediaPostDialog`
 * (July 2026 backup). Lee, 9 October 2026: *"there were a lot of little bugs in there that we
 * fixed. So look at that code and let's learn from it and use it where we can instead of
 * reinventing the wheel."*
 *
 * Eight things in here are scar tissue. Every one of them is a bug somebody already paid for.
 *
 * 1. ⚠️ AUTOPLAY FAILS WITH SOUND, SO IT RETRIES MUTED. Every browser refuses `play()` on a clip
 *    with audio that the person did not ask for, and the refusal is a rejected promise, not an
 *    error event — so the naive version shows a frozen first frame and no explanation. The
 *    original caught it, set `muted = true`, and played again. Only if THAT fails is something
 *    actually wrong with the file. This is the single most common video defect on a phone and
 *    it is invisible to anybody reading the code.
 *
 * 2. ⚠️ CHANGING ITEM NEEDS pause → currentTime 0 → load(), THEN a tick. Pointing `src` at a new
 *    file does not reset the element: Safari keeps the previous buffer and paints a black frame
 *    over the new clip. The original paused, rewound, called `load()`, and played after 50
 *    milliseconds — the delay is what lets the element settle before being asked to play again.
 *
 * 3. ⚠️ A VIDEO WITH `controls` EATS EVERY POINTER EVENT. Already learned once in this shell, in
 *    `FeedVideoPlayer`: *"You just can't swipe. You can click the arrow, it works."* The video is
 *    a real interactive control, so gestures landing on it never reach a parent. Hence the swipe
 *    lives on its own transparent layer ABOVE the media and BELOW the buttons.
 *
 *    AND IT COVERS THE TOP 62% ONLY, because the bottom is where the phone draws the scrubber,
 *    and stealing drags from the scrubber trades one broken gesture for another.
 *
 *    AND `touch-action: pan-y` is what stops the browser claiming the horizontal drag for its
 *    own scrolling before the handler ever runs.
 *
 *    ⚠️ THIS ALSO REPLACES THE SCROLL-SNAP STRIP I SHIPPED IN OVERLAY 7. A `<video controls>`
 *    inside a horizontal scroller fights the player for every drag — the same fault, arrived at
 *    from the other direction. One item is mounted at a time and the swipe is measured.
 *
 * 4. ⚠️ THE SWIPE MUST BE DOMINANTLY HORIZONTAL **AND** QUICK. More than 60 pixels across, more
 *    than one and a half times the vertical travel, inside 500 milliseconds — the original's
 *    numbers. Without the vertical test a scroll becomes a page turn; without the time limit a
 *    slow drag to reach the scrubber does too.
 *
 * 5. ⚠️ THE PAGE BEHIND MUST NOT SCROLL, and must be put back exactly as it was. Locking it is
 *    obvious; the original restored the PREVIOUS value rather than the empty string, which
 *    matters because the profile may itself be inside something that had already locked it.
 *
 * 6. ⚠️ PAUSE ON THE WAY OUT. Without the cleanup the audio keeps playing over the profile after
 *    the viewer closes, which on a phone sounds exactly like the app has been possessed.
 *
 * 7. ⚠️ A FAILED VIDEO GETS WORDS. `onError` is the only signal for a file that cannot be
 *    decoded, and the alternative to a sentence is a black rectangle the person taps for a while.
 *
 * 8. ⚠️ A STORED URL IS UNTRUSTED INPUT. `source_post_url` is parsed and must be https before it
 *    is drawn — `javascript:` in that column is a live link on a public profile otherwise.
 *
 * ── AND THE HALF LEE ASKED FOR THAT THE GRID NEVER HAD ─────────────────────────────────────
 * *"We had likes, comments, share functionality."* All three are here, on the item the person is
 * actually looking at. The counts are maintained by database triggers — see the warnings in
 * `lib/mediaPosts.ts` for why the original's own count-and-write was zeroing the share total.
 */

/** One frame of the viewer: which file, which post it belongs to, and where in that post. */
export interface Shot {
  post: MediaPost;
  item: MediaItem;
  /** 0-based position within its post, and how many that post holds. */
  index: number;
  count: number;
  /** The platform key already normalised by the caller. */
  plat: string;
  /**
   * ⚠️ CAME FROM ANOTHER PLATFORM — WHICH CHANGES WHAT THE NUMBERS MEAN. Found by rendering
   * this against the live project 9 Oct 2026: the comment sheet said *"Comments 14"* and then
   * *"No comments yet."* in the same breath.
   *
   * Both were telling the truth about different things. `media_posts.comments_count` on an
   * IMPORTED post is the count the post has **on TikTok**, written in by the importer; the
   * `media_comments` table holds what people said **here**. Measured: 344 posts carry a comment
   * count and the whole table holds one comment. Presenting the borrowed number above our own
   * empty thread is the single most visible lie this screen could tell, on a product whose
   * entire premise is that the numbers are real.
   *
   * So the two are separated. An imported post's platform figures are shown as what they are —
   * performance, over there, read only — and the like, comment and share controls carry only
   * what happened HERE. On the person's own post the two are the same thing and only one set is
   * drawn.
   *
   * The deeper fix is a column that keeps imported engagement apart from ours, which is a
   * migration and is flagged to PUB30 in the submission. Until then the client refuses to
   * present one as the other.
   */
  imported: boolean;
}

function safeHttps(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const parsed = new URL(String(u), window.location.origin);
    /* PUB30: also refuse user:pass@ links (TESTING P0-5, same rule as the DB constraint). */
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch { return null; }
}

const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const glass = "bg-white/20 text-white ring-1 ring-white/15 backdrop-blur-md";

export default function MediaPostViewer({
  shots, start, viewerId, canManage, onClose, onChanged, platformName,
}: {
  shots: Shot[];
  start: number;
  /** The signed-in person looking. Null when signed out — then nothing can be liked. */
  viewerId: string | null;
  /** Their own profile: caption and delete appear. */
  canManage: boolean;
  onClose: () => void;
  /** Something was liked, commented, captioned or deleted — the grid should re-read. */
  onChanged: () => void;
  platformName: (key: string) => string;
}) {
  const { lang } = useI18n();
  const [at, setAt] = useState(Math.max(0, Math.min(shots.length - 1, start)));
  const [fill, setFill] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoErr, setVideoErr] = useState<string | null>(null);

  const [liked, setLiked] = useState(false);
  const [likeN, setLikeN] = useState(0);
  const [busyLike, setBusyLike] = useState(false);

  const [sheet, setSheet] = useState(false);
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [loadingC, setLoadingC] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [commentN, setCommentN] = useState(0);
  const [shareN, setShareN] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [capDraft, setCapDraft] = useState("");
  const [savingCap, setSavingCap] = useState(false);

  const shot = shots[at] ?? shots[0];
  const post = shot?.post;
  const imported = !!shot?.imported;
  const video = !!shot && isVideo(shot.item.media_type, shot.item.media_url);

  const go = useCallback((d: number) => {
    setAt(i => Math.max(0, Math.min(shots.length - 1, i + d)));
  }, [shots.length]);

  /* Counts follow whichever post is on screen. They start from the row the grid already read,
     so the numbers are right on the first frame and only move when something happens. */
  useEffect(() => {
    if (!post) return;
    /* An imported post's stored counts belong to the other platform, so OUR controls start from
       nothing and fill in from our own tables. See `Shot.imported`. */
    setLikeN(imported ? 0 : post.likes_count);
    setCommentN(imported ? 0 : post.comments_count);
    setShareN(null);
    setEditing(false);
    setCapDraft(post.caption ?? "");
  }, [post?.id]);

  /* Whether THIS person has already liked it. One row, asked for only while signed in. */
  useEffect(() => {
    if (!post || !viewerId) { setLiked(false); return; }
    let dead = false;
    void fetchMyLikes([post.id], viewerId).then(mine => { if (!dead) setLiked(mine.has(post.id)); });
    return () => { dead = true; };
  }, [post?.id, viewerId]);

  /* Scar 1 and 2 — the muted retry, and the reset before it. */
  const startVideo = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    setVideoErr(null);
    try {
      await el.play();
    } catch {
      try {
        el.muted = true;
        await el.play();
      } catch {
        setVideoErr(W(lang, "This clip won't play. The file may not have finished uploading.",
                            "Este clip no se reproduce. El archivo puede no haberse subido completo."));
      }
    }
  }, [lang]);

  useEffect(() => {
    setVideoErr(null);
    const el = videoRef.current;
    if (!el || !video) return;
    el.pause();
    el.currentTime = 0;
    el.load();
    const t = window.setTimeout(() => { void startVideo(); }, 50);
    /* Scar 6 — silence on the way out, and on the way to the next item. */
    return () => { window.clearTimeout(t); el.pause(); };
  }, [at, shot?.item.media_url, video, startVideo]);

  /* Escape closes, arrows walk. A phone never sends these; a laptop always does. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (sheet) setSheet(false); else onClose(); return; }
      if (sheet) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, go, sheet]);

  /* Scar 5 — restore the previous value, not the empty string. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* Scars 3 and 4 — the gesture on its own layer, measured, with the vertical and time tests. */
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { touch.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
  const onUp = (e: React.PointerEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s.t < 500) {
      go(dx < 0 ? 1 : -1);
    }
  };

  const openComments = async () => {
    if (!post) return;
    setSheet(true); setLoadingC(true);
    try { setComments(await fetchComments(post.id)); }
    catch { setComments([]); }
    finally { setLoadingC(false); }
  };

  const like = async () => {
    if (!post || !viewerId || busyLike) return;
    setBusyLike(true);
    /* Optimistic, because a heart that waits for a round trip feels broken. Put back on failure
       rather than left wrong. */
    const was = liked, wasN = likeN;
    setLiked(!was); setLikeN(n => n + (was ? -1 : 1));
    try {
      const r = await toggleLike(post.id, viewerId);
      setLiked(r.liked); setLikeN(r.count);
      onChanged();
    } catch {
      setLiked(was); setLikeN(wasN);
    } finally { setBusyLike(false); }
  };

  const send = async () => {
    if (!post || !viewerId || !draft.trim() || sending) return;
    setSending(true);
    try {
      const r = await addComment(post.id, viewerId, draft);
      setComments(r.comments); setCommentN(r.count); setDraft("");
      onChanged();
    } catch { /* the draft is kept, so nothing the person typed is lost */ }
    finally { setSending(false); }
  };

  const removeComment = async (id: string) => {
    if (!post) return;
    try {
      const r = await deleteComment(id, post.id);
      setComments(r.comments); setCommentN(r.count);
      onChanged();
    } catch { /* ignore — the list is simply unchanged */ }
  };

  const share = async () => {
    if (!post) return;
    /* The link is to the profile this section is on, which is the page that actually exists. */
    const r = await sharePost(post, viewerId, window.location.href);
    if (!r) return;
    if (typeof r.count === "number") { setShareN(r.count); onChanged(); }
    setToast(r.method === "clipboard"
      ? W(lang, "Link copied", "Enlace copiado")
      : W(lang, "Shared", "Compartido"));
    window.setTimeout(() => setToast(null), 1800);
  };

  const saveCaption = async () => {
    if (!post || savingCap) return;
    setSavingCap(true);
    try { await updateCaption(post.id, capDraft); setEditing(false); onChanged(); }
    catch { /* stays open with what they typed */ }
    finally { setSavingCap(false); }
  };

  const remove = async () => {
    if (!post || !viewerId) return;
    if (!window.confirm(W(lang, "Delete this post? This cannot be undone.",
                                "¿Eliminar esta publicación? No se puede deshacer."))) return;
    try { await deletePost(post, viewerId); onChanged(); onClose(); }
    catch { /* ignore — the post is still there, which is the honest outcome */ }
  };

  if (!shot) return null;
  const original = safeHttps(post?.source_post_url);

  /* PUB30: portalled to <body> — inside the profile's glass card (backdrop-filter) a fixed overlay is laid out against the card and opens off-screen (fixed in batch 140 for the old viewer). */
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black" role="dialog" aria-modal="true"
      aria-label={W(lang, "Photo", "Foto")}>

      {/* The media. One at a time — scar 3. */}
      <div className="absolute inset-0 grid place-items-center overflow-hidden">
        {video ? (
          <video key={shot.item.id} ref={videoRef} src={shot.item.media_url}
            poster={shot.item.thumbnail_url ?? undefined}
            controls playsInline preload="auto"
            onCanPlay={() => { void startVideo(); }}
            onError={() => setVideoErr(W(lang, "This clip won't play. The file may not have finished uploading.",
                                                "Este clip no se reproduce. El archivo puede no haberse subido completo."))}
            className={fill ? "h-full w-full object-cover" : "max-h-full max-w-full"} />
        ) : (
          /* Same rule as the grid: a dead URL must not paint a paragraph over the screen. The
             caption is drawn properly below, and the dialog carries the label.

             ⚠️ AND A DEAD URL MUST NOT PAINT A BROKEN-IMAGE GLYPH EITHER. Seen in the
             screenshot: a torn-page icon in the top-left corner, sitting across the "1 / 29"
             counter. Imported platform URLs expire, so this is a state real members reach.
             Hiding the element leaves the viewer's own black, which says "nothing here" far
             better than a browser's error icon does. */
          <img key={shot.item.id} src={shot.item.media_url} alt="" decoding="async"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            className={fill ? "h-full w-full object-cover" : "max-h-full max-w-full object-contain"} />
        )}
      </div>

      {/* Scar 7 — words, not a black rectangle. */}
      {videoErr && (
        <p className="absolute left-1/2 top-1/2 w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-2xl
          bg-black/70 px-4 py-3 text-center text-[12.5px] font-semibold text-white ring-1 ring-white/15">
          {videoErr}
        </p>
      )}

      {/* Scars 3 and 4 — the gesture layer: above the media, below every button, top 62% only. */}
      <div onPointerDown={onDown} onPointerUp={onUp} aria-hidden
        className="absolute inset-x-0 top-0 h-[62%]" style={{ touchAction: "pan-y" }} />

      {/* Arrows, because a laptop has no swipe and a thumb is not always free. */}
      {at > 0 && (
        <button type="button" onClick={() => go(-1)} aria-label={W(lang, "Previous", "Anterior")}
          className={`ow-tap absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full ${glass}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
      )}
      {at < shots.length - 1 && (
        <button type="button" onClick={() => go(1)} aria-label={W(lang, "Next", "Siguiente")}
          className={`ow-tap absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full ${glass}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}

      <button type="button" onClick={onClose} aria-label={W(lang, "Close", "Cerrar")}
        className={`ow-tap absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full ${glass}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <p className="absolute left-3 top-4 text-[12px] font-bold tabular-nums text-white/80
        [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
        {at + 1} / {shots.length}
      </p>

      {/* ⚠️ A BLACK PILL ON A BLACK LETTERBOX IS NOT A BUTTON. In "whole photo" the ground behind
          these controls is the viewer's own black, so a dark pill disappears and the glyph floats
          on nothing. White glass reads on a photograph AND on black, which are the only two
          things ever behind them. */}
      <button type="button" onClick={() => setFill(f => !f)}
        className={`ow-tap absolute right-3 top-16 rounded-full px-3 py-1.5 text-[11.5px] font-bold ${glass}`}>
        {fill ? W(lang, "Whole photo", "Foto completa") : W(lang, "Fill the screen", "Llenar la pantalla")}
      </button>

      {/* Which file of this post, when the post holds more than one — the carousel made visible.
          Fifteen posts on this project have more than one file and every one after the first has
          been invisible in every app until now. */}
      {shot.count > 1 && (
        <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1">
          {Array.from({ length: shot.count }).map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all
              ${i === shot.index ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />
          ))}
        </div>
      )}

      {/* Caption, where it came from, and what you can do about it. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-5 pt-10">
        {editing ? (
          <div className="mb-2">
            <textarea value={capDraft} rows={3} autoFocus
              onChange={e => setCapDraft(e.target.value.slice(0, 500))}
              className="w-full resize-none rounded-xl bg-white/12 px-3 py-2 text-[13px] text-white
                ring-1 ring-white/20 outline-none placeholder:text-white/45"
              placeholder={W(lang, "Say something about this…", "Di algo sobre esto…")} />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10.5px] font-semibold tabular-nums text-white/50">{capDraft.length}/500</span>
              <button type="button" onClick={() => { setEditing(false); setCapDraft(post?.caption ?? ""); }}
                className="ow-tap ml-auto rounded-full px-3 py-1 text-[11.5px] font-bold text-white/70">
                {W(lang, "Cancel", "Cancelar")}
              </button>
              <button type="button" onClick={() => void saveCaption()} disabled={savingCap}
                className="ow-tap rounded-full bg-white px-3 py-1 text-[11.5px] font-bold text-ink disabled:opacity-50">
                {savingCap ? W(lang, "Saving…", "Guardando…") : W(lang, "Save", "Guardar")}
              </button>
            </div>
          </div>
        ) : post?.caption ? (
          <p className="mb-2 line-clamp-4 text-[13px] leading-snug text-white">{post.caption}</p>
        ) : null}

        <div className="flex items-center gap-2">
          {shot.plat !== "onesocial" && (
            /* PUB30: the viewer is always dark — black TikTok/X marks must read white in both themes. */
            <span className={`inline-flex ${["tiktok", "x", "twitter"].includes(shot.plat) ? "invert dark:invert-0" : ""}`}><PlatformMark name={shot.plat} size={15} onChip={false} /></span>)}
          <span className="shrink-0 text-[11.5px] font-bold text-white/70">
            {platformName(shot.plat)}
            {/* The other platform's figures, named as theirs. Read only — nothing here can
                change a number on TikTok. */}
            {imported && (post.likes_count > 0 || post.comments_count > 0) && (
              <span className="font-semibold opacity-80">
                {post.likes_count > 0 ? ` · ♥ ${short(post.likes_count)}` : ""}
                {post.comments_count > 0 ? ` · 💬 ${short(post.comments_count)}` : ""}
              </span>
            )}
          </span>
          {original && (
            <a href={original} target="_blank" rel="noopener noreferrer"
              className={`ow-tap ml-auto rounded-full px-3 py-1 text-[11.5px] font-bold ${glass}`}>
              {W(lang, "See the original", "Ver el original")}
            </a>
          )}
        </div>

        {/* LIKE · COMMENT · SHARE — the half Lee said we already had and I had not brought over. */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <button type="button" onClick={() => void like()} disabled={!viewerId || busyLike}
            aria-pressed={liked} aria-label={W(lang, "Like", "Me gusta")}
            className={`ow-tap flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold
              disabled:opacity-45 ${liked ? "bg-white text-ink" : glass}`}>
            <span aria-hidden>{liked ? "♥" : "♡"}</span>
            {(!imported || likeN > 0) && <span className="tabular-nums">{short(likeN)}</span>}
          </button>

          <button type="button" onClick={() => void openComments()}
            aria-label={W(lang, "Comments", "Comentarios")}
            className={`ow-tap flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${glass}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" />
            </svg>
            {(!imported || commentN > 0) && <span className="tabular-nums">{short(commentN)}</span>}
          </button>

          <button type="button" onClick={() => void share()} aria-label={W(lang, "Share", "Compartir")}
            className={`ow-tap flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${glass}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 16V3M8 7l4-4 4 4" />
            </svg>
            {shareN !== null && <span className="tabular-nums">{short(shareN)}</span>}
          </button>

          {canManage && (
            <>
              <button type="button" onClick={() => setEditing(e => !e)}
                aria-label={W(lang, "Edit caption", "Editar texto")}
                className={`ow-tap ml-auto grid h-8 w-8 place-items-center rounded-full ${glass}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </button>
              <button type="button" onClick={() => void remove()} aria-label={W(lang, "Delete", "Eliminar")}
                className="ow-tap grid h-8 w-8 place-items-center rounded-full bg-red-500/85 text-white ring-1 ring-white/20">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                </svg>
              </button>
            </>
          )}
        </div>

        {!viewerId && (
          <p className="mt-2 text-[11px] font-semibold text-white/55">
            {W(lang, "Sign in to like or comment.", "Inicia sesión para reaccionar o comentar.")}
          </p>
        )}
      </div>

      {toast && (
        <p className={`absolute bottom-28 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5
          text-[12px] font-bold ${glass}`}>{toast}</p>
      )}

      {/* COMMENTS, as a sheet over the picture rather than a second screen — the person keeps
          their place, which is the whole reason the original used a dialog beside the media. */}
      {sheet && (
        <div className="absolute inset-0 z-10 flex items-end" role="dialog" aria-modal="true"
          aria-label={W(lang, "Comments", "Comentarios")}>
          <button aria-label={W(lang, "Close", "Cerrar")} onClick={() => setSheet(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
          <div className="ow-sheet relative flex max-h-[72svh] w-full flex-col rounded-t-3xl">
            <div className="flex items-center gap-2 border-b border-ink/8 px-4 py-3 dark:border-white/10">
              <h4 className="flex-1 text-[14px] font-bold">
                {W(lang, "Comments", "Comentarios")}
                {/* ⚠️ THE NUMBER OF COMMENTS IN THIS LIST, not the post's stored count. Those are
                    two different things on an imported post and the header is where the
                    difference was visible as a contradiction. */}
                {!loadingC && (
                  <span className="ml-1.5 font-semibold opacity-50 tabular-nums">{comments.length}</span>
                )}
              </h4>
              <button type="button" onClick={() => setSheet(false)} aria-label={W(lang, "Close", "Cerrar")}
                className="ow-tap grid h-8 w-8 place-items-center rounded-full bg-ink/5 dark:bg-white/10">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                  strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {loadingC ? (
                <p className="py-6 text-center text-[12.5px] opacity-55">{W(lang, "Loading…", "Cargando…")}</p>
              ) : comments.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] opacity-55">
                  {W(lang, "No comments yet.", "Aún no hay comentarios.")}
                </p>
              ) : comments.map(c => (
                <div key={c.id} className="flex items-start gap-2.5">
                  {c.author_photo_url ? (
                    <img src={c.author_photo_url} alt="" loading="lazy"
                      className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-ink/8 dark:bg-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold">
                      {c.author_name}
                      <span className="ml-1.5 font-semibold opacity-45">
                        {new Date(c.created_at).toLocaleDateString(lang === "es" ? "es-US" : "en-US",
                          { month: "short", day: "numeric" })}
                      </span>
                    </p>
                    <p className="whitespace-pre-line text-[12.5px] leading-relaxed opacity-80">{c.content}</p>
                  </div>
                  {/* Your own comment, and the owner on their own post, can take one down. */}
                  {(c.user_id === viewerId || canManage) && (
                    <button type="button" onClick={() => void removeComment(c.id)}
                      aria-label={W(lang, "Delete comment", "Eliminar comentario")}
                      className="ow-tap shrink-0 rounded-full px-2 py-1 text-[11px] font-bold opacity-45">
                      {W(lang, "Remove", "Quitar")}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-ink/8 px-4 py-3 dark:border-white/10">
              {viewerId ? (
                <div className="flex items-end gap-2">
                  <textarea value={draft} rows={1}
                    onChange={e => setDraft(e.target.value.slice(0, 1000))}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    placeholder={W(lang, "Add a comment…", "Agrega un comentario…")}
                    className="ow-edge min-h-[38px] flex-1 resize-none rounded-xl border bg-transparent
                      px-3 py-2 text-[12.5px] outline-none focus:border-brand/50" />
                  <button type="button" onClick={() => void send()} disabled={sending || !draft.trim()}
                    className="ow-tap shrink-0 rounded-xl bg-brand px-3.5 py-2 text-[12.5px] font-bold text-white
                      disabled:opacity-40">
                    {sending ? W(lang, "…", "…") : W(lang, "Post", "Enviar")}
                  </button>
                </div>
              ) : (
                <p className="text-[12.5px] opacity-60">
                  {W(lang, "Sign in to comment.", "Inicia sesión para comentar.")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  , document.body);
}
