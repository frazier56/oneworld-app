/**
 * MEDIA POSTS — the engagement and upload engine behind the profile's social-media section (SHELL).
 * ============================================================================================
 * Lee, 9 October 2026:
 *
 *   *"It was built in the original OneSocial app. Look in the OneSocial backup folder from June
 *   or July, find that code having to deal with uploading media… it wasn't just upload it, it
 *   worked out — there were a lot of kinks with video and all kinds of little things that we
 *   fixed. So look at that code, learn from it, and use it where we can instead of reinventing
 *   the wheel. We had likes, comments, share functionality."*
 *
 * He was right and I was wrong: on 9 October I reported that no upload had ever existed. What
 * had never existed was an uploader **in the shell**. The original app
 * (`onesocial-backup-2026-07-09.zip` → `src/lib/mediaPosts.ts`, `src/pages/AppProfile.tsx`,
 * `src/components/profile/{MediaUploadPreviewDialog,ProfileMediaPostDialog,MediaLightbox}.tsx`)
 * had a complete one, and it had already paid for a year of video bugs. This file is that work
 * ported — not rewritten — with four corrections the live database forces.
 *
 * ── WHAT THE ORIGINAL GOT RIGHT, AND IS PORTED VERBATIM IN SPIRIT ──────────────────────────
 *
 * A. ONE POST CAN HOLD MANY FILES. `media_posts` is the post; `media_post_items` is what is in
 *    it, ordered by `position`. The whole carousel is one row in the feed, one caption, one
 *    like count — which is how every other platform works and how the person already thinks.
 *
 *    ⚠️ AND IT IS LIVE DATA WE HAVE BEEN HIDING. Measured on the shared project 9 Oct 2026:
 *    548 rows in `media_post_items`, **15 posts with more than one item**. The shell's section
 *    has only ever read `media_posts`, so for those 15 posts every file after the first has
 *    been invisible in every app since the section shipped. Same fault class as the media wall
 *    reading `media_items` (a table that never existed) and `year_built` (a column that existed,
 *    was selected, and was never typed).
 *
 * B. A VIDEO WITH NO POSTER IS A BLACK SQUARE. `thumbnail_url` falls back to the item's own
 *    `media_url` for images and is left null for video, and the renderer then uses the file
 *    itself as its poster. Never an empty `src`, which paints a broken-image glyph.
 *
 * C. `isVideo` TESTS THE TYPE **AND** THE EXTENSION. Imported rows arrive with `media_type` of
 *    `PHOTO`, `image`, `VIDEO`, `video`, and some arrive with the type blank and only a `.mp4`
 *    to go on. One predicate, lower-cased, extension as the backstop.
 *
 * ── THE FOUR CORRECTIONS. EACH ONE IS A BUG IN THE ORIGINAL, FOUND IN THE LIVE SCHEMA ──────
 *
 * 1. ⚠️ THE COUNTS MAINTAIN THEMSELVES. `trg_media_likes_count`, `trg_media_comments_count` and
 *    `trg_media_shares_count` all fire `bump_media_post_count()`, a SECURITY DEFINER trigger
 *    that increments the column on insert and decrements on delete. The original counted the
 *    rows itself and then wrote the total back. Ported as-is that is a double count at best.
 *
 * 2. ⚠️ AND THE ORIGINAL'S SHARE COUNTER SETS IT TO ZERO. `media_shares` has exactly one SELECT
 *    policy — `is_platform_admin()`. For every member who is not an admin the follow-up
 *    `count` returns 0, and the original then writes `shares_count = 0` over the real figure the
 *    trigger had just incremented. **Sharing a post deletes its share count.** Nothing here
 *    ever reads `media_shares`, and nothing here ever writes a count column.
 *
 * 3. ⚠️ A VISITOR CANNOT WRITE TO SOMEBODY ELSE'S POST. `media_posts` UPDATE is
 *    `user_id = auth.uid()`. The original's like handler updates `media_posts.likes_count`,
 *    which silently affects no rows on anyone else's post — an UPDATE matching nothing is not an
 *    error. So liking a stranger's photo appeared to work and changed nothing. The trigger does
 *    it server-side with the owner's rights; the client re-reads the row.
 *
 * 4. ⚠️ A DOUBLE TAP USED TO MEAN TWO LIKES. The original reads `media_likes` then inserts.
 *    Two taps inside the round trip both see "not liked" and both insert.
 *    `media_likes_media_item_id_user_id_media_source_key` is a real unique constraint, so the
 *    second insert now comes back as a duplicate, and a duplicate is treated as "already
 *    liked" rather than as a failure. The database settles the race, not the thumb.
 *
 * ── `media_source` IS A POLYMORPHIC KEY, AND IT MUST ALWAYS BE 'media_post' HERE ────────────
 * `media_likes` / `media_comments` / `media_shares` are shared with other kinds of media, so
 * `media_item_id` alone does not identify a post. Every read and write in this file pins
 * `media_source`; forgetting it would mix a profile post's comments with an event photo's.
 */

