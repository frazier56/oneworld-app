import * as React from "react";
/* `cn` was the single reason this file reached into OneJob. Three lines, inlined, and the
   dependency is gone — the shell does not import from a product, ever. */
const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
// Lightweight rich-text editor: a contentEditable surface with a small toolbar.
// Emits HTML via onChange, matching the ported usage.
export function stripRichTextHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}
export interface RichTextEditorProps {
  value?: string; onChange?: (html: string) => void; placeholder?: string; className?: string; maxLength?: number;
  /**
   * Required-field highlight, matching every other input in the app.
   *
   * Three call sites (ContractForm, HireModal, VaiaDescriptionField) have been passing `error` since
   * they were written, and it was silently dropped — the prop didn't exist. So the description was the
   * ONE required field that never turned red: a first-timer who tapped Preview got "Add a description"
   * at the bottom of the screen with no indication of which box was meant, while role, date and price
   * all highlighted. (UAT Jul 26 2026)
   */
  error?: boolean;
}

const SIZES: { label: string; val: string }[] = [
  { label: "Small", val: "2" },
  { label: "Normal", val: "3" },
  { label: "Large", val: "5" },
  { label: "Huge", val: "6" },
];

/* Word-style list icons (#62) — three rule-lines with a bullet / numeral marker,
   the standard MS-Word ribbon glyphs. Replaces the old "•" and "1." text buttons. */
const BulletListIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="4.2" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4.2" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4.2" cy="17.5" r="1.5" fill="currentColor" stroke="none" />
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
  </svg>
);
const NumberedListIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <g strokeWidth="1.5">
      <path d="M2.4 4.6l1.5-.9v4" />
      <path d="M2.2 10.4a1.4 1.4 0 1 1 2.4 1c-.5.6-2.4 2.2-2.4 2.2h2.6" />
      <path d="M2.3 16.2h2.3l-1.4 1.6a1.25 1.25 0 1 1-.9 2.1" />
    </g>
  </svg>
);

export function RichTextEditor({ value = "", onChange, placeholder, className, error }: RichTextEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const savedRange = React.useRef<Range | null>(null);
  const [sizeOpen, setSizeOpen] = React.useState(false);
  React.useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || ""; }, [value]);

  // Remember the caret/selection so the size + color controls (which move focus
  // out of the editor) still apply to what the user had selected.
  const saveSel = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSel = () => {
    const sel = window.getSelection();
    if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };
  // Toolbar buttons fire on mouseDown + preventDefault so focus never leaves the
  // editor — that's what makes Bold/Italic/Underline toggle OFF on a 2nd press.
  const exec = (c: string, val?: string) => {
    ref.current?.focus();
    restoreSel();
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    document.execCommand(c, false, val);
    onChange?.(ref.current?.innerHTML || "");
    saveSel();
  };

  const Btn = ({ cmd, val, title, children, extra }: { cmd: string; val?: string; title: string; children: React.ReactNode; extra?: string }) => (
    <button type="button" title={title}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd, val); }}
      className={cn("grid h-7 w-7 shrink-0 place-items-center rounded text-sm hover:bg-brand/10", extra)}>
      {children}
    </button>
  );

  React.useEffect(() => {
    if (!sizeOpen) return;
    const close = () => setSizeOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [sizeOpen]);

  // Capture selection continuously (incl. mobile touch-selection) so highlight →
  // Bold/Italic/Underline applies to the selected text (Lee, Jul 22).
  React.useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode) && !sel.isCollapsed) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  return (
    <div className={cn(
      "relative rounded-xl border bg-ink/[0.025] dark:bg-white/5",
      error ? "!border-red-400 ring-2 ring-red-300/50" : "border-ink/25 dark:border-white/20",
      className,
    )}>
      {/* One-line toolbar (no wrap) — mobile-first (Lee, Jul 22) */}
      <div className="flex flex-nowrap items-center gap-1 overflow-visible border-b border-ink/10 p-1.5 dark:border-white/10">
        <Btn cmd="bold" title="Bold" extra="font-bold">B</Btn>
        <Btn cmd="italic" title="Italic" extra="italic">I</Btn>
        <Btn cmd="underline" title="Underline" extra="underline">U</Btn>
        <span className="mx-0.5 h-5 w-px shrink-0 bg-ink/15 dark:bg-white/15" />
        <Btn cmd="insertUnorderedList" title="Bulleted list"><BulletListIcon /></Btn>
        <Btn cmd="insertOrderedList" title="Numbered list"><NumberedListIcon /></Btn>
        <span className="mx-0.5 h-5 w-px shrink-0 bg-ink/15 dark:bg-white/15" />
        {/* Modern size control — compact button + glass popover */}
        <div className="relative shrink-0" onMouseDown={saveSel}>
          <button type="button" title="Text size"
            onClick={(e) => { e.stopPropagation(); setSizeOpen((v) => !v); }}
            className="flex h-7 items-center gap-0.5 rounded px-1.5 hover:bg-brand/10">
            <span className="text-[15px] font-semibold leading-none">A</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-60"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {sizeOpen && (
            <div className="glass-modal absolute left-0 top-9 z-50 w-28 rounded-xl p-1 shadow-xl" onClick={(e) => e.stopPropagation()}>
              {SIZES.map((s, i) => (
                <button key={s.val} type="button"
                  onMouseDown={(e) => { e.preventDefault(); exec("fontSize", s.val); setSizeOpen(false); }}
                  className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left hover:bg-brand/10"
                  style={{ fontSize: `${0.72 + i * 0.16}rem` }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Color — compact "A" with a colored underline */}
        <label title="Text color" className="relative grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded hover:bg-brand/10">
          {/* the TEXT step — this glyph is type, and #17A45C on the toolbar is 3.23:1 */}
          <span className="text-[15px] font-bold leading-none" style={{ color: "#0E8248" }}>A</span>
          <span className="pointer-events-none absolute bottom-1 h-[3px] w-4 rounded-full" style={{ background: "#17A45C" }} />
          <input type="color" defaultValue="#0E8248"
            onMouseDown={saveSel}
            onChange={(e) => exec("foreColor", e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
      {/* Auto-grows as you type; scrolls after ~15 lines; drag the bottom-right
          corner to expand manually (Lee, Jul 22). */}
      <div ref={ref} contentEditable suppressContentEditableWarning data-placeholder={placeholder}
        onInput={() => { onChange?.(ref.current?.innerHTML || ""); saveSel(); }}
        onKeyUp={saveSel} onMouseUp={saveSel} onTouchEnd={saveSel} onBlur={saveSel}
        className="ow-rte-body min-h-[120px] max-h-[420px] resize-y overflow-auto px-4 py-3 pb-7 outline-none empty:before:opacity-40 empty:before:content-[attr(data-placeholder)]" />

      {/* The one grip.
          Chrome's native resizer is painted out in index.css (.ow-rte-body::-webkit-resizer), so
          this is the only thing you see — but the native resizer is still underneath doing the
          actual drag, which is why this is pointer-events-none. Two diagonal strokes reading into
          the corner, tucked inside the box's rounded edge rather than hanging off it, on a soft
          chip that lifts it off the text without shouting. (Lee, Jul 31 2026) */}
      <span aria-hidden
        className="pointer-events-none absolute bottom-[3px] right-[3px] grid h-[18px] w-[18px] place-items-center rounded-[7px] rounded-br-[10px] bg-ink/[0.06] text-ink/45 dark:bg-white/10 dark:text-white/50">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M10 3.5 L3.5 10" /><path d="M10 7.6 L7.6 10" />
        </svg>
      </span>
    </div>
  );
}
export default RichTextEditor;
