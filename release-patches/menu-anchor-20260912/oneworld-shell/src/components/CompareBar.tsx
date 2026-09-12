import { W } from "../lib/i18n";
import { COMPARE_MAX } from "../lib/compare";
import { useCompare, clearCompare } from "../lib/compareStore";

/**
 * THE BAR THAT SAYS SOMETHING IS BEING COMPARED — and the only way to open the matrix.
 * ============================================================================================
 * Without it, ticking a card puts a listing into a list the reader cannot see, cannot empty, and
 * has no idea how to open. That is worse than no feature: it is state the app is holding on
 * somebody's behalf with nothing on screen admitting to it.
 *
 * ── WHY IT APPEARS AT ONE, NOT AT TWO ───────────────────────────────────────────────────────
 * The first tick is exactly when a reader needs telling that something happened and that they
 * need a second one. Waiting until two means the first tick is silent, and a silent tick reads as
 * a control that did not work — so they tick it again and turn it off.
 *
 * ── AND WHY IT SITS ABOVE THE TAB BAR, NOT OVER IT ──────────────────────────────────────────
 * `bottom-[76px]` clears the raised centre button. A bar that covers the navigation to save
 * itself 76 pixels is a bar people dismiss to get their app back.
 */
export default function CompareBar({ lang, onOpen }: { lang: string; onOpen: () => void }) {
  const ids = useCompare();
  if (!ids.length) return null;

  const enough = ids.length >= 2;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[76px] z-40 px-3">
      <div className="ow-sheet pointer-events-auto mx-auto flex max-w-md items-center gap-2.5 rounded-2xl px-3 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand/12 text-[13px] font-black tabular-nums text-brand-deep dark:text-brand-light">
          {ids.length}
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
          {enough
            ? W(lang, `${ids.length} to compare`, `${ids.length} para comparar`)
            : W(lang, "Pick one more to compare", "Elija uno más para comparar")}
          <span className="block text-[11px] opacity-50">
            {W(lang, `Up to ${COMPARE_MAX}`, `Hasta ${COMPARE_MAX}`)}
          </span>
        </span>
        <button type="button" onClick={clearCompare}
          className="ow-tap shrink-0 px-2 py-1 text-[12px] font-semibold opacity-55">
          {W(lang, "Clear", "Vaciar")}
        </button>
        {/* Disabled rather than hidden at one: the reader can see what the second tick unlocks,
            which is the whole reason they add another. */}
        <button type="button" onClick={onOpen} disabled={!enough}
          className="btn-primary shrink-0 px-3 py-2 text-[12.5px] disabled:opacity-40">
          {W(lang, "Compare", "Comparar")}
        </button>
      </div>
    </div>
  );
}
