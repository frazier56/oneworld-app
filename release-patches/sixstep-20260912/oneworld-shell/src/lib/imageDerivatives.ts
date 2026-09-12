/**
 * IMAGE DERIVATIVES — how a phone photograph becomes something we can afford to store and
 * something that is still sharp on the screen it will be looked at on.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"Whatever Instagram or Facebook does… they probably got billions of files.
 * We need to do the same thing. There has to be some strategy that people use, because there's
 * plenty of sites that have high resolution pictures — cars for sale, Amazon, Facebook
 * Marketplace. It shouldn't be that difficult to store high resolution images. They don't have to
 * be ultra high resolution, but they don't need to be blurry on a cell phone."*
 *
 * ── WHAT THOSE SITES ACTUALLY DO, WHICH IS NOT WHAT IT LOOKS LIKE ───────────────────────────
 * None of them store your original. Instagram has uploaded at a bounded width for its entire
 * history — for years that was 1080px. Facebook, Marketplace and Amazon all do the same thing:
 * bound the longest edge, re-encode at a quality around 80, and keep a small thumbnail for grids.
 * The "high resolution" a person perceives is not the sensor's resolution — it is an image with
 * enough pixels for the screen it is displayed on and no compression artefacts.
 *
 * The arithmetic is the whole argument. The widest phone in use is about 430 CSS pixels across at
 * 3× device pixel ratio, so a full-bleed photograph needs about **1,290 real pixels** to be
 * pixel-perfect. This bounds the longest edge at **2,560**, which is double that — sharp when
 * somebody pinches in, and still sharp on a laptop. A 12-megapixel phone original is 4,032 across
 * and about 5 MB; the same photograph bounded and re-encoded is roughly **300–500 KB**.
 *
 * Fifty photographs per listing therefore go from about **250 MB to about 20 MB** — the difference
 * between a storage bill that scales and one that does not — and nobody can see the difference on
 * a phone. That is the strategy Lee is describing, and it is entirely client-side: no image
 * server, no transform CDN, no plan upgrade. It works on the free tier we are on today.
 *
 * ── AND A SEPARATE THUMBNAIL, BECAUSE A GRID IS THE EXPENSIVE SCREEN ────────────────────────
 * A four-across grid of fifty photographs that each load at 2,560px is 20 MB of downloads to draw
 * fifty postage stamps. So each upload also produces a **512px** thumbnail of about 30–50 KB. The
 * grid loads thumbnails, the viewer loads the display image. Same as every site Lee named.
 *
 * The thumbnail's URL is DERIVED from the display image's by convention (`…-t.jpg`) rather than
 * stored, so `photos text[]` needs no schema change and no migration — and `thumbFor()` degrades
 * to the display image if a thumbnail was never written, which is what makes this safe to roll out
 * over listings that already exist.
 */

/** The longest edge we keep. Double what the widest phone can actually resolve. */
export const DISPLAY_MAX_EDGE = 2560;
/** Grid thumbnails. 512 covers a 4-across grid at 3× on the widest phone. */
export const THUMB_MAX_EDGE = 512;

const DISPLAY_QUALITY = 0.82;
const THUMB_QUALITY = 0.72;

/** The suffix that turns a display URL into its thumbnail. */
const THUMB_SUFFIX = "-t";

export type Derivatives = {
  /** Bounded, re-encoded. What the viewer and the feed card load. */
  display: Blob;
  /** Small. What a grid loads. `null` when the browser could not decode the file at all. */
  thumb: Blob | null;
  /** `image/webp` or `image/jpeg`, whichever this browser can actually encode. */
  type: string;
  ext: "webp" | "jpg";
};

/**
 * Decode, bound, re-encode. Returns `null` when the browser cannot decode the file — a raw HEIC
 * on a desktop browser is the real case — and the caller then uploads the original untouched,
 * which is worse for storage but never loses a photograph.
 *
 * WebP where the browser can encode it (every current browser can), JPEG otherwise. WebP is about
 * 25–30% smaller than JPEG at the same perceived quality, which is the other half of what the
 * sites Lee listed are doing.
 */
export async function makeDerivatives(file: File): Promise<Derivatives | null> {
  const bitmap = await decode(file);
  if (!bitmap) return null;

  const canWebp = await supportsWebp();
  const type = canWebp ? "image/webp" : "image/jpeg";
  const ext = canWebp ? "webp" : "jpg";

  const display = await draw(bitmap, DISPLAY_MAX_EDGE, DISPLAY_QUALITY, type);
  const thumb = await draw(bitmap, THUMB_MAX_EDGE, THUMB_QUALITY, type);
  (bitmap as any).close?.();

  if (!display) return null;

  /* NEVER SHIP A DERIVATIVE THAT IS BIGGER THAN THE ORIGINAL. A small, already-optimised photo
     re-encoded can come out larger than it went in — the honest answer there is to keep the
     original, and this is why the caller is told the display blob and decides. */
  return { display: display.size < file.size ? display : file, thumb, type, ext };
}

