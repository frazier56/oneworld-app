import React from "react";

/**
 * MINIMAL MARKDOWN → JSX — dependency-free, for the gated legal drafts only.
 * ============================================================================================
 * These are UAT-readable draft pages, not a general Markdown engine. It handles exactly the
 * constructs the Terms/Privacy drafts use: H1/H2/H3, a leading blockquote banner, horizontal
 * rules, unordered lists (with wrapped continuation lines), pipe tables, paragraphs, and inline
 * **bold** + `code`. Everything else — including the `[[…]]` placeholders and `⟨M-nn⟩` matrix
 * markers — passes through as literal text, which is the whole point: a gated marker must never be
 * silently dropped or "cleaned up" into a customer-ready claim.
 */

let keyN = 0;
const k = () => `md${keyN++}`;

/* Inline: code spans are literal (split on backticks first), then bold on what remains. */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (const part of text.split(/(`[^`]*`)/g)) {
    if (!part) continue;
    if (part.length >= 2 && part.startsWith("`") && part.endsWith("`")) {
      out.push(
        <code key={k()} className="rounded bg-black/10 px-1 py-0.5 text-[0.85em] dark:bg-white/10">
          {part.slice(1, -1)}
        </code>,
      );
      continue;
    }
    for (const b of part.split(/(\*\*[^*]+\*\*)/g)) {
      if (!b) continue;
      if (b.length >= 4 && b.startsWith("**") && b.endsWith("**")) {
        out.push(<strong key={k()}>{b.slice(2, -2)}</strong>);
      } else {
        out.push(<React.Fragment key={k()}>{b}</React.Fragment>);
      }
    }
  }
  return out;
}

const isBreak = (l: string) =>
  !l.trim() ||
  /^\s*-\s+/.test(l) ||
  /^#{1,3}\s/.test(l) ||
  /^\|/.test(l) ||
  /^>\s?/.test(l) ||
  /^---+\s*$/.test(l);

export function Markdown({ source }: { source: string }) {
  keyN = 0;
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // Blockquote banner — group consecutive `>` lines.
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push(
        <blockquote key={k()} className="my-4 rounded-xl border-l-4 border-amber-500/60 bg-amber-500/5 px-4 py-2 text-[12.5px] opacity-80">
          {inline(buf.join(" "))}
        </blockquote>,
      );
      continue;
    }

    // Horizontal rule.
    if (/^---+\s*$/.test(line)) { blocks.push(<hr key={k()} className="my-6 border-black/10 dark:border-white/10" />); i++; continue; }

    // Headings.
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const txt = h[2];
      if (h[1].length === 1) blocks.push(<h1 key={k()} className="mt-2 mb-3 text-[22px] font-extrabold tracking-tight">{inline(txt)}</h1>);
      else if (h[1].length === 2) blocks.push(<h2 key={k()} className="mt-6 mb-2 text-[16px] font-bold">{inline(txt)}</h2>);
      else blocks.push(<h3 key={k()} className="mt-4 mb-1 text-[14px] font-semibold">{inline(txt)}</h3>);
      i++; continue;
    }

    // Pipe table — consecutive lines starting with `|`.
    if (/^\|/.test(line)) {
      const rows: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r: string) => r.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const header = cells(rows[0]);
      const body = rows.slice(1).filter((r) => !/^\|[\s|:-]+\|?\s*$/.test(r));
      blocks.push(
        <div key={k()} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>{header.map((c) => <th key={k()} className="border border-black/15 px-2 py-1 text-left align-top font-semibold dark:border-white/15">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r) => <tr key={k()}>{cells(r).map((c) => <td key={k()} className="border border-black/15 px-2 py-1 align-top dark:border-white/15">{inline(c)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list — consecutive `- ` items, folding wrapped continuation lines.
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*-\s+/, "");
        i++;
        while (i < lines.length && !isBreak(lines[i])) { item += " " + lines[i].trim(); i++; }
        items.push(item);
      }
      blocks.push(<ul key={k()} className="my-3 list-disc space-y-1.5 pl-5">{items.map((it) => <li key={k()} className="leading-relaxed">{inline(it)}</li>)}</ul>);
      continue;
    }

    // Paragraph — group consecutive plain lines (drafts hard-wrap).
    const buf: string[] = [];
    while (i < lines.length && !isBreak(lines[i])) { buf.push(lines[i].trim()); i++; }
    blocks.push(<p key={k()} className="my-3 leading-relaxed">{inline(buf.join(" "))}</p>);
  }

  return <>{blocks}</>;
}
