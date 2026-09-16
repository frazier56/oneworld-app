/**
 * localStorage, without the crash.
 * ============================================================================================
 * `I18nProvider` and `ThemeProvider` both read localStorage in a `useState` INITIALISER, which
 * runs during render. That throws `ReferenceError: localStorage is not defined` anywhere there
 * is no browser — a prerender, an SSR pass, a Node test — and it takes the entire tree with it,
 * chrome and all.
 *
 * It also throws in a real browser: Safari in Lockdown Mode and any embedded webview with
 * storage disabled raise `SecurityError` on ACCESS, not on read. So a try/catch is not
 * belt-and-braces here, it is the actual case.
 *
 * Found by the render test on 3 Aug 2026 — the first test in this package that rendered anything
 * rather than reading config objects and grepping source. It failed on its first run.
 */
const available = (() => {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem("__ow_probe", "1");
    localStorage.removeItem("__ow_probe");
    return true;
  } catch { return false; }
})();

/** Falls back to memory, so a preference still holds for the life of the page. */
const memory = new Map<string, string>();

export const readPref = (k: string): string | null =>
  available ? localStorage.getItem(k) : (memory.get(k) ?? null);

export const writePref = (k: string, v: string): void => {
  if (available) { try { localStorage.setItem(k, v); return; } catch { /* quota, private mode */ } }
  memory.set(k, v);
};
