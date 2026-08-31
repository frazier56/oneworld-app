/**
 * create-event-checkout — Creates a Stripe Checkout session for paid event tickets.
 * Free events bypass this entirely (handled client-side).
 * Adds 5.99% platform fee on top of ticket price.
 *
 * FOUNDER100 test code (Lee, Jul 23 2026): charge a flat $1 real transaction (so the
 * full Stripe flow is exercised) and skip the Connect fee-split for that purchase.
 * returnOrigin (client-supplied, includes the app base path like /oneevents-preview)
 * is used for success/cancel URLs so Stripe returns INTO the app, not the root domain
 * (which fell through to the old One World Labs homepage).
 *
 * v34 (31 Aug 2026): validate and price against the host-only
 * event_discount_codes list, while retaining the legacy single-code fallback.
 */
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const FOUNDER_IMMEDIATE_DOLLAR_CODES = new Set(["founder0002", "founder100"]);
const FOUNDER_APPROVAL_DOLLAR_CODE = "founder0003";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "Stripe not configured" }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authClient = createClient(supabaseUrl, supabaseAnon);
  const serviceClient = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { eventId, ticketType, quantity, guestName, guestEmail, guestPhone, applicationId, promoCode, returnOrigin, validateOnly } = body;

    // Keep the documented founder code and its legacy alias on the identical
    // server-enforced $1 Stripe path. The client must never show a $1 total
    // while the server silently creates a full-price Checkout Session.
    const normalizedPromoCode = typeof promoCode === "string" ? promoCode.trim().toLowerCase() : "";
    const isFounderImmediateTest = FOUNDER_IMMEDIATE_DOLLAR_CODES.has(normalizedPromoCode);
    const isFounderApprovalTest = normalizedPromoCode === FOUNDER_APPROVAL_DOLLAR_CODE;
    const isFounderDollarTest = isFounderImmediateTest || isFounderApprovalTest;

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user }, error: authErr } = await authClient.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (!authErr && user) {
        userId = user.id;
        userEmail = user.email || null;
      }
    }

    if (!userId && !validateOnly) {
      if (!guestEmail || !guestName || !guestPhone) {
        return json({ error: "Guest checkout requires name, email, and phone number" }, 400);
      }
      userEmail = guestEmail;
    }

    if (!eventId || (!validateOnly && (!ticketType || !quantity))) {
      return json({ error: "Missing required fields: eventId, ticketType, quantity" }, 400);
    }

    const qty = validateOnly ? 1 : Math.max(1, Math.min(10, parseInt(quantity)));

    const { data: event, error: eventErr } = await serviceClient
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventErr || !event) return json({ error: "Event not found" }, 404);

    const { data: matchedDiscountCode, error: matchedDiscountError } = normalizedPromoCode
      ? await serviceClient
          .from("event_discount_codes")
          .select("code, discount_percent")
          .eq("event_id", eventId)
          .eq("code", normalizedPromoCode.toUpperCase())
          .maybeSingle()
      : { data: null, error: null };

    if (matchedDiscountError) throw matchedDiscountError;

    const normalizedEventPromo = String(event.discount_code || "").trim().toLowerCase();
    const legacyEventPromoPercent = Math.max(0, Math.min(100, Number(event.discount_percent || 0)));
    const matchedPromoPercent = Math.max(0, Math.min(100, Number(matchedDiscountCode?.discount_percent || 0)));
    const matchesLegacyEventPromo =
      !!normalizedPromoCode &&
      normalizedPromoCode === normalizedEventPromo &&
      legacyEventPromoPercent > 0;
    const eventPromoPercent = matchedPromoPercent || (matchesLegacyEventPromo ? legacyEventPromoPercent : 0);
    const isEventPromo = !!normalizedPromoCode && eventPromoPercent > 0;
    const isFullyDiscountedEventPromo = isEventPromo && eventPromoPercent === 100;

    if (
      normalizedPromoCode &&
      !isFounderDollarTest &&
      !["founder0001", "demo0001"].includes(normalizedPromoCode) &&
      !isEventPromo
    ) {
      return json({ error: "That code isn't valid for this event.", code: "invalid_promo_code" }, 400);
    }

    if (validateOnly) {
      if (!normalizedPromoCode) {
        return json({ error: "Enter a discount code.", code: "promo_code_required" }, 400);
      }
      const isLegacyFreeTest = ["founder0001", "demo0001"].includes(normalizedPromoCode);
      return json({
        valid: true,
        code: normalizedPromoCode.toUpperCase(),
        discountPercent: isLegacyFreeTest ? 100 : eventPromoPercent,
        mode: isFounderDollarTest ? "dollar" : (isLegacyFreeTest ? "free" : "event"),
      });
    }

    const isApplicationGated = !!(
      event.requires_application &&
      event.application_requires_approval &&
      !isFounderImmediateTest
    );

    if (isFounderApprovalTest && !(
      event.requires_application &&
      event.application_requires_approval &&
      applicationId
    )) {
      return json({
        error: "FOUNDER0003 is only for testing a submitted application that requires host approval.",
        code: "founder_approval_test_requires_application",
      }, 409);
    }

    if (isApplicationGated && !applicationId) {
      return json({
        error: "Complete the event application before authorizing payment.",
        code: "application_required",
      }, 409);
    }

    if (applicationId) {
      if (!userId || !userEmail) {
        return json({
          error: "Sign in with the email used on the application to continue.",
          code: "application_sign_in_required",
        }, 401);
      }

      const { data: application, error: applicationErr } = await serviceClient
        .from("event_applications")
        .select("id, event_id, applicant_user_id, applicant_email, ticket_type, quantity, payment_status, approval_status, promo_code")
        .eq("id", applicationId)
        .maybeSingle();

      if (applicationErr || !application || application.event_id !== eventId) {
        return json({ error: "Application not found for this event" }, 404);
      }
      if (String(application.applicant_email || "").trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
        return json({ error: "This application belongs to a different account" }, 403);
      }
      if (application.applicant_user_id && application.applicant_user_id !== userId) {
        return json({ error: "This application belongs to a different account" }, 403);
      }
      if (["paid", "authorized"].includes(String(application.payment_status || "").toLowerCase())) {
        return json({
          error: application.payment_status === "paid"
            ? "This registration is already paid"
            : "This card is already authorized and awaiting the host",
          code: `application_${application.payment_status}`,
        }, 409);
      }
      if (application.ticket_type !== ticketType || Number(application.quantity || 1) !== qty) {
        return json({ error: "Ticket details do not match the saved application" }, 409);
      }

      const { error: claimErr } = await serviceClient
        .from("event_applications")
        .update({ applicant_user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", applicationId)
        .eq("event_id", eventId)
        .is("applicant_user_id", null);
      if (claimErr) throw claimErr;

      if (isFullyDiscountedEventPromo && isApplicationGated) {
        const { error: promoApplicationError } = await serviceClient
          .from("event_applications")
          .update({
            promo_code: normalizedPromoCode,
            payment_status: "complimentary",
            host_visible_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", applicationId)
          .eq("event_id", eventId)
          .eq("applicant_user_id", userId);
        if (promoApplicationError) throw promoApplicationError;

        return json({
          pending: true,
          free: true,
          promo: true,
          message: "Your request is ready for the host to review. No payment is needed.",
        });
      }
    }

    const { data: hostConnect } = await serviceClient
      .from("stripe_connect_accounts")
      .select("stripe_account_id, payouts_enabled, charges_enabled")
      .eq("user_id", event.host_id)
      .maybeSingle();

    if (!isFounderDollarTest && !isFullyDiscountedEventPromo && (!hostConnect?.stripe_account_id || !hostConnect.charges_enabled || !hostConnect.payouts_enabled)) {
      return json({
        error: "This event's host hasn't finished setting up payouts yet. Please check back shortly or contact the host.",
        code: "host_payouts_not_ready",
      }, 409);
    }

    const gaPrice = event.ga_ticket_price || event.ticket_price || 0;
    const vipPrice = event.vip_ticket_price || 0;
    const unitPrice = ticketType === "vip" ? vipPrice : gaPrice;

    if (unitPrice <= 0) {
      return json({ error: "This is a free event — no payment needed" }, 400);
    }

    if (ticketType === "vip") {
      const remaining = Math.max(0, (event.vip_ticket_qty || 0) - (event.vip_sold || 0));
      if (qty > remaining) return json({ error: `Only ${remaining} VIP tickets remaining` }, 400);
    } else {
      const remaining = Math.max(0, (event.ga_ticket_qty || event.max_attendees || 9999) - (event.ga_sold || 0));
      if (qty > remaining) return json({ error: `Only ${remaining} tickets remaining` }, 400);
    }

    if (userId) {
      const { data: existing } = await serviceClient
        .from("event_registrations")
        .select("id, status, payment_status, amount_paid, registration_source")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .limit(1);

      const current = existing?.[0];
      const isConfirmedAdmission = !!current &&
        ["registered", "checked_in"].includes(String(current.status || "").toLowerCase()) &&
        (
          ["paid", "free", "complimentary", "promo"].includes(String(current.payment_status || "").toLowerCase()) ||
          ["free", "complimentary", "promo"].includes(String(current.registration_source || "").toLowerCase()) ||
          Number(current.amount_paid || 0) > 0
        );

      // A cancelled or incomplete row is not an admission. Let the buyer retry and let
      // verify-event-payment hydrate that exact row with the new Stripe attempt IDs.
      if (isConfirmedAdmission) {
        return json({ error: "You are already registered for this event", alreadyRegistered: true }, 409);
      }
    }

    if (isFullyDiscountedEventPromo) {
      const qrCode = `OS-EVT-${eventId.slice(0, 8)}-${(userId || guestEmail || "guest").slice(0, 8)}-${Date.now()}`;
      const registrationPayload = {
        event_id: eventId,
        user_id: userId,
        guest_name: userId ? null : guestName,
        guest_email: userId ? null : guestEmail,
        guest_phone: userId ? null : guestPhone,
        status: "registered",
        qr_code: qrCode,
        qr_valid: true,
        quantity: qty,
        ticket_type: ticketType,
        registration_source: "promo",
        payment_status: "complimentary",
        amount_paid: 0,
        amount_paid_cents: 0,
        platform_fee_paid: 0,
        currency: String(event.currency || "USD").toUpperCase(),
        paid_at: null,
        application_id: applicationId || null,
      };

      const { data: registration, error: registrationError } = await serviceClient
        .from("event_registrations")
        .insert(registrationPayload)
        .select("id, claim_token")
        .single();
      if (registrationError) {
        if (registrationError.code === "23505") {
          return json({ error: "You are already registered for this event", alreadyRegistered: true }, 409);
        }
        throw registrationError;
      }

      return json({
        free: true,
        promo: true,
        registrationId: registration.id,
        claimToken: registration.claim_token || null,
      });
    }

    var ticketAmountCents = Math.round(unitPrice * 100) * qty;
    if (isEventPromo) {
      ticketAmountCents = Math.max(1, Math.round(ticketAmountCents * (100 - eventPromoPercent) / 100));
    }
    var PLATFORM_FEE_RATE = 0.0599;
    var platformFeeCents = Math.round(ticketAmountCents * PLATFORM_FEE_RATE);
    var totalCents = ticketAmountCents + platformFeeCents;

    if (isFounderDollarTest) {
      // Founder test codes: flat $1 real transaction, without changing host payout totals.
      ticketAmountCents = 100;
      platformFeeCents = 0;
      totalCents = 100;
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: userEmail!, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: userEmail!,
        metadata: {
          ...(userId ? { onesocial_user_id: userId } : {}),
          ...(guestName ? { guest_name: guestName } : {}),
          ...(guestPhone ? { guest_phone: guestPhone } : {}),
        },
      });
      customerId = customer.id;
    }

    const reqOrigin = req.headers.get("origin") || "https://oneworldlabs.ai";
    const origin = (typeof returnOrigin === "string" && /^https?:\/\//.test(returnOrigin)) ? returnOrigin.replace(/\/$/, "") : reqOrigin;
    const ticketLabel = ticketType === "vip" ? "VIP Access" : "General Admission";

    const requiresApproval = !!(applicationId && isApplicationGated);
    const descriptionSuffix = requiresApproval
      ? ` Your card will be authorized now and only charged once the host approves your application.`
      : (isFounderImmediateTest ? ` Founder test — $1.` : "");

    const orderMetadata: Record<string, string> = {
      onesocial_event_id: eventId,
      onesocial_user_id: userId || "",
      onesocial_ticket_type: ticketType,
      onesocial_quantity: String(qty),
      onesocial_ticket_amount: String(ticketAmountCents),
      onesocial_platform_fee: String(platformFeeCents),
      onesocial_host_connect_account: hostConnect?.stripe_account_id || "",
      ...(applicationId ? { onesocial_application_id: String(applicationId) } : {}),
      ...(guestName ? { onesocial_guest_name: guestName } : {}),
      ...(guestEmail ? { onesocial_guest_email: guestEmail } : {}),
      ...(guestPhone ? { onesocial_guest_phone: guestPhone } : {}),
      ...(isEventPromo ? {
        onesocial_promo_code: normalizedPromoCode,
        onesocial_promo_percent: String(eventPromoPercent),
      } : {}),
      ...(isFounderDollarTest ? {
        onesocial_founder_test: "true",
        onesocial_founder_mode: isFounderApprovalTest ? "approval" : "immediate",
      } : {}),
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: ((event.currency as string) || "USD").toLowerCase(),
            product_data: {
              name: `${event.title} — ${ticketLabel}`,
              description: isFounderDollarTest
                ? `${qty}× ${ticketLabel} ticket(s). Founder ${isFounderApprovalTest ? "approval" : "immediate"} test — $1.`
                : `${qty}× ${ticketLabel} ticket(s). Includes service fee ($${(platformFeeCents / 100).toFixed(2)}).${descriptionSuffix}`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: orderMetadata,
      success_url: `${origin}/events/e/${eventId}/checkout?session_id={CHECKOUT_SESSION_ID}&status=success${applicationId ? `&applicationId=${applicationId}` : ""}`,
      cancel_url: `${origin}/events/e/${eventId}/checkout?status=cancelled&step=payment${applicationId ? `&applicationId=${applicationId}` : "&applicationDraft=1"}`,
    };

    if (isFounderApprovalTest) {
      sessionParams.payment_intent_data = {
        capture_method: "manual" as const,
        metadata: orderMetadata,
      };
    } else if (!isFounderImmediateTest) {
      sessionParams.payment_intent_data = {
        ...(requiresApproval ? { capture_method: "manual" as const } : {}),
        metadata: orderMetadata,
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: hostConnect!.stripe_account_id },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (applicationId) {
      await serviceClient
        .from("event_applications")
        .update({
          stripe_session_id: session.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId)
        .eq("event_id", eventId)
        .eq("applicant_user_id", userId);
    }

    return json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("[EVENT-CHECKOUT] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});


