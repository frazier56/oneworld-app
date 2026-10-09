/**
 * MEDIA UPLOAD — the two storage paths every product shares (extracted 20 Sep 2026, OneEvent 30).
 * ============================================================================================
 *   uploadPhoto()           what PhotoDeck does per file: bound + re-encode, write the display
 *                           image and its `-t` thumbnail to the `media` bucket, return the URL.
 *   uploadVideoResumable()  what PublicVideoDeck does per file: tus, 6 MB chunks, resumable.
 *
 * They exist as functions so a product can put a file it MADE (the VAIA event flyer, the AI
 * animated flyer) through the same path a member's own upload takes. Two ways to reach storage
 * would be two places for the thumbnail convention to drift.
 */
import * as tus from "tus-js-client";
import { SUPABASE_ANON, SUPABASE_URL, supabase } from "./supabase";
import { makeDerivatives, thumbPath } from "./imageDerivatives";

/**
 * Bound + re-encode before anything leaves the phone. `makeDerivatives` returning `null` means
 * either the browser could not decode it, or the conversion produced a BLANK canvas — and in both
 * cases the original goes up untouched.
 *
 * That second case dates from 12 Aug 2026 and is the fix for Lee's first listing photo, which
 * stored as a valid 2560×1920 WebP containing 4.9 million fully transparent pixels and nothing
 * else. `makeDerivatives` checks its own output and refuses to return an empty picture, so what
 * reaches storage is the actual photograph, unprocessed. A photograph we cannot shrink is still
 * better than a photograph we refused — and very much better than a blank rectangle nobody
 * notices until it is on the listing.
 *
 * The thumbnail is written beside it under the `-t` convention, and its failure is NOT fatal:
 * `thumbFor()` falls back to the display image, so a listing whose thumbnails did not write is
 * slower to draw and still completely correct.
 */
export async function uploadPhoto(
  f: File, uid: string, folder: string,
): Promise<{ url: string } | { error: string }> {
  const ext = (f.name.split(".").pop() ?? "").toLowerCase();
  const d = await makeDerivatives(f);
  const outExt = d ? d.ext : ext;
  const stem = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${stem}.${outExt}`;
  const { error } = await supabase.storage.from("media")
    .upload(path, d ? d.display : f, { upsert: false, contentType: d ? d.type : f.type });
  if (error) return { error: error.message };
  if (d?.thumb) {
    await supabase.storage.from("media")
      .upload(thumbPath(path), d.thumb, { upsert: false, contentType: d.type });
  }
  return { url: supabase.storage.from("media").getPublicUrl(path).data.publicUrl };
}

export const VIDEO_CHUNK_BYTES = 6 * 1024 * 1024;

function resumableEndpoint() {
  const url = new URL(SUPABASE_URL);
  url.hostname = url.hostname.replace(".supabase.co", ".storage.supabase.co");
  return `${url.origin}/storage/v1/upload/resumable`;
}

/** Resumable upload of one video to `media/<path>`; resolves to the public URL. */
export function uploadVideoResumable(
  file: File, path: string, token: string, onProgress?: (sent: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const task = new tus.Upload(file, {
      endpoint: resumableEndpoint(),
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON, "x-upsert": "false" },
      metadata: { bucketName: "media", objectName: path, contentType: file.type, cacheControl: "3600" },
      chunkSize: VIDEO_CHUNK_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress: onProgress ? (sent) => onProgress(sent) : undefined,
      onError: reject,
      onSuccess: () => resolve(supabase.storage.from("media").getPublicUrl(path).data.publicUrl),
    });
    void task.findPreviousUploads().then(previous => {
      if (previous[0]) task.resumeFromPreviousUpload(previous[0]);
      task.start();
    }).catch(reject);
  });
}

/** The storage path a product's video goes to. One convention for rent, sale and events. */
export function videoPath(uid: string, folder: string, file: File): string {
  const ext = (file.name.split(".").pop() || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${uid}/${folder}/videos/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}
