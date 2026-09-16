import { useEffect, useRef } from "react";
import { thumbFor } from "@oneworld/shell";
import type { FeedPreview } from "../lib/media";

/**
 * ONE FEED SLIDE — a photo, or a muted looping video (OneHome media lane, 7 Sep 2026).
 * ============================================================================================
 * The feed was photo-only. Hosts now pick ONE preview per listing — a photo or one of their
 * public videos — and this is what draws it.
 *
 * VIDEO RULES, all deliberate:
 *   · muted + playsInline + loop — the only combination phones will autoplay at all, and the
 *     only one a feed can afford: a feed that talks is a feed people close.
 *   · preload="metadata", and it plays only while it is on screen. A feed of twelve cards must
 *     not stream twelve videos because the reader is looking at the first one. The observer
 *     pauses it again the moment it scrolls off, which also stops it burning battery in a
 *     background tab.
 *   · No controls. Tapping the card opens the listing, where PublicVideoViewer has the full
 *     screen player with sound. The feed is the trailer, not the cinema.
 *
 * Photos keep exactly the behaviour they had: `thumbFor()` derivative first, the original on
 * error, lazy unless told otherwise.
 */
export default function FeedMedia({ media, className, eager = false, poster }: {
  media: FeedPreview; className: string; eager?: boolean; poster?: string | null;
}) {
  if (media.kind === "video") return <FeedVideo url={media.url} className={className} poster={poster} />;
  return (
    <img src={thumbFor(media.url)} alt="" loading={eager ? "eager" : "lazy"}
      onError={e => { const t = e.currentTarget; if (t.src !== media.url) t.src = media.url; }}
      className={className} />
  );
}

/* ⚠️ A VIDEO WITH NO `poster` IS A BLANK RECTANGLE, AND LEE CAUGHT IT. — 16 Sep 2026
   *"Notice the actual video isn't there. The video should have a still image... it's just not
   there. That's a very poor quality user experience."*

   He is describing exactly what the spec says happens. `preload="metadata"` fetches the
   duration and dimensions and is NOT obliged to decode a first frame, so until something calls
   play() the element paints nothing at all. In the feed that is a listing showing an empty box
   where its best photo should be — the single worst first impression the product can make, on
   the one card most likely to be the best listing, because the host cared enough to film it.

   The poster is the listing's own cover photo. It is already fetched for every other card, it
   is the right shape, and it is what the host chose to represent the place. So the card is
   never empty: cover photo immediately, video over the top of it the moment it is on screen,
   and the photo again underneath if the video fails or the phone refuses to autoplay.

   ⚠️ `object-cover` must be on the element for the poster too, which it is — `className` is
   applied to the <video>, and a poster is painted with the element's own object-fit. */
function FeedVideo({ url, className, poster }: { url: string; className: string; poster?: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* Set as a PROPERTY too, not only the JSX attribute: some WebKit builds refuse autoplay
       unless `muted` is true on the element at the moment play() is called. */
    el.muted = true;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void el.play().catch(() => undefined);
      else el.pause();
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); el.pause(); };
  }, [url]);
  return (
    <video ref={ref} src={url} poster={poster ?? undefined} muted playsInline loop
      preload="metadata" className={className} />
  );
}
