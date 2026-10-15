import { useEffect } from "react";
import { IconX } from "./ActionIcons";
import { useModalFocus } from "../lib/useModalFocus";
import { W } from "../lib/i18n";

/**
 * ONE PHOTOGRAPH, FULL SCREEN. (Lee, 12 October 2026)
 * ============================================================================================
 * *"It's so tiny you can't see it, but everyone should be able to just tap that photo and it
 * enlarges to full screen… and it should have like an X at the top right hand corner."*
 *
 * A profile picture is drawn at 80 pixels in two different screens — your own profile and
 * anybody else's. That is an identifier, not a photograph: at that size you cannot tell who is
 * in it, and the person who chose it has no way to check what everyone else is actually seeing.
 *
 * This is a deliberately SMALL component and not a second Gallery. `Gallery`'s viewer is the
 * right machinery for a listing — many photographs, videos, counters, dots, swipe — and every
 * one of those parts is a liability for a single picture. It is also private to Gallery, so
 * reaching for it would have meant exporting internals that OneHome's listing pages depend on.
 *
 * What it borrows instead are the three rules that viewer paid for:
 *   · `useModalFocus` — Escape closes it and the focus ring stays inside, so a keyboard or a
 *     screen reader cannot wander behind the overlay into a page that is not really there.
 *   · THE PAGE BEHIND MUST NOT SCROLL. On iOS this is the difference between closing the viewer
 *     and finding your place, and closing it to find the profile scrolled somewhere else.
 *   · The backdrop itself closes. The X is the one people look for and the one Lee asked for by
 *     name; tapping anywhere outside the picture is the one everybody tries first.
 */
export default function PhotoLightbox({ src, alt, lang, onClose }: {
  src: string;
  alt?: string;
  lang: string;
  onClose: () => void;
}) {
  const dialog = useModalFocus(true, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={alt || W(lang, "Photo", "Foto")}
      onClick={onClose}
      className="fixed inset-0 z-[95] grid place-items-center bg-black/95 p-4 backdrop-blur-sm outline-none"
    >
      {/* Above the picture in the stacking order and clear of a notch, because a close button
          you cannot reach is the reason people force-quit an app. */}
      <button
        type="button"
        onClick={onClose}
        aria-label={W(lang, "Close", "Cerrar")}
        className="absolute right-3 z-[1] grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <IconX size={20} />
      </button>

      {/* `contain`, never `cover`: this exists so the whole picture can be seen, and a crop here
          would defeat the entire point. The click guard stops a tap ON the photo closing it —
          people pinch and drag the image itself. */}
      <img
        src={src}
        alt={alt || ""}
        onClick={e => e.stopPropagation()}
        className="max-h-full max-w-full rounded-xl object-contain"
      />
    </div>
  );
}
