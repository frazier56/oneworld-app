import { useState } from "react";
import { IconPlatform } from "./ActionIcons";

/**
 * PLATFORM MARK — the real logo of the place a post came from (SHELL).
 * ============================================================================================
 * Lee, 9 Oct 2026, looking at the social-media grid at phone width:
 *
 *   *"The icon at the upper left corner of each card should tell the origin of it. It needs to be
 *   a more authentic logo. It's very hard to see the way it is now… if it's YouTube put a YouTube
 *   logo, if it's Instagram put Instagram. You don't need much of a background, just a little bit
 *   — a tinted grey. But we need the actual logo."*
 *
 * He is right about both halves, and they have different answers.
 *
 * ── THE LEGIBILITY HALF IS MINE, AND IT IS FIXED HERE ──────────────────────────────────────
 * `IconPlatform` draws thin 1.9-weight line art. At the 11 pixels the grid gave it, on a dark
 * chip, over a photograph, that is mush. Worse, `onesocial` is not a key in that map at all, so
 * every one of his own posts fell through to the GLOBE — the same mark the map uses for "I do not
 * know what this is". The chip is now light rather than near-black, the mark is bigger, and the
 * fallback art is heavier.
 *
 * ── THE AUTHENTIC-LOGO HALF IS NOT MINE TO DRAW ────────────────────────────────────────────
 * These are trademarks. Hand-drawing something that passes for the Instagram or YouTube mark is
 * both wrong and worse-looking than the real thing. Each platform publishes an official asset for
 * exactly this use — saying where a piece of content came from.
 *
 * So this follows the pattern PUB30 set for the App Store and Android marks on 8 October, and the
 * sentence it set with it: *"PUB30 does not draw the marks."* The component loads the official
 * file when it is present and falls back to the line glyph when it is not, so it goes live the
 * moment the files are dropped, with no code change and no second deploy — the same
 * "light up when configured" rule the architecture already uses three times over.
 *
 *   public/brand/social/instagram.svg
 *   public/brand/social/youtube.svg
 *   public/brand/social/tiktok.svg
 *   public/brand/social/facebook.svg
 *   public/brand/social/linkedin.svg
 *   public/brand/social/x.svg          (Twitter's current mark)
 *   public/brand/social/twitch.svg
 *   public/brand/social/yelp.svg       (for OneScore's reputation sources, later)
 *   public/brand/social/onesocial.svg  (ours — the only one we may draw)
 *
 * Full colour, never tinted: a recoloured logo is not the logo. The chip is therefore LIGHT, so a
 * coloured mark reads on it over any photograph.
 */

const KNOWN: Record<string, true> = {
  instagram: true, youtube: true, tiktok: true, facebook: true,
  linkedin: true, x: true, twitter: true, twitch: true, yelp: true, onesocial: true,
};
/* Twitter's file is named for the mark it actually is today. */
const FILE: Record<string, string> = { twitter: "x" };

/* ⚠️ ONE ATTEMPT PER PLATFORM, NOT ONE PER POST — found by watching the console, not by reading.
   The first version put an <img> on every tile, so a grid of thirty posts fired thirty requests
   for a file that is not there yet and printed thirty "ERR_FILE_NOT_FOUND" lines. A console full
   of expected 404s is where a real error goes to hide.

   Module-level, deliberately: it is state plus no re-render, shared by every tile on the page,
   and it must survive remounts as the person switches tabs and widths. Same shape as
   `viewerCurrency` and `compareStore`, and for the same reason — a provider would re-render the
   whole grid. At most one request per platform per page load, and none at all once a platform is
   known to be missing. */
const missing = new Set<string>();

export default function PlatformMark({ name, size = 13, onChip = true, className }: {
  name: string;
  size?: number;
  /** The grid draws these over photographs and needs the chip; a filter chip does not. */
  onChip?: boolean;
  className?: string;
}) {
  const key = (name || "").toLowerCase();
  const [, bump] = useState(0);
  const hasOfficial = !!KNOWN[key] && !missing.has(key);

  const mark = hasOfficial ? (
    <img
      src={`/brand/social/${FILE[key] ?? key}.svg`}
      alt=""
      width={size}
      height={size}
      decoding="async"
      /* The file is simply not there yet. Record it for the whole page, so no other tile asks
         again, and fall back rather than leave a broken-image box — a gap in the asset drop must
         never render as a defect on a member's profile. */
      onError={() => { missing.add(key); bump(n => n + 1); }}
      style={{ width: size, height: size, display: "block" }}
    />
  ) : (
    <IconPlatform name={key} size={size} />
  );

  if (!onChip) return <span className={className}>{mark}</span>;

  /* A light chip, not the near-black one. Dark enough to separate the mark from a bright photo,
     light enough that a full-colour logo is still its own colour. */
  return (
    <span
      className={`grid place-items-center rounded-md bg-white/85 text-ink shadow-[0_1px_3px_rgba(0,0,0,.3)] backdrop-blur-[2px] dark:bg-white/85 ${className ?? ""}`}
      style={{ width: size + 8, height: size + 8 }}
    >
      {mark}
    </span>
  );
}