import { supabase } from "./supabase";
import { uploadPhoto, uploadVideoResumable, videoPath } from "./mediaUpload";
import { thumbPath } from "./imageDerivatives";

export const MEDIA_SOURCE = "media_post";
/** The bucket every profile upload goes to. Public read, owner-only write. */
export const MEDIA_BUCKET = "media";

/* ──────────────────────────────────────────────────────────────────────────────────────────
   ⚠️ THE BUCKET HAS A MIME WHITELIST, AND `accept="image/*,video/*"` DOES NOT KNOW IT.
   Measured on the live bucket 9 Oct 2026: `media` allows exactly the nine types below and
   refuses everything else with a 400 from storage. A browser file picker set to `image/*` will
   happily hand over an .avif, an .svg or an .mkv, and the member then watches a silent failure
   with no idea which of their six files was the problem.

   So the list lives here, the picker is built FROM it, and a refused file is named back to the
   person. 300 MB is the bucket's own ceiling (314,572,800 bytes) — checking it here turns a
   failure three minutes into an upload into an answer before it starts.

   ⚠️ HEIC AND HEIF UPLOAD FINE AND THEN DO NOT DISPLAY. The bucket accepts them because an
   iPhone sends them, but no browser except Safari will paint one, so the tile is broken for
   most of the people looking at the profile. They are accepted (refusing an iPhone photo is
   worse) and flagged, so the caller can say so instead of the member finding out later.
   ────────────────────────────────────────────────────────────────────────────────────────── */
export const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm",
] as const;
export const ACCEPT_ATTR = ALLOWED_MIME.join(",");
export const MAX_BYTES = 300 * 1024 * 1024;
/**
 * Five minutes, the same ceiling `PublicVideoDeck` already enforces on listing video. A ten
 * minute clip is not a portfolio piece, it is a file nobody watches that costs everybody who
 * opens the profile — and the limit is checked before the upload rather than after.
 */
export const MAX_VIDEO_MS = 5 * 60 * 1000;
/** Stored happily, painted by almost nothing. */
const NEEDS_CONVERSION = new Set(["image/heic", "image/heif"]);

export interface MediaItem {
  id: string;
  post_id: string;
  media_url: string;
  media_type: string;
  thumbnail_url: string | null;
  position: number;
}

export interface MediaPost {
  id: string;
  user_id: string;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  source: string | null;
  source_post_url: string | null;
  created_at: string;
  items: MediaItem[];
}

