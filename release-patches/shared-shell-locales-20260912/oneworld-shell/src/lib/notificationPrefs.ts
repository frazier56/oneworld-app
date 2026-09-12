import { supabase } from "./supabase";

/**
 * NOTIFICATION PREFERENCES (SHELL) — a table that already existed and nothing was reading.
 * ============================================================================================
 * Lee, 10 Aug 2026, on Settings: *"Go through the settings page and optimise it so it makes
 * sense. Make sure all the relevant things are there that you feel are necessary."*
 *
 * Notifications was the biggest gap, and it turned out not to need any new schema at all:
 * `notification_preferences` has been in the database the whole time, correctly RLS'd to
 * `auth.uid() = user_id`, holding 4 rows and read by nothing in the shell. So a member had no
 * way to stop the platform emailing and pushing at them — the single most common reason someone
 * mutes or deletes an app.
 *
 * The real columns, checked before writing this:
 *   push_enabled · push_new_message · push_contract_received · push_payment_received
 *   push_lead_replied · push_lead_converted · push_new_lead_match · push_new_job_in_area
 *   push_new_event_in_area · push_new_pro_in_area · push_score_milestone
 *   push_quiet_hours_start · push_quiet_hours_end · push_max_per_day
 *
 * NO ROW MEANS "EVERYTHING ON". Most members have no row, so a screen that reads a missing row
 * as all-off would show every switch dark and imply notifications were already disabled — while
 * the sender kept sending. The default here is ON, and the row is created on the first change.
 */

export type NotifPrefs = {
  push_enabled: boolean;
  push_new_message: boolean;
  push_contract_received: boolean;
  push_payment_received: boolean;
  push_new_job_in_area: boolean;
  push_new_event_in_area: boolean;
  push_score_milestone: boolean;
};

export const NOTIF_DEFAULTS: NotifPrefs = {
  push_enabled: true,
  push_new_message: true,
  push_contract_received: true,
  push_payment_received: true,
  push_new_job_in_area: true,
  push_new_event_in_area: true,
  push_score_milestone: true,
};

export type NotifKey = keyof NotifPrefs;

export async function getNotifPrefs(userId: string): Promise<NotifPrefs> {
  const { data, error } = await supabase.from("notification_preferences")
    .select("push_enabled, push_new_message, push_contract_received, push_payment_received, push_new_job_in_area, push_new_event_in_area, push_score_milestone")
    .eq("user_id", userId).maybeSingle();
  if (error) { console.error("[notificationPrefs] read failed:", error.message); return NOTIF_DEFAULTS; }
  if (!data) return NOTIF_DEFAULTS;
  /* A null column is not "off" either — it is "never set". Same reasoning as a missing row. */
  const out = { ...NOTIF_DEFAULTS };
  for (const k of Object.keys(NOTIF_DEFAULTS) as NotifKey[]) {
    const v = (data as any)[k];
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Flip one preference. Upserts, because most members have no row yet. */
export async function setNotifPref(userId: string, key: NotifKey, on: boolean) {
  const { error } = await supabase.from("notification_preferences")
    .upsert({ user_id: userId, [key]: on, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) { console.error("[notificationPrefs] save failed:", error.message); return { error: error.message }; }
  return { ok: true as const };
}
