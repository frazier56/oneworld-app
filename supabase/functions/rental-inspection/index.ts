// rental-inspection — private walkthrough media, gated tenant review and
// authenticated owner/listing-agent operations. A 48-hex contract token is the
// tenant capability. Raw storage paths never leave a read response.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = "https://app.oneworldlabs.ai";

const service = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...CORS,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
  },
});
const validToken = (value: string) => /^[0-9a-f]{48}$/i.test(value);
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const DRAFT_PREFIX = "draft:";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]!));

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mediaLocation(reference: string) {
  return reference.startsWith(DRAFT_PREFIX)
    ? { bucket: "rental-walkthrough-drafts", path: reference.slice(DRAFT_PREFIX.length) }
    : { bucket: "rental-evidence", path: reference };
}

async function signedMediaUrls(references: string[]) {
  const output: Record<string, string> = {};
  const groups = new Map<string, { reference: string; path: string }[]>();
  for (const reference of references) {
    const location = mediaLocation(reference);
    const group = groups.get(location.bucket) ?? [];
    group.push({ reference, path: location.path });
    groups.set(location.bucket, group);
  }
  for (const [bucket, group] of groups) {
    const { data, error } = await service.storage.from(bucket).createSignedUrls(group.map(item => item.path), 3600);
    if (error) throw error;
    (data ?? []).forEach((signed, index) => {
      if (signed.signedUrl) output[group[index].reference] = signed.signedUrl;
    });
  }
  return output;
}

async function removeMedia(references: string[]) {
  const groups = new Map<string, string[]>();
  for (const reference of references) {
    const location = mediaLocation(reference);
    groups.set(location.bucket, [...(groups.get(location.bucket) ?? []), location.path]);
  }
  const errors: string[] = [];
  for (const [bucket, paths] of groups) {
    const { error } = await service.storage.from(bucket).remove(paths);
    if (error) errors.push(error.message);
  }
  return errors;
}

