import { useEffect, useState } from "react";
import { Heart, MessageCircle, Share2, X } from "lucide-react";
import { W } from "@oneworld/shell";

export default function PublicVideoViewer({ videos, title, lang, contactHref }: {
  videos: string[]; title: string; lang: string; contactHref: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open == null) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = before; window.removeEventListener("keydown", key); };
  }, [open]);
  if (!videos.length) return null;

  const share = async () => {
    const data = { title, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
  };

  return <section className="space-y-3">
    <div className="flex items-end justify-between gap-3">
      <div><h2 className="text-lg font-black">{W(lang, "Videos", "Videos")}</h2><p className="text-xs opacity-55">{W(lang, "Tap to watch full screen", "Toque para ver en pantalla completa")}</p></div>
      <span className="text-xs font-black opacity-55">{videos.length} / 5</span>
    </div>
    <div className="flex snap-x gap-3 overflow-x-auto pb-1">
      {videos.map((url, index) => <button key={url} type="button" onClick={() => setOpen(index)}
        className="relative w-36 shrink-0 snap-start overflow-hidden rounded-[24px] bg-black shadow-lg sm:w-44">
        <video src={url} preload="metadata" muted playsInline className="aspect-[9/16] w-full object-cover" />
        <span className="absolute inset-x-3 bottom-3 rounded-full bg-black/60 px-3 py-2 text-xs font-black text-white backdrop-blur">{W(lang, "Watch", "Ver")}</span>
      </button>)}
    </div>
    {open != null && <div className="fixed inset-0 z-[2000] bg-[#070b10]" role="dialog" aria-modal="true" aria-label={W(lang, "Listing video", "Video del anuncio")}>
      <div className="mx-auto flex h-full max-w-xl snap-y snap-mandatory flex-col overflow-y-auto">
        {videos.map((url, index) => <article key={url} className="relative h-[100dvh] shrink-0 snap-start bg-black">
          <video src={url} controls autoPlay={index === open} playsInline preload="metadata" className="h-full w-full object-contain" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 text-white">
            <div className="min-w-0"><p className="truncate text-sm font-black">{title}</p><p className="text-xs opacity-70">{index + 1} / {videos.length}</p></div>
            <button type="button" onClick={() => setOpen(null)} className="grid h-11 w-11 place-items-center rounded-full bg-black/45 backdrop-blur" aria-label={W(lang, "Close", "Cerrar")}><X /></button>
          </div>
          <div className="absolute bottom-8 right-4 flex flex-col gap-3 text-white">
            <button type="button" disabled className="grid h-12 w-12 place-items-center rounded-full bg-black/50 backdrop-blur" aria-label={W(lang, "Like", "Me gusta")}><Heart /></button>
            <button type="button" onClick={() => void share()} className="grid h-12 w-12 place-items-center rounded-full bg-black/50 backdrop-blur" aria-label={W(lang, "Share", "Compartir")}><Share2 /></button>
            <a href={contactHref} className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white shadow-lg" aria-label={W(lang, "Contact host", "Contactar anfitrión")}><MessageCircle /></a>
          </div>
        </article>)}
      </div>
    </div>}
  </section>;
}
