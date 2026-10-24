/* lib/systemMessages.ts — the real module (with the real i18n) transpiled by esbuild. Run: node oneworld-shell/tests/shell.system-messages.cjs */
const { execFileSync } = require("node:child_process"); const path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const root = path.resolve(__dirname, ".."); const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sm-")), "sm.cjs");
execFileSync(path.join(root, "node_modules", ".bin", "esbuild"), [path.join(root, "src/lib/systemMessages.ts"), "--bundle", "--platform=node", "--format=cjs", `--outfile=${out}`, "--log-level=error", "--external:react"], { stdio: "inherit" });
const m = require(out);
let pass = 0, fail = 0; const ok = (n, v, i) => { if (v) { pass++; console.log("  PASS ", n); } else { fail++; console.log("  FAIL ", n, i ?? ""); } };
const acc = m.systemEvent("contract_accepted_line", { title: "Paint the fence", scheduled: true, money: "vault" });
ok("en line", m.renderSystemText("en", acc, "STORED") === '✅ Contract accepted: "Paint the fence" — the job is scheduled. The payment has been collected into the OneJob Vault and stays there until you both mark the job complete.', m.renderSystemText("en", acc, "S"));
ok("es line (reader's language, not the writer's)", /^✅ Contrato aceptado: "Paint the fence" — el trabajo está programado\. El pago se cobró/.test(m.renderSystemText("es", acc, "STORED")));
ok("co reads Spanish", m.renderSystemText("co", acc, "S") === m.renderSystemText("es", acc, "S"));
for (const l of ["de", "pt", "ru", "zh"]) ok(`${l} line is translated`, m.renderSystemText(l, acc, "STORED") !== m.renderSystemText("en", acc, "STORED") && m.renderSystemText(l, acc, "S").includes("Paint the fence"));
ok("scheduled:false says it is not on the calendar", /not on the calendar/.test(m.renderSystemText("en", m.systemEvent("contract_accepted_line", { title: "X", scheduled: false }), "S")));
ok("unknown event → stored text", m.renderSystemText("es", { event: "nope", params: { title: "X" } }, "STORED") === "STORED");
ok("missing required param → stored text", m.renderSystemText("es", { event: "contract_accepted_line", params: {} }, "STORED") === "STORED");
ok("no metadata → stored text", m.renderSystemText("es", null, "STORED") === "STORED");
ok("isLocalizedSystemLine only for known events", m.isLocalizedSystemLine(acc) === true && m.isLocalizedSystemLine({ event: "nope" }) === false && m.isLocalizedSystemLine(null) === false);
const n = m.renderNotification("de", { title: "Contract accepted ✅", body: "x", metadata: m.systemEvent("agreement_accepted", { title: "Zaun", captured: true }) });
ok("notification de", n.title === "Vertrag angenommen ✅" && /„Zaun“ läuft\. Die Zahlung liegt jetzt im OneJob-Tresor/.test(n.body), n);
ok("notification without event keeps stored title/body", JSON.stringify(m.renderNotification("es", { title: "T", body: "B", metadata: { from: "x" } })) === '{"title":"T","body":"B"}');
ok("decline released vs not", /liberada/.test(m.renderNotification("es", { metadata: m.systemEvent("agreement_declined", { title: "X", released: true }) }).body) && /7 días/.test(m.renderNotification("es", { metadata: m.systemEvent("agreement_declined", { title: "X", released: false }) }).body));
ok("job_marked_complete by hirer vs professional", /Quien contrató/.test(m.renderNotification("es", { metadata: m.systemEvent("job_marked_complete", { title: "X", by: "hirer" }) }).body) && /El profesional/.test(m.renderNotification("es", { metadata: m.systemEvent("job_marked_complete", { title: "X", by: "professional" }) }).body));
const ev = m.systemEvent("x", { title: "a".repeat(500), obj: { a: 1 }, fn: () => 1, n: 3, b: false });
ok("systemEvent keeps plain values only and cuts long text", ev.params.title.length === 200 && !("obj" in ev.params) && !("fn" in ev.params) && ev.params.n === 3 && ev.params.b === false);
ok("a parameter is text, never a template ({money} inside a title stays literal)", m.renderSystemText("en", m.systemEvent("contract_accepted_line", { title: "{money}<b>", scheduled: true }), "S").includes('"{money}<b>"'));
const pe = m.renderNotification("es", { title: "T", body: "B", metadata: m.systemEvent("event_payment_confirmed", { method: "Wise", eventTitle: "Feria" }) });
ok("OneEvent: event_payment_confirmed in Spanish, method kept as a name", pe.title === "Su pago por Wise fue confirmado" && /entrada para "Feria" ya está activa/.test(pe.body), pe);
ok("OneEvent: without eventTitle", /su entrada ya está activa/.test(m.renderNotification("es", { metadata: m.systemEvent("event_payment_confirmed", { method: "PayPal" }) }).body));
ok("accepted notice is role-neutral (no 'Your payment')", !/Your payment|Su pago|Ihre Zahlung/.test(["en","es","de"].map(l => m.renderNotification(l, { metadata: m.systemEvent("agreement_accepted", { title: "X", captured: true }) }).body).join(" ")));
/* Max, E9 review (23 Oct): inherited names and odd shapes must fall back to the stored text and never throw. */
const noThrow = (fn) => { try { return { v: fn() }; } catch (e) { return { err: String(e && e.message) }; } };
for (const evn of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
  const md = JSON.parse(`{"event":${JSON.stringify(evn)},"params":{"title":"X","method":"Wise"}}`);
  const a = noThrow(() => m.renderNotification("es", { title: "T", body: "B", metadata: md }));
  const b = noThrow(() => m.renderSystemText("es", md, "STORED"));
  const c = noThrow(() => m.isLocalizedSystemLine(md));
  ok(`event "${evn}" → stored text, no throw`, a.v && a.v.title === "T" && a.v.body === "B" && b.v === "STORED" && c.v === false, [a, b, c]);
}
const odd = [[], "str", 42, true, { event: 7 }, { event: "agreement_accepted", params: ["X"] }, { event: "agreement_accepted", params: "X" }, { event: "agreement_accepted", params: null },
  JSON.parse('{"event":"contract_accepted_line","params":{"title":"X","money":"__proto__"}}'), JSON.parse('{"event":"contract_accepted_line","params":{"title":"X","money":"toString"}}'),
  JSON.parse('{"event":"agreement_accepted","params":{"__proto__":{"title":"X"}}}'), Object.create({ event: "agreement_accepted", params: { title: "X" } })];
