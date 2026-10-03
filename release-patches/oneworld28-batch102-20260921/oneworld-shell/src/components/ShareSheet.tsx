import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n, W } from "../lib/i18n";
import { getShareLink, displayLink, type ShareKind, type ShareApp } from "../lib/share/shareLinks";
import { composeFlyer, type FlyerBrand, FLYER_BRANDS } from "../lib/share/flyer";

/**
 * ShareSheet — how ANYTHING is shared from ANY One World app.
 * ============================================================================================
 * Lee, 30 Sep 2026: *"when someone clicks share ... WhatsApp, Instagram, a story, a text message
 * ... it should always show up with a preview image ... a clickable preview image with some text
 * at the bottom instead of just the actual link ... it's a shell thing ... the same exact function
 * for everything that needs to be shared."*
 *
 * What each destination gets, and why it differs:
 * · WhatsApp, Messages, Facebook, Copy, More — the SHORT LINK only. Every one of those apps builds
 *   the photo-and-title card itself from the link (the `share` edge function serves the card).
 *   Adding text beside the link would print the title twice under the card.
 * · Instagram — Instagram shows no link previews in posts or stories, so it gets a FLYER image
 *   (photo, badge, title, price, link) through the phone's share sheet, and the link goes on the
 *   clipboard at the same moment for the Link sticker. Video, when there is one, goes as the file.
 *
 * The preview at the top is what the other person will see, so the sharer knows before they send.
 */
export type ShareCard = {
  kind: ShareKind;
  entityId: string;
  app?: ShareApp;
  title: string;
  /** Under the title — the price, the date and venue. */
  subtitle?: string;
  /** What it is — "For sale", "For rent", "Event". Drawn on the flyer and in front of the title. */
  badge?: string;
  coverUrl?: string | null;
  videoUrl?: string | null;
  brand?: keyof typeof FLYER_BRANDS | FlyerBrand;
  /** Where to send people if the thing has no short link (not public yet). */
  fallbackUrl: string;
};

type Method = "whatsapp" | "sms" | "instagram_story" | "instagram_post" | "instagram_video" | "facebook" | "copy" | "native";