export interface MediaComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author_name: string;
  author_photo_url: string | null;
}

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v|qt)(\?|#|$)/i;

/** Type first, extension as the backstop. Ported from the original, which needed both. */
export function isVideo(type?: string | null, url?: string | null): boolean {
  return /video/i.test(type || "") || VIDEO_EXT.test(url || "");
}

export function isText(type?: string | null): boolean {
  return (type || "").trim().toLowerCase() === "text";
}

/** What a grid tile paints. Never an empty string if there is anything at all to show. */
export function postThumbnail(p: Pick<MediaPost, "items" | "thumbnail_url" | "media_url">): string {
  const lead = p.items[0];
  return lead?.thumbnail_url || lead?.media_url || p.thumbnail_url || p.media_url || "";
}

export function postHasPicture(p: MediaPost): boolean {
  return !!postThumbnail(p);
}

/**
 * Attaches the items to the posts and fills the gap where a post has none.
 *
 * ⚠️ THE FALLBACK ITEM IS NOT TIDINESS, IT IS MOST OF THE LIBRARY. Of the posts on this project
 * the large majority have NO `media_post_items` row at all — every imported post, and every post
 * the shell itself has written, carries its single file on `media_posts.media_url` and nothing
 * else. A renderer that walks `items` and nothing else shows an empty grid for all of them.
 * So a post with no items is given one, synthesised from its own columns, and from that point
 * on the rest of the code has exactly one shape to deal with.
 */
function attachItems(posts: Record<string, unknown>[], items: MediaItem[]): MediaPost[] {
  const byPost = new Map<string, MediaItem[]>();
  for (const it of items) {
    const list = byPost.get(it.post_id) ?? [];
    list.push(it);
    byPost.set(it.post_id, list);
  }

  return posts.map(raw => {
    const p = raw as unknown as MediaPost;
    const own = (byPost.get(p.id) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(it => ({
        ...it,
        thumbnail_url: it.thumbnail_url ?? (isVideo(it.media_type, it.media_url) ? null : it.media_url),
      }));

    const synthetic: MediaItem[] = !own.length && p.media_url
      ? [{
          id: `${p.id}-only`,
          post_id: p.id,
          media_url: p.media_url,
          media_type: p.media_type,
          thumbnail_url: p.thumbnail_url ?? (isVideo(p.media_type, p.media_url) ? null : p.media_url),
          position: 0,
        }]
      : [];

    return {
      ...p,
      likes_count: p.likes_count ?? 0,
      comments_count: p.comments_count ?? 0,
      shares_count: p.shares_count ?? 0,
      items: own.length ? own : synthetic,
    };
  });
}

/** Columns named, never `select('*')` — column grants are on and the star throws 42501. */
const POST_COLS =
  "id, user_id, media_url, thumbnail_url, media_type, caption, likes_count, comments_count, shares_count, source, source_post_url, created_at";
const ITEM_COLS = "id, post_id, media_url, media_type, thumbnail_url, position";

export async function fetchPostsByUser(userId: string, limit = 500): Promise<MediaPost[]> {
  const { data: posts, error } = await supabase.from("media_posts")
    .select(POST_COLS)
    .eq("user_id", userId)
    .eq("moderation_status", "visible")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const ids = (posts ?? []).map(p => (p as { id: string }).id);
  if (!ids.length) return [];

  /* ⚠️ ONE QUERY FOR EVERY ITEM, NOT ONE PER POST. Five hundred posts means five hundred round
     trips if this is done inside the map, which on a phone is the difference between a profile
     that opens and a profile that hangs. Chunked because PostgREST puts the whole `in` list in
     the URL and a long one is refused by the proxy with a 414 that reads like a server fault. */
  const items: MediaItem[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error: itemErr } = await supabase.from("media_post_items")
      .select(ITEM_COLS).in("post_id", ids.slice(i, i + 150))
      .order("position", { ascending: true });
    /* Items are an enrichment. If they fail the posts still render on their own columns, which
       is what every pre-carousel post does anyway — never lose the library over the extras. */
    if (itemErr) { console.error("[mediaPosts] items read failed:", itemErr.message); break; }
    items.push(...((data ?? []) as MediaItem[]));
  }

  return attachItems((posts ?? []) as unknown as Record<string, unknown>[], items);
}

/* ── LIKES ─────────────────────────────────────────────────────────────────────────────────── */

/** Which of these posts the signed-in person has already liked. Empty when signed out. */
export async function fetchMyLikes(postIds: string[], userId: string | null): Promise<Set<string>> {
  if (!userId || !postIds.length) return new Set();
  const out = new Set<string>();
  for (let i = 0; i < postIds.length; i += 150) {
    const { data, error } = await supabase.from("media_likes")
      .select("media_item_id")
      .eq("media_source", MEDIA_SOURCE)
      .eq("user_id", userId)
      .in("media_item_id", postIds.slice(i, i + 150));
    /* SELECT on `media_likes` is granted to `authenticated` only, so a signed-out read is a
       refusal rather than an empty list. Nothing to show and nothing to shout about. */
    if (error) return out;
    for (const r of (data ?? []) as { media_item_id: string }[]) out.add(r.media_item_id);
  }
  return out;
}

/**
 * On or off, and the count the server now holds.
 *
 * ⚠️ A DUPLICATE IS A SUCCESS, NOT A FAILURE (correction 4). Code 23505 means the unique
 * constraint caught a second tap that raced the first — the like exists, which is what was
 * asked for. Reporting an error there would make a double tap look broken.
 */
export async function toggleLike(postId: string, userId: string): Promise<{ liked: boolean; count: number }> {
  const { data: mine } = await supabase.from("media_likes")
    .select("id").eq("media_item_id", postId).eq("media_source", MEDIA_SOURCE)
    .eq("user_id", userId).maybeSingle();

  let liked: boolean;
  if (mine?.id) {
    const { error } = await supabase.from("media_likes").delete().eq("id", mine.id);
    if (error) throw error;
    liked = false;
  } else {
    const { error } = await supabase.from("media_likes")
      .insert({ media_item_id: postId, media_source: MEDIA_SOURCE, user_id: userId });
    if (error && error.code !== "23505") throw error;
    liked = true;
  }

  return { liked, count: await readCount(postId, "likes_count") };
}

/**
 * The count after the trigger has run (corrections 1 and 3). Read back from the post, which is
 * publicly readable, rather than counted here and written back, which a visitor cannot do.
 */
async function readCount(postId: string, col: "likes_count" | "comments_count" | "shares_count"): Promise<number> {
  const { data } = await supabase.from("media_posts").select(col).eq("id", postId).maybeSingle();
  const n = (data as Record<string, number | null> | null)?.[col];
  return Number(n) || 0;
}

/* ── COMMENTS ──────────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ NO FOREIGN KEY FROM `media_comments` TO `profiles`, SO NO JOIN. The author's name and face
 * are a second query keyed on the ids that came back — exactly as the original did it, and for
 * the same reason: PostgREST can only embed across a declared relationship, and asking for one
 * that is not there fails the whole request rather than returning the comments without names.
 */
export async function fetchComments(postId: string): Promise<MediaComment[]> {
  const { data: rows, error } = await supabase.from("media_comments")
    .select("id, content, created_at, user_id")
    .eq("media_item_id", postId).eq("media_source", MEDIA_SOURCE)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const comments = (rows ?? []) as { id: string; content: string; created_at: string; user_id: string }[];
  if (!comments.length) return [];

  const ids = Array.from(new Set(comments.map(c => c.user_id).filter(Boolean)));
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name, photo_url").in("id", ids)
    : { data: [] as unknown[] };

  const who = new Map((((people ?? []) as { id: string; full_name: string | null; photo_url: string | null }[])
    .map(p => [p.id, p] as const)));

  return comments.map(c => {
    const p = who.get(c.user_id);
    return {
      ...c,
      author_name: p?.full_name?.trim() || "OneSocial member",
      author_photo_url: p?.photo_url || null,
    };
  });
}

/** Writes the comment; the trigger moves the count. Returns the fresh list and that count. */
export async function addComment(postId: string, userId: string, body: string):
  Promise<{ comments: MediaComment[]; count: number }> {
  const text = body.trim();
  if (!text) throw new Error("empty");
  /* 1,000 characters is a comment. Past that it is a blog post nobody will read on a phone, and
     an unbounded text column is a free denial-of-service against everyone who loads the post. */
  const { error } = await supabase.from("media_comments").insert({
    media_item_id: postId, media_source: MEDIA_SOURCE, user_id: userId, content: text.slice(0, 1000),
  });
  if (error) throw error;
  return { comments: await fetchComments(postId), count: await readCount(postId, "comments_count") };
}

export async function deleteComment(commentId: string, postId: string):
  Promise<{ comments: MediaComment[]; count: number }> {
  const { error } = await supabase.from("media_comments").delete().eq("id", commentId);
  if (error) throw error;
  return { comments: await fetchComments(postId), count: await readCount(postId, "comments_count") };
}

/* ── SHARES ────────────────────────────────────────────────────────────────────────────────── */

/**
 * Records the share and reads the count back off the post (correction 2 — never off
 * `media_shares`, which only an admin may read).
 *
 * The share itself is the platform's own sheet where there is one, and the clipboard where
 * there is not. `AbortError` is the person changing their mind, not a fault.
 */
export async function sharePost(
  post: Pick<MediaPost, "id" | "caption">, userId: string | null, url: string,
): Promise<{ count: number | null; method: string } | null> {
  let method = "clipboard";
  const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
  try {
    if (typeof nav.share === "function") {
      await nav.share({ title: "OneSocial", text: post.caption || undefined, url });
      method = "native_share";
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      return null;
    }
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return null;
    return null;
  }

  /* Signed out, the link is still copied and still useful — there is simply nobody to credit
     the share to. INSERT on `media_shares` is granted to `authenticated` only. */
  if (!userId) return { count: null, method };
  const { error } = await supabase.from("media_shares")
    .insert({ media_item_id: post.id, media_source: MEDIA_SOURCE, user_id: userId, share_method: method });
  if (error) return { count: null, method };
  return { count: await readCount(post.id, "shares_count"), method };
}

/* ── THE OWNER'S OWN POST ──────────────────────────────────────────────────────────────────── */

export async function updateCaption(postId: string, caption: string): Promise<void> {
  const { error } = await supabase.from("media_posts")
    .update({ caption: caption.trim().slice(0, 500) || null }).eq("id", postId);
  if (error) throw error;
}

/**
 * Deletes the post, its items (the foreign key cascades) and the files themselves.
 *
 * ⚠️ THE FILES ARE NOT PART OF THE CASCADE. The original deleted the row and left every
 * uploaded file in the bucket for ever — invisible, unreachable, and still counted against
 * storage. Deleting them is best effort and deliberately last: a storage refusal must not leave
 * the person looking at a post they just deleted. Only paths under their own folder are touched,
 * which is also all the storage policy would permit.
 */
export async function deletePost(post: MediaPost, userId: string): Promise<void> {
  const own = post.items
    .map(it => ({ path: storagePath(it.media_url, userId), video: isVideo(it.media_type, it.media_url) }))
    .filter((x): x is { path: string; video: boolean } => !!x.path);
  /* ⚠️ A PHOTOGRAPH IS TWO FILES. `uploadPhoto` writes the display image and its `-t` twin, so
     deleting only the one named in the row leaves the thumbnail behind for ever. Video has no
     twin. Remove refuses nothing for a path that is already gone. */
  const paths = own.flatMap(x => (x.video ? [x.path] : [x.path, thumbPath(x.path)]));

  const { error } = await supabase.from("media_posts").delete().eq("id", post.id);
  if (error) throw error;

  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    if (rmErr) console.error("[mediaPosts] file cleanup failed:", rmErr.message);
  }
}

