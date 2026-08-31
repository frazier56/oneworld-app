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

function makeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string" && body.error.trim()) return body.error;
    if (typeof body?.message === "string" && body.message.trim()) return body.message;
  } catch {
    // Fall through to the status text.
  }
  return `Email service returned ${response.status}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown };
    for (const value of [candidate.message, candidate.details, candidate.hint]) {
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return "Unable to record the outside payment";
}

function publicError(message: string): { message: string; status: number } {
  const lower = message.toLowerCase();
  if (lower.includes("authentication")) return { message: "Sign in to record this payment.", status: 401 };
  if (lower.includes("only this event") || lower.includes("not authorized") || lower.includes("permission")) {
    return { message: "Only this event's host or event managers can record an outside payment.", status: 403 };
  }
  if (lower.includes("already has") || lower.includes("already issued")) {
    return { message, status: 409 };
  }
  if (lower.includes("rejected") || lower.includes("no paid ticket amount")) {
    return { message, status: 400 };
  }
  return { message, status: 500 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Server configuration error" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, anonKey);
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authError } = await authClient.auth.getUser(jwt);
  if (authError || !user) return json({ error: "Authentication required" }, 401);

  try {
    const body = await req.json();
    const applicationId = String(body.applicationId || body.application_id || "");
    const method = String(body.method || "outside_oneevent").trim().slice(0, 80);
    const note = String(body.note || "").trim().slice(0, 500);
    if (!applicationId) return json({ error: "applicationId is required" }, 400);

    const claimToken = makeToken();
    const { data: issued, error: issueError } = await serviceClient.rpc(
      "issue_outside_paid_event_ticket_internal",
      {
        p_actor_id: user.id,
        p_application_id: applicationId,
        p_claim_token: claimToken,
        p_method: method,
        p_note: note || null,
      },
    );

    if (issueError) {
      const mapped = publicError(errorMessage(issueError));
      return json({ error: mapped.message }, mapped.status);
    }

    if (issued?.already_issued) {
      return json({
        success: true,
        alreadyIssued: true,
        registrationId: issued.registration_id,
        amount: issued.amount,
        currency: issued.currency,
      });
    }

    const registrationId = String(issued.registration_id);
    const origin = (req.headers.get("origin") || Deno.env.get("ONEEVENT_SITE_URL") || "https://app.oneworldlabs.ai").replace(/\/+$/, "");
    const claimUrl = `${origin}/ticket/claim/${claimToken}`;
    const ticketUrl = `${origin}/discover-events/${issued.event_id}/receipt/${registrationId}`;
    const groupChatUrl = `${origin}/discover-events/${issued.event_id}?joinChat=1`;
    const confirmationId = `OS-${registrationId.slice(0, 10).toUpperCase()}-${registrationId.slice(-3).toUpperCase()}`;
    const ticketLabel = issued.ticket_type === "vip" ? "VIP Access" : "General Admission";
    const amountLabel = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: issued.currency || "USD",
    }).format(Number(issued.amount || 0));

    let emailOk = false;
    let emailError: string | null = null;
    try {
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateName: "ticket-receipt",
          recipientEmail: issued.recipient_email,
          idempotencyKey: `ticket-receipt-outside-${registrationId}`,
          templateData: {
            siteName: "OneEvent",
            userName: issued.recipient_name,
            eventTitle: issued.event_title || "Your event",
            eventDate: issued.event_start_date
              ? new Date(issued.event_start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
              : "TBD",
            eventLocation: issued.event_location || "",
            ticketType: `${ticketLabel} - paid outside OneEvent`,
            quantity: Number(issued.quantity || 1),
            total: amountLabel,
            confirmationId,
            claimUrl,
            ticketUrl,
            groupChatUrl,
            requiresAccountClaim: true,
          },
        }),
      });
      emailOk = emailRes.ok;
      if (!emailRes.ok) emailError = await readErrorMessage(emailRes);
    } catch (error) {
      emailError = error instanceof Error ? error.message : String(error);
    }

    await serviceClient
      .from("event_registrations")
      .update({
        ticket_email_status: emailOk ? "queued" : "failed",
        ticket_email_last_sent_at: new Date().toISOString(),
      })
      .eq("id", registrationId);

    return json({
      success: true,
      alreadyIssued: false,
      registrationId,
      amount: issued.amount,
      currency: issued.currency,
      emailStatus: emailOk ? "queued" : "failed",
      emailError,
    });
  } catch (error) {
    console.error("[RECORD-OUTSIDE-EVENT-PAYMENT]", error);
    const mapped = publicError(errorMessage(error));
    return json({ error: mapped.message }, mapped.status);
  }
});

