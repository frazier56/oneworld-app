/**
 * RICH TEXT FOR PROSE ABOUT A PERSON — one set of helpers for every field that can now carry
 * bold, underline, strike-through, colour, size and lists (Lee, 12 Oct 2026: *"the whole biography
 * section… should have the whole little formatting buttons at the top… the same exact code that we
 * use for all the other descriptions"*).
 *
 * A bio was plain text for its whole life, so every reader of it has to cope with BOTH shapes:
 * years of plain text, and HTML from the editor from now on. `looksLikeHtml` tells them apart;
 * `plainToHtml` lifts old text into the editor without losing its line breaks; `richToText` is the
 * one way to measure, search or quote a bio; and `sanitizeRichHtml` is the ONLY door through which
 * a member's HTML reaches someone else's screen.
 *
 * ⚠️ THE SANITIZER IS AN ALLOW-LIST, NOT A BLOCK-LIST. A bio is written by one member and rendered
 * on strangers' screens, which is the textbook stored-XSS shape. The older `sanitizeHtml` in
 * mdToHtml.ts strips a list of known-bad things with regular expressions; this one rebuilds the
 * fragment from scratch and keeps only the handful of tags and the two style properties the
 * editor can actually produce. Anything it does not recognise is reduced to its text.
 */

const ALLOWED_TAGS = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "UL", "OL", "LI", "SPAN", "FONT"]);
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "SELECT", "BUTTON", "FORM", "HEAD", "TITLE"]);
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\)|[a-z]{3,20})$/i;

export function looksLikeHtml(s: string | null | undefined): boolean {
  return !!s && /<\/?(p|div|br|b|strong|i|em|u|s|strike|del|ul|ol|li|span|font)\b[^>]*>/i.test(s);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Old plain-text bio → editor HTML, keeping paragraphs and single line breaks. */
export function plainToHtml(s: string | null | undefined): string {
  const t = (s ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return "";
  if (looksLikeHtml(t)) return t;
  return t.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Text only — for counting, searching, completeness scores and anything that is not a screen. */
export function richToText(s: string | null | undefined): string {
  if (!s) return "";
  if (!looksLikeHtml(s)) return s;
  return s
    .replace(/<\s*(script|style|iframe|object|embed|svg|noscript|template)[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanStyle(style: string): string {
  const out: string[] = [];
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const val = decl.slice(i + 1).trim();
    if (prop === "color" && COLOR_RE.test(val)) out.push(`color:${val}`);
    else if (prop === "font-size" && /^(x{0,2}-?(small|large)|medium|\d{1,2}(\.\d+)?(px|em|rem|%))$/i.test(val)) out.push(`font-size:${val}`);
    else if ((prop === "font-weight") && /^(bold|bolder|normal|[1-9]00)$/i.test(val)) out.push(`font-weight:${val}`);
    else if (prop === "font-style" && /^(italic|normal)$/i.test(val)) out.push(`font-style:${val}`);
    else if (prop === "text-decoration" || prop === "text-decoration-line") {
      if (/^(underline|line-through|none)(\s+(underline|line-through))?$/i.test(val)) out.push(`text-decoration:${val}`);
    }
  }
  return out.join(";");
}

/** The only door from a member's HTML to another member's screen. Browser-only (uses DOMParser). */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return esc(richToText(html));
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  const walk = (node: Node): string => {
    if (node.nodeType === 3) return esc(node.textContent ?? "");
    if (node.nodeType !== 1) return "";
    const el = node as Element;
    if (DROP_TAGS.has(el.tagName.toUpperCase())) return ""; // never keep even their text
    const inner = Array.from(el.childNodes).map(walk).join("");
    const tag = el.tagName.toUpperCase();
    if (!ALLOWED_TAGS.has(tag)) return inner; // unknown tag → its text only
    if (tag === "BR") return "<br>";
    let attrs = "";
    const style = cleanStyle(el.getAttribute("style") ?? "");
    if (tag === "FONT") {
      const color = el.getAttribute("color") ?? "";
      const size = el.getAttribute("size") ?? "";
      const parts: string[] = [];
      if (COLOR_RE.test(color)) parts.push(`color:${color}`);
      const px: Record<string, string> = { "1": "0.75em", "2": "0.85em", "3": "1em", "4": "1.15em", "5": "1.35em", "6": "1.6em", "7": "2em" };
      if (px[size]) parts.push(`font-size:${px[size]}`);
      if (style) parts.push(style);
      return parts.length ? `<span style="${parts.join(";")}">${inner}</span>` : inner;
    }
    if (style) attrs = ` style="${style}"`;
    const t = tag.toLowerCase();
    return `<${t}${attrs}>${inner}</${t}>`;
  };
  return Array.from(root.childNodes).map(walk).join("");
}
