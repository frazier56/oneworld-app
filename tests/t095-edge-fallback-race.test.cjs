const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const { webcrypto } = require("crypto");
const ts = require("C:/Dev/Projects/One Social/_t090_language_overlay_release_20260910/oneworld-app/node_modules/typescript");

const handlerSource = fs.readFileSync(
  require("path").join(__dirname, "..", "supabase", "functions", "twilio-message-status", "index.ts"),
  "utf8",
);
const workerSource = fs.readFileSync(
  require("path").join(__dirname, "..", "supabase", "functions", "process-event-rolodex-broadcast", "index.ts"),
  "utf8",
);

const claimAt = workerSource.indexOf('admin.rpc("oneevent_claim_sms_provider_dispatch"');
const providerFetchAt = workerSource.indexOf("https://api.twilio.com/2010-04-01/Accounts/", claimAt);
assert(claimAt >= 0 && providerFetchAt > claimAt, "SMS durable claim must precede the Twilio provider fetch");

let captured;
let primaryStatus = "queued";
let fallback = { status: "queued", provider_status: "waiting_for_whatsapp", processing_status: "done" };
let workerWakes = 0;
let releaseDelivery;
let deliveryCommitted = new Promise((resolve) => { releaseDelivery = resolve; });
let rpcTail = Promise.resolve();
const rank = { queued: 20, failed: 50, undelivered: 50, delivered: 60, read: 70 };

function createClient() {
  return {
    rpc(name, args) {
      assert.equal(name, "oneevent_apply_twilio_recipient_status");
      const operation = rpcTail.then(async () => {
        const next = args.p_provider_status;
        if ((rank[next] || 0) < (rank[primaryStatus] || 0)) {
          return { data: [{ applied: false, kick_sms_fallback: false }], error: null };
        }
        if (next === primaryStatus) {
          const recover = ["failed", "undelivered"].includes(next)
            && fallback.processing_status === "pending"
            && fallback.provider_status == null;
          return { data: [{ applied: false, kick_sms_fallback: recover }], error: null };
        }
        primaryStatus = next;
        if (next === "delivered" || next === "read") {
          fallback = { status: "skipped", provider_status: "not_needed", processing_status: "done" };
          releaseDelivery();
          return { data: [{ applied: true, kick_sms_fallback: false }], error: null };
        }
        fallback = { status: "queued", provider_status: null, processing_status: "pending" };
        return { data: [{ applied: true, kick_sms_fallback: true }], error: null };
      });
      rpcTail = operation.then(() => undefined, () => undefined);
      return operation;
    },
    from(table) {
      let action = "select";
      const filters = {};
      const query = {
        select() { return query; },
        or() { return query; },
        eq(key, value) { filters[key] = value; return query; },
        upsert() { action = "upsert"; return query; },
        maybeSingle: async () => {
          if (table === "event_rolodex_broadcast_recipients") {
            return {
              data: {
                id: "20000000-0000-4000-8000-000000000101",
                broadcast_id: "10000000-0000-4000-8000-000000000101",
                rolodex_id: "40000000-0000-4000-8000-000000000101",
                channel: "whatsapp",
                destination: "+15555550101",
                status: "queued",
                provider_status: primaryStatus,
                provider_message_id: "SM00000000000000000000000000000101",
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        then(resolve, reject) {
          return Promise.resolve({ data: action === "upsert" ? null : [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

const code = ts.transpileModule(handlerSource.replace(/^import .*\n/gm, ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
vm.runInNewContext(code, {
  Deno: {
    env: { get: (key) => ({
      SUPABASE_URL: "https://test.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-only",
      TWILIO_AUTH_TOKEN: "synthetic-auth-token",
    })[key] },
    serve: (handler) => { captured = handler; },
  },
  createClient,
  isSupportedProviderStatus: (status) => status in rank,
  TextEncoder,
  URL,
  Request,
  Response,
  FormData,
  crypto: webcrypto,
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  console,
  fetch: async () => {
    workerWakes += 1;
    await deliveryCommitted;
    return new Response("ok");
  },
});

async function signedRequest(status) {
  const url = "https://test.invalid/functions/v1/twilio-message-status";
  const params = {
    MessageSid: "SM00000000000000000000000000000101",
    MessageStatus: status,
    To: "+15555550101",
  };
  const payload = url + Object.keys(params).sort().map((key) => key + params[key]).join("");
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("synthetic-auth-token"),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  ).toString("base64");
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": signature,
    },
    body: new URLSearchParams(params),
  });
}

(async () => {
  const failure = captured(await signedRequest("failed"));
  await new Promise((resolve) => setTimeout(resolve, 5));
  const delivery = captured(await signedRequest("delivered"));
  const responses = await Promise.all([failure, delivery]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(primaryStatus, "delivered");
  assert.deepEqual(fallback, {
    status: "skipped",
    provider_status: "not_needed",
    processing_status: "done",
  });
  assert.equal(workerWakes, 1, "failure may wake worker once; the durable worker claim suppresses stale dispatch");
  const raceFinalPrimary = primaryStatus;
  const raceFinalFallback = { ...fallback };

  primaryStatus = "failed";
  fallback = { status: "queued", provider_status: null, processing_status: "pending" };
  deliveryCommitted = Promise.resolve();
  const retry = await captured(await signedRequest("failed"));
  assert.equal(retry.status, 200);
  assert.equal(workerWakes, 2, "duplicate failure retries the safe worker wake after an earlier wake failure");

  const result = {
    exactCallbackHandler: true,
    productionWrites: false,
    raceFinalPrimary,
    raceFinalFallback,
    retryPrimary: primaryStatus,
    retryFallback: fallback,
    workerWakes,
    callbackCodes: responses.map((response) => response.status),
    durableSmsClaimPrecedesProviderFetch: true,
  };
  fs.writeFileSync(
    require("path").join(__dirname, "..", "artifacts", "T095-EDGE-FALLBACK-RACE-RESULTS.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log("PASS", JSON.stringify(result));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
