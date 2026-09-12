/**
 * AiFlyerStudio — AI Flyer Studio.
 *
 * Generates 3 distinct flyer or event-cover options based purely on the
 * event's TITLE + DESCRIPTION. Flyer mode creates a vertical share asset for
 * media attachments; cover mode creates a square event cover image.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";
import { Sparkles, Loader2, Check, RefreshCw, X, Pencil, Wand2, Download, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@evt/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@evt/components/ui/dialog";
import { Button } from "@evt/components/ui/button";
import { Input } from "@evt/components/ui/input";
import { Label } from "@evt/components/ui/label";
import { Textarea } from "@evt/components/ui/textarea";
import type { CoverAspectRatio } from "@evt/lib/imageAspect";
import { AnimatedFlyerExport } from "./AnimatedFlyerExport";
import { stripRichTextHtml } from "@evt/components/ui/rich-text-editor";
import { buildCleanEventLink, buildEventVanityLink, buildTrackedEventLink } from "@evt/lib/eventShortLinks";
import { useAuth } from "@evt/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { normalizePlan } from "@evt/lib/plans";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, vip: 2 };

type Variant = "v1" | "v2" | "v3";
type StudioMode = "flyer" | "background";
const ALL_VARIANTS: Variant[] = ["v1", "v2", "v3"];

interface AiFlyerStudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: StudioMode;
  eventId?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  eventType?: string | null;
  venueName?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  hostName?: string | null;
  /** Pre-formatted flyer detail lines (tickets, what's included) so the flyer
   *  advertises the full event, not just the title. (Lee, Jul 23) */
  ticketsLine?: string | null;
  includedLine?: string | null;
  /** Vanity slug for the event (e.g. "ExecutionRoom"). When set, the flyer QR
   *  and footer URL use https://onesocial.ai/events/<slug> instead of the
   *  obfuscated short-id link. */
  slug?: string | null;
  onAccept: (args: {
    fileUrl: string;
    file: File;
    aspectRatio: CoverAspectRatio;
    flyerFile?: File;
    flyerUrl?: string;
  }) => void;
  onAcceptVideo?: (args: {
    fileUrl: string;
    file: File;
    posterFile: File;
    aspectRatio: CoverAspectRatio;
    ext: "mp4" | "webm";
  }) => void;
}

interface FlyerResult {
  variant: Variant;
  label: string;
  url: string | null;
  error?: string;
}