/** The thumbnail URL for a stored display URL. Convention, not a stored column — see the header. */
export function thumbFor(url: string): string {
  const q = url.indexOf("?");
  const base = q === -1 ? url : url.slice(0, q);
  const tail = q === -1 ? "" : url.slice(q);
  const dot = base.lastIndexOf(".");
  if (dot === -1) return url;
  return `${base.slice(0, dot)}${THUMB_SUFFIX}${base.slice(dot)}${tail}`;
}

/** The storage path for a display file's thumbnail. Mirrors `thumbFor` on the upload side. */
export function thumbPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? `${path}${THUMB_SUFFIX}` : `${path.slice(0, dot)}${THUMB_SUFFIX}${path.slice(dot)}`;
}

/* ── the plumbing ─────────────────────────────────────────────────────────────────────────── */

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    if (typeof createImageBitmap === "function") {
      /* `imageOrientation: "from-image"` is not optional. Without it a photograph taken in
         portrait on a phone decodes sideways, because the rotation lives in EXIF and drawing to a
         canvas throws EXIF away. Every "my photos are rotated" bug is this line missing. */
      return await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    }
  } catch { /* fall through to the <img> path */ }

  /* ── `onload` IS NOT "PAINTABLE" (Lee, 12 Aug 2026) ──────────────────────────────────────
     Lee's first listing photo uploaded as a valid 2560×1920 WebP of 9.5KB in which every one of
     the 4,915,200 pixels was fully transparent — alpha 0, RGB 0, zero opaque pixels. The file
     was fine. The picture was nothing.

     This is why. `img.onload` fires when the resource has loaded, NOT necessarily when the
     bitmap is decoded and ready to paint. Draw on that event and some browsers give you an empty
     canvas at the correct dimensions — which is exactly the artefact: right size, no content.
     `img.decode()` is the promise that actually means "you may now draw me".

     It also turns an undecodable file (a raw HEIC straight off an iPhone, say) into a REJECTION
     rather than a silent blank, because `decode()` rejects where `onload` had already resolved. */
  return await new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (v: HTMLImageElement | null) => { URL.revokeObjectURL(url); resolve(v); };
    img.onload = () => {
      const ready = (img as any).decode
        ? (img as any).decode().then(() => done(img)).catch(() => done(null))
        : null;
      if (!ready) done(img);
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}

async function draw(
  src: ImageBitmap | HTMLImageElement, maxEdge: number, quality: number, type: string,
): Promise<Blob | null> {
  const w0 = (src as any).width as number;
  const h0 = (src as any).height as number;
  if (!w0 || !h0) return null;

  /* Never UPSCALE. A 600px photograph blown up to 2,560 is a bigger file that is no sharper — it
     is the same photograph with more pixels of the same blur. */
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  /* The browser's own resampler, at its best setting. A naive one-step downscale of a 4,000px
     photo to 512 aliases badly — this is what stops a thumbnail looking crunchy. */
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = "high";

  /* ── AN OPAQUE BASE ──────────────────────────────────────────────────────────────────────
     A property photograph never needs transparency, and a transparent one is indistinguishable
     from a missing one on screen. Painting white first means a source WITH alpha composites onto
     something rather than becoming an invisible pane — and it makes any failure below visible
     instead of silent. */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);

  /* ── AND THEN CHECK THAT SOMETHING IS ACTUALLY THERE ─────────────────────────────────────
     The real protection, and the thing whose absence let a blank image reach production. Every
     step above can "succeed" and still produce nothing: `decode()` may be missing, a codec may
     fail quietly, a cross-origin source may taint. Rather than trust the pipeline, look at the
     result.

     A 32×32 sample is enough — a photograph has variation everywhere, and a blank canvas has
     none anywhere. If every sampled pixel is identical, this is not a photograph, and returning
     `null` makes the caller report a failed conversion instead of uploading a white rectangle.
     Reading pixels back taints nothing here: the canvas is ours and the source came from a File.

     Lee: *"we need to fix it, because other people may decide to upload photos the same way, and
     we don't want their pictures to be blacked out like that."* */
  if (!hasContent(ctx, w, h)) return null;

  return await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), type, quality));
}

/** True if the canvas holds more than one colour — i.e. a picture rather than a blank pane. */
function hasContent(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const N = 32;
  let first: number | null = null;
  try {
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const x = Math.min(w - 1, Math.floor((ix + 0.5) * w / N));
        const y = Math.min(h - 1, Math.floor((iy + 0.5) * h / N));
        const d = ctx.getImageData(x, y, 1, 1).data;
        const key = (d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3];
        if (first === null) first = key;
        else if (key !== first) return true;
      }
    }
  } catch {
    /* A tainted canvas cannot be read. Assume the image is real rather than throwing away a
       photograph over a security rule that has nothing to do with whether it is blank. */
    return true;
  }
  return false;
}

let webpCache: boolean | null = null;
async function supportsWebp(): Promise<boolean> {
  if (webpCache !== null) return webpCache;
  try {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    webpCache = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch { webpCache = false; }
  return webpCache;
}
