import { getTierInfo, type BadgeTier } from "./badgeTiers";

/**
 * The publishable passport — rendered to a PNG on a canvas.
 * ============================================================================================
 * Moved into the shell with the passport. Drawn on a canvas, not screenshotted from the DOM:
 * `backdrop-filter` does not rasterise in html-to-image, a viewport screenshot is a thumbnail,
 * and a post carries different content from a settings screen. A purpose-built 1080×1080 card,
 * dark in both themes so it stops a thumb in a light feed.
 *
 * PRODUCT-AWARE: the wordmark and the "Verified on …" footer take the product's display name, and
 * the top-left bloom takes the product's hue, so OneScore's card reads OneScore and blooms amber
 * while OneJob's reads OneJob and blooms green — one implementation, eight faces.
 */
export interface PassportCardData {
  name: string;
  title: string | null;
  location: string | null;
  photoUrl: string | null;
  score: number | null;
  tier: BadgeTier;
  jobs: number;
  reviews: number;
  rating: number | null;   // out of 5
  platforms: number;
  /** Where the card sends people — shown as text on the card itself. */
  url: string;
  /** The product that drew it, for the wordmark + footer. Defaults to "One World". */
  productName?: string;
  /** The product's identity hue, for the corner bloom. Defaults to OneJob green. */
  accentBloom?: string;
}

const W = 1080;
const H = 1080;

/** Rounded-rect path. Canvas has `roundRect` now but not on Safari < 16.4, which is still live. */
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

function rgbOf(hex: string): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map(x => x + x).join("");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Load the avatar with CORS enabled; fall back to the monogram on any failure. */
function loadAvatar(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(img.complete && img.naturalWidth ? img : null), 4000);
  });
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?";
}

