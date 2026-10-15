import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { W } from "../lib/i18n";
import { IconPlay } from "./ActionIcons";
import FeedMedia from "./FeedMedia";
import { sizedFor, thumbFor } from "../lib/imageDerivatives";
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
  smartFit = false, fitRatio = 0.8, fitPadBottom = "22%",
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
  /**
   * ── FIT THE WHOLE PICTURE, DO NOT CUT THE WORDS OFF (Lee, 12 Oct 2026) ───────────────────
   * Off by default, so every existing feed renders exactly as it does today. See `SmartMedia`.
   */
  smartFit?: boolean;
  /** The card's own width ÷ height. MUST match `aspect` — 0.8 for "aspect-[4/5]". */
  fitRatio?: number;
  /** Clearance kept under a fitted picture for the card's own title block. */
  fitPadBottom?: string;
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
                className="relative block h-full w-full shrink-0 snap-center overflow-hidden"
                aria-label={W(lang, "Play video", "Reproducir video") + " — " + title}>
                <SmartMedia media={m} eager={i === 0} poster={poster}
                  smartFit={smartFit} fitRatio={fitRatio} fitPadBottom={fitPadBottom} />
                {/* Without a play mark a muted silent loop reads as an animated photo. */}
                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-black/45 text-white">
                    <IconPlay size={26} className="translate-x-[1px]" />
                  </span>
                </span>
              </button>
            ) : (
              <Link key={m.url} to={href} className="relative block h-full w-full shrink-0 snap-center overflow-hidden"
                aria-label={`${W(lang, "Open photo", "Abrir foto")} ${i + 1} / ${slides.length} — ${title}`}>
                <SmartMedia media={m} eager={i === 0} poster={poster}
                  smartFit={smartFit} fitRatio={fitRatio} fitPadBottom={fitPadBottom} />
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

/* ⚠️ THE FEED WAS CUTTING THE WORDS OFF PEOPLE'S FLYERS. — Lee, 12 October 2026
   ============================================================================================
   *"The flyer is expanded to match the vertical length. But when you do that, then the width is
   too much and the words are cut off... she didn't build it, she uploaded it... it's probably
   gonna be better shrunk now so you can see the whole flyer."*

   A feed card is a fixed 4:5 box and every slide was `object-cover`, which fills that box and
   throws away whatever does not fit. For a photograph that is harmless — you lose some sky. For
   a FLYER it is the product failing at its job: a flyer is words, the words live at the edges,
   and a square flyer in a 4:5 box loses a fifth of its width. The host cannot fix it, because
   the host did not draw it; Karen uploaded a finished picture. And "tap it and you'll see the
   whole thing" is not an answer — the feed is where people decide whether to tap.

   So the picture itself decides, from its real pixels, with no new upload and no new column:

     · NEARLY THE RIGHT SHAPE → fill the card, exactly as before. A 3:4 portrait loses about six
       percent off the top and bottom, which is trim, not content. Nothing about today's feed
       changes for the photographs already in it.
     · THE WRONG SHAPE → shrink the whole picture until all of it fits, and fill the card behind
       it with the same picture, blown up and blurred. No bars, no crop, no lost words. It is
       what every serious feed does with off-ratio media, and it reads as designed rather than
       broken.

   The fitted picture is held clear of the card's own title block (`fitPadBottom`), because a
   flyer's date and address are usually along its bottom edge and the card's gradient sits
   there — fitting it only to then bury it under our own text would have fixed nothing.

   Eight percent is the line. It is below the twenty percent a square flyer loses (so Karen's is
   fitted) and above the six percent a 3:4 portrait loses (so ordinary photographs still fill
   the card). Videos keep filling the card: a flyer is a photograph, and this stays the smallest
   change that fixes what he reported.

   It starts out fitted and tightens to filling once measured, never the other way round: a
   half-second of letterbox is nothing, a half-second of chopped-off words is the bug. */
function SmartMedia({ media, eager, poster, smartFit, fitRatio, fitPadBottom }: {
  media: FeedPreview; eager: boolean; poster: string | null;
  smartFit: boolean; fitRatio: number; fitPadBottom: string;
}) {
  const measurable = smartFit && media.kind === "photo";
  const [fill, setFill] = useState(!measurable);

  useEffect(() => {
    if (!measurable) { setFill(true); return; }
    let live = true;
    setFill(false);
    const img = new Image();
    /* The same URL the slide itself requests, so this is the browser cache, not a second
       download. If it cannot be measured at all, fill the card — today's behaviour. */
    img.onload = () => {
      if (!live) return;
      const r = img.naturalWidth / Math.max(1, img.naturalHeight);
      const lost = r > fitRatio ? 1 - fitRatio / r : 1 - r / fitRatio;
      setFill(!(lost > 0.08));
    };
    img.onerror = () => { if (live) setFill(true); };
    img.src = srcOf(media.url);
    return () => { live = false; };
  }, [media.url, media.kind, measurable, fitRatio]);

  if (fill) return <FeedMedia media={media} eager={eager} poster={poster} className="h-full w-full object-cover" />;

  return (
    <>
      {/* The card's own picture, blown up and blurred, so there are never black bars. */}
      <img src={srcOf(media.url)} alt="" aria-hidden="true" decoding="async"
        loading={eager ? "eager" : "lazy"}
        className="pointer-events-none absolute inset-0 h-full w-full scale-[1.3] object-cover blur-2xl" />
      <span className="pointer-events-none absolute inset-0 bg-black/30" />
      <div className="pointer-events-none absolute inset-0" style={{ paddingBottom: fitPadBottom }}>
        <FeedMedia media={media} eager={eager} poster={poster} className="h-full w-full object-contain" />
      </div>
    </>
  );
}

/** Card-sized Storage copy, then the derivative, then the original — FeedMedia's own order. */
function srcOf(url: string) {
  return sizedFor(url, 430) || thumbFor(url) || url;
}

