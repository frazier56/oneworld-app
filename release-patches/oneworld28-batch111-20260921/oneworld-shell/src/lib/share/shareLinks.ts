import { supabase } from "../supabase";

/**
 * Short share links — ONE for every One World app.
 * ============================================================================================
 * Lee, 30 Sep 2026: *"We never want an actual letters-and-numbers link that says
 * www.oneworldlabs.com/home/9234 ... it's a shell thing ... the same exact function for
 * everything that needs to be shared."*
 *
 * `share_code(kind, id)` mints ONE stable 7-character code per thing (the database refuses
 * anything not public). The link is `<SHARE_BASE>/<code>`; the `share` edge function behind it
 * returns the preview card WhatsApp, iMessage, SMS, Facebook and Instagram DMs draw.
 *
 * SHARE_BASE is `https://go.oneworldlabs.ai` — Porkbun 302s it (path included) to the `share`
 * function; live and verified 30 Sep 2026. VITE_SHARE_BASE can override it for a test build.
 */
export type ShareKind = "rental" | "sale" | "event" | "profile" | "job";
export type ShareApp = "social" | "jobs" | "events" | "rentals" | "sales";

const ENV_BASE = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SHARE_BASE;
export const SHARE_BASE = (ENV_BASE && /^https:\/\//.test(ENV_BASE) ? ENV_BASE : "https://go.oneworldlabs.ai").replace(/\/+$/, "");

const cache = new Map<string, string>();

/** The short link for a public thing, or `null` if it is not shareable (draft, private, unknown). */
export async function getShareLink(kind: ShareKind, id: string, app?: ShareApp): Promise<string | null> {
  const key = `${kind}:${id}:${app ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { data, error } = await supabase.rpc("share_code", { p_kind: kind, p_id: id, p_app: app ?? null });
  if (error || typeof data !== "string") return null;
  const link = `${SHARE_BASE}/${data}`;
  cache.set(key, link);
  return link;
}

/** What a person reads: the link without its scheme, e.g. "go.oneworldlabs.ai/kU5XB9D". */
export const displayLink = (link: string) => link.replace(/^https?:\/\//, "");
