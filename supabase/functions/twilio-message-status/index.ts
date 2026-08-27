import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validToken(admin: ReturnType<typeof createClient>, supplied: string) {
  if (!supplied || supplied.length < 32) return false;
  const { data } = await admin
    .from("integration_webhook_tokens")
    .select("token_sha256, enabled")
    .eq("name", "twilio_oneevent_status")
    .maybeSingle();
  if (!data?.enabled || !data.token_sha256) return false;
  return (await sha256Hex(supplied)) === data.token_sha256;
}

const statusRank: Record<string, number> = {
  accepted: 10,
  scheduled: 15,
  queued: 20,
  sending: 30,
  sent: 40,
  delivered: 50,
  read: 60,
  undelivered: 70,
  failed: 70,
  canceled: 70,
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST required", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return new Response("Unavailable", { status: 503 });

  const admin = createClient(supabaseUrl, serviceKey);
  const url = new URL(req.url);
  if (!(await validToken(admin, url.searchParams.get("token") || ""))) {
    return new Response("Forbidden", { status: 403 });
  }

  const form = await req.formData();
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  if (!(await validTwilioSignature(req, form, twilioAuthToken))) {
    return new Response("Forbidden", { status: 403 });
  }
  const payload = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  const sid = String(payload.MessageSid || payload.SmsSid || "");
  const nextStatus = String(payload.MessageStatus || payload.SmsStatus || payload.status || "").toLowerCase();
  if (!/^[A-Z]{2}[0-9a-fA-F]{32}$/.test(sid) || !(nextStatus in statusRank)) {
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

  await admin.from("event_message_provider_callbacks").insert({
    recipient_id: recipient?.id || null,
    provider_message_id: sid,
    provider_status: nextStatus,
    channel: recipient?.channel || reminderDelivery?.channel || null,
    error_code: payload.ErrorCode || null,
    error_message: payload.ErrorMessage || null,
    payload,
  });

  if (!recipient && reminderDelivery) {
    const callbackTo = String(payload.To || "").replace(/^whatsapp:/i, "");
    const expectedTo = String(reminderDelivery.destination || "").replace(/^whatsapp:/i, "");
    if (callbackTo && expectedTo && callbackTo !== expectedTo) {
      console.warn("Twilio reminder callback destination mismatch", { sid });
      return new Response("ok", { status: 200 });
    }
    const currentStatus = String(reminderDelivery.provider_status || "").toLowerCase();
    if ((statusRank[nextStatus] || 0) < (statusRank[currentStatus] || 0)) {
      return new Response("ok", { status: 200 });
    }
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      provider_message_id: sid,
      provider_status: nextStatus,
      provider_status_at: now,
      provider_error_code: payload.ErrorCode || null,
      updated_at: now,
    };
    if (["accepted", "scheduled", "queued", "sending"].includes(nextStatus)) {
      update.status = "queued";
    } else if (nextStatus === "sent") {
      update.status = "sent";
      update.sent_at = reminderDelivery.sent_at || now;
    } else if (nextStatus === "delivered") {
      update.status = "sent";
      update.sent_at = reminderDelivery.sent_at || now;
      update.delivered_at = reminderDelivery.delivered_at || now;
    } else if (nextStatus === "read") {
      update.status = "sent";
      update.sent_at = reminderDelivery.sent_at || now;
      update.delivered_at = reminderDelivery.delivered_at || now;
      update.read_at = reminderDelivery.read_at || now;
    } else {
      update.status = "failed";
      update.failure_reason = payload.ErrorMessage || `Twilio ${nextStatus}`;
    }
    await admin.from("event_reminder_deliveries").update(update).eq("id", reminderDelivery.id);
    return new Response("ok", { status: 200 });
  }

  if (!recipient) return new Response("ok", { status: 200 });

  const callbackTo = String(payload.To || "").replace(/^whatsapp:/i, "");
  const expectedTo = String(recipient.destination || "").replace(/^whatsapp:/i, "");
  if (callbackTo && expectedTo && callbackTo !== expectedTo) {
    console.warn("Twilio callback destination mismatch", { sid });
    return new Response("ok", { status: 200 });
  }

  const currentStatus = String(recipient.provider_status || "").toLowerCase();
  const currentRank = statusRank[currentStatus] || 0;
  if ((statusRank[nextStatus] || 0) < currentRank) {
    return new Response("ok", { status: 200 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    provider_message_id: sid,
    provider_status: nextStatus,
    provider_status_at: now,
    provider_error_code: payload.ErrorCode || null,
  };

  if (["accepted", "scheduled", "queued", "sending"].includes(nextStatus)) {
    update.status = "queued";
    update.queued_at = now;
  } else if (nextStatus === "sent") {
    update.status = "sent";
    update.sent_at = now;
  } else if (nextStatus === "delivered") {
    update.status = "sent";
    update.sent_at = recipient.status === "sent" ? undefined : now;
    update.delivered_at = recipient.delivered_at || now;
  } else if (nextStatus === "read") {
    update.status = "sent";
    update.delivered_at = recipient.delivered_at || now;
    update.opened_at = recipient.opened_at || now;
  } else {
    update.status = "failed";
    update.error_message = payload.ErrorMessage || `Twilio ${nextStatus}`;
    update.undelivered_at = now;
  }

  Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);
  await admin.from("event_rolodex_broadcast_recipients").update(update).eq("id", recipient.id);

  let kickSmsFallback = false;
  if (recipient.channel === "whatsapp" && ["delivered", "read", "failed", "undelivered"].includes(nextStatus)) {
    const { data: smsFallback } = await admin
      .from("event_rolodex_broadcast_recipients")
      .select("id")
      .eq("broadcast_id", recipient.broadcast_id)
      .eq("rolodex_id", recipient.rolodex_id)
      .eq("channel", "sms")
      .eq("provider_status", "waiting_for_whatsapp")
      .maybeSingle();
    if (smsFallback) {
      if (nextStatus === "delivered" || nextStatus === "read") {
        await admin.from("event_rolodex_broadcast_recipients").update({
          status: "skipped",
          skipped_reason: "whatsapp_delivered_primary",
          provider_status: "not_needed",
          provider_status_at: now,
          processing_status: "done",
          processed_at: now,
        }).eq("id", smsFallback.id);
      } else {
        await admin.from("event_rolodex_broadcast_recipients").update({
          status: "queued",
          skipped_reason: null,
          error_message: null,
          provider_status: null,
          provider_status_at: null,
          provider_error_code: null,
          processing_status: "pending",
          processed_at: null,
          queued_at: now,
        }).eq("id", smsFallback.id);
        kickSmsFallback = true;
      }
    }
  }

  if (kickSmsFallback) {
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

  const { data: rows } = await admin
    .from("event_rolodex_broadcast_recipients")
    .select("status, processing_status, skipped_reason")
    .eq("broadcast_id", recipient.broadcast_id);
  const summary = (rows || []).reduce((acc: Record<string, number>, row: any) => {
    if (row.status === "sent") acc.sent_count++;
    if (row.status === "queued") acc.queued_count++;
    if (row.status === "skipped") acc.skipped_count++;
    if (row.status === "failed") acc.failed_count++;
    if (row.processing_status === "pending") acc.pending_count++;
    if (row.skipped_reason === "whatsapp_pending_meta_approval") acc.whatsapp_pending_count++;
    return acc;
  }, { sent_count: 0, queued_count: 0, skipped_count: 0, failed_count: 0, pending_count: 0, whatsapp_pending_count: 0 });

  await admin.from("event_rolodex_broadcasts").update({
    sent_count: summary.sent_count,
    queued_count: summary.queued_count,
    skipped_count: summary.skipped_count,
    failed_count: summary.failed_count,
    whatsapp_pending_count: summary.whatsapp_pending_count,
    processed_count: summary.sent_count + summary.queued_count + summary.skipped_count + summary.failed_count,
    status: summary.pending_count > 0 || summary.queued_count > 0
      ? "processing"
      : summary.failed_count > 0
        ? "completed_with_errors"
        : "completed",
    completed_at: summary.pending_count > 0 || summary.queued_count > 0 ? null : now,
  }).eq("id", recipient.broadcast_id);

  return new Response("ok", { status: 200 });
});

