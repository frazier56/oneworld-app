/* lib/authStorage.ts — the session store. Transpiles the REAL module (and lib/storeBuild.ts) with esbuild and drives
   it with a fake localStorage and a fake Capacitor Preferences plugin. Run: node oneworld-shell/tests/shell.auth-storage.cjs */
const { execFileSync } = require("node:child_process"); const path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const root = path.resolve(__dirname, ".."); const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "as-")), "as.cjs");
execFileSync(path.join(root, "node_modules", ".bin", "esbuild"), [path.join(root, "src/lib/authStorage.ts"), "--bundle", "--platform=node", "--format=cjs", `--outfile=${out}`, "--log-level=error"], { stdio: "inherit" });
let pass = 0, fail = 0; const ok = (n, v) => { if (v) { pass++; console.log("  PASS ", n); } else { fail++; console.log("  FAIL ", n); } };
function env(native, withPrefs, keep) {
  delete require.cache[out]; const ls = keep ? keep.ls : {}, pr = keep ? keep.pr : {}; const fault = keep ? keep.fault : { set: false, remove: false, lsRemove: false };
  globalThis.localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { if (fault.lsRemove) throw new Error("ls"); delete ls[k]; } };
  const P = { get: async ({ key }) => ({ value: key in pr ? pr[key] : null }),
    set: async ({ key, value }) => { if (fault.set) throw new Error("set"); pr[key] = value; },
    remove: async ({ key }) => { if (fault.remove) throw new Error("rm"); delete pr[key]; } };
  if (withPrefs === "noremove") delete P.remove;
  globalThis.Capacitor = native ? { isNativePlatform: () => true, Plugins: withPrefs ? { Preferences: P } : {} } : undefined;
  return { m: require(out), ls, pr, fault };
}
(async () => {
  { const { m, ls } = env(false); const s = m.authStorage(); s.setItem("k", "v"); ok("web: localStorage holds the session", ls.k === "v" && s.getItem("k") === "v"); }
  { const { m, ls, pr } = env(true, true); const s = m.authStorage(); await s.setItem("k", "v");
    ok("native: Preferences holds the session (mirrored to WebView storage)", pr.k === "v" && ls.k === "v");
    delete ls.k; ok("native: survives the WebView storage being cleared", (await s.getItem("k")) === "v"); }
  { const { m, ls, pr } = env(true, true); ls.k = "old"; const s = m.authStorage();
    ok("native: an existing WebView session is adopted, nobody signed out", (await s.getItem("k")) === "old" && pr.k === "old"); }
  { const { m, ls, pr } = env(true, true); const s = m.authStorage(); await s.setItem("k", "v"); await s.removeItem("k");
    ok("native: Sign out removes it from both", !("k" in pr) && !("k" in ls)); }
  { const { m, ls } = env(true, false); const s = m.authStorage(); s.setItem("k", "v");
    ok("native without the plugin: falls back to localStorage", ls.k === "v"); }
  { const { m } = env(false); m.noteSignedIn(); ok("breadcrumb: signed in + no session = lost", m.sessionWasLost(false) === true);
    ok("breadcrumb: a session present is never lost", m.sessionWasLost(true) === false);
    m.noteSignedOut(); ok("breadcrumb: after Sign out an empty boot is expected", m.sessionWasLost(false) === false); }
  // ── Max / Security W13 (23 Oct 2026) ──
  { const e = env(true, true); const s = e.m.authStorage(); await s.setItem("k", "A"); e.fault.set = true; await s.setItem("k", "B");
    ok("W13-STALE: a failed Preferences write never lets the older session win", (await s.getItem("k")) === "B");
    const e2 = env(true, true, e); ok("W13-STALE: still B after a restart", (await e2.m.authStorage().getItem("k")) === "B");
    e.fault.set = false; const e3 = env(true, true, e); await e3.m.authStorage().getItem("k");
    ok("W13-STALE: Preferences is repaired once it works again", e.pr.k === "B"); }
  { const e = env(true, true); const s = e.m.authStorage(); await s.setItem("k", "A"); e.fault.remove = true; await s.removeItem("k");
    ok("W13-REMOVE: a failed Preferences remove still reads as signed out", (await s.getItem("k")) === null);
    const e2 = env(true, true, e); ok("W13-REMOVE: still signed out after a restart", (await e2.m.authStorage().getItem("k")) === null);
    e.fault.remove = false; const e3 = env(true, true, e); await e3.m.authStorage().getItem("k");
    ok("W13-REMOVE: the removal is retried and completes", !("k" in e.pr)); }
  { const e = env(true, true); const s = e.m.authStorage(); await s.setItem("k", "A"); e.fault.lsRemove = true; await s.removeItem("k");
    const e2 = env(true, true, e);
    ok("W13-REMOVE: a WebView copy left by a failed local remove is never re-adopted", (await e2.m.authStorage().getItem("k")) === null && !("k" in e.pr)); }
  { const e = env(true, true); const s = e.m.authStorage(); await s.setItem("k", "A"); e.fault.remove = true; await s.removeItem("k"); e.fault.remove = false; await s.setItem("k", "C");
    ok("W13-REMOVE: a new sign-in after a failed sign-out works", (await s.getItem("k")) === "C"); }
  { const e = env(true, "noremove"); const s = e.m.authStorage(); s.setItem("k", "v");
    ok("W13: a Preferences bridge without remove() is not used (falls back to localStorage)", e.ls.k === "v" && !("k" in e.pr)); }
  console.log(`\n${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
})();
