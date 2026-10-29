// WOMPI 1 — Wompi's "URL de eventos". Wompi calls this when a payment changes state.
// Every event is checked against WOMPI_EVENTS_SECRET before anything is written.
// Deployed with verify_jwt = false (Wompi does not send a Supabase token).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ENV = (Deno.env.get("WOMPI_ENV") ?? "sandbox") === "production" ? "production" : "sandbox";
const EVENTS = Deno.env.get("WOMPI_EVENTS_SECRET") ?? "";
const EVENTS_PREFIX = ENV === "production" ? "prod_events_" : "test_events_";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const TERMINAL = ["APPROVED", "DECLINED", "VOIDED", "ERROR"];

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
function pick(obj: any, path: string): string {
  let cur = obj;
  for (const k of path.split(".")) cur = cur?.[k];
  return cur === undefined || cur === null ? "" : String(cur);
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  if (!EVENTS.startsWith(EVENTS_PREFIX)) {
    console.error("wompi_webhook_not_configured");
    return new Response("not_configured", { status: 503 });
  }
  let ev: any;
  try { ev = await req.json(); } catch { return new Response("bad_json", { status: 400 }); }

  // Checksum = SHA256( values of signature.properties, in order + timestamp + events secret ).
  const props: string[] = Array.isArray(ev?.signature?.properties) ? ev.signature.properties : [];
  const given = String(ev?.signature?.checksum ?? req.headers.get("x-event-checksum") ?? "").toLowerCase();
  if (!props.length || !given || !ev?.timestamp) return new Response("unsigned", { status: 401 });
  const concat = props.map((p) => pick(ev.data, p)).join("") + String(ev.timestamp) + EVENTS;
  if (!safeEqual(await sha256hex(concat), given)) {
    console.error("wompi_webhook_bad_signature");
    return new Response("bad_signature", { status: 401 });
  }
  const envOk = (ev.environment === "prod" ? "production" : "sandbox") === ENV;
  if (!envOk) return new Response("wrong_environment", { status: 200 }); // acknowledged, ignored

  if (ev.event !== "transaction.updated") return new Response("ignored", { status: 200 });
  const tx = ev.data?.transaction ?? {};
  const key = `${tx.id}:${tx.status}:${ev.timestamp}`;
  const { error: dup } = await admin.from("wompi_events").insert({
    event_key: key, env: ENV, wompi_tx_id: tx.id ?? null, status: tx.status ?? null, payload: ev,
  });
  if (dup && dup.code === "23505") return new Response("duplicate", { status: 200 });

  const status = ["PENDING", ...TERMINAL].includes(tx.status) ? tx.status : "PENDING";
  const patch: Record<string, unknown> = {
    status, status_message: tx.status_message ?? null, last_payload: tx, updated_at: new Date().toISOString(),
    wompi_tx_id: tx.id,
  };
  if (TERMINAL.includes(status)) patch.finalized_at = new Date().toISOString();
  const { data, error } = await admin.from("wompi_payments").update(patch)
    .eq("reference", String(tx.reference ?? ""))
    .eq("amount_in_cents", Number(tx.amount_in_cents ?? -1))
    .not("status", "in", "(APPROVED,DECLINED,VOIDED,ERROR)")
    .select("id");
  if (error) {
    console.error("wompi_webhook_db", error.message);
    return new Response("db_error", { status: 500 }); // Wompi retries
  }
  if (!data?.length) console.warn("wompi_webhook_no_open_row", tx.reference);
  return new Response("ok", { status: 200 });
});