async function publicPacket(token: string) {
  const { data: contract, error: contractError } = await service
    .from("rental_contracts")
    .select("id, property_id, agent_id, status, inspection_order, share_token, rent_amount, currency, first_payment_claimed_at, first_payment_rail, first_payment_reference, first_payment_claim_note")
    .eq("share_token", token.toLowerCase())
    .maybeSingle();
  if (contractError || !contract) return { error: "That walkthrough link is not valid.", status: 404 };

  const [{ data: inspection }, { data: property }, { data: owner }] = await Promise.all([
    service.from("rental_inspections")
      .select("id, state, kind, round, sent_at, settled_at, evidence_version, evidence_manifest_sha256, evidence_frozen_at, released_at, release_reason")
      .eq("contract_id", contract.id).eq("kind", "move_in")
      .order("round", { ascending: false }).limit(1).maybeSingle(),
    service.from("rental_properties")
      .select("title, listing_no, city, neighbourhood")
      .eq("id", contract.property_id).maybeSingle(),
    service.from("profiles").select("full_name").eq("id", contract.agent_id).maybeSingle(),
  ]);
  if (!inspection || inspection.state === "draft" || !inspection.released_at) {
    return { error: "The walkthrough media have not been released yet.", status: 403 };
  }

  const { data: rows, error: itemError } = await service
    .from("rental_inspection_items")
    .select("id, ordinal, photo_url, host_note, verdict, tenant_note, tenant_photo_url, responded_at, media_kind, mime_type, byte_size, original_name, room, duration_ms, width, height, captured_at, uploaded_at, source_version, tenant_photo_mime_type, tenant_photo_byte_size, tenant_photo_original_name, tenant_photo_captured_at, tenant_photo_uploaded_at, tenant_evidence_status, tenant_evidence_locked_at")
    .eq("inspection_id", inspection.id)
    .order("ordinal", { ascending: true });
  if (itemError) return { error: "The walkthrough could not be opened.", status: 500 };

  const paths = (rows ?? []).flatMap((row) => [row.photo_url, row.tenant_photo_url]).filter((path): path is string => Boolean(path) && !/^https?:/i.test(path!));
  let signedByPath: Record<string, string> = {};
  try { signedByPath = paths.length ? await signedMediaUrls(paths) : {}; }
  catch (_) { return { error: "The walkthrough photos could not be opened.", status: 500 }; }

  return {
    status: 200,
    data: {
      inspection_id: inspection.id,
      state: inspection.state,
      sent_at: inspection.sent_at,
      approved_at: inspection.settled_at,
      evidence_version: inspection.evidence_version,
      evidence_manifest_sha256: inspection.evidence_manifest_sha256,
      evidence_frozen_at: inspection.evidence_frozen_at,
      released_at: inspection.released_at,
      release_reason: inspection.release_reason,
      property: property ?? { title: "OneHome walkthrough" },
      owner_name: owner?.full_name ?? "The owner",
      contract: {
        status: contract.status,
        rent_amount: contract.rent_amount,
        currency: contract.currency,
        payment_claimed_at: contract.first_payment_claimed_at,
        payment_rail: contract.first_payment_rail,
        payment_reference: contract.first_payment_reference,
        payment_note: contract.first_payment_claim_note,
      },
      items: (rows ?? []).map((row) => ({
        id: row.id,
        ordinal: row.ordinal,
        note: row.host_note,
        room: row.room,
        media_kind: row.media_kind ?? "image",
        mime_type: row.mime_type,
        byte_size: row.byte_size,
        original_name: row.original_name,
        width: row.width,
        height: row.height,
        duration_ms: row.duration_ms,
        captured_at: row.captured_at,
        uploaded_at: row.uploaded_at,
        source_version: row.source_version,
        verdict: row.verdict,
        tenant_note: row.tenant_note,
        responded_at: row.responded_at,
        tenant_evidence_status: row.tenant_evidence_status,
        tenant_evidence_locked_at: row.tenant_evidence_locked_at,
        tenant_photo: row.tenant_photo_url ? {
          url: signedByPath[row.tenant_photo_url] ?? null,
          mime_type: row.tenant_photo_mime_type,
          byte_size: row.tenant_photo_byte_size,
          original_name: row.tenant_photo_original_name,
          captured_at: row.tenant_photo_captured_at,
          uploaded_at: row.tenant_photo_uploaded_at,
        } : null,
        photo_url: signedByPath[row.photo_url] ?? null,
      })),
    },
  };
}

async function authenticated(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { error: "Sign in as the property owner.", status: 401 } as const;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await userClient.auth.getUser(jwt);
  if (error || !data.user) return { error: "Your session expired. Sign in again.", status: 401 } as const;
  return { userClient, user: data.user, jwt } as const;
}

