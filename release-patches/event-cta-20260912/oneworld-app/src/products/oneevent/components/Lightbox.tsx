import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type LightboxItem = { url: string; type?: string | null; caption?: string | null };

/** Full-screen swipeable media viewer (Instagram-style).
 *  Horizontal scroll-snap = native swipe on touch; arrows on desktop. */
export default function Lightbox({ items, start = 0, onClose }: { items: LightboxItem[]; start?: number; onClose: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(start);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // jump to the tapped item without animation
    el.scrollTo({ left: start * el.clientWidth });
    const onScroll = () => setIdx(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [idx]);

  const go = (d: number) => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.min(items.length - 1, Math.max(0, idx + d));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  const isVideo = (it: LightboxItem) => /video/i.test(it.type || "") || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(it.url);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between px-4 pt-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <span className="text-sm font-semibold text-white/70">{items.length > 1 ? `${idx + 1} / ${items.length}` : ""}</span>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xl text-white" aria-label="Close">×</button>
      </div>

      <div ref={scroller} onClick={e => e.stopPropagation()}
        className="scrollbar-none flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {items.map((it, i) => (
          <div key={i} className="flex h-full w-full shrink-0 snap-center items-center justify-center p-2">
            {isVideo(it)
              ? <video src={it.url} className="max-h-full max-w-full rounded-lg" controls playsInline autoPlay={i === idx} muted={i !== idx} />
              : <img src={it.url} className="max-h-full max-w-full rounded-lg object-contain" alt="" />}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          {/* desktop arrows */}
          {idx > 0 && (
            <button onClick={e => { e.stopPropagation(); go(-1); }} aria-label="Previous"
              className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white sm:grid">‹</button>
          )}
          {idx < items.length - 1 && (
            <button onClick={e => { e.stopPropagation(); go(1); }} aria-label="Next"
              className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white sm:grid">›</button>
          )}
          <div className="flex justify-center gap-1.5 pb-2">
            {items.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-teal" : "w-1.5 bg-white/30"}`} />
            ))}
          </div>
        </>
      )}

      {items[idx]?.caption && (
        <p className="px-5 pb-4 text-center text-sm leading-relaxed text-white/85" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          onClick={e => e.stopPropagation()}>
          {items[idx].caption}
        </p>
      )}
    </div>,
    document.body
  );
}
