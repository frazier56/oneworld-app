import { supabase } from "./supabase";

/**
 * PROFILE PHOTO UPLOAD (SHELL) — the helper `ProfileEdit` said was missing.
 * ============================================================================================
 * `ProfileEdit.tsx` carried this note: *"NOT here yet, on purpose: photo / banner UPLOAD. There
 * is no storage-upload helper wired into the shell, and a half-working uploader is worse than
 * none."* That was the right call at the time. Lee closed it on 10 Aug: *"make the entire page
 * editable — including changing your photo, uploading your photo."*
 *
 * VERIFIED AGAINST THE LIVE BUCKET, and the bucket was FIXED to match what people actually do:
 *
 *   bucket `profile-photos` · PUBLIC read · 5 MB limit
 *   mime allow-list: jpeg, png, webp, gif, heic, heif
 *   INSERT policy `Owner uploads own profile photo` — authenticated only, folder must be the
 *     uploader's own id, extension in jpg|jpeg|png|gif|webp|heic|heif
 *   UPDATE / DELETE — owner-only, same folder rule
 *
 * TWO THINGS WERE WRONG WITH THE OLD POLICY AND BOTH ARE NOW FIXED IN THE DATABASE
 * (migration `profile_photos_owner_scoped_upload_and_heic`, 10 Aug 2026):
 *
 *   1. It was granted to `public` and never checked WHOSE folder the object landed in, so anyone
 *      could write new objects under any member's prefix. It now matches its UPDATE/DELETE
 *      siblings: authenticated, own folder only. Proven with a rolled-back probe — owner into
 *      their own folder ALLOWED, into someone else's REFUSED, a .svg REFUSED.
 *   2. It rejected every iPhone photo. The bucket's mime list already allowed heic/heif; the
 *      policy's extension list did not. Photos off an iPhone are .heic, so the single most likely
 *      upload on the platform failed with "new row violates row-level security policy". heic and
 *      heif are now accepted.
 *
 * WHY THE PICKER SAYS `image/*` AND NOT A LIST OF TYPES. On iOS, choosing a photo from the
 * library through an `image/*` input makes Safari hand over a JPEG — the system transcodes the
 * HEIC on selection. Naming the types explicitly is what defeats that and hands over the raw
 * .heic. So the browser does the conversion for free on the platform where it matters, and the
 * policy now accepts .heic anyway for the cases where a raw file does come through (a file
 * manager, a desktop drag). Belt and braces, no decoder library, nothing for a person to do.
 *
 * THE PATH MUST START WITH THE USER'S ID — `<uid>/<file>` is what makes all three owner-only
 * policies match. A flat filename uploads once and can never be replaced.
 *
 * The name is randomised rather than fixed so a new photo cannot be served from a CDN cache of
 * the old one — the "I changed my picture and it still shows the old one" report writes itself.
 */

/** What the bucket's INSERT policy accepts. Keep in step with the POLICY, not the mime list. */
const ALLOWED_EXT = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

export type PhotoUploadResult = { url: string } | { error: string };

export async function uploadProfilePhoto(userId: string, file: File): Promise<PhotoUploadResult> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();

  if (!(ALLOWED_EXT as readonly string[]).includes(ext)) {
    /* Say the thing the person can act on. "new row violates row-level security policy" is what
       the server says, and it tells a photographer nothing. */
    return { error: "That file type isn't supported. Use a photo — JPG, PNG, WEBP, GIF or HEIC." };
  }
  if (file.size > MAX_BYTES) {
    return { error: `That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB — try a smaller one.` };
  }

  /* `<uid>/…` is load-bearing: the owner-only UPDATE and DELETE policies match on the first path
     segment. A random name defeats CDN caching of the previous photo. */
  const rand = (globalThis.crypto?.randomUUID?.() ?? String(Date.now())).replace(/-/g, "").slice(0, 16);
  const path = `${userId}/${rand}.${ext}`;

  const { error: upErr } = await supabase.storage.from("profile-photos")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
  if (upErr) {
    console.error("[uploadProfilePhoto] upload failed:", upErr.message);
    return { error: upErr.message };
  }

  const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
  if (!data?.publicUrl) return { error: "The photo uploaded but we could not build its address. Try again." };
  return { url: data.publicUrl };
}
