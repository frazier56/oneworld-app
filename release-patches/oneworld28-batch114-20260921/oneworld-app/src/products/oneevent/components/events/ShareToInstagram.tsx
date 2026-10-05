/**
 * ShareToInstagram — Step 2 of Native Flyer Mode.
 *
 * Generates IG-ready flyer assets (Story 1080×1920, Post 1080×1350) by
 * compositing the event's cover image onto a branded backdrop with QR code
 * and a clean short link footer.
 *
 * Promoters now use OneEvent as their flyer factory and Instagram as their
 * megaphone — every export drives a tracked link back to us.
 */

import { useState } from "react";
import QRCode from "qrcode";
import { composeFlyer as shellComposeFlyer, FLYER_BRANDS } from "@oneworld/shell";
import { Camera as Instagram, Download, Copy, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@evt/i18n/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@evt/components/ui/dialog";
import { buildCleanEventLink, buildEventVanityLink, buildTrackedEventLink } from "@evt/lib/eventShortLinks";

interface ShareToInstagramProps {
  eventId: string;
  eventTitle: string;
  coverImageUrl: string | null;
  slug?: string | null;
  startDate?: string | null;
  venueName?: string | null;
  hostHandle?: string | null;
  className?: string;
}

type ExportFormat = "story" | "post";

const FORMATS: Record<ExportFormat, { w: number; h: number; label: string; src: string }> = {
  story: { w: 1080, h: 1920, label: "Story (9:16)", src: "ig_story" },
  post: { w: 1080, h: 1350, label: "Post (4:5)", src: "ig_post" },
};

type QrColor = "amber" | "white" | "classic";
/* PROMOTED 30 Sep 2026: the compositor now lives in the shell (`composeFlyer`) so OneHome, OneJob
   and OneSocial share this exact flyer. OneEvent keeps its amber brand and its QR — the only two
   things that were OneEvent's own — by passing them in. AT (18 Aug 2026) still holds: amber on
   black by default, "classic" black-on-white for scanners that need it. */
const QR_COLORS: Record<QrColor, { dark: string; light: string }> = {
  amber:   { dark: "#F59E0B", light: "#000000" },
  white:   { dark: "#FFFFFF", light: "#000000" },
  classic: { dark: "#0F172A", light: "#FFFFFF" },
};

async function composeFlyer(
  format: ExportFormat,
  coverUrl: string,
  shortLink: string,
  title: string,
  qrColor: QrColor = "amber",
): Promise<Blob> {
  const qc = QR_COLORS[qrColor];
  const qrDataUrl = await QRCode.toDataURL(shortLink, { margin: 1, width: 168, color: { dark: qc.dark, light: qc.light } });
  return shellComposeFlyer({ format, coverUrl, link: shortLink, title, brand: FLYER_BRANDS.oneevent, qrDataUrl, mime: "image/png" });
}

export function ShareToInstagram({
  eventId,
  eventTitle,
  coverImageUrl,
  slug,
  className,
}: ShareToInstagramProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  /* AT: hosts pick the QR colour — amber-on-black is the OneEvent default; "classic"
     black-on-white stays available because it scans on every reader ever made. */
  const [qrColor, setQrColor] = useState<QrColor>("amber");

  const cleanEventLink = slug ? buildEventVanityLink(slug) : buildCleanEventLink(eventId);
  const storyLink = slug ? buildEventVanityLink(slug, "ig_story") : buildTrackedEventLink(eventId, "ig_story");
  const postLink = slug ? buildEventVanityLink(slug, "ig_post") : buildTrackedEventLink(eventId, "ig_post");

  const handleDownload = async (format: ExportFormat) => {
    if (!coverImageUrl) {
      toast.error("Add a cover image first to export an Instagram-ready flyer.");
      return;
    }
    setBusy(format);
    try {
      const link = format === "story" ? storyLink : postLink;
      const blob = await composeFlyer(format, coverImageUrl, link, eventTitle, qrColor);
      const fileName = `${eventTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${format}.png`;
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      /* NATIVE SHARE SHEET FIRST (Lee's UAT, 18 Aug 2026: "share to Instagram doesn't even
         work"). On a phone, a silent file-download with a 4-second toast reads as NOTHING
         HAPPENING. The Web Share API pops the system sheet with Instagram right in it —
         the flyer lands in the Story composer in two taps. Download remains the fallback
         for desktop and for browsers that can't share files. */
      const file = new File([blob], fileName, { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: eventTitle });
          try { await navigator.clipboard.writeText(cleanEventLink); } catch { /* non-fatal */ }
          toast.success("Pick Instagram from the sheet — the event link is on your clipboard for the Link sticker.", { duration: 8000 });
          return;
        } catch (shareErr) {
          if ((shareErr as DOMException)?.name === "AbortError") return; // user closed the sheet
          /* sheet unavailable — fall through to the download path below */
        }
      }
      const url = URL.createObjectURL(blob);

      // Copy link first so it's already on the clipboard regardless of which path runs.
      let linkCopied = false;
      try {
        await navigator.clipboard.writeText(cleanEventLink);
        linkCopied = true;
      } catch {
        /* clipboard may fail on iOS without user gesture chain — non-fatal */
      }

      // iOS Safari: <a download> is ignored. Open in a new tab so user can
      // long-press → "Save to Photos". This is the only reliable path on iOS.
      if (isIOS) {
        const opened = window.open(url, "_blank");
        if (!opened) window.location.href = url;
        toast.success(
          linkCopied
            ? "Image opened — long-press → Save to Photos. Link copied."
            : "Image opened — long-press → Save to Photos.",
        );
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }

      // Desktop + Android Chrome: classic anchor download → goes to Downloads folder.
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      toast.success(
        linkCopied
          ? `${FORMATS[format].label} downloaded — link copied for IG Link sticker.`
          : `${FORMATS[format].label} downloaded — open Instagram and tap upload.`,
        { duration: 8000 },
      );
    } catch (err) {
      console.error("ShareToInstagram export error:", err);
      toast.error("Could not generate flyer. The cover image may not allow cross-origin export.");
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(cleanEventLink);
      toast.success("Link copied. Paste it into the Instagram Link sticker.");
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const handleOpenInstagram = () => {
    // Instagram doesn't support pre-attached images via web deep link, but on
    // mobile it'll open the app for the user to manually attach the downloaded image.
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = "instagram://camera";
      setTimeout(() => {
        window.location.href = "https://instagram.com";
      }, 800);
    } else {
      window.open("https://instagram.com", "_blank", "noopener");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary/40 bg-primary/[0.03] text-foreground font-semibold text-sm shadow-sm shadow-primary/5 hover:border-primary/60 hover:bg-primary/[0.08] transition-colors ${className || ""}`}
>
          <Instagram className="w-4 h-4 text-primary" />
          {t("share.instagram", "Share to Instagram")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5 text-pink-400" />
            Share to Instagram
          </DialogTitle>
          <DialogDescription>
            Download a branded flyer with QR code and a clean short link, then upload it to your Story or Feed.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Make it clickable:</strong> Instagram doesn't allow tappable links inside an image. After uploading your Story, tap the <strong className="text-foreground">Link sticker</strong> in Instagram and paste the link copied from below. Followers can also scan the QR or type the link.
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => handleDownload("story")}
            disabled={busy !== null || !coverImageUrl}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
>
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-14 rounded-md bg-gradient-to-br from-pink-500/30 to-purple-500/30 border border-pink-500/40" />
              <div>
                <div className="font-semibold text-foreground text-sm">Download Story</div>
                <div className="text-xs text-muted-foreground">1080 × 1920 (9:16)</div>
              </div>
            </div>
            {busy === "story" ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <Download className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* AT: QR colour picker — three swatches, default amber. */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">
            <span className="text-xs font-semibold text-foreground">QR code color</span>
            <div className="flex gap-2">
              {([["amber", "bg-black", "bg-amber-500"], ["white", "bg-black", "bg-white"], ["classic", "bg-white border border-border", "bg-slate-900"]] as const).map(([k, bg, dot]) => (
                <button key={k} type="button" onClick={() => setQrColor(k as QrColor)}
                  aria-label={`QR ${k}`}
                  className={`relative grid h-8 w-8 place-items-center rounded-lg ${bg} ${qrColor === k ? "ring-2 ring-primary ring-offset-1" : "opacity-70 hover:opacity-100"}`}>
                  <span className={`h-3.5 w-3.5 rounded-[3px] ${dot}`} />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleDownload("post")}
            disabled={busy !== null || !coverImageUrl}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
>
            <div className="flex items-center gap-3 text-left">
              <div className="w-12 h-14 rounded-md bg-gradient-to-br from-amber-500/30 to-pink-500/30 border border-amber-500/40" />
              <div>
                <div className="font-semibold text-foreground text-sm">Download Post</div>
                <div className="text-xs text-muted-foreground">1080 × 1350 (4:5)</div>
              </div>
            </div>
            {busy === "post" ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <Download className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
>
            <div className="flex items-center gap-3 text-left">
              <Copy className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-semibold text-foreground text-sm">Copy Link</div>
                <div className="text-xs text-muted-foreground">Clean event URL for the IG Link sticker</div>
              </div>
            </div>
          </button>

          <button
            onClick={handleOpenInstagram}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
>
            <Instagram className="w-4 h-4" />
            Open Instagram
          </button>

          {!coverImageUrl && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
              <ImageIcon className="w-3.5 h-3.5" />
              Add a cover image to enable downloads.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
