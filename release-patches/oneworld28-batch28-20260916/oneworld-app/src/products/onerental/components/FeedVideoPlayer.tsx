import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { W } from "@oneworld/shell";

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
export default function FeedVideoPlayer({ url, poster, title, href, lang, onClose }: {
  url: string; poster?: string | null; title: string; href: string; lang: string; onClose: () => void;
}) {
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
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000] bg-black" role="dialog" aria-modal="true" aria-label={title}>
      <video ref={ref} src={url} poster={poster ?? undefined} controls playsInline loop
        className="h-full w-full object-contain" />

      {/* Top: where you are, and the way out that changes nothing. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3 text-white">
        <button type="button" onClick={onClose}
          className="ow-tap flex h-11 items-center gap-1 rounded-full bg-black/55 pl-2 pr-4 text-sm font-bold"
          aria-label={W(lang, "Back to the feed", "Volver al inicio")}>
          <ChevronLeft className="h-5 w-5" />{W(lang, "Back", "Atrás")}
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-black">{title}</p>
        <button type="button" onClick={onClose}
          className="ow-tap grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/55"
          aria-label={W(lang, "Close", "Cerrar")}><X className="h-5 w-5" /></button>
      </div>

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
