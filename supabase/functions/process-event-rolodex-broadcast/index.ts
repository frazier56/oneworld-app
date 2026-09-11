import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { canonicalizePhone } from "../_shared/whatsapp-broadcast-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = (Deno.env.get("EVENT_ROLODEX_SITE_URL") || Deno.env.get("ONEEVENT_SITE_URL") || "https://app.oneworldlabs.ai").replace(/\/+$/, "");
const DEFAULT_META_BUSINESS_NUMBER = "+19898000408";
const TWILIO_SMS_FROM =
  Deno.env.get("EVENT_ROLODEX_SMS_FROM") ||
  Deno.env.get("TWILIO_FROM_NUMBER") ||
  DEFAULT_META_BUSINESS_NUMBER;
const TWILIO_WHATSAPP_FROM =
  Deno.env.get("EVENT_ROLODEX_WHATSAPP_FROM") ||
  Deno.env.get("TWILIO_WHATSAPP_FROM") ||
  `whatsapp:${DEFAULT_META_BUSINESS_NUMBER}`;
const TWILIO_MESSAGING_SERVICE_SID =
  Deno.env.get("EVENT_ROLODEX_TWILIO_MESSAGING_SERVICE_SID") ||
  Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") ||
  "MG49b58c42b657819c6aa777db549741e7";
const TWILIO_WHATSAPP_INVITE_CONTENT_SID =
  Deno.env.get("EVENT_ROLODEX_WHATSAPP_INVITE_CONTENT_SID") || "HX5bc0d1ebe1e553ad9a45a190b56a2231";
const EMAIL_SENDS_ENABLED = envFlag("EVENT_ROLODEX_EMAIL_SENDS_ENABLED", true);

type Channel = "in_app" | "email" | "sms" | "whatsapp";
type DeliveryStatus = "sent" | "queued" | "skipped" | "failed";

interface RolodexRow {
  id: string;
  host_id: string;
  contact_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  custom_fields: Record<string, unknown> | null;
  email_ok?: boolean | null;
  sms_ok?: boolean | null;
  whatsapp_ok?: boolean | null;
}

interface RecipientRow {
  id: string;
  broadcast_id: string;
  event_id: string;
  host_id: string;
  rolodex_id: string;
  contact_id: string | null;
  channel: Channel;
  destination: string | null;
  metadata: Record<string, unknown> | null;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function envFlag(name: string, fallback = false) {
  const value = Deno.env.get(name);
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizePhone(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return "";
}

function whatsappDestination(row: RolodexRow, fallbackPhone: unknown = "") {
  const custom = row.custom_fields || {};
  const whatsappLink = typeof custom.whatsapp_link === "string" ? custom.whatsapp_link : "";
  const fromLink = normalizePhone(whatsappLink);
  return fromLink || normalizePhone(row.phone) || normalizePhone(fallbackPhone);
}

function uuidToBase64Url(uuid: string) {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(hex)) return uuid.trim();
  let binary = "";
  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function publicEventPath(event: { id: string; slug?: string | null }) {
  const slug = typeof event.slug === "string" ? event.slug.trim() : "";
  return slug ? `/events/${encodeURIComponent(slug)}` : `/events/e/${uuidToBase64Url(event.id)}`;
}

function buildEventUrl(event: { id: string; slug?: string | null }) {
  return `${SITE_URL}${publicEventPath(event)}`;
}

function buildGroupChatUrl(event: { id: string; slug?: string | null }, channel: Channel) {
  const separator = publicEventPath(event).includes("?") ? "&" : "?";
  return `${SITE_URL}${publicEventPath(event)}${separator}joinChat=1&src=rolodex_${channel}_group_chat`;
}

function timeZoneLabel(value: string | null | undefined) {
  const timezone = typeof value === "string" && value.trim() ? value.trim() : "UTC";
  return timezone.replace(/_/g, " ");
}

function formatEventSchedule(startValue: string | null, endValue: string | null, timezoneValue?: string | null) {
  if (!startValue) {
    return {
      date: "Date TBD",
      startTime: "Start time TBD",
      endTime: "End time TBD",
      timezone: timeZoneLabel(timezoneValue),
    };
  }
  const timezone = typeof timezoneValue === "string" && timezoneValue.trim() ? timezoneValue.trim() : "UTC";
  try {
    const start = new Date(startValue);
    const end = endValue ? new Date(endValue) : null;
    const date = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    }).format(start);
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    };
    return {
      date,
      startTime: new Intl.DateTimeFormat("en-US", timeOptions).format(start),
      endTime: end && !Number.isNaN(end.getTime())
        ? new Intl.DateTimeFormat("en-US", timeOptions).format(end)
        : "End time TBD",
      timezone: timeZoneLabel(timezone),
    };
  } catch {
    return {
      date: "Date TBD",
      startTime: "Start time TBD",
      endTime: "End time TBD",
      timezone: timeZoneLabel(timezoneValue),
    };
  }
}

function compactSmsDate(value: string) {
  const monthNames: Record<string, string> = {
    January: "Jan", February: "Feb", March: "Mar", April: "Apr", May: "May", June: "Jun",
    July: "Jul", August: "Aug", September: "Sep", October: "Oct", November: "Nov", December: "Dec",
  };
  const currentYear = new Date().getUTCFullYear();
  return value
    .replace(/^(January|February|March|April|May|June|July|August|September|October|November|December)\b/, (month) => monthNames[month] || month)
    .replace(new RegExp(`, ${currentYear}$`), "");
}

function googleMapsUrl(location: string | null | undefined) {
  const text = typeof location === "string" ? location.trim() : "";
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null;
}

function cleanLocationValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedTags(row: RolodexRow) {
  return (Array.isArray(row.tags) ? row.tags : [])
    .map((tag) => String(tag || "").trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter(Boolean);
}

function hasChannelSuppressionTag(row: RolodexRow, channel: "email" | "sms" | "whatsapp", respectReliabilityTags = true) {
  const tags = normalizedTags(row);
  if (tags.some((tag) => ["do_not_contact", "no_contact", "notification_opted_out"].includes(tag))) return true;
  const optedOutTags: Record<"email" | "sms" | "whatsapp", string[]> = {
    email: ["no_email", "email_opted_out"],
    sms: ["no_sms", "sms_opted_out"],
    whatsapp: ["no_whatsapp", "whatsapp_opted_out"],
  };
  if (tags.some((tag) => optedOutTags[channel].includes(tag))) return true;
  const reliabilityTags: Record<"email" | "sms" | "whatsapp", string[]> = {
    email: ["do_not_email"],
    sms: ["do_not_sms"],
    whatsapp: ["do_not_whatsapp"],
  };
  return respectReliabilityTags && tags.some((tag) => reliabilityTags[channel].includes(tag));
}

function buildOutboundText(args: {
  hostName: string;
  eventTitle: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  eventTimezone: string;
  eventLocation: string;
  eventLocationUrl?: string | null;
  message: string;
  eventUrl: string;
  groupChatUrl?: string | null;
  includeTicketLink: boolean;
  includeGroupChatLink: boolean;
}) {
  const intro = args.message || `${args.hostName} invited you to ${args.eventTitle} on OneEvent.`;
  const lines = [
    intro,
    "",
    `${args.eventTitle}`,
    `Date: ${args.eventDate}`,
    `Start time: ${args.eventStartTime}`,
    `End time: ${args.eventEndTime}`,
    `Time zone: ${args.eventTimezone}`,
    `Location: ${args.eventLocation}`,
  ];
  if (args.eventLocationUrl) lines.push(`Map: ${args.eventLocationUrl}`);
  if (args.includeTicketLink) lines.push(`View event: ${args.eventUrl}`);
  if (args.includeGroupChatLink && args.groupChatUrl) lines.push(`Message the host: ${args.groupChatUrl}`);
  lines.push("Reply STOP to opt out, HELP for help.");
  return lines.join("\n").slice(0, 640);
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(promise);
  } else {
    promise.catch((error) => console.error("background task failed", error));
  }
}

