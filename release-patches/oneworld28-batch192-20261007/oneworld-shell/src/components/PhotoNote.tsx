import { useState } from "react";
import { W } from "../lib/i18n";

/**
 * A HOST'S NOTE ON ONE PHOTO — hidden until asked for (overlay 49, 7 Oct 2026).
 * ============================================================================================
 * Lee: *"a section where people can add comments to their photos… it doesn't take away from the
 * cleanliness. Maybe you write a comment, but you can't see the comment unless you click the little
 * comment icon. That way the picture stays clean."*
 *
 * So the photograph shows one small round icon in its corner, and only when that photo HAS a note.
 * Tapping it lays the note over the bottom of the picture; tapping again (or the note) puts it away.
 * Re-mounted per photo (`key`), so swiping to the next picture always starts with it closed.
 */
export function NoteGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />
      <path d="M8.5 11h7M8.5 14h4.5" />
    </svg>
  );
}

export default function PhotoNote({ text, lang, bottomOffset = 40 }: {
  text: string; lang: string;
  /** Room left at the bottom for the counter and dots the picture already carries. */
  bottomOffset?: number;
}) {
  const [open, setOpen] = useState(false);
  const note = text.trim();
  if (!note) return null;
  return (
    <>
      <button type="button" data-ow="photo-note-toggle"
        aria-expanded={open}
        aria-label={open ? W(lang, "Hide the note", "Ocultar la nota") : W(lang, "Show the note", "Ver la nota")}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className={`ow-tap absolute left-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full text-white shadow-md backdrop-blur-sm transition ${
          open ? "bg-brand" : "bg-black/55"}`}>
        <NoteGlyph />
      </button>
      {open && (
        <button type="button" data-ow="photo-note"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setOpen(false); }}
          style={{ bottom: bottomOffset }}
          className="absolute inset-x-2 z-10 max-h-[45%] overflow-y-auto rounded-xl bg-black/75 px-3 py-2.5 text-left text-[13.5px] leading-relaxed text-white shadow-lg backdrop-blur-md">
          {note}
        </button>
      )}
    </>
  );
}
