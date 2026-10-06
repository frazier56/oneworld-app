/* ── 100% OF THE PAGE TRANSLATES WITH THE FLAG ───────────────────────────────────────────────
   Lee, 17 September 2026: *"Make sure the description is translating properly. Remember 100% of
   the page will translate with the flag."*

   The dictionaries cover every word the APP writes. This covers the words a MEMBER wrote —
   listing titles, descriptions, house rules — which until now stayed in whatever language the
   host typed them in, inside an interface that had dutifully translated itself around them.

   The work happens in the `translate-content` edge function, which caches per listing per
   language, so this hook is cheap: usually one round trip that hits a cached row.

   THE HONEST BIT. `translated` is false when the source was already in the reader's language,
   and the screen shows no mark. When it is true the screen MUST say the text was translated
   automatically. A house rule the host never wrote should not be able to look like one they did.

   FAILURE IS SILENT AND SAFE. No key, no network, a model that returns nonsense — every path
   returns the original text with `translated: false`. A page that shows the host's own Spanish
   is a mild disappointment; a page that shows nothing is a bug. */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type AutoTranslation = {
  /** field name -> translated text. Empty until it arrives; callers fall back to the source. */
  fields: Record<string, string>;
  /** True only when text was actually translated, i.e. the mark should be shown. */
  translated: boolean;
  loading: boolean;
};

const EMPTY: AutoTranslation = { fields: {}, translated: false, loading: false };

/* One in-memory result per (table, id, lang) for this page load, so moving between a listing and
   the feed and back does not re-ask. The database cache is the durable one; this only spares the
   round trip. */
const mem = new Map<string, AutoTranslation>();

export function useAutoTranslate(
  table: "rental_properties" | "sale_properties",
  id: string | null | undefined,
  lang: string,
  /** Skip entirely when there is nothing to translate (a listing with no prose). */
  enabled = true,
): AutoTranslation {
  const key = `${table}:${id}:${lang}`;
  const [state, setState] = useState<AutoTranslation>(() => mem.get(key) ?? EMPTY);

  useEffect(() => {
    if (!id || !enabled) { setState(EMPTY); return; }
    const cached = mem.get(key);
    if (cached) { setState(cached); return; }

    let live = true;
    setState({ ...EMPTY, loading: true });
    void supabase.functions
      .invoke("translate-content", { body: { table, id, lang } })
      .then(({ data, error }) => {
        if (!live) return;
        const next: AutoTranslation = (!error && data && typeof data === "object")
          ? {
              fields: (data as any).fields ?? {},
              translated: !!(data as any).translated,
              loading: false,
            }
          : EMPTY;
        mem.set(key, next);
        setState(next);
      })
      .catch(() => { if (live) setState(EMPTY); });
    return () => { live = false; };
  }, [key, enabled]);

  return state;
}

/** The translated value when there is one, otherwise exactly what the host wrote. */
export function tr(t: AutoTranslation, field: string, source: string | null | undefined): string {
  const v = t.fields[field];
  return (typeof v === "string" && v.trim()) ? v : (source ?? "");
}

/** Same, for a field the host entered as a list (house rules). Line-for-line. */
export function trList(t: AutoTranslation, field: string, source: string[] | null | undefined): string[] {
  const src = source ?? [];
  const v = t.fields[field];
  if (typeof v !== "string" || !v.trim()) return src;
  const lines = v.split("\n").map(s => s.trim()).filter(Boolean);
  /* A translation that came back with a different number of rules is a translation that lost or
     invented one. Show the host's own list rather than a rewritten rulebook. */
  return lines.length === src.length ? lines : src;
}
