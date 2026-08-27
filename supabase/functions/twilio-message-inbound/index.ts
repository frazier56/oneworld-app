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
    const payload = fields.reduce((combined, [field, value]) => combined + field + value, candidateUrl);
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
    .eq("name", "twilio_oneevent")
    .maybeSingle();
  if (!data?.enabled || !data.token_sha256) return false;
  return (await sha256Hex(supplied)) === data.token_sha256;
}

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);
const START_WORDS = new Set(["START", "UNSTOP"]);

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
  const rawFrom = String(payload.From || "");
  const channel = /^whatsapp:/i.test(rawFrom) ? "whatsapp" : "sms";
  const fromAddress = rawFrom.replace(/^whatsapp:/i, "");
  const toAddress = String(payload.To || "").replace(/^whatsapp:/i, "");
  const body = String(payload.Body || "").trim();
  const keyword = String(payload.OptOutType || body).trim().toUpperCase();

  if (!fromAddress) return new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } });

  await admin.from("event_message_inbound_events").insert({
    provider_message_id: payload.MessageSid || payload.SmsSid || null,
    channel,
    from_address: fromAddress,
    to_address: toAddress || null,
    body: body || null,
    optout_type: payload.OptOutType || null,
    payload,
  });

  if (keyword === "STOP" || STOP_WORDS.has(keyword)) {
    await admin.from("contact_optouts").upsert({
      channel,
      address: fromAddress,
      destination: fromAddress,
      source: "twilio_inbound",
      raw_message: body || keyword,
      host_id: null,
      opted_out_at: new Date().toISOString(),
      metadata: { provider: "twilio", to: toAddress || null },
    }, { onConflict: "channel,address" });
  } else if (keyword === "START" || START_WORDS.has(keyword)) {
    await admin.from("contact_optouts").delete().eq("channel", channel).eq("address", fromAddress);
  }

  return new Response("<Response/>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
});
