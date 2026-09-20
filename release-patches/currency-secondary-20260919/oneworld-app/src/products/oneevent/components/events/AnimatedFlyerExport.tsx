/**
 * AnimatedFlyerExport — converts a static AI flyer background + event text
 * into a 6-second animated MP4 (1080×1920 vertical, Instagram Reels/Stories).
 *
 * 100% client-side: Canvas + MediaRecorder. No edge function, no AWS Lambda,
 * no per-render cost. Renders in ~6 seconds (real-time capture).
 *
 * Now renders an inline preview + "Save animated flyer" button instead
 * of a forced download — so hosts can add a video flyer without the
 * download → re-upload dance.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import QRCode from "qrcode";
import { Film, Loader2, Download, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@evt/components/ui/button";

interface AnimatedFlyerExportProps {
  bgUrl: string;
  title: string;
  dateLine: string;
  venue: string;
  shortLink: string;
  fileNamePrefix?: string;
  /** "vertical" = 1080x1920 9:16 flyer (default). "horizontal" = 1920x1080 16:9 background — no text overlays, just cinematic Ken Burns motion. */
  orientation?: "vertical" | "horizontal";
  /** When provided, shows a save button that hands the
   *  rendered Blob + object URL up to the parent. */
  onUseAnimated?: (args: { blob: Blob; objectUrl: string; ext: "mp4" | "webm" }) => void;
  /** Whether the parent is currently saving this animated asset. */
  selected?: boolean;
  actionLabel?: string;
  usedLabel?: string;
  animateLabel?: string;
}

