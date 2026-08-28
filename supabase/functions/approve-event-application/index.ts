/**
 * approve-event-application — Host approves an event application.
 *
 * For paid + approval-required events: captures the previously-authorized PaymentIntent,
 * marks the app paid, creates the event_registration, sends SMS/email confirmation.
 * For free + approval-required events: just creates the registration + sends ticket.
 *
 * Auth: caller must be the host of the event (verified via JWT + event.host_id).
 *
 * v24 (27 Aug 2026): journal capture before contacting Stripe and fulfill the
 * application + registration in one database transaction. A scheduled recovery
 * worker can safely finish any capture interrupted between Stripe and Postgres.
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  const authClient = createClient(supabaseUrl, supabaseAnon);
  const serviceClient = createClient(supabaseUrl, serviceKey);

  try {
    // Auth check — host must be signed in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }
    const { data: { user }, error: authErr } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) return json({ error: "Invalid session" }, 401);

    const { applicationId } = await req.json();
    if (!applicationId) return json({ error: "applicationId required" }, 400);

    // Load application + event
    const { data: app, error: appErr } = await serviceClient
      .from("event_applications")
      .select("*, events!inner(id, host_id, title, ticket_type, ticket_price, ga_ticket_price, vip_ticket_price, currency, requires_application, application_requires_approval)")
      .eq("id", applicationId)
      .single();

    if (appErr || !app) return json({ error: "Application not found" }, 404);
    if ((app as any).events.host_id !== user.id) {
      return json({ error: "Only the host can approve applications" }, 403);
    }
    if (app.approval_status === "approved" || app.approval_status === "auto_approved") {
      return json({ success: true, alreadyApproved: true });
    }
    if (app.approval_status === "rejected") {
      return json({ error: "This application was already rejected" }, 400);
    }

    const event = (app as any).events;
    const eventRequiresPayment =
      event.ticket_type === "paid" ||
      Number(event.ticket_price || 0) > 0 ||
      Number(event.ga_ticket_price || 0) > 0 ||
      Number(event.vip_ticket_price || 0) > 0;
    const hasPaymentAuthorization = !!(app.stripe_session_id || app.stripe_payment_method_id);

    // A paid event application is not an admission until Stripe has authorized it.
    // Previously, a host could approve a paid application with no authorization; that
    // incremented sold inventory without a paid registration and made every KPI disagree.
    if (
      eventRequiresPayment &&
      (!hasPaymentAuthorization || app.payment_status !== "authorized" || !app.host_visible_at)
    ) {
      return json({
        error: "This paid application has no payment authorization yet.",
        code: "payment_authorization_required",
      }, 409);
    }

    const paidAt = new Date().toISOString();
    let paymentIntentId: string | null = app.stripe_payment_method_id || null;
    let stripeSessionId: string | null = app.stripe_session_id || null;
    let ticketAmount = 0;
    let platformFee = 0;
    let paymentCurrency = String(event.currency || "USD").toUpperCase();
    const qrCode = `OS-EVT-${event.id.slice(0, 8)}-${(app.applicant_user_id || app.applicant_email || "guest").slice(0, 8)}-${Date.now()}`;
    let registrationId: string | undefined;

    // ---------- Capture the Stripe authorization (paid events) ----------
    if (eventRequiresPayment) {
      if (!stripeKey) return json({ error: "Payment processor not configured" }, 500);
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      // Checkout Session metadata is the immutable order snapshot. Copy it into the
      // registration so overview, registrations, capacity and payouts share one order grain.
      if (stripeSessionId) {
        const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
        paymentIntentId = paymentIntentId || (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id) || null;
        ticketAmount = Number.parseInt(session.metadata?.onesocial_ticket_amount || "0", 10) / 100;
        platformFee = Number.parseInt(session.metadata?.onesocial_platform_fee || "0", 10) / 100;
        paymentCurrency = String(session.currency || paymentCurrency).toUpperCase();
      }

      if (!paymentIntentId) {
        return json({ error: "No payment authorization found for this application" }, 402);
      }

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
            event_id: event.id,
            approved_by: user.id,
            stripe_payment_intent_id: paymentIntentId,
            stripe_session_id: stripeSessionId,
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
        throw new Error(`Could not journal payment fulfillment: ${attemptErr?.message || "unknown error"}`);
      }

      if (attempt.status === "fulfilled" && attempt.registration_id) {
        registrationId = attempt.registration_id;
      }

      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (!registrationId && pi.status === "requires_capture") {
          await stripe.paymentIntents.capture(paymentIntentId);
        } else if (!registrationId && pi.status !== "succeeded") {
          throw new Error(`Payment authorization is no longer valid (${pi.status})`);
        }
      } catch (captureErr) {
        const message = captureErr instanceof Error ? captureErr.message : String(captureErr);
        await serviceClient
          .from("event_payment_fulfillment_attempts")
          .update({
            status: "capture_failed",
            last_error: message,
            attempt_count: 1,
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", attempt.id);
        await serviceClient
          .from("event_applications")
          .update({ payment_status: "failed" })
          .eq("id", applicationId);

        if (app.applicant_email) {
          try {
            await serviceClient.functions.invoke("send-notification-email", {
              body: {
                to: app.applicant_email,
                subject: `Payment issue for ${event.title}`,
                html: `<p>Hi ${app.applicant_name || "there"},</p>
                  <p>The host approved your request for <strong>${event.title}</strong>, but your payment authorization could not be charged.</p>
                  <p>Please update your payment method and request to join again.</p>
                  <p><a href="https://onesocial.ai/discover-events/${event.id}">Return to the event</a></p>`,
              },
            });
          } catch (e) {
            console.warn("[approve-event-application] payment-failed email failed:", e);
          }
        }

        return json({ error: `Payment could not be captured: ${message}` }, 402);
      }

      if (!registrationId) {
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

        const { data: fulfilledRegistrationId, error: fulfillmentErr } = await serviceClient.rpc(
          "fulfill_approved_event_application",
          {
            p_attempt_id: attempt.id,
            p_application_id: applicationId,
            p_approved_by: user.id,
            p_paid_at: paidAt,
            p_ticket_amount: ticketAmount,
            p_platform_fee: platformFee,
            p_currency: paymentCurrency,
            p_stripe_session_id: stripeSessionId,
            p_payment_intent_id: paymentIntentId,
            p_qr_code: qrCode,
          },
        );

        if (fulfillmentErr || !fulfilledRegistrationId) {
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

        registrationId = fulfilledRegistrationId;
      }
    }

    if (!eventRequiresPayment) {
      // Free-event approval does not cross an external payment boundary.
      const { error: approvalErr } = await serviceClient
        .from("event_applications")
        .update({
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", applicationId);
      if (approvalErr) throw approvalErr;

      const registrationPayload = {
      event_id: event.id,
      user_id: app.applicant_user_id || null,
      guest_name: app.applicant_user_id ? null : app.applicant_name,
      guest_email: app.applicant_user_id ? null : app.applicant_email,
      guest_phone: app.applicant_user_id ? null : app.applicant_phone,
      status: "registered",
      qr_code: qrCode,
      qr_valid: true,
      quantity: app.quantity || 1,
      ticket_type: app.ticket_type || "ga",
      registration_source: eventRequiresPayment ? "paid" : "free",
      payment_status: eventRequiresPayment ? "paid" : "free",
      amount_paid: eventRequiresPayment ? ticketAmount : 0,
      amount_paid_cents: eventRequiresPayment ? Math.round(ticketAmount * 100) : 0,
      platform_fee_paid: eventRequiresPayment ? platformFee : 0,
      currency: paymentCurrency,
      paid_at: eventRequiresPayment ? paidAt : null,
      stripe_session_id: eventRequiresPayment ? stripeSessionId : null,
      stripe_payment_intent_id: eventRequiresPayment ? paymentIntentId : null,
      application_id: applicationId,
      sms_optin: Boolean(app.sms_optin),
      };

      if (app.applicant_user_id) {
      const { data: existingReg } = await serviceClient
        .from("event_registrations")
        .select("id")
        .eq("event_id", event.id)
        .eq("user_id", app.applicant_user_id)
        .maybeSingle();

      registrationId = existingReg?.id;
      if (registrationId) {
        const { error: updateErr } = await serviceClient
          .from("event_registrations")
          .update(registrationPayload)
          .eq("id", registrationId);
        if (updateErr) throw updateErr;
      } else {
        const { data: newReg, error: regErr } = await serviceClient
          .from("event_registrations")
          .insert(registrationPayload)
          .select("id")
          .single();

        if (regErr && regErr.code !== "23505") throw regErr;
        registrationId = newReg?.id;

        // event_registrations trigger owns event inventory and revenue reconciliation.
      }
      } else {
      // Guest registrations use a NULL user_id and their own contact fields. PostgreSQL
      // permits multiple NULLs in the event/user uniqueness constraint, so each guest keeps
      // an independent ticket and payment attempt.
      const { data: guestReg, error: guestRegErr } = await serviceClient
        .from("event_registrations")
        .insert(registrationPayload)
        .select("id")
        .single();
      if (guestRegErr) throw guestRegErr;
      registrationId = guestReg?.id;
        // event_registrations trigger owns event inventory and revenue reconciliation.
      }
    }

    // ---------- Notify applicant (in-app + SMS + email) ----------
    if (app.applicant_user_id) {
      await serviceClient.from("notifications").insert({
        user_id: app.applicant_user_id,
        type: "event_application_approved",
        title: `🎉 You're in: ${event.title}`,
        body: eventRequiresPayment
          ? `Your application was approved and your ticket is confirmed. Your card has been charged.`
          : `Your application was approved! Your ticket is ready.`,
        action_url: `/discover-events/${event.id}`,
      });
    }

    // SMS is event-specific and only goes out after the attendee explicitly
    // opts in on the authorization confirmation screen.
    if (app.applicant_phone && app.sms_optin) {
      try {
        await serviceClient.functions.invoke("send-sms-notification", {
          body: {
            to: app.applicant_phone,
            message: `🎉 You're approved for "${event.title}"! ${eventRequiresPayment ? "Your card was charged." : ""} View your ticket: https://app.oneworldlabs.ai/events/e/${event.id}`,
          },
        });
      } catch (e) {
        console.warn("[approve-event-application] SMS failed:", e);
      }
    }

    // Email via Brevo (best-effort)
    if (app.applicant_email) {
      try {
        await serviceClient.functions.invoke("send-notification-email", {
          body: {
            to: app.applicant_email,
            subject: `You're approved for ${event.title}`,
            html: `<p>Hi ${app.applicant_name || "there"},</p>
              <p>Your application for <strong>${event.title}</strong> was approved by the host.</p>
              ${eventRequiresPayment ? "<p>Your card has been charged. ✅</p>" : ""}
              <p><a href="https://app.oneworldlabs.ai/events/e/${event.id}">View your ticket</a></p>`,
          },
        });
      } catch (e) {
        console.warn("[approve-event-application] email failed:", e);
      }
    }

    return json({ success: true, registrationId, captured: eventRequiresPayment });
  } catch (e) {
    console.error("[approve-event-application] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
