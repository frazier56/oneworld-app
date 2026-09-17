import { useState } from "react";
import { W, thumbFor, IconCheck, IconPlay } from "@oneworld/shell";
import type { FeedPreview } from "../lib/media";

/**
 * MEDIA CHOICES — the host picks a cover and what the feed leads with.
 * ============================================================================================
 * Two choices, and each one is ONE picture:
 *
 *   COVER          the still that leads the listing page and every profile / saved / my-
 *                  properties card. With one photo there is no choice and the row is not drawn.
 *   FEED PREVIEW   the ONE photo-or-video the Discover feed leads with. Independent of the cover:
 *                  a walk-through clip can sell the place in the feed while a tidy still stays
 *                  the cover. Defaults to the cover, which is what `null` means.
 *
 * ── ⚠️ IT USED TO SHOW EVERY PHOTO, TWICE (Lee, 15 Sep 2026) ────────────────────────────────
 * *"I don't know why you got four pictures for each one of those sections. It's two pictures.
 * One's going to be your cover photo, one's going to be your feed photo. Why are you showing four
 * thumbnails for each section? If you want to change it, you should just click change."*
 *
 * He is right, and the old shape made the point badly: two horizontal strips, each repeating the
 * entire photo set, so a listing with eight photos drew seventeen tiles to express two decisions.
 * The answer to "which one is my cover" was somewhere in a scroll strip with a tick on it.
 *
 * Now each row shows the ANSWER — one tile, the one that is chosen — and a Change button. The
 * strip still exists, but only while you are actually changing something, which is the few seconds
 * a year it is useful. Same two decisions, a fifth of the pixels.
 *
 * "Light up when configured" still holds: no disabled controls, no empty pickers, and a row that
 * has nothing to choose between is not drawn at all.
 *
 * Videos use `preload="metadata"` and never play here: the form is for choosing, and a form that
 * streams five clips while somebody types a description is a slow form.
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
  const [editing, setEditing] = useState<"cover" | "preview" | null>(null);
  const effectiveCover = cover && photos.includes(cover) ? cover : photos[0] ?? null;
  const showCover = photos.length > 1;
  const showPreview = photos.length > 1 || videos.length > 0;
  if (!showCover && !showPreview) return null;

  const previewIs = (kind: "photo" | "video", url: string) => preview?.kind === kind && preview.url === url;
  /* What the feed actually leads with right now, whatever the host has or has not chosen. */
  const feedLead: { kind: "photo" | "video"; url: string } | null =
    preview && (preview.kind === "video" ? videos : photos).includes(preview.url)
      ? { kind: preview.kind, url: preview.url }
      : effectiveCover ? { kind: "photo", url: effectiveCover } : null;

  return (
    <div className="space-y-4">
      {showCover && (
        <Choice
          lang={lang}
          title={W(lang, "Cover photo", "Foto de portada")}
          note={W(lang, "Leads the listing and your profile cards.",
                        "Encabeza el anuncio y las tarjetas de su perfil.")}
          current={effectiveCover ? { kind: "photo", url: effectiveCover } : null}
          open={editing === "cover"}
          onToggle={() => setEditing(editing === "cover" ? null : "cover")}
        >
          {photos.map(url => (
            <Tile key={url} kind="photo" url={url} on={url === effectiveCover}
              onPick={() => { onCover(url === photos[0] ? null : url); setEditing(null); }} />
          ))}
        </Choice>
      )}

      {showPreview && (
        <Choice
          lang={lang}
          title={W(lang, "What the feed shows first", "Lo primero que muestra el feed")}
          note={W(lang, "One photo or video leads your card in Discover. Videos play silently.",
                        "Una foto o un video encabeza su tarjeta en Descubrir. Los videos van sin sonido.")}
          current={feedLead}
          badge={preview == null ? W(lang, "Same as cover", "Igual que la portada") : undefined}
          open={editing === "preview"}
          onToggle={() => setEditing(editing === "preview" ? null : "preview")}
        >
          {/* "Same as cover" — the default, and what null means. */}
          {effectiveCover && (
            <Tile kind="photo" url={effectiveCover} on={preview == null} dim
              label={W(lang, "Cover", "Portada")}
              onPick={() => { onPreview(null); setEditing(null); }} />
          )}
          {videos.map(url => (
            <Tile key={url} kind="video" url={url} on={previewIs("video", url)}
              onPick={() => { onPreview({ kind: "video", url }); setEditing(null); }} />
          ))}
          {photos.map(url => (
            <Tile key={url} kind="photo" url={url} on={previewIs("photo", url)}
              onPick={() => { onPreview({ kind: "photo", url }); setEditing(null); }} />
          ))}
        </Choice>
      )}
    </div>
  );
}

/** One decision: its name, the picture that answers it, and a way to change it. */
function Choice({ lang, title, note, current, badge, open, onToggle, children }: {
  lang: string; title: string; note: string;
  current: { kind: "photo" | "video"; url: string } | null;
  badge?: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink/12 bg-ink/5 dark:border-white/15 dark:bg-white/5">
          {current?.kind === "video"
            ? <>
                <video src={current.url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                <span className="pointer-events-none absolute inset-0 grid place-items-center text-white">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-black/55 backdrop-blur-sm"><IconPlay size={12} /></span>
                </span>
              </>
            : current
              ? <img decoding="async" src={thumbFor(current.url)} alt="" loading="lazy" className="h-full w-full object-cover"
                  onError={e => { const t = e.currentTarget; if (t.src !== current.url) t.src = current.url; }} />
              : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold leading-snug">{title}</span>
          <span className="mt-0.5 block text-[11.5px] leading-snug opacity-55">{badge ? `${badge} · ${note}` : note}</span>
        </span>
        {/* A LABEL, NOT A SENTENCE. One word, and it says what the tap does. */}
        <button type="button" onClick={onToggle}
          className="ow-tap shrink-0 self-center rounded-full border border-ink/15 px-3 py-1.5 text-[12px] font-bold dark:border-white/20">
          {open ? W(lang, "Done", "Listo") : W(lang, "Change", "Cambiar")}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1">{children}</div>
      )}
    </div>
  );
}

function Tile({ kind, url, on, dim, label, onPick }: {
  kind: "photo" | "video"; url: string; on: boolean; dim?: boolean; label?: string; onPick: () => void;
}) {
  return (
    <button type="button" onClick={onPick} aria-pressed={on}
      className={`ow-tap relative h-20 w-20 shrink-0 snap-start overflow-hidden rounded-xl border-2 transition ${
        kind === "video" ? "bg-black " : ""}${on ? "border-brand" : "border-transparent"}`}>
      {kind === "video"
        ? <>
            <video src={url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-white">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-black/55 backdrop-blur-sm"><IconPlay size={14} /></span>
            </span>
          </>
        : <img decoding="async" src={thumbFor(url)} alt="" loading="lazy"
            className={`h-full w-full object-cover${dim ? " opacity-80" : ""}`}
            onError={e => { const t = e.currentTarget; if (t.src !== url) t.src = url; }} />}
      {label && (
        <span className="absolute inset-x-0 bottom-0 bg-ink/65 px-1 py-0.5 text-center text-[9.5px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
          {label}
        </span>
      )}
      {on && (
        <span className="pointer-events-none absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
          <IconCheck size={11} />
        </span>
      )}
    </button>
  );
}