const FPS = 30;
const DURATION_S = 6;
const TOTAL_FRAMES = FPS * DURATION_S;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Ease-out cubic — feels snappy on entrance. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Pick the best supported MP4-ish recorder mime type. */
function pickMimeType(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: Array<{ mime: string; ext: "mp4" | "webm" }> = [
    { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm;codecs=vp8", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return null;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
  return lines.length;
}

export function AnimatedFlyerExport({
  bgUrl,
  title,
  dateLine,
  venue,
  shortLink,
  fileNamePrefix = "flyer",
  orientation = "vertical",
  onUseAnimated,
  selected = false,
  actionLabel,
  usedLabel,
  animateLabel,
}: AnimatedFlyerExportProps) {
  const isHorizontal = orientation === "horizontal";
  const W = isHorizontal ? 1920 : 1080;
  const H = isHorizontal ? 1080 : 1920;
  const aspectStyle = isHorizontal ? "16/9" : "9/16";
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  // Inline preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewExt, setPreviewExt] = useState<"mp4" | "webm">("mp4");
  const cancelRef = useRef(false);

  // Reset inline preview when source background or text changes (so a stale
  // preview doesn't get accepted with old content).
  useEffect(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewBlob(null);
  }, [bgUrl, title, dateLine, venue, shortLink]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const render = useCallback(async (): Promise<{ blob: Blob; ext: "mp4" | "webm" } | null> => {
    const support = pickMimeType();
    if (!support) {
      toast.error(
        "Your browser doesn't support video recording. Try Chrome or Edge.",
      );
      return null;
    }

    setRendering(true);
    setProgress(0);
    cancelRef.current = false;

    try {
      const [bg, qrImg] = await Promise.all([
        loadImage(bgUrl),
        QRCode.toDataURL(shortLink, {
          margin: 1,
          width: 220,
          color: { dark: "#0F172A", light: "#FFFFFF" },
        }).then(loadImage),
      ]);

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas-unsupported");

      const stream = canvas.captureStream(FPS);
      const recorder = new MediaRecorder(stream, {
        mimeType: support.mime,
        videoBitsPerSecond: 8_000_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: support.mime }));
        recorder.onerror = (e) => reject(e);
      });

      recorder.start();

      const frameDurationMs = 1000 / FPS;
      const start = performance.now();

      for (let f = 0; f < TOTAL_FRAMES; f++) {
        if (cancelRef.current) break;
        const t = f / TOTAL_FRAMES;

        const zoom = 1.0 + 0.08 * t;
        const bgRatio = bg.naturalWidth / bg.naturalHeight;
        const targetRatio = W / H;
        let bw: number, bh: number;
        if (bgRatio > targetRatio) {
          bh = H * zoom;
          bw = bh * bgRatio;
        } else {
          bw = W * zoom;
          bh = bw / bgRatio;
        }
        const driftX = Math.sin(t * Math.PI) * 30;
        const driftY = -t * 40;
        ctx.fillStyle = "#08090B";
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(bg, (W - bw) / 2 + driftX, (H - bh) / 2 + driftY, bw, bh);

        if (isHorizontal) {
          // Background mode: subtle vignette only, no text/QR overlays.
          const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
          vg.addColorStop(0, "rgba(0,0,0,0)");
          vg.addColorStop(1, "rgba(0,0,0,0.45)");
          ctx.fillStyle = vg;
          ctx.fillRect(0, 0, W, H);
        } else {
          const grad = ctx.createLinearGradient(0, H * 0.4, 0, H);
          grad.addColorStop(0, "rgba(2,6,23,0)");
          grad.addColorStop(0.55, "rgba(2,6,23,0.6)");
          grad.addColorStop(1, "rgba(2,6,23,0.95)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);

          const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
          topGrad.addColorStop(0, "rgba(2,6,23,0.7)");
          topGrad.addColorStop(1, "rgba(2,6,23,0)");
          ctx.fillStyle = topGrad;
          ctx.fillRect(0, 0, W, 240);

          const brandT = Math.min(1, f / (FPS * 0.4));
          ctx.globalAlpha = easeOutCubic(brandT);
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "700 36px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText("ONEEVENT", 60, 70);
          ctx.globalAlpha = 1;

          const padX = 70;
          const titleStart = FPS * 0.3;
          const titleDur = FPS * 0.7;
          const titleT = Math.min(1, Math.max(0, (f - titleStart) / titleDur));
          const titleEase = easeOutCubic(titleT);
          ctx.globalAlpha = titleEase;
          const titleSlide = (1 - titleEase) * 40;

          ctx.fillStyle = "#FFFFFF";
          ctx.font = "800 92px system-ui, -apple-system, sans-serif";
          ctx.textBaseline = "top";
          const titleY = H - 620 + titleSlide;
          const maxTitleW = W - padX * 2;
          const lineCount = drawWrappedText(
            ctx,
            title,
            padX,
            titleY,
            maxTitleW,
            92 * 1.05,
            3,
          );
          ctx.globalAlpha = 1;

          const dateStart = FPS * 0.7;
          const dateT = Math.min(1, Math.max(0, (f - dateStart) / (FPS * 0.6)));
          const dateEase = easeOutCubic(dateT);
          ctx.globalAlpha = dateEase;
          const dateSlide = (1 - dateEase) * 30;
          ctx.fillStyle = "#2EE6D6";
          ctx.font = "600 40px system-ui, -apple-system, sans-serif";
          const metaY = titleY + lineCount * 92 * 1.05 + 30 + dateSlide;
          if (dateLine) ctx.fillText(dateLine, padX, metaY);

          const venueStart = FPS * 0.9;
          const venueT = Math.min(1, Math.max(0, (f - venueStart) / (FPS * 0.6)));
          const venueEase = easeOutCubic(venueT);
          ctx.globalAlpha = venueEase;
          if (venue) {
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.font = "500 34px system-ui, -apple-system, sans-serif";
            ctx.fillText(venue, padX, metaY + 60);
          }
          ctx.globalAlpha = 1;

          // QR card — fixed size, fixed position, fade-in only.
          const qrStart = FPS * 1.1;
          const qrT = Math.min(1, Math.max(0, (f - qrStart) / (FPS * 0.5)));
          const qrEase = easeOutCubic(qrT);
          ctx.globalAlpha = qrEase;
          const qrSize = 220;
          const qrPad = 70;
          const qrX = Math.round(W - qrSize - qrPad);
          const qrY = Math.round(H - qrSize - qrPad - 40);
          const cardR = 22;
          const cardPad = 18;
          const cw = qrSize + cardPad * 2;
          const ch = qrSize + cardPad * 2;
          const cx = qrX - cardPad;
          const cy = qrY - cardPad;
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(cx + cardR, cy);
          ctx.arcTo(cx + cw, cy, cx + cw, cy + ch, cardR);
          ctx.arcTo(cx + cw, cy + ch, cx, cy + ch, cardR);
          ctx.arcTo(cx, cy + ch, cx, cy, cardR);
          ctx.arcTo(cx, cy, cx + cw, cy, cardR);
          ctx.closePath();
          ctx.fill();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
          ctx.imageSmoothingEnabled = true;

          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.font = "600 24px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "right";
          ctx.fillText("Scan to RSVP", W - qrPad, qrY - 38);
          ctx.textAlign = "left";
          ctx.globalAlpha = 1;
        }

        setProgress(Math.round((f / TOTAL_FRAMES) * 100));

        const targetTime = start + (f + 1) * frameDurationMs;
        const wait = targetTime - performance.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }

      recorder.stop();
      const blob = await recordingDone;
      return { blob, ext: support.ext };
    } catch (err) {
      console.error("animated flyer render error:", err);
      toast.error("Could not render animated flyer.");
      return null;
    } finally {
      setRendering(false);
      setProgress(0);
    }
  }, [bgUrl, title, dateLine, venue, shortLink, isHorizontal, W, H]);

  const handlePreview = useCallback(async () => {
    const result = await render();
    if (!result) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(result.blob);
    setPreviewUrl(url);
    setPreviewBlob(result.blob);
    setPreviewExt(result.ext);
    if (result.ext === "webm") {
      toast.success("Animated preview ready (WebM fallback).");
    } else {
      toast.success("Animated preview ready.");
    }
  }, [render, previewUrl]);

  const handleDownload = useCallback(() => {
    if (!previewBlob || !previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `${fileNamePrefix}-animated-${Date.now()}.${previewExt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [previewBlob, previewUrl, previewExt, fileNamePrefix]);

  const handleUse = useCallback(() => {
    if (!previewBlob || !previewUrl || !onUseAnimated) return;
    onUseAnimated({ blob: previewBlob, objectUrl: previewUrl, ext: previewExt });
  }, [previewBlob, previewUrl, previewExt, onUseAnimated]);

  // Generate button (no preview yet)
  if (!previewUrl) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full h-8 text-xs gap-1.5"
        onClick={handlePreview}
        disabled={rendering}
      >
        {rendering ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Animating {progress}%
          </>
        ) : (
          <>
            <Film className="w-3.5 h-3.5" />
            {animateLabel || "Animate flyer"}
          </>
        )}
      </Button>
    );
  }

  // Inline preview + Use / Download / Re-render controls
  return (
    <div className="space-y-2">
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-black/40" style={{ aspectRatio: aspectStyle }}>
        <video
          src={previewUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        {selected && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-primary/95 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
            <Check className="w-3 h-3" /> In use
          </div>
        )}
      </div>
      {onUseAnimated && (
        <Button
          type="button"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={handleUse}
          disabled={selected}
        >
          <Check className="w-3.5 h-3.5" />
          {selected ? (usedLabel || "Saved") : (actionLabel || "Save animated flyer")}
        </Button>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 h-7 text-[11px] gap-1"
          onClick={handlePreview}
          disabled={rendering}
        >
          <RefreshCw className="w-3 h-3" />
          Re-render
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="flex-1 h-7 text-[11px] gap-1"
          onClick={handleDownload}
        >
          <Download className="w-3 h-3" />
          Download
        </Button>
      </div>
    </div>
  );
}
