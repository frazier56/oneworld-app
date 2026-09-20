import { useEffect, useRef, useState } from "react";
import { MessageCircle, Play, Share2, X } from "lucide-react";
import { W } from "@oneworld/shell";

/* ⚠️ THIS USED TO BE A ROW OF PORTRAIT THUMBNAILS AND IT LOOKED WRONG. — 16 Sep 2026
   Lee: *"You see two videos kind of stacked together on the screen, which doesn't look good at
   all. It should just be one video. And then you should be able to swipe left and right."*

   He is right, and the reason is consistency, not taste. The feed shows ONE square you swipe
   through. A listing that instead shows a shelf of half-width 9:16 tiles is a second, different
   way to look at the same media, three taps after the first one — so the gesture a person just
   learned stops working on the very next screen. One square, swipe, tap for full screen: the
   same on both, which means there is only one thing to learn.

   ⚠️ Square, not 9:16. The feed card is square and these sit inches apart in the same session. */
export default function PublicVideoViewer({ videos, title, lang, contactHref, poster }: {
  videos: string[]; title: string; lang: string; contactHref: string; poster?: string | null;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
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
      <div><h2 className="text-lg font-black">{W(lang, "Videos", "Videos")}</h2><p className="text-xs opacity-55">{W(lang, "Swipe for more · tap to watch with sound", "Deslice para ver más · toque para oír")}</p></div>
    </div>
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <div
        onScroll={e => {
          const el = e.currentTarget;
          const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (n !== idx) setIdx(n);
        }}
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x pan-y", scrollbarWidth: "none" }}>
        {videos.map((url, index) => (
          <button key={url} type="button" onClick={() => setOpen(index)}
            className="relative block h-full w-full shrink-0 snap-center"
            aria-label={W(lang, "Play video", "Reproducir video") + " " + (index + 1) + " / " + videos.length}>
            <DeckVideo url={url} poster={poster} />
            {/* The play mark is the only thing that says "there is sound and more of this
                behind a tap". Without it a muted silent loop reads as an animated photo. */}
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
                <Play className="h-6 w-6 translate-x-[1px]" />
              </span>
            </span>
          </button>
        ))}
      </div>
      {videos.length> 1 && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black tabular-nums text-white backdrop-blur">
          {idx + 1} / {videos.length}
        </span>
      )}
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
            {/* ⚠️ A DISABLED HEART WAS HERE. It advertised a feature and then refused it, which
                is the "hidden, not disabled" rule in the architecture skill and Lee's own
                standing line about controls that half work. It is gone until liking exists. */}
            <button type="button" onClick={() => void share()} className="grid h-12 w-12 place-items-center rounded-full bg-black/50 backdrop-blur" aria-label={W(lang, "Share", "Compartir")}><Share2 /></button>
            <a href={contactHref} className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white shadow-lg" aria-label={W(lang, "Contact host", "Contactar anfitrión")}><MessageCircle /></a>
          </div>
        </article>)}
      </div>
    </div>}
  </section>;
}

/* The deck tile: muted, looping, and playing only while it is the slide on screen. Same rule as
   the feed — a listing with five videos must not stream five of them because somebody opened the
   page. The poster means the tile is a picture, never a black hole, before any of that happens. */
function DeckVideo({ url, poster }: { url: string; poster?: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void el.play().catch(() => undefined);
      else el.pause();
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); el.pause(); };
  }, [url]);
  return <video ref={ref} src={url} poster={poster ?? undefined} muted playsInline loop
    preload="metadata" className="h-full w-full object-cover" />;
}
