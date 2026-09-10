const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

const root = path.resolve(__dirname, "..");
const dashboard = fs.readFileSync(path.join(root, "admin-dashboard.js"), "utf8");
const localesSource = fs.readFileSync(path.join(root, "admin-locales.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin", "index.html"), "utf8");
// Immutable LF-normalized expectations from accepted snapshot 97ceb552fae2bb534a637c9fac8fe0444f99905d.
const section = (source, start, end) => {
  const first = source.indexOf(start);
  const last = end ? source.indexOf(end, first) : source.length;
  assert.ok(first >= 0 && last > first, `missing source section ${start}`);
  return source.slice(first, last).replace(/\r\n/g, "\n");
};

const context = {};
vm.createContext(context);
vm.runInContext(localesSource, context, { filename: "admin-locales.js" });
const packs = context.OwAdminLocalePacks;
assert.ok(packs, "locale packs must install on globalThis");
assert.deepEqual(Object.keys(packs), ["es", "de", "ru", "zh", "pt"]);

const coStart = dashboard.indexOf("OwAdminCoCopy = Object.freeze({");
const coEnd = dashboard.indexOf("}), OwAdminMembershipLabel", coStart);
assert.ok(coStart >= 0 && coEnd > coStart, "Colombian Spanish dictionary must remain present");
const coBlock = dashboard.slice(coStart, coEnd);
const requiredKeys = [...coBlock.matchAll(/^  "([^"]+)":/gm)].map((match) => match[1]);
assert.ok(requiredKeys.length >= 200, `expected complete Admin dictionary, found ${requiredKeys.length}`);

for (const language of ["de", "ru", "zh", "pt"]) {
  const missing = requiredKeys.filter((key) => !Object.prototype.hasOwnProperty.call(packs[language], key));
  assert.deepEqual(missing, [], `${language} is missing controlled interface keys`);
}

assert.equal(packs.es["Accepted monthly rent"], "Alquiler mensual aceptado");
assert.match(dashboard, /\(t === "co" \|\| t === "es"\).*OwAdminCoCopy/);
assert.match(dashboard, /OwAdminExtraCopy = globalThis\.OwAdminLocalePacks/);
assert.match(dashboard, /Object\.prototype\.hasOwnProperty\.call\(r, e\)/);
assert.match(dashboard, /return e;/, "unknown values must remain byte-for-byte unchanged");

for (const language of ["en", "co", "es", "de", "ru", "zh", "pt"]) {
  assert.match(dashboard, new RegExp(`value: "${language}"`), `picker is missing ${language}`);
  assert.match(dashboard, new RegExp(`${language}: \\{ locale:`), `locale metadata is missing ${language}`);
}
assert.match(dashboard, /t === "cn" \? "zh" : t === "br" \? "pt" : t/);
assert.match(dashboard, /document\.documentElement\.lang = OwAdminLanguages\[language\]\.html/);
assert.match(dashboard, /\["overview", "Overview"\].*\["growth", "Growth"\].*\["people", "People"\].*\["money", "Money"\].*\["ops", "Ops"\]/s);

assert.match(dashboard, /OwAdminMembershipLabel\(w\.membership, C\)/);
assert.match(dashboard, /note: C\(a\.amount_scope\)/);
assert.match(dashboard, /C\(c\.label\)/);
assert.match(dashboard, /note: C\(l\.commitment_scope\)/);
assert.match(dashboard, /C\(l\.decision_question \|\|/);

assert.match(dashboard, /class OwAdminAccessBoundary/);
assert.match(dashboard, /Ti\.rpc\("is_platform_admin"\)/);
assert.match(dashboard, /Ti\.rpc\("admin_external_payment_help_queue"/);
assert.match(dashboard, /Ti\.rpc\("admin_mark_external_payment_help_in_review"/);
assert.match(dashboard, /text\(copy\[kind\]\)/, "access gate headings must use the same exact-key translator");
assert.equal(
  sha256(section(dashboard, "function OwPaymentHelpDate", "function ow(")),
  "121042820d48124485c91e125fbf4b669a9ca346da8b06d546cf3e692a574a27",
  "payment-help controller and mutation gates must remain byte-identical"
);
const rpcCalls = (source) => [...source.matchAll(/Ti\.rpc\("([^"]+)"/g)].map((match) => match[1]);
assert.equal(sha256(JSON.stringify(rpcCalls(dashboard))), "cb563efa9b171833e88d1cfac8068474fc6c88bb94c29f460a17617acd96c77b", "RPC call names and sequence must not change");
assert.equal(sha256(section(dashboard, "  async function check() {", "  const { data: { subscription } }")), "e27c5269a54233c0bb33f2e29c9e8223aab21ee3143b9dc92af673c944ce6b7c", "Actual access check must remain unchanged");

const localeScript = adminHtml.indexOf("/admin-locales.js?v=20260910-admin7");
const dashboardScript = adminHtml.indexOf("/admin-dashboard.js?v=20260910-admin7-access2");
assert.ok(localeScript >= 0 && dashboardScript > localeScript, "locale packs must load before the Admin module");

console.log(`admin seven-locale contract: PASS (${requiredKeys.length} controlled keys × 4 full packs; Spain inherits CO with regional overrides)`);
