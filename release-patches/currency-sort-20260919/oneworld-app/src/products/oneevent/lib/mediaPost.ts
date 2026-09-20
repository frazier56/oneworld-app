import { supabase } from "@evt/lib/supabase";

export const MAX_ITEMS_PER_POST = 20;

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
