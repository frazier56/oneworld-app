import { useState } from "react";
import { IconUser } from "./ActionIcons";

export default function Avatar({ src, name, size = 56, rounded = "rounded-2xl", textSize = "text-xl" }:
  { src?: string | null; name?: string | null; size?: number; rounded?: string; textSize?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img src={src} onError={() => setBroken(true)} style={{ width: size, height: size }}
      className={`shrink-0 object-cover ${rounded}`} alt="" loading="lazy" />;
  }
  return (
    <div style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center border border-brand/25 bg-gradient-to-br from-brand/25 via-white/55 to-brand/10 font-black text-brand shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_4px_16px_rgba(120,60,12,.12)] dark:via-white/10 ${rounded} ${textSize}`}>
      {initials(name) ?? <IconUser size={Math.round(size * 0.52)} />}
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
