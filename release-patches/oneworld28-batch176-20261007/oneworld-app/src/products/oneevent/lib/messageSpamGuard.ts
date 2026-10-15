/**
 * Message spam guard — rate limiting + duplicate detection for new conversations.
 */
import { supabase } from "@evt/integrations/supabase/client";

/** Rate limits per hour by plan tier */
const RATE_LIMITS: Record<string, number> = {
  free: 5,
  pro: 15,
  vip: 30,
};

/**
 * Check if the user can start a new conversation (rate limit).
 */
export async function checkNewConversationRateLimit(
  userId: string,
  planTier: string = "free"
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const maxPerHour = RATE_LIMITS[planTier] || RATE_LIMITS.free;

  const { data, error } = await supabase.rpc("check_message_rate_limit" as any, {
    p_user_id: userId,
    p_max_per_hour: maxPerHour,
  });

  if (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true, current: 0, limit: maxPerHour }; // fail open
  }

  return data as { allowed: boolean; current: number; limit: number };
}

/**
 * Check if two users have an accepted connection.
 */
export async function areUsersConnected(userA: string, userB: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("are_users_connected" as any, {
    p_user_a: userA,
    p_user_b: userB,
  });
  if (error) {
    console.error("Connection check error:", error);
    return false;
  }
  return !!data;
}

/**
 * Simple duplicate detection: checks if the user sent the same message
 * (or very similar) to 3+ different conversations in the last hour.
 */
export async function isDuplicateMessage(
  userId: string,
  messageText: string
): Promise<boolean> {
  const normalised = messageText.trim().toLowerCase().slice(0, 200);
  if (normalised.length < 20) return false; // too short to be spam

  const { data } = await supabase
    .from("messages")
    .select("conversation_id, content")
    .eq("sender_id", userId)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data || data.length < 3) return false;

  // Count unique conversations where the same (or very similar) message was sent
  const uniqueConvos = new Set<string>();
  for (const msg of data) {
    const msgNorm = msg.content.trim().toLowerCase().slice(0, 200);
    if (msgNorm === normalised || similarity(msgNorm, normalised) > 0.8) {
      uniqueConvos.add(msg.conversation_id);
    }
  }

  return uniqueConvos.size >= 3;
}

/** Simple Jaccard-like similarity for short strings */
function similarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
