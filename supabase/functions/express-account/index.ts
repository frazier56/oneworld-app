import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    headers: { ...cors, "Content-Type": "application/json" },
    status,
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RATE_LIMIT_PER_HOUR = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    const password = String(body?.password || "");
    const smsOptin = body?.smsOptin === true;
    const requestedSource = String(body?.source || "").trim();
    const source = [
      "oneevent_checkout",
      "oneevent_question",
      "oneevent_manager_invite",
      "oneevent_express_gate",
    ].includes(requestedSource)
      ? requestedSource
      : "oneevent_checkout";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: "Please enter a valid email address." }, 400);
    if (name.length < 2)
      return json({ error: "Please tell us your name." }, 400);
    if (phone.length < 7)
      return json({ error: "Please enter your phone number." }, 400);
    if (password.length < 8)
      return json(
        {
          error:
            "Choose a password of at least 8 characters — you'll use it to sign back in.",
        },
        400,
      );

    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    if (ip) {
      const { count } = await admin
        .from("express_account_log")
        .select("*", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
      if ((count ?? 0) >= RATE_LIMIT_PER_HOUR)
        return json(
          {
            error:
              "Too many accounts from this connection — please try again later.",
          },
          429,
        );
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (existingProfile) return json({ exists: true });

    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          phone,
          express_unverified: true,
          express_source: source,
        },
      });
    if (createErr || !created?.user) {
      if (String(createErr?.message || "").toLowerCase().includes("already"))
        return json({ exists: true });
      throw createErr || new Error("Could not create the account");
    }

    const expressCreatedAt = new Date().toISOString();
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: name,
        phone,
        sms_optin: smsOptin,
        sms_optin_at: smsOptin ? expressCreatedAt : null,
        account_creation_mode: "express",
        express_source: source,
        express_created_at: expressCreatedAt,
        signup_app: "oneevent",
        entry_product: "oneevent",
        entry_at: expressCreatedAt,
      })
      .eq("id", created.user.id);
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      throw new Error(`Could not mark the express account: ${profileError.message}`);
    }

    const { data: link, error: linkErr } =
      await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkErr || !link?.properties?.hashed_token)
      throw linkErr || new Error("Could not start the session");

    await admin.from("express_account_log").insert({ email, ip });
    return json({
      ok: true,
      tokenHash: link.properties.hashed_token,
      userId: created.user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[express-account]", message);
    return json({ error: message }, 500);
  }
});
