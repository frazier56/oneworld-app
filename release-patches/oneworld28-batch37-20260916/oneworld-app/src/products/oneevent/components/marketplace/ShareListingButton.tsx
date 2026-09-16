import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useLanguage } from "@evt/i18n/LanguageContext";
export function ShareListingButton({ type, id, title, className = "" }: { type: string; id: string; title?: string; className?: string }) {
  const { t } = useLanguage();
  const [done, setDone] = useState(false);
  const url = `${window.location.origin}/events/e/${id}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: title || "Event", url });
      else { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1600); }
    } catch { /* cancelled */ }
  };
  return (
    <button
      onClick={share}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/35 bg-primary/[0.04] px-5 py-3 text-sm font-semibold text-foreground shadow-sm shadow-primary/5 transition-colors hover:border-primary/55 hover:bg-primary/[0.08] ${className}`}
    >
      {done ? <Check size={16} /> : <Share2 size={16} />}{done ? t("share.copied", "Copied") : t("share.share", "Share")}
    </button>
  );
}
export default ShareListingButton;
