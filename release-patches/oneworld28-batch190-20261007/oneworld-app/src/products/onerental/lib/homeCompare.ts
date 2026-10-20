import { useLocation } from "react-router-dom";
import { supabase, productHref, W } from "@oneworld/shell";

/* ============================================================================================
 * AI COMPARE — the client half. See the `home-compare` edge function for the server half and
 * db/ONEHOME30_home_compare.sql for the tables.
 *
 * Three things a renter or buyer now does with what they saved (Lee, 2 Oct 2026):
 *   1 · ORGANISE it — Like or Love, Seen (in person) or not yet, plus a private note on each.
 *   2 · DEFINE their ideal home — up to five priorities, in order, spoken or typed.
 *   3 · COMPARE two or three against it — VAIA ranks them and says why. Free 3 a month, Pro 10,
 *       VIP 30 (Lee, 2 Oct 2026); re-opening one already made is free.
 * ==========================================================================================*/

export type Tier = "like" | "love";
export type SavedKind = "rent" | "sale";
export type Priority = { label: string; detail?: string };
export type HomeProfile = { priorities: Priority[]; looking_for: "rent" | "buy" | "either"; spoken?: string | null; updated_at?: string | null };
/** The monthly allowance (Lee, 2 Oct 2026): Free 3 · Pro 10 · VIP 30 comparisons a month. */
export type Access = {
  allowed: boolean; reason: "plan" | "monthly_limit" | "signed_out" | "error" | "needs_plan";
  plan?: "free" | "pro" | "vip"; limit?: number; used?: number; left?: number; resets_on?: string;
};
export type Fit = { priority: string; level: "strong" | "partial" | "weak" | "unknown"; note: string };
export type Ranked = {
  kind: SavedKind; id: string; letter: string; rank: number; score: number; verdict: string;
  why: string[]; drawbacks: string[]; fit: Fit[]; ask_owner: string[];
};
export type CompareResult = { summary: string; key_differences: string[]; ranking: Ranked[]; lang: string };

export const COMPARE_MAX = 3;

/** Saved, Ideal home and Compare are mounted under BOTH /rentals and /sales, so a buyer never gets
 *  bounced into the rentals section mid-task. Links on these screens stay in whichever one you are in. */
export function useHomeProduct(): "onerental" | "onesale" {
  const { pathname } = useLocation();
  return pathname.startsWith(productHref("onesale", "/")) ? "onesale" : "onerental";
}
export const itemType = (k: SavedKind) => (k === "sale" ? "sale_property" : "rental_property");

