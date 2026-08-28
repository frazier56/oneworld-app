/**
 * verify-event-payment — Called after Stripe checkout success.
 * Verifies the session was paid, creates the event registration, and updates ticket counts.
 * v30 (27 Aug 2026): await receipt dispatch so the edge runtime cannot terminate it early.
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
    const authHeader = req.headers.get("Authorization");
    let authUserId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user }, error: authErr } = await authClient.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (!authErr && user) authUserId = user.id;
    }

    const { sessionId } = await req.json();
    if (!sessionId) return json({ error: "sessionId required" }, 400);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    const meta = session.metadata || {};
    const eventId = meta.onesocial_event_id;
    const userId = meta.onesocial_user_id || null;
    const ticketType = meta.onesocial_ticket_type || "ga";
    const quantity = parseInt(meta.onesocial_quantity || "1");
    const guestName = meta.onesocial_guest_name || null;
    const guestEmail = meta.onesocial_guest_email || null;
    const guestPhone = meta.onesocial_guest_phone || null;
    const applicationId = meta.onesocial_application_id || null;
    const isGuestPurchase = !userId;

    if (!eventId) {
      return json({ error: "Invalid session metadata" }, 400);
    }

    let application: Record<string, any> | null = null;
    if (applicationId) {
      if (!authUserId || !userId || authUserId !== userId) {
        return json({ error: "This payment session does not belong to the signed-in user" }, 403);
      }

      const { data: loadedApplication, error: applicationErr } = await serviceClient
        .from("event_applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();

      if (applicationErr || !loadedApplication || loadedApplication.event_id !== eventId) {
        return json({ error: "Application not found for this payment session" }, 404);
      }
      if (loadedApplication.applicant_user_id !== authUserId) {
        return json({ error: "This application belongs to a different account" }, 403);
      }
      if (loadedApplication.stripe_session_id !== session.id) {
        return json({ error: "Payment session is not the active session for this application" }, 409);
      }

      application = loadedApplication;
    } else if (userId && (!authUserId || userId !== authUserId)) {
      return json({ error: "Session does not belong to this user" }, 403);
    }

    const pi = (session.payment_intent && typeof session.payment_intent === "object")
      ? session.payment_intent as Stripe.PaymentIntent
      : null;
    const isManualCapture = pi?.capture_method === "manual";
    const isAuthorizedNotCaptured = isManualCapture && pi?.status === "requires_capture";
    let preapprovedCaptured = false;
    let preapprovedRegistrationId: string | null = null;
    const ticketAmount = Number.parseInt(meta.onesocial_ticket_amount || "0", 10) / 100;
    const platformFee = Number.parseInt(meta.onesocial_platform_fee || "0", 10) / 100;
    const paidAt = new Date().toISOString();
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;
    const qrCode = `OS-EVT-${eventId.slice(0, 8)}-${(userId || guestEmail || "guest").slice(0, 8)}-${Date.now()}`;

    if (applicationId && application && isManualCapture) {
      const wasPreapproved = ["approved", "auto_approved"].includes(
        String(application.approval_status || "").toLowerCase(),
      );

      if (wasPreapproved && (isAuthorizedNotCaptured || pi?.status === "succeeded")) {
        const approvedBy = application.approved_by || application.host_id;
        if (!approvedBy || !paymentIntentId) {
          throw new Error("Preapproved application is missing approval or payment identity");
        }

        await serviceClient
          .from("event_applications")
          .update({
            payment_status: "authorized",
            stripe_session_id: session.id,
            stripe_payment_method_id: paymentIntentId,
            host_visible_at: application.host_visible_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", applicationId)
          .eq("applicant_user_id", authUserId);

        let { data: attempt, error: attemptErr } = await serviceClient
          .from("event_payment_fulfillment_attempts")
          .select("id, status, registration_id")
          .eq("application_id", applicationId)
          .maybeSingle();

        if (!attemptErr && !attempt) {
          const inserted = await serviceClient
            .from("event_payment_fulfillment_attempts")
            .insert({
              application_id: applicationId,
              event_id: eventId,
              approved_by: approvedBy,
              stripe_payment_intent_id: paymentIntentId,
              stripe_session_id: session.id,
              status: "capture_pending",
              next_retry_at: new Date().toISOString(),
            })
            .select("id, status, registration_id")
            .single();
          attempt = inserted.data;
          attemptErr = inserted.error;
        }

        if (attemptErr?.code === "23505") {
          const existing = await serviceClient
            .from("event_payment_fulfillment_attempts")
            .select("id, status, registration_id")
            .eq("application_id", applicationId)
            .single();
          attempt = existing.data;
          attemptErr = existing.error;
        }
        if (attemptErr || !attempt) {
          throw new Error(`Could not journal preapproved payment: ${attemptErr?.message || "unknown error"}`);
        }

        if (attempt.status === "fulfilled" && attempt.registration_id) {
          preapprovedRegistrationId = attempt.registration_id;
        } else {
          if (isAuthorizedNotCaptured) {
            await stripe.paymentIntents.capture(paymentIntentId);
          }

          await serviceClient
            .from("event_payment_fulfillment_attempts")
            .update({
              status: "captured",
              captured_at: paidAt,
              last_error: null,
              attempt_count: 1,
              next_retry_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", attempt.id);

          const { data: registrationId, error: fulfillmentErr } = await serviceClient.rpc(
            "fulfill_approved_event_application",
            {
              p_attempt_id: attempt.id,
              p_application_id: applicationId,
              p_approved_by: approvedBy,
              p_paid_at: paidAt,
              p_ticket_amount: ticketAmount,
              p_platform_fee: platformFee,
              p_currency: String(session.currency || "USD").toUpperCase(),
              p_stripe_session_id: session.id,
              p_payment_intent_id: paymentIntentId,
              p_qr_code: qrCode,
            },
          );
          if (fulfillmentErr || !registrationId) {
            const message = fulfillmentErr?.message || "Registration fulfillment did not complete";
            await serviceClient
              .from("event_payment_fulfillment_attempts")
              .update({
                status: "fulfillment_pending",
                last_error: message,
                next_retry_at: new Date(Date.now() + 60_000).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", attempt.id);
            return json({
              error: "Payment was captured, but ticket fulfillment is being recovered automatically.",
              code: "payment_fulfillment_pending",
            }, 503);
          }
          preapprovedRegistrationId = registrationId;
        }
        preapprovedCaptured = true;
      } else if (isAuthorizedNotCaptured) {
        const { error: authorizationErr } = await serviceClient
          .from("event_applications")
          .update({
            payment_status: "authorized",
            stripe_session_id: session.id,
            stripe_payment_method_id: pi!.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", applicationId)
          .eq("applicant_user_id", authUserId);
        if (authorizationErr) throw authorizationErr;

        const { error: publishErr } = await serviceClient.rpc(
          "publish_authorized_event_application",
          { p_application_id: applicationId },
        );
        if (publishErr) throw publishErr;

        serviceClient.functions.invoke("score-event-application", {
          body: { applicationId },
        }).catch((err) => console.error("[VERIFY-EVENT-PAYMENT] scoring error:", err));

        return json({
          success: true,
          authorized: true,
          message: "Card authorized — application sent to the host for review.",
        });
      }
    }

    if (!preapprovedCaptured && session.payment_status !== "paid") {
      return json({ error: "Payment not completed", paymentStatus: session.payment_status }, 400);
    }

    if (applicationId) {
      await serviceClient
        .from("event_applications")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          stripe_session_id: session.id,
          stripe_payment_method_id: pi?.id || null,
          host_visible_at: application?.host_visible_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId)
        .eq("applicant_user_id", authUserId);
    }

    const registrationPayload = {
      event_id: eventId,
      user_id: userId,
      guest_name: userId ? null : guestName,
      guest_email: userId ? null : guestEmail,
      guest_phone: userId ? null : guestPhone,
      status: "registered",
      qr_code: qrCode,
      qr_valid: true,
      quantity,
      ticket_type: ticketType,
      registration_source: "paid",
      payment_status: "paid",
      amount_paid: ticketAmount,
      amount_paid_cents: Math.round(ticketAmount * 100),
      platform_fee_paid: platformFee,
      currency: String(session.currency || "USD").toUpperCase(),
      paid_at: paidAt,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      recipient_name: userId ? null : guestName,
      recipient_email: userId ? null : guestEmail,
      recipient_phone: userId ? null : guestPhone,
      application_id: applicationId,
    };

    let reg: { id: string } | null = preapprovedRegistrationId
      ? { id: preapprovedRegistrationId }
      : null;

    if (userId && !reg) {
      const { data: existing, error: existingErr } = await serviceClient
        .from("event_registrations")
        .select("id, status, payment_status, amount_paid, registration_source")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existingErr) throw existingErr;

      if (existing) {
        const alreadyConfirmed =
          ["registered", "checked_in"].includes(String(existing.status || "").toLowerCase()) &&
          (
            ["paid", "free", "complimentary", "promo"].includes(String(existing.payment_status || "").toLowerCase()) ||
            ["free", "complimentary", "promo"].includes(String(existing.registration_source || "").toLowerCase()) ||
            Number(existing.amount_paid || 0) > 0
          );

        if (alreadyConfirmed) {
          console.log(`[VERIFY-EVENT-PAYMENT] Already registered: user ${userId} for event ${eventId}`);
          return json({ success: true, registrationId: existing.id, alreadyRegistered: true });
        }

        const { data: updated, error: updateErr } = await serviceClient
          .from("event_registrations")
          .update(registrationPayload)
          .eq("id", existing.id)
          .select("id")
          .single();
        if (updateErr) throw updateErr;
        reg = updated;
      }
    }

    if (!reg) {
      const { data: inserted, error: regErr } = await serviceClient
        .from("event_registrations")
        .insert(registrationPayload)
        .select("id")
        .single();
      if (regErr) throw regErr;
      reg = inserted;
    }

    // event_registrations trigger owns event inventory and revenue reconciliation.

    const { data: event } = await serviceClient
      .from("events")
      .select("title, start_date, end_date, location, venue_name")
      .eq("id", eventId)
      .single();

    if (userId && event?.start_date) {
      await serviceClient.from("calendar_events").insert({
        user_id: userId,
        event_id: eventId,
        title: event.title,
        start_at: event.start_date,
        end_at: event.end_date || event.start_date,
        description: `Event: ${event.title}`,
        color: "#2EE6D6",
      });
    }

    let recipientEmail: string | null = null;
    let recipientName = "Attendee";

    if (userId) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();
      recipientEmail = profile?.email || null;
      recipientName = profile?.full_name || "Attendee";
    } else if (guestEmail) {
      recipientEmail = guestEmail;
      recipientName = guestName || "Guest";
    }

    if (recipientEmail && event) {
      const ticketLabel = ticketType === "vip" ? "VIP Access" : "General Admission";
      const confirmationId = `OS-${reg!.id.slice(0, 10).toUpperCase()}-${reg!.id.slice(-3).toUpperCase()}`;
      const totalPaid = session.amount_total ? (session.amount_total / 100).toFixed(2) : "0.00";

      try {
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateName: "ticket-receipt",
          recipientEmail,
          idempotencyKey: `ticket-receipt-${reg!.id}`,
          templateData: {
            siteName: "OneEvent",
            userName: recipientName,
            eventTitle: event.title,
            eventDate: event.start_date
              ? new Date(event.start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
              : "TBD",
            ticketType: ticketLabel,
            quantity,
            total: `$${totalPaid}`,
            confirmationId,
            ticketUrl: `${(req.headers.get("origin") || Deno.env.get("ONEEVENT_SITE_URL") || "https://app.oneworldlabs.ai").replace(/\/+$/, "")}/events/e/${eventId}/receipt/${reg!.id}`,
            groupChatUrl: `${(req.headers.get("origin") || Deno.env.get("ONEEVENT_SITE_URL") || "https://app.oneworldlabs.ai").replace(/\/+$/, "")}/events/e/${eventId}?do=message-host`,
          },
        }),
        });
        if (!emailResponse.ok) {
          const emailError = await emailResponse.text();
          console.error("[VERIFY-EVENT-PAYMENT] Receipt email rejected:", emailResponse.status, emailError);
        }
      } catch (emailError) {
        console.error("[VERIFY-EVENT-PAYMENT] Receipt email error:", emailError);
      }
    }

    console.log(
      `[VERIFY-EVENT-PAYMENT] Registration ${reg!.id} created for ${isGuestPurchase ? `guest ${guestEmail}` : `user ${userId}`}, event ${eventId}, ` +
      `${quantity}× ${ticketType}, session ${sessionId}`
    );

    return json({ success: true, registrationId: reg!.id });
  } catch (e) {
    console.error("[VERIFY-EVENT-PAYMENT] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

