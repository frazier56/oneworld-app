import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@evt/lib/i18n";

/** Premium photo adjust widget (Lee, Jul 16): drag to reposition, slider/pinch
 *  to zoom, live round preview. Exports a square JPEG blob (640px) so avatars
 *  always fit their box. Used by onboarding + profile photo change. */
export default function PhotoCropModal({ file, onDone, onCancel }:
  { file: File; onDone: (blob: Blob) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const BOX = 288;                       // on-screen crop box (px)
  const EXPORT = 640;                    // exported square (px)
  const [url] = useState(() => URL.createObjectURL(file));
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);   // 1 = cover fit
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const base = dim ? Math.max(BOX / dim.w, BOX / dim.h) : 1;
  const s = base * zoom;
  const clamp = (x: number, y: number, sc = s) => {
    if (!dim) return { x, y };
    const w = dim.w * sc, h = dim.h * sc;
    return { x: Math.min(0, Math.max(BOX - w, x)), y: Math.min(0, Math.max(BOX - h, y)) };
  };

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const im = e.currentTarget;
    imgRef.current = im;
    const d = { w: im.naturalWidth, h: im.naturalHeight };
    setDim(d);
    const b = Math.max(BOX / d.w, BOX / d.h);
    setOff({ x: (BOX - d.w * b) / 2, y: (BOX - d.h * b) / 2 }); // center
  };

  const setZoomAround = (z: number) => {
    // keep the crop-box center stable while zooming
    if (!dim) return setZoom(z);
    const zc = Math.min(4, Math.max(1, z));
    const sOld = base * zoom, sNew = base * zc;
    const cx = (BOX / 2 - off.x) / sOld, cy = (BOX / 2 - off.y) / sOld;
    const nx = BOX / 2 - cx * sNew, ny = BOX / 2 - cy * sNew;
    setZoom(zc); setOff(clamp(nx, ny, sNew));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOff(clamp(drag.current.ox + (e.clientX - drag.current.px), drag.current.oy + (e.clientY - drag.current.py)));
  };
  const onPointerUp = () => { drag.current = null; };
  const onWheel = (e: React.WheelEvent) => setZoomAround(zoom * (e.deltaY < 0 ? 1.08 : 0.93));
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (!pinch.current) pinch.current = { d, z: zoom };
      else setZoomAround(pinch.current.z * (d / pinch.current.d));
    }
  };
  const onTouchEnd = () => { pinch.current = null; };

  const save = async () => {
    const im = imgRef.current;
    if (!im || !dim) return;
    setBusy(true);
    const c = document.createElement("canvas");
    c.width = EXPORT; c.height = EXPORT;
    const ctx = c.getContext("2d")!;
    const r = EXPORT / BOX;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(im, off.x * r, off.y * r, dim.w * s * r, dim.h * s * r);
    c.toBlob(b => { if (b) onDone(b); setBusy(false); }, "image/jpeg", 0.9);
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="glass-modal w-full max-w-sm rounded-3xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{t("cropTitle")}</h2>
          <button onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 text-lg dark:border-white/15" aria-label="Close">×</button>
        </div>

        <div className="mx-auto touch-none overflow-hidden rounded-2xl bg-black/80 select-none"
          style={{ width: BOX, height: BOX, cursor: "grab" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onWheel={onWheel} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <img src={url} onLoad={onLoad} draggable={false} alt=""
            style={{ transform: `translate(${off.x}px, ${off.y}px)`, width: dim ? dim.w * s : "auto", height: dim ? dim.h * s : "auto", maxWidth: "none" }} />
          {/* round guide overlay */}
          <div className="pointer-events-none relative" style={{ marginTop: -BOX, width: BOX, height: BOX }}>
            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/30" />
            <div className="absolute inset-4 rounded-full border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" style={{ borderRadius: "9999px" }} />
          </div>
        </div>

        <p className="mt-2 text-center text-xs opacity-60">{t("cropHint")}</p>

        <div className="mt-3 flex items-center gap-3 px-1">
          <span className="text-sm opacity-60">−</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom}
            onChange={e => setZoomAround(parseFloat(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink/15 accent-teal dark:bg-white/20" />
          <span className="text-lg opacity-60">+</span>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="btn-ghost flex-1 !py-2.5">{t("later")}</button>
          <button onClick={save} disabled={busy || !dim} className="btn-primary flex-1 !py-2.5">{busy ? "…" : t("cropSave")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
