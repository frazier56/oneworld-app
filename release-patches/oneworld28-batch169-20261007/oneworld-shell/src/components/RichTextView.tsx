import { looksLikeHtml, sanitizeRichHtml } from "./ai/richText";

/**
 * Shows prose that may be plain text (every bio written before 12 Oct 2026) or HTML from the
 * shared editor. Plain text keeps its line breaks; HTML goes through the allow-list sanitizer
 * and nothing else — this is the only place a bio is rendered as markup.
 */
export default function RichTextView({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  if (!value) return null;
  if (!looksLikeHtml(value)) return <span className={`whitespace-pre-line ${className}`}>{value}</span>;
  return (
    <div className={`ow-rich ${className}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value) }} />
  );
}
