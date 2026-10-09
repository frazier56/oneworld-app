/* ============================================================================================
 * THE UNFINISHED LISTING — where to pick it back up.
 *
 * Lee, 2 Oct 2026: *"if you click on that subscription… and you don't like the price and you click
 * backwards, then you got to start over… if someone somehow refreshes the page or they go to the
 * pricing page… they can click back… all their photos are still there… save it for at least 24
 * hours, or by the time the day rolls over… if they're doing it at 11 p.m. maybe they get 25
 * hours… unless they want to just clear it out."*
 *
 * The listing itself is already saved as a private DRAFT ROW as the host works (the form's
 * autosave), and every photo and video is in storage the moment it is added. What was missing is
 * the way BACK: a fresh `?form=1` opened an empty form, because nothing remembered which draft
 * this person was in the middle of. This is that memory — a pointer, not a copy of the form:
 *
 *   · per person and per form (rent / sale), in this browser;
 *   · it lasts until the END OF TOMORROW — always at least 24 hours, and a draft started at
 *     11 p.m. gets the 25 Lee asked for;
 *   · discarding the draft clears it, publishing clears it, and an expired one is dropped on read.
 *
 * The row stays the source of truth: resuming opens the draft through the same loader as editing,
 * so every field — not just the ones somebody remembered to list here — comes back.
 * ==========================================================================================*/

export type DraftKind = "rent" | "sale";
export type DraftPointer = { id: string; step?: string | null; expires: number };

const key = (kind: DraftKind, userId: string) => `ow.listingDraft.${kind}.${userId}`;

/** 23:59:59.999 tomorrow, local time. */
export function endOfTomorrow(now = new Date()): number {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function readDraft(kind: DraftKind, userId: string | null | undefined): DraftPointer | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(kind, userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as DraftPointer;
    if (!p?.id || typeof p.expires !== "number" || p.expires < Date.now()) {
      localStorage.removeItem(key(kind, userId));
      return null;
    }
    return p;
  } catch { return null; }
}

export function rememberDraft(kind: DraftKind, userId: string | null | undefined, id: string, step?: string | null) {
  if (!userId || !id) return;
  try {
    localStorage.setItem(key(kind, userId), JSON.stringify({ id, step: step ?? null, expires: endOfTomorrow() }));
  } catch { /* private mode — the draft row still exists in My properties */ }
}

export function forgetDraft(kind: DraftKind, userId: string | null | undefined) {
  if (!userId) return;
  try { localStorage.removeItem(key(kind, userId)); } catch { /* nothing to clear */ }
}
