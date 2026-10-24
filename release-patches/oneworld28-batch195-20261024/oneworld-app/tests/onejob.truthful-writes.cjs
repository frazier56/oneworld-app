/* OneJob money path tells the truth (OJ-173-RECOVERY-05 / ACCEPT02; ONEJOB 2's fix re-applied on 192 by ONEWORLD 31).
   Transpiles the REAL lib/jobloop.ts with esbuild, swaps only its Supabase client for a scripted fake, and drives
   acceptAgreement / declineAgreement / markComplete through refused, lost (empty code) and silently-filtered writes.
   Run: node oneworld-app/tests/onejob.truthful-writes.cjs */
const { execFileSync } = require("node:child_process");
const path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const root = path.resolve(__dirname, "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oj-"));
fs.copyFileSync(process.env.JOBLOOP || path.join(root, "src/products/onejob/lib/jobloop.ts"), path.join(dir, "jobloop.ts"));
fs.writeFileSync(path.join(dir, "supabase.js"), `
const g = globalThis;
function q(table) {
  const st = { table, op: "select", payload: null, wantRows: false, columns: null };
  const api = {
    update(p) { st.op = "update"; st.payload = p; return api; },
    insert(p) { st.op = "insert"; st.payload = p; return api; },
    select(c) { if (st.op !== "select") st.wantRows = true; else st.columns = c; return api; },
    eq() { return api; }, in() { return api; }, or() { return api; }, order() { return api; }, limit() { return api; },
    maybeSingle() { return api; }, single() { return api; },
    then(res, rej) { g.__log.push(st.table + ":" + st.op); if (st.op === "select") g.__cols.push(st.table + ":" + st.columns);
      return Promise.resolve().then(() => g.__script(st)).then(r => (r && r.__throw) ? Promise.reject(r.__throw) : r).then(res, rej); },
  };
  return api;
}
exports.supabase = {
  from: q,
  rpc: async (name, args) => { g.__log.push("rpc:" + name); g.__notes.push(args); if (g.__rpcDelay) await new Promise(z => setTimeout(z, g.__rpcDelay)); return { error: null }; },
  functions: { invoke: async (name) => { g.__log.push("fn:" + name); return g.__fn(name); } },
};`);
fs.writeFileSync(path.join(dir, "shellStub.js"), `exports.systemEvent = (event, params) => ({ event, params });`);
const out = path.join(dir, "jobloop.cjs");
execFileSync(path.join(root, "node_modules", ".bin", "esbuild"), [path.join(dir, "jobloop.ts"), "--bundle", "--platform=node", "--format=cjs", `--outfile=${out}`, "--log-level=error", `--alias:@oneworld/shell=${path.join(dir, "shellStub.js")}`], { stdio: "inherit" });
let pass = 0, fail = 0; const ok = (n, v, i) => { if (v) { pass++; console.log("  PASS ", n); } else { fail++; console.log("  FAIL ", n, i ?? ""); } };
const AG = { id: "ag1", title: "Paint the fence", sender_id: "payer", recipient_id: "pro", payer_id: "payer", payee_id: "pro", conversation_id: "c1", start_date: "2026-11-01", payment_rail: "card" };
const EX = { id: "ex1", agreement_id: "ag1", host_id: "payer", talent_id: "pro", host_completed: false, talent_completed: false };
function load(script, fn = () => ({ data: { ok: true, captured: true, amount: 100 }, error: null })) {
  delete require.cache[out];
  globalThis.__log = []; globalThis.__notes = []; globalThis.__cols = []; globalThis.__rpcDelay = 0; globalThis.__script = script; globalThis.__fn = fn;
  const orig = console.error, origw = console.warn; console.error = () => {}; console.warn = () => {};
  const m = require(out); return { m, restore: () => { console.error = orig; console.warn = origw; } };
}
const REFUSED = { data: null, error: { code: "42501", message: "permission denied" } };
const LOST = { data: null, error: { code: "", message: "TypeError: Failed to fetch" } };
const NONE = { data: [], error: null };          // RLS filtered the UPDATE: zero rows, no error
const ONE = { data: [{ id: "x" }], error: null };   // a row, but NOT the one we wrote
const ROW = (id) => ({ data: [{ id }], error: null });
const OKALL = st => st.op === "update" ? ROW(st.table === "agreements" ? "ag1" : "ex1") : st.op === "insert" ? { data: { id: "new1" }, error: null } : { data: null, error: null };
(async () => {
  // ACCEPT
  { const { m, restore } = load(st => st.table === "agreements" && st.op === "update" ? REFUSED : OKALL(st));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("accept: refused status write after capture → ok false", r.ok === false, r);
    ok("accept: the member is told the payment went through and not to pay again", /payment for this contract went through/i.test(r.error || "") && /needs to pay again/.test(r.error || ""), r.error);
    ok("accept: no 'Contract accepted' system message, no notification", !globalThis.__log.includes("messages:insert") && globalThis.__notes.length === 0, globalThis.__log); }
  { const { m, restore } = load(st => st.table === "agreements" && st.op === "update" ? NONE : OKALL(st));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("accept: a zero-row (RLS-filtered) update is a refusal, not a success", r.ok === false, r); }
  { let reads = 0;
    const { m, restore } = load(st => st.table === "agreements" && st.op === "update" ? LOST
      : st.table === "agreements" && st.op === "select" ? (reads++, { data: { id: "ag1", status: "accepted" }, error: null }) : OKALL(st));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("accept: a lost answer is settled by READING the row, not by writing again", reads === 1 && globalThis.__log.filter(x => x === "agreements:update").length === 1, globalThis.__log);
    ok("accept: the read says accepted → ok true, one notification", r.ok === true && globalThis.__notes.length === 1, r); }
  { const { m, restore } = load(OKALL);
    const r1 = await m.acceptAgreement(AG, "pro"); const r2 = await m.acceptAgreement(AG, "pro"); restore();
    ok("accept: success twice notifies once", r1.ok && r2.ok && globalThis.__notes.length === 1, globalThis.__notes.length); }
  // DECLINE
  { const { m, restore } = load(st => st.table === "agreements" && st.op === "update" ? REFUSED : OKALL(st), () => ({ data: { released: true }, error: null }));
    const r = await m.declineAgreement(AG, "pro"); restore();
    ok("decline: refused → ok false, hold NOT released, nothing announced", r.ok === false && !globalThis.__log.includes("fn:release-contract-hold") && globalThis.__notes.length === 0, globalThis.__log); }
  { const { m, restore } = load(OKALL, () => ({ data: { released: true }, error: null }));
    const r = await m.declineAgreement(AG, "pro"); restore();
    ok("decline: success → ok true, hold released", r.ok === true && r.released === true, r); }
  // COMPLETE
  { const { m, restore } = load(st => st.table === "job_executions" && st.op === "update" ? NONE : OKALL(st));
    const r = await m.markComplete(EX, "pro"); restore();
    ok("complete: a zero-row update → ok false, the other side is not told", r.ok === false && globalThis.__notes.length === 0, r); }
  { const { m, restore } = load(st => st.table === "job_executions" && st.op === "select" ? { data: { ...EX, host_completed: false }, error: null } : OKALL(st));
    const r = await m.markComplete(EX, "pro"); restore();
    ok("complete: one side done → ok true, both false, one notification", r.ok === true && r.both === false && globalThis.__notes.length === 1, r); }
  // ── Max W12 review cases (23 Oct 2026) ──
  { const { m, restore } = load(st => st.table === "agreements" && st.op === "update" ? ONE : OKALL(st));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12: an update answered with a DIFFERENT row id is not confirmation", r.ok === false, r); }
  { const { m, restore } = load(st => st.op === "update" ? LOST : st.op === "select" ? { data: null, error: { code: "", message: "lost" } } : OKALL(st), () => ({ data: { released: true }, error: null }));
    const r = await m.declineAgreement(AG, "pro"); restore();
    ok("W12-UNKNOWN decline: lost write + failed read → 'unknown', never 'Nothing has changed'", r.ok === false && r.outcome === "unknown" && !/Nothing has changed/.test(r.error), r); }
  { const { m, restore } = load(st => st.op === "update" ? LOST : st.op === "select" ? { data: null, error: { code: "", message: "lost" } } : OKALL(st));
    const r = await m.markComplete(EX, "pro"); restore();
    ok("W12-UNKNOWN complete: lost write + failed read → 'unknown', never 'Nothing has changed'", r.ok === false && r.outcome === "unknown" && !/Nothing has changed/.test(r.error), r); }
  { const { m, restore } = load(st => st.op === "update" ? LOST : st.op === "select" ? { data: null, error: { code: "", message: "lost" } } : OKALL(st));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12-UNKNOWN accept after capture: keeps captured, says don't pay again, says unconfirmed", r.ok === false && r.captured === true && r.outcome === "unknown" && /nobody needs to pay again/.test(r.error) && /couldn't confirm/.test(r.error), r); }
  { const { m, restore } = load(st => st.table === "agreements" && st.op === "update" ? { __throw: new Error("socket hang up") } : st.op === "select" ? { data: null, error: { code: "", message: "lost" } } : OKALL(st));
    let r, threw = false; try { r = await m.acceptAgreement(AG, "pro"); } catch (e) { threw = true; } restore();
    ok("W12-UNKNOWN a THROWN status write after capture does not escape and keeps captured", !threw && r && r.ok === false && r.captured === true && /pay again/.test(r.error), { threw, r }); }
  { const { m, restore } = load(st => st.table === "job_executions" && st.op === "insert" ? REFUSED : OKALL(st));
    const r = await m.acceptAgreement(AG, "pro"); const msgs = globalThis.__log; restore();
    ok("W12-SCHEDULE: a refused calendar insert → accepted but scheduled:false, with a truthful warning", r.ok === true && r.scheduled === false && /isn't on the calendar/.test(r.error || ""), r); }
  { let sys = ""; const { m, restore } = load(st => { if (st.table === "messages" && st.op === "insert") sys = st.payload.content; return st.table === "job_executions" && st.op === "insert" ? REFUSED : OKALL(st); });
    await m.acceptAgreement(AG, "pro"); restore();
    ok("W12-SCHEDULE: the chat line does not say 'the job is scheduled'", !/the job is scheduled/.test(sys) && /not on the calendar/.test(sys), sys); }
  { const { m, restore } = load(OKALL); globalThis.__rpcDelay = 40;
    await Promise.all([m.acceptAgreement(AG, "pro"), m.acceptAgreement(AG, "pro")]); restore();
    ok("W12-NOTIFY: two concurrent accepts send ONE notification", globalThis.__notes.length === 1, globalThis.__notes.length); }
  { const both = { ...EX, host_completed: true };
    const { m, restore } = load(st => st.table === "agreements" && st.op === "select" ? { data: { payment_rail: "external" }, error: null } : OKALL(st));
    await m.markComplete(both, "pro"); await m.markComplete(both, "pro"); restore();
    ok("W12-NOTIFY: the final 'Job completed' notice goes once per job", globalThis.__notes.filter(n => n.n_type === "job_completed").length === 1, globalThis.__notes.map(n => n.n_type)); }
  { const { m, restore } = load(OKALL, () => ({ data: null, error: null }));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12: an empty payments reply is not a success — nothing is written", r.ok === false && r.outcome === "unknown" && !globalThis.__log.includes("agreements:update"), r); }
  { const { m, restore } = load(OKALL, () => ({ data: { ok: true, captured: "false" }, error: null }));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12: captured must be a real true (the string 'false' is not a capture)", r.ok === true && r.captured === false, r); }
  { const { m, restore } = load(st => st.op === "update" ? LOST : st.op === "select" ? { data: { id: "ag1", status: "accepted" }, error: null } : OKALL(st));
    await m.acceptAgreement(AG, "pro"); restore();
    ok("W12: the settlement read asks for id + status only, never *", globalThis.__cols.some(c => c === "agreements:id, status") && !globalThis.__cols.some(c => /\*/.test(c)), globalThis.__cols); }
  { const { m, restore } = load(st => st.table === "agreements" && st.op === "update" ? REFUSED : OKALL(st));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12: support gets a contract reference, not just the title", /#ag1/.test(r.error || ""), r.error); }
  // ── Max W12R2 (23 Oct 2026) ──
  { const { m, restore } = load(st => st.table === "messages" && st.op === "insert" ? { __throw: new Error("socket") } : OKALL(st));
    let r, threw = false; try { r = await m.acceptAgreement(AG, "pro"); } catch (e) { threw = true; } restore();
    ok("W12R2-POSTCOMMIT: a chat line that throws after acceptance keeps ok + captured, as a warning", !threw && r.ok === true && r.captured === true && r.warnings.includes("chat"), { threw, r }); }
  { const { m, restore } = load(OKALL, () => ({ data: null, error: { name: "FunctionsFetchError", message: "Failed to send a request" } }));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12R5-PAYMENT-UNKNOWN: a lost payments answer is 'unknown', says the honest line (no absolute claim), writes nothing", r.ok === false && r.outcome === "unknown" && /^We couldn't confirm this payment\. Check Payments before you try again\. Contract #ag1\.$/.test(r.error) && !/never|safe to|charge twice|not charged|wasn't charged/i.test(r.error) && !globalThis.__log.includes("agreements:update"), r); }
  /* ORCHESTRATOR ruling, 23 Oct 2026 (World12 round 4): a 5xx from the payments function is not a refusal —
     it must read as unknown with the same honest line, never a definite "we couldn't collect". */
  { const { m, restore } = load(OKALL, () => ({ data: null, error: { name: "FunctionsHttpError", message: "502", context: { status: 502, json: async () => ({ error: "We couldn't collect the payment." }) } } }));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12R5: a 5xx from payments is 'unknown' with the honest line, never a definite 'couldn't collect'", r.ok === false && r.outcome === "unknown" && /^We couldn't confirm this payment\. Check Payments before you try again\./.test(r.error) && !/couldn't collect/.test(r.error), r); }
  { const { m, restore } = load(OKALL, () => ({ data: { ok: "yes" }, error: null }));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12R5: a malformed reply gets the same honest line", r.outcome === "unknown" && /^We couldn't confirm this payment\./.test(r.error), r); }
  { const { m, restore } = load(OKALL, () => { throw new Error("boom"); });
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12R5: a thrown payments call gets the same honest line", r.outcome === "unknown" && /^We couldn't confirm this payment\./.test(r.error), r); }
  { const { m, restore } = load(OKALL, () => ({ data: null, error: { name: "FunctionsHttpError", message: "409", context: { status: 409, json: async () => ({ error: "This contract is no longer open, so it can't be accepted." }) } } }));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12R2-PAYMENT: the function's own refusal is 'refused' with its sentence", r.ok === false && r.outcome === "refused" && /no longer open/.test(r.error), r); }
  { const { m, restore } = load(OKALL, () => ({ data: {}, error: null }));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12R2: an empty object reply is not a success", r.ok === false && r.outcome === "unknown", r); }
  { const { m, restore } = load(st => st.table === "job_executions" && st.op === "insert" ? LOST : st.table === "job_executions" && st.op === "select" ? { data: [{ id: "ex9" }], error: null } : OKALL(st));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12R2-SCHEDULE-UNKNOWN: a lost calendar insert that DID land reads back as scheduled", r.ok === true && r.scheduled === true && !r.scheduleUnknown, r); }
  { const { m, restore } = load(st => st.table === "job_executions" && st.op === "insert" ? LOST : st.table === "job_executions" && st.op === "select" ? { data: null, error: { code: "", message: "lost" } } : OKALL(st));
    const r = await m.acceptAgreement(AG, "pro"); restore();
    ok("W12R2-SCHEDULE-UNKNOWN: lost insert + failed read = unknown, never 'isn't on the calendar'", r.ok === true && r.scheduleUnknown === true && /couldn't confirm the calendar entry/.test(r.error) && !/isn't on the calendar/.test(r.error), r); }
  { const { m, restore } = load(OKALL, () => ({ data: { released: "false" }, error: null }));
    const r = await m.declineAgreement(AG, "pro"); restore();
    ok("W12R2: decline's released must be a real true", r.ok === true && r.released === false, r); }
  // ── reader-language events (overlay-14) ──
  { const { m, restore } = load(OKALL); let sys = null; globalThis.__script = st => { if (st.table === "messages" && st.op === "insert") sys = st.payload; return OKALL(st); };
    await m.acceptAgreement(AG, "pro"); restore();
    ok("events: the accept chat line carries contract_accepted_line + params", sys && sys.metadata && sys.metadata.event === "contract_accepted_line" && sys.metadata.params.title === "Paint the fence" && sys.metadata.params.money === "vault", sys && sys.metadata);
    ok("events: the accept notification carries n_meta agreement_accepted", globalThis.__notes[0] && globalThis.__notes[0].n_meta && globalThis.__notes[0].n_meta.event === "agreement_accepted" && globalThis.__notes[0].n_meta.params.captured === true, globalThis.__notes[0]); }
  console.log(`\n${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
})();
