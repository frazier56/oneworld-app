import { useRef, useState, type ReactNode } from "react";

/**
 * PINCH TO ZOOM — for the one screen where the photograph is the decision.
 * ============================================================================================
 * Lee's backlog item: pinch-to-zoom on listing photographs. Somebody deciding whether to live
 * somewhere wants to look at the grout, the window frame, what is actually outside the glass.
 * Every property app on earth lets them, and the lightbox opened at a fixed size.
 *
 * ── WHY THIS IS A COMPONENT AND NOT A FEW LINES IN THE GALLERY ──────────────────────────────
 * The gallery is a horizontal snap-scroll carousel. A zoomed photograph needs to PAN, and panning
 * left inside a carousel that also scrolls left is two controls fighting over one gesture. Every
 * naive version of this ends with the reader unable to look at the left edge of a photograph
 * because the carousel keeps stealing the drag.
 *
 * Keeping the zoom in its own component means the carousel can be told, precisely, "a photograph
 * is zoomed — stop listening" via `onZoomChange`, and told again the moment it returns to fit.
 * That handshake is the entire difficulty of this feature, so it is the thing the component is
 * built around.
 *
 * ── WHAT IT SUPPORTS ────────────────────────────────────────────────────────────────────────
 *   · two-finger pinch, tracking the distance between the fingers;
 *   · double-tap to zoom to 2.5× at the point tapped, and double-tap again to return to fit;
 *   · one-finger pan, but ONLY while zoomed — otherwise the swipe belongs to the carousel;
 *   · a hard snap back to exactly 1 when the pinch ends below the threshold, so a photograph can
 *     never be left at 1.02× with the carousel disabled and no way to tell why.
 *
 * ⚠️ PANNING IS CLAMPED TO THE IMAGE. Without a clamp you can throw a photograph off the screen
 * and be left looking at black with no way back except closing the lightbox. The offset is capped
 * at the amount of overflow the current scale actually produces, in both axes.
 *
 * ⚠️ AND IT NEVER STEALS THE FIRST TOUCH. At scale 1 the component sets no `touch-action` and
 * captures no pointer, so the carousel behaves exactly as it does today. It only takes over once
 * there is something to pan. That ordering matters: a gallery that feels different to swipe would
 * be a worse product even with zoom in it.
 */
export default function PinchZoom({
  children, max = 4, onZoomChange,
}: {
  children: ReactNode;
  /** Ceiling on magnification. Past about 4× a phone photograph is showing its own pixels. */
  max?: number;
  /** Fires only when the zoomed/not-zoomed state FLIPS, so the carousel is not re-rendered on
   *  every frame of a pinch. */
  onZoomChange?: (zoomed: boolean) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  /* Live gesture state. Refs, not state: these change every frame and re-rendering on each one
     would drop the frame rate on exactly the interaction that has to feel smooth. */
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const startDist = useRef(0);
  const startScale = useRef(1);
  const startPan = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const lastTap = useRef(0);
  const wasZoomed = useRef(false);

  const announce = (s: number) => {
    const z = s > 1.01;
    if (z !== wasZoomed.current) { wasZoomed.current = z; onZoomChange?.(z); }
  };

  /** Never let the picture be dragged off the screen — see the note above. */
  const clamp = (s: number, x: number, y: number) => {
    const el = box.current;
    if (!el) return { x: 0, y: 0 };
    const w = el.clientWidth, h = el.clientHeight;
    const maxX = Math.max(0, (w * s - w) / 2);
    const maxY = Math.max(0, (h * s - h) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const apply = (s: number, x: number, y: number) => {
    const next = Math.max(1, Math.min(max, s));
    /* Below the threshold there is nothing to pan, so the offset is zeroed rather than left at
       some small residue that would show as a photograph sitting slightly off-centre. */
    const c = next <= 1.01 ? { x: 0, y: 0 } : clamp(next, x, y);
    setScale(next); setTx(c.x); setTy(c.y);
    announce(next);
  };

  const dist = () => {
    const [a, b] = [...pts.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const down = (e: React.PointerEvent) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.current.size === 2) {
      startDist.current = dist();
      startScale.current = scale;
      return;
    }

    /* Double tap. 300ms is the usual window; below about 250 a real double tap gets missed. */
    const now = e.timeStamp;
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (scale > 1.01) apply(1, 0, 0);
      else {
        const el = box.current;
        if (el) {
          const r = el.getBoundingClientRect();
          /* Zoom toward the point that was tapped, not the middle — tapping a window and being
             shown the ceiling is the classic version of this done wrong. */
          const s = 2.5;
          apply(s, (r.width / 2 - (e.clientX - r.left)) * (s - 1), (r.height / 2 - (e.clientY - r.top)) * (s - 1));
        }
      }
      return;
    }
    lastTap.current = now;

    if (scale > 1.01) {
      startPan.current = { x: e.clientX, y: e.clientY, tx, ty };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const move = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.current.size === 2 && startDist.current > 0) {
      e.preventDefault();
      apply(startScale.current * (dist() / startDist.current), tx, ty);
      return;
    }
    if (pts.current.size === 1 && scale > 1.01) {
      e.preventDefault();
      apply(scale,
        startPan.current.tx + (e.clientX - startPan.current.x),
        startPan.current.ty + (e.clientY - startPan.current.y));
    }
  };

  const up = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) startDist.current = 0;
    /* Snap to exactly 1 rather than leaving 1.004 behind. See the note at the top: a photograph
       that looks unzoomed while the carousel is still disabled has no visible explanation. */
    if (scale <= 1.01 && scale !== 1) apply(1, 0, 0);
  };

  return (
    <div
      ref={box}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      /* ⚠️ `touch-action` is set ONLY while zoomed. At fit, the browser's own gestures and the
         carousel's scrolling are untouched, so the gallery swipes exactly as it does today. */
      style={{
        touchAction: scale > 1.01 ? "none" : undefined,
        transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
        transformOrigin: "center center",
        transition: pts.current.size === 0 ? "transform .18s ease-out" : "none",
      }}
      className="grid h-full w-full place-items-center">
      {children}
    </div>
  );
}