const VARIANT_LABEL: Record<Variant, string> = {
  v1: "Option 1",
  v2: "Option 2",
  v3: "Option 3",
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function formatDateLine(date?: string | null, time?: string | null): string {
  if (!date) return "";
  try {
    const d = new Date(date + (time ? `T${time}` : "T00:00:00"));
    const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    if (time) {
      const t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `${day} • ${t}`;
    }
    return day;
  } catch {
    return "";
  }
}

/** Diagonal SAMPLE watermark + ribbon, drawn over a locked (un-upgraded) preview
 *  so the tease can't just be screenshotted and used. (Lee, Jul 23) */
function drawSampleWatermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 ${Math.round(W * 0.085)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 6);
  const step = Math.round(H * 0.2);
  for (let y = -H; y <= H; y += step) ctx.fillText("SAMPLE    SAMPLE", 0, y);
  ctx.restore();
  // Center ribbon
  ctx.save();
  const bh = Math.round(H * 0.06);
  const by = Math.round(H * 0.5 - bh / 2);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#0B0F1A";
  ctx.fillRect(0, by, W, bh);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#2EE6D6";
  ctx.font = `800 ${Math.round(bh * 0.46)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SAMPLE · UPGRADE TO SAVE", W / 2, by + bh / 2);
  ctx.restore();
}

/** Composite text + QR onto the AI background. Output is 1080×1350 PNG (4:5).
 *  Polished typography: hero title with letter-spacing, accent rule, tidy meta block,
 *  branded QR card (logo + URL stacked) anchored bottom-right with safe gutters.
 */
async function composeFinalFlyer(
  bgUrl: string,
  title: string,
  dateLine: string,
  venue: string,
  shortLink: string,
  meta: { category?: string | null; eventType?: string | null; description?: string | null; hostName?: string | null; ticketsLine?: string | null; includedLine?: string | null } = {},
  watermark = false,
): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unsupported");

  // ---------- Background (cover-fit, centered) ----------
  const bg = await loadImage(bgUrl);
  const bgRatio = bg.naturalWidth / bg.naturalHeight;
  const targetRatio = W / H;
  let bw: number, bh: number;
  if (bgRatio > targetRatio) { bh = H; bw = bh * bgRatio; }
  else { bw = W; bh = bw / bgRatio; }
  ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);

  // ---------- Bottom darken gradient for legibility ----------
  const grad = ctx.createLinearGradient(0, H * 0.38, 0, H);
  grad.addColorStop(0, "rgba(2,6,23,0)");
  grad.addColorStop(0.45, "rgba(2,6,23,0.55)");
  grad.addColorStop(1, "rgba(2,6,23,0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Top brand strip — small, centered product mark with letter spacing
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  // Manual letter-spacing
  const brand = "O N E W O R L D L A B S . A I";
  ctx.fillText(brand, W / 2, 40);
  // Accent underline
  ctx.fillStyle = "#2EE6D6";
  ctx.fillRect(W / 2 - 28, 70, 56, 3);

  ctx.textAlign = "left";

  // ---------- Layout constants ----------
  const padX = 60;
  // Reserve a 320px-wide safe column on the right for the QR card + brand line
  const qrSize = 200;
  const qrCardPad = 18;
  const qrCardW = qrSize + qrCardPad * 2;
  const qrCardH = qrSize + qrCardPad * 2 + 56; // extra room for URL line
  const qrCardX = W - qrCardW - 40;
  const qrCardY = H - qrCardH - 40;

  // Text column max width (don't run under the QR card)
  const textMaxW = qrCardX - padX - 30;

  // ---------- Chips (event type · category) at top of text block ----------
  // Truncate any single line to the safe text column width with an ellipsis.
  const fitLine = (text: string, font: string) => {
    ctx.font = font;
    if (ctx.measureText(text).width <= textMaxW) return text;
    let t = text;
    while (t.length > 4 && ctx.measureText(t + "…").width > textMaxW) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  };

  const chips = [meta.eventType, meta.category].filter(Boolean).join("  •  ");
  let cursorY = H - 620;
  if (chips) {
    ctx.fillStyle = "rgba(46,230,214,0.95)";
    ctx.font = "800 22px system-ui, -apple-system, sans-serif";
    ctx.fillText(chips.toUpperCase(), padX, cursorY);
    cursorY += 38;
  }

  // ---------- Hero title ----------
  ctx.fillStyle = "#FFFFFF";
  let titleSize = 86;
  ctx.font = `900 ${titleSize}px system-ui, -apple-system, sans-serif`;
  while (titleSize > 46) {
    ctx.font = `900 ${titleSize}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(title).width <= textMaxW * 1.9) break;
    titleSize -= 4;
  }
  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > textMaxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
    if (lines.length >= 3) break;
  }
  if (cur && lines.length < 3) lines.push(cur);
  const lineH = titleSize * 1.06;
  lines.forEach((ln, i) => ctx.fillText(ln, padX, cursorY + i * lineH));
  cursorY += lines.length * lineH + 18;

  // ---------- Accent rule ----------
  ctx.fillStyle = "#2EE6D6";
  ctx.fillRect(padX, cursorY, 64, 4);
  cursorY += 22;

  // ---------- Date line ----------
  if (dateLine) {
    ctx.fillStyle = "#2EE6D6";
    ctx.font = "700 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(dateLine, padX, cursorY);
    cursorY += 42;
  }

  // ---------- Venue / location (📍) ----------
  {
    const font = "500 26px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    const venueLabel = venue && venue.trim() ? venue : "Location: TBD";
    ctx.font = font;
    ctx.fillText("📍  " + fitLine(venueLabel, font), padX, cursorY);
    cursorY += 40;
  }

  // ---------- Tickets (🎟️) — the price, prominent ----------
  if (meta.ticketsLine) {
    const font = "800 27px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = font;
    ctx.fillText("🎟️  " + fitLine(meta.ticketsLine, font), padX, cursorY);
    cursorY += 38;
  }

  // ---------- What's included (✓) ----------
  if (meta.includedLine) {
    const font = "500 23px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(46,230,214,0.95)";
    ctx.font = font;
    ctx.fillText("✓  " + fitLine(meta.includedLine, font), padX, cursorY);
    cursorY += 34;
  }

  // ---------- Host name ----------
  if (meta.hostName) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 22px system-ui, -apple-system, sans-serif";
    ctx.fillText(`Hosted by ${meta.hostName}`, padX, cursorY);
    cursorY += 30;
  }

  // ---------- QR card (bottom-right) ----------
  // Card background
  ctx.fillStyle = "#FFFFFF";
  const r = 22;
  const cx = qrCardX, cy = qrCardY, cw = qrCardW, ch = qrCardH;
  ctx.beginPath();
  ctx.moveTo(cx + r, cy);
  ctx.arcTo(cx + cw, cy, cx + cw, cy + ch, r);
  ctx.arcTo(cx + cw, cy + ch, cx, cy + ch, r);
  ctx.arcTo(cx, cy + ch, cx, cy, r);
  ctx.arcTo(cx, cy, cx + cw, cy, r);
  ctx.closePath();
  ctx.fill();

  // QR code
  const qrDataUrl = await QRCode.toDataURL(shortLink, {
    margin: 1, width: qrSize, color: { dark: "#0F172A", light: "#FFFFFF" },
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrCardX + qrCardPad, qrCardY + qrCardPad, qrSize, qrSize);

  // URL line under QR — centered inside card
  ctx.fillStyle = "#0F172A";
  ctx.font = "800 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ONEEVENT", qrCardX + qrCardW / 2, qrCardY + qrCardPad + qrSize + 14);
  ctx.fillStyle = "#475569";
  ctx.font = "500 14px system-ui, -apple-system, sans-serif";
  ctx.fillText("Scan to RSVP", qrCardX + qrCardW / 2, qrCardY + qrCardPad + qrSize + 38);
  ctx.textAlign = "left";

  if (watermark) drawSampleWatermark(ctx, W, H);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob-failed"))), "image/png", 0.95),
  );
}

