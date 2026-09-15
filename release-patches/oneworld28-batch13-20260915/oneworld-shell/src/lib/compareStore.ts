import { useEffect, useState } from "react";
import { readPref, writePref } from "./safeStorage";
import { COMPARE_MAX } from "./compare";

/**
 * WHAT IS CURRENTLY IN THE COMPARISON — one list, shared by every screen that can add to it.
 * ============================================================================================
 * A comparison is built while browsing: two from the feed, one from a saved list, one from a
 * neighbourhood search half an hour later. So the selection cannot live in a screen's state — it
 * has to survive navigation, and it has to survive closing the tab, because "I'll finish this
 * tonight" is the normal way people shortlist somewhere to live.
 *
 * ── WHY A MODULE-LEVEL SET AND NOT CONTEXT ──────────────────────────────────────────────────
 * Every card in a twelve-card feed subscribes to this. A context provider re-renders the whole
 * tree on every tick of a checkbox; a subscription re-renders only the components that asked. The
 * same shape `viewerCurrency.ts` already uses in this package, deliberately, so there is one
 * pattern for "small global preference" rather than two.
 *
 * ⚠️ THE CAP IS NOT ENFORCED HERE ALONE. `add()` refuses beyond COMPARE_MAX and returns false so
 * the caller can say why, but the sheet and the PDF read the same constant. A screen that
 * enforced its own limit would eventually disagree with the printed page.
 */

const KEY = "oneworld-compare-v1";

/* Ids only. Storing the whole listing would go stale the moment a price changed — and a printed
   comparison showing yesterday's price is the single most damaging thing this feature could do. */
let ids: string[] = load();
const subs = new Set<(v: string[]) => void>();

function load(): string[] {
  try {
    const raw = readPref(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(x => typeof x === "string").slice(0, COMPARE_MAX) : [];
  } catch { return []; }
}

function commit(next: string[]) {
  ids = next;
  try { writePref(KEY, JSON.stringify(next)); } catch { /* private mode — the list still works */ }
  subs.forEach(fn => fn(next));
}

export const compareIds = () => ids;
export const inCompare = (id: string) => ids.includes(id);

/** Returns false when the list is already full, so the caller can say so instead of failing mute. */
export function addToCompare(id: string): boolean {
  if (ids.includes(id)) return true;
  if (ids.length >= COMPARE_MAX) return false;
  commit([...ids, id]);
  return true;
}

export const removeFromCompare = (id: string) => commit(ids.filter(x => x !== id));
export const clearCompare = () => commit([]);

/** Add or remove. Returns false only when adding was refused by the cap. */
export function toggleCompare(id: string): boolean {
  if (ids.includes(id)) { removeFromCompare(id); return true; }
  return addToCompare(id);
}

export function onCompareChange(fn: (v: string[]) => void) {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

/** The hook every card and the bar use. */
export function useCompare() {
  const [v, setV] = useState<string[]>(ids);
  useEffect(() => onCompareChange(setV), []);
  return v;
}
