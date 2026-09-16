import { supabase } from "@evt/integrations/supabase/client";

/**
 * Fire-and-forget SMS notification when a message is sent on the platform.
 * Calls the notify-new-message edge function which sends an SMS via Twilio.
 */
export function notifySmsNewMessage(params: {
  recipientId: string;
  senderId: string;
  messagePreview: string;
  messageType?: string;
}) {
  supabase.functions
    .invoke("notify-new-message", {
      body: {
        recipient_id: params.recipientId,
        sender_id: params.senderId,
        message_preview: params.messagePreview,
        message_type: params.messageType || "text",
      },
    })
    .catch(() => {});
}