/** `…/object/public/media/<uid>/<file>` → `<uid>/<file>`, and only when the uid is theirs. */
function storagePath(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const rest = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  return rest.startsWith(`${userId}/`) ? rest : null;
}

/* ── UPLOADING ─────────────────────────────────────────────────────────────────────────────── */

export interface Rejected { name: string; why: "type" | "size"; mb: number }

/** Split the picker's output before a byte is sent, so the member is told which file and why. */
export function screenFiles(files: File[]): { ok: File[]; rejected: Rejected[]; needConversion: string[] } {
  const ok: File[] = [];
  const rejected: Rejected[] = [];
  const needConversion: string[] = [];
  for (const f of files) {
    const type = (f.type || "").toLowerCase();
    const mb = Math.round(f.size / 1048576);
    if (!(ALLOWED_MIME as readonly string[]).includes(type)) { rejected.push({ name: f.name, why: "type", mb }); continue; }
    if (f.size > MAX_BYTES) { rejected.push({ name: f.name, why: "size", mb }); continue; }
    if (NEEDS_CONVERSION.has(type)) needConversion.push(f.name);
    ok.push(f);
  }
  return { ok, rejected, needConversion };
}

export interface UploadResult { postId: string; uploaded: number; failed: string[] }

/** How long a clip runs, without uploading it. Rejects rather than guesses on an unreadable file. */
export function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve((el.duration || 0) * 1000); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    el.src = url;
  });
}

