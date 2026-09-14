import { useMemo } from "react";
import { W } from "../lib/i18n";
import {
  rowsFor, winnersOf, scoreboard, summarise, type CompareItem,
} from "../lib/compare";
import { removeFromCompare, clearCompare } from "../lib/compareStore";

/**
 * THE MATRIX — attributes down the left, properties across the top, a winner in every row.
 * ============================================================================================
 * Lee, 15 August 2026: *"a matrix system that says, here's all the attributes down the left side,
 * and here are the properties across the top per column… which one wins in each category."*
 *
 * ── WHY THE WHOLE TABLE SCROLLS SIDEWAYS AND THE FIRST COLUMN DOES NOT ──────────────────────
 * Five columns cannot fit a phone. They can fit a sheet of paper, which is what the PDF is for.
 * On screen the attribute names stay pinned to the left while the columns scroll under them,
 * because a cell reading "3" with the label scrolled off is a number about nothing.
 *
 * ── WHAT A GREEN CELL MEANS, EXACTLY ────────────────────────────────────────────────────────
 * It won that row against every other column, and every column had a value to lose with. A row
 * where somebody left the field blank crowns nobody — see `winnersOf`. That rule is the
 * difference between a comparison and a leaderboard for whoever filled in the most fields.
 */
export default function CompareSheet({
  items, lang, onClose, onOpen,
}: {
  items: CompareItem[];
  lang: string;
  onClose: () => void;
  onOpen: (item: CompareItem) => void;
}) {
  const rows = useMemo(() => rowsFor(items), [items]);
  const board = useMemo(() => scoreboard(items), [items]);
  const lines = useMemo(() => summarise(items, lang), [items, lang]);
  const judged = rows.filter(r => r.better).length;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-sm" onClick={onClose} />
      <div className="ow-sheet relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl p-4 sm:rounded-3xl">

        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-black tracking-tight">
              {W(lang, "Side by side", "Lado a lado")}
            </h2>
            <p className="text-[11.5px] opacity-55">
              {items.length} {W(lang, "properties", "inmuebles")} · {judged} {W(lang, "categories judged", "categorías evaluadas")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => printMatrix(items, lang)} className="btn-primary px-3 py-2 text-[12.5px]">
              {W(lang, "PDF", "PDF")}
            </button>
            <button onClick={onClose} className="ow-tap -m-1 p-1 text-[20px] leading-none opacity-50"
              aria-label={W(lang, "Close", "Cerrar")}>×</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[112px] bg-paper p-1 text-left align-bottom dark:bg-ink" />
                {items.map(i => (
                  <th key={i.id} className="min-w-[124px] p-1 align-bottom">
                    <button type="button" onClick={() => onOpen(i)} className="ow-tap block w-full text-left">
                      {i.photo
                        ? <img src={i.photo} alt="" className="mb-1 h-16 w-full rounded-lg object-cover" />
                        : <div className="mb-1 h-16 w-full rounded-lg bg-ink/5 dark:bg-white/10" />}
                      <span className="line-clamp-2 block text-[12px] font-bold leading-tight">{i.title}</span>
                      <span className="block truncate text-[11px] font-normal opacity-55">
                        {[i.neighbourhood, i.city].filter(Boolean).join(", ")}
                      </span>
                    </button>
                    {/* The scoreboard, under each column, so "which one wins overall" is answered
                        without the reader counting green cells down five columns. */}
                    <span className="mt-1 inline-block rounded-full bg-teal-deep/12 px-2 py-0.5 text-[11px] font-black tabular-nums text-teal-deep dark:text-teal-light">
                      {board[i.id] ?? 0}/{judged}
                    </span>
                    <button type="button" onClick={() => removeFromCompare(i.id)}
                      className="ow-tap mt-1 block w-full text-[10.5px] font-semibold opacity-45">
                      {W(lang, "Remove", "Quitar")}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const win = winnersOf(row, items);
                return (
                  <tr key={row.key} className="border-t border-ink/[0.07] dark:border-white/10">
                    <th scope="row"
                      className="sticky left-0 z-10 bg-paper p-1.5 text-left text-[11.5px] font-bold leading-tight opacity-70 dark:bg-ink">
                      {W(lang, row.en, row.es)}
                    </th>
                    {items.map(i => {
                      const won = win.has(i.id);
                      return (
                        <td key={i.id}
                          className={`p-1.5 text-center tabular-nums ${
                            won ? "rounded-lg bg-teal-deep/12 font-black text-teal-deep dark:text-teal-light"
                                : "opacity-80"}`}>
                          {/* ⚠️ A TICK **AND** THE COLOUR. Green alone is not a label — roughly one
                              man in twelve cannot separate it from the neutral cell, and this is a
                              table whose entire purpose is which cell is better. */}
                          {won && <span aria-hidden className="mr-0.5">✓</span>}
                          {row.text(i, lang)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {lines.length > 0 && (
          <div className="mt-3 shrink-0 rounded-2xl border border-ink/[0.08] p-3 dark:border-white/10">
            <p className="mb-1 text-[11px] font-black uppercase tracking-wide opacity-45">
              {W(lang, "What the numbers say", "Lo que dicen los números")}
            </p>
            <ul className="space-y-1">
              {lines.map((l, n) => (
                <li key={n} className="text-[12.5px] leading-snug opacity-85">{l}</li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={() => { clearCompare(); onClose(); }}
          className="ow-tap mt-2 shrink-0 py-2 text-[12px] font-semibold opacity-55">
          {W(lang, "Clear the comparison", "Vaciar la comparación")}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
   THE ONE-PAGE PDF
   ════════════════════════════════════════════════════════════════════════════════════════════
   Lee: *"they can create a PDF."*

   ── WHY THERE IS NO PDF LIBRARY IN THIS FILE ───────────────────────────────────────────────
   jsPDF and friends add roughly 300KB to a bundle that every screen in six products downloads,
   and they draw tables by hand — which means a fifth column or a longer title becomes a layout
   bug in OUR code rather than the browser's. Every browser already contains a typesetter that
   handles this table perfectly and exports PDF. `ContractView` reached the same conclusion in
   July and prints the same way.

   ── THE THREE THINGS THAT MAKE IT A REAL SHEET OF PAPER ────────────────────────────────────
   `@page { size: A4 landscape }` — five columns need the long edge.
   `-webkit-print-color-adjust: exact` — without it Chrome strips every background, and the green
   winner cells vanish, which is the whole document.
   A tick in every winning cell, so the page survives being printed in black and white — which is
   how an estate agent's office will print it.

   Popup blockers only fire on windows opened without a gesture, and this is called from a button.
   If one blocks it anyway we say so plainly rather than leaving a button that did nothing.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
function printMatrix(items: CompareItem[], lang: string) {
  const es = lang === "es" || lang === "co";
  const rows = rowsFor(items);
  const board = scoreboard(items);
  const judged = rows.filter(r => r.better).length;
  const lines = summarise(items, lang);

  const esc = (s: string) => s.replace(/[<>&"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));

  const head = items.map(i => `<th>
      <div class="t">${esc(i.title)}</div>
      <div class="w">${esc([i.neighbourhood, i.city].filter(Boolean).join(", "))}</div>
      <div class="s">${board[i.id] ?? 0}/${judged} ${es ? "categorías" : "categories"}</div>
    </th>`).join("");

  const body = rows.map(r => {
    const win = winnersOf(r, items);
    return `<tr><th class="lbl">${esc(es ? r.es : r.en)}</th>${
      items.map(i => `<td class="${win.has(i.id) ? "win" : ""}">${
        win.has(i.id) ? "✓ " : ""}${esc(r.text(i, lang))}</td>`).join("")
    }</tr>`;
  }).join("");

  const notes = lines.length
    ? `<div class="notes"><h2>${es ? "Lo que dicen los números" : "What the numbers say"}</h2><ul>${
        lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul></div>`
    : "";

  const html = `<!doctype html><html lang="${es ? "es" : "en"}"><head><meta charset="utf-8">
<title>${es ? "Comparación de inmuebles" : "Property comparison"} — OneHome</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  body { font: 11px/1.35 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0B0F1A; margin: 0; }
  h1 { font-size: 15px; margin: 0 0 2px; letter-spacing: -.01em; }
  .sub { font-size: 10px; color: #6b7280; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { padding: 5px 6px; border-top: 1px solid #e5e7eb; text-align: center; vertical-align: middle; }
  thead th { border-top: 0; vertical-align: bottom; }
  .lbl { text-align: left; width: 128px; font-weight: 700; color: #4b5563; font-size: 10px; }
  .t { font-weight: 800; font-size: 11px; line-height: 1.2; }
  .w { font-size: 9.5px; color: #6b7280; }
  .s { font-size: 9.5px; font-weight: 800; color: #0B7F74; margin-top: 2px; }
  .win { background: #d7f2ee; font-weight: 800; color: #0B7F74; }
  .notes { margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 7px; }
  .notes h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; margin: 0 0 4px; }
  .notes li { font-size: 10.5px; margin-bottom: 2px; }
  .foot { margin-top: 10px; font-size: 9px; color: #9ca3af; }
</style></head><body>
<h1>${es ? "Comparación de inmuebles" : "Property comparison"}</h1>
<p class="sub">OneHome — ${items.length} ${es ? "inmuebles" : "properties"} · ${judged} ${
  es ? "categorías evaluadas" : "categories judged"}</p>
<table><thead><tr><th class="lbl"></th>${head}</tr></thead><tbody>${body}</tbody></table>
${notes}
<p class="foot">${es
  ? "Una categoría solo tiene ganador cuando todos los inmuebles declararon ese dato y los valores difieren. Estrato y piso se muestran pero no se puntúan."
  : "A category only has a winner when every property stated that figure and the values differ. Estrato and floor are shown but never scored."}</p>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert(es
      ? "Su navegador bloqueó la ventana de impresión. Permita las ventanas emergentes para este sitio y vuelva a intentarlo."
      : "Your browser blocked the print window. Allow pop-ups for this site and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
  /* The images are inline-free and the fonts are system, so there is nothing to wait for beyond
     one paint. `onload` rather than a timer, because a timer is a guess about a slow machine. */
  win.onload = () => { win.focus(); win.print(); };
}