async function ownerPacket(userClient: ReturnType<typeof createClient>, userId: string, token: string) {
  if (!validToken(token)) return { error: "That owner link is not valid.", status: 400 } as const;
  const { data: handoff, error: handoffError } = await userClient.rpc("rental_owner_handoff_status", { p_token: token });
  if (handoffError || !handoff?.inspection_id) {
    return { error: handoffError?.message || "This owner handoff is not connected to your account.", status: 403 } as const;
  }
  const [{ data: inspection }, { data: items }, { data: claim }, { data: contract }, { data: auditEvents }] = await Promise.all([
    service.from("rental_inspections")
      .select("id, state, round, evidence_version, evidence_manifest_sha256, evidence_frozen_at, released_at, release_reason, released_by")
      .eq("id", handoff.inspection_id).single(),
    service.from("rental_inspection_items")
      .select("id, ordinal, photo_url, host_note, verdict, tenant_note, tenant_photo_url, responded_at, media_kind, mime_type, byte_size, original_name, room, duration_ms, width, height, upload_state, captured_at, uploaded_at, source_version, tenant_photo_mime_type, tenant_photo_byte_size, tenant_photo_original_name, tenant_photo_captured_at, tenant_photo_uploaded_at, tenant_evidence_status, tenant_evidence_locked_at")
      .eq("inspection_id", handoff.inspection_id).order("ordinal", { ascending: true }),
    service.from("rental_property_claims")
      .select("id, claimed_by, note, rental_properties!inner(listing_no)")
      .eq("claim_token", token.toLowerCase()).single(),
    service.from("rental_contracts").select("id, conversation_id, tenant_id, status, first_payment_claimed_at").eq("id", handoff.contract_id).single(),
    service.from("rental_inspection_audit_events")
      .select("id, item_id, event_type, actor_role, event_payload, created_at, audit_version")
      .eq("inspection_id", handoff.inspection_id).order("id", { ascending: true }).limit(250),
  ]);
  if (!inspection) return { error: "That walkthrough was not found.", status: 404 } as const;
  const paths = (items ?? []).flatMap((item) => [item.photo_url, item.tenant_photo_url]).filter((path): path is string => Boolean(path) && !/^https?:/i.test(path!));
  const signedByPath = paths.length ? await signedMediaUrls(paths).catch(() => ({})) : {};
  const listingNo = Number((claim as any)?.rental_properties?.listing_no ?? 0);
  return {
    data: {
      ...handoff,
      claim_id: claim?.id ?? null,
      listing_no: listingNo,
      inspection,
      items: (items ?? []).map((item) => ({
        ...item,
        preview_url: signedByPath[item.photo_url] ?? null,
        tenant_preview_url: item.tenant_photo_url
          ? (signedByPath[item.tenant_photo_url] ?? null)
          : null,
      })),
      audit_events: auditEvents ?? [],
      message_context: {
        contract_id: handoff.contract_id,
        inspection_id: handoff.inspection_id,
        conversation_id: contract?.conversation_id ?? null,
        url: `/messages?contract=${encodeURIComponent(handoff.contract_id)}&inspection=${encodeURIComponent(handoff.inspection_id)}`,
      },
      contract: contract ?? null,
      upload: {
        bucket: "rental-evidence",
        path_prefix: `${handoff.contract_id}/${userId}/${handoff.inspection_id}/`,
        max_image_file_bytes: 26214400,
        max_video_file_bytes: 314572800,
        max_images: 100,
        max_videos: 10,
        max_queue_bytes: 1073741824,
        concurrency: 3,
        max_video_duration_ms: 300000,
        allowed_mime_types: [...IMAGE_MIMES, ...VIDEO_MIMES],
        video_supported: true,
      },
      qa_reset_allowed: listingNo === 10518 && claim?.claimed_by === userId && /(safe|qa|test)/i.test(String(claim?.note ?? "")),
    },
    status: 200,
  } as const;
}