export default function ShareSheet({ card, onClose, onShared }: {
  card: ShareCard;
  onClose: () => void;
  onShared?: (method: Method) => void;
}) {
  const { lang } = useI18n();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<Method | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [ig, setIg] = useState(false);

  useEffect(() => {
    let alive = true;
    getShareLink(card.kind, card.entityId, card.app).then(l => { if (alive) setLink(l ?? card.fallbackUrl); });
    return () => { alive = false; };
  }, [card.kind, card.entityId, card.app, card.fallbackUrl]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const brand: FlyerBrand = typeof card.brand === "object" ? card.brand : FLYER_BRANDS[card.brand ?? "onehome"];
  const fullTitle = card.badge ? `${card.badge} · ${card.title}` : card.title;
  const done = (m: Method, msg?: string) => { onShared?.(m); if (msg) setNote(msg); };
  const open = (url: string) => { window.open(url, "_blank", "noopener,noreferrer"); };

  async function copy(m: Method = "copy") {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); done(m, W(lang, "Link copied", "Enlace copiado")); }
    catch { window.prompt(W(lang, "Copy this link", "Copie este enlace"), link); done(m); }
  }

  async function shareFile(m: Method, file: File) {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (link) { try { await navigator.clipboard.writeText(link); } catch { /* the flyer carries it too */ } }
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: fullTitle });
        done(m, W(lang, "Link copied — add it with Instagram's Link sticker.", "Enlace copiado — agréguelo con el sticker de enlace de Instagram."));
        return;
      } catch (e) { if ((e as Error)?.name === "AbortError") return; }
    }
    // A computer, or a browser that cannot hand files to apps: save it instead.
    const url = URL.createObjectURL(file);
    const a = document.createElement("a"); a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    done(m, W(lang, "Saved. Post it from your phone's photos — the link is copied.", "Guardado. Publíquelo desde sus fotos — el enlace está copiado."));
  }

  async function flyer(format: "story" | "post") {
    if (!link) return;
    const m: Method = format === "story" ? "instagram_story" : "instagram_post";
    setBusy(m); setNote(null);
    try {
      const blob = await composeFlyer({
        format, coverUrl: card.coverUrl ?? null, link, title: card.title,
        detail: card.subtitle, badge: card.badge?.toUpperCase(), brand,
      });
      const name = `${card.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40) || "share"}-${format}.jpg`;
      await shareFile(m, new File([blob], name, { type: "image/jpeg" }));
    } catch {
      setNote(W(lang, "The image could not be made. Try again.", "No se pudo crear la imagen. Intente de nuevo."));
    } finally { setBusy(null); }
  }

  async function video() {
    if (!card.videoUrl) return;
    setBusy("instagram_video"); setNote(null);
    try {
      const r = await fetch(card.videoUrl);
      const b = await r.blob();
      const ext = /mp4/.test(b.type) ? "mp4" : /quicktime/.test(b.type) ? "mov" : "mp4";
      await shareFile("instagram_video", new File([b], `video.${ext}`, { type: b.type || "video/mp4" }));
    } catch {
      setNote(W(lang, "The video could not be loaded.", "No se pudo cargar el video."));
    } finally { setBusy(null); }
  }

  async function native() {
    if (!link) return;
    try { await navigator.share?.({ title: fullTitle, url: link }); done("native"); }
    catch (e) { if ((e as Error)?.name !== "AbortError") await copy("native"); }
  }

  const ready = !!link;
  const Tile = ({ label, color, path, onClick, disabled }: { label: string; color: string; path: string; onClick: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={!ready || disabled}
      className="flex flex-col items-center gap-1.5 rounded-2xl py-2 transition active:scale-95 disabled:opacity-40">
      <span className="grid h-12 w-12 place-items-center rounded-full text-white shadow-sm" style={{ background: color }}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={path} /></svg>
      </span>
      <span className="whitespace-nowrap text-[12px] font-semibold">{label}</span>
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(11,15,26,.42)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label={W(lang, "Share", "Compartir")}>
      <div onClick={e => e.stopPropagation()}
        className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-3xl dark:border-white/[0.12]"
        /* --overlay-bg, not --glass-fill: a sheet you tap buttons on must be readable over anything
           (tokens.css, OVERLAY OPACITY RULE). Glass-fill let the page's own headline show through
           the buttons, and a nested backdrop blur does not blur the page in Chrome. */
        style={{ background: "var(--overlay-bg)", boxShadow: "var(--frostedge), var(--glass-shadow)" }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-extrabold">{W(lang, "Share", "Compartir")}</p>
          <button type="button" onClick={onClose} aria-label={W(lang, "Close", "Cerrar")}
            className="grid h-8 w-8 place-items-center rounded-full border border-ink/15 text-lg dark:border-white/15">×</button>
        </div>

        {/* What the other person will see. */}
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white dark:border-white/10 dark:bg-black/30">
          {card.coverUrl
            ? <img src={card.coverUrl} alt="" className="block aspect-[1.91/1] w-full object-cover" />
            : <div className="flex aspect-[1.91/1] flex-col justify-between p-4 text-white"
                style={{ background: `linear-gradient(135deg, ${brand.accentFrom}, ${brand.accentTo})` }}>
                <span className="text-[11px] font-bold tracking-[0.14em] opacity-85">{brand.label}</span>
                <span className="line-clamp-3 text-[19px] font-extrabold leading-tight">{card.title}</span>
              </div>}
          <div className="space-y-0.5 p-3">
            <p className="line-clamp-2 text-[14px] font-bold leading-snug">{fullTitle}</p>
            {card.subtitle && <p className="truncate text-[12.5px] opacity-65">{card.subtitle}</p>}
            <p className="truncate text-[11.5px] opacity-45">{link ? displayLink(link) : "…"}</p>
          </div>
        </div>

        {!ig ? (
          <div className="mt-3 grid grid-cols-3 gap-1">
            <Tile label="WhatsApp" color="#25D366" path="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.4A8.4 8.4 0 1 1 21 11.5z"
              onClick={() => { open(`https://wa.me/?text=${encodeURIComponent(link!)}`); done("whatsapp"); }} />
            <Tile label={W(lang, "Messages", "Mensajes")} color="#34C759" path="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              onClick={() => { window.location.href = `sms:?&body=${encodeURIComponent(link!)}`; done("sms"); }} />
            <Tile label="Instagram" color="linear-gradient(45deg,#F58529,#DD2A7B 55%,#8134AF)" path="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z M17.5 6.5h.01"
              onClick={() => { setIg(true); setNote(null); }} />
            <Tile label="Facebook" color="#1877F2" path="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"
              onClick={() => { open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link!)}`); done("facebook"); }} />
            <Tile label={W(lang, "Copy link", "Copiar enlace")} color="#0F766E" path="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"
              onClick={() => void copy()} />
            <Tile label={W(lang, "More", "Más")} color="#64748B" path="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13"
              onClick={() => void native()} />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-[12.5px] opacity-65">
              {W(lang, "Instagram doesn't show links in posts, so it gets a picture with the link printed on it — and the link is copied for the Link sticker.",
                "Instagram no muestra enlaces en publicaciones, así que recibe una imagen con el enlace impreso — y el enlace queda copiado para el sticker de enlace.")}
            </p>
            <button type="button" className="btn-primary w-full" disabled={!ready || !!busy} onClick={() => void flyer("story")}>
              {busy === "instagram_story" ? "…" : W(lang, "Story", "Historia")}
            </button>
            <button type="button" className="btn-ghost w-full" disabled={!ready || !!busy} onClick={() => void flyer("post")}>
              {busy === "instagram_post" ? "…" : W(lang, "Post", "Publicación")}
            </button>
            {card.videoUrl && (
              <button type="button" className="btn-ghost w-full" disabled={!ready || !!busy} onClick={() => void video()}>
                {busy === "instagram_video" ? "…" : W(lang, "Reel (video)", "Reel (video)")}
              </button>
            )}
            <button type="button" className="w-full py-1 text-[12.5px] font-bold opacity-60" onClick={() => setIg(false)}>
              {W(lang, "Back", "Atrás")}
            </button>
          </div>
        )}

        {note && <p className="mt-2 text-center text-[12.5px] font-semibold text-brand" role="status">{note}</p>}
      </div>
    </div>,
    document.body,
  );
}
