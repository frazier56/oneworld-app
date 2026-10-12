/**
 * ONE RICH-TEXT EDITOR FOR EVERY PRODUCT (Lee, 12 Oct 2026: "It's the same exact code that we use
 * for all the other descriptions… literally identical"). This file used to hold this product's own
 * copy of the editor — one of three near-identical forks (OneEvent, OneJob, the shell). Every
 * description box now uses the shell's, so a new button (strike-through, 12 Oct) lands everywhere
 * at once. Kept only so existing imports of this path keep working.
 */
export { RichTextEditor, stripRichTextHtml } from "@oneworld/shell";
export type { RichTextEditorProps } from "@oneworld/shell";
import { RichTextEditor } from "@oneworld/shell";
export default RichTextEditor;
