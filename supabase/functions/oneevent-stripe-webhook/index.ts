/**
 * oneevent-stripe-webhook — durable ticket fulfillment for paid direct checkout.
 *
 * Stripe calls this endpoint after Checkout completes. It verifies the raw-body
 * signature, claims the Stripe event idempotently, and creates the registration
 * through a server-only transactional RPC. Application-gated/manual-capture
 * purchases remain owned by the existing approval + recovery workflow.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const response = (message: string, status = 200, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ received: status < 300, message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function signingSecret(): Promise<string | null> {
  const envSecret = Deno.env.get("ONEEVENT_STRIPE_WEBHOOK_SECRET");
  if (envSecret) return envSecret;

  const { data, error } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("key", "oneevent_stripe_webhook_secret")
    .maybeSingle();
  if (error) throw error;
  return data?.value || null;
}

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < signature.length; index++) {
      difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
    }
    return difference === 0;
  });
}

const claimId = (eventId: string) => `oneevent:${eventId}`;

async function releaseClaim(eventId: string) {
  const { error } = await supabase
    .from("stripe_webhook_events")
    .delete()
    .eq("event_id", claimId(eventId));
  if (error) console.error("[ONEEVENT-WEBHOOK] Could not release retry claim", eventId, error);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response("method not allowed", 405);

  const payload = await req.text();
  const signatureHeader = req.headers.get("stripe-signature") || "";

  let secret: string | null;
  try {
    secret = await signingSecret();
  } catch (error) {
    console.error("[ONEEVENT-WEBHOOK] Signing-secret lookup failed", error);
    return response("webhook configuration unavailable", 500);
  }
  if (!secret) {
    console.error("[ONEEVENT-WEBHOOK] ONEEVENT_STRIPE_WEBHOOK_SECRET is not configured");
    return response("webhook signing secret not configured", 500);
  }
  if (!(await verifyStripeSignature(payload, signatureHeader, secret))) {
    return response("invalid signature", 400);
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(payload);
  } catch {
    return response("invalid JSON", 400);
  }

  const eventId = String(event.id || "");
  const eventType = String(event.type || "");
  if (!eventId) return response("missing Stripe event id", 400);

  const session = event.data?.object || {};
  const metadata = session.metadata || {};
  const oneEventId = metadata.onesocial_event_id;

  // A dedicated Stripe destination may send more than the two subscribed event
  // types during configuration tests. Acknowledge irrelevant events without
  // consuming the shared idempotency ledger.
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(eventType)) {
    return response("ignored event type");
  }
  if (!oneEventId) return response("ignored non-OneEvent checkout");

  // Application/manual-capture payments are intentionally handled by
  // verify-event-payment + event-application-recovery, which preserve approval.
  if (metadata.onesocial_application_id) {
    return response("application checkout owned by approval workflow");
  }
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return response("checkout is not paid", 409);
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || "";
  if (!paymentIntentId) return response("missing payment intent", 500);

  const { error: claimError } = await supabase
    .from("stripe_webhook_events")
    .insert({ event_id: claimId(eventId), event_type: eventType });
  if (claimError?.code === "23505") return response("duplicate event ignored");
  if (claimError) {
    console.error("[ONEEVENT-WEBHOOK] Idempotency claim failed", claimError);
    return response("idempotency unavailable", 500);
  }

  try {
    const quantity = Number.parseInt(metadata.onesocial_quantity || "1", 10);
    const ticketAmount = Number.parseInt(metadata.onesocial_ticket_amount || "0", 10) / 100;
    const platformFee = Number.parseInt(metadata.onesocial_platform_fee || "0", 10) / 100;
    const userId = metadata.onesocial_user_id || null;
    const paidAt = event.created
      ? new Date(Number(event.created) * 1000).toISOString()
      : new Date().toISOString();
    const qrIdentity = userId || metadata.onesocial_guest_email || "guest";
    const qrCode = `OS-EVT-${String(oneEventId).slice(0, 8)}-${String(qrIdentity).slice(0, 8)}-${String(session.id).slice(-8)}`;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("Invalid ticket quantity in Stripe metadata");
    }
    if (!Number.isFinite(ticketAmount) || !Number.isFinite(platformFee)) {
      throw new Error("Invalid payment amounts in Stripe metadata");
    }
    const expectedTotalCents = Math.round((ticketAmount + platformFee) * 100);
    if (
      typeof session.amount_total === "number" &&
      session.amount_total !== expectedTotalCents
    ) {
      throw new Error("Stripe total does not match the immutable order metadata");
    }

    const { data: registrationId, error: fulfillmentError } = await supabase.rpc(
      "fulfill_direct_event_checkout",
      {
        p_event_id: oneEventId,
        p_user_id: userId,
        p_guest_name: metadata.onesocial_guest_name || null,
        p_guest_email: metadata.onesocial_guest_email || null,
        p_guest_phone: metadata.onesocial_guest_phone || null,
        p_quantity: quantity,
        p_ticket_type: metadata.onesocial_ticket_type || "ga",
        p_ticket_amount: ticketAmount,
        p_platform_fee: platformFee,
        p_currency: String(session.currency || "USD").toUpperCase(),
        p_paid_at: paidAt,
        p_stripe_session_id: session.id,
        p_payment_intent_id: paymentIntentId,
        p_qr_code: qrCode,
      },
    );
    if (fulfillmentError || !registrationId) {
      throw new Error(fulfillmentError?.message || "Ticket fulfillment returned no registration");
    }

    console.log(
      `[ONEEVENT-WEBHOOK] Fulfilled registration ${registrationId} from session ${session.id}`,
    );
    return response("ticket fulfilled", 200, { registrationId });
  } catch (error) {
    console.error("[ONEEVENT-WEBHOOK] Processing failed; releasing claim for Stripe retry", error);
    await releaseClaim(eventId);
    return response("ticket fulfillment failed", 500);
  }
});
