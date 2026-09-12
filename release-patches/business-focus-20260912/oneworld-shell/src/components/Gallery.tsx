import { useCallback, useEffect, useRef, useState } from "react";
import PinchZoom from "./PinchZoom";
import { W } from "../lib/i18n";

/**
 * THE GALLERY — how somebody actually looks at forty photographs of a home.
 * ============================================================================================
 * Lee, 11 Aug 2026, and this is nearly a spec on its own:
 *
 *   "Their pictures should be pretty much in a very nice swipeable fashion. When they touch it,
 *    they could just swipe through the pictures, or they should be able to just click it and see a
 *    whole list of pictures. The users have the option to say, how do I wanna see these pictures?
 *    I wanna see a bunch of them on the screen and then click it. Or once I tap one picture, I
 *    wanna be able to swipe through them and look at them that way… or collapse it back down to
 *    just one picture. Sometimes they might wanna see four on the screen at one time. Sometimes
 *    they may wanna see eight. So give the users the options that make sense to see and swipe
 *    through twenty, thirty or forty pictures."
 *
 * ── THE THREE STATES, AND WHY IT IS THREE AND NOT A SETTING ─────────────────────────────────
 *   COVER    one photograph, full width. What the screen opens as, and what "collapse it back
 *            down to just one picture" means. Cheapest to load and the only state that does not
 *            ask the reader to make a decision before they have seen anything.
 *   GRID     all of them at once, at a density the reader picks — 2, 3 or 4 across, which is the
 *            "four on the screen" and "eight on the screen" he described on a phone.
 *   VIEWER   fullscreen, one at a time, swipe or arrow keys. Reached by tapping any photograph in
 *            either of the other two states, opening ON the one that was tapped.
 *
 * A saved preference was deliberately not built. The right density depends on what you are doing
 * right now — scanning forty shots of six apartments, or studying the kitchen in one — not on who
 * you are. A remembered setting would be wrong about half the time and invisible when it was.
 *
 * ── WHY THE VIEWER IS A REAL SCROLLER AND NOT AN INDEX + TRANSFORM ──────────────────────────
 * The obvious implementation animates `translateX` off a current index. It also reimplements
 * momentum, rubber-banding, and the way a half-swipe settles — badly, on every platform. This
 * uses `scroll-snap` over the real photographs, so the browser does all of that natively, at 120Hz,
 * with the platform's own physics. The index is DERIVED from scroll position rather than driving
 * it, which is the only version where a fast flick through forty photos never fights the finger.
 *
 * ── ENGAGEMENT IS ON THE LISTING, NOT ON THE PHOTOGRAPH ─────────────────────────────────────
 * Lee: *"they gonna share the entire set."* Like, comment and share are passed in and act on the
 * listing as one object. A like per photograph would mean a property with 50 photos has 50 like
 * counts and none of them is "how many people liked this place", which is the number that matters.
 */

export type GalleryMode = "cover" | "grid";

