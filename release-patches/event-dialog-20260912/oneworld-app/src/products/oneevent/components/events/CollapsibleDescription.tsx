import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripHorizontal } from "lucide-react";
import { Button } from "@evt/components/ui/button";
import DOMPurify from "isomorphic-dompurify";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@evt/i18n/LanguageContext";

interface CollapsibleDescriptionProps {
  text: string;
  /** Approximate character count above which we show the collapse affordance. */
  threshold?: number;
}

const COLLAPSED_HEIGHT = 240;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 1200;

/**
 * Long event descriptions can dominate the page. This component:
 *  - Shows the full description by default if it's short.
 *  - For long text, renders a fixed-height scrollable panel with a
 *    "Expand"/"Collapse" toggle and a drag handle at the bottom-right
 *    so the user can resize it manually.
 */
export function CollapsibleDescription({ text, threshold = 600 }: CollapsibleDescriptionProps) {
  const { t } = useLanguage();
  const isLong = (text || "").length > threshold;
  // Default to fully expanded so people can read the whole description without an extra click.
  // The collapse toggle and drag handle stay available for users who want to shrink it.
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState<number>(0);
  const dragging = useRef<{ startY: number; startH: number } | null>(null);
  const hasHtml = /<\/?[a-z][\s\S]*?>/i.test(text || "");
  const safeHtml = useMemo(
    () => (hasHtml ? DOMPurify.sanitize(text || "") : ""),
    [text, hasHtml]
  );
  /* MARKDOWN DESCRIPTIONS (Lee's UAT on Joel's event, 18 Aug 2026): the "Speak with AI"
     writer produces markdown ("### What happens at the table", "**The Referral Web**") and
     this panel was printing the symbols literally. If the text carries markdown markers it
     now renders as formatted text; plain descriptions keep their exact line breaks. */
  const looksMarkdown = !hasHtml && /(^|\n)#{1,6}\s|\*\*[^*\n]+\*\*|(^|\n)\s*[-*]\s+\S|(^|\n)\s*\d+\.\s+\S/.test(text || "");
  /* AE (Lee's live UAT, 18 Aug 2026): Joel's description is the MIXED case — a rich-text
     editor wrapped his text in HTML tags, but he TYPED markdown inside it ("### What
     happens at the table", "**The Referral Web**"). The HTML branch printed those symbols
     literally. When the HTML's text content still carries markdown markers, flatten the
     HTML to plain text (tags → line breaks) and let ReactMarkdown do the whole job. */
  const htmlAsText = useMemo(() => {
    if (!hasHtml) return "";
    return (text || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n").trim();
  }, [text, hasHtml]);
  const markdownInsideHtml = hasHtml && /(^|\n)#{1,6}\s|\*\*[^*\n]+\*\*/.test(htmlAsText);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dy = e.clientY - dragging.current.startY;
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragging.current.startH + dy));
      setHeight(next);
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { startY: e.clientY, startH: height || COLLAPSED_HEIGHT };
  };

  return (
    <div className="rounded-2xl p-6 bg-card border border-border relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">{t("ev.about", "About This Event")}</h2>
        {isLong && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              if (collapsed) {
                setCollapsed(false);
                setHeight(0);
              } else {
                setCollapsed(true);
                setHeight(COLLAPSED_HEIGHT);
              }
            }}
          >
            {collapsed ? (<><ChevronDown className="w-3 h-3 mr-1" /> Expand</>) : (<><ChevronUp className="w-3 h-3 mr-1" /> Collapse</>)}
          </Button>
        )}
      </div>
      {(() => {
        const baseClass =
          /* v15 (AE-2): markdown headings rendered the same size as body text — prose-invert
             fought the light theme and heading sizes never applied. Explicit scale now. */
          "text-sm leading-relaxed text-muted-foreground overflow-y-auto pr-1 prose prose-sm max-w-none prose-p:my-2 prose-strong:text-foreground prose-headings:text-foreground prose-headings:font-bold prose-h1:text-lg prose-h2:text-base prose-h3:text-[15px] prose-headings:mt-4 prose-headings:mb-1.5";
        const style = collapsed ? { maxHeight: height, height } : undefined;
        return markdownInsideHtml ? (
          <div className={baseClass} style={style}>
            <ReactMarkdown>{htmlAsText}</ReactMarkdown>
          </div>
        ) : hasHtml ? (
          <div
            className={baseClass}
            style={style}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : looksMarkdown ? (
          <div className={baseClass} style={style}>
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        ) : (
          <div className={`${baseClass} whitespace-pre-wrap`} style={style}>
            {text}
          </div>
        );
      })()}
      {collapsed && (
        <div
          role="separator"
          aria-label="Resize description"
          onMouseDown={startDrag}
          className="absolute bottom-2 right-2 flex items-center justify-center w-6 h-6 rounded-md bg-secondary/70 hover:bg-secondary border border-border cursor-ns-resize"
          title="Drag to resize"
        >
          <GripHorizontal className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
