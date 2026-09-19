import { supabase } from "./supabase";

/**
 * STARTING A CONVERSATION — one helper, every app, every entry point.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"on the messages page, there needs to be a button… so people can basically
 * start a new message. Because right now, there's no button for people to start a new chat with
 * anyone… And that is a shell thing. That means it's supposed to work across all applications."*
 *
 * There are now three places a conversation can begin, and they all call THIS — not three
 * implementations that create three subtly different rows:
 *   · the New-message button on the inbox (§4.x, Lee 10 Aug)
 *   · replying to a feed post (§4.7)
 *   · Connect / Message on somebody's public profile
 *
 * Written against the live schema, checked before a line of it:
 *   conversations · participant_ids uuid[] · last_message_text · last_message_at · category
 *                   · is_request (default false) · metadata
 *   messages      · conversation_id · sender_id · content · message_type · read_at
 *   user_connections · requester_id · recipient_id · status (default 'pending')
 *
 * TWO RULES THAT DECIDE THE CODE:
 *
 * 1. NEVER CREATE A SECOND CONVERSATION WITH THE SAME PERSON. `participant_ids` is an array with
 *    no uniqueness constraint on the pair, so a naive insert makes a duplicate thread every time
 *    somebody taps Message — and each one holds half the history. We look for an existing one
 *    first, with `contains`, and only insert when there is genuinely none.
 *
 * 2. `is_request` IS COMPUTED, NOT GUESSED. It means "a message from somebody you do not know
 *    yet", and the inbox's Requests filter is backed by it. So it is derived from a real accepted
 *    row in `user_connections` (in EITHER direction — connection is symmetric, the columns are
 *    not), never defaulted to false because that is the column default. Getting this wrong is
 *    what turns a stranger's cold message into an item in your main inbox.
 */

export type StartResult = { conversationId: string } | { error: string };
export const MESSAGE_CHANGE_WINDOW_MS = 60 * 60 * 1000;

/** Are these two people actually connected? Either direction, accepted only. */
export async function areConnected(a: string, b: string): Promise<boolean> {
  const { data, error } = await supabase.from("user_connections")
    .select("id, status")
    .or(`and(requester_id.eq.${a},recipient_id.eq.${b}),and(requester_id.eq.${b},recipient_id.eq.${a})`)
    .eq("status", "accepted")
    .limit(1);
  if (error) { console.error("[conversations] connection check failed:", error.message); return false; }
  return (data ?? []).length > 0;
}

/** The existing 1:1 conversation between two people, or null. */
export async function findConversation(myId: string, otherId: string): Promise<string | null> {
  const { data, error } = await supabase.from("conversations")
    .select("id, participant_ids")
    .contains("participant_ids", [myId, otherId])
    .order("last_message_at", { ascending: false })
    .limit(5);
  if (error) { console.error("[conversations] lookup failed:", error.message); return null; }
  /* `contains` matches a SUPERSET, so a group thread that happens to include both people would
     match too. A 1:1 thread is exactly two participants — check it rather than opening a group
     when someone asked to message one person. */
  const exact = (data ?? []).find((c: any) => (c.participant_ids ?? []).length === 2);
  return exact?.id ?? null;
}

/**
 * Open the conversation with this person, creating it only if there isn't one.
 * `firstMessage` is optional — the inbox's New-message button opens an empty thread; a reply to
 * a feed post seeds the first line.
 */
export async function startConversation(
  myId: string,
  otherId: string,
  firstMessage?: string,
): Promise<StartResult> {
  if (!myId || !otherId) return { error: "Missing who to message." };
  if (myId === otherId) return { error: "You can't message yourself." };

  const existing = await findConversation(myId, otherId);
  if (existing) {
    if (firstMessage?.trim()) {
      const sent = await sendMessage(existing, myId, firstMessage);
      if ("error" in sent) return sent;
    }
    return { conversationId: existing };
  }

  /* A first contact from someone you are not connected to belongs in Requests, not in the main
     inbox. Computed from a real accepted connection, never assumed. */
  const connected = await areConnected(myId, otherId);

  const { data, error } = await supabase.from("conversations")
    .insert({
      participant_ids: [myId, otherId],
      is_request: !connected,
      last_message_text: firstMessage?.trim() || null,
      category: "general",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[conversations] create failed:", error?.message);
    return { error: error?.message ?? "Could not start that conversation." };
  }

  if (firstMessage?.trim()) {
    const sent = await sendMessage(data.id, myId, firstMessage);
    if ("error" in sent) return sent;
  }
  return { conversationId: data.id };
}

/** Post a message and keep the conversation's preview row in step with it. */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  opts: { messageType?: string } = {},
): Promise<{ ok: true } | { error: string }> {
  const text = content.trim();
  if (!text) return { error: "Nothing to send." };

  const { error } = await supabase.from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: text,
      message_type: opts.messageType ?? "text",
    });
  if (error) {
    console.error("[conversations] send failed:", error.message);
    return { error: error.message };
  }
  /* The inbox reads `last_message_text` / `last_message_at` off the conversation, so a message
     that does not update them lands in a thread that still shows the previous preview — which
     reads as the message not sending. If a trigger already does this the write is harmless. */
  await supabase.from("conversations")
    .update({ last_message_text: text, last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
  return { ok: true };
}

export async function editMessage(
  messageId: string,
  senderId: string,
  content: string,
): Promise<{ ok: true } | { error: string }> {
  const text = content.trim();
  if (!text) return { error: "Nothing to save." };

  const { data, error } = await supabase.from("messages")
    .update({ content: text })
    .eq("id", messageId)
    .eq("sender_id", senderId)
    .is("read_at", null)
    .gte("created_at", new Date(Date.now() - MESSAGE_CHANGE_WINDOW_MS).toISOString())
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[conversations] edit failed:", error.message);
    return { error: error.message };
  }
  if (!data) return { error: "That message can no longer be edited." };
  return { ok: true };
}

export async function recallMessage(
  messageId: string,
  senderId: string,
): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase.from("messages")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: senderId,
    })
    .eq("id", messageId)
    .eq("sender_id", senderId)
    .gte("created_at", new Date(Date.now() - MESSAGE_CHANGE_WINDOW_MS).toISOString())
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[conversations] recall failed:", error.message);
    return { error: error.message };
  }
  if (!data) return { error: "That message can no longer be recalled." };
  return { ok: true };
}
