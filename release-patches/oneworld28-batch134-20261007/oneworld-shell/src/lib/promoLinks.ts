import { supabase } from "./supabase";

/**
 * PROMO LINKS (SHELL) — a person's own website + app-store buttons on their profile.
 * One profile across every app, so this is shell code. Table `one_world_promo_links`
 * (see migration 20261008_promo_links.sql). Mirrors appLinks.ts conventions: the server
 * is the record, errors are returned not swallowed, columns are exactly as named.
 *
 * Product rule (app-level, not DB): at most 3 website links. Apps may add 1 iOS + 1 Android.
 */
export type PromoKind = "website" | "app";
export type Platform = "ios" | "android";

export interface PromoLink {
  id?: string;
  kind: PromoKind;
  label: string;
  url: string;
  platform?: Platform | null;
  hue?: string | null;
  logo_url?: string | null;
  position?: number;
}

export const MAX_WEBSITES = 3;

/** Detect the store from a pasted share URL so the owner doesn't have to pick. */
export function detectPlatform(url: string): Platform | null {
  const u = url.toLowerCase();
  if (u.includes("apps.apple.com") || u.includes("itunes.apple.com")) return "ios";
  if (u.includes("play.google.com")) return "android";
  return null;
}

/** Owner's own links, ordered. */
export async function getPromoLinks(userId: string): Promise<PromoLink[]> {
  const { data, error } = await supabase
    .from("one_world_promo_links")
    .select("id, kind, label, url, platform, hue, logo_url, position")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) { console.warn("[promoLinks] read failed:", error.message); return []; }
  return (data ?? []) as PromoLink[];
}

/** Public links for someone else's profile (RLS already gates on is_public). */
export async function getPublicPromoLinks(ownerId: string): Promise<PromoLink[]> {
  return getPromoLinks(ownerId);
}

/** Insert/patch one link. Returns the row id or an error string — never silently fails. */
export async function savePromoLink(userId: string, link: PromoLink): Promise<{ id?: string; error?: string }> {
  const platform = link.kind === "app" ? (link.platform ?? detectPlatform(link.url)) : null;
  if (link.kind === "app" && !platform) return { error: "Couldn't tell if that's an App Store or Google Play link." };
  const row = {
    user_id: userId, kind: link.kind, label: link.label.trim(), url: link.url.trim(),
    platform, hue: link.hue ?? null, logo_url: link.logo_url ?? null, position: link.position ?? 0,
    updated_at: new Date().toISOString(),
  };
  const q = link.id
    ? supabase.from("one_world_promo_links").update(row).eq("id", link.id).eq("user_id", userId).select("id").maybeSingle()
    : supabase.from("one_world_promo_links").insert(row).select("id").maybeSingle();
  const { data, error } = await q;
  if (error) { console.warn("[promoLinks] save failed:", error.message); return { error: error.message }; }
  return { id: (data as any)?.id };
}

export async function deletePromoLink(userId: string, id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("one_world_promo_links").delete().eq("id", id).eq("user_id", userId);
  if (error) { console.warn("[promoLinks] delete failed:", error.message); return { error: error.message }; }
  return {};
}
