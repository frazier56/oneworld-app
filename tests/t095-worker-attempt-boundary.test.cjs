const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("C:/Dev/Projects/One Social/_t090_language_overlay_release_20260910/oneworld-app/node_modules/typescript");

const source = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "functions", "process-event-rolodex-broadcast", "index.ts"),
  "utf8",
);
const from = source.indexOf("    const sendTwilioMessage = async (");
const to = source.indexOf("    const retryDelayMs =", from);
assert(from >= 0 && to > from, "nested worker function boundary");
const part = source.slice(from, to) + "\nglobalThis.send = sendTwilioMessage;";

async function scenario(mode) {
  let dispatchState = "new";
  let providerRequests = 0;
  let quarantines = 0;
  let rpcCalls = 0;
  const admin = {
    rpc: async (name) => {
      rpcCalls += 1;
      if (name === "oneevent_claim_sms_provider_dispatch") {
        dispatchState = "processing";
        return { data: [{ should_send: true, state: "processing", attempt_count: 1 }], error: null };
      }
      assert.equal(name, "oneevent_authorize_sms_provider_attempt");
      if (mode === "delivery_before_authorization") {
        dispatchState = "cancelled";
        return { data: [{ authorized: false, state: "cancelled" }], error: null };
      }
      dispatchState = "in_flight";
      if (mode === "forced_cancel_after_authorization") dispatchState = "cancelled";
      return { data: [{ authorized: true, state: "in_flight" }], error: null };
    },
    from: () => ({
      update(values) {
        const filters = {};
        const query = {
          eq(key, value) { filters[key] = value; return query; },
          select() { return query; },
          async maybeSingle() {
            if (filters.state && filters.state !== dispatchState) return { data: null, error: null };
            dispatchState = values.state;
            return { data: { id: "dispatch-test" }, error: null };
          },
        };
        return query;
      },
    }),
  };
  const context = {
    admin,
    twilioAccountSid: "synthetic-account",
    twilioApiKeySid: "synthetic-key",
    twilioApiKeySecret: "synthetic-secret",
    TWILIO_MESSAGING_SERVICE_SID: "synthetic-service",
    TWILIO_SMS_FROM: "+15555550195",
    TWILIO_WHATSAPP_FROM: "+15555550195",
    btoa: (value) => Buffer.from(value).toString("base64"),
    URLSearchParams,
    Response,
    quarantineBroadcast: async () => { quarantines += 1; },
    fetch: async () => {
      providerRequests += 1;
      return new Response(JSON.stringify({
        sid: "SM00000000000000000000000000000951",
        status: "queued",
      }), { status: 201 });
    },
  };
  vm.runInNewContext(ts.transpileModule(part, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText, context);
  const result = await context.send(
    { id: "synthetic-recipient", broadcast_id: "synthetic-broadcast" },
    "+15555550195",
    "sms",
    { body: "synthetic test" },
  );
  return { mode, dispatchState, providerRequests, quarantines, rpcCalls, result };
}

(async () => {
  const cancelled = await scenario("delivery_before_authorization");
  assert.equal(cancelled.providerRequests, 0);
  assert.equal(cancelled.dispatchState, "cancelled");
  assert.equal(cancelled.result.status, "skipped");

  const inFlight = await scenario("authorization_before_delivery");
  assert.equal(inFlight.providerRequests, 1);
  assert.equal(inFlight.dispatchState, "accepted");
  assert.equal(inFlight.result.status, "queued");

  const guarded = await scenario("forced_cancel_after_authorization");
  assert.equal(guarded.providerRequests, 1, "provider request crossed the explicit in-flight boundary");
  assert.equal(guarded.dispatchState, "cancelled", "conditional finalization must not resurrect cancelled");
  assert.equal(guarded.quarantines, 1);
  assert.equal(guarded.result.status, "failed");

  const output = {
    exactNestedWorkerFunction: true,
    network: false,
    productionWrites: false,
    cases: [cancelled, inFlight, guarded],
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "artifacts", "T095-WORKER-ATTEMPT-BOUNDARY-RESULTS.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log("PASS", JSON.stringify(output));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
