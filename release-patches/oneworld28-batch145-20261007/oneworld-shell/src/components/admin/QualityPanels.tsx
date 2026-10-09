/**
 * Two admin-console panels added by ONEHOME30 overlay 43 (3 Oct 2026):
 *
 *  · TestingScoreboard (Ops → Testing). Lee: "viewable in my admin panel so I can see the results
 *    of the testing… performance over time… a scale of 1 to 100." Every test round a lane runs is
 *    recorded with a 1–100 score for each of the nine levels it ran, the bugs it found and whether
 *    each was fixed. The score is computed by the database (`qa_level_score`), never here, so every
 *    lane scores the same way.
 *
 *  · PromoCatalog (Money → Promo codes). Lee: "a whole table because there's different promo codes
 *    for different apps and for different reasons." One list of every promotion in every app —
 *    OneJob's codes, access passes, event-host codes and the catalogue — and, on every row, WHO
 *    PAYS for the discount. Only codes a checkout already reads can be switched on.
 *
 * The admin console is English only by Lee's decision (it is his screen), so copy here is plain
 * English rather than W() pairs.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const previewMode = () => import.meta.env.DEV && typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("adminPreview") === "1";

const CT = "America/Chicago";
const day = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: CT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/* ═════════════════════════════════════════════════════════════════ TESTING SCOREBOARD */

const LEVELS: { key: string; name: string; what: string }[] = [
  { key: "L1", name: "UAT", what: "Works and looks right for a real person" },
  { key: "L2", name: "System integration", what: "A change in one app doesn’t break another" },
  { key: "L3", name: "Regression", what: "Everything ever fixed stays fixed" },
  { key: "L4", name: "Compatibility", what: "Old and new versions work together" },
  { key: "L5", name: "Performance", what: "Fast on a phone on mobile data" },
  { key: "L6", name: "Security", what: "Nobody can do what they shouldn’t — money included" },
  { key: "L7", name: "Accessibility", what: "Tappable, readable, speakable" },
  { key: "L8", name: "Translation", what: "Every screen in all seven languages" },
  { key: "L9", name: "Release check", what: "What was published is really live" },
];

type Finding = { level: string; sev: "P0" | "P1" | "P2" | "P3"; title: string; status: "fixed" | "open"; app?: string; round?: string; run_at?: string };
type Round = { id: string; run_at: string; lane: string; title: string; apps: string[]; package: string | null;
  levels_run: string[]; findings: Finding[]; checks: Record<string, unknown>; scores: Record<string, number>;
  overall: number | null; coverage: number | null; notes: string | null };
type Board = { rounds: Round[]; levels: Record<string, { latest: number | null; average: number | null; runs: number }>; open: Finding[] };

const tone = (score: number | null | undefined) =>
  score == null ? "text-ink/40 dark:text-white/40"
  : score >= 90 ? "text-emerald-700 dark:text-emerald-300"
  : score >= 75 ? "text-amber-700 dark:text-amber-300" : "text-red-600 dark:text-red-300";
const bar = (score: number | null | undefined) =>
  score == null ? "bg-ink/10 dark:bg-white/10" : score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-amber-500" : "bg-red-500";
const SEV: Record<string, string> = {
  P0: "bg-red-600 text-white", P1: "bg-red-500/15 text-red-700 dark:text-red-300",
  P2: "bg-amber-500/15 text-amber-800 dark:text-amber-200", P3: "bg-ink/10 text-ink/70 dark:bg-white/10 dark:text-white/70",
};

