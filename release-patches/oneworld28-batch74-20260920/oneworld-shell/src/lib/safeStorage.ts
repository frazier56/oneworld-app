/** Browser preferences remain usable when storage access or a later operation fails. */
const memory = new Map<string, string>();
// A failed write is newer than the value still on disk. Keep that key authoritative
// in this page until a successful write or a later storage event supersedes it.
const pending = new Set<string>();

export const readPref = (k: string): string | null => {
  if (pending.has(k)) return memory.get(k) ?? null;
  try {
    const value = localStorage.getItem(k);
    if (value === null) memory.delete(k);
    else memory.set(k, value);
    return value;
  } catch {
    return memory.get(k) ?? null;
  }
};

export const writePref = (k: string, v: string): void => {
  memory.set(k, v);
  pending.add(k);
  try {
    localStorage.setItem(k, v);
    pending.delete(k);
  } catch { /* Unavailable storage or quota: retain the latest page-local value. */ }
};

// Normal reads continue to consult storage, so another tab's successful write or
// removal is visible. Its event also supersedes a failed local write and updates
// the fallback cache for any subsequent read denial. Never clear browser storage.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event: StorageEvent) => {
    try {
      if (event.storageArea !== localStorage) return;
    } catch { return; }
    if (event.key === null) {
      memory.clear();
      pending.clear();
    } else {
      pending.delete(event.key);
      if (event.newValue === null) memory.delete(event.key);
      else memory.set(event.key, event.newValue);
    }
  });
}
