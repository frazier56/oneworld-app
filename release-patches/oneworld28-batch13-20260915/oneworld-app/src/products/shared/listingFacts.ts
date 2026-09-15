/* ============================================================================================
 * THE ATTRIBUTE ROW — ONE DEFINITION, TWO CARDS.
 *
 * Lee named the SALE card's attribute row as the one place the sale side is canonical, and the
 * rent card was brought to it over v94, v96, v97.1 and v98. The two rows have been identical in
 * content and order since v98 — and were still written twice, once as a joined string and once as
 * five spans.
 *
 * That duplication is not theoretical. It produced FOUR defects in one day:
 *
 *   U40  sale's size stepper had no suffix; rent's did
 *   U41  sale said "Floor"; rent said "Floor the unit is on"
 *   U43  rent drew no Estrato at all — the feed never selected the column
 *   U44  rent said "2 bd · 2 ba"; sale said "3 bed · 3 bath"
 *
 * Every one of them was "the two sides say the same thing differently". So the order and the
 * words live here now, once, and a change to either is a change to both.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT OWN ─────────────────────────────────────────────────────
 * The KIND LABEL. Rent resolves `property_type` (apartment · house · loft · studio) through its
 * own map; sale resolves `kind` through `KIND_LABEL` in onesale/lib/sale.ts. Those are different
 * vocabularies over different columns, and folding them together here would be the same mistake
 * as importing KIND_LABEL across products — which v96 refused on purpose.
 *
 * So each card resolves its own label and passes it in. **This owns the shape; the products own
 * the meaning** — the same split the shell and the products already use.
 *
 * ── RETURNS AN ARRAY, NOT MARKUP ────────────────────────────────────────────────────────────
 * The rent card joins with " · " into one line; the sale card renders one span per term with a
 * gap. Both are correct for their layout, and forcing one markup on both would be a cosmetic
 * change smuggled inside a refactor. The ARRAY is the thing that must not drift.
 * ==========================================================================================*/
import { W } from "@oneworld/shell";

export type FactSource = {
  bedrooms?: number | null;
  bathrooms?: number | null;
  area_m2?: number | null;
  estrato?: number | null;
};

/** The attribute row's terms, in the canonical order, with empties already dropped. */
export function listingFacts(kindLabel: string | null | undefined, l: FactSource, lang: string): string[] {
  return [
    kindLabel || null,
    l.bedrooms != null ? `${l.bedrooms} ${W(lang, "bed", "hab")}` : null,
    l.bathrooms != null ? `${l.bathrooms} ${W(lang, "bath", "baños")}` : null,
    l.area_m2 != null ? `${l.area_m2} m²` : null,
    l.estrato != null ? `Estrato ${l.estrato}` : null,
  ].filter((t): t is string => Boolean(t));
}