const PREVIEW_BOARD: Board = {
  rounds: [
    { id: "r3", run_at: "2026-10-03T18:58:00Z", lane: "ONEHOME30", title: "UAT round 3 — OneHome and OneJob (overlay 42)", apps: ["onehome", "onejob"],
      package: "overlay 42", levels_run: ["L1", "L2", "L3", "L6", "L8", "L9"], checks: { screens: 53, setups: 3 },
      scores: { L1: 100, L2: 100, L3: 100, L6: 87, L8: 87, L9: 99 }, overall: 96, coverage: 6, notes: null,
      findings: [{ level: "L8", sev: "P1", title: "About 340 sentences are English even in Spanish", status: "open" },
                 { level: "L6", sev: "P2", title: "Removing a card could detach another member’s card", status: "fixed" }] },
    { id: "r2", run_at: "2026-10-03T17:04:00Z", lane: "ONEHOME30", title: "UAT + SaaS council (overlays 40, 41)", apps: ["onehome", "onejob"],
      package: "overlays 40, 41", levels_run: ["L1", "L3", "L6", "L8"], checks: {}, scores: { L1: 99, L3: 100, L6: 76, L8: 99 }, overall: 94, coverage: 4, notes: null,
      findings: [{ level: "L6", sev: "P0", title: "A payer could attach a cheaper payment to a contract", status: "fixed" }] },
  ],
  levels: { L1: { latest: 100, average: 100, runs: 3 }, L2: { latest: 100, average: 100, runs: 1 }, L3: { latest: 100, average: 100, runs: 3 },
            L6: { latest: 87, average: 85, runs: 3 }, L8: { latest: 87, average: 93, runs: 2 }, L9: { latest: 99, average: 99, runs: 1 } },
  open: [{ level: "L8", sev: "P1", title: "About 340 sentences are English even in Spanish", status: "open", round: "UAT round 3", run_at: "2026-10-03T18:58:00Z" }],
};

function Trend({ rounds }: { rounds: Round[] }) {
  const points = rounds.filter(r => r.overall != null).slice().reverse();
  if (points.length < 2) {
    return <p className="text-[12px] opacity-55">The line appears after the second round.</p>;
  }
  /* The axis starts just under the lowest score (never above 70), so a change of a few points is
     visible instead of a flat line pinned to the top of a 1–100 box. */
  const lo = Math.max(0, Math.min(70, Math.floor((Math.min(...points.map(p => p.overall!)) - 5) / 5) * 5));
  const W = 320, H = 90, padL = 22, padR = 8, padY = 8;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (points.length - 1);
  const y = (v: number) => H - padY - ((v - lo) / (100 - lo)) * (H - padY * 2);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.overall!).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label="Overall score per round, oldest to newest">
      {[100, Math.round((100 + lo) / 2), lo].map(v => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="stroke-ink/10 dark:stroke-white/10" strokeDasharray="3 3"/>
          <text x={padL - 4} y={y(v) + 3} textAnchor="end" className="fill-ink/45 text-[8px] dark:fill-white/45">{v}</text>
        </g>
      ))}
      <path d={path} fill="none" strokeWidth={2.5} className="stroke-brand"/>
      {points.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.overall!)} r={3.5} className="fill-brand"/>)}
    </svg>
  );
}

