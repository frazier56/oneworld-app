import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareSheet } from "@oneworld/shell";
import { useLanguage } from "@evt/i18n/LanguageContext";

/**
 * Share an event — through the shell's ONE share sheet (30 Sep 2026), the same one OneHome and
 * profiles use: a short link that draws a photo card in WhatsApp/Messages/Facebook, and an
 * Instagram flyer in OneEvent's amber. Lee: "the same exact function for everything."
 */
export function ShareListingButton({ id, title, cover, subtitle, className = "" }: {
  type?: string; id: string; title?: string; cover?: string | null; subtitle?: string; className?: string;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/35 bg-primary/[0.04] px-5 py-3 text-sm font-semibold text-foreground shadow-sm shadow-primary/5 transition-colors hover:border-primary/55 hover:bg-primary/[0.08] ${className}`}
      >
        <Share2 size={16} />{t("share.share", "Share")}
      </button>
      {open && (
        <ShareSheet onClose={() => setOpen(false)} card={{
          kind: "event", entityId: id, title: title || "Event", subtitle,
          coverUrl: cover ?? null, brand: "oneevent",
          fallbackUrl: `${window.location.origin}/events/e/${id}`,
        }} />
      )}
    </>
  );
}
export default ShareListingButton;
