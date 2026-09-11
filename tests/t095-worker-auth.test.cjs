const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("C:/Dev/Projects/One Social/_t090_language_overlay_release_20260910/oneworld-app/node_modules/typescript");

const source = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "functions", "process-event-rolodex-broadcast", "index.ts"),
  "utf8",
);
const safeRollbackSource = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "supabase",
    "rollbacks",
    "edge",
    "process-event-rolodex-broadcast-v31-safe",
    "process-event-rolodex-broadcast",
    "index.ts",
  ),
  "utf8",
);
assert(safeRollbackSource.includes('if (!token || token !== serviceKey) return json({ error: "Forbidden" }, 403);'));
assert(!safeRollbackSource.includes("claims?.role === \"service_role\""));
const rollbackSyntax = ts.transpileModule(safeRollbackSource.replace(/^import .*\n/gm, ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  reportDiagnostics: true,
});
assert.equal(
  (rollbackSyntax.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error).length,
  0,
);
let handler;
let clientCreations = 0;
const serviceKey = "synthetic-service-key-exact-match";
const query = {
  select() { return query; },
  eq() { return query; },
  is() { return query; },
  order() { return query; },
  limit() { return query; },
  async maybeSingle() { return { data: null, error: null }; },
};
const code = ts.transpileModule(source.replace(/^import .*\n/gm, ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
vm.runInNewContext(code, {
  Deno: {
    env: { get: (name) => ({
      SUPABASE_URL: "https://test.invalid",
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    })[name] },
    serve: (value) => { handler = value; },
  },
  createClient: () => {
    clientCreations += 1;
    return { from: () => query };
  },
  canonicalizePhone: (value) => value,
  TextEncoder,
  URL,
  Request,
  Response,
  FormData,
  crypto: require("crypto").webcrypto,
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
  console,
  setTimeout,
  clearTimeout,
  fetch: async () => new Response("ok"),
});

function post(token) {
  const headers = { "content-type": "application/json" };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  return handler(new Request("https://test.invalid/functions/v1/process-event-rolodex-broadcast", {
    method: "POST",
    headers,
    body: "{}",
  }));
}

(async () => {
  const forgedPayload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  const forged = `x.${forgedPayload}.invalid-signature`;
  const missingResponse = await post(undefined);
  const forgedResponse = await post(forged);
  assert.equal(missingResponse.status, 403);
  assert.equal(forgedResponse.status, 403);
  assert.equal(clientCreations, 0, "invalid callers must not reach privileged database client creation");

  const validResponse = await post(serviceKey);
  assert.equal(validResponse.status, 200);
  assert.equal(clientCreations, 1);

  const output = {
    exactWorkerHandler: true,
    gatewayVerifyJwtLiveBaseline: false,
    productionWrites: false,
    missingTokenStatus: missingResponse.status,
    forgedRoleTokenStatus: forgedResponse.status,
    exactServiceKeyStatus: validResponse.status,
    invalidReachedPrivilegedClient: false,
    safeRollbackRetainsExactServiceKeyAuth: true,
    safeRollbackSyntaxClean: true,
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "artifacts", "T095-WORKER-AUTH-RESULTS.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log("PASS", JSON.stringify(output));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
