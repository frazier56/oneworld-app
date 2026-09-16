/**
 * PhotoLightbox — full-screen photo viewer with PINCH-TO-ZOOM.
 * ============================================================================================
 * v14 (Lee, 18 Aug 2026): *"you can't pinch and zoom... that's the point of tapping it, so
 * you can zoom in and scroll around with your finger to see the detail."* And the counter
 * read "1 of 0" — it counted only the gallery, not the cover that was on screen.
 *
 * What this does:
 *  · Pinch (two fingers) zooms 1×–4×, anchored at the pinch midpoint.
 *  · Drag pans while zoomed; a one-finger horizontal swipe at 1× changes photos.
 *  · Double-tap (or double-click) toggles 1× ↔ 2.5× at the tap point; mouse wheel zooms too.
 *  · Tap the backdrop at 1× to close. The counter says n / TOTAL (cover included) and sits
 *    at the TOP so it never collides with the app's bottom bar.
 * Portaled to document.body (the AC-1 lesson): no ancestor stacking context can cover it.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type LightboxMediaItem = string | { url: string; type?: string | null };

const MAX_SCALE = 4;

export default function PhotoLightbox({
  photos, index, onIndex, onClose,
}: {
  photos: LightboxMediaItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [animate, setAnimate] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startDist?: number; startScale?: number; startTx?: number; startTy?: number;
    startMidX?: number; startMidY?: number;
    panStartX?: number; panStartY?: number;
    swipeStartX?: number; swipeStartY?: number; swipeStartT?: number;
    moved?: boolean; lastTap?: number;
  }>({});

  const reset = (withAnim = true) => {
    if (withAnim) { setAnimate(true); setTimeout(() => setAnimate(false), 220); }
    setScale(1); setTx(0); setTy(0);
  };

  // New photo → fresh 1× view.
  useEffect(() => { reset(false); }, [index]);

  // While open, stop the page behind from scrolling under the gesture.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* v17 (UAT BJ): desktop keyboard — Escape closes, arrows navigate (at 1× only, matching
     the swipe rule so arrows never fight a zoomed pan). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (scale !== 1 || photos.length < 2) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); onIndex((index - 1 + photos.length) % photos.length); }
      if (e.key === "ArrowRight") { e.preventDefault(); onIndex((index + 1) % photos.length); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scale, index, photos.length, onClose, onIndex]);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(1, s));

  const zoomAt = (cx: number, cy: number, nextScale: number) => {
    const s0 = scale, s1 = clampScale(nextScale);
    // Keep the point under the cursor/finger stationary: p' = (p - t)/s
    const ox = cx - window.innerWidth / 2, oy = cy - window.innerHeight / 2;
    setTx(ox - ((ox - tx) / s0) * s1);
    setTy(oy - ((oy - ty) / s0) * s1);
    setScale(s1);
    if (s1 === 1) { setTx(0); setTy(0); }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    g.moved = false;
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const [a, b] = pts;
      g.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      g.startScale = scale; g.startTx = tx; g.startTy = ty;
      g.startMidX = (a.x + b.x) / 2; g.startMidY = (a.y + b.y) / 2;
    } else if (pts.length === 1) {
      g.panStartX = e.clientX - tx; g.panStartY = e.clientY - ty;
      g.swipeStartX = e.clientX; g.swipeStartY = e.clientY; g.swipeStartT = Date.now();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && g.startDist) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const next = clampScale((g.startScale || 1) * (dist / g.startDist));
      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
      const ox = midX - window.innerWidth / 2, oy = midY - window.innerHeight / 2;
      const sox = (g.startMidX || midX) - window.innerWidth / 2, soy = (g.startMidY || midY) - window.innerHeight / 2;
      setScale(next);
      setTx(ox - ((sox - (g.startTx || 0)) / (g.startScale || 1)) * next);
      setTy(oy - ((soy - (g.startTy || 0)) / (g.startScale || 1)) * next);
      g.moved = true;
    } else if (pts.length === 1 && scale > 1 && g.panStartX != null) {
      setTx(e.clientX - g.panStartX);
      setTy(e.clientY - (g.panStartY || 0));
      if (Math.hypot(e.clientX - (g.swipeStartX || 0), e.clientY - (g.swipeStartY || 0)) > 6) g.moved = true;
    } else if (pts.length === 1 && Math.hypot(e.clientX - (g.swipeStartX || 0), e.clientY - (g.swipeStartY || 0)) > 6) {
      g.moved = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) { g.startDist = undefined; return; }
    if (scale === 1 && g.swipeStartX != null) {
      const dx = e.clientX - g.swipeStartX;
      const dy = e.clientY - (g.swipeStartY || 0);
      const dt = Date.now() - (g.swipeStartT || 0);
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600 && photos.length > 1) {
        onIndex(dx < 0 ? (index + 1) % photos.length : (index - 1 + photos.length) % photos.length);
        return;
      }
    }
    // Tap (no drag): double-tap toggles zoom; single tap at 1× closes.
    if (!g.moved) {
      const now = Date.now();
      if (g.lastTap && now - g.lastTap < 300) {
        g.lastTap = 0;
        setAnimate(true); setTimeout(() => setAnimate(false), 220);
        if (scale > 1) reset(); else zoomAt(e.clientX, e.clientY, 2.5);
      } else {
        g.lastTap = now;
        if (scale === 1) setTimeout(() => { if (gesture.current.lastTap === now) onClose(); }, 300);
      }
    }
    g.startDist = undefined;
  };

  const onWheel = (e: React.WheelEvent) => {
    zoomAt(e.clientX, e.clientY, scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  };

  const current = photos[index];
  const currentUrl = typeof current === "string" ? current : current?.url || "";
  const currentType = typeof current === "string" ? "" : current?.type || "";
  const currentIsVideo = /video/i.test(currentType) || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(currentUrl || "");

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center overflow-hidden select-none"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      {/* Counter at the TOP (never fights the bottom bar) — counts EVERY photo incl. cover. */}
      <p className="absolute top-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
        {index + 1} / {photos.length}
      </p>
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X size={24} />
      </button>
      {photos.length > 1 && scale === 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + photos.length) % photos.length); }}
          >
            <ChevronLeft size={28} />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % photos.length); }}
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}
      {currentIsVideo ? (
        <video
          src={currentUrl}
          controls
          playsInline
          className="max-w-[92vw] max-h-[86vh] rounded-lg bg-black"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={currentUrl}
          alt={`Media ${index + 1}`}
          draggable={false}
          className="max-w-[92vw] max-h-[86vh] object-contain rounded-lg pointer-events-none"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: animate ? "transform 200ms ease" : "none",
          }}
        />
      )}
    </div>,
    document.body
  );
}
