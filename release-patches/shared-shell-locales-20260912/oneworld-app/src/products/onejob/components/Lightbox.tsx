import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MediaEngagement from "./MediaEngagement";
import { fmtDateTimeShort } from "@job/lib/datetime";

export type LightboxItem = {
  url: string; type?: string | null; caption?: string | null;
  /** media_posts.id — present when this item is a real post, which is what makes it likeable. */
  postId?: string | null;
  /** Deep link for sharing; defaults to the current page. */
  shareUrl?: string | null;
  /**
   * When the post went up, and when it was last edited if it ever was. Shown to everyone, not just
   * the owner: on a credibility platform "posted three months ago" and "posted three months ago,
   * edited yesterday" are different claims about someone's work. (Lee, Jul 31 2026)
   */
  createdAt?: string | null;
  updatedAt?: string | null;
};

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
    // Hides the header + tab strip while a photo is full-screen — see `.oj-immersive`.
    document.body.classList.add("oj-immersive");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.classList.remove("oj-immersive");
    };
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
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-brand" : "w-1.5 bg-white/30"}`} />
            ))}
          </div>
        </>
      )}

      {/* Caption, then like · comment · share. Before this, a photo opened full-screen and
          offered the viewer nothing to do with it. (Lee, repeatedly — 31 Jul 2026.) */}
      <div className="px-5 pb-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
           onClick={e => e.stopPropagation()}>
        {items[idx]?.caption && (
          <p className="mb-1 text-center text-sm leading-relaxed text-white/85">{items[idx].caption}</p>
        )}
        {items[idx]?.createdAt && (
          <p className="mb-1.5 text-center text-[11px] text-white/50">
            {fmtDateTimeShort(items[idx].createdAt)}
            {items[idx].updatedAt && items[idx].updatedAt !== items[idx].createdAt
              ? ` · edited ${fmtDateTimeShort(items[idx].updatedAt)}`
              : ""}
          </p>
        )}
        {items[idx]?.postId && (
          <div className="flex justify-center">
            <MediaEngagement postId={items[idx].postId!} shareUrl={items[idx].shareUrl ?? undefined} onDark />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
