import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isSupportedProviderStatus } from "./provider-status.ts";

const encoder = new TextEncoder();

const constantTimeEqual = (left: string, right: string) => {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
};

const signedUrlCandidates = (req: Request) => {
  const candidates = new Set([req.url]);
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  if (supabaseUrl) {
    const current = new URL(req.url);
    candidates.add(`${supabaseUrl}/functions/v1/twilio-message-status${current.search}`);
  }
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    const current = new URL(req.url);
    candidates.add(`${forwardedProto}://${forwardedHost}${current.pathname}${current.search}`);
  }
  return [...candidates];
};

async function validTwilioSignature(req: Request, form: FormData, authToken: string) {
  const supplied = req.headers.get("x-twilio-signature") || "";
  if (!authToken || !supplied) return false;

  const fields = [...form.entries()]
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    );

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  for (const candidateUrl of signedUrlCandidates(req)) {
    const payload = fields.reduce(
      (combined, [field, value]) => combined + field + value,
      candidateUrl,
    );
    const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
    if (constantTimeEqual(expected, supplied)) return true;
  }
  return false;
}

async function applyProviderStatus(
  admin: ReturnType<typeof createClient>,
  target: "outbound" | "reminder" | "recipient",
  id: string,
  status: string,
  at: string,
  errorCode?: string,
  errorMessage?: string,
) {
  const { data, error } = await admin.rpc("oneevent_apply_twilio_provider_status", {
    p_target: target,
    p_id: id,
    p_provider_status: status,
    p_status_at: at,
    p_error_code: errorCode || null,
    p_error_message: errorMessage || null,
  });
  if (error) throw error;
  return data === true;
}

async function applyRecipientProviderStatus(
  admin: ReturnType<typeof createClient>,
  id: string,
  status: string,
  at: string,
  errorCode?: string,
  errorMessage?: string,
) {
  const { data, error } = await admin.rpc("oneevent_apply_twilio_recipient_status", {
    p_recipient_id: id,
    p_provider_status: status,
    p_status_at: at,
    p_error_code: errorCode || null,
    p_error_message: errorMessage || null,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return {
    applied: result?.applied === true,
    kickSmsFallback: result?.kick_sms_fallback === true,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST required", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return new Response("Unavailable", { status: 503 });

  const admin = createClient(supabaseUrl, serviceKey);
  const form = await req.formData();
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  if (!(await validTwilioSignature(req, form, twilioAuthToken))) {
    console.warn("Twilio status callback rejected: signature", {
      has_signature: Boolean(req.headers.get("x-twilio-signature")),
      auth_token_length: twilioAuthToken.length,
      signed_url_candidates: signedUrlCandidates(req).length,
    });
    return new Response("Forbidden signature", { status: 403 });
  }
  const payload = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  const sid = String(payload.MessageSid || payload.SmsSid || "");
  const nextStatus = String(payload.MessageStatus || payload.SmsStatus || payload.status || "").toLowerCase();
  if (!/^[A-Z]{2}[0-9a-fA-F]{32}$/.test(sid) || !isSupportedProviderStatus(nextStatus)) {
    return new Response("Bad callback", { status: 400 });
  }

  const { data: recipient } = await admin
    .from("event_rolodex_broadcast_recipients")
    .select("id, broadcast_id, rolodex_id, channel, destination, status, provider_status, provider_message_id, provider_sid, delivered_at, opened_at")
    .or(`provider_message_id.eq.${sid},provider_sid.eq.${sid}`)
    .maybeSingle();
  const { data: reminderDelivery } = await admin
    .from("event_reminder_deliveries")
    .select("id, channel, destination, status, provider_status, sent_at, delivered_at, read_at")
    .eq("provider_message_id", sid)
    .maybeSingle();
  const { data: outboundMessage } = await admin
    .from("outbound_messages")
    .select("id, channel, to_address, status, provider_status, sent_at, delivered_at")
    .eq("provider_id", sid)
    .maybeSingle();

  await admin.from("event_message_provider_callbacks").upsert({
    recipient_id: recipient?.id || null,
    outbound_message_id: outboundMessage?.id || null,
    provider_message_id: sid,
    provider_status: nextStatus,
    channel: recipient?.channel || reminderDelivery?.channel || outboundMessage?.channel || null,
    error_code: payload.ErrorCode || null,
    error_message: payload.ErrorMessage || null,
    payload,
  }, {
    onConflict: "provider,provider_message_id,provider_status,error_code",
    ignoreDuplicates: true,
  });

  if (!recipient && reminderDelivery) {
    const callbackTo = String(payload.To || "").replace(/^whatsapp:/i, "");
    const expectedTo = String(reminderDelivery.destination || "").replace(/^whatsapp:/i, "");
    if (callbackTo && expectedTo && callbackTo !== expectedTo) {
      console.warn("Twilio reminder callback destination mismatch", { sid });
      return new Response("ok", { status: 200 });
    }
    const now = new Date().toISOString();
    await applyProviderStatus(
      admin,
      "reminder",
      reminderDelivery.id,
      nextStatus,
      now,
      payload.ErrorCode,
      payload.ErrorMessage,
    );
    return new Response("ok", { status: 200 });
  }

  if (!recipient && outboundMessage) {
    const callbackTo = String(payload.To || "").replace(/^whatsapp:/i, "");
    const expectedTo = String(outboundMessage.to_address || "").replace(/^whatsapp:/i, "");
    if (callbackTo && expectedTo && callbackTo !== expectedTo) {
      console.warn("Twilio outbound callback destination mismatch", { sid });
      return new Response("ok", { status: 200 });
    }

    const now = new Date().toISOString();
    await applyProviderStatus(
      admin,
      "outbound",
      outboundMessage.id,
      nextStatus,
      now,
      payload.ErrorCode,
      payload.ErrorMessage,
    );
    return new Response("ok", { status: 200 });
  }

  if (!recipient) return new Response("ok", { status: 200 });

  const callbackTo = String(payload.To || "").replace(/^whatsapp:/i, "");
  const expectedTo = String(recipient.destination || "").replace(/^whatsapp:/i, "");
  if (callbackTo && expectedTo && callbackTo !== expectedTo) {
    console.warn("Twilio callback destination mismatch", { sid });
    return new Response("ok", { status: 200 });
  }

  const now = new Date().toISOString();
  const recipientResult = await applyRecipientProviderStatus(
    admin,
    recipient.id,
    nextStatus,
    now,
    payload.ErrorCode,
    payload.ErrorMessage,
  );
  if (!recipientResult.applied && !recipientResult.kickSmsFallback) {
    return new Response("ok", { status: 200 });
  }

  if (recipientResult.kickSmsFallback) {
    const workerResponse = await fetch(`${supabaseUrl}/functions/v1/process-event-rolodex-broadcast`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ broadcastId: recipient.broadcast_id, trigger: "whatsapp_fallback" }),
    }).catch((error) => {
      console.error("Could not start SMS fallback worker", error);
      return null;
    });
    if (workerResponse && !workerResponse.ok) {
      console.error("SMS fallback worker returned", workerResponse.status);
    }
  }

  return new Response("ok", { status: 200 });
});
