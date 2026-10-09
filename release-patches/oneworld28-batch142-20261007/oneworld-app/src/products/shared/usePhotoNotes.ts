import { useEffect, useState } from "react";
import { supabase } from "@oneworld/shell";

/**
 * The host's per-photo notes for one listing (overlay 49). Read on its own, NOT added to the
 * listing's column list: if this ever runs against a database without the column, the listing page
 * must still load — the notes are simply absent.
 */
export function usePhotoNotes(table: "rental_properties" | "sale_properties", id: string | null | undefined) {
  const [notes, setNotes] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!id) { setNotes(null); return; }
    let live = true;
    void supabase.from(table).select("photo_notes").eq("id", id).maybeSingle()
      .then(({ data, error }: { data: any; error: any }) => {
        if (!live) return;
        const v = !error && data?.photo_notes && typeof data.photo_notes === "object" ? data.photo_notes : null;
        setNotes(v && Object.keys(v).length ? v as Record<string, string> : null);
      }, () => { if (live) setNotes(null); });
    return () => { live = false; };
  }, [table, id]);
  return notes;
}

/** Keep only notes whose photo is still on the listing, trimmed. */
export function prunePhotoNotes(notes: Record<string, string>, photos: string[]): Record<string, string> {
  const keep = new Set(photos);
  return Object.fromEntries(Object.entries(notes).filter(([k, v]) => keep.has(k) && typeof v === "string" && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 200)]));
}
