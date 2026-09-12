import { supabase } from "@job/lib/supabase";

export const MAX_ITEMS_PER_POST = 20;

/**
 * Is this row a video?
 *
 * `media_posts.media_type` is NOT normalised — production holds "video" AND "VIDEO", "image" AND
 * "PHOTO", depending on which importer wrote the row (native uploads and the Instagram scraper
 * disagree). Any `=== "video"` comparison silently sends every upper-case row down the image
 * branch, which renders an `<img>` pointing at an .mp4: a broken tile. That was live on the profile
 * wall and in SocialPresence for 51 rows. Every surface must ask through this one helper.
 */
export const isVideoType = (t?: string | null) => /video/i.test(t || "");

export type MediaItemRow = { post_id: string; media_url: string; media_type: string; position: number; thumbnail_url: string | null };

/** Instagram-style post: ONE media_posts row + up to 20 media_post_items (photos and/or videos)
 *  with an optional description. Engine tables — media_post_items already exists in prod. */
export async function createMediaPost(userId: string, files: File[], caption: string | null) {
  const batch = files.slice(0, MAX_ITEMS_PER_POST);
  const uploaded: { url: string; type: string }[] = [];
  for (const file of batch) {
    const isVideo = file.type.startsWith("video");
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, file, { upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
    uploaded.push({ url: pub.publicUrl, type: isVideo ? "video" : "image" });
  }
  if (!uploaded.length) return null;

  const { data: post, error: postErr } = await supabase.from("media_posts").insert({
    user_id: userId,
    caption: caption?.trim() || null,
    media_url: uploaded[0].url,
    media_type: uploaded[0].type,
    source: "native",
  }).select("id").single();
  if (postErr) throw postErr;

  // items rows for ALL media (position-ordered) so viewers can swipe through the post
  const items = uploaded.map((u, i) => ({ post_id: post.id, media_url: u.url, media_type: u.type, position: i }));
  const { error: itemsErr } = await supabase.from("media_post_items").insert(items);
  // Non-fatal: post exists with its cover; surface for debugging but don't lose the upload.
  if (itemsErr) console.warn("[mediaPost] items insert failed:", itemsErr.message);
  return post.id;
}

/**
 * Change the words under a photo.
 *
 * Lee, Jul 31 2026: "you can edit the comment — if you put a comment in there you want to edit it,
 * you can." The caption is the only editable part; swapping the media itself would silently change
 * what everyone already liked and commented on, so that stays a delete-and-repost.
 *
 * `updated_at` is deliberately NOT written here — a trigger on media_posts owns it, and only moves
 * it when the content actually changed. See the touch_media_post_updated_at migration.
 */
export async function updateMediaCaption(postId: string, caption: string) {
  const next = caption.trim() || null;
  const { error } = await supabase.from("media_posts").update({ caption: next }).eq("id", postId);
  if (error) throw error;
  return next;
}

/**
 * Remove a post — the row, its items, everyone's likes/comments/shares on it, and the files.
 *
 * The database side runs as one security-definer function (`delete_media_post`) because the
 * engagement tables are polymorphic and have no cascade, and their RLS correctly stops the post's
 * owner from deleting other people's likes and comments. Doing it client-side would have left
 * other people's comment text orphaned in the table after the photo was "deleted".
 *
 * Storage is cleaned up here because only the client can reach the storage API. The RPC returns
 * the paths it knows about; a failure to remove the blobs is logged but NOT thrown — by then the
 * post is already gone from every screen, and an error at that point would tell the user the
 * delete failed when it plainly did not. Stray bytes are a cleanup job, not a user-facing event.
 */
export async function deleteMediaPost(postId: string) {
  const { data, error } = await supabase.rpc("delete_media_post", { p_post_id: postId });
  if (error) throw error;

  const paths = ((data ?? []) as { deleted_path: string }[])
    .map(r => r.deleted_path)
    .filter(Boolean);
  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from("media").remove(paths);
    if (rmErr) console.warn("[mediaPost] storage cleanup failed:", rmErr.message);
  }
  return paths.length;
}

/** Fetch items for a set of posts, grouped by post_id (position-ordered). */
export async function fetchItemsForPosts(postIds: string[]) {
  if (!postIds.length) return new Map<string, MediaItemRow[]>();
  const { data } = await supabase.from("media_post_items")
    .select("post_id, media_url, media_type, position, thumbnail_url")
    .in("post_id", postIds).order("position", { ascending: true });
  const map = new Map<string, MediaItemRow[]>();
  for (const r of (data ?? []) as MediaItemRow[]) {
    const arr = map.get(r.post_id) ?? [];
    arr.push(r);
    map.set(r.post_id, arr);
  }
  return map;
}
