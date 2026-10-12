/**
 * composeFlyer — the Instagram-ready image for anything shared, in every One World app.
 * ============================================================================================
 * PROMOTED from OneEvent's ShareToInstagram (18 Aug 2026) on 30 Sep 2026, so OneHome, OneJob
 * and OneSocial share the same compositor instead of each growing its own. OneEvent passes its
 * amber brand and its own QR image and gets the same flyer it always had.
 *
 * Instagram cannot take a link in a post and will not accept one attached to a Story from the
 * web, so the flyer IS the post: photo, a badge that says what it is (FOR SALE, FOR RENT, a date),
 * the title, the price, and the short link printed large. The share sheet copies the link to the
 * clipboard at the same moment, so the person pastes it into the Link sticker in one tap.
 *
 * STORY SAFE ZONE (new, 30 Sep 2026): Instagram draws its own reply bar over the bottom ~250px
 * of a 1080×1920 story and the profile row over the top ~250px. The footer now sits ABOVE the
 * bottom band, so the title and link are never hidden under "Send message".
 */
export type FlyerFormat = "story" | "post";
export type FlyerBrand = { label: string; accentFrom: string; accentTo: string; ink?: string };

export const FLYER_BRANDS: Record<"onehome" | "oneevent" | "onejob" | "onesocial", FlyerBrand> = {
  onehome:   { label: "ONEHOME",   accentFrom: "#14B8A6", accentTo: "#0F766E" },
  oneevent:  { label: "ONEEVENT",  accentFrom: "#F59E0B", accentTo: "#C2410C" },
  onejob:    { label: "ONEJOB",    accentFrom: "#9258E8", accentTo: "#6D28D9" },
  onesocial: { label: "ONESOCIAL", accentFrom: "#14B8A6", accentTo: "#0E7490" },
};

export const FLYER_SIZE: Record<FlyerFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  let s = text;
  while (ctx.measureText(s).width > maxW && s.length > 4) s = s.slice(0, -2);
  return s === text ? s : s.replace(/.$/, "…");
}