/** Page cover for event hero/card use. No flyer text or QR — just the background.
 *  v24 DS (Lee): SQUARE, not the skinny 16:9 rectangle — "make all of the images square,
 *  kinda like how Joel's is." The AI source is cover-fit into the square canvas. */
async function composeCoverBackground(bgUrl: string, _title: string, _shortLink: string, watermark = false): Promise<Blob> {
  const W = 1200;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unsupported");
  const bg = await loadImage(bgUrl);
  const bgRatio = bg.naturalWidth / bg.naturalHeight;
  const targetRatio = W / H;
  const bw = bgRatio > targetRatio ? H * bgRatio : W;
  const bh = bgRatio > targetRatio ? H : W / bgRatio;
  ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
  const grad = ctx.createLinearGradient(0, H * 0.45, 0, H);
  grad.addColorStop(0, "rgba(2,6,23,0)");
  grad.addColorStop(1, "rgba(2,6,23,0.28)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  if (watermark) drawSampleWatermark(ctx, W, H);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob-failed"))), "image/png", 0.95));
}

export function AiFlyerStudio({
  open,
  onOpenChange,
  mode = "flyer",
  eventId,
  title,
  description,
  category,
  eventType,
  venueName,
  startDate,
  startTime,
  hostName,
  ticketsLine,
  includedLine,
  slug,
  onAccept,
  onAcceptVideo,
}: AiFlyerStudioProps) {
  const { subscription } = useAuth();
  const navigate = useNavigate();
  // AI Cover Image = Pro, AI Flyer/animation = VIP. Under-plan users see the
  // upgrade path before any AI generation starts. (Lee, Jul 23; tightened Aug 19)
  const requiredPlan = mode === "background" ? "pro" : "vip";
  const userPlan = normalizePlan(subscription?.plan);
  const locked = PLAN_RANK[userPlan] < PLAN_RANK[requiredPlan];
  const requiredPlanLabel = requiredPlan === "pro" ? "Pro" : "VIP";
  const goUpgrade = () => {
    const ret = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/events/events`;
    navigate(`/events/pricing?plan=${requiredPlan}&return=${encodeURIComponent(ret)}`);
  };
  const [loading, setLoading] = useState(false);
  const [generatingVariants, setGeneratingVariants] = useState<Set<Variant>>(new Set());
  const [results, setResults] = useState<FlyerResult[]>([]);
  const [previews, setPreviews] = useState<Partial<Record<Variant, string>>>({});
  /* v24 DK/DM (Lee): "there is no progress bar — users have no idea how long they're
     gonna wait." A LEGITIMATE one: time-based asymptotic fill (never fakes 100%) that
     snaps forward on the REAL milestone of each finished preview, capped at 95% until
     the work is actually done. Typical full run ≈ 35–50s. */
  const [genStart, setGenStart] = useState<number | null>(null);
  const [, setProgressTick] = useState(0);
  useEffect(() => {
    const busy = loading || generatingVariants.size > 0;
    if (!busy) return;
    if (!genStart) setGenStart(Date.now());
    const t = setInterval(() => setProgressTick(x => x + 1), 600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, generatingVariants.size]);
  useEffect(() => {
    if (!loading && generatingVariants.size === 0) setGenStart(null);
  }, [loading, generatingVariants.size]);
  const progressPct = (() => {
    if (!genStart) return 0;
    const elapsed = Date.now() - genStart;
    const timePct = 100 * (1 - Math.exp(-elapsed / 30000));
    const done = Object.values(previews).filter(Boolean).length;
    const milestonePct = (done / 3) * 100;
    return Math.min(95, Math.max(timePct, milestonePct));
  })();
  const ProgressBar = () => (
    <div className="w-3/4 max-w-[220px]">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.round(progressPct)}%` }} />
      </div>
      <p className="mt-1.5 text-center text-[11px] font-semibold text-muted-foreground">
        Designing… {Math.round(progressPct)}%
      </p>
    </div>
  );
  // Per-variant undo stack of prior { result, previewUrl } so users can
  // revert to a previous generation if a refine/regenerate produced a worse one.
  const [history, setHistory] = useState<Partial<Record<Variant, Array<{ result: FlyerResult; previewUrl: string }>>>>({});
  const [accepting, setAccepting] = useState<Variant | null>(null);
  const [acceptingVideo, setAcceptingVideo] = useState<Variant | null>(null);
  const [acceptedStatic, setAcceptedStatic] = useState<Variant | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editVenue, setEditVenue] = useState(venueName || "");
  const [editDateLine, setEditDateLine] = useState(formatDateLine(startDate, startTime));
  // Per-card refine prompt + open state
  const [refineOpen, setRefineOpen] = useState<Record<Variant, boolean>>({ v1: false, v2: false, v3: false });
  const [refinePrompts, setRefinePrompts] = useState<Record<Variant, string>>({ v1: "", v2: "", v3: "" });
  const recomposeTimer = useRef<number | null>(null);

  const isBackgroundMode = mode === "background";
  const srcTag = isBackgroundMode ? "ai_background" : "ai_flyer";
  // Prefer the vanity URL (onesocial.ai/events/<slug>) when the host has set one.
  const shortLink = slug
    ? buildEventVanityLink(slug, srcTag)
    : eventId
      ? buildTrackedEventLink(eventId, srcTag)
      : `${buildCleanEventLink("preview")}?src=${srcTag}`;

  useEffect(() => {
    if (open) {
      setEditTitle(title);
      setEditVenue(venueName || "");
      setEditDateLine(formatDateLine(startDate, startTime));
    }
  }, [open, title, venueName, startDate, startTime]);

  const recomposeAll = useCallback(async () => {
    const next: Partial<Record<Variant, string>> = {};
    for (const f of results) {
      if (!f.url) continue;
      try {
        const blob = isBackgroundMode
          ? await composeCoverBackground(f.url, editTitle, shortLink, locked)
          : await composeFinalFlyer(f.url, editTitle, editDateLine, editVenue, shortLink, { category, eventType, description, hostName, ticketsLine, includedLine }, locked);
        next[f.variant] = URL.createObjectURL(blob);
      } catch (err) {
        console.error(`recompose failed for ${f.variant}:`, err);
      }
    }
    Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u));
    setPreviews(next);
  }, [results, editTitle, editDateLine, editVenue, shortLink, previews, isBackgroundMode, category, eventType, description, hostName]);

  useEffect(() => {
    if (!editing || results.length === 0) return;
    if (recomposeTimer.current) window.clearTimeout(recomposeTimer.current);
    recomposeTimer.current = window.setTimeout(() => { void recomposeAll(); }, 350);
    return () => { if (recomposeTimer.current) window.clearTimeout(recomposeTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTitle, editVenue, editDateLine]);

  const generate = useCallback(
    async (variantsArg?: Variant[], refineFor?: Variant) => {
      if (locked) {
        toast.error(`${isBackgroundMode ? "AI Cover Images" : "AI Flyers"} are a ${requiredPlanLabel} feature.`);
        goUpgrade();
        return;
      }
      // Backgrounds render no title text, so they don't need a title — only flyers do.
      if (!isBackgroundMode && !editTitle.trim()) {
        toast.error("Add an event title before generating a flyer.");
        return;
      }
      const isFullRun = !variantsArg || variantsArg.length === 0;
      if (isFullRun) {
        setLoading(true);
        setResults([]);
        setPreviews((p) => { Object.values(p).forEach((u) => u && URL.revokeObjectURL(u)); return {}; });
        setAcceptedStatic(null);
        // Reset undo history when regenerating everything from scratch.
        setHistory({});
      } else {
        setGeneratingVariants((s) => { const next = new Set(s); variantsArg!.forEach((p) => next.add(p)); return next; });
        // Snapshot prior state for each affected variant so the user can undo.
        setHistory((h) => {
          const next = { ...h };
          variantsArg!.forEach((v) => {
            const priorResult = results.find((r) => r.variant === v);
            const priorPreview = previews[v];
            if (priorResult && priorPreview) {
              const stack = next[v] ? [...next[v]!] : [];
              stack.push({ result: priorResult, previewUrl: priorPreview });
              // cap history to last 5 entries
              if (stack.length > 5) stack.shift();
              next[v] = stack;
            }
          });
          return next;
        });
        setPreviews((p) => {
          const next = { ...p };
          // Do NOT revoke prior URLs — they live in history for undo.
          variantsArg!.forEach((v) => { delete next[v]; });
          return next;
        });
      }
      try {
        const refinePrompt = refineFor ? refinePrompts[refineFor]?.trim() || null : null;
        const { data, error } = await supabase.functions.invoke("generate-event-flyer", {
          body: {
            eventId: eventId || undefined,
            title: editTitle,
            description: description || null,
            category: category || null,
            eventType: eventType || null,
            venue: editVenue || null,
            startDate: startDate || null,
            variants: variantsArg,
            refinePrompt,
            outputType: mode,
          },
        });

        if (error) {
          const msg = (error as { message?: string }).message || "Could not generate flyers.";
          if (msg.toLowerCase().includes("rate")) toast.error("Too many requests — try again in a moment.");
          else if (msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("payment")) toast.error("AI credits exhausted. Add funds to keep generating.");
          else toast.error(msg);
          return;
        }

        const flyers: FlyerResult[] = (data?.flyers || []).map((f: FlyerResult) => ({
          ...f,
          label: f.label || VARIANT_LABEL[f.variant] || f.variant,
        }));

        if (isFullRun) setResults(flyers);
        else {
          setResults((prev) => {
            const map = new Map(prev.map((r) => [r.variant, r]));
            flyers.forEach((f) => map.set(f.variant, f));
            return Array.from(map.values());
          });
        }

        for (const f of flyers) {
          if (!f.url) continue;
          try {
            const blob = isBackgroundMode
              ? await composeCoverBackground(f.url, editTitle, shortLink, locked)
              : await composeFinalFlyer(f.url, editTitle, editDateLine, editVenue, shortLink, { category, eventType, description, hostName, ticketsLine, includedLine }, locked);
            const url = URL.createObjectURL(blob);
            setPreviews((p) => { const stale = p[f.variant]; if (stale) URL.revokeObjectURL(stale); return { ...p, [f.variant]: url }; });
          } catch (err) {
            console.error(`compose failed for ${f.variant}:`, err);
          }
        }
      } catch (err) {
        console.error("generate flyer error:", err);
        toast.error("Could not reach the flyer studio. Try again.");
      } finally {
        if (isFullRun) setLoading(false);
        else setGeneratingVariants((s) => { const next = new Set(s); variantsArg!.forEach((p) => next.delete(p)); return next; });
      }
    },
    [editTitle, description, category, eventType, editVenue, startDate, eventId, editDateLine, shortLink, refinePrompts, mode, isBackgroundMode],
  );

  useEffect(() => {
    if (open && results.length === 0 && !loading) void generate();
    if (!open) {
      setPreviews((p) => { Object.values(p).forEach((u) => u && URL.revokeObjectURL(u)); return {}; });
      setHistory((h) => {
        Object.values(h).forEach((stack) => stack?.forEach((entry) => URL.revokeObjectURL(entry.previewUrl)));
        return {};
      });
      setResults([]);
      setEditing(false);
      setAcceptedStatic(null);
      setRefineOpen({ v1: false, v2: false, v3: false });
      setRefinePrompts({ v1: "", v2: "", v3: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAccept = async (variant: Variant) => {
    const previewUrl = previews[variant];
    if (!previewUrl) return;
    setAccepting(variant);
    try {
      const resp = await fetch(previewUrl);
      const blob = await resp.blob();
      const file = new File(
        [blob],
        `${isBackgroundMode ? "event-cover" : "share-flyer"}-${variant}-${Date.now()}.png`,
        { type: "image/png" },
      );
      const fileUrl = URL.createObjectURL(blob);
      onAccept({
        fileUrl,
        file,
        aspectRatio: isBackgroundMode ? "1:1" : "4:5",  /* v24 DS: square covers */
        flyerFile: isBackgroundMode ? undefined : file,
        flyerUrl: isBackgroundMode ? undefined : fileUrl,
      });
      setAcceptedStatic(variant);
      toast.success(isBackgroundMode ? "Background set as event cover." : "Flyer saved to supporting media.");
      onOpenChange(false);
    } catch (err) {
      console.error("accept flyer error:", err);
      toast.error("Could not save flyer.");
    } finally {
      setAccepting(null);
    }
  };

  const handleAcceptVideo = async (
    variant: Variant,
    args: { blob: Blob; objectUrl: string; ext: "mp4" | "webm" },
  ) => {
    if (!onAcceptVideo) return;
    const posterUrl = previews[variant];
    if (!posterUrl) { toast.error("Generate the static flyer first so we have a poster image."); return; }
    setAcceptingVideo(variant);
    try {
      const videoFile = new File([args.blob], `flyer-${variant}-animated-${Date.now()}.${args.ext}`, { type: args.blob.type || `video/${args.ext}` });
      const posterResp = await fetch(posterUrl);
      const posterBlob = await posterResp.blob();
      const posterFile = new File([posterBlob], `flyer-${variant}-poster-${Date.now()}.png`, { type: "image/png" });
      onAcceptVideo({ fileUrl: args.objectUrl, file: videoFile, posterFile, aspectRatio: isBackgroundMode ? "16:9" : "9:16", ext: args.ext });
      toast.success("Animated flyer saved to supporting media.");
      onOpenChange(false);
    } catch (err) {
      console.error("accept animated flyer error:", err);
      toast.error("Could not save animated flyer.");
    } finally {
      setAcceptingVideo(null);
    }
  };

  const handleDownload = async (variant: Variant) => {
    const previewUrl = previews[variant];
    if (!previewUrl) return;
    if (locked) {
      goUpgrade();
      return;
    }
    try {
      // Re-fetch the blob and create a fresh object URL so the browser
      // treats this as a real file download instead of opening the image
      // in a new tab (which is what raw <img>-source blob URLs do in some
      // browsers when used with the download attribute).
      const resp = await fetch(previewUrl);
      const blob = await resp.blob();
      const fileName = `${isBackgroundMode ? "event-cover" : "event-flyer"}-${variant}-${Date.now()}.png`;
      const dlUrl = URL.createObjectURL(new Blob([blob], { type: "image/png" }));
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke shortly after so the download has a chance to start.
      setTimeout(() => URL.revokeObjectURL(dlUrl), 4000);
    } catch (err) {
      console.error("download failed:", err);
      toast.error("Could not download image. Try again.");
    }
  };

  /** Restore the most recently saved prior generation for a variant. */
  const handleUndo = (variant: Variant) => {
    const stack = history[variant];
    if (!stack || stack.length === 0) return;
    const next = [...stack];
    const prev = next.pop()!;
    const currentPreview = previews[variant];
    if (currentPreview) URL.revokeObjectURL(currentPreview);
    setPreviews((p) => ({ ...p, [variant]: prev.previewUrl }));
    setResults((rs) => {
      const map = new Map(rs.map((r) => [r.variant, r]));
      map.set(variant, prev.result);
      return Array.from(map.values());
    });
    setAcceptedStatic((s) => (s === variant ? null : s));
    setHistory((h) => ({ ...h, [variant]: next }));
    toast.success("Reverted to previous version");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] w-[96vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {isBackgroundMode ? "AI Cover Studio" : "AI Flyer Studio"}
          </DialogTitle>
          <DialogDescription>
            {isBackgroundMode
              ? "VAIA designs 3 square cover image options for the event page and cards. Pick one, refine it, download it, or regenerate."
              : "VAIA designs 3 vertical flyers with QR codes for your media section. Pick one, download it, refine it, or animate it."}
          </DialogDescription>
        </DialogHeader>

        {locked ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-semibold text-foreground">
              ✨ {isBackgroundMode ? "AI Cover Images" : "AI Flyers"} are a {requiredPlanLabel} feature
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upgrade to generate with VAIA. You can always upload your own image for free.
            </p>
            <Button size="sm" onClick={goUpgrade} className="mt-2 rounded-full">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Upgrade to {requiredPlanLabel}
            </Button>
          </div>
        ) : !isBackgroundMode ? (
          <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            💡 You can download your flyer now. It becomes <strong className="text-foreground">shareable to attendees once you publish the event.</strong>
          </p>
        ) : null}

        {/* Edit text overlay panel */}
        <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Pencil className="w-4 h-4 text-primary" />
              {isBackgroundMode ? "Background text" : "Flyer text"}
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditing((v) => !v)}>
              {editing ? "Done" : "Edit"}
            </Button>
          </div>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="flyer-title" className="text-xs text-muted-foreground">Title</Label>
                <Input id="flyer-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 text-sm" maxLength={80} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="flyer-date" className="text-xs text-muted-foreground">Date line</Label>
                <Input id="flyer-date" value={editDateLine} onChange={(e) => setEditDateLine(e.target.value)} className="h-8 text-sm" maxLength={60} placeholder="Sat, Mar 15 • 9:00 PM" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="flyer-venue" className="text-xs text-muted-foreground">Venue</Label>
                <Input id="flyer-venue" value={editVenue} onChange={(e) => setEditVenue(e.target.value)} className="h-8 text-sm" maxLength={60} placeholder="Venue name" />
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground line-clamp-2">
              <span className="font-medium text-foreground">{editTitle}</span>
              {editDateLine && <> · {editDateLine}</>}
              {editVenue && <> · {editVenue}</>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {results.map((result) => {
            const variant = result.variant as Variant;
            const preview = previews[variant];
            const isGenerating = loading || generatingVariants.has(variant);
            const label = result.label || VARIANT_LABEL[variant] || variant;
            const isAcceptedStatic = acceptedStatic === variant;
            const isRefineOpen = refineOpen[variant];
            const canUndo = (history[variant]?.length ?? 0) > 0;
            return (
              <div key={variant} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
                <div className="relative w-full bg-secondary/40" style={{ aspectRatio: isBackgroundMode ? "1/1" : "4/5" }}>
                  {isGenerating && !preview && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <ProgressBar />
                    </div>
                  )}
                  {!isGenerating && result.error && (
                    <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-destructive">
                      {result.error}
                    </div>
                  )}
                  {preview && (
                    <img src={preview} alt={`${label} preview`} className="w-full h-full object-cover" />
                  )}
                  {isAcceptedStatic && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-primary/95 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                      <Check className="w-3 h-3" /> {isBackgroundMode ? "In use" : "Saved"}
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <div className="font-semibold text-sm text-foreground">{label}</div>

                  <div className="flex gap-2">
                    <Button
                      size="sm" variant="outline" className="flex-1 text-xs"
                      onClick={() => setRefineOpen((s) => ({ ...s, [variant]: !s[variant] }))}
                      disabled={isGenerating || accepting !== null}
                    >
                      <Wand2 className="w-3 h-3 mr-1" />
                      {isRefineOpen ? "Hide" : "Refine"}
                    </Button>
                    <Button
                      size="sm" variant="outline" className="px-2 text-xs"
                      onClick={() => handleUndo(variant)}
                      disabled={!canUndo || isGenerating || accepting !== null}
                      title={canUndo ? `Undo — restore previous version (${history[variant]?.length} saved)` : "No previous version to restore"}
                    >
                      <Undo2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm" variant="outline" className="px-2 text-xs"
                      onClick={() => handleDownload(variant)}
                      disabled={!preview || isGenerating}
                      title="Download this image"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    {locked ? (
                      <Button
                        size="sm" className="flex-1 text-xs"
                        onClick={goUpgrade}
                        disabled={!preview}
                        title={`Upgrade to ${requiredPlanLabel} to save this to your event`}
                      >
                        <Sparkles className="w-3 h-3 mr-1" /> Upgrade to save
                      </Button>
                    ) : (
                      /* v24 DL (Lee): no wrapped two-line label — one clean line on the
                         espresso treatment, matching every other primary button. */
                      <Button
                        size="sm" className="ow-btn-espresso flex-1 rounded-full text-xs font-bold whitespace-nowrap"
                        onClick={() => handleAccept(variant)}
                        disabled={!preview || accepting !== null || isAcceptedStatic}
                        title={isBackgroundMode ? "Use this as your event background" : "Save this flyer to supporting media"}
                      >
                        {accepting === variant ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                        {isAcceptedStatic ? "Saved" : isBackgroundMode ? "Use this" : "Save flyer"}
                      </Button>
                    )}
                  </div>

                  {isRefineOpen && (
                    <div className="space-y-2 pt-1">
                      <Textarea
                        value={refinePrompts[variant]}
                        onChange={(e) => setRefinePrompts((s) => ({ ...s, [variant]: e.target.value }))}
                        placeholder="What to change? e.g. more vibrant, less people, a beach vibe…"
                        className="text-xs min-h-[60px]"
                        maxLength={300}
                      />
                      <Button
                        size="sm" className="w-full text-xs"
                        onClick={() => generate([variant], variant)}
                        disabled={isGenerating || !refinePrompts[variant]?.trim()}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Apply & regenerate
                      </Button>
                    </div>
                  )}

                  {result.url && !locked && !isBackgroundMode && (
                    <AnimatedFlyerExport
                      bgUrl={result.url}
                      title={editTitle}
                      dateLine={editDateLine}
                      venue={editVenue}
                      shortLink={shortLink}
                      orientation={isBackgroundMode ? "horizontal" : "vertical"}
                      fileNamePrefix={`${isBackgroundMode ? "background" : "flyer"}-${variant}`}
                      onUseAnimated={onAcceptVideo ? (args) => handleAcceptVideo(variant, args) : undefined}
                      selected={acceptingVideo === variant}
                      animateLabel="Animate flyer"
                      actionLabel="Save animated flyer"
                      usedLabel="Saved"
                    />
                  )}
                  {result.url && locked && !isBackgroundMode && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs gap-1.5"
                      onClick={goUpgrade}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Upgrade to animate
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {results.length === 0 && loading && (
            [0, 1, 2].map((i) => (
              <div key={`placeholder-${i}`} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
                <div className="relative w-full bg-secondary/40 flex flex-col items-center justify-center gap-2 text-muted-foreground" style={{ aspectRatio: isBackgroundMode ? "1/1" : "4/5" }}>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <ProgressBar />
                </div>
                <div className="p-3">
                  <div className="h-4 w-24 bg-secondary/60 rounded" />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            {/* v24 DJ (Lee): this is THE key action here — espresso primary, not a
                white outline hiding on a white sheet. */}
            <Button size="sm" className="ow-btn-espresso flex-1 rounded-full font-bold" onClick={() => generate()} disabled={loading || accepting !== null}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate all
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onOpenChange(false)}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Close
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Powered by AI · {isBackgroundMode ? "cover images are optimized for your event page" : "flyers include a QR code & tracked link"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