export function TestingScoreboard({ isAdmin, nonce }: { isAdmin: boolean; nonce: number }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openRound, setOpenRound] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let dead = false;
    setError(null);
    if (previewMode()) { setBoard(PREVIEW_BOARD); return; }
    void supabase.rpc("admin_qa_scoreboard", { p_days: 180 }).then(({ data, error: e }) => {
      if (dead) return;
      if (e) { setError(e.message); return; }
      setBoard(data as unknown as Board);
    });
    return () => { dead = true; };
  }, [isAdmin, nonce]);

  if (error) return (
    <div className="card p-4 text-[13px]">
      <p className="font-bold">The testing scoreboard isn’t available.</p>
      <p className="mt-1 opacity-65">{error} — this tab needs the admin_qa_scoreboard function released to the database.</p>
    </div>
  );
  if (!board) return <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="card h-24 animate-pulse"/>)}</div>;

  const latest = board.rounds[0];
  const found = (r: Round) => r.findings.length;
  const fixed = (r: Round) => r.findings.filter(f => f.status === "fixed").length;

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold">Testing scoreboard</h3>
            <p className="mt-0.5 text-[12px] opacity-60">
              {latest ? `Latest round ${day(latest.run_at)} · ${latest.coverage ?? 0} of 9 levels run` : "No round recorded yet"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-[34px] font-black leading-none ${tone(latest?.overall)}`}>{latest?.overall ?? "—"}</p>
            <p className="text-[10.5px] font-bold uppercase tracking-wide opacity-50">out of 100</p>
          </div>
        </div>
        <div className="mt-3"><Trend rounds={board.rounds}/></div>
        <p className="mt-1 text-[12px] font-bold">
          {board.open.length ? `${board.open.length} problem${board.open.length === 1 ? "" : "s"} still open` : "Nothing open"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {LEVELS.map(l => {
          const s = board.levels[l.key];
          const score = s?.latest ?? null;
          return (
            <div key={l.key} className="card p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-[13px] font-extrabold">{l.name}</p>
                <p className={`shrink-0 text-[20px] font-black leading-none ${tone(score)}`}>{score ?? "—"}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                <div className={`h-full rounded-full ${bar(score)}`} style={{ width: `${score ?? 0}%` }}/>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug opacity-60">{l.what}</p>
              <p className="mt-1 text-[11px] font-semibold opacity-50">
                {s?.runs ? `Average ${s.average} · ${s.runs} run${s.runs === 1 ? "" : "s"}` : "Not run yet"}
              </p>
            </div>
          );
        })}
      </div>

      {!!board.open.length && (
        <div className="card p-4">
          <h3 className="text-sm font-extrabold">Still open</h3>
          <ul className="mt-2 space-y-2">
            {board.open.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-black ${SEV[f.sev]}`}>{f.sev}</span>
                <span className="min-w-0">{f.title}<span className="opacity-50"> · {LEVELS.find(l => l.key === f.level)?.name ?? f.level}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {board.rounds.map(r => (
          <article key={r.id} className="card p-4">
            <button type="button" className="ow-tap flex w-full items-start justify-between gap-3 text-left"
              onClick={() => setOpenRound(o => o === r.id ? null : r.id)} aria-expanded={openRound === r.id}>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-extrabold leading-snug">{r.title}</span>
                <span className="mt-0.5 block text-[11.5px] opacity-60">
                  {day(r.run_at)} · {r.lane} · {found(r)} found · {fixed(r)} fixed
                </span>
              </span>
              <span className={`shrink-0 text-[22px] font-black leading-none ${tone(r.overall)}`}>{r.overall ?? "—"}</span>
            </button>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LEVELS.filter(l => r.scores[l.key] != null).map(l => (
                <span key={l.key} className="rounded-full border border-ink/10 px-2 py-0.5 text-[11px] font-bold dark:border-white/15">
                  {l.name} <span className={tone(r.scores[l.key])}>{r.scores[l.key]}</span>
                </span>
              ))}
            </div>
            {openRound === r.id && (
              <ul className="mt-3 space-y-1.5 border-t border-ink/10 pt-3 dark:border-white/10">
                {!r.findings.length && <li className="text-[12.5px] opacity-60">No problems found in this round.</li>}
                {r.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px]">
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-black ${SEV[f.sev]}`}>{f.sev}</span>
                    <span className="min-w-0">{f.title}
                      <span className={f.status === "fixed" ? " text-emerald-700 dark:text-emerald-300" : " text-red-600 dark:text-red-300"}>
                        {f.status === "fixed" ? " · fixed" : " · open"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <div className="card p-4 text-[12px] leading-relaxed opacity-70">
        <p className="font-bold opacity-100">How the score works</p>
        <p className="mt-1">
          Each level starts at 100. Every problem found takes points off: a critical one 25, a serious one 10, a medium one 3,
          a small one 1. A problem fixed in the same round costs a quarter of that, because it was there. The overall score is
          the average of the levels the round ran. A level that wasn’t run shows a dash — never a perfect score.
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ PROMO CATALOGUE */

type Promo = { source: "catalog" | "onejob_codes" | "access_passes" | "event_codes"; id: string; code: string | null; name: string;
  app: string; applies_to: string; kind: string; value: number | null; currency: string | null; who_pays: string;
  audience: string | null; purpose: string | null; rules: Record<string, unknown>; max_uses: number | null; uses: number | null;
  starts_at: string | null; expires_at: string | null; active: boolean; engine: "live" | "needs_wiring" };

const APPS: { key: string; label: string }[] = [
  { key: "", label: "All" }, { key: "onehome", label: "OneHome" }, { key: "onejob", label: "OneJob" },
  { key: "oneevent", label: "OneEvent" }, { key: "onescore", label: "OneScore" }, { key: "onesocial", label: "OneSocial" },
  { key: "all", label: "Every app" },
];
const APP_LABEL: Record<string, string> = { onehome: "OneHome", onejob: "OneJob", oneevent: "OneEvent", onescore: "OneScore",
  onesocial: "OneSocial", oneagent: "OneAgent", all: "Every app" };
const TYPE_LABEL: Record<string, string> = { subscription: "Plan", ticket: "Ticket", commission: "Our fee", listing_fee: "Listing fee",
  access_pass: "Access pass", referral: "Referral", test: "Team test" };
const who = (p: Promo) =>
  p.who_pays === "host" ? "The event host, from their ticket price"
  : p.who_pays === "none" ? "Nobody — a team test, nobody is paid on it"
  : p.applies_to === "commission" ? "We do — it comes off our fee, and the pro or host is paid in full"
  : "We do — it comes off our own price";

function describe(p: Promo): string {
  const v = Number(p.value ?? 0);
  switch (p.kind) {
    case "percent_off": return p.applies_to === "commission" ? `${v} percent off our fee` : `${v} percent off`;
    case "amount_off": return `${v} dollars off`;
    case "fixed_price": return p.applies_to === "test" ? `Charges ${v} dollar${v === 1 ? "" : "s"} in total (test)` : `Pays ${v} dollars`;
    case "free": return "Free";
    case "fee_waiver": return "No fee";
    case "free_months": return p.applies_to === "access_pass" ? `${v} days free` : `${v} month${v === 1 ? "" : "s"} free`;
    default: return p.kind;
  }
}

const PREVIEW_PROMOS: Promo[] = [
  { source: "catalog", id: "p1", code: "JOBFEE50", name: "Service fee half off", app: "onejob", applies_to: "commission", kind: "percent_off", value: 50,
    currency: "usd", who_pays: "platform", audience: "Clients from a campaign", purpose: "Halves our 5.99 percent service fee. The pro is paid in full.",
    rules: {}, max_uses: null, uses: 0, starts_at: null, expires_at: null, active: false, engine: "live" },
  { source: "catalog", id: "p2", code: "HOSTFIRST", name: "First stay — no host fee", app: "onehome", applies_to: "commission", kind: "fee_waiver", value: 100,
    currency: "usd", who_pays: "platform", audience: "New hosts", purpose: "Waives our host fee on a host’s first booked stay.",
    rules: { first_only: true }, max_uses: null, uses: 0, starts_at: null, expires_at: null, active: false, engine: "needs_wiring" },
  { source: "event_codes", id: "p3", code: "E20", name: "Event code", app: "oneevent", applies_to: "ticket", kind: "percent_off", value: 20,
    currency: null, who_pays: "host", audience: "Set by the event host", purpose: "Ticket discount on one event",
    rules: {}, max_uses: null, uses: null, starts_at: null, expires_at: null, active: true, engine: "live" },
];

export function PromoCatalog({ isAdmin, nonce }: { isAdmin: boolean; nonce: number }) {
  const [rows, setRows] = useState<Promo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [app, setApp] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let dead = false;
    setError(null);
    if (previewMode()) { setRows(PREVIEW_PROMOS); return; }
    void supabase.rpc("admin_promo_catalog").then(({ data, error: e }) => {
      if (dead) return;
      if (e) { setError(e.message); return; }
      setRows(((data as { rows?: Promo[] } | null)?.rows) ?? []);
    });
    return () => { dead = true; };
  }, [isAdmin, nonce, reload]);

  const shown = useMemo(() => (rows ?? []).filter(r => !app || r.app === app), [rows, app]);

  async function toggle(p: Promo) {
    setBusy(p.id); setProblem(null);
    if (previewMode()) { setRows(list => (list ?? []).map(x => x.id === p.id ? { ...x, active: !x.active } : x)); setBusy(null); return; }
    const { error: e } = await supabase.rpc("admin_promo_set_active", { p_id: p.id, p_active: !p.active, p_reason: null });
    setBusy(null);
    /* A returned error without a SQLSTATE may still have committed — re-read rather than guess. */
    if (e && e.code) setProblem(e.message);
    setReload(x => x + 1);
  }

  if (error) return (
    <div className="card p-4 text-[13px]">
      <p className="font-bold">The promo catalogue isn’t available.</p>
      <p className="mt-1 opacity-65">{error} — this tab needs the admin_promo_catalog function released to the database.</p>
    </div>
  );
  if (!rows) return <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="card h-24 animate-pulse"/>)}</div>;

  const active = rows.filter(r => r.active).length;
  const waiting = rows.filter(r => r.engine === "needs_wiring").length;

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <h3 className="text-sm font-extrabold">Promo codes</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed opacity-65">
          Every promotion in every app, and who pays for it. On a fee we earn — OneJob’s service fee, OneHome’s host and guest
          fees — the discount comes off our fee and the pro or host is paid in full. On a plan we sell, it comes off our price.
          On a ticket, the event host chooses it and it comes off their ticket price.
        </p>
        <p className="mt-2 text-[12.5px] font-bold">
          {rows.length} promotions · {active} on · {waiting} designed, waiting for their checkout
        </p>
      </div>

      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="App">
        {APPS.map(a => (
          <button key={a.key || "any"} type="button" role="tab" aria-selected={app === a.key} onClick={() => setApp(a.key)}
            className={`ow-tap shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${app === a.key
              ? "border-amber-500 bg-amber-500 text-white" : "border-ink/15 dark:border-white/20"}`}>{a.label}</button>
        ))}
      </div>

      {problem && <p className="text-[12.5px] font-semibold text-red-600 dark:text-red-300">{problem}</p>}
      {!shown.length && <div className="card p-4 text-[13px] opacity-70">No promotion for this app yet.</div>}

      {shown.map(p => (
        <article key={`${p.source}:${p.id}`} className="card space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14.5px] font-black leading-snug">{p.name}</p>
              {p.code && <p className="mt-0.5 font-mono text-[12.5px] font-bold tracking-wide opacity-75">{p.code}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${p.active
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "bg-ink/10 text-ink/60 dark:bg-white/10 dark:text-white/60"}`}>
              {p.active ? "On" : "Off"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded-full border border-ink/10 px-2 py-0.5 dark:border-white/15">{APP_LABEL[p.app] ?? p.app}</span>
            <span className="rounded-full border border-ink/10 px-2 py-0.5 dark:border-white/15">{TYPE_LABEL[p.applies_to] ?? p.applies_to}</span>
            <span className="rounded-full border border-transparent bg-amber-500/15 px-2 py-0.5 text-amber-800 dark:text-amber-200">{describe(p)}</span>
            <span className={`rounded-full border border-transparent px-2 py-0.5 ${p.engine === "live"
              ? "bg-sky-500/15 text-sky-800 dark:text-sky-200" : "bg-ink/10 text-ink/60 dark:bg-white/10 dark:text-white/60"}`}>
              {p.engine === "live" ? "Works today" : "Checkout not wired yet"}
            </span>
          </div>
          <p className="text-[12.5px] leading-relaxed"><span className="font-bold">Who pays: </span>{who(p)}</p>
          {p.purpose && <p className="text-[12.5px] leading-relaxed opacity-70">{p.purpose}</p>}
          <p className="text-[11.5px] opacity-55">
            {p.audience ? `For ${p.audience.charAt(0).toLowerCase()}${p.audience.slice(1)} · ` : ""}
            {p.source === "event_codes" ? "Usage kept per event"
              : `Used ${p.uses ?? 0}${p.max_uses != null ? ` of ${p.max_uses}` : ""} time${(p.uses ?? 0) === 1 ? "" : "s"}`}
            {p.expires_at ? ` · Ends ${day(p.expires_at)}` : ""}
          </p>
          {p.source === "catalog" && p.engine === "live" && (
            <button type="button" disabled={busy === p.id} onClick={() => void toggle(p)}
              className={`${p.active ? "btn-ghost" : "btn-primary"} w-full text-[13px]`}>
              {busy === p.id ? "Saving…" : p.active ? "Turn off" : "Turn on"}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