export async function setTier(userId: string, kind: SavedKind, id: string, tier: Tier) {
  return supabase.from("saved_items").update({ tier, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("item_type", itemType(kind)).eq("item_id", id);
}
export async function setSeen(userId: string, kind: SavedKind, id: string, seen: boolean) {
  return supabase.from("saved_items").update({ seen_at: seen ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("item_type", itemType(kind)).eq("item_id", id);
}
export async function setNote(userId: string, kind: SavedKind, id: string, note: string) {
  return supabase.from("saved_items").update({ note: note.trim() ? note.slice(0, 2000) : null, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("item_type", itemType(kind)).eq("item_id", id);
}

export async function loadProfile(userId: string): Promise<HomeProfile | null> {
  const { data, error } = await supabase.from("home_profiles").select("priorities, looking_for, spoken, updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const pr = Array.isArray((data as any).priorities) ? (data as any).priorities : [];
  return { priorities: pr, looking_for: (data as any).looking_for ?? "either", spoken: (data as any).spoken ?? null, updated_at: (data as any).updated_at ?? null };
}
export async function saveProfile(userId: string, p: HomeProfile) {
  return supabase.from("home_profiles").upsert({
    user_id: userId, priorities: p.priorities.slice(0, 5), looking_for: p.looking_for,
    spoken: p.spoken ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

export async function myAccess(): Promise<Access> {
  const { data, error } = await supabase.rpc("my_home_compare_access");
  /* A failed lookup is NOT a paywall — say it failed and offer to retry. */
  if (error || !data) return { allowed: false, reason: "error" };
  return data as Access;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("home-compare", { body });
  if (error) {
    /* Supabase wraps a non-2xx answer; the function's own JSON says what happened. */
    let detail: any = null;
    try { detail = await (error as any).context?.json?.(); } catch { /* not JSON */ }
    const e = new Error(detail?.error || "failed") as Error & { code?: string };
    e.code = detail?.error || "failed";
    throw e;
  }
  return data as T;
}
export const extractPriorities = (text: string, lang: string) =>
  call<{ priorities: Priority[]; looking_for: HomeProfile["looking_for"] }>({ mode: "profile", text, lang });
/** House rules from what the host said (home-compare v7, mode "rules"). */
export const extractRules = (text: string, max: number, lang: string) =>
  call<{ rules: string[] }>({ mode: "rules", text, max, lang });
export const runCompare = (items: { kind: SavedKind; id: string }[], lang: string) =>
  call<{ id: string; created_at: string; result: CompareResult; access: string }>({ mode: "compare", items, lang });

/** The newest comparison of exactly these homes (any order) from the last 24 hours — only if it
 *  is in the language on screen and newer than the ideal home it was judged against. */
export async function lastComparison(userId: string, pick: { kind: SavedKind; id: string }[], lang: string, profileAt?: string | null) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabase.from("home_comparisons").select("items, result, created_at")
    .eq("user_id", userId).gt("created_at", since).order("created_at", { ascending: false }).limit(10);
  const want = pick.map(p => `${p.kind}:${p.id}`).sort().join(",");
  const hit = (data ?? []).find((c: any) =>
    (Array.isArray(c.items) ? c.items : []).map((i: any) => `${i.kind}:${i.id}`).sort().join(",") === want
    && c.result?.lang === lang
    && (!profileAt || new Date(c.created_at) > new Date(profileAt)));
  return hit ? { result: hit.result as CompareResult, created_at: hit.created_at as string } : null;
}

/** The function answers with a code; the member reads it in their own language. */
/* Overlay 37: was `es = lang !== "en"`, so German, Russian, Chinese and Portuguese read Spanish. */
export function compareErrorText(lang: string, code?: string): string {
  switch (code) {
    case "no_profile": return W(lang, "Set up your ideal home first.", "Primero defina su hogar ideal.");
    case "busy": return W(lang, "VAIA is busy right now. Try again in a minute.", "VAIA está ocupada en este momento. Inténtelo en un minuto.");
    case "incomplete": return W(lang, "VAIA's answer came back incomplete. Please try again.", "La respuesta de VAIA quedó incompleta. Inténtelo de nuevo.");
    case "listing_unavailable": return W(lang, "One of these listings is no longer available. Pick another in Saved.", "Uno de estos anuncios ya no está disponible. Elija otro en Guardados.");
    case "not_saved": return W(lang, "Save these homes first. Compare works on your Saved list.", "Guarde estos inmuebles primero. Comparar funciona con su lista de Guardados.");
    case "daily_limit": return W(lang, "You've reached today's limit. Come back tomorrow.", "Llegó al límite de hoy. Vuelva mañana.");
    case "monthly_limit": return W(lang, "You've used this month's comparisons.", "Ya usó sus comparaciones de este mes.");
    case "signed_out": return W(lang, "Sign in to continue.", "Inicie sesión para continuar.");
    case "nothing_said": return W(lang, "Say or type a little more.", "Diga o escriba un poco más.");
    default: return W(lang, "Something went wrong. Please try again.", "Algo salió mal. Inténtelo de nuevo.");
  }
}

/** Ids picked on the Saved screen travel in the address: "rent:<uuid>,sale:<uuid>". */
export const encodePick = (items: { kind: SavedKind; id: string }[]) => items.map(i => `${i.kind}:${i.id}`).join(",");
export const decodePick = (s: string | null): { kind: SavedKind; id: string }[] =>
  (s ?? "").split(",").map(x => x.split(":")).filter(([k, id]) => (k === "rent" || k === "sale") && !!id)
    .map(([k, id]) => ({ kind: k as SavedKind, id })).slice(0, COMPARE_MAX);