odd.forEach((md, i) => {
  const a = noThrow(() => m.renderNotification("es", { title: "T", body: "B", metadata: md }));
  const b = noThrow(() => m.renderSystemText("es", md, "STORED"));
  ok(`odd metadata #${i} never throws and stays a string`, a.v && typeof a.v.title === "string" && typeof a.v.body === "string" && typeof b.v === "string" && !/undefined|\[object/.test(a.v.title + a.v.body + b.v), [a, b]);
});
ok("money:'__proto__' adds nothing to a known line", noThrow(() => m.renderSystemText("en", JSON.parse('{"event":"contract_accepted_line","params":{"title":"X","scheduled":true,"money":"__proto__"}}'), "S")).v === '✅ Contract accepted: "X" — the job is scheduled.');
ok("a row with no title/body and an odd event → empty strings", JSON.stringify(noThrow(() => m.renderNotification("es", { metadata: { event: "constructor" } })).v) === '{"title":"","body":""}');
ok("a missing notification object never throws", JSON.stringify(noThrow(() => m.renderNotification("es", undefined)).v) === '{"title":"","body":""}');
ok("odd reader language falls back, never throws", typeof noThrow(() => m.renderSystemText("__proto__", acc, "STORED")).v === "string" && typeof noThrow(() => m.renderNotification("constructor", { title: "T", metadata: acc })).v.title === "string");
console.log(`\n${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
