import { supabase } from "./supabase";

/**
 * WHAT THE OWNER LETS THE PUBLIC SEE — persisted in `one_world_app_links`.
 * ============================================================================================
 * Moved into the shell with the profile: the public-visibility switches are the same object on
 * every app's profile, so they are shell code.
 *
 * The table is `one_world_app_links(user_id uuid, app text, visible bool, …)` PRIMARY KEY
 * (user_id, app). The columns are `app` and `visible` — an earlier OneJob version addressed
 * `app_id`/`settings.show_on_onesocial`, which do not exist, inside empty catch blocks, so the
 * toggles looked like they worked, persisted to exactly one browser, and the public profile
 * ignored them. Rules: the columns are `app` and `visible`; never silently swallow errors here.
 */
export type AppLinks = Record<string, boolean>;
const LS = "owl-app-links";

const readLocal = (): AppLinks => {
  try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; }
};

/** Owner's own view. Server is the record; the local cache only covers the round trip. */
export async function getAppLinks(userId: string): Promise<AppLinks> {
  const { data, error } = await supabase
    .from("one_world_app_links").select("app, visible").eq("user_id", userId);
  if (error) {
    console.warn("[appLinks] read failed, falling back to local cache:", error.message);
    return readLocal();
  }
  const out: AppLinks = {};
  (data ?? []).forEach(r => { out[r.app as string] = !!r.visible; });
  return { ...readLocal(), ...out };  // server wins; local stops an in-flight switch bouncing back
}

/** Write one setting. Returns the error rather than hiding it. */
export async function setAppLink(userId: string, appId: string, on: boolean): Promise<{ error?: string }> {
  const local = readLocal();
  local[appId] = on;
  try { localStorage.setItem(LS, JSON.stringify(local)); } catch { /* storage blocked */ }
  const { error } = await supabase
    .from("one_world_app_links").upsert({ user_id: userId, app: appId, visible: on }, { onConflict: "user_id,app" });
  if (error) { console.warn("[appLinks] write failed:", error.message); return { error: error.message }; }
  return {};
}

/**
 * Someone ELSE's settings, for their public profile. Table only — no localStorage, which belongs
 * to whoever is looking. A missing row is `null`, not `false`, and callers test `!== false`, so a
 * section the owner has never touched stays visible and only an explicit "off" hides it.
 */
export async function getPublicAppLinks(ownerId: string): Promise<Record<string, boolean | null>> {
  const { data, error } = await supabase
    .from("one_world_app_links").select("app, visible").eq("user_id", ownerId);
  if (error) { console.warn("[appLinks] public read failed:", error.message); return {}; }
  const out: Record<string, boolean | null> = {};
  (data ?? []).forEach(r => { out[r.app as string] = r.visible ?? null; });
  return out;
}
