/**
 * Aspect-ratio helpers for native flyer support.
 *
 * Promoters today live on Instagram with vertical 4:5 / 9:16 flyers. We accept
 * any ratio on upload, then snap it to the closest preset so cards & hero
 * sections can render the flyer uncropped.
 */

export type CoverAspectRatio = "16:9" | "4:5" | "9:16" | "1:1";

export const COVER_ASPECT_RATIOS: CoverAspectRatio[] = ["16:9", "4:5", "9:16", "1:1"];

const RATIO_VALUES: Record<CoverAspectRatio, number> = {
  "16:9": 16 / 9,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "1:1": 1,
};

/** Snap an arbitrary width/height ratio to the nearest supported preset. */
export function snapAspectRatio(width: number, height: number): CoverAspectRatio {
  if (!width || !height) return "16:9";
  const r = width / height;
  let best: CoverAspectRatio = "16:9";
  let bestDelta = Infinity;
  for (const key of COVER_ASPECT_RATIOS) {
    const delta = Math.abs(Math.log(r / RATIO_VALUES[key]));
    if (delta < bestDelta) {
      bestDelta = delta;
      best = key;
    }
  }
  return best;
}

/** Read the natural dimensions of an image File and return its snapped ratio. */
export function detectAspectRatio(file: File): Promise<CoverAspectRatio> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = snapAspectRatio(img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      resolve(ratio);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("16:9");
    };
    img.src = url;
  });
}

/** CSS aspect-ratio string (e.g. "16/9") for a given preset. */
export function aspectRatioCss(ratio: CoverAspectRatio | null | undefined): string {
  switch (ratio) {
    case "4:5": return "4/5";
    case "9:16": return "9/16";
    case "1:1": return "1/1";
    case "16:9":
    default: return "16/9";
  }
}

/** True if the ratio is a vertical/square "flyer-style" image (anything but 16:9). */
export function isFlyerAspect(ratio: CoverAspectRatio | null | undefined): boolean {
  return ratio === "4:5" || ratio === "9:16" || ratio === "1:1";
}
