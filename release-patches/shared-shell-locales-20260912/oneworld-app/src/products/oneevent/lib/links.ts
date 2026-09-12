import { supabase } from "./supabase";

export type AppLinks = Record<string, boolean>;
const LS = "owl-app-links";

export async function getAppLinks(userId: string): Promise<AppLinks> {
  try {
    const { data, error } = await supabase.from("one_world_app_links").select("app_id, settings").eq("user_id", userId);
    if (!error && data) {
      const out: AppLinks = {};
      data.forEach((r: any) => { out[r.app_id] = !!r.settings?.show_on_onesocial; });
      // merge any local-only flags (pre-migration writes)
      const local = JSON.parse(localStorage.getItem(LS) || "{}");
      return { ...local, ...out };
    }
  } catch {}
  return JSON.parse(localStorage.getItem(LS) || "{}");
}

export async function setAppLink(userId: string, appId: string, on: boolean): Promise<void> {
  const local = JSON.parse(localStorage.getItem(LS) || "{}");
  local[appId] = on;
  localStorage.setItem(LS, JSON.stringify(local));
  try {
    await supabase.from("one_world_app_links").upsert(
      { user_id: userId, app_id: appId, settings: { show_on_onesocial: on } },
      { onConflict: "user_id,app_id" }
    );
  } catch {} // table pending migration — localStorage carries it
}


/** Links for someone ELSE's public profile — table only (no localStorage: that
 *  belongs to the viewer, not the profile owner). null = no explicit setting.
 *  Pre-migration (table missing) → {} = default everything to visible. */
export async function getPublicAppLinks(ownerId: string): Promise<Record<string, boolean | null>> {
  try {
    const { data, error } = await supabase.from("one_world_app_links").select("app_id, settings").eq("user_id", ownerId);
    if (error || !data) return {};
    const out: Record<string, boolean | null> = {};
    data.forEach((r: any) => { out[r.app_id] = r.settings?.show_on_onesocial ?? null; });
    return out;
  } catch { return {}; }
}

/** Live public score once the `public_scores` view exists (Lovable prompt pending);
 *  callers fall back to profiles.score_v9_snapshot until then. */
export async function getPublicLiveScore(ownerId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.from("public_scores").select("one_score").eq("user_id", ownerId).maybeSingle();
    if (error) return null;
    return (data as any)?.one_score ?? null;
  } catch { return null; }
}
