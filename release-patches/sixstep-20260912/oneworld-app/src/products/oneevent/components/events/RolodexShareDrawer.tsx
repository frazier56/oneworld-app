import { useEffect, useState } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { useAuth } from "@evt/hooks/useAuth";
import { X, Copy, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { productHref } from "@oneworld/shell";

interface Props {
  onClose: () => void;
}

export default function RolodexShareDrawer({ onClose }: Props) {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuickLink, setShowQuickLink] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);

  /* Cross-product links — built from PRODUCT_PATH (never a hard-coded host). These routes
     live in the OneSocial product; if it hasn't mounted /r and /join yet the integrator
     owns that half. */
  const formUrl = token ? `${window.location.origin}${productHref("onesocial", `/r/${token}`)}` : "";
  const joinUrl = token ? `${window.location.origin}${productHref("onesocial", `/join/${token}`)}` : "";

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      /* short_token is owner-private — my_private_profile() is the one sanctioned read path
         (a profiles select on it throws 42501 under the new grants). */
      let row: any = null;
      try {
        const { data } = await supabase.rpc("my_private_profile");
        row = Array.isArray(data) ? data[0] : data;
      } catch { /* row stays null — drawer shows its empty state */ }
      if (row?.short_token) {
        setToken(row.short_token);
        setShowQuickLink(!!row.show_rolodex_quick_link);
        try {
          const QR = await import("qrcode");
          const url = await QR.toDataURL(`${window.location.origin}${productHref("onesocial", `/join/${row.short_token}`)}`, { width: 320, margin: 1 });
          setQrDataUrl(url);
        } catch {}
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const toggleQuickLink = async (next: boolean) => {
    if (!user?.id) return;
    setShowQuickLink(next);
    setSavingToggle(true);
    const { error } = await supabase
      .from("profiles")
      .update({ show_rolodex_quick_link: next } as any)
      .eq("id", user.id);
    setSavingToggle(false);
    if (error) {
      setShowQuickLink(!next);
      toast.error("Couldn't save preference");
    } else {
      toast.success(next ? "Quick link added to header" : "Quick link removed");
      window.dispatchEvent(new Event("rolodex-quicklink-changed"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm p-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+96px)] sm:pb-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[calc(100dvh-env(safe-area-inset-bottom)-120px)] sm:max-h-[90vh] overflow-y-auto overscroll-contain bg-card border border-border rounded-2xl shadow-2xl shadow-black/40"
      >
        <div className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-foreground">Share your Rolodex link</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 p-3 rounded-xl hover:bg-secondary active:bg-secondary/80 touch-manipulation"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : !token ? (
          <p className="p-5 text-sm text-muted-foreground">Couldn't load your share link. Please refresh.</p>
        ) : (
          <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Form link</h3>
              <p className="text-xs text-muted-foreground mb-2">Anyone who fills out the form lands in your Rolodex - no sign up required.</p>
              <div className="flex items-center gap-2">
                <input readOnly value={formUrl} className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" />
                <button onClick={() => copy(formUrl, "Form link")} className="p-2 rounded-lg bg-primary text-primary-foreground shrink-0"><Copy className="w-4 h-4" /></button>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">QR code (sign-up flow)</h3>
              <p className="text-xs text-muted-foreground mb-2">Scan → joins OneEvent → auto-connected with you + added to your Rolodex.</p>
              <div className="flex items-start gap-3">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR code" className="w-28 h-28 sm:w-40 sm:h-40 rounded-lg border border-border bg-white p-2 shrink-0" />
                ) : (
                  <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-lg bg-secondary flex items-center justify-center shrink-0"><QrCode className="w-8 h-8 text-muted-foreground" /></div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <input readOnly value={joinUrl} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground" />
                    <button onClick={() => copy(joinUrl, "Join link")} className="p-1.5 rounded-lg bg-primary text-primary-foreground shrink-0"><Copy className="w-3 h-3" /></button>
                  </div>
                  {qrDataUrl && (
                    <a href={qrDataUrl} download="rolodex-qr.png" className="block text-xs font-semibold text-primary">Download QR</a>
                  )}
                </div>
              </div>
            </section>

            <section className="pt-3 border-t border-border">
              <label className="flex items-start gap-3 cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showQuickLink}
                  disabled={savingToggle}
                  onClick={() => toggleQuickLink(!showQuickLink)}
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors mt-0.5"
                  style={{ background: showQuickLink ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
                >
                  <span
                    className="inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform"
                    style={{ transform: showQuickLink ? "translateX(22px)" : "translateX(2px)" }}
                  />
                </button>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">Quick link in top header</div>
                  <div className="text-xs text-muted-foreground">Adds a Rolodex icon next to your messages so you can pull up this QR in one tap.</div>
                </div>
              </label>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
