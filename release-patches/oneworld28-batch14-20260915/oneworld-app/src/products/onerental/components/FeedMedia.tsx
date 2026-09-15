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
export default function FeedMedia({ media, className, eager = false }: {
  media: FeedPreview; className: string; eager?: boolean;
}) {
  if (media.kind === "video") return <FeedVideo url={media.url} className={className} />;
  return (
    <img src={thumbFor(media.url)} alt="" loading={eager ? "eager" : "lazy"}
      onError={e => { const t = e.currentTarget; if (t.src !== media.url) t.src = media.url; }}
      className={className} />
  );
}

function FeedVideo({ url, className }: { url: string; className: string }) {
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
    <video ref={ref} src={url} muted playsInline loop preload="metadata" className={className} />
  );
}