export async function composeFlyer(o: {
  format: FlyerFormat;
  /** No photo (most jobs, some profiles) → a drawn brand poster with the title large. Lee: every
      share is an image, never a bare link. */
  coverUrl?: string | null;
  link: string;
  title: string;
  /** Short line above the title — "EN VENTA · MEDELLÍN", "SÁB 25 JULIO". */
  kicker?: string;
  /** The line under the title — the price, the venue. */
  detail?: string;
  /** A pill drawn on the photo, top-left — "FOR SALE". */
  badge?: string;
  brand: FlyerBrand;
  /** Optional ready-made QR image (OneEvent prints one; listings do not need one). */
  qrDataUrl?: string;
  /** JPEG by default (a third of the size); OneEvent keeps the PNG its download names promise. */
  mime?: "image/jpeg" | "image/png";
}): Promise<Blob> {
  const { w, h } = FLYER_SIZE[o.format];
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unsupported");

  const safeBottom = o.format === "story" ? 250 : 0;
  const footerH = o.format === "story" ? 330 : 300;
  const footerY = h - safeBottom - footerH;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  const innerH = footerY, innerW = w;
  const margin = 60, topPad = o.format === "story" ? 250 : 60;
  let dx = margin, dy = topPad;
  if (!o.coverUrl) {
    /* The drawn poster: the brand's gradient, the title set large and wrapped. */
    const g = ctx.createLinearGradient(0, 0, innerW, innerH);
    g.addColorStop(0, o.brand.accentFrom); g.addColorStop(1, o.brand.accentTo);
    ctx.fillStyle = g; ctx.fillRect(0, 0, innerW, innerH);
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(0, 0, innerW, innerH);
    ctx.fillStyle = "#FFFFFF"; ctx.textBaseline = "top";
    const size = o.format === "story" ? 96 : 84;
    ctx.font = `800 ${size}px system-ui, -apple-system, sans-serif`;
    const maxW = innerW - margin * 2, lines: string[] = [];
    let line = "";
    for (const word of o.title.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 5);
    if (lines.length > 5) shown[4] = fit(ctx, shown[4] + "…", maxW);
    const lh = size * 1.12, blockH = shown.length * lh;
    let y = Math.max(topPad + 110, (innerH - blockH) / 2);
    for (const l of shown) { ctx.fillText(fit(ctx, l, maxW), margin, y); y += lh; }
    dx = margin - 28; dy = topPad - 28;
  } else {
  const cover = await loadImage(o.coverUrl);
  const ratio = cover.naturalWidth / cover.naturalHeight;

  // Blurred fill, then the photo at its own aspect on top.
  ctx.save();
  ctx.filter = "blur(40px)";
  const fr = innerW / innerH;
  let fbW: number, fbH: number;
  if (ratio > fr) { fbH = innerH * 1.2; fbW = fbH * ratio; } else { fbW = innerW * 1.2; fbH = fbW / ratio; }
  ctx.drawImage(cover, (innerW - fbW) / 2, (innerH - fbH) / 2, fbW, fbH);
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, innerW, innerH);

  const maxW = innerW - margin * 2, maxH = innerH - topPad - margin;
  let dw = maxW, dh = dw / ratio;
  if (dh > maxH) { dh = maxH; dw = dh * ratio; }
  dx = (innerW - dw) / 2; dy = topPad + (maxH - dh) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  roundRect(ctx, dx, dy, dw, dh, 24);
  ctx.clip();
  ctx.drawImage(cover, dx, dy, dw, dh);
  ctx.restore();
  }

  if (o.badge) {
    ctx.font = "800 34px system-ui, -apple-system, sans-serif";
    const tw = ctx.measureText(o.badge).width;
    const bx = dx + 28, by = dy + 28, bw = tw + 48, bh = 64;
    if (o.coverUrl) {
      const g = ctx.createLinearGradient(bx, by, bx + bw, by);
      g.addColorStop(0, o.brand.accentFrom); g.addColorStop(1, o.brand.accentTo);
      ctx.fillStyle = g;
    } else ctx.fillStyle = "#FFFFFF";   // on the brand poster a gradient pill would vanish
    roundRect(ctx, bx, by, bw, bh, 32); ctx.fill();
    ctx.fillStyle = o.coverUrl ? "#FFFFFF" : o.brand.accentTo; ctx.textBaseline = "middle";
    ctx.fillText(o.badge, bx + 24, by + bh / 2 + 1);
  }

  // Footer band + accent rule.
  ctx.fillStyle = "rgba(0,0,0,0.92)";
  ctx.fillRect(0, footerY, w, footerH + safeBottom);
  const accent = ctx.createLinearGradient(0, footerY, w, footerY);
  accent.addColorStop(0, o.brand.accentFrom); accent.addColorStop(1, o.brand.accentTo);
  ctx.fillStyle = accent;
  ctx.fillRect(0, footerY, w, 4);

  let textRight = w - 60;
  if (o.qrDataUrl) {
    const q = await loadImage(o.qrDataUrl);
    const qs = 168;
    const qx = w - qs - 40, qy = footerY + (footerH - qs) / 2;
    ctx.drawImage(q, qx, qy, qs, qs);
    textRight = qx - 30;
  }
  const tx = 60, tmax = textRight - tx;
  ctx.textBaseline = "top";
  ctx.fillStyle = o.brand.accentFrom;
  ctx.font = "700 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(fit(ctx, [o.brand.label, o.kicker].filter(Boolean).join("  ·  ").toUpperCase(), tmax), tx, footerY + 34);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 44px system-ui, -apple-system, sans-serif";
  ctx.fillText(fit(ctx, o.title, tmax), tx, footerY + 76);
  if (o.detail) {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "600 36px system-ui, -apple-system, sans-serif";
    ctx.fillText(fit(ctx, o.detail, tmax), tx, footerY + 140);
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 34px system-ui, -apple-system, sans-serif";
  /* Never print a letters-and-numbers backend address on an image (Lee). Until the short domain is
     live the flyer carries the brand address; the tappable link rides in the story's link sticker. */
  const shown = /supabase\.co/.test(o.link) ? "oneworldlabs.ai" : o.link.replace(/^https?:\/\//, "").split("?")[0];
  ctx.fillText(fit(ctx, shown, tmax), tx, footerY + (o.detail ? 204 : 150));

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("blob-failed"))), o.mime ?? "image/jpeg", 0.9));
}