export default function Gallery({
  photos, lang, alt = "", footer, onOpenChange,
}: {
  photos: string[];
  lang: string;
  alt?: string;
  /** The listing's like / comment / share row. Rendered under the gallery in every state. */
  footer?: React.ReactNode;
  /** Told when the fullscreen viewer opens or closes, so a screen can hide its own chrome. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<GalleryMode>("cover");
  /* Which photo the cover strip is showing. Derived from scroll position on every scroll, so the
     counter, the dots and the viewer's start index can never disagree with each other. */
  const [coverIdx, setCoverIdx] = useState(0);
  const [cols, setCols] = useState<2 | 3 | 4>(2);
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => { onOpenChange?.(viewer !== null); }, [viewer, onOpenChange]);

  if (photos.length === 0) return null;

  const open = (i: number) => setViewer(i);

  return (
    <div>
      {/* ── THE CONTROL ROW ──────────────────────────────────────────────────────────────────
          Only shown when there is more than one photograph. A view switcher over a single image
          is a control that cannot do anything, which teaches people to ignore controls. */}
      {photos.length > 1 && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold opacity-50">
            {photos.length} {W(lang, "photos", "fotos")}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Density — only meaningful in grid, so it only exists in grid. */}
            {mode === "grid" && (
              <div className="flex overflow-hidden rounded-full border border-ink/12 dark:border-white/15">
                {([2, 3, 4] as const).map(c => (
                  <button key={c} type="button" onClick={() => setCols(c)}
                    aria-label={W(lang, `${c} across`, `${c} por fila`)}
                    aria-pressed={cols === c}
                    className={`ow-tap px-2.5 py-1 text-[11.5px] font-black tabular-nums transition ${
                      cols === c ? "ow-ink-sel" : "opacity-55"}`}>
                    {c}
                  </button>
                ))}
              </div>
            )}

            <button type="button"
              onClick={() => setMode(m => (m === "cover" ? "grid" : "cover"))}
              className="ow-tap flex items-center gap-1.5 rounded-full border border-ink/12 px-3 py-1.5 text-[12px] font-bold dark:border-white/15">
              {mode === "cover" ? (
                <>
                  <GridGlyph /> {W(lang, "See all", "Ver todas")}
                </>
              ) : (
                <>
                  <CoverGlyph /> {W(lang, "Collapse", "Contraer")}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── COVER ───────────────────────────────────────────────────────────────────────────
          Lee, 11 Aug 2026: *"When you're looking at the listing, you should be able to scroll
          sideways… but it doesn't seem to actually work. I have to touch the picture to scroll
          sideways, and that's not what I'm trying to do."*

          He is exactly right and the old code says why: this was ONE `<img>` inside a button. The
          only way to see photo two was to open the fullscreen viewer first, which is the extra tap
          he is describing. The counter said "1 / 12" and there was no way to reach the other
          eleven without leaving the page.

          It is now the same swipeable strip the feed card uses — full-bleed children with
          `scroll-snap`, so a horizontal drag either turns the page or does nothing and never
          strands you between two photographs. `touch-action: pan-x pan-y` keeps the page's own
          vertical scroll working from anywhere on the image.

          TAPPING STILL OPENS THE VIEWER, and it opens at the photo you are looking at rather than
          at the first — opening on photo one after you swiped to photo seven is the small
          betrayal that makes a gallery feel broken. The index is derived from scroll position, so
          it cannot disagree with what is on screen. */}
      {mode === "cover" && (
        <div className="relative overflow-hidden rounded-2xl border border-ink/[0.08] dark:border-white/10">
          <div
            onScroll={e => {
              const el = e.currentTarget;
              const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
              if (n !== coverIdx) setCoverIdx(n);
            }}
            className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
            style={{ touchAction: "pan-x pan-y", scrollbarWidth: "none" }}>
            {photos.map((src, i) => (
              <button key={src} type="button" onClick={() => open(i)}
                className="ow-tap block h-full w-full shrink-0 snap-center">
                <img src={src} alt={i === 0 ? alt : ""} loading={i === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          {photos.length > 1 && (
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-ink/65 px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-white backdrop-blur-sm">
              {coverIdx + 1} / {photos.length}
            </span>
          )}
          {/* Dots, only when there are few enough for a dot to mean something. Past about eight
              they become a grey smear that says less than the counter already does. */}
          {photos.length > 1 && photos.length <= 8 && (
            <span className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <span key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === coverIdx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </span>
          )}
        </div>
      )}

      {/* ── GRID ───────────────────────────────────────────────────────────────────────────── */}
      {mode === "grid" && (
        <div className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {photos.map((src, i) => (
            <button key={i} type="button" onClick={() => open(i)}
              className="ow-tap overflow-hidden rounded-xl border border-ink/[0.08] dark:border-white/10">
              <img src={src} alt="" loading={i < 6 ? "eager" : "lazy"}
                className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {footer && <div className="mt-2.5">{footer}</div>}

      {viewer !== null && (
        <Viewer photos={photos} start={viewer} lang={lang} alt={alt}
          onClose={() => setViewer(null)} footer={footer} />
      )}
    </div>
  );
}

/* ============================================================================================
   THE FULLSCREEN VIEWER
   ============================================================================================ */

function Viewer({
  photos, start, lang, alt, onClose, footer,
}: {
  photos: string[]; start: number; lang: string; alt: string;
  onClose: () => void; footer?: React.ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(start);
  /* ⚠️ v71 · While a photograph is zoomed the carousel must stop scrolling horizontally, or a
     pan to the left and a swipe to the previous photograph are the same gesture and the reader
     can never reach the left edge of the picture. `PinchZoom` flips this only when the state
     changes, so a pinch does not re-render the carousel on every frame. */
  const [zoomed, setZoomed] = useState(false);

  /* Jump to the photograph that was tapped, WITHOUT animating past everything in between.
     `behavior: "instant"` matters at forty photos — a smooth scroll from 0 to 37 is a two-second
     blur that looks like a bug. */
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: start * el.clientWidth, behavior: "instant" as ScrollBehavior });
  }, [start]);

  /* The index is DERIVED from where the scroller actually is — see the note at the top. */
  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setI(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const step = (d: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: Math.min(photos.length - 1, Math.max(0, i + d)) * el.clientWidth, behavior: "smooth" });
  };

  /* A keyboard is not a nice-to-have here: this opens on a laptop too, and a fullscreen overlay
     with no Escape is a trap. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    /* The page behind must not scroll while a fullscreen viewer is open — on iOS that is what
       makes an overlay feel like it is sliding off the screen. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [i, photos.length]);

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label={W(lang, "Photos", "Fotos")}>
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] text-white">
        <span className="text-[13px] font-bold tabular-nums opacity-80">{i + 1} / {photos.length}</span>
        <button type="button" onClick={onClose} aria-label={W(lang, "Close", "Cerrar")}
          className="ow-tap grid h-9 w-9 place-items-center rounded-full bg-white/15 text-[17px] font-bold">×</button>
      </div>

      <div ref={track} onScroll={onScroll}
        className={`scrollbar-none flex flex-1 overscroll-x-contain ${
          zoomed ? "overflow-x-hidden" : "snap-x snap-mandatory overflow-x-auto"}`}>
        {photos.map((src, n) => (
          <div key={n} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-2">
            {/* `object-contain`, never `cover`: this is the screen where somebody is deciding
                whether to live somewhere. Cropping the photograph here would hide the thing they
                opened it to see. */}
            {/* v71 · Pinch, double-tap and pan. At fit it is inert and the swipe is unchanged. */}
            <PinchZoom onZoomChange={setZoomed}>
              <img src={src} alt={n === 0 ? alt : ""} loading={Math.abs(n - i) <= 2 ? "eager" : "lazy"}
                className="max-h-full max-w-full object-contain" />
            </PinchZoom>
          </div>
        ))}
      </div>

      {/* Arrows for a mouse. Hidden on touch, where the swipe IS the control and two floating
          buttons would just cover the photograph. */}
      {photos.length > 1 && (
        <>
          <button type="button" onClick={() => step(-1)} aria-label={W(lang, "Previous", "Anterior")}
            className="ow-tap absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-xl font-bold text-white md:grid">‹</button>
          <button type="button" onClick={() => step(1)} aria-label={W(lang, "Next", "Siguiente")}
            className="ow-tap absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-xl font-bold text-white md:grid">›</button>
        </>
      )}

      {/* The engagement row travels INTO the viewer. Lee wants somebody to be able to like or
          share while they are looking at the photographs, not only after they close them. */}
      {footer && (
        <div className="shrink-0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 text-white [&_button]:text-white">
          {footer}
        </div>
      )}
    </div>
  );
}

const GridGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const CoverGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
  </svg>
);
