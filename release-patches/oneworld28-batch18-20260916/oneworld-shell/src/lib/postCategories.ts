import type { AppKey } from "./oneWorld";

/**
 * POST CATEGORIES — the one list, written down once, in the shell.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"Categories on creation — hiring, looking for someone, general post, for
 * sale / real estate, looking for a professional, event… Something created elsewhere and made
 * public shows in the feed; something categorised in the feed as an event lands in the events
 * folder."*
 *
 * And, from the brief: *"Design the category enum once, in the shell, and write it down. Getting
 * this list wrong is expensive later."* That is the right instinct and it is why this file is
 * boring on purpose. A category key ends up in the database on every post ever written; renaming
 * one later means a migration plus every product that reads it.
 *
 * ── THE MODEL ──────────────────────────────────────────────────────────────────────────────
 * A post carries ONE category. The category decides which product's folder the post ALSO lives
 * in. Two directions, both required:
 *
 *   product → feed : anything created in a product and marked public appears in the feed.
 *   feed → product : a post categorised `event` appears in OneEvent; `hiring` and `pro_wanted`
 *                    in OneJob; `rental` in OneRental when it lands.
 *
 * ── THE CROSS-THREAD HANDSHAKE ─────────────────────────────────────────────────────────────
 * `rental` is the agreed key for Lee's "for sale / real estate", per the brief's coordination
 * point with the OneRental thread. It is declared here NOW, before either side builds against
 * it, because the whole cost of getting this wrong is two threads shipping two different keys
 * for the same idea. OneRental does not exist yet; `routesTo` already points at it, and the
 * router simply finds no product until it does — which is the cheap failure, not the expensive
 * one.
 *
 * ── WHY THE KEYS ARE NOT THE LABELS ────────────────────────────────────────────────────────
 * Keys are stable, lowercase, ASCII and never shown to a person; labels are translated and can
 * be reworded any time Lee wants. `pro_wanted` reads oddly next to "Looking for a professional"
 * and that is fine — the label is the copy, the key is the contract.
 */

export const POST_CATEGORIES = [
  { key: "general",    routesTo: null,        en: "General post",              es: "Publicación general" },
  { key: "hiring",     routesTo: "onejob",    en: "Hiring",                    es: "Contratando" },
  { key: "pro_wanted", routesTo: "onejob",    en: "Looking for a professional", es: "Busco un profesional" },
  { key: "looking",    routesTo: null,        en: "Looking for someone",       es: "Busco a alguien" },
  { key: "event",      routesTo: "oneevent",  en: "Event",                     es: "Evento" },
  { key: "rental",     routesTo: "onerental", en: "For rent",                 es: "En arriendo" },
  /* Split 10 Aug 2026. The original brief bundled renting and selling under one key because only
     the rental half existed; they are two products now, and a post that says "for sale" must not
     route somebody into the rental feed. */
  { key: "forsale",    routesTo: "onesale",   en: "For sale / real estate",   es: "En venta / inmuebles" },
] as const;

export type PostCategoryKey = (typeof POST_CATEGORIES)[number]["key"];

/** The default for a post nobody categorised. Never null — an uncategorised column is a migration. */
export const DEFAULT_POST_CATEGORY: PostCategoryKey = "general";

/** The product a category ALSO files the post into, or null for feed-only. */
export function categoryRoutesTo(key: string): AppKey | "onerental" | null {
  const row = POST_CATEGORIES.find(c => c.key === key);
  return (row?.routesTo ?? null) as AppKey | "onerental" | null;
}

/** The label, in the two languages the shell ships copy for today. */
export function categoryLabel(key: string, lang: string): string {
  const row = POST_CATEGORIES.find(c => c.key === key);
  if (!row) return key;
  return (lang === "es" || lang === "co") ? row.es : row.en;
}

/** Is this a real key? Guard writes with it — a typo'd category is invisible forever. */
export function isPostCategory(key: string): key is PostCategoryKey {
  return POST_CATEGORIES.some(c => c.key === key);
}
