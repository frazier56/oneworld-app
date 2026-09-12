/**
 * LISTING MEDIA CHOICES — cover, feed preview, feed visibility (OneHome media lane, 7 Sep 2026).
 * ============================================================================================
 * Three columns arrived on `rental_properties` with migration `onehome_media_cover_and_feed_preview`:
 *
 *   cover_photo   text     the still photo shown on the listing page and every profile / saved /
 *                          my-properties card. NULL = "first photo", exactly what it was before.
 *   feed_preview  jsonb    {"kind":"photo"|"video","url":…} — the ONE thing the Discover feed
 *                          leads with. Independent of the cover on purpose: a host can lead the
 *                          feed with a walk-through clip and still keep a tidy still as the cover.
 *                          NULL = "use the cover".
 *   feed_visible  boolean  false keeps the listing public and openable by link / from the profile,
 *                          but out of the Discover feed. Default true.
 *
 * The database guards both pointers (trigger `rental_media_choices_guard`): a cover that is not
 * in `photos`, or a preview whose url is in neither `photos` nor `videos`, is nulled on write. So a
 * host who deletes the photo they chose as cover gets the first photo back, never a broken image.
 * These helpers apply the SAME rule on read, so a row written before the trigger existed — or a
 * row read a moment before it is re-saved — renders the same way.
 */
import type { Property } from "./rental";

export type FeedPreview = { kind: "photo" | "video"; url: string };

/** The narrow shape every helper needs. The feed card's select is narrower than `Property`. */
export type MediaRow = {
  photos?: string[] | null;
  videos?: string[] | null;
  cover_photo?: string | null;
  feed_preview?: FeedPreview | null;
};

/** A usable `feed_preview`, or null when it is unset or points at media the listing no longer has. */
export function validPreview(p: MediaRow): FeedPreview | null {
  const fp = p.feed_preview;
  if (!fp || typeof fp !== "object" || typeof fp.url !== "string") return null;
  if (fp.kind === "photo" && (p.photos ?? []).includes(fp.url)) return fp;
  if (fp.kind === "video" && (p.videos ?? []).includes(fp.url)) return fp;
  return null;
}

/** The still cover: the host's choice if it is still one of the photos, else the first photo. */
export function coverOf(p: MediaRow): string | null {
  const photos = p.photos ?? [];
  if (p.cover_photo && photos.includes(p.cover_photo)) return p.cover_photo;
  return photos[0] ?? null;
}

/** The photos with the cover moved to the front — what the gallery and any swipe strip show. */
export function orderedPhotos(p: MediaRow): string[] {
  const photos = p.photos ?? [];
  const cover = coverOf(p);
  if (!cover || photos[0] === cover) return photos;
  return [cover, ...photos.filter(u => u !== cover)];
}

/** What the FEED leads with: the chosen preview, else the cover as a photo, else nothing. */
export function feedLead(p: MediaRow): FeedPreview | null {
  const chosen = validPreview(p);
  if (chosen) return chosen;
  const cover = coverOf(p);
  return cover ? { kind: "photo", url: cover } : null;
}

/** Every slide the big feed card can swipe through: the lead first, then the remaining photos
    in cover order. A video lead is one slide; the photos follow it. */
export function feedSlides(p: MediaRow): FeedPreview[] {
  const lead = feedLead(p);
  if (!lead) return [];
  const rest = orderedPhotos(p).filter(u => u !== lead.url).map(url => ({ kind: "photo" as const, url }));
  return [lead, ...rest];
}

/** Type guard so the form and the detail screen can narrow a loose row to what they need. */
export function mediaRowOf(p: Property): MediaRow {
  return { photos: p.photos, videos: p.videos, cover_photo: p.cover_photo, feed_preview: p.feed_preview };
}
