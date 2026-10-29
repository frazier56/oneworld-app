// WOMPI 1 — One World's local Colombian payments (Nequi, PSE, card) through Wompi.
// The customer only ever sees One World screens; this function talks to Wompi server-side.
//
// Actions (POST JSON { action, ... }):
//   config  → public key, terms links, PSE bank list            (no sign-in needed)
//   create  → start a payment; amount is decided HERE, never trusted from the browser
//   status  → refresh one of the caller's payments from Wompi
//
// Secrets (Supabase → Edge Functions → Secrets), never in code:
//   WOMPI_ENV               "sandbox" | "production"   (default sandbox)
//   WOMPI_PUBLIC_KEY        pub_test_… / pub_prod_…
//   WOMPI_PRIVATE_KEY       prv_test_… / prv_prod_…   (not needed for create; kept for voids/refunds)
//   WOMPI_INTEGRITY_SECRET  test_integrity_… / prod_integrity_…
//   WOMPI_RETURN_ORIGIN     default https://app.oneworldlabs.ai
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ENV = (Deno.env.get("WOMPI_ENV") ?? "sandbox") === "production" ? "production" : "sandbox";
const BASE = ENV === "production" ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";
const PUB = (Deno.env.get("WOMPI_PUBLIC_KEY") ?? "").trim();
const INTEGRITY = (Deno.env.get("WOMPI_INTEGRITY_SECRET") ?? "").trim();
const RETURN_ORIGIN = Deno.env.get("WOMPI_RETURN_ORIGIN") ?? "https://app.oneworldlabs.ai";
const KEY_PREFIX = ENV === "production" ? "pub_prod_" : "pub_test_";
const INTEGRITY_PREFIX = ENV === "production" ? "prod_integrity_" : "test_integrity_";

const ALLOWED_ORIGINS = new Set([
  "https://app.oneworldlabs.ai",
  "https://oneworldlabs.ai",
  "https://www.oneworldlabs.ai",
  "http://localhost:5173",
  "http://localhost:4173",
]);
function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(o) ? o : "https://app.oneworldlabs.ai",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const TERMINAL = new Set(["APPROVED", "DECLINED", "VOIDED", "ERROR"]);

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function configured(): string | null {
  if (!PUB.startsWith(KEY_PREFIX)) return "public_key_missing_or_wrong_env";
  if (!INTEGRITY.startsWith(INTEGRITY_PREFIX)) return "integrity_secret_missing_or_wrong_env";
  return null;
}