async function scheduleNext(supabaseUrl: string, serviceKey: string, broadcastId: string) {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const response = await fetch(`${supabaseUrl}/functions/v1/process-event-rolodex-broadcast`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ broadcastId, trigger: "self" }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Broadcast worker HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server configuration error" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  const claims = token ? parseJwtClaims(token) : null;
  const isServiceRole = token === serviceKey || claims?.role === "service_role";
  if (!isServiceRole) return json({ error: "Forbidden" }, 403);

  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const requestedBroadcastId = typeof body.broadcastId === "string" ? body.broadcastId : "";
  const requestedBatchSize = Number(body.batchSize || Deno.env.get("EVENT_ROLODEX_WORKER_BATCH_SIZE") || "50");
  const batchSize = Math.min(Math.max(Number.isFinite(requestedBatchSize) ? requestedBatchSize : 50, 1), 100);

  try {
    let broadcastId = requestedBroadcastId;
    if (!broadcastId) {
      const { data: pending } = await admin
        .from("event_rolodex_broadcast_recipients")
        .select("broadcast_id, event_rolodex_broadcasts!inner(status, cancel_requested_at)")
        .eq("processing_status", "pending")
        .eq("event_rolodex_broadcasts.status", "processing")
        .is("event_rolodex_broadcasts.cancel_requested_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      broadcastId = pending?.broadcast_id || "";
    }
    if (!broadcastId) return json({ ok: true, processed: 0, pending: 0 });

    const { data: claimRows, error: claimError } = await admin.rpc("claim_event_rolodex_broadcast", {
      p_broadcast_id: broadcastId,
      p_lock_seconds: 180,
    });
    if (claimError) return json({ error: claimError.message }, 500);
    if (!Array.isArray(claimRows) || claimRows.length === 0) {
      return json({ ok: true, locked: false, broadcast_id: broadcastId });
    }

    const { data: broadcast, error: broadcastError } = await admin
      .from("event_rolodex_broadcasts")
      .select("id, event_id, host_id, message, channels, metadata, recipient_count, processing_batch_size, status, cancel_requested_at")
      .eq("id", broadcastId)
      .maybeSingle();
    if (broadcastError || !broadcast) throw new Error(broadcastError?.message || "Broadcast not found");
    if (broadcast.status !== "processing" || broadcast.cancel_requested_at) {
      await admin.from("event_rolodex_broadcasts").update({ processing_lock_until: null }).eq("id", broadcastId);
      return json({ ok: true, broadcast_id: broadcastId, processed: 0, blocked: true, status: broadcast.status });
    }

    const effectiveBatchSize = Math.min(Math.max(Number(broadcast.processing_batch_size || batchSize), 1), 100);
    const { data: recipientsRaw, error: recipientsError } = await admin
      .from("event_rolodex_broadcast_recipients")
      .select("id, broadcast_id, event_id, host_id, rolodex_id, contact_id, channel, destination, metadata")
      .eq("broadcast_id", broadcastId)
      .eq("processing_status", "pending")
      .order("created_at", { ascending: true })
      .limit(effectiveBatchSize);
    if (recipientsError) throw new Error(recipientsError.message);

    const channelPriority: Record<Channel, number> = { whatsapp: 0, sms: 1, email: 2, in_app: 3 };
    const recipients = ((recipientsRaw || []) as RecipientRow[]).sort(
      (left, right) => (channelPriority[left.channel] ?? 9) - (channelPriority[right.channel] ?? 9),
    );
    if (recipients.length === 0) {
      await refreshSummary(admin, broadcastId);
      await admin.from("event_rolodex_broadcasts").update({ processing_lock_until: null }).eq("id", broadcastId);
      return json({ ok: true, broadcast_id: broadcastId, processed: 0, pending: 0 });
    }

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, host_id, title, start_date, end_date, timezone, location, venue_name, slug")
      .eq("id", broadcast.event_id)
      .maybeSingle();
    if (eventError || !event) throw new Error(eventError?.message || "Event not found");

    const { data: hostProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", broadcast.host_id)
      .maybeSingle();
    const hostName = hostProfile?.full_name || "Your host";

    const rolodexIds = [...new Set(recipients.map((row) => row.rolodex_id))];
    const { data: contactsRaw, error: contactsError } = await admin
      .from("host_rolodex")
      .select("id, host_id, contact_id, name, email, phone, tags, custom_fields, email_ok, sms_ok, whatsapp_ok")
      .in("id", rolodexIds);
    if (contactsError) throw new Error(contactsError.message);
    const contactMap = new Map(((contactsRaw || []) as RolodexRow[]).map((row) => [row.id, row]));

    const contacts = [...contactMap.values()];
    const contactIds = contacts.map((row) => row.contact_id).filter((id): id is string => Boolean(id));
    const contactEmails = [...new Set(contacts.map((row) => normalizeEmail(row.email)).filter(Boolean))];
    const contactPhones = [...new Set(contacts.flatMap((row) => {
      const normalized = normalizePhone(row.phone);
      const raw = typeof row.phone === "string" ? row.phone.trim() : "";
      return [raw, normalized].filter(Boolean);
    }))];
    const { data: profilesRaw } = contactIds.length
      ? await admin.from("profiles").select("id, full_name, email, phone").in("id", contactIds)
      : { data: [] as any[] };
    const { data: profilesByEmailRaw } = contactEmails.length
      ? await admin.from("profiles").select("id, full_name, email, phone").in("email", contactEmails)
      : { data: [] as any[] };
    const { data: profilesByPhoneRaw } = contactPhones.length
      ? await admin.from("profiles").select("id, full_name, email, phone").in("phone", contactPhones)
      : { data: [] as any[] };
    const profileMap = new Map((profilesRaw || []).map((profile: any) => [profile.id, profile]));
    const emailProfileMap = new Map((profilesByEmailRaw || []).map((profile: any) => [normalizeEmail(profile.email), profile]));
    const phoneProfileMap = new Map(
      (profilesByPhoneRaw || [])
        .map((profile: any) => [normalizePhone(profile.phone), profile] as const)
        .filter(([phone]) => Boolean(phone)),
    );

    const resolveProfile = (row: RolodexRow) =>
      (row.contact_id ? profileMap.get(row.contact_id) : null) ||
      emailProfileMap.get(normalizeEmail(row.email)) ||
      phoneProfileMap.get(normalizePhone(row.phone)) ||
      null;

    const metadata = (broadcast.metadata || {}) as Record<string, any>;
    const isInviteFollowup = metadata.broadcast_kind === "invite_followup";
    const inviteFollowupLabel = typeof metadata.reminder_label === "string" ? metadata.reminder_label : "coming up";
    const emailOptions = (metadata.email_options || {}) as Record<string, unknown>;
    const includeTicketLink = emailOptions.include_ticket_link !== false;
    const includeGroupChatLink = emailOptions.include_group_chat_link === true;
    const sendOptions = (metadata.send_options || {}) as Record<string, unknown>;
    const respectSuppressionTags = sendOptions.respect_suppression_tags !== false;
    const { data: runtimeConfigRows } = await admin
      .from("app_secrets")
      .select("key, value")
      .in("key", [
        "EVENT_ROLODEX_EXTERNAL_SENDS_ENABLED",
        "EVENT_ROLODEX_SMS_SENDS_ENABLED",
        "EVENT_ROLODEX_WHATSAPP_SENDS_ENABLED",
        "EVENT_ROLODEX_WHATSAPP_APPROVED",
        "EVENT_ROLODEX_CONTROLLED_TEST_PHONE",
        "EVENT_ROLODEX_SHORT_LINK_BASE",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_API_KEY_SID",
        "TWILIO_API_KEY_SECRET",
      ]);
    const runtimeConfig = new Map(
      (runtimeConfigRows || []).map((row: { key: string; value: string }) => [row.key, row.value]),
    );
    const configFlag = (value: unknown) =>
      typeof value === "string" && ["1", "true", "yes", "on"].includes(value.toLowerCase());
    const externalSendsEnabled =
      envFlag("EVENT_ROLODEX_EXTERNAL_SENDS_ENABLED", false) ||
      configFlag(runtimeConfig.get("EVENT_ROLODEX_EXTERNAL_SENDS_ENABLED"));
    const smsSendsEnabled =
      envFlag("EVENT_ROLODEX_SMS_SENDS_ENABLED", false) ||
      configFlag(runtimeConfig.get("EVENT_ROLODEX_SMS_SENDS_ENABLED")) ||
      externalSendsEnabled;
    const whatsappSendsEnabled =
      envFlag("EVENT_ROLODEX_WHATSAPP_SENDS_ENABLED", false) ||
      configFlag(runtimeConfig.get("EVENT_ROLODEX_WHATSAPP_SENDS_ENABLED")) ||
      externalSendsEnabled;
    const whatsappApproved =
      envFlag("EVENT_ROLODEX_WHATSAPP_APPROVED", false) ||
      configFlag(runtimeConfig.get("EVENT_ROLODEX_WHATSAPP_APPROVED"));
    const controlledTestPhone = normalizePhone(runtimeConfig.get("EVENT_ROLODEX_CONTROLLED_TEST_PHONE"));
    const shortLinkBase = String(
      runtimeConfig.get("EVENT_ROLODEX_SHORT_LINK_BASE") || "https://oe.oneworldlabs.io",
    ).replace(/\/+$/, "");
    const twilioAccountSid = String(runtimeConfig.get("TWILIO_ACCOUNT_SID") || Deno.env.get("TWILIO_ACCOUNT_SID") || "");
    const twilioApiKeySid = String(runtimeConfig.get("TWILIO_API_KEY_SID") || Deno.env.get("TWILIO_API_KEY_SID") || "");
    const twilioApiKeySecret = String(runtimeConfig.get("TWILIO_API_KEY_SECRET") || Deno.env.get("TWILIO_API_KEY_SECRET") || "");
    const schedule = formatEventSchedule(event.start_date, event.end_date, event.timezone);
    const eventVenueName = cleanLocationValue(event.venue_name);
    const eventMapQuery = cleanLocationValue(event.location) || eventVenueName;
    const eventLocationUrl = googleMapsUrl(eventMapQuery);
    const eventLocation = eventVenueName || (eventLocationUrl ? "See Map" : "Location TBD");
    const broadcastMessage = typeof broadcast.message === "string" ? broadcast.message : `${hostName} invited you to ${event.title} on OneEvent.`;
    const results: Array<Record<string, unknown>> = [];

    const updateRecipient = async (recipient: RecipientRow, values: {
      contactId?: string | null;
      destination?: string;
      status: DeliveryStatus;
      providerSid?: string;
      providerStatus?: string;
      errorMessage?: string;
      skippedReason?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const now = new Date().toISOString();
      const nextMetadata = {
        ...(recipient.metadata || {}),
        ...(values.metadata || {}),
      };
      const { error } = await admin
        .from("event_rolodex_broadcast_recipients")
        .update({
          contact_id: values.contactId ?? recipient.contact_id,
          destination: values.destination || null,
          status: values.status,
          provider_sid: values.providerSid || null,
          provider_message_id: values.providerSid || null,
          provider_status: values.providerStatus || null,
          provider_status_at: values.providerStatus ? now : null,
          error_message: values.errorMessage || null,
          skipped_reason: values.skippedReason || null,
          queued_at: values.status === "queued" ? now : null,
          sent_at: values.status === "sent" ? now : null,
          metadata: nextMetadata,
          processing_status: "done",
          processed_at: now,
        })
        .eq("id", recipient.id);
      if (error) throw new Error(error.message);

      // A previously claimed SMS row can be waiting in another batch. If the
      // WhatsApp primary is rejected locally (permission, U.S. marketing rule,
      // configuration) or fails immediately, put that SMS fallback back on the
      // queue. Async provider failures are handled by twilio-message-status.
      if (recipient.channel === "whatsapp" && (values.status === "failed" || values.status === "skipped")) {
        const { error: fallbackError } = await admin
          .from("event_rolodex_broadcast_recipients")
          .update({
            status: "pending",
            provider_status: null,
            provider_status_at: null,
            processing_status: "pending",
            processed_at: null,
            queued_at: null,
            skipped_reason: null,
            error_message: null,
          })
          .eq("broadcast_id", recipient.broadcast_id)
          .eq("rolodex_id", recipient.rolodex_id)
          .eq("channel", "sms")
          .eq("provider_status", "waiting_for_whatsapp");
        if (fallbackError) throw new Error(fallbackError.message);
      }

      results.push({
        rolodex_id: recipient.rolodex_id,
        channel: recipient.channel,
        destination: values.destination || null,
        status: values.status,
        reason: values.skippedReason || values.errorMessage || null,
      });
    };

    const isOptedOut = async (row: RolodexRow, channel: "email" | "sms" | "whatsapp", destination: string) => {
      if (hasChannelSuppressionTag(row, channel, respectSuppressionTags)) return true;
      const { data } = await admin
        .from("contact_optouts")
        .select("id")
        .eq("channel", channel)
        .eq("destination", destination)
        .or(`host_id.is.null,host_id.eq.${broadcast.host_id}`)
        .maybeSingle();
      return Boolean(data);
    };

    const cancellationState = async () => {
      const { data, error } = await admin
        .from("event_rolodex_broadcasts")
        .select("status, cancel_requested_at")
        .eq("id", broadcast.id)
        .maybeSingle();
      if (error || !data) return { cancelled: true, error: "cancellation_state_unavailable" };
      return {
        cancelled: data.status !== "processing" || Boolean(data.cancel_requested_at),
        error: null as string | null,
      };
    };

    const quarantineBroadcast = async (reason: string) => {
      await admin
        .from("event_rolodex_broadcasts")
        .update({ status: "quarantined", processing_lock_until: null, processing_error: reason.slice(0, 120) })
        .eq("id", broadcast.id)
        .eq("status", "processing");
    };

    const freshWhatsAppEligibility = async (recipient: RecipientRow, plannedDestination: string) => {
      const cancellation = await cancellationState();
      if (cancellation.cancelled) return { eligible: false, reason: cancellation.error || "campaign_cancelled", row: null as RolodexRow | null };
      const { data: freshRow, error: freshRowError } = await admin
        .from("host_rolodex")
        .select("id, host_id, contact_id, name, email, phone, tags, custom_fields, email_ok, sms_ok, whatsapp_ok")
        .eq("id", recipient.rolodex_id)
        .eq("host_id", broadcast.host_id)
        .maybeSingle();
      if (freshRowError || !freshRow) return { eligible: false, reason: "contact_state_unavailable", row: null as RolodexRow | null };
      const currentRow = freshRow as RolodexRow;
      const currentProfile = resolveProfile(currentRow);
      const custom = currentRow.custom_fields || {};
      const rawCountry = typeof custom.country_code === "string" ? custom.country_code.trim().toUpperCase() : "";
      const defaultCountry = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry as any : null;
      const canonical = canonicalizePhone(
        typeof custom.whatsapp_link === "string" ? custom.whatsapp_link : currentRow.phone || currentProfile?.phone,
        defaultCountry,
      ) || canonicalizePhone(currentRow.phone || currentProfile?.phone, defaultCountry);
      if (!canonical) return { eligible: false, reason: "missing_whatsapp_phone", row: currentRow };
      if (canonical.e164 !== plannedDestination) return { eligible: false, reason: "destination_changed_since_hold", row: currentRow };

      const tagsSuppressed = normalizedTags(currentRow).some((tag) => [
        "do_not_contact", "no_contact", "notification_opted_out", "no_whatsapp", "whatsapp_opted_out", "do_not_whatsapp",
      ].includes(tag));
      const { data: optouts, error: optoutError } = await admin
        .from("contact_optouts")
        .select("destination")
        .eq("channel", "whatsapp")
        .or(`host_id.is.null,host_id.eq.${broadcast.host_id}`);
      if (optoutError) return { eligible: false, reason: "suppression_state_unavailable", row: currentRow };
      const optedOut = (optouts || []).some((entry: { destination?: string | null }) =>
        canonicalizePhone(entry.destination, defaultCountry)?.e164 === canonical.e164
      );
      // STOP/suppression always wins over any consent flag.
      if (tagsSuppressed || optedOut) return { eligible: false, reason: "whatsapp_opted_out", row: currentRow };
      if (currentRow.whatsapp_ok !== true) return { eligible: false, reason: "whatsapp_permission_missing", row: currentRow };
      if (canonical.country === "US") return { eligible: false, reason: "whatsapp_marketing_unavailable_us", row: currentRow };
      return { eligible: true, reason: null as string | null, row: currentRow };
    };

    const sha256Hex = async (value: string) => {
      const bytes = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    };

    const trackedLink = async (recipient: RecipientRow, channel: "sms" | "whatsapp", destination: string, targetUrl: string) => {
      const code = uuidToBase64Url(recipient.id).slice(0, 10);
      const { error } = await admin.from("event_message_links").upsert({
        code,
        recipient_id: recipient.id,
        broadcast_id: recipient.broadcast_id,
        event_id: recipient.event_id,
        channel,
        target_url: targetUrl,
        destination_hash: await sha256Hex(destination),
        expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "recipient_id" });
      if (error) throw new Error(error.message);
      return `https://oneevent.oneworldlabs.ai/?e=${encodeURIComponent(code)}`;
    };

    const buildSmsText = (args: { recipientName: string; hostName: string; eventTitle: string; eventDate: string; link: string }) => {
      const host = args.hostName.trim().slice(0, 28) || "Your host";
      const title = args.eventTitle.trim().slice(0, 52) || "an event";
      return `OneEvent by One World Labs: ${host} invited you to ${title} on ${args.eventDate}. ${args.link} Reply STOP to opt out or HELP for help. Msg & data rates may apply.`;
    };

    const sendTwilioMessage = async (
      recipient: RecipientRow,
      to: string,
      channel: "sms" | "whatsapp",
      options: { body?: string; contentSid?: string; contentVariables?: Record<string, string> },
    ) => {
      if (!twilioAccountSid || !twilioApiKeySid || !twilioApiKeySecret) {
        return { status: "failed" as DeliveryStatus, reason: "twilio_not_configured" };
      }
      const idempotencyKey = `${recipient.broadcast_id}:${recipient.id}:${channel}`;
      if (channel === "sms") {
        const { data: claimRows, error: claimError } = await admin.rpc("oneevent_claim_sms_provider_dispatch", {
          p_recipient_id: recipient.id,
          p_broadcast_id: recipient.broadcast_id,
          p_idempotency_key: idempotencyKey,
          p_lock_seconds: 180,
          p_max_attempts: 3,
        });
        const prior = Array.isArray(claimRows) ? claimRows[0] : null;
        if (claimError || !prior?.should_send) {
          if (prior?.state === "accepted" && prior?.provider_sid) {
            return { status: "queued" as DeliveryStatus, sid: prior.provider_sid, providerStatus: "accepted" };
          }
          if (prior?.state === "cancelled") {
            return {
              status: "skipped" as DeliveryStatus,
              reason: "whatsapp_delivered_primary",
              providerStatus: "not_needed",
            };
          }
          if (prior?.state === "waiting_for_whatsapp") {
            return {
              status: "queued" as DeliveryStatus,
              reason: "waiting_for_whatsapp",
              providerStatus: "waiting_for_whatsapp",
            };
          }
          return { status: "failed" as DeliveryStatus, reason: "dispatch_claim_refused" };
        }
      }

      const params: Record<string, string> = {};
      params.To = channel === "whatsapp" ? `whatsapp:${to}` : to;
      if (TWILIO_MESSAGING_SERVICE_SID) params.MessagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
      else params.From = channel === "whatsapp" ? TWILIO_WHATSAPP_FROM : TWILIO_SMS_FROM;
      if (options.contentSid) {
        params.ContentSid = options.contentSid;
        params.ContentVariables = JSON.stringify(options.contentVariables || {});
      } else if (options.body) {
        params.Body = options.body;
      } else {
        return { status: "failed" as DeliveryStatus, reason: "message_content_missing" };
      }

      const credentials = btoa(`${twilioApiKeySid}:${twilioApiKeySecret}`);
      let res: Response;
      try {
        res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${credentials}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(params),
          },
        );
      } catch {
        if (channel === "sms") {
          const { error: evidenceError } = await admin.from("event_rolodex_provider_dispatches").update({
            state: "ambiguous",
            lock_until: null,
            last_error_code: "provider_outcome_unknown",
            last_error_redacted: "Provider request ended without a definite response",
            updated_at: new Date().toISOString(),
          }).eq("idempotency_key", idempotencyKey);
          await quarantineBroadcast(evidenceError ? "dispatch_evidence_store_failed" : "provider_outcome_unknown");
        }
        return { status: "failed" as DeliveryStatus, reason: "provider_outcome_unknown" };
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (channel === "sms") {
          const { error: evidenceError } = await admin.from("event_rolodex_provider_dispatches").update({
            state: res.status === 429 || res.status >= 500 ? "failed_retryable" : "failed_permanent",
            lock_until: null,
            provider_status: typeof data?.status === "string" ? data.status.toLowerCase() : null,
            last_http_status: res.status,
            last_error_code: `twilio_http_${res.status}`,
            last_error_redacted: "Provider refused the SMS request",
            updated_at: new Date().toISOString(),
          }).eq("idempotency_key", idempotencyKey);
          if (evidenceError) await quarantineBroadcast("dispatch_evidence_store_failed");
        }
        return {
          status: "failed" as DeliveryStatus,
          reason: data?.message || data?.error || `twilio_http_${res.status}`,
          providerStatus: typeof data?.status === "string" ? data.status.toLowerCase() : undefined,
          sid: typeof data?.sid === "string" ? data.sid : undefined,
        };
      }
      const providerStatus = typeof data?.status === "string" ? data.status.toLowerCase() : "queued";
      const providerSid = typeof data?.sid === "string" ? data.sid : "";
      if (!providerSid) {
        if (channel === "sms") {
          const { error: evidenceError } = await admin.from("event_rolodex_provider_dispatches").update({
            state: "ambiguous",
            lock_until: null,
            provider_status: providerStatus || null,
            last_http_status: res.status,
            last_error_code: "twilio_missing_provider_sid",
            last_error_redacted: "Provider accepted the SMS request without a message identifier",
            updated_at: new Date().toISOString(),
          }).eq("idempotency_key", idempotencyKey);
          await quarantineBroadcast(evidenceError ? "dispatch_evidence_store_failed" : "twilio_missing_provider_sid");
        }
        return { status: "failed" as DeliveryStatus, reason: "twilio_missing_provider_sid", providerStatus };
      }
      if (channel === "sms") {
        const { error: evidenceError } = await admin.from("event_rolodex_provider_dispatches").update({
          state: "accepted",
          lock_until: null,
          provider_sid: providerSid,
          provider_status: providerStatus || "queued",
          last_http_status: res.status,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("idempotency_key", idempotencyKey);
        if (evidenceError) {
          await quarantineBroadcast("dispatch_evidence_store_failed");
          return { status: "failed" as DeliveryStatus, reason: "dispatch_evidence_store_failed" };
        }
      }
      return {
        status: providerStatus === "sent" || providerStatus === "delivered" || providerStatus === "read"
          ? "sent" as DeliveryStatus
          : "queued" as DeliveryStatus,
        sid: providerSid,
        providerStatus,
      };
    };

    const retryDelayMs = (header: string | null, attempt: number) => {
      if (header) {
        const seconds = Number(header);
        if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 15_000);
        const dateMs = new Date(header).getTime();
        if (Number.isFinite(dateMs)) return Math.min(Math.max(dateMs - Date.now(), 0), 15_000);
      }
      const base = Math.min(500 * (2 ** Math.max(attempt - 1, 0)), 8_000);
      return base + Math.floor(Math.random() * Math.max(100, base * 0.35));
    };

    const dispatchWhatsApp = async (
      recipient: RecipientRow,
      to: string,
      options: { contentSid: string; contentVariables: Record<string, string> },
    ) => {
      const idempotencyKey = `${recipient.broadcast_id}:${recipient.id}:whatsapp`;
      if (!twilioAccountSid || !twilioApiKeySid || !twilioApiKeySecret) {
        return { status: "failed" as DeliveryStatus, reason: "twilio_not_configured" };
      }

      for (let localAttempt = 1; localAttempt <= 3; localAttempt += 1) {
        // This recheck is intentionally inside the retry loop and immediately
        // before the provider claim/attempt.
        const safety = await freshWhatsAppEligibility(recipient, to);
        if (!safety.eligible) {
          return { status: "skipped" as DeliveryStatus, reason: safety.reason || "whatsapp_not_eligible" };
        }
        const { data: claimRows, error: claimError } = await admin.rpc("claim_event_rolodex_provider_dispatch", {
          p_recipient_id: recipient.id,
          p_broadcast_id: recipient.broadcast_id,
          p_channel: "whatsapp",
          p_idempotency_key: idempotencyKey,
          p_lock_seconds: 180,
          p_max_attempts: 3,
        });
        if (claimError || !Array.isArray(claimRows) || !claimRows[0]?.should_send) {
          const prior = Array.isArray(claimRows) ? claimRows[0] : null;
          if (prior?.state === "accepted" && prior?.provider_sid) {
            return { status: "queued" as DeliveryStatus, sid: prior.provider_sid, providerStatus: "accepted" };
          }
          return { status: "failed" as DeliveryStatus, reason: prior?.state === "ambiguous" ? "dispatch_ambiguous_quarantined" : "dispatch_claim_refused" };
        }
        const attempt = Number(claimRows[0].attempt_count || localAttempt);
        const params = new URLSearchParams({
          To: `whatsapp:${to}`,
          ContentSid: options.contentSid,
          ContentVariables: JSON.stringify(options.contentVariables),
        });
        if (TWILIO_MESSAGING_SERVICE_SID) params.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
        else params.set("From", TWILIO_WHATSAPP_FROM);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        let response: Response;
        try {
          response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${twilioApiKeySid}:${twilioApiKeySecret}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params,
            signal: controller.signal,
          });
        } catch {
          clearTimeout(timeout);
          const { error: ambiguousError } = await admin.from("event_rolodex_provider_dispatches").update({
            state: "ambiguous", lock_until: null, last_error_code: "provider_outcome_unknown", last_error_redacted: "Provider request ended without a definite response", updated_at: new Date().toISOString(),
          }).eq("idempotency_key", idempotencyKey);
          await quarantineBroadcast(ambiguousError ? "dispatch_evidence_store_failed" : "provider_outcome_unknown");
          return { status: "failed" as DeliveryStatus, reason: "provider_outcome_unknown" };
        } finally {
          clearTimeout(timeout);
        }
        const provider = await response.json().catch(() => ({}));
        const sid = typeof provider?.sid === "string" ? provider.sid : "";
        const providerStatus = typeof provider?.status === "string" ? provider.status.toLowerCase() : "";
        if (response.ok) {
          if (!sid) {
            const { error: missingSidStoreError } = await admin.from("event_rolodex_provider_dispatches").update({
              state: "ambiguous", lock_until: null, last_http_status: response.status, provider_status: providerStatus || null,
              last_error_code: "twilio_missing_provider_sid", last_error_redacted: "Provider accepted the request without a message identifier", updated_at: new Date().toISOString(),
            }).eq("idempotency_key", idempotencyKey);
            await quarantineBroadcast(missingSidStoreError ? "dispatch_evidence_store_failed" : "twilio_missing_provider_sid");
            return { status: "failed" as DeliveryStatus, reason: "twilio_missing_provider_sid", providerStatus };
          }
          const { error: acceptedStoreError } = await admin.from("event_rolodex_provider_dispatches").update({
            state: "accepted", lock_until: null, provider_sid: sid, provider_status: providerStatus || "queued",
            last_http_status: response.status, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("idempotency_key", idempotencyKey);
          if (acceptedStoreError) {
            await quarantineBroadcast("dispatch_evidence_store_failed");
            return { status: "failed" as DeliveryStatus, reason: "dispatch_evidence_store_failed" };
          }
          return {
            status: ["sent", "delivered", "read"].includes(providerStatus) ? "sent" as DeliveryStatus : "queued" as DeliveryStatus,
            sid,
            providerStatus: providerStatus || "queued",
          };
        }

        const retryable = response.status === 429 || response.status >= 500;
        const nextState = retryable && attempt < 3 ? "failed_retryable" : "failed_permanent";
        const { error: failureStoreError } = await admin.from("event_rolodex_provider_dispatches").update({
          state: nextState, lock_until: null, last_http_status: response.status,
          last_error_code: `twilio_http_${response.status}`,
          last_error_redacted: retryable ? "Provider temporarily unavailable" : "Provider refused the request",
          provider_status: providerStatus || null, provider_request_id: response.headers.get("Twilio-Request-Id"), updated_at: new Date().toISOString(),
        }).eq("idempotency_key", idempotencyKey);
        if (failureStoreError) {
          await quarantineBroadcast("dispatch_evidence_store_failed");
          return { status: "failed" as DeliveryStatus, reason: "dispatch_evidence_store_failed" };
        }
        if (!retryable || attempt >= 3) {
          return { status: "failed" as DeliveryStatus, reason: `twilio_http_${response.status}`, providerStatus };
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response.headers.get("Retry-After"), attempt)));
      }
      return { status: "failed" as DeliveryStatus, reason: "provider_attempt_limit_reached" };
    };

    const sendInApp = async (recipient: RecipientRow, row: RolodexRow) => {
      const linkedProfile = resolveProfile(row);
      const linkedContactId = row.contact_id || linkedProfile?.id || null;
      if (!linkedContactId) {
        await updateRecipient(recipient, { status: "skipped", skippedReason: "no_linked_onesocial_account" });
        return;
      }
      if (!row.contact_id) {
        await admin
          .from("host_rolodex")
          .update({ contact_id: linkedContactId })
          .eq("host_id", broadcast.host_id)
          .eq("id", row.id)
          .is("contact_id", null);
        row.contact_id = linkedContactId;
      }

      const eventUrl = buildEventUrl(event);
      const groupChatUrl = buildGroupChatUrl(event, "in_app");
      const inAppContent = [
        broadcastMessage,
        includeTicketLink ? `View event: ${eventUrl}` : "",
        includeGroupChatLink ? `Join the group chat: ${groupChatUrl}` : "",
      ].filter(Boolean).join("\n\n");

      const { data: connection } = await admin
        .from("user_connections")
        .select("id")
        .eq("status", "accepted")
        .or(`and(requester_id.eq.${broadcast.host_id},recipient_id.eq.${linkedContactId}),and(requester_id.eq.${linkedContactId},recipient_id.eq.${broadcast.host_id})`)
        .maybeSingle();

      const { data: existingConvos } = await admin
        .from("conversations")
        .select("id, participant_ids")
        .contains("participant_ids", [broadcast.host_id])
        .order("last_message_at", { ascending: false })
        .limit(50);

      let conversationId = ((existingConvos || []) as any[]).find((conversation) =>
        Array.isArray(conversation.participant_ids) &&
        conversation.participant_ids.includes(broadcast.host_id) &&
        conversation.participant_ids.includes(linkedContactId)
      )?.id || null;

      if (!conversationId) {
        const { data: newConvo, error: convoError } = await admin
          .from("conversations")
          .insert({
            participant_ids: [broadcast.host_id, linkedContactId],
            category: "events",
            last_message_text: inAppContent.slice(0, 100),
            last_message_at: new Date().toISOString(),
            is_request: !connection,
          })
          .select("id")
          .single();
        if (convoError) {
          await updateRecipient(recipient, { status: "failed", errorMessage: convoError.message });
          return;
        }
        conversationId = newConvo.id;
      }

      const { error: messageError } = await admin.from("messages").insert({
        conversation_id: conversationId,
        sender_id: broadcast.host_id,
        content: inAppContent,
        message_type: "event_announcement",
        metadata: {
          event_announcement: {
            event_id: event.id,
            title: event.title,
            start_date: event.start_date,
            location: event.location,
            link: eventUrl,
            group_chat_link: includeGroupChatLink ? groupChatUrl : null,
          },
        },
      });
      if (messageError) {
        await updateRecipient(recipient, { status: "failed", errorMessage: messageError.message });
        return;
      }

      await admin
        .from("conversations")
        .update({
          last_message_text: `Event: ${event.title}`.slice(0, 100),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      await admin.from("notifications").insert({
        user_id: linkedContactId,
        type: "general",
        title: `${hostName} invited you to ${event.title}`,
        body: inAppContent,
        action_url: includeGroupChatLink ? groupChatUrl : eventUrl,
        metadata: {
          source: "event_rolodex_broadcast",
          event_id: event.id,
          event_title: event.title,
          broadcast_id: broadcast.id,
          conversation_id: conversationId,
          group_chat_url: includeGroupChatLink ? groupChatUrl : null,
        },
      });

      await updateRecipient(recipient, { contactId: linkedContactId, status: "sent" });
    };

    for (const recipient of recipients) {
      try {
      const currentCancellation = await cancellationState();
      if (currentCancellation.cancelled) {
        await updateRecipient(recipient, {
          status: currentCancellation.error ? "failed" : "skipped",
          errorMessage: currentCancellation.error || undefined,
          skippedReason: currentCancellation.error ? undefined : "campaign_cancelled",
        });
        continue;
      }
      const row = contactMap.get(recipient.rolodex_id);
      if (!row) {
        await updateRecipient(recipient, { status: "failed", errorMessage: "Rolodex contact not found" });
        continue;
      }

      const profile = resolveProfile(row);
      const linkedContactId = row.contact_id || profile?.id || null;
      if (!row.contact_id && linkedContactId) {
        await admin
          .from("host_rolodex")
          .update({ contact_id: linkedContactId })
          .eq("host_id", broadcast.host_id)
          .eq("id", row.id)
          .is("contact_id", null);
        row.contact_id = linkedContactId;
      }

      const recipientName = profile?.full_name || row.name || "there";
      const email = normalizeEmail(row.email || profile?.email);
      const phone = normalizePhone(row.phone || profile?.phone);
      const whatsappPhone = whatsappDestination(row, profile?.phone);
      const eventUrl = buildEventUrl(event);
      const groupChatUrl = buildGroupChatUrl(event, recipient.channel);
      const outboundText = buildOutboundText({
        hostName,
        eventTitle: event.title,
        eventDate: schedule.date,
        eventStartTime: schedule.startTime,
        eventEndTime: schedule.endTime,
        eventTimezone: schedule.timezone,
        eventLocation,
        eventLocationUrl,
        message: broadcastMessage,
        eventUrl,
        groupChatUrl,
        includeTicketLink,
        includeGroupChatLink,
      });

      if (recipient.channel === "in_app") {
        await sendInApp(recipient, row);
        continue;
      }

      if (recipient.channel === "email") {
        if (!email) {
          await updateRecipient(recipient, { status: "skipped", skippedReason: "missing_email" });
          continue;
        }
        if (await isOptedOut(row, "email", email)) {
          await updateRecipient(recipient, { destination: email, status: "skipped", skippedReason: "email_opted_out" });
          continue;
        }
        if (!EMAIL_SENDS_ENABLED) {
          await updateRecipient(recipient, {
            destination: email,
            status: "queued",
            skippedReason: "email_sends_disabled",
            metadata: { event_url: eventUrl },
          });
          continue;
        }

        const emailCancellation = await cancellationState();
        if (emailCancellation.cancelled) {
          await updateRecipient(recipient, {
            destination: email,
            status: emailCancellation.error ? "failed" : "skipped",
            errorMessage: emailCancellation.error || undefined,
            skippedReason: emailCancellation.error ? undefined : "campaign_cancelled",
          });
          continue;
        }
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            templateName: "event-invite",
            recipientEmail: email,
            idempotencyKey: `${broadcast.id}:${row.id}:email`,
            templateData: {
              eventId: event.id,
              broadcastId: broadcast.id,
              rolodexId: row.id,
              recipientName,
              hostName,
              eventTitle: event.title,
              eventDate: schedule.date,
              eventStartTime: schedule.startTime,
              eventEndTime: schedule.endTime,
              eventTimezone: schedule.timezone,
              eventLocation,
              eventLocationUrl,
              eventVenueName,
              message: broadcastMessage,
              eventUrl,
              groupChatUrl,
              includeTicketLink,
              includeGroupChatLink,
              isFollowup: isInviteFollowup,
              reminderLabel: inviteFollowupLabel,
            },
          }),
        });
        const emailJson = await emailRes.json().catch(() => ({}));
        await updateRecipient(recipient, {
          destination: email,
          status: emailRes.ok ? "queued" : "failed",
          providerSid: emailRes.ok && typeof emailJson?.message_id === "string" ? emailJson.message_id : undefined,
          errorMessage: emailRes.ok ? undefined : emailJson?.error || "email_queue_failed",
          metadata: {
            response: emailJson,
            email_message_id: typeof emailJson?.message_id === "string" ? emailJson.message_id : null,
            idempotency_key: `${broadcast.id}:${row.id}:email`,
            event_url: eventUrl,
            group_chat_url: includeGroupChatLink ? groupChatUrl : null,
            include_ticket_link: includeTicketLink,
            include_group_chat_link: includeGroupChatLink,
          },
        });
        continue;
      }

      if (recipient.channel === "sms") {
        if ((broadcast.channels || []).includes("whatsapp")) {
          const { data: whatsappPrimary } = await admin
            .from("event_rolodex_broadcast_recipients")
            .select("id, status, provider_status, processing_status, skipped_reason, delivered_at, opened_at")
            .eq("broadcast_id", broadcast.id)
            .eq("rolodex_id", recipient.rolodex_id)
            .eq("channel", "whatsapp")
            .maybeSingle();
          if (whatsappPrimary) {
            const primaryProviderStatus = String(whatsappPrimary.provider_status || "").toLowerCase();
            const primaryDelivered = Boolean(
              whatsappPrimary.delivered_at ||
              whatsappPrimary.opened_at ||
              primaryProviderStatus === "delivered" ||
              primaryProviderStatus === "read"
            );
            const primaryUnavailable = Boolean(
              whatsappPrimary.status === "failed" ||
              whatsappPrimary.status === "skipped" ||
              primaryProviderStatus === "failed" ||
              primaryProviderStatus === "undelivered"
            );
            if (primaryDelivered) {
              await updateRecipient(recipient, {
                destination: phone,
                status: "skipped",
                skippedReason: "whatsapp_delivered_primary",
                metadata: { fallback_channel: "sms", primary_channel: "whatsapp" },
              });
              continue;
            }
            if (!primaryUnavailable) {
              await updateRecipient(recipient, {
                destination: phone,
                status: "queued",
                providerStatus: "waiting_for_whatsapp",
                metadata: { fallback_channel: "sms", primary_channel: "whatsapp" },
              });
              continue;
            }
          }
        }
        if (!phone) {
          await updateRecipient(recipient, { status: "skipped", skippedReason: "missing_phone" });
          continue;
        }
        if (row.sms_ok !== true) {
          await updateRecipient(recipient, { destination: phone, status: "skipped", skippedReason: "sms_permission_missing" });
          continue;
        }
        if (await isOptedOut(row, "sms", phone)) {
          await updateRecipient(recipient, { destination: phone, status: "skipped", skippedReason: "sms_opted_out" });
          continue;
        }
        if (!smsSendsEnabled) {
          await updateRecipient(recipient, {
            destination: phone,
            status: "skipped",
            skippedReason: "sms_a2p_not_enabled",
            metadata: { messaging_service_sid: TWILIO_MESSAGING_SERVICE_SID, event_url: eventUrl },
          });
          continue;
        }

        const trackedUrl = await trackedLink(recipient, "sms", phone, eventUrl);
        const smsBody = buildSmsText({
          recipientName,
          hostName,
          eventTitle: event.title,
          eventDate: compactSmsDate(schedule.date),
          link: trackedUrl,
        });
        const smsCancellation = await cancellationState();
        if (smsCancellation.cancelled) {
          await updateRecipient(recipient, {
            destination: phone,
            status: smsCancellation.error ? "failed" : "skipped",
            errorMessage: smsCancellation.error || undefined,
            skippedReason: smsCancellation.error ? undefined : "campaign_cancelled",
          });
          continue;
        }
        const { data: freshSmsRow, error: freshSmsError } = await admin
          .from("host_rolodex")
          .select("id, tags, sms_ok")
          .eq("id", recipient.rolodex_id)
          .eq("host_id", broadcast.host_id)
          .maybeSingle();
        if (freshSmsError || !freshSmsRow) {
          await updateRecipient(recipient, { destination: phone, status: "failed", errorMessage: "contact_state_unavailable" });
          continue;
        }
        if (hasChannelSuppressionTag(freshSmsRow as RolodexRow, "sms", respectSuppressionTags) || await isOptedOut(freshSmsRow as RolodexRow, "sms", phone)) {
          await updateRecipient(recipient, { destination: phone, status: "skipped", skippedReason: "sms_opted_out" });
          continue;
        }
        if ((freshSmsRow as RolodexRow).sms_ok !== true) {
          await updateRecipient(recipient, { destination: phone, status: "skipped", skippedReason: "sms_permission_missing" });
          continue;
        }
        const smsResult = await sendTwilioMessage(recipient, phone, "sms", { body: smsBody });
        await updateRecipient(recipient, {
          destination: phone,
          status: smsResult.status,
          providerSid: smsResult.sid,
          providerStatus: smsResult.providerStatus,
          errorMessage: smsResult.reason || undefined,
          metadata: {
            messaging_service_sid: TWILIO_MESSAGING_SERVICE_SID,
            event_url: eventUrl,
            link_mode: "oneevent_branded_short",
            tracked_url: trackedUrl,
            body_character_count: smsBody.length,
          },
        });
        continue;
      }

      if (recipient.channel === "whatsapp") {
        const heldDestination = typeof recipient.destination === "string" ? recipient.destination : "";
        if (!heldDestination) {
          await updateRecipient(recipient, { status: "skipped", skippedReason: "missing_whatsapp_phone" });
          continue;
        }
        const finalEligibility = await freshWhatsAppEligibility(recipient, heldDestination);
        if (!finalEligibility.eligible) {
          await updateRecipient(recipient, {
            destination: heldDestination,
            status: finalEligibility.reason === "cancellation_state_unavailable" || finalEligibility.reason === "contact_state_unavailable" || finalEligibility.reason === "suppression_state_unavailable" ? "failed" : "skipped",
            errorMessage: finalEligibility.reason === "cancellation_state_unavailable" || finalEligibility.reason === "contact_state_unavailable" || finalEligibility.reason === "suppression_state_unavailable" ? finalEligibility.reason : undefined,
            skippedReason: finalEligibility.reason === "cancellation_state_unavailable" || finalEligibility.reason === "contact_state_unavailable" || finalEligibility.reason === "suppression_state_unavailable" ? undefined : finalEligibility.reason || undefined,
          });
          continue;
        }
        const controlledWhatsAppTest =
          metadata.controlled_test === true &&
          Number(broadcast.recipient_count || 0) === 1 &&
          Boolean(controlledTestPhone) &&
          heldDestination === controlledTestPhone;
        if ((!whatsappSendsEnabled && !controlledWhatsAppTest) || !whatsappApproved) {
          await updateRecipient(recipient, {
            destination: heldDestination,
            status: "skipped",
            skippedReason: whatsappApproved ? "external_sends_disabled" : "whatsapp_pending_meta_approval",
            metadata: {
              messaging_service_sid: TWILIO_MESSAGING_SERVICE_SID,
              from: TWILIO_WHATSAPP_FROM,
              event_url: eventUrl,
            },
          });
          continue;
        }
        if (!TWILIO_WHATSAPP_INVITE_CONTENT_SID) {
          await updateRecipient(recipient, {
            destination: heldDestination,
            status: "failed",
            errorMessage: "Approved WhatsApp invite template is not configured",
            skippedReason: "whatsapp_template_not_configured",
          });
          continue;
        }
        const trackedUrl = await trackedLink(recipient, "whatsapp", heldDestination, eventUrl);
        const waResult = await dispatchWhatsApp(recipient, heldDestination, {
          contentSid: TWILIO_WHATSAPP_INVITE_CONTENT_SID,
          contentVariables: {
            "1": recipientName.slice(0, 60),
            "2": hostName.slice(0, 60),
            "3": event.title.slice(0, 100),
            "4": `${schedule.date} at ${schedule.startTime} ${schedule.timezone}`,
            "5": trackedUrl,
          },
        });
        await updateRecipient(recipient, {
          destination: heldDestination,
          status: waResult.status,
          providerSid: waResult.sid,
          providerStatus: waResult.providerStatus,
          errorMessage: waResult.reason || undefined,
          metadata: {
            messaging_service_sid: TWILIO_MESSAGING_SERVICE_SID,
            content_sid: TWILIO_WHATSAPP_INVITE_CONTENT_SID,
            event_url: eventUrl,
            tracked_url: trackedUrl,
          },
        });
      }
      } catch (recipientError) {
        console.error("recipient processing failed", { recipient_id: recipient.id, code: "recipient_processing_failed" });
        try {
          await updateRecipient(recipient, {
            status: "failed",
            errorMessage: "recipient_processing_failed",
            metadata: { failure_code: "recipient_processing_failed" },
          });
        } catch {
          // Keep processing other recipients even when one row cannot be updated.
        }
      }
    }

    const summary = await refreshSummary(admin, broadcastId);
    const { count: remainingPending } = await admin
      .from("event_rolodex_broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .eq("processing_status", "pending");

    await admin
      .from("event_rolodex_broadcasts")
      .update({
        processing_lock_until: null,
        processed_count: Number(summary.sent_count || 0) + Number(summary.queued_count || 0) + Number(summary.skipped_count || 0) + Number(summary.failed_count || 0),
      })
      .eq("id", broadcastId);

    const { data: finalBroadcastState } = await admin
      .from("event_rolodex_broadcasts")
      .select("status, cancel_requested_at")
      .eq("id", broadcastId)
      .maybeSingle();
    if ((remainingPending || 0) > 0 && finalBroadcastState?.status === "processing" && !finalBroadcastState?.cancel_requested_at) {
      waitUntil(scheduleNext(supabaseUrl, serviceKey, broadcastId));
    }

    return json({
      ok: true,
      broadcast_id: broadcastId,
      processed: recipients.length,
      pending: remainingPending || 0,
      results,
      summary,
    });
  } catch (err) {
    console.error("process-event-rolodex-broadcast error:", err);
    if (typeof body?.broadcastId === "string") {
      await admin
        .from("event_rolodex_broadcasts")
        .update({
          processing_lock_until: null,
          processing_error: String(err),
        })
        .eq("id", body.broadcastId);
    }
    return json({ error: String(err) }, 500);
  }
});

