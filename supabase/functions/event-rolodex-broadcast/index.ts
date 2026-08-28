import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
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
const EMAIL_SENDS_ENABLED = envFlag("EVENT_ROLODEX_EMAIL_SENDS_ENABLED", true);
const MAX_ROLODEX_RECIPIENTS = Math.min(Math.max(Number(Deno.env.get("EVENT_ROLODEX_MAX_RECIPIENTS") || "2000"), 1), 5000);
const ASYNC_CONTACT_THRESHOLD = Math.min(Math.max(Number(Deno.env.get("EVENT_ROLODEX_ASYNC_CONTACT_THRESHOLD") || "40"), 1), 5000);

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

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(promise);
  } else {
    promise.catch((error) => console.error("background task failed", error));
  }
}

async function kickBroadcastWorker(supabaseUrl: string, serviceKey: string, broadcastId: string) {
  await fetch(`${supabaseUrl}/functions/v1/process-event-rolodex-broadcast`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ broadcastId, trigger: "accepted" }),
  });
}

function cleanMessage(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 500);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Server configuration error" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: "Authentication required" }, 401);

    const body = await req.json().catch(() => ({}));
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const rolodexIds = Array.isArray(body.rolodexIds)
      ? [...new Set(body.rolodexIds.filter((id: unknown) => typeof id === "string"))].slice(0, MAX_ROLODEX_RECIPIENTS)
      : [];
    const requestedChannels = Array.isArray(body.channels)
      ? body.channels.filter((channel: unknown): channel is Channel =>
          ["in_app", "email", "sms", "whatsapp"].includes(String(channel))
        )
      : [];
    const channels = [...new Set(requestedChannels)];
    const message = cleanMessage(body.message);
    const includeTicketLink = body.includeTicketLink !== false;
    const includeGroupChatLink = body.includeGroupChatLink === true;
    const respectSuppressionTags = body.respectSuppressionTags !== false;
    const followupOffsetsMinutes = Array.isArray(body.followupOffsetsMinutes)
      ? [...new Set(body.followupOffsetsMinutes
          .map((value: unknown) => Number(value))
          .filter((value: number) => [120, 1440, 4320].includes(value)))]
      : [];
    const externalChannels = channels.filter((channel) => channel !== "in_app");
    const attestExternalPermission = body.attestExternalPermission === true;
    const controlledTest = body.controlledTest === true;
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";

    if (!eventId) return json({ error: "eventId required" }, 400);
    if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return json({ error: "requestId must be a UUID" }, 400);
    }
    if (rolodexIds.length === 0) return json({ error: "Select at least one Rolodex contact" }, 400);
    if (channels.length === 0) return json({ error: "Select at least one delivery channel" }, 400);
    if (controlledTest && (rolodexIds.length !== 1 || channels.length !== 1 || channels[0] !== "whatsapp")) {
      return json({ error: "A controlled test must target exactly one Rolodex contact through WhatsApp only" }, 400);
    }
    if (externalChannels.length > 0 && !attestExternalPermission) {
      return json({ error: "External channel permission attestation required" }, 400);
    }

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, host_id, title, start_date, end_date, timezone, location, venue_name, status, slug")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !event) return json({ error: "Event not found" }, 404);
    if (event.host_id !== user.id) return json({ error: "Only the event host can send this broadcast" }, 403);
    if (event.status !== "published") return json({ error: "Publish the event before sending Rolodex invites" }, 400);

    if (requestId) {
      const { data: existing, error: existingError } = await admin
        .from("event_rolodex_broadcasts")
        .select("id, status, recipient_count, sent_count, queued_count, skipped_count, failed_count, whatsapp_pending_count")
        .eq("host_id", user.id)
        .eq("event_id", eventId)
        .eq("request_id", requestId)
        .maybeSingle();
      if (existingError) return json({ error: existingError.message }, 500);
      if (existing) {
        if (existing.status === "processing") {
          waitUntil(kickBroadcastWorker(supabaseUrl, serviceKey, existing.id));
        }
        return json({
          ok: true,
          broadcast_id: existing.id,
          accepted: true,
          duplicate_request: true,
          processing: existing.status === "processing" ? "batched" : existing.status,
          summary: {
            sent_count: existing.sent_count || 0,
            queued_count: existing.queued_count || 0,
            skipped_count: existing.skipped_count || 0,
            failed_count: existing.failed_count || 0,
            whatsapp_pending_count: existing.whatsapp_pending_count || 0,
          },
        });
      }
    }

    const eventStartMs = event.start_date ? new Date(event.start_date).getTime() : Number.NaN;
    if (followupOffsetsMinutes.length > 0 && !Number.isFinite(eventStartMs)) {
      return json({ error: "A valid event start date is required for invite follow-ups" }, 400);
    }
    const nowMs = Date.now();
    const scheduledFollowups = followupOffsetsMinutes
      .map((offset) => ({ offset, scheduledFor: new Date(eventStartMs - offset * 60_000) }))
      .filter(({ scheduledFor }) => scheduledFor.getTime() > nowMs);
    if (scheduledFollowups.length !== followupOffsetsMinutes.length) {
      return json({ error: "One or more selected follow-up windows have already passed" }, 400);
    }

    const { data: hostProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const hostName = hostProfile?.full_name || "Your host";
    const broadcastMessage = message || `${hostName} invited you to ${event.title} on OneEvent.`;

    const { data: contactsRaw, error: contactsError } = await admin
      .from("host_rolodex")
      .select("id, host_id, contact_id, name, email, phone, tags, custom_fields")
      .eq("host_id", user.id)
      .in("id", rolodexIds);
    if (contactsError) return json({ error: contactsError.message }, 500);

    const contacts = ((contactsRaw || []) as RolodexRow[]);
    if (contacts.length === 0) return json({ error: "No matching Rolodex contacts found" }, 404);

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
    const emailProfileMap = new Map(
      (profilesByEmailRaw || []).map((profile: any) => [normalizeEmail(profile.email), profile]),
    );
    const phoneProfileMap = new Map(
      (profilesByPhoneRaw || [])
        .map((profile: any) => [normalizePhone(profile.phone), profile])
        .filter(([phone]: [string, any]) => Boolean(phone)),
    );
    const resolveProfile = (row: RolodexRow) =>
      (row.contact_id ? profileMap.get(row.contact_id) : null) ||
      emailProfileMap.get(normalizeEmail(row.email)) ||
      phoneProfileMap.get(normalizePhone(row.phone)) ||
      null;

    let attestationId: string | null = null;
    if (externalChannels.length > 0) {
      const consentStatement =
        "Host confirmed they have permission to contact selected Rolodex recipients about this event via the selected external channels.";
      const { data: attestation, error: attestationError } = await admin
        .from("rolodex_import_attestations")
        .insert({
          host_id: user.id,
          attested_by: user.id,
          source: "event_rolodex_broadcast",
          consent_statement: consentStatement,
          imported_count: contacts.length,
          contact_count: contacts.length,
          email_ok: channels.includes("email"),
          sms_ok: channels.includes("sms"),
          whatsapp_ok: channels.includes("whatsapp"),
          attestation_text: consentStatement,
          attestation_version: "event-rolodex-broadcast-2026-08-21",
          metadata: { event_id: eventId, channels: externalChannels },
        })
        .select("id")
        .single();
      if (attestationError) return json({ error: attestationError.message }, 500);
      attestationId = attestation.id;

      const update: Record<string, unknown> = { attestation_id: attestationId };
      if (channels.includes("email")) update.email_ok = true;
      if (channels.includes("sms")) update.sms_ok = true;
      if (channels.includes("whatsapp")) update.whatsapp_ok = true;
      await admin.from("host_rolodex").update(update).eq("host_id", user.id).in("id", contacts.map((row) => row.id));
    }

    const broadcastMetadata = {
      controlled_test: controlledTest,
      sender: {
        sms_from: TWILIO_SMS_FROM,
        whatsapp_from: TWILIO_WHATSAPP_FROM,
        whatsapp_approved: envFlag("EVENT_ROLODEX_WHATSAPP_APPROVED", false),
      },
      email_options: {
        include_ticket_link: includeTicketLink,
        include_group_chat_link: includeGroupChatLink,
      },
      send_options: {
        respect_suppression_tags: respectSuppressionTags,
      },
      processing: {
        mode: "batched",
        max_recipients: MAX_ROLODEX_RECIPIENTS,
        async_contact_threshold: ASYNC_CONTACT_THRESHOLD,
      },
      followups: {
        offsets_minutes: scheduledFollowups.map(({ offset }) => offset),
      },
    };

    const { data: broadcast, error: broadcastError } = await admin
      .from("event_rolodex_broadcasts")
      .insert({
        event_id: eventId,
        host_id: user.id,
        created_by: user.id,
        attestation_id: attestationId,
        request_id: requestId || null,
        message: broadcastMessage,
        channels,
        recipient_count: contacts.length,
        accepted_count: contacts.length,
        processing_batch_size: 50,
        metadata: broadcastMetadata,
      })
      .select("id")
      .single();
    if (broadcastError) {
      if (requestId && broadcastError.code === "23505") {
        const { data: existing } = await admin
          .from("event_rolodex_broadcasts")
          .select("id, status, sent_count, queued_count, skipped_count, failed_count, whatsapp_pending_count")
          .eq("host_id", user.id)
          .eq("event_id", eventId)
          .eq("request_id", requestId)
          .maybeSingle();
        if (existing) {
          if (existing.status === "processing") {
            waitUntil(kickBroadcastWorker(supabaseUrl, serviceKey, existing.id));
          }
          return json({
            ok: true,
            broadcast_id: existing.id,
            accepted: true,
            duplicate_request: true,
            processing: existing.status === "processing" ? "batched" : existing.status,
            summary: {
              sent_count: existing.sent_count || 0,
              queued_count: existing.queued_count || 0,
              skipped_count: existing.skipped_count || 0,
              failed_count: existing.failed_count || 0,
              whatsapp_pending_count: existing.whatsapp_pending_count || 0,
            },
          });
        }
      }
      return json({ error: broadcastError.message }, 500);
    }

    if (scheduledFollowups.length > 0) {
      const { error: followupError } = await admin
        .from("event_rolodex_broadcast_followups")
        .insert(scheduledFollowups.map(({ offset, scheduledFor }) => ({
          parent_broadcast_id: broadcast.id,
          event_id: eventId,
          host_id: user.id,
          reminder_offset_minutes: offset,
          channels,
          scheduled_for: scheduledFor.toISOString(),
          next_attempt_at: scheduledFor.toISOString(),
        })));
      if (followupError) {
        await admin.from("event_rolodex_broadcasts").update({
          status: "failed",
          processing_error: `Follow-up schedule could not be saved: ${followupError.message}`,
        }).eq("id", broadcast.id);
        return json({ error: "The invite was not queued because its follow-up schedule could not be saved." }, 500);
      }
    }

    // All channels use the same audited worker path so tests and small sends cannot bypass
    // consent checks, tracked links, provider callbacks, or WhatsApp templates.
    if (contacts.length > 0) {
      const now = new Date().toISOString();
      const seenDestinations = new Set<string>();
      const recipientRows = contacts.flatMap((row) => {
        const profile = resolveProfile(row);
        const linkedContactId = row.contact_id || profile?.id || null;
        const destinations: Record<Channel, string> = {
          in_app: linkedContactId || "",
          email: normalizeEmail(row.email || profile?.email),
          sms: normalizePhone(row.phone || profile?.phone),
          whatsapp: whatsappDestination(row, profile?.phone),
        };

        return channels.map((channel) => {
          const destination = destinations[channel];
          const destinationKey = destination ? `${channel}:${destination}` : "";
          const duplicateDestination = Boolean(destinationKey && seenDestinations.has(destinationKey));
          if (destinationKey && !duplicateDestination) seenDestinations.add(destinationKey);

          return {
            broadcast_id: broadcast.id,
            event_id: eventId,
            host_id: user.id,
            rolodex_id: row.id,
            contact_id: linkedContactId,
            channel,
            destination: destination || null,
            status: duplicateDestination ? "skipped" : "queued",
            queued_at: duplicateDestination ? null : now,
            processing_status: duplicateDestination ? "done" : "pending",
            processed_at: duplicateDestination ? now : null,
            skipped_reason: duplicateDestination ? "duplicate_destination" : null,
            metadata: {
              processing_mode: "batched",
              event_url: buildEventUrl(event),
              group_chat_url: includeGroupChatLink ? buildGroupChatUrl(event, channel) : null,
              dedupe_key: destinationKey || null,
            },
          };
        });
      });

      const insertChunkSize = 500;
      for (let i = 0; i < recipientRows.length; i += insertChunkSize) {
        const { error: insertRecipientsError } = await admin
          .from("event_rolodex_broadcast_recipients")
          .insert(recipientRows.slice(i, i + insertChunkSize));
        if (insertRecipientsError) return json({ error: insertRecipientsError.message }, 500);
      }

      const summary = {
        sent_count: 0,
        queued_count: recipientRows.filter((row) => row.processing_status === "pending").length,
        skipped_count: recipientRows.filter((row) => row.skipped_reason === "duplicate_destination").length,
        failed_count: 0,
        whatsapp_pending_count: 0,
        scheduled_followup_count: scheduledFollowups.length,
      };

      await admin
        .from("event_rolodex_broadcasts")
        .update({
          ...summary,
          processed_count: 0,
          processing_started_at: now,
        })
        .eq("id", broadcast.id);

      await admin
        .from("host_rolodex")
        .update({ last_notified_at: now, last_broadcast_id: broadcast.id })
        .eq("host_id", user.id)
        .in("id", contacts.map((row) => row.id));

      waitUntil(kickBroadcastWorker(supabaseUrl, serviceKey, broadcast.id));

      return json({
        ok: true,
        broadcast_id: broadcast.id,
        accepted: true,
        processing: "batched",
        summary,
        results: [],
        config: {
          sms_from: TWILIO_SMS_FROM,
          whatsapp_from: TWILIO_WHATSAPP_FROM,
          external_sends_enabled: envFlag("EVENT_ROLODEX_EXTERNAL_SENDS_ENABLED", false),
          email_sends_enabled: EMAIL_SENDS_ENABLED,
          whatsapp_approved: envFlag("EVENT_ROLODEX_WHATSAPP_APPROVED", false),
          batch_size: 50,
        },
      });
    }

    const externalSendsEnabled = envFlag("EVENT_ROLODEX_EXTERNAL_SENDS_ENABLED", false);
    const whatsappApproved = envFlag("EVENT_ROLODEX_WHATSAPP_APPROVED", false);
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
    const twilioKey = Deno.env.get("TWILIO_API_KEY") || "";
    const schedule = formatEventSchedule(event.start_date, event.end_date, event.timezone);
    const eventVenueName = cleanLocationValue(event.venue_name);
    const eventMapQuery = cleanLocationValue(event.location) || eventVenueName;
    const eventLocationUrl = googleMapsUrl(eventMapQuery);
    const eventLocation = eventVenueName || (eventLocationUrl ? "See Map" : "Location TBD");
    const results: Array<Record<string, unknown>> = [];

    const recordRecipient = async (row: RolodexRow, channel: Channel, values: {
      contactId?: string | null;
      destination?: string;
      status: DeliveryStatus;
      providerSid?: string;
      errorMessage?: string;
      skippedReason?: string;
      metadata?: Record<string, unknown>;
    }) => {
      await admin.from("event_rolodex_broadcast_recipients").insert({
        broadcast_id: broadcast.id,
        event_id: eventId,
        host_id: user.id,
        rolodex_id: row.id,
        contact_id: values.contactId ?? row.contact_id,
        channel,
        destination: values.destination || null,
        status: values.status,
        provider_sid: values.providerSid || null,
        error_message: values.errorMessage || null,
        skipped_reason: values.skippedReason || null,
        queued_at: values.status === "queued" ? new Date().toISOString() : null,
        sent_at: values.status === "sent" ? new Date().toISOString() : null,
        metadata: values.metadata || {},
      });
      results.push({
        rolodex_id: row.id,
        channel,
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
        .or(`host_id.is.null,host_id.eq.${user.id}`)
        .maybeSingle();
      return Boolean(data);
    };

    const sendTwilioMessage = async (to: string, channel: "sms" | "whatsapp", text: string) => {
      if (!lovableKey || !twilioKey) {
        return { status: "queued" as DeliveryStatus, reason: "twilio_not_configured" };
      }
      const params: Record<string, string> = { Body: text };
      if (channel === "whatsapp") {
        params.To = `whatsapp:${to}`;
        params.From = TWILIO_WHATSAPP_FROM;
      } else {
        params.To = to;
        if (TWILIO_MESSAGING_SERVICE_SID) params.MessagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
        else params.From = TWILIO_SMS_FROM;
      }

      const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": twilioKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { status: "failed" as DeliveryStatus, reason: data?.message || data?.error || "twilio_failed" };
      }
      return { status: "sent" as DeliveryStatus, sid: data?.sid as string | undefined };
    };

    const sendInApp = async (row: RolodexRow) => {
      const linkedProfile = resolveProfile(row);
      const linkedContactId = row.contact_id || linkedProfile?.id || null;
      if (!linkedContactId) {
        await recordRecipient(row, "in_app", { status: "skipped", skippedReason: "no_linked_onesocial_account" });
        return;
      }

      if (!row.contact_id) {
        await admin
          .from("host_rolodex")
          .update({ contact_id: linkedContactId })
          .eq("host_id", user.id)
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
        .or(`and(requester_id.eq.${user.id},recipient_id.eq.${linkedContactId}),and(requester_id.eq.${linkedContactId},recipient_id.eq.${user.id})`)
        .maybeSingle();

      const { data: existingConvos } = await admin
        .from("conversations")
        .select("id, participant_ids")
        .contains("participant_ids", [user.id])
        .order("last_message_at", { ascending: false })
        .limit(50);

      let conversationId = ((existingConvos || []) as any[]).find((conversation) =>
        Array.isArray(conversation.participant_ids) &&
        conversation.participant_ids.includes(user.id) &&
        conversation.participant_ids.includes(linkedContactId)
      )?.id || null;

      if (!conversationId) {
        const { data: newConvo, error: convoError } = await admin
          .from("conversations")
          .insert({
            participant_ids: [user.id, linkedContactId],
            category: "events",
            last_message_text: inAppContent.slice(0, 100),
            last_message_at: new Date().toISOString(),
            is_request: !connection,
          })
          .select("id")
          .single();
        if (convoError) {
          await recordRecipient(row, "in_app", { status: "failed", errorMessage: convoError.message });
          return;
        }
        conversationId = newConvo.id;
      }

      const { error: messageError } = await admin.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: inAppContent,
        message_type: "event_announcement",
        metadata: {
          event_announcement: {
            event_id: eventId,
            title: event.title,
            start_date: event.start_date,
            location: event.location,
            link: eventUrl,
            group_chat_link: includeGroupChatLink ? groupChatUrl : null,
          },
        },
      });

      if (messageError) {
        await recordRecipient(row, "in_app", { status: "failed", errorMessage: messageError.message });
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
          event_id: eventId,
          event_title: event.title,
          broadcast_id: broadcast.id,
          conversation_id: conversationId,
          group_chat_url: includeGroupChatLink ? groupChatUrl : null,
        },
      });

      await recordRecipient(row, "in_app", { contactId: linkedContactId, status: "sent" });
    };

    const processRow = async (row: RolodexRow) => {
      const profile = resolveProfile(row);
      const linkedContactId = row.contact_id || profile?.id || null;
      if (!row.contact_id && linkedContactId) {
        await admin
          .from("host_rolodex")
          .update({ contact_id: linkedContactId })
          .eq("host_id", user.id)
          .eq("id", row.id)
          .is("contact_id", null);
        row.contact_id = linkedContactId;
      }
      const recipientName = profile?.full_name || row.name || "there";
      const email = normalizeEmail(row.email || profile?.email);
      const phone = normalizePhone(row.phone || profile?.phone);
      const whatsappPhone = whatsappDestination(row, profile?.phone);

      for (const channel of channels) {
        const eventUrl = buildEventUrl(event);
        const groupChatUrl = buildGroupChatUrl(event, channel);
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

        if (channel === "in_app") {
          await sendInApp(row);
          continue;
        }

        if (channel === "email") {
          if (!email) {
            await recordRecipient(row, channel, { status: "skipped", skippedReason: "missing_email" });
            continue;
          }
          if (await isOptedOut(row, "email", email)) {
            await recordRecipient(row, channel, { destination: email, status: "skipped", skippedReason: "email_opted_out" });
            continue;
          }
          if (!EMAIL_SENDS_ENABLED) {
            await recordRecipient(row, channel, {
              destination: email,
              status: "queued",
              skippedReason: "email_sends_disabled",
              metadata: { event_url: eventUrl },
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
              },
            }),
          });
          const emailJson = await emailRes.json().catch(() => ({}));
          await recordRecipient(row, channel, {
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

        if (channel === "sms") {
          if (!phone) {
            await recordRecipient(row, channel, { status: "skipped", skippedReason: "missing_phone" });
            continue;
          }
          if (await isOptedOut(row, "sms", phone)) {
            await recordRecipient(row, channel, { destination: phone, status: "skipped", skippedReason: "sms_opted_out" });
            continue;
          }
          if (!externalSendsEnabled) {
            await recordRecipient(row, channel, {
              destination: phone,
              status: "queued",
              skippedReason: "external_sends_disabled",
              metadata: { from: TWILIO_SMS_FROM, event_url: eventUrl },
            });
            continue;
          }
          const smsResult = await sendTwilioMessage(phone, "sms", outboundText);
          await recordRecipient(row, channel, {
            destination: phone,
            status: smsResult.status,
            providerSid: smsResult.sid,
            errorMessage: smsResult.status === "failed" ? smsResult.reason : undefined,
            metadata: { from: TWILIO_SMS_FROM, event_url: eventUrl },
          });
          continue;
        }

        if (channel === "whatsapp") {
          if (!whatsappPhone) {
            await recordRecipient(row, channel, { status: "skipped", skippedReason: "missing_whatsapp_phone" });
            continue;
          }
          if (await isOptedOut(row, "whatsapp", whatsappPhone)) {
            await recordRecipient(row, channel, { destination: whatsappPhone, status: "skipped", skippedReason: "whatsapp_opted_out" });
            continue;
          }
          if (!externalSendsEnabled || !whatsappApproved) {
            await recordRecipient(row, channel, {
              destination: whatsappPhone,
              status: "queued",
              skippedReason: whatsappApproved ? "external_sends_disabled" : "whatsapp_pending_meta_approval",
              metadata: { from: TWILIO_WHATSAPP_FROM, event_url: eventUrl },
            });
            continue;
          }
          const waResult = await sendTwilioMessage(whatsappPhone, "whatsapp", outboundText);
          await recordRecipient(row, channel, {
            destination: whatsappPhone,
            status: waResult.status,
            providerSid: waResult.sid,
            errorMessage: waResult.status === "failed" ? waResult.reason : undefined,
            metadata: { from: TWILIO_WHATSAPP_FROM, event_url: eventUrl },
          });
        }
      }
    };

    const requestedConcurrency = Number(Deno.env.get("EVENT_ROLODEX_BROADCAST_CONCURRENCY") || "8");
    const contactConcurrency = Math.min(Math.max(Number.isFinite(requestedConcurrency) ? requestedConcurrency : 8, 1), 12);
    let nextContactIndex = 0;
    await Promise.all(
      Array.from({ length: Math.min(contactConcurrency, contacts.length) }, async () => {
        while (nextContactIndex < contacts.length) {
          const row = contacts[nextContactIndex++];
          await processRow(row);
        }
      }),
    );

    const summary = results.reduce(
      (acc, result) => {
        const status = result.status as DeliveryStatus;
        if (status === "sent") acc.sent_count++;
        if (status === "queued") acc.queued_count++;
        if (status === "skipped") acc.skipped_count++;
        if (status === "failed") acc.failed_count++;
        if (result.reason === "whatsapp_pending_meta_approval") acc.whatsapp_pending_count++;
        return acc;
      },
      { sent_count: 0, queued_count: 0, skipped_count: 0, failed_count: 0, whatsapp_pending_count: 0 },
    );
    (summary as Record<string, number>).scheduled_followup_count = scheduledFollowups.length;

    await admin
      .from("event_rolodex_broadcasts")
      .update({
        ...summary,
        status: summary.failed_count > 0 ? "completed_with_errors" : "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", broadcast.id);

    await admin
      .from("host_rolodex")
      .update({ last_notified_at: new Date().toISOString(), last_broadcast_id: broadcast.id })
      .eq("host_id", user.id)
      .in("id", contacts.map((row) => row.id));

    return json({
      ok: true,
      broadcast_id: broadcast.id,
      summary,
      results,
      config: {
        sms_from: TWILIO_SMS_FROM,
        whatsapp_from: TWILIO_WHATSAPP_FROM,
        external_sends_enabled: externalSendsEnabled,
        email_sends_enabled: EMAIL_SENDS_ENABLED,
        whatsapp_approved: whatsappApproved,
      },
    });
  } catch (err) {
    console.error("event-rolodex-broadcast error:", err);
    return json({ error: String(err) }, 500);
  }
});
