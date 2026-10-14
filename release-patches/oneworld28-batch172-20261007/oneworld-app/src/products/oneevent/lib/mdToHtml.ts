// Minimal Markdown → HTML for the rich-text editor. VAIA's composer returns
// Markdown (## headings, **bold**, - bullets); the contentEditable editor wants
// HTML. We render headings as bold lines, bullet runs as <ul>, and inline **bold**
// / *italic* as <strong>/<em>. Kept deliberately small — no external deps. (Lee, Jul 22)
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  // bold: **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // italic: *text* (single) — avoid touching already-consumed bold
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  return out;
}

export function markdownToHtml(md: string): string {
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { html.push("</ul>"); inList = false; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    // horizontal rule — skip (editor has no clean <hr>)
    if (/^-{3,}$/.test(line) || /^_{3,}$/.test(line) || /^\*{3,}$/.test(line)) { closeList(); continue; }
    // headings ##, ###, #  → bold paragraph
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { closeList(); html.push(`<p><strong>${inline(h[1])}</strong></p>`); continue; }
    // bullets - or *
    const b = line.match(/^[-*]\s+(.*)$/);
    if (b) { if (!inList) { html.push("<ul>"); inList = true; } html.push(`<li>${inline(b[1])}</li>`); continue; }
    // numbered list item → keep as paragraph with the number (simple, robust)
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return html.join("");
}

export default markdownToHtml;