async function wompiGet(path: string): Promise<any> {
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${PUB}` } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`wompi_get_${r.status}`);
  return body;
}

/* Terms tokens are fetched fresh for every payment: Wompi rotates them. */
async function merchant() {
  const m = (await wompiGet(`/merchants/${PUB}`)).data;
  return {
    acceptance_token: m.presigned_acceptance.acceptance_token as string,
    acceptance_link: m.presigned_acceptance.permalink as string,
    personal_token: m.presigned_personal_data_auth.acceptance_token as string,
    personal_link: m.presigned_personal_data_auth.permalink as string,
  };
}

let bankCache: { at: number; banks: { code: string; name: string }[] } | null = null;
async function banks() {
  if (bankCache && Date.now() - bankCache.at < 6 * 3600_000) return bankCache.banks;
  const list = (await wompiGet("/pse/financial_institutions")).data as any[];
  const out = list
    .map((b) => ({ code: String(b.financial_institution_code), name: String(b.financial_institution_name) }))
    .filter((b) => b.code !== "0");
  bankCache = { at: Date.now(), banks: out };
  return out;
}

/* ── WHAT IS BEING PAID FOR ───────────────────────────────────────────────────────────────
   The amount always comes from the server. Each app adds its own resolver here (a OneJob
   contract, a OneHome booking …) that reads the real record and checks the caller may pay it.
   Unknown purposes are refused. */
type Resolved = { amount_in_cents: number; description: string; purpose_ref: string | null };
/* Purposes a customer may pay WITHOUT an account (Lee, 29 Oct 2026: "if they could not sign up
   and just pay, that would be best"). The pay token they scanned is their only key. */
const GUEST_PURPOSES = new Set(["onepay"]);
async function resolvePurpose(purpose: string, body: any, _userId: string | null): Promise<Resolved | string> {
  if (purpose === "onepay") {
    const token = String(body.pay_token ?? "");
    if (!/^[0-9a-f]{64}$/.test(token)) return "pay_link_invalid";
    const { data: a } = await admin.from("onepay_attempts")
      .select("id, amount_minor, state, method, merchant_id").eq("pay_token", token).maybeSingle();
    if (!a || !["qr", "link"].includes(a.method)) return "pay_link_invalid";
    if (a.state !== "pending") return a.state === "paid" ? "already_paid" : "pay_link_closed";
    const { data: open } = await admin.from("wompi_payments").select("id")
      .eq("purpose", "onepay").eq("purpose_ref", a.id).in("status", ["PENDING", "APPROVED"]).limit(1);
    if (open?.length) return "payment_in_progress";
    const { data: m } = await admin.from("onepay_merchants").select("name").eq("id", a.merchant_id).single();
    return { amount_in_cents: Number(a.amount_minor), description: `OnePay ${m?.name ?? ""}`.trim(), purpose_ref: a.id };
  }
  if (purpose === "oneride") {
    const rideId = String(body.ride_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(rideId)) return "ride_invalid";
    const { data: r } = await admin.from("ride_requests")
      .select("id, rider_id, status, currency, agreed_amount, payment_rail, payment_status").eq("id", rideId).maybeSingle();
    if (!r || r.rider_id !== _userId) return "ride_invalid";
    if (r.payment_status === "paid") return "already_paid";
    if (!["booked", "in_progress", "completed"].includes(r.status)) return "ride_not_payable";
    if (r.currency !== "COP" || r.payment_rail === "card") return "ride_not_pesos";
    const { data: open } = await admin.from("wompi_payments").select("id")
      .eq("purpose", "oneride").eq("purpose_ref", r.id).in("status", ["PENDING", "APPROVED"]).limit(1);
    if (open?.length) return "payment_in_progress";
    return { amount_in_cents: Math.round(Number(r.agreed_amount) * 100), description: "OneRide viaje", purpose_ref: r.id };
  }
  if (purpose === "sandbox_test") {
    if (ENV !== "sandbox") return "purpose_sandbox_only";
    const pesos = Math.round(Number(body.amount_pesos));
    if (!Number.isFinite(pesos) || pesos < 1500 || pesos > 2_000_000) return "amount_out_of_range";
    return { amount_in_cents: pesos * 100, description: "One World prueba", purpose_ref: null };
  }
  return "unknown_purpose";
}

function paymentMethod(body: any, description: string): Record<string, unknown> | string {
  const m = String(body.method ?? "");
  if (m === "NEQUI") {
    const phone = String(body.phone ?? "").replace(/\D/g, "");
    if (!/^3\d{9}$/.test(phone)) return "nequi_phone_invalid";
    return { type: "NEQUI", phone_number: phone };
  }
  if (m === "PSE") {
    const idType = String(body.legal_id_type ?? "CC");
    const id = String(body.legal_id ?? "").replace(/[^0-9A-Za-z]/g, "");
    const bank = String(body.bank_code ?? "");
    if (!["CC", "CE", "NIT"].includes(idType)) return "pse_id_type_invalid";
    if (id.length < 5 || id.length > 15) return "pse_id_invalid";
    if (!/^\d{1,6}$/.test(bank) || bank === "0") return "pse_bank_invalid";
    return {
      type: "PSE",
      user_type: idType === "NIT" ? 1 : 0,
      user_legal_id_type: idType,
      user_legal_id: id,
      financial_institution_code: bank,
      payment_description: description.replace(/'/g, "").slice(0, 64),
    };
  }
  if (m === "CARD") {
    const token = String(body.card_token ?? "");
    if (!/^tok_(test|prod)_[A-Za-z0-9_]+$/.test(token)) return "card_token_invalid";
    const inst = Math.max(1, Math.min(36, Math.round(Number(body.installments ?? 1)) || 1));
    return { type: "CARD", token, installments: inst };
  }
  return "method_invalid";
}

async function syncFromWompi(row: any): Promise<any> {
  if (!row.wompi_tx_id || TERMINAL.has(row.status)) return row;
  const tx = (await wompiGet(`/transactions/${row.wompi_tx_id}`)).data;
  return await applyTx(row.id, tx);
}

async function applyTx(id: string, tx: any): Promise<any> {
  const status = String(tx.status ?? "PENDING");
  const patch: Record<string, unknown> = {
    status: ["PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"].includes(status) ? status : "PENDING",
    status_message: tx.status_message ?? null,
    last_payload: tx,
    updated_at: new Date().toISOString(),
  };
  const url = tx.payment_method?.extra?.async_payment_url;
  if (url) patch.redirect_url = url;
  if (TERMINAL.has(patch.status as string)) patch.finalized_at = new Date().toISOString();
  // Never move a payment out of a final state.
  const { data } = await admin.from("wompi_payments").update(patch).eq("id", id)
    .not("status", "in", "(APPROVED,DECLINED,VOIDED,ERROR)").select("*").maybeSingle();
  if (data) { await onApproved(data); return data; }
  return (await admin.from("wompi_payments").select("*").eq("id", id).single()).data;
}

/* What an approved payment unlocks in the app it was for. Idempotent on the app side. */
async function onApproved(row: any) {
  if (row.status !== "APPROVED") return;
  if (row.purpose === "onepay" && row.purpose_ref) {
    const { error } = await admin.rpc("onepay_wompi_paid", {
      p_attempt: row.purpose_ref, p_ref: row.wompi_tx_id ?? row.reference,
      p_name: row.customer_name ?? "", p_contact: row.customer_contact ?? "",
    });
    if (error) console.error("onepay_settle_failed", error.message);
  }
  if (row.purpose === "oneride" && row.purpose_ref) {
    const { error } = await admin.rpc("oneride_wompi_paid", {
      p_ride: row.purpose_ref, p_amount_minor: row.amount_in_cents, p_ref: row.wompi_tx_id ?? row.reference,
    });
    if (error) console.error("oneride_settle_failed", error.message);
  }
}

const publicRow = (r: any) => ({
  id: r.id, status: r.status, method: r.method, amount_in_cents: r.amount_in_cents,
  reference: r.reference, redirect_url: r.status === "PENDING" ? r.redirect_url : null,
  status_message: r.status_message, env: r.env,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });
  let body: any;
  try { body = await req.json(); } catch { return json(req, 400, { error: "bad_json" }); }
  const notReady = configured();
  if (notReady) return json(req, 503, { error: "wompi_not_configured", detail: notReady });

  try {
    if (body.action === "config") {
      const m = await merchant();
      return json(req, 200, {
        env: ENV, public_key: PUB,
        terms_url: m.acceptance_link, personal_data_url: m.personal_link,
        banks: await banks(),
      });
    }

    if (body.action === "pay_view") {
      const { data } = await admin.rpc("onepay_pay_view", { p_token: String(body.pay_token ?? "") });
      if (!data) return json(req, 404, { error: "pay_link_invalid" });
      return json(req, 200, data);
    }

    // A signed-in One ID, or a guest holding a pay token for a guest purpose.
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = jwt.split(".").length === 3 ? await admin.auth.getUser(jwt) : { data: null } as any;
    const user = u?.user ?? null;
    const guestToken = typeof body.pay_token === "string" && /^[0-9a-f]{64}$/.test(body.pay_token) ? body.pay_token : null;

    if (body.action === "status") {
      const { data: row } = await admin.from("wompi_payments").select("*")
        .eq("id", String(body.payment_id ?? "")).maybeSingle();
      let mine = !!row && !!user && row.user_id === user.id;
      if (row && !mine && guestToken && row.purpose === "onepay") {
        const { data: a } = await admin.from("onepay_attempts").select("id").eq("pay_token", guestToken).maybeSingle();
        mine = !!a && a.id === row.purpose_ref;
      }
      if (!row || !mine) return json(req, 404, { error: "not_found" });
      return json(req, 200, publicRow(await syncFromWompi(row)));
    }

    if (body.action === "create") {
      if (body.accepted_terms !== true) return json(req, 400, { error: "terms_not_accepted" });
      const purpose = String(body.purpose ?? "");
      if (!user && !(GUEST_PURPOSES.has(purpose) && guestToken)) return json(req, 401, { error: "sign_in_required" });
      const resolved = await resolvePurpose(purpose, body, user?.id ?? null);
      if (typeof resolved === "string") return json(req, 400, { error: resolved });
      const pm = paymentMethod(body, resolved.description);
      if (typeof pm === "string") return json(req, 400, { error: pm });
      const email = String(user?.email ?? body.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) return json(req, 400, { error: "email_required" });
      const customerName = String(body.full_name ?? user?.user_metadata?.full_name ?? "").trim().slice(0, 80);
      if (!user && customerName.length < 3) return json(req, 400, { error: "name_required" });
      const psePhone = String(body.phone ?? user?.phone ?? "").replace(/\D/g, "");
      if (pm.type === "PSE") {
        if (customerName.length < 3) return json(req, 400, { error: "pse_name_required" });
        if (!/^(57)?3\d{9}$/.test(psePhone)) return json(req, 400, { error: "pse_phone_required" });
      }

      const reference = `ow_${purpose}_${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 64);
      const { data: row, error: insErr } = await admin.from("wompi_payments").insert({
        user_id: user?.id ?? null, env: ENV, purpose, purpose_ref: resolved.purpose_ref, reference,
        amount_in_cents: resolved.amount_in_cents, method: pm.type, status: "CREATED",
        customer_name: customerName || null, customer_contact: [email, String(body.phone ?? "").replace(/\D/g, "")].filter(Boolean).join(" · "),
      }).select("*").single();
      if (insErr || !row) return json(req, 500, { error: "db_insert_failed" });

      const m = await merchant();
      const signature = await sha256hex(`${reference}${resolved.amount_in_cents}COP${INTEGRITY}`);
      const returnPath = typeof body.return_path === "string" && /^\/[A-Za-z0-9/_\-?=&.%#]*$/.test(body.return_path)
        ? body.return_path : "/";
      const sep = returnPath.includes("?") ? "&" : "?";
      const payload: Record<string, unknown> = {
        acceptance_token: m.acceptance_token,
        accept_personal_auth: m.personal_token,
        amount_in_cents: resolved.amount_in_cents,
        currency: "COP",
        signature,
        customer_email: email,
        reference,
        payment_method: pm,
        redirect_url: `${RETURN_ORIGIN}${returnPath}${sep}ow_pay=${row.id}`,
      };
      if (pm.type === "PSE") {
        payload.customer_data = { full_name: customerName, phone_number: psePhone.startsWith("57") ? psePhone : "57" + psePhone };
      }

      const r = await fetch(`${BASE}/transactions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${PUB}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok || !res?.data?.id) {
        const reason = res?.error?.type ?? `http_${r.status}`;
        console.error("wompi_create_failed", reason, JSON.stringify(res?.error?.messages ?? {}));
        await admin.from("wompi_payments").update({
          status: "ERROR", status_message: String(reason).slice(0, 200), last_payload: res,
          updated_at: new Date().toISOString(), finalized_at: new Date().toISOString(),
        }).eq("id", row.id);
        return json(req, 502, { error: "wompi_rejected", detail: reason, payment_id: row.id });
      }
      await admin.from("wompi_payments").update({ wompi_tx_id: res.data.id }).eq("id", row.id);
      let current = await applyTx(row.id, res.data);

      // PSE: the bank link appears a moment after creation. Wait for it here so the screen
      // can send the customer straight to their bank.
      if (pm.type === "PSE") {
        for (let i = 0; i < 10 && !current.redirect_url && !TERMINAL.has(current.status); i++) {
          await new Promise((s) => setTimeout(s, 800));
          current = await syncFromWompi(current);
        }
      }
      return json(req, 200, publicRow(current));
    }

    return json(req, 400, { error: "unknown_action" });
  } catch (e) {
    console.error("wompi_pay_error", String((e as Error)?.message ?? e));
    return json(req, 502, { error: "wompi_unavailable" });
  }
});