export async function drawPassportCard(d: PassportCardData): Promise<Blob> {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  const tier = getTierInfo(d.tier);
  const accent = tier.textColor;
  const product = d.productName ?? "One World";
  const bloomRgb = rgbOf(d.accentBloom ?? "#17A45C");

  // ── Background: deep navy with the product's hue blooming top-left ──
  c.fillStyle = "#0B0F1A";
  c.fillRect(0, 0, W, H);
  const bloom = c.createRadialGradient(180, 120, 0, 180, 120, 900);
  bloom.addColorStop(0, `rgba(${bloomRgb},0.42)`);
  bloom.addColorStop(0.55, `rgba(${bloomRgb},0.10)`);
  bloom.addColorStop(1, `rgba(${bloomRgb},0)`);
  c.fillStyle = bloom;
  c.fillRect(0, 0, W, H);
  const tint = c.createRadialGradient(W - 120, H - 80, 0, W - 120, H - 80, 760);
  tint.addColorStop(0, `${accent}22`);
  tint.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = tint;
  c.fillRect(0, 0, W, H);

  // ── The card face ──
  const M = 64;
  rr(c, M, M, W - M * 2, H - M * 2, 56);
  const face = c.createLinearGradient(M, M, W - M, H - M);
  face.addColorStop(0, "rgba(255,255,255,0.10)");
  face.addColorStop(0.45, "rgba(255,255,255,0.035)");
  face.addColorStop(1, "rgba(255,255,255,0.05)");
  c.fillStyle = face;
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.16)";
  c.lineWidth = 2;
  c.stroke();

  // The premium sheen — one diagonal highlight across the top-left corner, clipped to the card.
  c.save();
  rr(c, M, M, W - M * 2, H - M * 2, 56);
  c.clip();
  const sheen = c.createLinearGradient(M, M, M + 620, M + 520);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0.03)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = sheen;
  c.fillRect(M, M, W - M * 2, H - M * 2);
  c.restore();

  const L = M + 56;                 // left text margin inside the card
  const R = W - M - 56;

  // ── Header: wordmark + tier pill ──
  c.font = "700 30px system-ui, -apple-system, 'Segoe UI', sans-serif";
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.textBaseline = "middle";
  c.fillText(`${product.toUpperCase()}  ·  REPUTATION PASSPORT`, L, M + 72);

  const tierLabel = tier.label.toUpperCase();
  c.font = "800 26px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const tw = c.measureText(tierLabel).width;
  rr(c, R - tw - 44, M + 50, tw + 44, 46, 23);
  c.fillStyle = `${accent}26`;
  c.fill();
  c.strokeStyle = `${accent}66`;
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = accent;
  c.textAlign = "center";
  c.fillText(tierLabel, R - tw / 2 - 22, M + 74);
  c.textAlign = "left";

  // ── The score, leading ──
  const scoreY = 322;
  c.textBaseline = "alphabetic";
  if (d.score != null) {
    c.font = "800 210px system-ui, -apple-system, 'Segoe UI', sans-serif";
    const g = c.createLinearGradient(L, scoreY - 150, L + 420, scoreY);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(1, accent);
    c.fillStyle = g;
    const whole = String(Math.floor(d.score));
    c.fillText(whole, L, scoreY);
    let x = L + c.measureText(whole).width;
    c.font = "800 78px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillStyle = "rgba(255,255,255,0.55)";
    const tenth = `.${Math.round((d.score - Math.floor(d.score)) * 10)}`;
    c.fillText(tenth, x + 6, scoreY);
    x += 6 + c.measureText(tenth).width;
    c.font = "700 34px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillStyle = "rgba(255,255,255,0.42)";
    c.fillText("/ 100", x + 18, scoreY - 6);
  } else {
    c.font = "800 96px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.fillText("New", L, scoreY - 40);
  }
  c.font = "700 30px system-ui, -apple-system, 'Segoe UI', sans-serif";
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.fillText("ONESCORE", L, scoreY + 48);

  // ── The person ──
  const py = 456;
  const AV = 132;
  c.save();
  rr(c, L, py, AV, AV, 34);
  c.clip();
  const av = await loadAvatar(d.photoUrl);
  if (av) {
    const scale = Math.max(AV / av.naturalWidth, AV / av.naturalHeight);
    const dw = av.naturalWidth * scale, dh = av.naturalHeight * scale;
    try { c.drawImage(av, L + (AV - dw) / 2, py + (AV - dh) / 2, dw, dh); }
    catch { c.fillStyle = "#1B2233"; c.fillRect(L, py, AV, AV); }
  } else {
    c.fillStyle = "#1B2233";
    c.fillRect(L, py, AV, AV);
    c.fillStyle = accent;
    c.font = "800 56px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(initials(d.name), L + AV / 2, py + AV / 2);
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
  }
  c.restore();
  rr(c, L, py, AV, AV, 34);
  c.strokeStyle = `${accent}88`;
  c.lineWidth = 4;
  c.stroke();

  const tx = L + AV + 32;
  c.fillStyle = "#FFFFFF";
  c.font = "800 52px system-ui, -apple-system, 'Segoe UI', sans-serif";
  c.fillText(fit(c, d.name, R - tx), tx, py + 54);
  if (d.title) {
    c.fillStyle = accent;
    c.font = "700 32px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillText(fit(c, d.title, R - tx), tx, py + 100);
  }
  if (d.location) {
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.font = "500 28px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillText(fit(c, d.location, R - tx), tx, py + 140);
  }

  // ── Track record ── (only counts the app actually holds; nothing estimated)
  const cells: [string, string][] = [
    [String(d.jobs), "JOBS DONE"],
    [d.rating != null ? d.rating.toFixed(1) : "—", "RATING"],
    [String(d.reviews), "REVIEWS"],
    [String(d.platforms), "LINKED"],
  ];
  const gy = 690, gh = 150, gap = 18;
  const gw = (R - L - gap * 3) / 4;
  cells.forEach(([v, l], i) => {
    const x = L + i * (gw + gap);
    rr(c, x, gy, gw, gh, 26);
    c.fillStyle = "rgba(255,255,255,0.05)";
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.10)";
    c.lineWidth = 2;
    c.stroke();
    c.textAlign = "center";
    c.fillStyle = "#FFFFFF";
    c.font = "800 54px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillText(v, x + gw / 2, gy + 82);
    c.fillStyle = "rgba(255,255,255,0.42)";
    c.font = "700 20px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillText(l, x + gw / 2, gy + 118);
    c.textAlign = "left";
  });

  // ── Footer: the HOST only, plus "Verified on <product>" when it clears ──
  let host = d.url;
  try { host = new URL(d.url).host; } catch { host = d.url.replace(/^https?:\/\//, "").split("/")[0]; }
  const fy = H - M - 62;
  c.font = "600 26px system-ui, -apple-system, 'Segoe UI', sans-serif";
  c.fillStyle = "rgba(255,255,255,0.30)";
  c.fillText(host, L, fy);
  const hostEnd = L + c.measureText(host).width;
  const rightLabel = `Verified on ${product}`;
  if (R - c.measureText(rightLabel).width > hostEnd + 40) {
    c.textAlign = "right";
    c.fillText(rightLabel, R, fy);
    c.textAlign = "left";
  }

  return new Promise<Blob>((resolve, reject) => {
    cv.toBlob(b => (b ? resolve(b) : reject(new Error("Could not render the passport image."))), "image/png");
  });
}

/** Trim to width with an ellipsis, using whatever font is currently set on the context. */
function fit(c: CanvasRenderingContext2D, text: string, max: number) {
  if (c.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && c.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

/**
 * THE PORTABLE BADGE — a fixture that lives on a profile permanently, not a post. 900×220, tier
 * coloured, matching the passport it opens.
 */
export async function drawPortableBadge(
  d: Pick<PassportCardData, "score" | "tier"> & { productName?: string },
): Promise<Blob> {
  const W2 = 900, H2 = 220, P = 10;
  const cv = document.createElement("canvas");
  cv.width = W2; cv.height = H2;
  const c = cv.getContext("2d")!;
  const accent = getTierInfo(d.tier).textColor;
  const product = d.productName ?? "One World";

  c.clearRect(0, 0, W2, H2);
  const r = (H2 - P * 2) / 2;
  rr(c, P, P, W2 - P * 2, H2 - P * 2, r);
  const g = c.createLinearGradient(P, P, W2 - P, H2 - P);
  g.addColorStop(0, accent);
  g.addColorStop(1, shade(accent, -0.22));
  c.fillStyle = g;
  c.shadowColor = `${accent}66`;
  c.shadowBlur = 34;
  c.shadowOffsetY = 6;
  c.fill();
  c.shadowColor = "transparent";
  c.shadowBlur = 0;

  const dark = "#241E19";
  c.strokeStyle = dark;
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(96, 82); c.lineTo(96, 118); c.quadraticCurveTo(96, 142, 122, 152);
  c.quadraticCurveTo(148, 142, 148, 118); c.lineTo(148, 82); c.lineTo(122, 70); c.closePath();
  c.stroke();

  c.fillStyle = dark;
  c.textBaseline = "alphabetic";
  const title = `${product} Reputation Passport`;
  const titleX = 186, titleMax = W2 - 236 - 28 - titleX;
  let titleSize = 40;
  do {
    c.font = `800 ${titleSize}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    if (c.measureText(title).width <= titleMax) break;
    titleSize -= 1;
  } while (titleSize > 22);
  c.fillText(title, titleX, 104);
  c.font = `600 ${Math.round(titleSize * 0.7)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  c.globalAlpha = 0.7;
  c.fillText("Tap to open", titleX, 146);
  c.globalAlpha = 1;

  c.strokeStyle = `${dark}55`;
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(W2 - 236, 56); c.lineTo(W2 - 236, H2 - 56); c.stroke();

  c.textAlign = "center";
  if (d.score != null) {
    const whole = String(Math.floor(d.score));
    const tenth = `.${Math.round((d.score - Math.floor(d.score)) * 10)}`;
    c.font = "800 84px system-ui, -apple-system, 'Segoe UI', sans-serif";
    const wW = c.measureText(whole).width;
    c.font = "800 40px system-ui, -apple-system, 'Segoe UI', sans-serif";
    const tW = c.measureText(tenth).width;
    const cx = W2 - 128, total = wW + tW;
    c.textAlign = "left";
    c.font = "800 84px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillText(whole, cx - total / 2, 138);
    c.font = "800 40px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillText(tenth, cx - total / 2 + wW + 4, 138);
  } else {
    c.font = "800 52px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillText("New", W2 - 128, 128);
  }

  return new Promise<Blob>((res, rej) => {
    cv.toBlob(b => (b ? res(b) : rej(new Error("Could not render the badge."))), "image/png");
  });
}

/** Lighten (+) or darken (−) a #rrggbb by a fraction. */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v =>
    Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v : 255 - v) * amt))));
  return `#${ch.map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