async function refreshSummary(supabase: any, broadcastId: string) {
  const { data: recipients, error } = await supabase
    .from("event_rolodex_broadcast_recipients")
    .select("status, skipped_reason, processing_status")
    .eq("broadcast_id", broadcastId);

  if (error) throw new Error(error.message);

  const summary = ((recipients || []) as Array<{ status?: string | null; skipped_reason?: string | null; processing_status?: string | null }>).reduce<{
    sent_count: number;
    queued_count: number;
    skipped_count: number;
    failed_count: number;
    whatsapp_pending_count: number;
    pending_count: number;
  }>(
    (acc, row: { status?: string | null; skipped_reason?: string | null; processing_status?: string | null }) => {
      if (row.status === "sent") acc.sent_count++;
      if (row.status === "queued") acc.queued_count++;
      if (row.status === "skipped") acc.skipped_count++;
      if (row.status === "failed") acc.failed_count++;
      if (row.processing_status === "pending") acc.pending_count++;
      if (row.skipped_reason === "whatsapp_pending_meta_approval") acc.whatsapp_pending_count++;
      return acc;
    },
    { sent_count: 0, queued_count: 0, skipped_count: 0, failed_count: 0, whatsapp_pending_count: 0, pending_count: 0 },
  );

  await supabase
    .from("event_rolodex_broadcasts")
    .update({
      sent_count: summary.sent_count,
      queued_count: summary.queued_count,
      skipped_count: summary.skipped_count,
      failed_count: summary.failed_count,
      whatsapp_pending_count: summary.whatsapp_pending_count,
      processed_count: summary.sent_count + summary.queued_count + summary.skipped_count + summary.failed_count,
      status:
        summary.pending_count > 0
          ? "processing"
          : summary.failed_count > 0
            ? "completed_with_errors"
            : summary.queued_count > 0
              ? "processing"
              : "completed",
      completed_at: summary.pending_count > 0 || summary.queued_count > 0 ? null : new Date().toISOString(),
    })
    .eq("id", broadcastId)
    .eq("status", "processing")
    .is("cancel_requested_at", null);

  return summary;
}