function emailBodies(propertyTitle: string, ownerName: string, url: string) {
  const safeTitle = escapeHtml(propertyTitle);
  const safeOwner = escapeHtml(ownerName);
  const safeUrl = escapeHtml(url);
  return {
    subject: `${ownerName} sent the move-in walkthrough for ${propertyTitle}`,
    text: `${ownerName} sent you the move-in walkthrough photos for ${propertyTitle}. Review each photo, approve it or request a change, then approve the complete walkthrough here: ${url}`,
    html: `<!doctype html><html><body style="margin:0;background:#f3fbfb;font-family:Inter,Arial,sans-serif;color:#262321"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #d9ecea;border-radius:22px"><tr><td style="padding:30px"><div style="font-size:26px;font-weight:800;color:#178f8a">OneHome</div><div style="margin-top:5px;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#645d57">ARRIENDO CON CONTRATO</div><h1 style="font-size:24px;line-height:1.25;margin:28px 0 14px">Review the move-in walkthrough</h1><p style="font-size:15px;line-height:1.65;color:#5d5752">${safeOwner} sent you the move-in photos for <strong style="color:#262321">${safeTitle}</strong>.</p><p style="font-size:15px;line-height:1.65;color:#5d5752">Review each photo. Mark it as correct or request a change, then approve the complete walkthrough.</p><p style="text-align:center;margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#332C26;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:999px">Review walkthrough</a></p><p style="font-size:12px;line-height:1.55;color:#817a74">If the button does not open, copy this link:<br><a href="${safeUrl}" style="color:#178f8a;word-break:break-all">${safeUrl}</a></p></td></tr></table></td></tr></table></body></html>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET") {
      const token = (new URL(req.url).searchParams.get("t") ?? "").trim();
      if (!validToken(token)) return json({ message: "That walkthrough link is not valid." }, 400);
      const packet = await publicPacket(token);
      return "data" in packet ? json(packet.data) : json({ message: packet.error }, packet.status);
    }

    if (req.method !== "POST") return json({ message: "Method not allowed." }, 405);
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action ?? "");

    if (["owner_packet", "add_item", "update_item", "reorder_items", "delete_item", "cleanup_upload", "confirm_tenant_evidence", "qa_reset"].includes(action)) {
      const auth = await authenticated(req);
      if ("error" in auth) return json({ message: auth.error }, auth.status);
      const ownerToken = String(payload?.owner_token ?? "").trim().toLowerCase();
      const packet = await ownerPacket(auth.userClient, auth.user.id, ownerToken);
      if ("error" in packet) return json({ message: packet.error }, packet.status);
      const handoff = packet.data;

      if (action === "owner_packet") return json(handoff);

      if (action === "add_item") {
        const { data, error } = await auth.userClient.rpc("rental_inspection_item_add_v2", {
          p_inspection_id: handoff.inspection_id,
          p_storage_path: String(payload?.storage_path ?? ""),
          p_original_name: String(payload?.original_name ?? ""),
          p_mime_type: String(payload?.mime_type ?? ""),
          p_byte_size: Number(payload?.byte_size ?? 0),
          p_media_kind: String(payload?.media_kind ?? "image"),
          p_duration_ms: Number(payload?.duration_ms ?? 0) || null,
          p_captured_at: String(payload?.captured_at ?? "") || null,
          p_room: String(payload?.room ?? "") || null,
          p_caption: String(payload?.caption ?? "") || null,
          p_width: Number(payload?.width ?? 0) || null,
          p_height: Number(payload?.height ?? 0) || null,
        });
        if (error) return json({ message: error.message }, error.code === "42501" ? 403 : 400);
        return json(data);
      }

      if (action === "update_item") {
        const { data, error } = await auth.userClient.rpc("rental_inspection_item_update", {
          p_item_id: String(payload?.item_id ?? ""),
          p_room: String(payload?.room ?? "") || null,
          p_caption: String(payload?.caption ?? "") || null,
        });
        if (error) return json({ message: error.message }, error.code === "42501" ? 403 : 400);
        return json(data);
      }

      if (action === "reorder_items") {
        const { data, error } = await auth.userClient.rpc("rental_inspection_items_reorder", {
          p_inspection_id: handoff.inspection_id,
          p_item_ids: Array.isArray(payload?.item_ids) ? payload.item_ids : [],
        });
        if (error) return json({ message: error.message }, error.code === "42501" ? 403 : 400);
        return json({ count: data });
      }

      if (action === "delete_item") {
        const { data: path, error } = await auth.userClient.rpc("rental_inspection_item_delete_v2", {
          p_item_id: String(payload?.item_id ?? ""),
        });
        if (error) return json({ message: error.message }, error.code === "42501" ? 403 : 400);
        const storageErrors = await removeMedia([String(path)]);
        return json({ deleted: true, storage_removed: storageErrors.length === 0, cleanup_warning: storageErrors[0] ?? null });
      }

      if (action === "cleanup_upload") {
        const path = String(payload?.storage_path ?? "");
        if (!path.startsWith(handoff.upload.path_prefix)) return json({ message: "That upload path does not belong to this walkthrough." }, 403);
        const { error } = await service.storage.from("rental-evidence").remove([path]);
        return json({ removed: !error, message: error?.message ?? null }, error ? 400 : 200);
      }

      if (action === "confirm_tenant_evidence") {
        const { data, error } = await auth.userClient.rpc("rental_inspection_confirm_tenant_evidence", {
          p_item_id: String(payload?.item_id ?? ""),
        });
        if (error) return json({ message: error.message }, error.code === "42501" ? 403 : 400);
        return json(Array.isArray(data) ? data[0] : data);
      }

      if (action === "qa_reset") {
        if (!handoff.qa_reset_allowed || handoff.listing_no !== 10518) return json({ message: "Reset is restricted to the marked QA listing 10518." }, 403);
        if (String(payload?.confirm ?? "") !== "RESET 10518") return json({ message: "Type RESET 10518 exactly." }, 400);
        if (String(payload?.claim_id ?? "") !== handoff.claim_id || String(payload?.contract_id ?? "") !== handoff.contract_id) {
          return json({ message: "The reset identifiers changed. Refresh and review them before trying again." }, 409);
        }
        const { data: reset, error: resetError } = await service.rpc("onehome_qa_reset_10518", {
          p_claim_id: handoff.claim_id,
          p_contract_id: handoff.contract_id,
          p_actor_id: auth.user.id,
        });
        if (resetError) return json({ message: resetError.message }, resetError.code === "42501" ? 403 : 400);
        const paths = Array.isArray(reset?.storage_paths) ? reset.storage_paths.map(String) : [];
        const storageErrors = paths.length ? await removeMedia(paths) : [];
        const { error: authDeleteError } = await service.auth.admin.deleteUser(auth.user.id);
        return json({
          listing_no: 10518,
          restored_state: reset?.restored_state,
          removed_storage_objects: storageErrors.length ? 0 : paths.length,
          storage_cleanup_error: storageErrors[0] ?? null,
          qa_account_deleted: !authDeleteError,
          account_cleanup_error: authDeleteError?.message ?? null,
        });
      }
    }

    if (action === "approve") {
      const token = String(payload?.t ?? "").trim();
      if (!validToken(token)) return json({ message: "That walkthrough link is not valid." }, 400);
      const { data, error } = await service.rpc("rental_inspection_approve_all", { p_token: token });
      if (error) return json({ message: error.message }, error.code === "42501" ? 403 : 400);
      return json(Array.isArray(data) ? data[0] : data);
    }

    if (action === "tenant_upload_ticket") {
      const token = String(payload?.t ?? "").trim().toLowerCase();
      const itemId = String(payload?.item_id ?? "").trim();
      const mimeType = String(payload?.mime_type ?? "").trim().toLowerCase();
      const byteSize = Number(payload?.byte_size ?? 0);
      const safeExtensionByMime: Record<string, string> = {
        "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
        "image/heic": "heic", "image/heif": "heif",
      };
      if (!validToken(token) || !/^[0-9a-f-]{36}$/i.test(itemId)) return json({ message: "That walkthrough item is not valid." }, 400);
      if (!IMAGE_MIMES.includes(mimeType) || byteSize < 1 || byteSize > 26214400) return json({ message: "Condition evidence must be a supported photo no larger than 25 MiB." }, 400);
      const extension = safeExtensionByMime[mimeType] ?? "jpg";
      const packet = await publicPacket(token);
      if (!("data" in packet)) return json({ message: packet.error }, packet.status);
      const item = packet.data.items.find((candidate) => candidate.id === itemId);
      if (!item || item.verdict !== "pending" || item.tenant_photo) return json({ message: "Condition-photo upload is closed for this item." }, 403);
      const { data: contract } = await service.from("rental_contracts").select("id").eq("share_token", token).single();
      if (!contract) return json({ message: "That walkthrough link is not valid." }, 404);
      const path = `${contract.id}/tenant-evidence/${itemId}/${crypto.randomUUID()}.${extension}`;
      const { data: signed, error } = await service.storage.from("rental-evidence").createSignedUploadUrl(path, { upsert: false });
      if (error || !signed?.token) return json({ message: "The secure condition-photo upload could not be opened." }, 500);
      return json({ path, token: signed.token, signed_url: signed.signedUrl, expires_in: 7200 });
    }

    if (action === "tenant_cleanup_upload") {
      const token = String(payload?.t ?? "").trim().toLowerCase();
      const itemId = String(payload?.item_id ?? "").trim();
      const path = String(payload?.storage_path ?? "").trim();
      if (!validToken(token) || !/^[0-9a-f-]{36}$/i.test(itemId)) return json({ message: "That walkthrough item is not valid." }, 400);
      const { data: contract } = await service.from("rental_contracts").select("id").eq("share_token", token).single();
      if (!contract || !path.startsWith(`${contract.id}/tenant-evidence/${itemId}/`)) return json({ message: "That condition upload does not belong to this item." }, 403);
      const { data: item } = await service.from("rental_inspection_items")
        .select("verdict, tenant_photo_url, rental_inspections!inner(contract_id, released_at)")
        .eq("id", itemId)
        .eq("rental_inspections.contract_id", contract.id)
        .maybeSingle();
      if (!item || item.verdict !== "pending" || item.tenant_photo_url === path) {
        return json({ message: "Condition-photo cleanup is closed for this item." }, 403);
      }
      await service.storage.from("rental-evidence").remove([path]);
      return json({ removed: true });
    }

    if (action === "respond_item") {
      const token = String(payload?.t ?? "").trim().toLowerCase();
      const itemId = String(payload?.item_id ?? "").trim();
      const verdict = String(payload?.verdict ?? "").trim();
      const note = String(payload?.note ?? "").trim();
      const tenantPhotoPath = String(payload?.tenant_photo_path ?? "").trim();
      if (!validToken(token)) return json({ message: "That walkthrough link is not valid." }, 400);
      if (!/^[0-9a-f-]{36}$/i.test(itemId)) return json({ message: "That walkthrough photo is not valid." }, 400);
      if (!["agreed", "disputed"].includes(verdict)) return json({ message: "Choose Looks right or Request a change." }, 400);
      if (verdict === "disputed" && !note) return json({ message: "Tell the owner what needs to change." }, 400);

      const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip")?.trim() || "";
      const requestFingerprint = await sha256(`${token}:${forwardedFor}:${req.headers.get("user-agent") || ""}`);
      const { data, error } = await service.rpc("rental_inspection_respond_v2", {
        p_token: token,
        p_item_id: itemId,
        p_verdict: verdict,
        p_note: note || null,
        p_tenant_photo_path: tenantPhotoPath || null,
        p_tenant_photo_original_name: String(payload?.tenant_photo_original_name ?? "") || null,
        p_tenant_photo_captured_at: String(payload?.tenant_photo_captured_at ?? "") || null,
        p_request_fingerprint: requestFingerprint,
      });
      if (error) return json({ message: error.message }, error.code === "42501" ? 403 : 400);

      const { data: contract } = await service.from("rental_contracts")
        .select("id, agent_id").eq("share_token", token).maybeSingle();
      if (contract?.agent_id) {
        try {
          await service.rpc("notify_rental", {
            p_user: contract.agent_id,
            p_type: verdict === "disputed" ? "rental_inspection_change_requested" : "rental_inspection_photo_approved",
            p_title: verdict === "disputed" ? "A walkthrough photo needs a change" : "A walkthrough photo was approved",
            p_body: verdict === "disputed" ? note : "The tenant marked one move-in photo as correct.",
            p_url: `/rentals/c/${contract.id}`,
          });
        } catch (_) { /* A saved response must survive a notification outage. */ }
      }
      const result = Array.isArray(data) ? data[0] : data;
      return json({ ...result, responded_at: new Date().toISOString() });
    }

    if (action === "claim_payment") {
      const token = String(payload?.t ?? "").trim();
      const rail = String(payload?.rail ?? "").trim().toLowerCase();
      const reference = String(payload?.reference ?? "").trim();
      const note = String(payload?.note ?? "").trim();
      if (!validToken(token)) return json({ message: "That walkthrough link is not valid." }, 400);
      const { data, error } = await service.rpc("rental_payment_claim_by_token", {
        p_token: token,
        p_rail: rail,
        p_reference: reference || null,
        p_note: note || null,
      });
      if (error) return json({ message: error.message }, error.code === "42501" ? 403 : 400);
      const claimed = Array.isArray(data) ? data[0] : data;
      return json({
        contract_id: claimed?.contract_id,
        payment_claimed_at: claimed?.claimed_at,
        payment_rail: rail,
        payment_reference: reference || null,
        payment_note: note || null,
      });
    }

    if (action === "send") {
      const authorization = req.headers.get("authorization") ?? "";
      const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) return json({ message: "Sign in before sending the walkthrough." }, 401);
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
      if (authError || !authData.user) return json({ message: "Your session expired. Sign in again." }, 401);

      const inspectionId = String(payload?.inspection_id ?? "");
      const recipientEmail = String(payload?.recipient_email ?? "").trim().toLowerCase();
      if (recipientEmail && !validEmail(recipientEmail)) return json({ message: "Enter a valid email address." }, 400);

      const { data: rows, error: sendError } = await userClient.rpc("rental_inspection_send_v2", {
        p_inspection_id: inspectionId,
      });
      if (sendError) return json({ message: sendError.message }, sendError.code === "42501" ? 403 : 400);
      const handoff = Array.isArray(rows) ? rows[0] : rows;
      if (!handoff?.share_token) return json({ message: "The walkthrough link could not be created." }, 500);

      const shareUrl = `${SITE_URL}/rentals/inspection/${handoff.share_token}`;
      let messageSent = false;
      let conversationId: string | null = null;
      if (!recipientEmail) {
        const { data: contract } = await service.from("rental_contracts")
          .select("agent_id, tenant_id, conversation_id")
          .eq("id", handoff.contract_id).maybeSingle();
        if (contract?.tenant_id && contract.tenant_id !== contract.agent_id) {
          conversationId = contract.conversation_id ?? null;
          if (!conversationId) {
            const { data: existing } = await service.from("conversations")
              .select("id").contains("participant_ids", [contract.agent_id, contract.tenant_id])
              .eq("category", "rentals").limit(1);
            conversationId = existing?.[0]?.id ?? null;
          }
          if (!conversationId) {
            const { data: made } = await service.from("conversations").insert({
              participant_ids: [contract.agent_id, contract.tenant_id],
              category: "rentals",
              metadata: { contract_id: handoff.contract_id },
            }).select("id").single();
            conversationId = made?.id ?? null;
          }
          if (conversationId) {
            const preview = `Move-in walkthrough: ${handoff.property_title || "OneHome"} — ${shareUrl}`;
            const { error: messageError } = await service.from("messages").insert({
              conversation_id: conversationId,
              sender_id: authData.user.id,
              content: preview,
              message_type: "text",
              metadata: { contract_id: handoff.contract_id, inspection_id: handoff.inspection_id, share_url: shareUrl, product: "onehome" },
            });
            if (!messageError) {
              await service.from("conversations").update({ last_message_text: preview, last_message_at: new Date().toISOString() }).eq("id", conversationId);
              await service.from("rental_contracts").update({ conversation_id: conversationId }).eq("id", handoff.contract_id);
              messageSent = true;
            }
          }
        }
      }
      let emailQueued = false;
      if (recipientEmail) {
        const { data: owner } = await service.from("profiles")
          .select("full_name").eq("id", authData.user.id).maybeSingle();
        const ownerName = owner?.full_name || "The property owner";
        const bodies = emailBodies(handoff.property_title || "your OneHome", ownerName, shareUrl);
        const { data: outbound, error: queueError } = await service.from("outbound_messages").insert({
          channel: "email",
          to_address: recipientEmail,
          to_name: null,
          subject: bodies.subject,
          body_text: bodies.text,
          body_html: bodies.html,
          template: "onehome-walkthrough",
          context: { contract_id: handoff.contract_id, inspection_id: handoff.inspection_id },
          status: "queued",
          attempts: 0,
          created_by: authData.user.id,
          from_name: "OneHome",
        }).select("id").single();
        if (queueError || !outbound) return json({ message: "The photos are ready, but the email could not be queued. Use Share link instead." }, 500);
        emailQueued = true;

        // Immediate handoff when available. A failure here leaves the durable queued row for the worker.
        await fetch(`${SUPABASE_URL}/functions/v1/outbound-dispatch`, {
          method: "POST",
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
          body: JSON.stringify({ id: outbound.id }),
        }).catch(() => null);
      }

      return json({
        inspection_id: handoff.inspection_id,
        state: handoff.inspection_state,
        media_count: handoff.media_count,
        release_reason: handoff.release_reason,
        released_at: handoff.released_at,
        share_url: shareUrl,
        message_sent: messageSent,
        conversation_id: conversationId,
        email_queued: emailQueued,
      });
    }

    return json({ message: "Unknown action." }, 400);
  } catch (error) {
    console.error("rental-inspection failed", error);
    return json({ message: "Something went wrong. Please try again." }, 500);
  }
});
