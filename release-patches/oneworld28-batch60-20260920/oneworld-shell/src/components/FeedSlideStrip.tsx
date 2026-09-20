import { useState } from "react";
import { Link } from "react-router-dom";
import { W } from "../lib/i18n";
import { IconPlay } from "./ActionIcons";
import FeedMedia from "./FeedMedia";
import FeedVideoPlayer from "./FeedVideoPlayer";
import type { FeedPreview } from "../lib/listingMedia";

/**
 * FEED SLIDE STRIP — one card's media, swipeable, with only the reachable slides mounted.
 * ============================================================================================
 * Promoted from OneHome's `Feed.tsx` on 20 Sep 2026 (OneEvent 30) so the Discover feed of every
 * product scrolls the same way. Three rules, each paid for once in OneHome:
 *
 *   · ONLY THE SLIDES YOU CAN REACH ARE REAL. Lee, 16 Sep: *"Why is it so glitchy when we only
 *     got seven listings? What happens if we have a hundred thousand?"* A card renders the slide
 *     you are on plus one either side; the rest are empty boxes of the same width, so the strip,
 *     the snap points and the counter are unchanged and the live image count drops from a
 *     hundred-odd to three per card. One either side, not zero: the next slide must exist before
 *     the thumb arrives. (`content-visibility` was tried and removed — its deferred render is a
 *     hitch you feel.)
 *   · A VIDEO SLIDE IS A BUTTON, A PHOTO SLIDE IS A LINK. Tapping a photograph means "show me
 *     this"; tapping a video means "play this" — full screen, with sound, in FeedVideoPlayer,
 *     which carries its own way on to the item. The media inside is pointer-transparent
 *     (FeedMedia), so the WHOLE slide is the target: no "I have to tap it three or four times".
 *   · THE COUNTER IS DERIVED FROM SCROLL POSITION, never tracked, so it cannot disagree with
 *     what is on screen.
 *
 * `aspect` is the strip's own shape ("aspect-square" for rentals, "aspect-[4/5]" for events).
 * `children` is drawn OVER the strip (gradients, titles, badges) and must not block the slide's
 * pointer events unless it means to (`pointer-events-none` on decoration).
 */
export default function FeedSlideStrip({
  slides, poster, title, href, lang, aspect = "aspect-square", cta, counter = true, className = "", children,
}: {
  slides: FeedPreview[];
  /** The still cover — the poster under every video slide. */
  poster: string | null;
  title: string;
  /** Where a photo slide, and the player's right-hand button, go. */
  href: string;
  lang: string;
  aspect?: string;
  /** Label for the player's right-hand button. Defaults to "View listing". */
  cta?: string;
  counter?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);

  /* A scroller cancels `click`, so a tap is measured by hand: down, up, and if the finger did not
     travel and did not linger, it was a tap. 12 px / 500 ms. */
  const tapAnywhere = (fire: () => void) => {
    let x = 0, y = 0, t = 0;
    return {
      onPointerDown: (e: React.PointerEvent) => { x = e.clientX; y = e.clientY; t = Date.now(); },
      onPointerUp: (e: React.PointerEvent) => {
        if (Math.hypot(e.clientX - x, e.clientY - y) > 12 || Date.now() - t > 500) return;
        e.preventDefault();
        fire();
      },
    };
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {playing !== null && (
        <FeedVideoPlayer slides={slides} start={playing} poster={poster} title={title}
          href={href} lang={lang} cta={cta} onClose={() => setPlaying(null)} />
      )}
      {slides.length > 0 ? (
        <div
          onScroll={e => {
            const el = e.currentTarget;
            const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (n !== idx) setIdx(n);
          }}
          className={`flex ${aspect} w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          style={{ touchAction: "pan-x pan-y", scrollbarWidth: "none" }}>
          {slides.map((m, i) => (
            Math.abs(i - idx) > 1 ? (
              <div key={m.url} className="h-full w-full shrink-0 snap-center" aria-hidden="true" />
            ) : m.kind === "video" ? (
              <button key={m.url} type="button" onClick={() => setPlaying(i)}
                {...tapAnywhere(() => setPlaying(i))}
                className="relative block h-full w-full shrink-0 snap-center"
                aria-label={W(lang, "Play video", "Reproducir video") + " — " + title}>
                <FeedMedia media={m} eager={i === 0} poster={poster} className="h-full w-full object-cover" />
                {/* Without a play mark a muted silent loop reads as an animated photo. */}
                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-black/45 text-white">
                    <IconPlay size={26} className="translate-x-[1px]" />
                  </span>
                </span>
              </button>
            ) : (
              <Link key={m.url} to={href} className="block h-full w-full shrink-0 snap-center"
                aria-label={`${W(lang, "Open photo", "Abrir foto")} ${i + 1} / ${slides.length} — ${title}`}>
                <FeedMedia media={m} eager={i === 0} poster={poster} className="h-full w-full object-cover" />
              </Link>
            )
          ))}
        </div>
      ) : (
        <Link to={href} className={`block ${aspect} w-full`} aria-label={title} />
      )}
      {counter && slides.length > 1 && (
        <span className="pointer-events-none absolute right-3 top-3 z-[2] rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black tabular-nums text-white backdrop-blur">
          {idx + 1} / {slides.length}
        </span>
      )}
      {children}
    </div>
  );
}