/**
 * One post, many files, one caption — the original's `publishPendingUpload`, ported onto the
 * storage path this shell already had.
 *
 * ⚠️ IT DOES NOT TOUCH `supabase.storage.upload` ITSELF, AND THAT IS THE WHOLE POINT. The first
 * draft of this file did, and `lib/mediaUpload.ts` says exactly why that is wrong: *"Two ways to
 * reach storage would be two places for the thumbnail convention to drift."* Worse, a plain
 * `upload()` of a 300 MB clip is one request — a single dropped packet on a phone connection and
 * the whole thing starts from zero with nothing kept.
 *
 * So photographs go through `uploadPhoto`, which bounds and re-encodes them, writes the 512-pixel
 * `-t` twin beside the display image, and carries the blank-canvas guard from 12 August (a
 * listing photo that stored as a valid 2560×1920 WebP of 4.9 million transparent pixels). Video
 * goes through `uploadVideoResumable` — tus, 6 MB chunks, resumable, with the retry ladder — so a
 * long upload survives a lift, a tunnel and a dropped signal.
 *
 * ⚠️ AND THE FILES GO UP BEFORE THE POST ROW IS WRITTEN. The original did this and it is worth
 * keeping: a post whose files failed is a permanent broken tile on a public profile with no way
 * for the member to see what went wrong. If every file fails, nothing is written at all.
 *
 * `onProgress` exists because a 300 MB video over a phone connection is a minute of nothing
 * happening, and a minute of nothing happening is indistinguishable from a hung app.
 */
