import { W, thumbFor, IconCheck, IconPlay } from "@oneworld/shell";
import type { FeedPreview } from "../lib/media";

/**
 * MEDIA CHOICES — the host picks a cover and what the feed leads with (7 Sep 2026, media lane).
 * ============================================================================================
 * Two pickers, both optional, both drawn only once there is something to choose between:
 *
 *   COVER          which still photo leads the listing page and every profile / saved / my-
 *                  properties card. Hidden with one photo — that photo IS the cover.
 *   FEED PREVIEW   the ONE photo-or-video the Discover feed leads with. Independent of the cover:
 *                  a walk-through clip can sell the place in the feed while a tidy still stays
 *                  the cover. Hidden with one photo and no videos — nothing to choose.
 *
 * "Light up when configured": no disabled controls, no empty pickers. The first tile of the
 * preview row is "Same as cover", which is what `null` means and what every listing had before.
 *
 * Videos are drawn with `preload="metadata"` and never play here: the form is for choosing, and
 * a form that streams five clips while somebody types a description is a slow form.
 */
export default function MediaChoices({ photos, videos, cover, onCover, preview, onPreview, lang }: {
  photos: string[];
  videos: string[];
  cover: string | null;
  onCover: (url: string | null) => void;
  preview: FeedPreview | null;
  onPreview: (next: FeedPreview | null) => void;
  lang: string;
}) {
  const effectiveCover = cover && photos.includes(cover) ? cover : photos[0] ?? null;
  const showCover = photos.length > 1;
  const showPreview = photos.length > 1 || videos.length > 0;
  if (!showCover && !showPreview) return null;

  const previewIs = (kind: "photo" | "video", url: string) => preview?.kind === kind && preview.url === url;

  return (
    <div className="space-y-4">
      {showCover && (
        <div>
          <p className="text-[13.5px] font-bold">{W(lang, "Cover photo", "Foto de portada")}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-55">
            {W(lang, "The still that leads the listing and your profile cards. Tap one to choose it.",
                     "La foto que encabeza el anuncio y las tarjetas de su perfil. Toque una para elegirla.")}
          </p>
          <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
            {photos.map(url => {
              const on = url === effectiveCover;
              return (
                <button key={url} type="button" onClick={() => onCover(url === photos[0] ? null : url)}
                  aria-pressed={on}
                  className={`ow-tap relative h-20 w-20 shrink-0 snap-start overflow-hidden rounded-xl border-2 transition ${
                    on ? "border-brand" : "border-transparent"}`}>
                  <img src={thumbFor(url)} alt="" loading="lazy" className="h-full w-full object-cover"
                    onError={e => { const t = e.currentTarget; if (t.src !== url) t.src = url; }} />
                  {on && <Tick label={W(lang, "Cover", "Portada")} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showPreview && (
        <div>
          <p className="text-[13.5px] font-bold">{W(lang, "What the feed shows first", "Lo primero que muestra el feed")}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-55">
            {W(lang, "One photo or one video leads your card in Discover. Videos play silently; people tap through for sound.",
                     "Una foto o un video encabeza su tarjeta en Descubrir. Los videos se reproducen sin sonido; la gente toca para escucharlo.")}
          </p>
          <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
            {/* "Same as cover" — the default, and what null means. */}
            <button type="button" onClick={() => onPreview(null)} aria-pressed={preview == null}
              className={`ow-tap relative h-20 w-20 shrink-0 snap-start overflow-hidden rounded-xl border-2 transition ${
                preview == null ? "border-brand" : "border-transparent"}`}>
              {effectiveCover
                ? <img src={thumbFor(effectiveCover)} alt="" loading="lazy" className="h-full w-full object-cover opacity-80"
                    onError={e => { const t = e.currentTarget; if (t.src !== effectiveCover) t.src = effectiveCover; }} />
                : <div className="h-full w-full bg-ink/5 dark:bg-white/5" />}
              <span className="absolute inset-x-0 bottom-0 bg-ink/65 px-1 py-0.5 text-center text-[9.5px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
                {W(lang, "Cover", "Portada")}
              </span>
              {preview == null && <Tick />}
            </button>
            {videos.map(url => {
              const on = previewIs("video", url);
              return (
                <button key={url} type="button" onClick={() => onPreview({ kind: "video", url })} aria-pressed={on}
                  className={`ow-tap relative h-20 w-20 shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-black transition ${
                    on ? "border-brand" : "border-transparent"}`}>
                  <video src={url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                  <span className="pointer-events-none absolute inset-0 grid place-items-center text-white">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-black/55 backdrop-blur-sm"><IconPlay size={14} /></span>
                  </span>
                  {on && <Tick label={W(lang, "Video", "Video")} />}
                </button>
              );
            })}
            {photos.map(url => {
              const on = previewIs("photo", url);
              return (
                <button key={url} type="button" onClick={() => onPreview({ kind: "photo", url })} aria-pressed={on}
                  className={`ow-tap relative h-20 w-20 shrink-0 snap-start overflow-hidden rounded-xl border-2 transition ${
                    on ? "border-brand" : "border-transparent"}`}>
                  <img src={thumbFor(url)} alt="" loading="lazy" className="h-full w-full object-cover"
                    onError={e => { const t = e.currentTarget; if (t.src !== url) t.src = url; }} />
                  {on && <Tick />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Tick({ label }: { label?: string }) {
  return (
    <span className="pointer-events-none absolute left-1 top-1 flex items-center gap-1 rounded-full bg-brand px-1.5 py-0.5 text-[9.5px] font-black text-white">
      <IconCheck size={10} />{label}
    </span>
  );
}
