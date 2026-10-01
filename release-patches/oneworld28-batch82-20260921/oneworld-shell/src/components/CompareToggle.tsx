import { useState } from "react";
import { W } from "../lib/i18n";
import { COMPARE_MAX } from "../lib/compare";
import { useCompare, toggleCompare } from "../lib/compareStore";

/**
 * THE TICK ON A CARD — how a listing gets into the comparison.
 * ============================================================================================
 * Top-RIGHT of the photograph, opposite the photo counter, which is the one corner on these cards
 * that carries no information. It is deliberately not in the scrim with the price and the
 * engagement row: those are about the property, this is about the reader's own shortlist, and
 * mixing the two is how a tap meant for "compare" lands on "like".
 *
 * ── ⚠️ IT STOPS THE EVENT, AND THAT IS NOT OPTIONAL ─────────────────────────────────────────
 * The whole card is a <Link>. Without `preventDefault` and `stopPropagation` every tick would
 * navigate away from the feed to the listing — the control would appear to do nothing except
 * leave, which is the most confusing failure a checkbox can have.
 *
 * ── AND WHY A REFUSAL SPEAKS ────────────────────────────────────────────────────────────────
 * At the cap, tapping a sixth card must SAY the list is full. A tick that silently fails to tick
 * reads as a broken control, and the reader taps it three more times before giving up on the
 * feature entirely.
 */
export default function CompareToggle({ id, lang }: { id: string; lang: string }) {
  const ids = useCompare();
  const on = ids.includes(id);
  const [full, setFull] = useState(false);

  return (
    <span className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? W(lang, "Remove from comparison", "Quitar de la comparación")
                       : W(lang, "Add to comparison", "Agregar a la comparación")}
        title={on ? W(lang, "In your comparison", "En su comparación")
                  : W(lang, "Compare this one", "Comparar este")}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          const ok = toggleCompare(id);
          if (!ok) { setFull(true); setTimeout(() => setFull(false), 2200); }
        }}
        className={`ow-tap grid h-8 w-8 place-items-center rounded-full backdrop-blur-sm transition ${
          on ? "bg-teal-deep text-white"
             : "bg-ink/55 text-white/90 hover:bg-ink/70"}`}>
        {/* Two different glyphs, not one glyph in two colours — the state has to survive a
            screenshot, a bright pavement and colour blindness. */}
        {on ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.1" strokeLinecap="round" aria-hidden>
            <path d="M4 7h9M4 12h13M4 17h7" />
            <path d="M18 15v6M15 18h6" />
          </svg>
        )}
      </button>
      {full && (
        <span className="max-w-[150px] rounded-lg bg-ink/85 px-2 py-1 text-right text-[10.5px] font-semibold leading-snug text-white backdrop-blur-sm">
          {W(lang, `That's ${COMPARE_MAX} already — remove one first.`,
                   `Ya son ${COMPARE_MAX} — quite uno primero.`)}
        </span>
      )}
    </span>
  );
}