export async function publishPost(
  userId: string, files: File[], caption: string,
  onProgress?: (p: { done: number; total: number; name: string; pct: number | null }) => void,
): Promise<UploadResult> {
  const uploaded: { media_url: string; media_type: string; thumbnail_url: string | null; position: number }[] = [];
  const failed: string[] = [];

  /* ⚠️ THE RESUMABLE ENDPOINT NEEDS THE SESSION'S OWN BEARER TOKEN, not the anon key — the
     storage policy is `(storage.foldername(name))[1] = auth.uid()` and tus talks to storage
     directly, outside the supabase-js client that would have attached it. Fetched once. */
  let token: string | null = null;
  if (files.some(f => isVideo(f.type, f.name))) {
    const session = await supabase.auth.getSession();
    token = session.data.session?.access_token ?? null;
  }

  for (const [i, f] of files.entries()) {
    const video = isVideo(f.type, f.name);
    onProgress?.({ done: i, total: files.length, name: f.name, pct: video ? 0 : null });

    if (video) {
      if (!token) { failed.push(f.name); continue; }
      try {
        const url = await uploadVideoResumable(f, videoPath(userId, "social", f), token,
          sent => onProgress?.({
            done: i, total: files.length, name: f.name,
            pct: f.size > 0 ? Math.min(100, Math.round((sent / f.size) * 100)) : null,
          }));
        uploaded.push({
          media_url: url,
          media_type: "video",
          /* No poster until one is generated, and null is the honest value — the renderer then
             seeks the clip's own first frame, which beats a broken image. */
          thumbnail_url: null,
          position: uploaded.length,
        });
      } catch { failed.push(f.name); }
      continue;
    }

    const res = await uploadPhoto(f, userId, "social");
    if ("error" in res) { failed.push(f.name); continue; }
    uploaded.push({
      media_url: res.url,
      media_type: "image",
      /* ⚠️ THE DISPLAY URL, NOT THE `-t` URL. The thumbnail is a CONVENTION derived from the
         display path, not a stored value — `thumbFor()` at render time, falling back to the
         display image when the twin did not write or the post predates thumbnails. Storing the
         `-t` url would hard-code a file that is allowed to be missing. */
      thumbnail_url: res.url,
      position: uploaded.length,
    });
  }

  onProgress?.({ done: files.length, total: files.length, name: "", pct: null });
  if (!uploaded.length) return { postId: "", uploaded: 0, failed };

  const lead = uploaded[0];
  const { data: post, error } = await supabase.from("media_posts").insert({
    user_id: userId,
    media_type: lead.media_type,
    media_url: lead.media_url,
    thumbnail_url: lead.thumbnail_url,
    caption: caption.trim().slice(0, 500) || null,
    source: "upload",
    source_import_method: "member_upload",
    moderation_status: "visible",
  }).select("id").single();
  if (error || !post) throw error ?? new Error("post");

  const postId = (post as { id: string }).id;

  /* ⚠️ THE ITEM ROWS ARE WRITTEN EVEN FOR A SINGLE FILE. The original only wrote them for
     carousels, which is why most of the library has none and every reader needs a fallback. One
     shape from here on: the post always has its items. */
  const { error: itemErr } = await supabase.from("media_post_items").insert(
    uploaded.map(u => ({ post_id: postId, ...u })),
  );
  if (itemErr) console.error("[mediaPosts] item rows failed:", itemErr.message);

  return { postId, uploaded: uploaded.length, failed };
}
