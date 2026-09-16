import { useState } from "react";

export default function Avatar({ src, name, size = 56, rounded = "rounded-2xl", textSize = "text-xl" }:
  { src?: string | null; name?: string | null; size?: number; rounded?: string; textSize?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img src={src} onError={() => setBroken(true)} style={{ width: size, height: size }}
      className={`shrink-0 object-cover ${rounded}`} alt="" loading="lazy" />;
  }
  return (
    <div style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center bg-brand/15 font-bold text-brand ${rounded} ${textSize}`}>
      {name?.trim()?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
