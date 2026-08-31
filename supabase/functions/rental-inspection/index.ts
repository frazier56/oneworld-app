// rental-inspection — secure public photo packet plus authenticated owner delivery.
// A 48-hex contract token is the tenant capability. Raw storage paths never leave this function.

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
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]!));

async function publicPacket(token: string) {
  const { data: contract, error: contractError } = await service
    .from("rental_contracts")
    .select("id, property_id, agent_id, status, inspection_order, share_token, rent_amount, currency, first_payment_claimed_at, first_payment_rail, first_payment_reference, first_payment_claim_note")
    .eq("share_token", token.toLowerCase())
    .maybeSingle();
  if (contractError || !contract) return { error: "That walkthrough link is not valid.", status: 404 };

  const inspectionOpen = contract.inspection_order === "inspect_first"
    || (contract.inspection_order === "pay_first" && ["active", "ended"].includes(contract.status));
  if (!inspectionOpen) return { error: "The move-in photos are not open yet.", status: 403 };

  const [{ data: inspection }, { data: property }, { data: owner }] = await Promise.all([
    service.from("rental_inspections")
      .select("id, state, kind, round, sent_at, settled_at")
      .eq("contract_id", contract.id).eq("kind", "move_in")
      .order("round", { ascending: false }).limit(1).maybeSingle(),
    service.from("rental_properties")
      .select("title, listing_no, city, neighbourhood")
      .eq("id", contract.property_id).maybeSingle(),
    service.from("profiles").select("full_name").eq("id", contract.agent_id).maybeSingle(),
  ]);
  if (!inspection || inspection.state === "draft") {
    return { error: "The owner has not sent these photos yet.", status: 403 };
  }

  const { data: rows, error: itemError } = await service
    .from("rental_inspection_items")
    .select("id, ordinal, photo_url, host_note, verdict, responded_at")
    .eq("inspection_id", inspection.id)
    .order("ordinal", { ascending: true });
  if (itemError) return { error: "The walkthrough could not be opened.", status: 500 };

  const paths = (rows ?? []).map((row) => row.photo_url).filter((path) => !/^https?:/i.test(path));
  const signedByPath: Record<string, string> = {};
  if (paths.length) {
    const { data: signed, error: signError } = await service.storage
      .from("rental-evidence").createSignedUrls(paths, 3600);
    if (signError) return { error: "The walkthrough photos could not be opened.", status: 500 };
    for (const item of signed ?? []) if (item.signedUrl) signedByPath[String(item.path)] = item.signedUrl;
  }

  return {
    status: 200,
    data: {
      inspection_id: inspection.id,
      state: inspection.state,
      sent_at: inspection.sent_at,
      approved_at: inspection.settled_at,
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
        verdict: row.verdict,
        photo_url: /^https?:/i.test(row.photo_url) ? row.photo_url : signedByPath[row.photo_url] ?? null,
      })),
    },
  };
}

function emailBodies(propertyTitle: string, ownerName: string, url: string) {
  const safeTitle = escapeHtml(propertyTitle);
  const safeOwner = escapeHtml(ownerName);
  const safeUrl = escapeHtml(url);
  return {
    subject: `${ownerName} sent the move-in walkthrough for ${propertyTitle}`,
    text: `${ownerName} sent you the move-in walkthrough photos for ${propertyTitle}. Review every photo and approve the set here: ${url}`,
    html: `<!doctype html><html><body style="margin:0;background:#f3fbfb;font-family:Inter,Arial,sans-serif;color:#262321"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #d9ecea;border-radius:22px"><tr><td style="padding:30px"><div style="font-size:26px;font-weight:800;color:#178f8a">OneHome</div><div style="margin-top:5px;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#645d57">ARRIENDO CON CONTRATO</div><h1 style="font-size:24px;line-height:1.25;margin:28px 0 14px">Review the move-in walkthrough</h1><p style="font-size:15px;line-height:1.65;color:#5d5752">${safeOwner} sent you the move-in photos for <strong style="color:#262321">${safeTitle}</strong>.</p><p style="font-size:15px;line-height:1.65;color:#5d5752">Review every photo, then use the one approval button to confirm the complete set.</p><p style="text-align:center;margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#332C26;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:999px">Review walkthrough</a></p><p style="font-size:12px;line-height:1.55;color:#817a74">If the button does not open, copy this link:<br><a href="${safeUrl}" style="color:#178f8a;word-break:break-all">${safeUrl}</a></p></td></tr></table></td></tr></table></body></html>`,
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

    if (action === "approve") {
      const token = String(payload?.t ?? "").trim();
      if (!validToken(token)) return json({ message: "That walkthrough link is not valid." }, 400);
      const { data, error } = await service.rpc("rental_inspection_approve_all", { p_token: token });
      if (error) return json({ message: error.message }, error.code === "42501" ? 403 : 400);
      return json(Array.isArray(data) ? data[0] : data);
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

      const { data: rows, error: sendError } = await userClient.rpc("rental_inspection_send", {
        p_inspection_id: inspectionId,
      });
      if (sendError) return json({ message: sendError.message }, sendError.code === "42501" ? 403 : 400);
      const handoff = Array.isArray(rows) ? rows[0] : rows;
      if (!handoff?.share_token) return json({ message: "The walkthrough link could not be created." }, 500);

      const shareUrl = `${SITE_URL}/rentals/inspection/${handoff.share_token}`;
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
        photo_count: handoff.photo_count,
        share_url: shareUrl,
        email_queued: emailQueued,
      });
    }

    return json({ message: "Unknown action." }, 400);
  } catch (error) {
    console.error("rental-inspection failed", error);
    return json({ message: "Something went wrong. Please try again." }, 500);
  }
});
