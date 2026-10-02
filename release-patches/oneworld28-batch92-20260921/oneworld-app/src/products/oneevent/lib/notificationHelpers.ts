/**
 * Notification helper — creates in-app notifications via Supabase.
 */
import { supabase } from "@evt/integrations/supabase/client";

export type NotificationType =
  | "job_offer_sent"
  | "job_offer_received"
  | "job_offer_accepted"
  | "job_offer_declined"
  | "job_starting_soon"
  | "talent_checked_in"
  | "host_confirmed_checkin"
  | "completion_pending"
  | "job_completed"
  | "review_reminder"
  | "review_received"
  | "cancellation"
  | "connection_request"
  | "connection_accepted"
  | "message_received"
  | "event_reminder"
  | "job_match"
  | "general";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(params: CreateNotificationParams) {
  const { error } = await supabase.from("notifications" as any).insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body || null,
    action_url: params.actionUrl || null,
    metadata: params.metadata || {},
  });
  if (error) console.error("Failed to create notification:", error);
}

export async function markNotificationRead(notificationId: string) {
  await supabase
    .from("notifications" as any)
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
}

export async function markAllNotificationsRead(userId: string) {
  await supabase
    .from("notifications" as any)
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}
