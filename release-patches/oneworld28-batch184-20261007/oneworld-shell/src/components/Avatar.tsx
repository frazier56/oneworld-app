import { useEffect, useState } from "react";
import { IconUser } from "./ActionIcons";

/* ── THUMBNAILS, AND NEVER AN EMPTY CIRCLE (UAT, 30 Sep 2026) ───────────────────────────────
   Signed-in Messages showed blank circles beside real people. The photos were fine — 0.9 to
   1.5 MB full-size portraits, fetched to fill a 44px circle, still downloading on a phone
   connection. Two fixes:
   1. A Storage photo is asked for through the render endpoint at twice the drawn size
      (≈20 KB instead of 1.5 MB).
   2. The initials are ALWAYS drawn; the photo sits on top and fades in once it has loaded. A
      slow or broken photo leaves the initials, never a hole. */
function thumb(src: string, size: number): string {
  const marker = "/storage/v1/object/public/";
  const i = src.indexOf(marker);
  if (i === -1 || /\.(gif|svg)(\?|$)/i.test(src)) return src;
  const px = Math.min(512, Math.round(size * 2));
  return `${src.slice(0, i)}/storage/v1/render/image/public/${src.slice(i + marker.length).split("?")[0]}?width=${px}&height=${px}&resize=cover&quality=80`;
}

export default function Avatar({ src, name, size = 56, rounded = "rounded-2xl", textSize = "text-xl" }:
  { src?: string | null; name?: string | null; size?: number; rounded?: string; textSize?: string }) {
  const [broken, setBroken] = useState(false);
  const [triedFull, setTriedFull] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setBroken(false); setTriedFull(false); setLoaded(false); }, [src]);
  const url = src && !broken ? (triedFull ? src : thumb(src, size)) : null;
  return (
    <div style={{ width: size, height: size }}
      className={`relative grid shrink-0 place-items-center overflow-hidden border border-brand/25 bg-gradient-to-br from-brand/25 via-white/55 to-brand/10 font-black text-brand shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_4px_16px_rgba(120,60,12,.12)] dark:via-white/10 ${rounded} ${textSize}`}>
      {initials(name) ?? <IconUser size={Math.round(size * 0.52)} />}
      {url && (
        <img decoding="async" src={url} alt="" loading="lazy"
          onLoad={() => setLoaded(true)}
          /* The render endpoint can refuse an odd file; try the original once before giving up. */
          onError={() => { if (!triedFull && url !== src) setTriedFull(true); else setBroken(true); }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"} ${rounded}`} />
      )}
    </div>
  );
}

function initials(name?: string | null): string | null {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}
