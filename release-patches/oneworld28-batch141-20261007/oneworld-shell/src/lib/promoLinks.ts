import { supabase } from "./supabase";

/**
 * PROMO LINKS (SHELL) — a person's own website + app-store buttons on their profile.
 * Table `one_world_promo_links`. Server is the record; errors returned not swallowed.
 * overlay 2: added normalizeUrl (auto-https, never doubles) so the UI never shows a
 * protocol "error". The DB CHECK already requires ^https?:// — normalizeUrl satisfies it.
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

/** Add https:// if the user left it off; never double it. */
export function normalizeUrl(raw: string): string {
  let u = (raw || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  return u;
}

export function detectPlatform(url: string): Platform | null {
  /* HOSTNAME, not substring (TESTING, 8 Oct 3:50 AM): "https://example.com/?next=apps.apple.com"
     used to become an "App Store" button that opened example.com. Only the real store hosts, over
     https, with no username or port, count. The database enforces the same rule
     (constraint promo_links_store_host), so a direct API call cannot bypass it. */
  let u: URL;
  try { u = new URL((url || "").trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (host === "apps.apple.com" || host === "itunes.apple.com") return "ios";
  if (host === "play.google.com") return "android";
  return null;
}

/* ── Logo files (TESTING 3:25 + 3:50 AM: no orphaned public files) ─────────────────────────
   Validated upload into the owner's own media folder (DB constraint promo_links_logo_own_media
   requires exactly that), and a remover the editor calls whenever an uploaded logo is replaced,
   removed, abandoned, fails to save, or its link is deleted. */
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const MEDIA_PUBLIC = "/storage/v1/object/public/media/";

export async function uploadPromoLogo(userId: string, f: File): Promise<{ url: string; path: string } | { error: "type" | "size" | "upload" }> {
  if (!LOGO_TYPES.includes(f.type)) return { error: "type" };
  if (f.size > LOGO_MAX_BYTES) return { error: "size" };
  const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/promo-logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, f, { contentType: f.type, upsert: false });
  if (error) { console.warn("[promoLinks] logo upload failed:", error.message); return { error: "upload" }; }
  return { url: supabase.storage.from("media").getPublicUrl(path).data.publicUrl, path };
}

/** Path inside the media bucket for one of the owner's promo logos, or null for anything else. */
export function promoLogoPath(userId: string, url?: string | null): string | null {
  if (!url) return null;
  const i = url.indexOf(MEDIA_PUBLIC);
  if (i < 0) return null;
  const path = decodeURIComponent(url.slice(i + MEDIA_PUBLIC.length).split("?")[0]);
  return path.startsWith(`${userId}/promo-logo-`) ? path : null;
}

export async function removePromoLogo(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from("media").remove([path]);
  if (error) console.warn("[promoLinks] logo cleanup failed:", error.message);
}

export async function getPromoLinks(userId: string): Promise<PromoLink[]> {
  const { data, error } = await supabase
    .from("one_world_promo_links")
    .select("id, kind, label, url, platform, hue, logo_url, position")
    .eq("user_id", userId).order("position", { ascending: true });
  if (error) { console.warn("[promoLinks] read failed:", error.message); return []; }
  return (data ?? []) as PromoLink[];
}

export async function getPublicPromoLinks(ownerId: string): Promise<PromoLink[]> {
  return getPromoLinks(ownerId);
}

export async function savePromoLink(userId: string, link: PromoLink): Promise<{ id?: string; error?: string }> {
  const url = normalizeUrl(link.url);
  const platform = link.kind === "app" ? detectPlatform(url) : null; // never trust a passed-in platform
  if (link.kind === "app" && !platform) return { error: "Couldn't tell if that's an App Store or Google Play link." };
  const row = {
    user_id: userId, kind: link.kind, label: link.label.trim(), url,
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
