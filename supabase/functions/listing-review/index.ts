// listing-review — capability-token resolver for the public owner-review screen.
// v4 enriches the safe packet with the fields rendered by PropertyDetailComposition.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLATFORM_TERMS_VERSION = "oneworld-platform-owner-review-2026-09-01";
const PROPERTY_TERMS_VERSION = "onehome-property-owner-review-draft-2026-09-03-v4";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });

async function rpc(fn: string, body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep raw response */ }
  return { ok: response.ok, status: response.status, parsed };
}

async function listingExtras(id: string) {
  const params = new URLSearchParams({
    select: [
      "price_unit", "display_currency", "display_fx_rate",
      "deposit_required", "deposit_amount", "max_guests", "min_term_days",
      "bill_interval_count", "created_at", "updated_at", "allow_public_share",
      "move_in_fee", "move_in_fee_note", "videos",
      "guarantee_kind", "liability_attested", "liability_insurer", "liability_amount_usd",
    ].join(","),
    id: `eq.${id}`,
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rental_properties?${params}`, {
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!response.ok) return {};
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : {};
}

function friendly(parsed: any): { code: string; message: string } {
  const raw = String(parsed?.message ?? "");
  if (/already been approved/i.test(raw)) return { code: "already_approved", message: "This listing has already been approved." };
  if (/has expired/i.test(raw)) return { code: "expired", message: "This link has expired." };
  if (/not recognised/i.test(raw)) return { code: "not_found", message: "We do not recognise this link." };
  if (/type your name/i.test(raw)) return { code: "name_required", message: "Please type your name." };
  if (/what needs changing/i.test(raw)) return { code: "note_required", message: "Please say what needs changing." };
  if (/platform terms separately/i.test(raw)) return { code: "platform_terms_required", message: "Review and accept the OneWorld / OneHome platform terms separately." };
  if (/property-owner supplemental terms separately/i.test(raw)) return { code: "property_terms_required", message: "Review and acknowledge the property-owner supplemental terms separately." };
  if (/terms version changed/i.test(raw)) return { code: "terms_changed", message: "The terms snapshot changed. Refresh and review it again." };
  if (/not ready for acknowledgement/i.test(raw)) {
    return { code: "already_claimed", message: "This invitation has already been used. Ask the sender for a new invitation." };
  }
  if (/restricted to the current owner handoff listings/i.test(raw)) {
    return { code: "handoff_not_enabled", message: "This owner invitation is not enabled for account creation. Ask the sender for a new invitation." };
  }
  return { code: "error", message: "Something went wrong. Please try again." };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (req.method === "GET") {
      const token = (new URL(req.url).searchParams.get("t") || "").trim();
      if (!token) return json({ code: "not_found", message: "We do not recognise this link." }, 400);
      const result = await rpc("rental_listing_review_packet", { p_token: token });
      if (!result.ok) return json(friendly(result.parsed), result.status === 404 ? 404 : 400);
      if (result.parsed?.listing?.id && !result.parsed?.expired) {
        result.parsed.listing = {
          ...result.parsed.listing,
          ...(await listingExtras(result.parsed.listing.id)),
        };
      }
      result.parsed.terms = {
        platform_version: PLATFORM_TERMS_VERSION,
        property_version: PROPERTY_TERMS_VERSION,
        separate_acceptance_required: true,
        property_terms_are_review_draft: true,
      };
      return json(result.parsed);
    }

    if (req.method === "POST") {
      let payload: any = {};
      try { payload = await req.json(); } catch { /* handled below */ }
      const token = String(payload?.t ?? "").trim();
      const decision = String(payload?.decision ?? "");
      const action = String(payload?.action ?? "review");
      const name = String(payload?.name ?? "");
      const note = String(payload?.note ?? "");
      const platformTermsAccepted = payload?.platform_terms_accepted === true;
      const propertyTermsAccepted = payload?.property_terms_accepted === true;
      const locale = String(payload?.locale ?? "en");

      if (!token) return json({ code: "not_found", message: "We do not recognise this link." }, 400);
      if (name.trim().length < 2) return json({ code: "name_required", message: "Please type your name." }, 400);
      if (decision === "changes_requested" && note.trim() === "") {
        return json({ code: "note_required", message: "Please say what needs changing." }, 400);
      }
      if (decision === "approved" && !platformTermsAccepted) {
        return json({ code: "platform_terms_required", message: "Review and accept the OneWorld / OneHome platform terms separately." }, 400);
      }
      if (decision === "approved" && !propertyTermsAccepted) {
        return json({ code: "property_terms_required", message: "Review and acknowledge the property-owner supplemental terms separately." }, 400);
      }

      const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("cf-connecting-ip")?.trim()
        || "";
      const ipHash = forwardedFor ? await sha256(`${token}:${forwardedFor}`) : null;

      if (action === "acknowledge_existing_approval") {
        const result = await rpc("rental_owner_terms_acknowledge_existing", {
          p_token: token,
          p_name: name,
          p_platform_terms_accepted: platformTermsAccepted,
          p_property_terms_accepted: propertyTermsAccepted,
          p_platform_terms_version: String(payload?.platform_terms_version ?? PLATFORM_TERMS_VERSION),
          p_property_terms_version: String(payload?.property_terms_version ?? PROPERTY_TERMS_VERSION),
          p_locale: locale,
          p_ip_hash: ipHash,
          p_user_agent: req.headers.get("user-agent") || null,
        });
        if (!result.ok) return json(friendly(result.parsed), 400);
        return json(result.parsed);
      }

      const result = await rpc("rental_listing_review_submit", {
        p_token: token,
        p_decision: decision,
        p_name: name,
        p_note: note,
        p_platform_terms_accepted: platformTermsAccepted,
        p_property_terms_accepted: propertyTermsAccepted,
        p_platform_terms_version: String(payload?.platform_terms_version ?? PLATFORM_TERMS_VERSION),
        p_property_terms_version: String(payload?.property_terms_version ?? PROPERTY_TERMS_VERSION),
        p_locale: locale,
        p_ip_hash: ipHash,
        p_user_agent: req.headers.get("user-agent") || null,
      });
      if (!result.ok) return json(friendly(result.parsed), 400);
      return json(result.parsed);
    }

    return json({ code: "method_not_allowed", message: "Method not allowed." }, 405);
  } catch {
    return json({ code: "error", message: "Something went wrong. Please try again." }, 500);
  }
});
