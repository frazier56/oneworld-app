import { useEffect, useRef, useState } from "react";
import { useI18n, W } from "../lib/i18n";

/**
 * SignaturePad — a finger or mouse signature, returned as a PNG data URL.
 * ============================================================================================
 * Lee, 29 Sep 2026: *"we can literally sign it with their finger, and then it timestamps it,
 * and then they can save it."* Standard he named: DocuSign.
 *
 * In the shell rather than OneHome because every product that ends in an agreement needs one
 * (OneJob's contracts are next), and a second pad would be the drift this repo keeps paying for.
 *
 * ── DECISIONS, SO NOBODY RE-LITIGATES THEM ────────────────────────────────────────────────
 * · The pad is ALWAYS white with dark ink, in both themes. It is paper. The same image goes into
 *   the PDF, where a light stroke drawn on a dark pad would vanish.
 * · "More room" opens the pad full-screen. A phone held sideways then gives a wide line to sign
 *   on — we cannot rotate the phone for them, but a full-screen pad follows the rotation.
 * · Export is downscaled to at most 900 px wide. A signature does not need more, and the database
 *   refuses anything over 300 KB.
 * · `onChange(null)` on Clear, so a parent can never submit a stale drawing.
 */
export default function SignaturePad({ onChange, height = 160 }: {
  onChange: (png: string | null) => void;
  height?: number;
}) {
  const { lang } = useI18n();
  const [full, setFull] = useState(false);
  /* Only a FULL-SCREEN signature is shown back as an image. The inline pad reports after every
     stroke and stays a pad — swapping it for a picture after the first stroke would cut every
     signature short at its first lift of the finger. */
  const [fullPng, setFullPng] = useState<string | null>(null);
  const [padKey, setPadKey] = useState(0);

  return (
    <div>
      {fullPng && !full ? (
        <div className="relative overflow-hidden rounded-2xl border border-black/15 bg-white" style={{ height }}>
          <img src={fullPng} alt={W(lang, "Your signature", "Su firma")} className="h-full w-full object-contain" />
          <button type="button" onClick={() => { setFullPng(null); setPadKey(k => k + 1); onChange(null); }}
            className="absolute right-2 top-2 rounded-full bg-black/5 px-3 py-1 text-[12px] font-bold text-slate-700">
            {W(lang, "Clear", "Borrar")}
          </button>
        </div>
      ) : (
        <Pad key={padKey} height={height} onDone={onChange} />
      )}
      <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
        <span className="opacity-55">{W(lang, "Sign with your finger", "Firme con el dedo")}</span>
        <button type="button" className="font-bold text-brand underline" onClick={() => setFull(true)}>
          {W(lang, "More room", "Más espacio")}
        </button>
      </div>

      {full && (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-white p-3 text-slate-900" role="dialog" aria-modal="true">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-bold">{W(lang, "Sign here", "Firme aquí")}</span>
            <span className="text-[11.5px] opacity-60">{W(lang, "Turn your phone sideways for more room", "Gire el teléfono para más espacio")}</span>
          </div>
          <div className="flex-1">
            <Pad height="100%" fullscreen onDone={v => { if (v) { setFullPng(v); onChange(v); setFull(false); } }}
              onCancel={() => setFull(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Pad({ height, onDone, onCancel, fullscreen }: {
  height: number | string;
  onDone: (png: string | null) => void;
  onCancel?: () => void;
  fullscreen?: boolean;
}) {
  const { lang } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [inked, setInked] = useState(false);

  /* Size the backing store to the element × devicePixelRatio, so the stroke is sharp on a
     phone. Re-run on resize and rotation; resizing clears, which is the honest thing to do. */
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      const g = c.getContext("2d")!;
      g.scale(dpr, dpr);
      g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 2.4; g.strokeStyle = "#0B0F1A";
      setInked(false);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const pt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true; last.current = pt(e);
    const g = ref.current!.getContext("2d")!;
    g.beginPath(); g.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2); g.fillStyle = "#0B0F1A"; g.fill();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = pt(e); const g = ref.current!.getContext("2d")!;
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke();
    last.current = p;
    if (!inked) setInked(true);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false; last.current = null;
    if (!fullscreen) onDone(exportPng(ref.current!));
  };
  const clear = () => {
    const c = ref.current!; const g = c.getContext("2d")!;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.restore();
    setInked(false); onDone(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-black/15 bg-white"
        style={{ height: fullscreen ? undefined : height, minHeight: fullscreen ? 200 : undefined }}>
        <canvas ref={ref} className="h-full w-full touch-none" style={{ touchAction: "none" }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
          aria-label={W(lang, "Signature pad", "Recuadro de firma")} />
        {/* The line people sign on. Purely visual; not part of the export. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-slate-300" />
        {inked && !fullscreen && (
          <button type="button" onClick={clear}
            className="absolute right-2 top-2 rounded-full bg-black/5 px-3 py-1 text-[12px] font-bold text-slate-700">
            {W(lang, "Clear", "Borrar")}
          </button>
        )}
        {!inked && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-slate-400">
            {W(lang, "Sign here", "Firme aquí")}
          </span>
        )}
      </div>
      {fullscreen && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>{W(lang, "Cancel", "Cancelar")}</button>
          <button type="button" className="btn-ghost" onClick={clear}>{W(lang, "Clear", "Borrar")}</button>
          <button type="button" className="btn-primary" disabled={!inked}
            onClick={() => onDone(exportPng(ref.current!))}>{W(lang, "Done", "Listo")}</button>
        </div>
      )}
    </div>
  );
}

/** At most 900 px wide, white background (PNG transparency renders black in some PDF viewers). */
function exportPng(c: HTMLCanvasElement): string {
  const scale = Math.min(1, 900 / c.width);
  const o = document.createElement("canvas");
  o.width = Math.round(c.width * scale); o.height = Math.round(c.height * scale);
  const g = o.getContext("2d")!;
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, o.width, o.height);
  g.drawImage(c, 0, 0, o.width, o.height);
  return o.toDataURL("image/png");
}
