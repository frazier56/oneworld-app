import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { W } from "@oneworld/shell";
import type { FeedPreview } from "../lib/media";

/**
 * TAP A VIDEO IN THE FEED, WATCH IT FULL SCREEN, THEN GO TO THE LISTING. (16 Sep 2026)
 * ============================================================================================
 * Lee: *"My preference would be where you could just see the video — it could effectively
 * enlarge the video. And then there should be a link that says view listing. Or go back — going
 * back takes you back to the feed. Right now it doesn't work that way."*
 *
 * It didn't. Tapping a video slide jumped straight to the listing, so the video the host filmed
 * was a thumbnail you could never actually watch from the place people are actually looking.
 *
 * THREE RULES, and they come from what a person expects a full-screen video to do:
 *   · It plays WITH SOUND. The feed tile is a silent trailer; this is the thing itself. Muted
 *     autoplay is a phone rule for video that starts on its own — this one starts because
 *     somebody asked for it, so it may speak.
 *   · Real controls. Lee asked to be able to fast-forward and rewind, which is `controls`, not
 *     a set of buttons I would have to reinvent worse.
 *   · TWO WAYS OUT, and they do different things. Back returns to the feed exactly where he
 *     was. View listing goes on to the property. A single X that did one of them and not the
 *     other is the thing that makes people feel trapped in a player.
 *
 * ⚠️ The page behind must not scroll while this is open, or closing it puts you somewhere else
 * in the feed than you left. Restoring the previous overflow rather than clearing it matters —
 * another sheet may have set it first.
 */
export default function FeedVideoPlayer({ slides, start, poster, title, href, lang, onClose }: {
  /* ⚠️ THE WHOLE CARD'S MEDIA, NOT ONE FILE. Lee asked to swipe from the video he opened into
     the next video and on into the photographs without leaving full screen — so the player has
     to know about all of them, not just the one that was tapped. */
  slides: FeedPreview[]; start: number;
  poster?: string | null; title: string; href: string; lang: string; onClose: () => void;
}) {
  const [at, setAt] = useState(start);
  const go = (n: number) => setAt(Math.max(0, Math.min(slides.length - 1, n)));
  const current = slides[at];
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    /* Sound is the point, but a phone may still refuse to start a video that asks for it. If it
       does, fall back to muted rather than showing a frozen frame — a silent video is a far
       smaller failure than a video that never plays. */
    const el = ref.current;
    if (el) void el.play().catch(() => { el.muted = true; void el.play().catch(() => undefined); });
    return () => { document.body.style.overflow = before; window.removeEventListener("keydown", key); };
  }, [onClose, at]);

  return (
    <div className="fixed inset-0 z-[2000] bg-black" role="dialog" aria-modal="true" aria-label={title}>
      {/* `key` on the media is what makes moving between slides actually swap the file — without
          it React reuses the same element and a browser will happily keep playing the old one. */}
      {current?.kind === "video"
        ? <video key={current.url} ref={ref} src={current.url} poster={poster ?? undefined}
            controls playsInline loop className="h-full w-full object-contain" />
        : <img key={current?.url} decoding="async" src={current?.url} alt=""
            className="h-full w-full object-contain" />}

      {/* ⚠️ THE TOP BAR IS NEARLY EMPTY ON PURPOSE. Lee, 16 Sep 2026: *"You don't need the back
          button at the top, it's unnecessary. And the name of the listing with the dot dot dot —
          you don't need any of that. You can have the X at the top right. Why have a back button
          at the top AND a back button at the bottom? Think about it."*

          Two controls that do the same thing teach people that neither is the real one. Back
          lives at the bottom with its partner, where the thumb is. The X stays only as the
          reflex people already have for a full-screen thing, and a truncated title over somebody
          else's video was never information — they just tapped it, they know what it is. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
      <button type="button" onClick={onClose}
        className="ow-tap absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white"
        aria-label={W(lang, "Close", "Cerrar")}><X className="h-5 w-5" /></button>

      {/* ⚠️ ARROWS THAT TEACH THE GESTURE. Lee: *"in the middle, right and left, horizontally,
          you're gonna have a little subtle little arrow so people know that, oh, okay, I can
          swipe my finger and I can get to the next video, next picture."*

          They are deliberately quiet — half-transparent, no background plate — because their job
          is to say "there is more this way", not to compete with the picture. They are real
          buttons too, so the arrow is not a lie to anyone who taps it instead of swiping.
          Neither appears when there is nowhere to go in that direction; an arrow that does
          nothing is the thing that makes people stop trusting arrows. */}
      {at > 0 && (
        <button type="button" onClick={() => go(at - 1)}
          className="ow-tap absolute left-1 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center text-white/70"
          aria-label={W(lang, "Previous", "Anterior")}><ChevronLeft className="h-9 w-9" /></button>
      )}
      {at < slides.length - 1 && (
        <button type="button" onClick={() => go(at + 1)}
          className="ow-tap absolute right-1 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center text-white/70"
          aria-label={W(lang, "Next", "Siguiente")}><ChevronRight className="h-9 w-9" /></button>
      )}

      {/* ⚠️ TWO WAYS OUT, SIDE BY SIDE, WHERE A THUMB ALREADY IS. Lee, 16 Sep 2026: *"Kind of
          like how Tinder might have swipe left, swipe right at the bottom. Back is on the left
          side bottom, and see listing is on the right side."*

          The shape follows the meaning. BACK is on the left because that is where back lives on
          every screen anybody has ever used, and it is the quiet one — outlined, see-through,
          the choice that changes nothing. VIEW LISTING is on the right and is filled white,
          because it is the one thing this screen exists to lead to.

          ⚠️ They are translucent ON PURPOSE and it is not decoration: a solid slab across the
          bottom of a video hides the bottom of the video, which on a walkthrough is the floor.
          You can still see through these, and the dark gradient behind them is what keeps the
          labels readable over a bright frame.

          ⚠️ They sit above the safe-area inset. On a phone with a home bar, a button flush to
          the bottom edge is a button the operating system swallows half of. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        <button type="button" onClick={onClose}
          className="ow-tap flex h-14 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/45 bg-white/15 text-[15px] font-black text-white backdrop-blur-[6px]">
          <ChevronLeft className="h-5 w-5" />{W(lang, "Back", "Atrás")}
        </button>
        <Link to={href}
          className="ow-tap flex h-14 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/90 text-[15px] font-black text-ink backdrop-blur-[6px]">
          {W(lang, "View listing", "Ver anuncio")}<ChevronRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
