import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Avatar from "../components/Avatar";
import ScreenHeading from "../components/ScreenHeading";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { useIsAdmin } from "../lib/useIsAdmin";

/* ============================================================================================
 * ADMIN CONSOLE — the July OneSocial dashboard, rebuilt on the One World shell.
 * ============================================================================================
 * Lee, 22 Sep 2026: *"it was a lot better before… there's a bunch of list of names that should
 * only show up one time… I need metrics, regular metrics."* And then: *"it should have the same
 * functionality… if anything, it would be the same plus extra."*
 *
 * Four rules came out of that and the whole screen is shaped by them:
 *
 * 1. ONE PLACE FOR PEOPLE. The member directory renders in exactly one place — the People tab.
 *    Overview shows people as COUNTS, never as a second copy of the same list. The old build
 *    printed the roster twice on one screen, which is what he was looking at.
 * 2. EVERY BUCKET CARRIES NUMBERS. Growth, People, Money and Ops were dead buttons. They now
 *    read a single server aggregate, so opening a bucket always shows figures, never a stub.
 * 3. EVERY NUMBER STATES ITS WINDOW. Each tile shows the change against the immediately prior
 *    equal window and says which window that is, so "-13%" never has to be guessed at.
 * 4. AN EMPTY PANEL SAYS WHY. Most July tables were recreated here without their rows. A row of
 *    zeroes reads as a broken screen, so a source with no records says so in words.
 *
 * Every drill-in list goes through ONE server function, `admin_list`, which takes a LIST NAME
 * from a fixed allow-list — never a table and never a column. Twenty-odd screens used to mean
 * twenty-odd chances to get the authorization wrong; the old build had three different admin
 * checks living side by side. There is one check now, on the server, and every read is audited.
 * ============================================================================================ */

type Pair = { label: string; value: number };
type Kpi = { current: number; previous: number };
type Daily = { day: string; visitors: number; visits: number; page_views: number };
type Row = Record<string, unknown>;
type ListResult = { total: number; rows: Row[] };

type Overview = {
  generated_at: string;
  collection: { first_event_at: string | null; last_event_at: string | null; event_count: number };
  kpis: Record<"visitors" | "visits" | "signups" | "onboarded" | "product_actions", Kpi>;
  daily: Daily[];
  countries: Pair[]; cities: Pair[]; devices: Pair[]; referrers: Pair[];
  landing_pages: Pair[]; bots: Pair[]; products: Pair[];
  traffic: { human: number; bot: number };
  operations: {
    oneevent: { events: number; applications: number; pending_approvals: number; payment_attention: number; registrations: number };
    onehome: { rental_listings: number; rental_requests: number; active_contracts: number; sale_listings: number; sale_deals: number };
    health: { open_alerts: number; onboarding_incomplete: number; email_failures: number };
  };
};

type AlertRow = { at: string; source: string | null; code: string | null; severity: string | null; message: string | null; resolved: boolean };
type Console = {
  generated_at: string;
  window: { days: number; hours: number | null; start: string; previous_start: string; label: string };
  growth: Record<string, Kpi>;
  people: Record<string, number | Kpi | Pair[]>;
  money: Record<string, number | Kpi>;
  ops: Record<string, number | Kpi | AlertRow[] | { started_at: string; status: string; records: number } | null>;
  engagement: Record<string, number | Kpi>;
  coverage: Record<string, number | string | null>;
};

type Product = { product: string; status: string; plan: string | null; granted_at: string | null };
type Member = {
  user_id: string; full_name: string | null; email: string | null; phone: string | null;
  profession: string | null; location: string | null; photo_url: string | null;
  score: number | null; is_public: boolean | null; created_at: string | null;
  last_sign_in_at: string | null; apps_connected: number; membership: string;
  onboarding_incomplete: boolean; products: Product[];
};
type Directory = { total: number; rows: Member[] };
type MemberRecord = Record<string, any>;

const previewMode = () => import.meta.env.DEV && typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("adminPreview") === "1";

const PREVIEW_OVERVIEW: Overview = {
  generated_at: new Date().toISOString(),
  collection: { first_event_at: "2026-08-03T12:00:00Z", last_event_at: new Date().toISOString(), event_count: 18436 },
  kpis: {
    visitors: { current: 2847, previous: 2382 }, visits: { current: 3912, previous: 3321 },
    signups: { current: 186, previous: 154 }, onboarded: { current: 143, previous: 118 },
    product_actions: { current: 1254, previous: 1089 },
  },
  daily: Array.from({ length: 30 }, (_, index) => ({ day: `2026-08-${String(index + 2).padStart(2, "0")}`, visitors: 62 + ((index * 37) % 84) + Math.round(index * 1.7), visits: 90 + ((index * 29) % 110), page_views: 180 + ((index * 43) % 190) })),
  countries: [{ label: "Colombia", value: 1280 }, { label: "United States", value: 824 }, { label: "United Kingdom", value: 219 }, { label: "Germany", value: 148 }],
  cities: [{ label: "Medellín", value: 611 }, { label: "Bogotá", value: 472 }, { label: "Miami", value: 231 }, { label: "London", value: 118 }],
  devices: [{ label: "Mobile", value: 1782 }, { label: "Desktop", value: 917 }, { label: "Tablet", value: 148 }],
  referrers: [{ label: "Direct", value: 1388 }, { label: "google.com", value: 721 }, { label: "instagram.com", value: 403 }, { label: "linkedin.com", value: 217 }],
  landing_pages: [{ label: "/events", value: 819 }, { label: "/jobs", value: 674 }, { label: "/rentals", value: 428 }, { label: "/social", value: 296 }],
  bots: [{ label: "Googlebot", value: 181 }, { label: "Bingbot", value: 64 }, { label: "Social preview", value: 38 }],
  products: [{ label: "OneEvent", value: 33 }, { label: "OneJob", value: 10 }, { label: "OneHome", value: 3 }, { label: "OneSocial", value: 2 }, { label: "OneScore", value: 2 }],
  traffic: { human: 3912, bot: 283 },
  operations: {
    oneevent: { events: 18, applications: 20, pending_approvals: 4, payment_attention: 2, registrations: 18 },
    onehome: { rental_listings: 9, rental_requests: 6, active_contracts: 3, sale_listings: 7, sale_deals: 2 },
    health: { open_alerts: 3, onboarding_incomplete: 7, email_failures: 5 },
  },
};

const PREVIEW_MEMBERS: Member[] = [
  { user_id: "preview-1", full_name: "Alicia Rivera", email: "alicia@example.test", phone: "+57 300 555 0101", profession: "Event producer", location: "Medellín, Colombia", photo_url: null, score: 86, is_public: true, created_at: "2026-08-28T10:00:00Z", last_sign_in_at: "2026-09-01T11:00:00Z", apps_connected: 2, membership: "claimed", onboarding_incomplete: false, products: [{ product: "oneevent", status: "active", plan: "pro", granted_at: "2026-08-28T10:00:00Z" }, { product: "onesocial", status: "active", plan: null, granted_at: "2026-08-28T10:00:00Z" }] },
  { user_id: "preview-2", full_name: "Marcus Chen", email: "marcus@example.test", phone: "+1 305 555 0102", profession: "Product designer", location: "Miami, United States", photo_url: null, score: 74, is_public: true, created_at: "2026-08-25T10:00:00Z", last_sign_in_at: null, apps_connected: 1, membership: "invited", onboarding_incomplete: true, products: [{ product: "onejob", status: "active", plan: "pro", granted_at: "2026-08-25T10:00:00Z" }] },
  { user_id: "preview-3", full_name: "Sofía Gómez", email: "sofia@example.test", phone: "+57 310 555 0103", profession: "Real estate advisor", location: "Bogotá, Colombia", photo_url: null, score: 91, is_public: false, created_at: "2026-08-20T10:00:00Z", last_sign_in_at: null, apps_connected: 1, membership: "migrated", onboarding_incomplete: false, products: [{ product: "onehome", status: "active", plan: null, granted_at: "2026-08-20T10:00:00Z" }] },
  { user_id: "preview-4", full_name: "Noah Williams", email: "noah@example.test", phone: "+44 20 555 0104", profession: "Growth consultant", location: "London, United Kingdom", photo_url: null, score: 69, is_public: true, created_at: "2026-08-18T10:00:00Z", last_sign_in_at: "2026-08-31T08:00:00Z", apps_connected: 2, membership: "claimed", onboarding_incomplete: false, products: [{ product: "onejob", status: "active", plan: "vip", granted_at: "2026-08-18T10:00:00Z" }, { product: "onescore", status: "active", plan: null, granted_at: "2026-08-18T10:00:00Z" }] },
];

const PRODUCTS = [
  ["", "All products"], ["onejob", "OneJob"], ["oneevent", "OneEvent"],
  ["onehome", "OneHome"], ["onesocial", "OneSocial"], ["onescore", "OneScore"],
] as const;

/* Time chips. Hours win over days when present — that is how the 1h/3h/12h chips the July
   dashboard opened on are expressed against a server that otherwise thinks in whole days. */
const WINDOWS: Array<{ label: string; days: number; hours: number | null }> = [
  { label: "1h", days: 1, hours: 1 },
  { label: "3h", days: 1, hours: 3 },
  { label: "12h", days: 1, hours: 12 },
  { label: "1d", days: 1, hours: null },
  { label: "3d", days: 3, hours: null },
  { label: "7d", days: 7, hours: null },
  { label: "30d", days: 30, hours: null },
  { label: "90d", days: 90, hours: null },
  { label: "1y", days: 365, hours: null },
];

/* ------------------------------------------------------------------------------- formatting */

const when = (iso: unknown) => {
  if (!iso || typeof iso !== "string") return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
};
const exact = (iso: unknown) => {
  if (!iso || typeof iso !== "string") return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "2-digit", hour: "numeric", minute: "2-digit" });
};
const number = (value: unknown) => new Intl.NumberFormat().format(Number(value ?? 0));
const money = (value: unknown) =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0));
const change = (kpi: Kpi) => {
  if (!kpi || !kpi.previous) return kpi && kpi.current ? "+100%" : "—";
  const value = Math.round(((kpi.current - kpi.previous) / kpi.previous) * 100);
  return `${value > 0 ? "+" : ""}${value}%`;
};
const isKpi = (value: unknown): value is Kpi =>
  !!value && typeof value === "object" && "current" in (value as Record<string, unknown>);
const num = (value: unknown): number => (isKpi(value) ? value.current : Number(value ?? 0));
/* window.label reads "vs prev 30d" — right for a comparison line under a tile, wrong inside a
   sentence ("Email failures in vs prev 30d"). This is the period's own name. */
const periodName = (win: { days: number; hours: number | null }) =>
  win.hours ? `${win.hours}h` : win.days === 1 ? "24h" : win.days === 365 ? "1y" : `${win.days}d`;
/* The database stores products lower-cased. Title-casing gives "Oneevent"; these are the names. */
const PRODUCT_NAMES: Record<string, string> = {
  onejob: "OneJob", oneevent: "OneEvent", onehome: "OneHome", onesocial: "OneSocial",
  onescore: "OneScore", onebusiness: "OneBusiness", onepay: "OnePay", oneagent: "OneAgent",
  onevoice: "OneVoice", oneid: "One ID", onehealth: "OneHealth",
};
const productName = (value: string) =>
  PRODUCT_NAMES[value.toLowerCase()] ?? value.replace(/^one(.)/i, (_, c: string) => `One${c.toUpperCase()}`);
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");

type Kind = "text" | "date" | "datetime" | "money" | "number" | "bool" | "json";
const show = (value: unknown, kind: Kind = "text"): string => {
  if (value === null || value === undefined || value === "") return "—";
  switch (kind) {
    case "date": return when(value);
    case "datetime": return exact(value);
    case "money": return money(value);
    case "number": return number(value);
    case "bool": return value ? "Yes" : "No";
    case "json": return typeof value === "string" ? value : JSON.stringify(value);
    default: return String(value);
  }
};

/* ── PER-BUCKET ACCENT ───────────────────────────────────────────────────────────────────────
   The July dashboard gave each bucket its own colour — Growth teal, People violet, Money amber,
   Ops sky — and used it on the tab, the sub-tab and the tile. Dropping it is what made the first
   rebuild read flat: every card the same weight, nothing telling you which part of the business
   you were looking at. Tailwind cannot build a class name from a variable, so every variant is
   written out here and picked by key. */
type BucketSlug = "overview" | "growth" | "people" | "money" | "ops" | "catalog";
type Goto = (bucket: BucketSlug, tab: string) => void;
type AccentKey = "brand" | "violet" | "amber" | "sky" | "emerald";
type Accent = { tab: string; bar: string; text: string; soft: string };
const ACCENT: Record<AccentKey, Accent> = {
  brand:   { tab: "bg-brand text-white shadow-sm",       bar: "bg-brand",
             text: "text-brand",                              soft: "hover:border-brand/40 hover:bg-brand/5" },
  violet:  { tab: "bg-violet-500 text-white shadow-sm",  bar: "bg-violet-500",
             text: "text-violet-600 dark:text-violet-300",    soft: "hover:border-violet-500/40 hover:bg-violet-500/5" },
  amber:   { tab: "bg-amber-500 text-white shadow-sm",   bar: "bg-amber-500",
             text: "text-amber-700 dark:text-amber-300",      soft: "hover:border-amber-500/40 hover:bg-amber-500/5" },
  sky:     { tab: "bg-sky-500 text-white shadow-sm",     bar: "bg-sky-500",
             text: "text-sky-700 dark:text-sky-300",          soft: "hover:border-sky-500/40 hover:bg-sky-500/5" },
  emerald: { tab: "bg-emerald-500 text-white shadow-sm", bar: "bg-emerald-500",
             text: "text-emerald-700 dark:text-emerald-300",  soft: "hover:border-emerald-500/40 hover:bg-emerald-500/5" },
};

/* ---------------------------------------------------------------------------- small pieces */

function Sparkline({ points }: { points: Daily[] }) {
  const values = points.map((point) => point.visitors);
  const max = Math.max(1, ...values);
  const coordinates = values.map((value, index) =>
    `${(index / Math.max(1, values.length - 1)) * 100},${38 - (value / max) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label="Daily visitors trend">
      <defs><linearGradient id="adminTrend" x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".25"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
      <path d={`M0 42 L${coordinates.replace(/ /g, " L")} L100 42 Z`} fill="url(#adminTrend)" className="text-brand" />
      <polyline points={coordinates} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className="text-brand" />
    </svg>
  );
}

function Breakdown({ title, rows, empty = "No data yet", accent = "brand", onOpen, note }:
  { title: string; rows: Pair[]; empty?: string; accent?: AccentKey; onOpen?: (label: string) => void; note?: string }) {
  const a = ACCENT[accent];
  const max = Math.max(1, ...rows.map((row) => row.value));
  const total = rows.reduce((t, r) => t + r.value, 0);
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold">{title}</h3>
        {!!rows.length && <span className="text-[10px] font-bold tabular-nums opacity-40">{number(total)}</span>}
      </div>
      {note && <p className="mt-0.5 text-[10px] opacity-40">{note}</p>}
      <div className="mt-3 space-y-2.5">
        {!rows.length && <p className="py-5 text-center text-xs opacity-45">{empty}</p>}
        {rows.slice(0, 8).map((row) => {
          const inner = <>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate opacity-70">{row.label}</span>
              <b className="tabular-nums">{number(row.value)}</b>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
              <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
            </div>
          </>;
          return onOpen
            ? <button key={row.label} onClick={() => onOpen(row.label)}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left transition hover:bg-brand/5">{inner}</button>
            : <div key={row.label}>{inner}</div>;
        })}
      </div>
    </section>
  );
}

/** A metric tile.
 *
 *  Two things make this a tile rather than a label with a number next to it. It states the window
 *  it is measured over, under the delta, so "-13%" never has to be guessed at. And when there are
 *  rows behind it, it opens them and says so — Lee, 22 Sep: *"if it says five people visited, I
 *  should be able to click into that five."* A number you cannot open is a decoration. */
function MetricCard({ label, value, windowLabel, format = number, attention = false,
                      accent = "brand", onOpen, openLabel, note }:
  { label: string; value: Kpi | number; windowLabel?: string; format?: (v: unknown) => string;
    attention?: boolean; accent?: AccentKey; onOpen?: () => void; openLabel?: string; note?: string }) {
  const a = ACCENT[accent];
  const kpi = isKpi(value) ? value : null;
  const current = kpi ? kpi.current : Number(value ?? 0);
  const delta = kpi ? change(kpi) : "";
  const up = delta.startsWith("+");
  const flat = delta === "—" || delta === "";
  const alarmed = attention && current > 0;
  const body = <>
    <span className={`absolute inset-y-0 left-0 w-1 ${alarmed ? "bg-amber-500" : a.bar}`} aria-hidden />
    <p className="text-[10px] font-bold uppercase tracking-[.12em] opacity-45">{label}</p>
    <div className="mt-2 flex items-end justify-between gap-2">
      <p className={`text-2xl font-black leading-none tabular-nums ${alarmed ? "text-amber-600 dark:text-amber-400" : ""}`}>{format(current)}</p>
      {kpi && <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold tabular-nums ${
        flat ? "bg-ink/5 opacity-45 dark:bg-white/10" : up ? "bg-teal/15 text-teal" : "bg-red-500/10 text-red-500"}`}>
        {flat ? "—" : `${up ? "▲" : "▼"} ${delta.replace("+", "")}`}
      </span>}
    </div>
    <p className="mt-1 truncate text-[10px] opacity-40">
      {note ?? (kpi ? `${windowLabel ?? "Previous period"}: ${format(kpi.previous)}` : "Lifetime total")}
    </p>
    {onOpen && <p className={`mt-2 text-[10px] font-extrabold ${a.text}`}>{openLabel ?? "Open"} →</p>}
  </>;
  const shell = "card relative overflow-hidden p-4 pl-5 text-left";
  return onOpen
    ? <button onClick={onOpen} className={`${shell} border border-transparent transition ${a.soft}`}>{body}</button>
    : <div className={shell}>{body}</div>;
}

type OpRow = {
  label: string;
  value: number;
  /* Denominator. Given one, the row shows what share of it this is — a bare "12" tells you
     nothing, "12 · 4% of 340" tells you whether to care. */
  of?: number;
  tone?: "plain" | "warn" | "good";
  money?: boolean;
  /* Where the number came from. A figure you cannot open is a figure you cannot trust. */
  open?: () => void;
  /* What to print instead of a naked 0. "No disputes" reads as health; "0" reads as broken. */
  zeroLabel?: string;
};
type OpLead = { label: string; value: number; money?: boolean; note?: string; open?: () => void; openLabel?: string };

function opFormat(row: { value: number; money?: boolean }) {
  return row.money ? money(row.value) : number(row.value);
}

function LeadBody({ lead, accent }: { lead: OpLead; accent: Accent }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-[.12em] opacity-45">{lead.label}</p>
      <p className="mt-1 text-3xl font-black leading-none tabular-nums">{opFormat(lead)}</p>
      {lead.note && <p className="mt-1 text-[11px] opacity-45">{lead.note}</p>}
      {lead.open && <p className={`mt-1.5 text-[10px] font-extrabold ${accent.text}`}>{lead.openLabel ?? "Open"} {"\u2192"}</p>}
    </>
  );
}

/* A panel of related figures. Every card leads with the one number that answers "how is this
   part of the business doing", then supports it. Rows that can be opened are opened; rows that
   are genuinely zero step back rather than shouting a 0 at the same weight as a real figure. */
function OperationCard({ title, subtitle, lead, rows, footer, accent = "brand", empty }: {
  title: string; subtitle?: string; lead?: OpLead; rows: OpRow[];
  footer?: string; accent?: AccentKey; empty?: string;
}) {
  const a = ACCENT[accent];
  const allZero = rows.every((row) => !row.value) && !(lead && lead.value);
  return (
    <section className="card relative overflow-hidden p-4 pl-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${a.bar}`} aria-hidden />
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-extrabold">{title}</h3>
        {subtitle && <p className="shrink-0 text-[10px] font-bold uppercase tracking-[.12em] opacity-35">{subtitle}</p>}
      </div>

      {lead && (lead.open
        ? <button onClick={lead.open} className="-mx-2 mt-3 block w-full rounded-xl p-2 text-left transition hover:bg-ink/5 dark:hover:bg-white/5">
            <LeadBody lead={lead} accent={a} />
          </button>
        : <div className="mt-3"><LeadBody lead={lead} accent={a} /></div>)}

      <dl className={`divide-y divide-ink/5 text-sm dark:divide-white/5 ${lead ? "mt-3 border-t border-ink/5 dark:border-white/5" : "mt-3"}`}>
        {rows.map((row) => {
          const zero = !row.value;
          const warn = row.tone === "warn" && row.value > 0;
          const good = row.tone === "good" && row.value > 0;
          const share = !zero && row.of && row.of > 0 ? Math.min(100, Math.round((row.value / row.of) * 100)) : null;
          const openable = !!row.open && !zero;
          const inner = <>
            <dt className={`min-w-0 flex-1 truncate text-left ${zero ? "opacity-35" : "opacity-60"}`}>{row.label}</dt>
            <dd className="flex shrink-0 items-center gap-2">
              {share !== null && <>
                <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-ink/10 sm:block dark:bg-white/15">
                  <span className={`block h-full ${warn ? "bg-amber-500" : a.bar}`} style={{ width: `${Math.max(share, 3)}%` }} />
                </span>
                <span className="w-8 text-right text-[10px] tabular-nums opacity-40">{share}%</span>
              </>}
              <span className={`tabular-nums ${zero ? "text-[11px] font-bold opacity-35"
                : warn ? "font-black text-amber-600 dark:text-amber-400"
                : good ? "font-black text-teal" : "font-black"}`}>
                {zero ? (row.zeroLabel ?? "0") : opFormat(row)}
              </span>
              <span className={`w-2 text-[10px] font-extrabold ${openable ? a.text : "opacity-0"}`} aria-hidden>{"\u2192"}</span>
            </dd>
          </>;
          return openable
            ? <button key={row.label} onClick={row.open} className="flex w-full items-center justify-between gap-2 py-2.5">{inner}</button>
            : <div key={row.label} className="flex items-center justify-between gap-2 py-2.5">{inner}</div>;
        })}
      </dl>

      {allZero && empty && <p className="mt-3 rounded-lg bg-ink/5 px-2.5 py-2 text-[10px] leading-relaxed opacity-55 dark:bg-white/10">{empty}</p>}
      {footer && <p className="mt-3 text-[10px] leading-relaxed opacity-40">{footer}</p>}
    </section>
  );
}


/* ── THE ADMIN'S OWN CHROME ──────────────────────────────────────────────────────────────────
   Lee, 22 Sep 2026: *"it still needs a lot of polish, like the right colors, and it doesn't have
   our glass morphism effect to it."*

   He was right, and the reason is specific. `.card` in the shared token file already carries the
   full glass — the frost, the specular top edge, the border. But the console's CHROME — the tab
   strips, the filter bar, the search fields, the selects — was built out of `bg-ink/5`, a flat
   five-percent tint. Every pane on the screen was glass and every control on it was a grey box,
   which is exactly what reads as unfinished.

   These rules live here rather than in tokens.css on purpose. tokens.css is shared by every
   product and a change to it is a foundation change that lands on OneHome, OneEvent and the feed
   at the same time. Nothing below is wanted anywhere but this console, so the console carries it
   and the overlay stays one file. They are built from the SAME variables the shared glass uses
   (--glass-border, --frost, --control-line), so if the brand moves, this moves with it. */
const ADMIN_CHROME_CSS = `
.ow-rail, .ow-field, .ow-pop {
  border: 1px solid var(--glass-border);
  background: var(--glass-fill), rgba(255,255,255,.42);
  backdrop-filter: var(--frost-nav); -webkit-backdrop-filter: var(--frost-nav);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
}
.ow-field { border-color: var(--control-line); }
.ow-field:hover { background: var(--glass-fill), rgba(255,255,255,.62); }
.ow-pop {
  background: var(--glass-fill), rgba(255,255,255,.90);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 22px 50px -18px rgba(15,23,42,.34);
}
/* The selected chip is a raised pane, not a flat white block: it has to read as sitting ON the
   rail rather than punched out of it, or a scrolling strip looks like a frozen column. */
.ow-chip-on {
  background: rgba(255,255,255,.92);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 6px 14px -8px rgba(15,23,42,.45);
}
/* The fades sit ON the rail, so they are the rail's own colour — not a white smear over it. */
.ow-fade-l { background: linear-gradient(90deg, rgba(255,255,255,.92), rgba(255,255,255,0)); }
.ow-fade-r { background: linear-gradient(270deg, rgba(255,255,255,.92), rgba(255,255,255,0)); }

.dark .ow-rail, .dark .ow-field, .dark .ow-pop {
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.055);
  backdrop-filter: none; -webkit-backdrop-filter: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07);
}
.dark .ow-field { border-color: var(--control-line); }
.dark .ow-field:hover { background: rgba(255,255,255,.10); }
.dark .ow-pop {
  background: #141926;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 26px 56px -18px rgba(0,0,0,.8);
}
.dark .ow-chip-on {
  background: rgba(255,255,255,.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 6px 16px -8px rgba(0,0,0,.6);
}
.dark .ow-fade-l { background: linear-gradient(90deg, rgba(18,22,34,.95), rgba(18,22,34,0)); }
.dark .ow-fade-r { background: linear-gradient(270deg, rgba(18,22,34,.95), rgba(18,22,34,0)); }

/* The bucket row is the one piece of chrome that is always visible, so it gets the heavier
   treatment — a true pane, with the active bucket wearing its own accent rather than a tint. */
.ow-buckets {
  border: 1px solid var(--glass-border);
  background: var(--glass-fill), rgba(255,255,255,.52);
  backdrop-filter: var(--frost-nav); -webkit-backdrop-filter: var(--frost-nav);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 14px 34px -22px rgba(15,23,42,.30);
}
.dark .ow-buckets {
  border: 1px solid rgba(255,255,255,.11);
  background: rgba(255,255,255,.05);
  backdrop-filter: none; -webkit-backdrop-filter: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 14px 34px -22px rgba(0,0,0,.6);
}
`;

/* ── A REAL DROPDOWN ─────────────────────────────────────────────────────────────────────────
   Lee, 22 Sep 2026: *"the actual drop down that opens up is archaic… we need a more obviously
   more polished drop down menu."*

   A native <select> renders the operating system's own list — a grey system menu with none of
   the product's glass, type or colour, and on Android it is a full-screen sheet. It was the one
   thing on the screen that did not look like One World. This is the replacement: the product's
   own pane, its own type, its accent on the chosen row.

   Keyboard and screen readers are not an afterthought here. It is a real listbox: arrows move,
   Enter and Space choose, Escape closes and returns focus to the trigger, Home and End jump to
   the ends, and the open list is what aria-activedescendant points at. A pointer down anywhere
   outside closes it. */
function Dropdown({ value, options, onChange, label, align = "left", className = "" }: {
  value: string;
  /* `short` is what the closed control says. A trigger three-across on a 390px phone has room
     for "30 days", not "Last 30 days" — and a label that truncates to "Last 30 …" tells you
     less than the short form does. The menu always shows the full label. */
  options: Array<{ value: string; label: string; short?: string; hint?: string }>;
  onChange: (value: string) => void;
  label: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const wrap = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const chosen = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setCursor(Math.max(0, options.findIndex((option) => option.value === value)));
    const away = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, options, value]);

  const pick = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  const keys = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(true); }
      return;
    }
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setCursor((c) => Math.min(options.length - 1, c + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (event.key === "Home") { event.preventDefault(); setCursor(0); }
    else if (event.key === "End") { event.preventDefault(); setCursor(options.length - 1); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(cursor); }
  };

  return (
    <div ref={wrap} className={`relative ${className}`} onKeyDown={keys}>
      <button ref={trigger} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        aria-activedescendant={open ? `${id}-${cursor}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className="ow-field flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-extrabold transition">
        <span className="truncate">{chosen?.short ?? chosen?.label ?? label}</span>
        <span className={`shrink-0 text-[9px] opacity-45 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>{"\u25BC"}</span>
      </button>

      {open && (
        <div role="listbox" aria-label={label} tabIndex={-1}
          className={`ow-pop absolute z-50 mt-1 max-h-72 min-w-full overflow-y-auto rounded-2xl p-1 ${align === "right" ? "right-0" : "left-0"}`}>
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button key={option.value} id={`${id}-${index}`} role="option" aria-selected={active} type="button"
                onMouseEnter={() => setCursor(index)} onClick={() => pick(index)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[11px] font-extrabold transition
                  ${active ? "bg-brand/12 text-brand" : index === cursor ? "bg-ink/5 dark:bg-white/10" : ""}`}>
                <span className="truncate">{option.label}</span>
                {option.hint
                  ? <span className="shrink-0 text-[10px] font-bold tabular-nums opacity-45">{option.hint}</span>
                  : active ? <span className="shrink-0 text-[10px]" aria-hidden>{"\u2713"}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── ONE SCROLLING ROW, NOT A GROWING STACK ──────────────────────────────────────────────────
   Lee: *"it actually shows on two different lines… it jumps because it's two rows versus one
   row between when you click overview and growth."*

   Wrapping fixed the earlier fault (tabs hidden off-screen) and caused this one: Growth has
   eleven sub-tabs and People has five, so the strip was three rows on one bucket and one on
   another, and the whole page jumped on every switch. A single row of constant height cannot
   jump. The scroll is made obvious rather than hidden: the edge fades only where there is more
   to see, and choosing a tab scrolls it into view so the active one is never off-screen. */
function TabStrip({ items, index, onPick, accent, ariaLabel }: {
  items: string[]; index: number; onPick: (i: number) => void; accent: AccentKey; ariaLabel: string;
}) {
  const rail = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const a = ACCENT[accent];

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = rail.current;
    if (!el) return;
    const active = el.children[index] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [index, items, measure]);

  return (
    <div className="relative">
      <div ref={rail} onScroll={measure} role="tablist" aria-label={ariaLabel}
        className="ow-rail scrollbar-none flex gap-1 overflow-x-auto rounded-2xl p-1">
        {items.map((label, i) => (
          <button key={label} role="tab" aria-selected={i === index} onClick={() => onPick(i)}
            className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-extrabold transition
              ${i === index ? `ow-chip-on ${a.text}` : "opacity-55 hover:opacity-100"}`}>
            {label}
          </button>
        ))}
      </div>
      <span aria-hidden className={`ow-fade-l pointer-events-none absolute inset-y-1 left-1 w-10 rounded-l-2xl transition-opacity ${edges.left ? "opacity-100" : "opacity-0"}`} />
      <span aria-hidden className={`ow-fade-r pointer-events-none absolute inset-y-1 right-1 w-10 rounded-r-2xl transition-opacity ${edges.right ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}

/* ── ONE ROW OF FILTERS, NOT THREE ───────────────────────────────────────────────────────────
   Lee, 22 Sep 2026: *"we have three buttons at the top… that's taking up a lot of vertical
   space. That's unnecessary… all three of those can probably be on one row."*

   The window picker was nine chips that wrapped to two rows on a phone, and product and audience
   each had a row of their own further down the screen. Three stacked rows of chrome before a
   single figure. They are one row now: three dropdowns and the refresh, and the sentence that
   explained the comparison window has moved INTO the window control, where it is read at the
   moment it matters instead of sitting under it as a permanent caption. */
/* "All products" does not fit a third of a 390px row and truncates to "All prod…", which is
   worse than the short form. The menu still reads "All products"; the closed control says "All",
   which is unambiguous under an aria-label of Product. */
const PRODUCT_OPTIONS = PRODUCTS.map(([value, label]) => ({
  value, label, short: value ? label : "All",
}));
const AUDIENCE_OPTIONS = [
  { value: "human", label: "People only", short: "People" },
  { value: "all", label: "People and bots", short: "Everyone" },
  { value: "bot", label: "Bots only", short: "Bots" },
];

function FilterBar({ index, onPick, onRefresh, busy, product, onProduct, audience, onAudience,
                    showWindow, showProduct, showAudience }: {
  index: number; onPick: (i: number) => void; onRefresh: () => void; busy: boolean;
  product: string; onProduct: (v: string) => void;
  audience: string; onAudience: (v: string) => void;
  showWindow: boolean; showProduct: boolean; showAudience: boolean;
}) {
  const windowOptions = WINDOWS.map((item, i) => ({
    value: String(i),
    label: item.hours ? `Last ${item.hours} hours` : item.days === 1 ? "Last 24 hours"
      : item.days === 365 ? "Last year" : `Last ${item.days} days`,
    short: item.hours ? `${item.hours} hours` : item.days === 1 ? "24 hours"
      : item.days === 365 ? "1 year" : `${item.days} days`,
  }));
  return (
    <div className="flex items-stretch gap-1.5">
      {/* A control that is shown where it changes nothing is worse than no control: it makes a
          screen look filtered when it is not. Each of these appears only on the tabs it moves. */}
      {showWindow && <Dropdown label="Time window" className="min-w-0 flex-1"
        value={String(index)} options={windowOptions} onChange={(v) => onPick(Number(v))}/>}
      {showProduct && <Dropdown label="Product" className="min-w-0 flex-1"
        value={product} options={PRODUCT_OPTIONS} onChange={onProduct}/>}
      {showAudience && <Dropdown label="Audience" className="min-w-0 flex-1" align="right"
        value={audience} options={AUDIENCE_OPTIONS} onChange={onAudience}/>}
      {!showWindow && !showProduct && !showAudience &&
        <p className="ow-field flex min-w-0 flex-1 items-center rounded-xl px-3 text-[11px] font-semibold opacity-45">
          This list shows everything on record.
        </p>}
      <button onClick={onRefresh} aria-label="Refresh" title="Refresh"
        className="ow-field shrink-0 rounded-xl px-3 text-xs font-extrabold transition hover:text-brand">
        {busy ? "\u2026" : "\u21BB"}
      </button>
    </div>
  );
}

/* ── THE TOP-RIGHT ACTIONS ───────────────────────────────────────────────────────────────────
   Lee: *"the flag option… you don't even need a language option. At the top right, we had other
   things… some more important things."*

   He is remembering the July header, which carried five one-tap actions rather than a language
   switcher. The two that earn their place here are the link-copies — the things he reaches for
   when he is talking to someone and wants to send them in. The rest were navigation to screens
   that do not exist under this name in One World, so they are not invented here.

   The language flag he is describing is NOT drawn by this screen. It lives in the shared header,
   which belongs to the shell, so removing it from the admin route is a shell change and is
   written up for that owner rather than reached into from here. */
function CopyAction({ label, hint, value }: { label: string; hint: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" title={hint} aria-label={hint}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); } catch { /* clipboard blocked — say nothing false */ return; }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={`ow-field grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] transition ${done ? "text-teal" : "hover:text-brand"}`}>
      <span aria-hidden>{done ? "\u2713" : label}</span>
    </button>
  );
}

function AdminQuickActions({ promo }: { promo: string | null }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <CopyAction label={"\u2193"} hint="Copy the link that lets someone add One World to their phone"
        value="https://app.oneworldlabs.ai/"/>
      <CopyAction label={"\u002B"}
        hint={promo ? `Copy a sign-up link carrying the live code ${promo}` : "Copy the sign-up link. No promotional code is active right now."}
        value={promo ? `https://app.oneworldlabs.ai/join?promo=${encodeURIComponent(promo)}` : "https://app.oneworldlabs.ai/join"}/>
    </div>
  );
}

/** Says plainly when a panel is empty because nothing has been recorded yet, rather than
 *  letting a row of zeroes read as a broken screen. */
function EmptySource({ what, why }: { what: string; why: string }) {
  return (
    <div className="card border border-amber-500/30 p-4 text-sm">
      <b>{what} has no records yet.</b>
      <p className="mt-1 opacity-60">{why}</p>
    </div>
  );
}

function Problem({ what, detail }: { what: string; detail?: string }) {
  return (
    <div className="card border border-amber-500/30 p-4 text-sm">
      <b>{what}</b>
      {detail && <p className="mt-1 opacity-60">{detail}</p>}
    </div>
  );
}

function AlertList({ rows }: { rows: AlertRow[] }) {
  if (!rows.length) return <div className="card p-8 text-center text-sm opacity-50">No operational alerts have been raised.</div>;
  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const critical = (row.severity ?? "").toLowerCase() === "critical";
        return (
          <article key={`${row.at}-${index}`} className="card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${row.resolved ? "bg-teal/15 text-teal" : critical ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                {row.resolved ? "Resolved" : (row.severity ?? "open")}
              </span>
              <b className="text-xs">{row.code ?? "alert"}</b>
              <span className="text-[10px] opacity-45">{row.source ?? "—"} · {when(row.at)}</span>
            </div>
            <p className="mt-1.5 text-xs opacity-70">{row.message ?? ""}</p>
          </article>
        );
      })}
    </div>
  );
}

/* ================================================== the drill-in lists ===================== */

type Field = { key: string; label: string; kind?: Kind };
type ListSpec = {
  list: string;
  title: string;
  blurb: string;
  /** The line a person reads first. */
  primary: string;
  /** A short pill beside it — usually a status. */
  badge?: string;
  /** One line of context under the primary line. */
  secondary?: string[];
  /** Everything else, revealed on tap. */
  detail: Field[];
  /** When the window chips should narrow this list. */
  windowed?: boolean;
  search: string;
  /** Shown instead of an empty table when the source has no rows at all. */
  emptyWhy?: string;
};

const LISTS: Record<string, ListSpec> = {
  emails: {
    list: "emails", title: "Emails sent", blurb: "Every message the platform has sent, newest first.",
    primary: "to", badge: "status", secondary: ["template"], windowed: true, search: "Address or template",
    detail: [{ key: "at", label: "Sent", kind: "datetime" }, { key: "template", label: "Template" },
             { key: "status", label: "Status" }, { key: "error", label: "Error" }],
  },
  email_failures: {
    list: "email_failures", title: "Delivery failures", blurb: "Bounced, blocked and complained — the messages that never landed.",
    primary: "to", badge: "type", secondary: ["provider"], windowed: true, search: "Address",
    detail: [{ key: "at", label: "When", kind: "datetime" }, { key: "type", label: "Event" },
             { key: "provider", label: "Provider" }],
    emptyWhy: "Nothing has failed in this window. Widen the window if you are looking for an older failure.",
  },
  email_events: {
    list: "email_events", title: "Delivery events", blurb: "Everything the email provider reported back.",
    primary: "to", badge: "type", secondary: ["provider"], windowed: true, search: "Address or event",
    detail: [{ key: "at", label: "When", kind: "datetime" }, { key: "type", label: "Event" },
             { key: "provider", label: "Provider" }],
  },
  suppressed: {
    list: "suppressed", title: "Suppressed addresses", blurb: "Addresses the platform will not email again.",
    primary: "email", secondary: ["reason"], search: "Address",
    detail: [{ key: "at", label: "Added", kind: "datetime" }, { key: "reason", label: "Reason" }],
    emptyWhy: "No address has been suppressed.",
  },
  leads: {
    list: "leads", title: "Lead desk", blurb: "Every lead the lead-generation engine has produced.",
    primary: "name", badge: "stage", secondary: ["company", "title"], search: "Name, address or company",
    detail: [{ key: "at", label: "Created", kind: "datetime" }, { key: "email", label: "Email" },
             { key: "company", label: "Company" }, { key: "title", label: "Title" },
             { key: "location", label: "Location" }, { key: "source", label: "Source" },
             { key: "stage", label: "Stage" }, { key: "score", label: "Score", kind: "number" },
             { key: "outreach", label: "Outreach" }, { key: "touches", label: "Touches", kind: "number" },
             { key: "contacted_at", label: "Contacted", kind: "date" },
             { key: "responded_at", label: "Responded", kind: "date" }],
    emptyWhy: "The lead tables were recreated in this database without their rows. The 9,653 leads recorded before the migration are in the July backup and can be imported.",
  },
  waitlist: {
    list: "waitlist", title: "Waitlist", blurb: "The pre-launch survey, in the order people started it.",
    primary: "name", secondary: ["email", "location"], search: "Name or address",
    detail: [{ key: "number", label: "Number", kind: "number" }, { key: "at", label: "Started", kind: "datetime" },
             { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
             { key: "location", label: "Location" }, { key: "occupation", label: "Occupation" },
             { key: "draft", label: "Still a draft", kind: "bool" },
             { key: "form_completed_at", label: "Form finished", kind: "date" },
             { key: "profile_completed_at", label: "Profile finished", kind: "date" },
             { key: "submissions", label: "Submissions", kind: "number" },
             { key: "migrated_at", label: "Migrated", kind: "date" }],
    emptyWhy: "The waitlist ran on the old onesocial.ai database and its rows were never copied here. 189 submissions are in the July backup.",
  },
  affiliates: {
    list: "affiliates", title: "Affiliates", blurb: "Approved partners and their payout state.",
    primary: "name", badge: "status", secondary: ["email", "code"], search: "Name or address",
    detail: [{ key: "at", label: "Joined", kind: "datetime" }, { key: "email", label: "Email" },
             { key: "phone", label: "Phone" }, { key: "location", label: "Location" },
             { key: "code", label: "Referral code" }, { key: "approved_at", label: "Approved", kind: "date" },
             { key: "payouts_enabled", label: "Payouts enabled", kind: "bool" },
             { key: "connect_status", label: "Connect status" }],
    emptyWhy: "No affiliate has been created in this database. The programme's history is in the July backup.",
  },
  affiliate_apps: {
    list: "affiliate_apps", title: "Affiliate applications", blurb: "People asking to join the partner programme.",
    primary: "name", badge: "status", secondary: ["email", "location"], search: "Name or address",
    detail: [{ key: "at", label: "Applied", kind: "datetime" }, { key: "email", label: "Email" },
             { key: "phone", label: "Phone" }, { key: "location", label: "Location" },
             { key: "reviewed_at", label: "Reviewed", kind: "date" },
             { key: "motivation", label: "Why they applied" }],
    emptyWhy: "No application has been filed in this database.",
  },
  nurture: {
    list: "nurture", title: "Nurture", blurb: "Where each member sits in the email sequence.",
    primary: "member", badge: "stage", secondary: ["email"], search: "Name or stage",
    detail: [{ key: "at", label: "Updated", kind: "datetime" }, { key: "email", label: "Email" },
             { key: "role", label: "Role" }, { key: "per_week", label: "Emails per week", kind: "number" },
             { key: "sent", label: "Sent so far", kind: "number" },
             { key: "last_email_at", label: "Last email", kind: "date" },
             { key: "stage_started_at", label: "Stage started", kind: "date" }],
    emptyWhy: "The nurture engine has no state in this database. 789 rows are in the July backup.",
  },
  incomplete: {
    list: "incomplete", title: "Incomplete profiles", blurb: "Members who signed up and never finished onboarding.",
    primary: "name", secondary: ["email", "signup_app"], search: "Name or address",
    detail: [{ key: "at", label: "Signed up", kind: "datetime" }, { key: "email", label: "Email" },
             { key: "phone", label: "Phone" }, { key: "signup_app", label: "Signed up in" },
             { key: "required", label: "Version required", kind: "number" },
             { key: "done", label: "Version finished", kind: "number" },
             { key: "last_sign_in_at", label: "Last sign-in", kind: "date" }],
    emptyWhy: "Everyone has finished onboarding.",
  },
  applications: {
    list: "applications", title: "Job applications", blurb: "People applying to work at One World Labs.",
    primary: "name", badge: "status", secondary: ["position", "email"], search: "Name, address or position",
    detail: [{ key: "at", label: "Applied", kind: "datetime" }, { key: "email", label: "Email" },
             { key: "phone", label: "Phone" }, { key: "position", label: "Position" },
             { key: "title", label: "Current title" }, { key: "resume", label: "Résumé attached", kind: "bool" }],
    emptyWhy: "Nobody has applied through the careers form.",
  },
  kickstarter: {
    list: "kickstarter", title: "Kickstarter profiles", blurb: "Profiles built for people before they sign up.",
    primary: "name", badge: "status", secondary: ["profession", "email"], search: "Name or address",
    detail: [{ key: "at", label: "Created", kind: "datetime" }, { key: "email", label: "Email" },
             { key: "phone", label: "Phone" }, { key: "location", label: "Location" },
             { key: "profession", label: "Profession" }, { key: "built_at", label: "Built", kind: "date" },
             { key: "approved_at", label: "Approved", kind: "date" },
             { key: "live_at", label: "Went live", kind: "date" }, { key: "error", label: "Build error" }],
    emptyWhy: "No kickstarter profile has been created.",
  },
  arena: {
    list: "arena", title: "Arena", blurb: "Challenges between members, and how they ended.",
    primary: "challenger", badge: "status", secondary: ["challenged", "industry"], search: "Name or industry",
    detail: [{ key: "at", label: "Created", kind: "datetime" }, { key: "challenger", label: "Challenger" },
             { key: "challenged", label: "Challenged" }, { key: "belt", label: "Belt", kind: "number" },
             { key: "industry", label: "Industry" }, { key: "category", label: "Category" },
             { key: "location", label: "Location" }, { key: "starts_at", label: "Starts", kind: "date" },
             { key: "ends_at", label: "Ends", kind: "date" }],
    emptyWhy: "No challenge has been created in this database. 2,580 are in the July backup.",
  },
  accountability: {
    list: "accountability", title: "Accountability log", blurb: "Recorded incidents, what was asked and what was done.",
    primary: "type", badge: "severity", secondary: ["rule", "status"], search: "Type or rule",
    detail: [{ key: "at", label: "Occurred", kind: "datetime" }, { key: "rule", label: "Rule broken" },
             { key: "status", label: "Status" }, { key: "asked", label: "What was asked" },
             { key: "did", label: "What happened" },
             { key: "credits", label: "Credits wasted", kind: "number" },
             { key: "notes", label: "Resolution" }],
    emptyWhy: "No incident has been logged in this database. 243 audits are in the July backup.",
  },
  contracts: {
    list: "contracts", title: "Contracts", blurb: "Every agreement and where its money has got to.",
    primary: "title", badge: "status", secondary: ["payment_status"], search: "Title or status",
    detail: [{ key: "at", label: "Created", kind: "datetime" }, { key: "amount", label: "Amount", kind: "money" },
             { key: "currency", label: "Currency" }, { key: "fee", label: "Platform fee", kind: "money" },
             { key: "payment_status", label: "Payment status" },
             { key: "authorized_at", label: "Authorized", kind: "date" },
             { key: "captured_at", label: "Captured", kind: "date" },
             { key: "released_at", label: "Released", kind: "date" },
             { key: "refunded_at", label: "Refunded", kind: "date" },
             { key: "disputed_at", label: "Disputed", kind: "date" },
             { key: "payout_status", label: "Payout status" }],
  },
  payouts: {
    list: "payouts", title: "Payouts", blurb: "Money leaving the platform, and anything that failed on the way.",
    primary: "status", badge: "type", secondary: ["currency"], search: "Status",
    detail: [{ key: "at", label: "When", kind: "datetime" }, { key: "amount", label: "Amount", kind: "number" },
             { key: "currency", label: "Currency" }, { key: "arrival", label: "Arrives", kind: "date" },
             { key: "matched", label: "Matched contracts", kind: "number" },
             { key: "failure", label: "Failure" }],
    emptyWhy: "No payout has been recorded.",
  },
  disputes: {
    list: "disputes", title: "Disputes", blurb: "Chargebacks and their outcome.",
    primary: "reason", badge: "status", secondary: ["type"], search: "Reason",
    detail: [{ key: "at", label: "Opened", kind: "datetime" }, { key: "amount", label: "Amount", kind: "number" },
             { key: "currency", label: "Currency" }, { key: "type", label: "Event" },
             { key: "reversed", label: "Transfer reversed", kind: "bool" }],
    emptyWhy: "No dispute has ever been raised.",
  },
  subscriptions: {
    list: "subscriptions", title: "Subscriptions", blurb: "Who is paying, for which app, on which plan.",
    primary: "member", badge: "status", secondary: ["app", "plan"], search: "Name, address or app",
    detail: [{ key: "at", label: "Started", kind: "datetime" }, { key: "email", label: "Email" },
             { key: "app", label: "App" }, { key: "plan", label: "Plan" },
             { key: "interval", label: "Billing" }, { key: "period_end", label: "Renews", kind: "date" }],
    emptyWhy: "No app subscription is recorded.",
  },
  promo_codes: {
    list: "promo_codes", title: "Promo codes", blurb: "Discount codes, what they give and how often they have been used.",
    primary: "code", badge: "active", secondary: ["label", "kind"], search: "Code or label",
    detail: [{ key: "at", label: "Created", kind: "datetime" }, { key: "label", label: "Label" },
             { key: "kind", label: "Kind" }, { key: "value", label: "Value", kind: "number" },
             { key: "uses", label: "Used", kind: "number" }, { key: "max_uses", label: "Limit", kind: "number" },
             { key: "expires_at", label: "Expires", kind: "date" },
             { key: "rotates", label: "Rotates", kind: "bool" }, { key: "note", label: "Note" }],
  },
  promo_passes: {
    list: "promo_passes", title: "Access passes", blurb: "Passes that grant a plan without payment.",
    primary: "code", badge: "type", secondary: ["grants_plan", "source"], search: "Code or source",
    detail: [{ key: "at", label: "Created", kind: "datetime" }, { key: "active", label: "Active", kind: "bool" },
             { key: "used", label: "Used", kind: "number" }, { key: "allowed", label: "Allowed", kind: "number" },
             { key: "grants_plan", label: "Grants plan" }, { key: "grants_addon", label: "Grants add-on" },
             { key: "days", label: "Days granted", kind: "number" }, { key: "source", label: "Source" },
             { key: "expires_at", label: "Expires", kind: "date" },
             { key: "last_used_at", label: "Last used", kind: "date" }],
  },
  stripe_events: {
    list: "stripe_events", title: "Payment provider events", blurb: "Webhooks received from Stripe.",
    primary: "type", secondary: ["id"], windowed: true, search: "Event type",
    detail: [{ key: "at", label: "Received", kind: "datetime" }, { key: "type", label: "Type" },
             { key: "id", label: "Event id" }],
  },
  alerts: {
    list: "alerts", title: "Operational alerts", blurb: "Everything the watchdogs have raised.",
    primary: "code", badge: "severity", secondary: ["source"], search: "Code, source or message",
    detail: [{ key: "at", label: "Raised", kind: "datetime" }, { key: "source", label: "Source" },
             { key: "message", label: "Message" },
             { key: "acknowledged_at", label: "Acknowledged", kind: "date" },
             { key: "resolved_at", label: "Resolved", kind: "date" }],
    emptyWhy: "Nothing has been raised.",
  },
  banned: {
    list: "banned", title: "Ban list", blurb: "Addresses, phone numbers and devices refused at the door.",
    primary: "value", badge: "kind", secondary: ["reason"], search: "Value or reason",
    detail: [{ key: "at", label: "Banned", kind: "datetime" }, { key: "kind", label: "Kind" },
             { key: "reason", label: "Reason" }, { key: "notes", label: "Notes" }],
    emptyWhy: "Nobody is banned.",
  },
  blocked_ips: {
    list: "blocked_ips", title: "Blocked addresses", blurb: "Network addresses the platform refuses.",
    primary: "ip", badge: "bot", secondary: ["reason"], search: "Address or bot",
    detail: [{ key: "at", label: "Blocked", kind: "datetime" }, { key: "reason", label: "Reason" },
             { key: "bot", label: "Bot" }, { key: "count", label: "Attempts", kind: "number" },
             { key: "last_attempt", label: "Last attempt", kind: "date" },
             { key: "expires_at", label: "Expires", kind: "date" }],
    emptyWhy: "No address is blocked. The July database held 691 — that list was not carried over, and the current collector never blocks a visitor automatically.",
  },
  blocked_attempts: {
    list: "blocked_attempts", title: "Blocked attempts", blurb: "Requests turned away, newest first.",
    primary: "ip", badge: "bot", secondary: ["path"], windowed: true, search: "Address or bot",
    detail: [{ key: "at", label: "When", kind: "datetime" }, { key: "bot", label: "Bot" },
             { key: "path", label: "Path" }],
    emptyWhy: "Nothing has been turned away in this window.",
  },
  audit: {
    list: "audit", title: "Admin activity", blurb: "Every administrative read and action, and who made it.",
    primary: "actor", badge: "action", secondary: ["resource"], windowed: true, search: "Person, action or resource",
    detail: [{ key: "at", label: "When", kind: "datetime" }, { key: "action", label: "Action" },
             { key: "resource", label: "Resource" }, { key: "detail", label: "Detail", kind: "json" }],
  },
  reports: {
    list: "reports", title: "Content reports", blurb: "What members have reported, and whether it was reviewed.",
    primary: "reason", badge: "status", secondary: ["about", "target_type"], search: "Reason or person",
    detail: [{ key: "at", label: "Reported", kind: "datetime" }, { key: "about", label: "About" },
             { key: "by", label: "Reported by" }, { key: "target_type", label: "Kind" },
             { key: "detail", label: "Detail" }, { key: "reviewed_at", label: "Reviewed", kind: "date" },
             { key: "note", label: "Reviewer note" }],
    emptyWhy: "Nothing has been reported.",
  },
  qa: {
    list: "qa", title: "QA results", blurb: "Automated test runs and what failed.",
    primary: "feature", badge: "status", secondary: ["category", "type"], search: "Feature or status",
    detail: [{ key: "at", label: "Tested", kind: "datetime" }, { key: "tier", label: "Tier" },
             { key: "category", label: "Category" }, { key: "type", label: "Type" },
             { key: "ms", label: "Response time", kind: "number" }, { key: "error", label: "Error" }],
    emptyWhy: "No test result has been recorded here. 864 are in the July backup.",
  },
  transcripts: {
    list: "transcripts", title: "Transcripts", blurb: "Stored conversation transcripts.",
    primary: "file", badge: "source", secondary: ["messages"], search: "File or source",
    detail: [{ key: "at", label: "Uploaded", kind: "datetime" }, { key: "source", label: "Source" },
             { key: "messages", label: "Messages", kind: "number" },
             { key: "from", label: "Window from", kind: "date" }, { key: "to", label: "Window to", kind: "date" },
             { key: "bytes", label: "Size", kind: "number" }, { key: "notes", label: "Notes" }],
    emptyWhy: "No transcript has been stored here.",
  },
  backups: {
    list: "backups", title: "Backup runs", blurb: "Each sync, what it moved and whether it finished.",
    primary: "status", secondary: ["synced"], search: "Status",
    detail: [{ key: "at", label: "Started", kind: "datetime" },
             { key: "synced", label: "Records synced", kind: "number" },
             { key: "failed", label: "Records failed", kind: "number" },
             { key: "completed_at", label: "Finished", kind: "datetime" },
             { key: "error", label: "Error" }],
    emptyWhy: "No backup run has been recorded. The job that produced 8,288 runs before the migration is not running in One World — restoring this panel means restoring that job, not the screen.",
  },
  events: {
    list: "events", title: "Events", blurb: "Every event on the platform and what it has taken.",
    primary: "title", badge: "status", secondary: ["host", "location"], search: "Title or host",
    detail: [{ key: "at", label: "Created", kind: "datetime" }, { key: "host", label: "Host" },
             { key: "category", label: "Category" }, { key: "location", label: "Location" },
             { key: "starts", label: "Starts", kind: "date" },
             { key: "attendees", label: "Attendees", kind: "number" },
             { key: "revenue", label: "Revenue", kind: "money" }, { key: "currency", label: "Currency" },
             { key: "visibility", label: "Visibility" }],
  },
  listings: {
    list: "listings", title: "Property listings", blurb: "Every rental listing and who posted it.",
    primary: "title", badge: "status", secondary: ["city", "agent"], search: "Title, city or agent",
    detail: [{ key: "at", label: "Created", kind: "datetime" }, { key: "number", label: "Listing number" },
             { key: "agent", label: "Posted by" }, { key: "city", label: "City" },
             { key: "country", label: "Country" }, { key: "price", label: "Price", kind: "money" },
             { key: "currency", label: "Currency" }, { key: "unit", label: "Per" },
             { key: "type", label: "Property type" }, { key: "public", label: "Public", kind: "bool" }],
  },
};

function ListPanel({ spec, isAdmin, days, nonce }:
  { spec: ListSpec; isAdmin: boolean; days: number; nonce: number }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const size = 50;

  useEffect(() => { const timer = setTimeout(() => { setSearch(draft.trim()); setPage(0); }, 250); return () => clearTimeout(timer); }, [draft]);
  useEffect(() => { setPage(0); setOpen(null); }, [spec.list]);

  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_list", {
      p_list: spec.list,
      p_search: search || null,
      p_days: spec.windowed ? days : 3650,
      p_limit: size,
      p_offset: page * size,
    });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as ListResult;
  }, [spec.list, search, spec.windowed ? days : 0, page, nonce, isAdmin], isAdmin);

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="font-extrabold">{spec.title}</h2>
        <p className="text-[11px] opacity-45">{spec.blurb}</p>
      </div>

      <div className="card flex items-center gap-2 p-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl bg-ink/5 px-3 py-2.5 dark:bg-white/10">
          <span aria-hidden>⌕</span>
          <input value={draft} onChange={(event) => setDraft(event.target.value)}
            placeholder={spec.search} className="w-full bg-transparent text-sm outline-none"/>
        </label>
        {spec.windowed && <span className="shrink-0 px-1 text-[10px] font-bold opacity-40">window applies</span>}
      </div>

      {error && <Problem what="This list isn’t available." detail={error}/>}

      <div className="flex items-center justify-between px-1 text-xs opacity-50">
        <span>{data ? `${number(total)} record${total === 1 ? "" : "s"}` : "Loading…"}</span>
        {pages > 1 && <span>Page {page + 1} of {number(pages)}</span>}
      </div>

      {!data && !error && <div className="card h-24 animate-pulse"/>}

      {data && !data.rows.length && (
        search
          ? <div className="card p-10 text-center text-sm opacity-50">Nothing matches “{search}”.</div>
          : spec.emptyWhy
            ? <EmptySource what={spec.title} why={spec.emptyWhy}/>
            : <div className="card p-10 text-center text-sm opacity-50">Nothing here yet.</div>
      )}

      <div className="grid gap-2 xl:grid-cols-2">
        {data?.rows.map((row, index) => {
          const expanded = open === index;
          const badge = spec.badge ? row[spec.badge] : undefined;
          const badgeText = badge === true ? "Active" : badge === false ? "Off" : badge ? String(badge) : null;
          const tone = (badgeText ?? "").toLowerCase();
          const bad = ["failed", "bounced", "complained", "blocked", "error", "critical", "refunded", "disputed", "off", "expired"].some((word) => tone.includes(word));
          const good = ["paid", "active", "approved", "sent", "delivered", "resolved", "captured", "released", "live", "claimed", "passed"].some((word) => tone.includes(word));
          return (
            <article key={index} className="card overflow-hidden">
              <button onClick={() => setOpen(expanded ? null : index)}
                className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-brand/5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-extrabold">{show(row[spec.primary])}</p>
                    {badgeText && <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${bad ? "bg-red-500/15 text-red-500" : good ? "bg-teal/15 text-teal" : "bg-ink/10 text-ink/60 dark:bg-white/10 dark:text-white/60"}`}>{badgeText}</span>}
                  </div>
                  <p className="truncate text-xs opacity-50">
                    {(spec.secondary ?? []).map((key) => show(row[key])).filter((value) => value !== "—").join(" · ") || "—"}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] opacity-40">{when(row.at)}</span>
              </button>
              {expanded && (
                <div className="border-t border-ink/5 p-3 dark:border-white/5">
                  <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
                    {spec.detail.map((field) => (
                      <div key={field.key} className={field.kind === "json" || field.label.length > 16 ? "col-span-2 md:col-span-3" : ""}>
                        <dt className="text-[9px] font-bold uppercase tracking-wide opacity-40">{field.label}</dt>
                        <dd className="mt-0.5 break-words font-semibold">{show(row[field.key], field.kind)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}
            className={`rounded-xl border px-4 py-2 text-xs font-extrabold transition ${page === 0 ? "border-ink/10 opacity-55 dark:border-white/10" : "ow-edge hover:bg-brand/5"}`}>
            Previous
          </button>
          <button disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}
            className={`rounded-xl border px-4 py-2 text-xs font-extrabold transition ${page + 1 >= pages ? "border-ink/10 opacity-55 dark:border-white/10" : "ow-edge hover:bg-brand/5"}`}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}

/* ================================================== the member record ====================== */

function RecordGrid({ title, rows, hideEmpty = false }:
  { title: string; rows: Array<[string, string]>; hideEmpty?: boolean }) {
  /* On a healthy account "Suspended —" and "Suspended because —" are two rows that say nothing.
     Exception fields are dropped when empty; a real "No" is a value and stays. */
  const visible = hideEmpty ? rows.filter(([, value]) => value !== "—") : rows;
  return (
    <section className="card p-4">
      <h3 className="text-sm font-extrabold">{title}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
        {visible.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[9px] font-bold uppercase tracking-wide opacity-40">{label}</dt>
            <dd className="mt-0.5 break-words font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------- administrative actions */

type ActionDef = { id: string; label: string; needsReason: boolean; destructive: boolean; explains: string };

const PRODUCT_KEYS = ["onejob", "onescore", "oneevent", "onesocial", "oneagent",
                      "onehome", "onevoice", "onepage", "oneapp", "onepay", "onebusiness"] as const;

/** Every action is armed first and confirmed second. There is no native confirm dialog: one
 *  blocks the whole page, and on a phone it is a system sheet that looks like nothing else in
 *  the app. Arming shows the reason field and a single confirm button instead. */
function MemberActions({ record, userId, onDone }:
  { record: MemberRecord; userId: string; onDone: () => void }) {
  const [armed, setArmed] = useState<ActionDef | null>(null);
  const [reason, setReason] = useState("");
  const [product, setProduct] = useState<string>("onejob");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const account = record.account ?? {};
  const suspended = !!account.suspended_at;
  const locked = !!account.admin_locked;
  const banned = !!(record.moderation ?? {}).banned_identity;
  const email = (record.profile ?? {}).email;
  const phone = (record.profile ?? {}).phone;

  const available: ActionDef[] = [
    suspended
      ? { id: "unsuspend", label: "Lift suspension", needsReason: false, destructive: false,
          explains: "The member can use the platform again." }
      : { id: "suspend", label: "Suspend", needsReason: true, destructive: true,
          explains: "Stops the member using the platform. Nothing of theirs is deleted." },
    locked
      ? { id: "unlock", label: "Unlock profile", needsReason: false, destructive: false,
          explains: "Automated jobs may edit this profile again." }
      : { id: "lock", label: "Lock profile", needsReason: true, destructive: true,
          explains: "Freezes the name, photo and title so no automated job can change them." },
    ...(banned
      ? [{ id: "unban", label: "Remove from ban list", needsReason: false, destructive: false,
           explains: "Their address and number can sign up again." }]
      : [
          ...(email ? [{ id: "ban_email", label: "Ban address", needsReason: true, destructive: true,
                         explains: "This email address can no longer create an account." }] : []),
          ...(phone ? [{ id: "ban_phone", label: "Ban number", needsReason: true, destructive: true,
                         explains: "This phone number can no longer create an account." }] : []),
        ]),
  ];

  const run = async (action: string, value?: string) => {
    setBusy(true); setError(""); setDone("");
    const { error: rpcError } = await supabase.rpc("admin_member_action", {
      p_user_id: userId, p_action: action, p_reason: reason.trim() || null, p_value: value ?? null,
    });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    setArmed(null); setReason("");
    setDone("Done. The record below has been reloaded.");
    onDone();
  };

  return (
    <section className="card border border-amber-500/30 p-4">
      <h3 className="text-sm font-extrabold">Administrative actions</h3>
      <p className="mt-1 text-xs opacity-60">
        These change the member&rsquo;s account. Each one is recorded with your name, your reason and
        what the account looked like beforehand. Nothing here deletes a member, and a paid plan is
        still only changed by checkout.
      </p>

      {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-500">{error}</p>}
      {done && <p className="mt-3 rounded-xl bg-teal/10 px-3 py-2 text-[11px] font-semibold text-teal">{done}</p>}

      {!armed && (
        <div className="mt-3 flex flex-wrap gap-2">
          {available.map((action) => (
            <button key={action.id} onClick={() => { setArmed(action); setReason(""); setError(""); setDone(""); }}
              className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${action.destructive ? "border-red-500/40 text-red-500 hover:bg-red-500/10" : "ow-edge hover:bg-brand/5"}`}>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {armed && (
        <div className="mt-3 space-y-2 rounded-xl bg-ink/5 p-3 dark:bg-white/5">
          <p className="text-xs font-semibold">{armed.explains}</p>
          {armed.needsReason && (
            <input value={reason} onChange={(event) => setReason(event.target.value)} autoFocus
              placeholder="Why — this is stored with the action"
              className="w-full rounded-xl border ow-edge bg-transparent px-3 py-2 text-sm outline-none"/>
          )}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy || (armed.needsReason && reason.trim().length < 3)}
              onClick={() => run(armed.id)}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold text-white transition ${busy || (armed.needsReason && reason.trim().length < 3) ? "bg-ink/25 dark:bg-white/25" : armed.destructive ? "bg-red-500 hover:bg-red-600" : "bg-brand"}`}>
              {busy ? "Working…" : armed.label}
            </button>
            <button onClick={() => { setArmed(null); setReason(""); }}
              className="rounded-xl border ow-edge px-4 py-2 text-xs font-extrabold transition hover:bg-brand/5">
              Cancel
            </button>
          </div>
          {armed.needsReason && reason.trim().length < 3 && (
            <p className="text-[10px] opacity-50">A reason is required before this can be applied.</p>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-ink/5 pt-3 dark:border-white/5">
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-40">Product access</p>
        <p className="mt-1 text-xs opacity-60">
          Grants or removes the entitlement the product screens read. It does not create or cancel
          a subscription, and it does not take or refund money.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Dropdown label="Product" className="w-40" value={product} onChange={setProduct}
            options={PRODUCT_KEYS.map((key) => ({ value: key, label: productName(key) }))}/>
          <button disabled={busy} onClick={() => run("grant_product", product)}
            className="rounded-xl border ow-edge px-3 py-2 text-xs font-extrabold transition hover:bg-brand/5">
            Grant
          </button>
          <button disabled={busy} onClick={() => run("revoke_product", product)}
            className="rounded-xl border border-red-500/40 px-3 py-2 text-xs font-extrabold text-red-500 transition hover:bg-red-500/10">
            Revoke
          </button>
        </div>
      </div>
    </section>
  );
}

function MemberRecordPanel({ userId, isAdmin, onBack }: { userId: string; isAdmin: boolean; onBack: () => void }) {
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const record = useAsync(async () => {
    const { data, error: rpcError } = await supabase.rpc("admin_member_record", { p_user_id: userId });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return data as unknown as MemberRecord;
  }, [userId, reload, isAdmin], isAdmin);

  const back = (
    <button onClick={onBack} className="rounded-xl border ow-edge px-3 py-2 text-xs font-extrabold transition hover:bg-brand/5">
      ← Back to the directory
    </button>
  );

  if (error) return <div className="space-y-3">{back}<Problem what="That member’s record isn’t available." detail={error}/></div>;
  if (!record) return <div className="space-y-3">{back}<div className="card h-48 animate-pulse"/></div>;

  const p = record.profile ?? {};
  const account = record.account ?? {};
  const plan = record.plan ?? {};
  const score = record.score ?? {};
  const money$ = record.money ?? {};
  const contracts = money$.contracts ?? {};
  const activity = record.activity ?? {};
  const moderation = record.moderation ?? {};

  return (
    <div className="space-y-3">
      {back}

      <section className="card flex items-center gap-3 p-4">
        <Avatar src={p.photo_url} name={p.full_name} size={56} rounded="rounded-full" textSize="text-base"/>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-black">{show(p.full_name)}</h2>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[9px] font-extrabold uppercase text-brand">{show(account.membership)}</span>
            {account.suspended_at && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-extrabold uppercase text-red-500">Suspended</span>}
            {account.admin_locked && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-extrabold uppercase text-amber-600 dark:text-amber-400">Locked</span>}
          </div>
          <p className="truncate text-xs opacity-50">{show(p.email)}</p>
          {p.phone && <p className="truncate text-xs opacity-50">{p.phone}</p>}
        </div>
        <div className="shrink-0 text-right">
          <b className="text-xl">{score.current == null ? "—" : Math.round(Number(score.current))}</b>
          <p className="text-[9px] uppercase opacity-40">score</p>
        </div>
      </section>

      <RecordGrid title="Who they are" rows={[
        ["Location", show(p.location)], ["Profession", show(p.job_title)],
        ["Industry", show(p.industry)], ["Category", show(p.category)],
        ["Years of experience", show(p.years_experience, "number")],
        ["Public profile", show(p.is_public, "bool")],
        ["Joined", show(p.created_at, "datetime")], ["Last updated", show(p.updated_at, "date")],
        ["Signed up in", show(p.signup_app)], ["Entry product", show(p.entry_product)],
        ["Campaign", show(p.entry_campaign)], ["Referral source", show(p.referral_source)],
        ["From the waitlist", show(p.from_waitlist, "bool")],
        ["Created as", show(p.account_creation_mode)],
      ]}/>

      <RecordGrid title="Account and access" rows={[
        ["Membership", show(account.membership)],
        ["Last sign-in", show(account.last_sign_in_at, "datetime")],
        ["Login created", show(account.login_created_at, "date")],
        ["Email confirmed", show(account.email_confirmed_at, "date")],
        ["Onboarding finished", show(account.onboarding_completed_at, "date")],
        ["Still onboarding", show(account.onboarding_incomplete, "bool")],
        ["Terms accepted", show(account.terms_accepted_at, "date")],
        ["Terms version", show(account.terms_version)],
        ["Age confirmed", show(account.age_confirmed_at, "date")],
        ["Texts opted in", show(account.sms_optin, "bool")],
        ["WhatsApp opted in", show(account.whatsapp_optin, "bool")],
        ["Claim link open", show(account.claim_link_open, "bool")],
        ["Setup link open", show(account.setup_link_open, "bool")],
        ["Suspended", show(account.suspended_at, "date")],
        ["Suspended because", show(account.suspended_reason)],
        ["Locked because", show(account.admin_locked_reason)],
      ]} hideEmpty/>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="card p-4">
          <h3 className="text-sm font-extrabold">Plan and products</h3>
          <dl className="mt-3 divide-y divide-ink/5 text-sm dark:divide-white/5">
            <div className="flex items-center justify-between py-2"><dt className="opacity-60">Plan</dt><dd className="font-black uppercase">{show(plan.plan)}</dd></div>
            <div className="flex items-center justify-between py-2"><dt className="opacity-60">Billing</dt><dd className="font-black">{show(plan.plan_interval)}</dd></div>
            <div className="flex items-center justify-between py-2"><dt className="opacity-60">Renews</dt><dd className="font-black">{show(plan.current_period_end, "date")}</dd></div>
            <div className="flex items-center justify-between py-2"><dt className="opacity-60">Stripe customer</dt><dd className="font-black">{show(plan.stripe_customer_id, "bool")}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(record.products ?? []).map((item: any) => (
              <span key={item.product} className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "active" ? "bg-brand/10 text-brand" : "bg-ink/10 opacity-60 dark:bg-white/10"}`}>
                {productName(String(item.product))}{item.plan ? ` · ${item.plan}` : ""}
              </span>
            ))}
            {!(record.products ?? []).length && <span className="text-[10px] opacity-40">No product connected</span>}
          </div>
          {!!(record.promotional_access ?? []).length && (
            <p className="mt-3 text-[11px] opacity-60">
              Holds a promotional grant: {(record.promotional_access ?? []).map((g: any) => g.plan ?? g.addon ?? g.code).filter(Boolean).join(", ")}
            </p>
          )}
        </section>

        <section className="card p-4">
          <h3 className="text-sm font-extrabold">Money</h3>
          <dl className="mt-3 divide-y divide-ink/5 text-sm dark:divide-white/5">
            {([
              ["Contracts as payer", contracts.as_payer],
              ["Contracts as payee", contracts.as_payee],
              ["Captured", contracts.captured],
              ["Released", contracts.released],
              ["Refunded", contracts.refunded],
              ["Disputed", contracts.disputed],
            ] as Array<[string, unknown]>).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2"><dt className="opacity-60">{label}</dt><dd className="font-black">{number(value)}</dd></div>
            ))}
            <div className="flex items-center justify-between py-2"><dt className="opacity-60">Received</dt><dd className="font-black">{money(contracts.paid_in)}</dd></div>
            <div className="flex items-center justify-between py-2"><dt className="opacity-60">Paid out</dt><dd className="font-black">{money(contracts.paid_out)}</dd></div>
          </dl>
          {money$.payout_account
            ? <p className="mt-3 text-[11px] opacity-60">
                Payout account connected {when(money$.payout_account.connected_at)} · payouts {money$.payout_account.payouts_enabled ? "enabled" : "not enabled"}
                {money$.payout_account.bank_last4 ? ` · bank ending ${money$.payout_account.bank_last4}` : ""}
              </p>
            : <p className="mt-3 text-[11px] opacity-40">No payout account connected.</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(money$.payment_methods ?? []).map((m: any, index: number) => (
              <span key={index} className="rounded-full bg-ink/5 px-2 py-1 text-[10px] font-bold dark:bg-white/10">
                {m.brand ?? m.type}{m.last4 ? ` ····${m.last4}` : ""}{m.primary ? " · primary" : ""}
              </span>
            ))}
          </div>
        </section>
      </div>

      <RecordGrid title="What they have done" rows={([
        ["Events hosted", activity.events_hosted], ["Event applications", activity.event_applications],
        ["Event registrations", activity.event_registrations], ["Property listings", activity.rental_listings],
        ["Jobs posted", activity.jobs_posted], ["Media posts", activity.media_posts],
        ["Endorsements given", activity.endorsements_given], ["Endorsements received", activity.endorsements_got],
        ["Testimonials", activity.testimonials], ["Connected platforms", activity.social_connections],
        ["Messages sent", activity.messages_sent], ["Saved items", activity.saved_items],
        ["Text invites sent", activity.sms_invites_sent], ["Referrals made", activity.referrals_made],
      ] as Array<[string, unknown]>).map(([label, value]) => [label, number(value)] as [string, string])}/>

      {!!(record.connected_platforms ?? []).length && (
        <section className="card p-4">
          <h3 className="text-sm font-extrabold">Connected platforms</h3>
          <div className="mt-3 space-y-2 text-xs">
            {(record.connected_platforms ?? []).map((c: any, index: number) => (
              <div key={index} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/5 pb-2 last:border-0 dark:border-white/5">
                <span className="font-extrabold">{titleCase(String(c.platform))}</span>
                <span className="opacity-60">{c.username ? `@${c.username}` : "—"}</span>
                <span className="opacity-45">{c.verified ? "verified" : c.status ?? "connected"} · {when(c.last_sync_at)}</span>
                {c.last_sync_error && <span className="w-full text-amber-600 dark:text-amber-400">{c.last_sync_error}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {!!(money$.recent_contracts ?? []).length && (
        <section className="card p-4">
          <h3 className="text-sm font-extrabold">Recent contracts</h3>
          <div className="mt-3 space-y-2 text-xs">
            {(money$.recent_contracts ?? []).map((c: any) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/5 pb-2 last:border-0 dark:border-white/5">
                <span className="min-w-0 flex-1 truncate font-extrabold">{show(c.title)}</span>
                <span className="opacity-60">{c.role} · {show(c.status)}</span>
                <span className="font-black">{money(c.amount)} {c.currency ?? ""}</span>
                <span className="opacity-45">{when(c.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <RecordGrid title="Moderation" rows={([
          ["Reports against them", moderation.reports_against],
          ["Reports they filed", moderation.reports_filed],
          ["People they blocked", moderation.blocks_made],
          ["Score penalties", moderation.score_penalties],
        ] as Array<[string, unknown]>).map(([label, value]) => [label, number(value)] as [string, string])
          .concat([["On the ban list", show(moderation.banned_identity, "bool")]])}/>

        <section className="card p-4">
          <h3 className="text-sm font-extrabold">Consent and paperwork</h3>
          <div className="mt-3 space-y-2 text-xs">
            {(record.consents ?? []).map((c: any, index: number) => (
              <div key={index} className="flex items-center justify-between border-b border-ink/5 pb-2 last:border-0 dark:border-white/5">
                <span className="opacity-60">{titleCase(String(c.purpose))}</span>
                <span className="font-extrabold">{c.granted ? "Granted" : "Refused"} · {when(c.granted_at)}</span>
              </div>
            ))}
            {!(record.consents ?? []).length && <p className="opacity-40">No consent recorded.</p>}
            {(record.legal_acceptances ?? []).map((l: any, index: number) => (
              <div key={`legal-${index}`} className="flex items-center justify-between border-b border-ink/5 pb-2 last:border-0 dark:border-white/5">
                <span className="opacity-60">{titleCase(String(l.scope))}</span>
                <span className="font-extrabold">accepted {when(l.accepted_at)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {!!(score.history ?? []).length && (
        <section className="card p-4">
          <h3 className="text-sm font-extrabold">Score history</h3>
          <div className="mt-3 space-y-1.5 text-xs">
            {(score.history ?? []).map((h: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <span className="opacity-50">{exact(h.at)}</span>
                <span className="font-extrabold">{h.one_score == null ? "—" : Math.round(Number(h.one_score))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <MemberActions record={record} userId={userId} onDone={() => setReload((value) => value + 1)}/>

      <p className="pt-1 text-center text-[10px] opacity-35">Opening this record, and every action on it, is recorded in the admin activity log</p>
    </div>
  );
}

/* ================================================== the panels ============================= */

function useConsole(isAdmin: boolean, windowIndex: number, nonce: number) {
  const [error, setError] = useState("");
  const chosen = WINDOWS[windowIndex] ?? WINDOWS[6];
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_console_metrics", {
      p_days: chosen.days, p_hours: chosen.hours,
    });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as Console;
  }, [windowIndex, nonce, isAdmin], isAdmin);
  return { data, error };
}

function OverviewPanel({ console: metrics, overview, openTraffic, goto }:
  { console: Console | undefined; overview: Overview | undefined; openTraffic: (view: TrafficView) => void;
    goto: Goto }) {
  const [showAll, setShowAll] = useState(false);
  if (!metrics) return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;
  const w = metrics.window.label;
  const p = periodName(metrics.window);
  const g = metrics.growth;
  const people = metrics.people as Record<string, number>;
  const ops = metrics.ops as Record<string, number>;

  /* The four essentials the July Overview led with, everything else behind one toggle. */
  const essentials: Array<[string, Kpi | number, AccentKey, (() => void) | undefined, string | undefined]> = [
    ["Visitors", g.visitors, "brand", () => openTraffic("visitors"), "See who"],
    ["Visits", g.visits, "brand", () => openTraffic("visits"), "See each visit"],
    ["Signups", g.signups, "violet", undefined, undefined],
    ["Onboarded", g.onboarded, "violet", undefined, undefined],
  ];
  const rest: Array<[string, Kpi | number]> = [
    ["Page views", g.page_views], ["Product actions", g.product_actions],
    ["Bot visitors", g.bot_visitors], ["Locations", g.locations],
    ["Emails sent", g.emails_sent], ["Email failures", g.email_failures],
    ["Real members", people.real], ["Active products", people.products_active],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {essentials.map(([label, value, accent, onOpen, openLabel]) =>
          <MetricCard key={label} label={label} value={value} windowLabel={w} accent={accent} onOpen={onOpen} openLabel={openLabel} />)}
      </div>
      <button onClick={() => setShowAll((value) => !value)} className="w-full rounded-xl border ow-edge py-2 text-[11px] font-extrabold text-brand transition hover:bg-brand/5">
        {showAll ? "Hide extra metrics" : `Show all metrics (+${rest.length})`}
      </button>
      {showAll && <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {rest.map(([label, value]) => <MetricCard key={label} label={label} value={value} windowLabel={w} />)}
      </div>}

      {overview && <section className="card p-4">
        <div className="flex items-start justify-between">
          <div><h3 className="font-extrabold">Audience trend</h3><p className="text-xs opacity-45">Unique visitors per day</p></div>
          <p className="text-right text-xs opacity-45">Human {number(overview.traffic.human)}<br/>Bots {number(overview.traffic.bot)}</p>
        </div>
        <Sparkline points={overview.daily}/>
      </section>}

      <div className="grid gap-3 md:grid-cols-3">
        <OperationCard accent="violet" title="People" subtitle="All time"
          lead={{ label: "Real members", value: people.real, open: () => goto("people", "Directory"),
                  openLabel: "Open the directory",
                  note: people.real
                    ? `${Math.round((people.onboarded / Math.max(people.real, 1)) * 100)}% have finished onboarding`
                    : "Nobody has signed up yet" }}
          rows={[
            { label: "Onboarded", value: people.onboarded, of: people.real, tone: "good",
              open: () => goto("people", "Directory"), zeroLabel: "None yet" },
            { label: "Pending onboarding", value: people.pending_onboarding, of: people.real, tone: "warn",
              open: () => goto("people", "Incomplete"), zeroLabel: "Nobody waiting" },
            { label: "Claimed accounts", value: people.claimed, of: people.real,
              open: () => goto("people", "Directory"), zeroLabel: "None claimed" },
            { label: "Never claimed", value: people.migrated, of: people.real, tone: "warn",
              open: () => goto("people", "Directory"), zeroLabel: "None outstanding" },
          ]}
          footer="The full roster lives on the People tab — it is not repeated here."/>

        {overview && <OperationCard accent="emerald" title="OneEvent" subtitle="All time"
          lead={{ label: "Events published", value: overview.operations.oneevent.events,
                  open: () => goto("catalog", "Events"), openLabel: "Open the event list",
                  note: overview.operations.oneevent.events
                    ? `${number(overview.operations.oneevent.registrations)} registration${overview.operations.oneevent.registrations === 1 ? "" : "s"} taken`
                    : "No event has been published yet" }}
          rows={[
            { label: "Registrations", value: overview.operations.oneevent.registrations,
              open: () => goto("catalog", "Events"), zeroLabel: "None yet" },
            { label: "Applications", value: overview.operations.oneevent.applications,
              open: () => goto("catalog", "Events"), zeroLabel: "None received" },
            { label: "Pending approvals", value: overview.operations.oneevent.pending_approvals,
              of: overview.operations.oneevent.applications, tone: "warn",
              open: () => goto("catalog", "Events"), zeroLabel: "All cleared" },
            { label: "Payment attention", value: overview.operations.oneevent.payment_attention, tone: "warn",
              open: () => goto("money", "Stripe"), zeroLabel: "All clear" },
          ]}
          empty="No events have been published yet, so nothing has been registered or paid for."/>}

        {overview && <OperationCard accent="emerald" title="OneHome" subtitle="All time"
          lead={{ label: "Properties listed", value: overview.operations.onehome.rental_listings + overview.operations.onehome.sale_listings,
                  open: () => goto("catalog", "Listings"), openLabel: "Open the listing list",
                  note: (overview.operations.onehome.rental_listings + overview.operations.onehome.sale_listings)
                    ? `${number(overview.operations.onehome.rental_listings)} to rent · ${number(overview.operations.onehome.sale_listings)} for sale`
                    : "No property has been listed yet" }}
          rows={[
            { label: "Rental requests", value: overview.operations.onehome.rental_requests,
              open: () => goto("catalog", "Listings"), zeroLabel: "None received" },
            { label: "Active contracts", value: overview.operations.onehome.active_contracts, tone: "good",
              open: () => goto("money", "Contracts"), zeroLabel: "None active" },
            { label: "Sale deals", value: overview.operations.onehome.sale_deals, tone: "good",
              open: () => goto("money", "Contracts"), zeroLabel: "None yet" },
          ]}
          empty="No property has been listed yet, so there is nothing to request or contract."/>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <OperationCard accent="sky" title="Needs attention" subtitle="Right now"
          lead={{ label: "Things waiting on you", value: ops.alerts_open + ops.onboarding_incomplete + ops.money_truth_violations,
                  open: () => goto("ops", "Health"), openLabel: "Open Ops",
                  note: (ops.alerts_open + ops.onboarding_incomplete + ops.money_truth_violations)
                    ? "Open alerts, unfinished onboarding and money-truth violations"
                    : "Nothing is waiting on a human right now" }}
          rows={[
            { label: "Open alerts", value: ops.alerts_open, tone: "warn", open: () => goto("ops", "Alerts"), zeroLabel: "None open" },
            { label: "Critical alerts", value: ops.alerts_critical, of: ops.alerts_open, tone: "warn",
              open: () => goto("ops", "Alerts"), zeroLabel: "None critical" },
            { label: "Onboarding incomplete", value: ops.onboarding_incomplete, of: people.real, tone: "warn",
              open: () => goto("people", "Incomplete"), zeroLabel: "Everyone finished" },
            { label: `Email failures in ${p}`, value: ops.email_failures_window, tone: "warn",
              open: () => goto("growth", "Failures"), zeroLabel: "None" },
            { label: "Money-truth violations", value: ops.money_truth_violations, tone: "warn",
              open: () => goto("ops", "Admin log"), zeroLabel: "None" },
          ]}
          empty="Nothing needs a human right now. This card is the one you want to stay empty."/>

        <OperationCard accent="amber" title="Money at a glance" subtitle={p}
          lead={{ label: `Captured in ${p}`, value: num((metrics.money as Record<string, unknown>).gross_captured), money: true,
                  open: () => goto("money", "Summary"), openLabel: "Open Money",
                  note: `Platform fee ${money(num((metrics.money as Record<string, unknown>).platform_fee))} · ${number(num((metrics.money as Record<string, unknown>).paid_agreements))} paid contract${num((metrics.money as Record<string, unknown>).paid_agreements) === 1 ? "" : "s"}` }}
          rows={[
            { label: `Paid contracts in ${p}`, value: num((metrics.money as Record<string, unknown>).paid_agreements),
              open: () => goto("money", "Contracts"), zeroLabel: "None" },
            { label: "Awaiting capture", value: num((metrics.money as Record<string, unknown>).awaiting_capture), tone: "warn",
              open: () => goto("money", "Contracts"), zeroLabel: "None held" },
            { label: "Open disputes", value: num((metrics.money as Record<string, unknown>).disputes_open), tone: "warn",
              open: () => goto("money", "Disputes"), zeroLabel: "None open" },
            { label: "Active subscriptions", value: num((metrics.money as Record<string, unknown>).subscriptions_active),
              open: () => goto("money", "Subscriptions"), zeroLabel: "None active" },
            { label: "Active promo codes", value: num((metrics.money as Record<string, unknown>).promo_codes_active),
              open: () => goto("money", "Promo codes"), zeroLabel: "None active" },
          ]}
          empty="No money has moved through One World in this window. Widen the window with the time chips above, or check the Money tab for lifetime figures."/>
      </div>
    </div>
  );
}

/* ============================================== the traffic explorer ======================= */

type TrafficView = "visitors" | "visits" | "views" | "sources" | "pages" | "countries" | "cities" | "devices" | "bots";
const TRAFFIC_VIEWS: Array<[TrafficView, string]> = [
  ["visitors", "People"], ["visits", "Visits"], ["views", "Page views"],
  ["sources", "Came from"], ["pages", "Pages"], ["countries", "Countries"],
  ["cities", "Cities"], ["devices", "Devices"], ["bots", "Crawlers"],
];
type TrafficDetail = {
  view: string;
  totals: { visitors: number; visits: number; views: number; events: number; with_address: number; rows: number };
  filters: Record<string, string | null>;
  rows: Row[];
};
type TrafficQuery = { view: TrafficView; country?: string | null; device?: string | null; search?: string };

/* The collector records whatever the platform hands it, so the same country arrives as "CO" one
   day and "Colombia" the next. A reader should not have to know ISO codes, and two spellings of
   one country should not look like two countries. */
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CO: "Colombia", GB: "United Kingdom", DE: "Germany", FR: "France",
  ES: "Spain", MX: "Mexico", CA: "Canada", BR: "Brazil", AR: "Argentina", CL: "Chile",
  PE: "Peru", EC: "Ecuador", PA: "Panama", IT: "Italy", NL: "Netherlands", PT: "Portugal",
  IE: "Ireland", AU: "Australia", IN: "India", NG: "Nigeria", ZA: "South Africa",
  SE: "Sweden", PL: "Poland", RU: "Russia", CN: "China", JP: "Japan", SG: "Singapore",
};
const country = (value: unknown) => {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return COUNTRY_NAMES[v.toUpperCase()] ?? v;
};

const secs = (n: unknown) => {
  const v = Number(n ?? 0);
  if (!v) return "—";
  if (v < 60) return `${v}s`;
  if (v < 3600) return `${Math.round(v / 60)}m`;
  return `${(v / 3600).toFixed(1)}h`;
};

/** The rows behind a traffic number.
 *
 *  Every figure across the top is itself a control: pressing People switches the list to one row
 *  per person, pressing Visits to one row per visit. The list and the figure come from one scope
 *  on the server, so they cannot disagree — which is the reason this exists rather than a second
 *  query that counts things its own way and drifts. */
function TrafficExplorer({ isAdmin, days, hours, query, onQuery, product, audience }:
  { isAdmin: boolean; days: number; hours: number | null; query: TrafficQuery; onQuery: (q: TrafficQuery) => void;
    product: string; audience: string }) {
  const [draft, setDraft] = useState(query.search ?? "");
  const [search, setSearch] = useState(query.search ?? "");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const size = 50;

  useEffect(() => { const t = setTimeout(() => { setSearch(draft.trim()); setPage(0); }, 250); return () => clearTimeout(t); }, [draft]);
  useEffect(() => { setPage(0); }, [query.view, query.country, query.device, days, hours, product, audience]);
  useEffect(() => { setDraft(query.search ?? ""); }, [query.search]);

  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_traffic_detail", {
      p_view: query.view, p_days: days, p_hours: hours,
      p_product: product || null, p_traffic: audience,
      p_country: query.country ?? null, p_device: query.device ?? null,
      p_search: search || null, p_limit: size, p_offset: page * size,
    });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as TrafficDetail;
  }, [query.view, query.country, query.device, days, hours, product, audience, search, page, isAdmin], isAdmin);

  const t = data?.totals;
  const pages = Math.max(1, Math.ceil((t?.rows ?? 0) / size));
  const narrowed = !!(query.country || query.device || search);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {([["visitors", "People", t?.visitors], ["visits", "Visits", t?.visits], ["views", "Page views", t?.views]] as Array<[TrafficView, string, number | undefined]>)
          .map(([view, label, value]) => (
            <button key={view} onClick={() => onQuery({ ...query, view })} aria-pressed={query.view === view}
              className={`card relative overflow-hidden p-3 pl-4 text-left transition ${query.view === view ? "ring-1 ring-brand/40" : "hover:bg-brand/5"}`}>
              <span className={`absolute inset-y-0 left-0 w-1 ${query.view === view ? "bg-brand" : "bg-ink/10 dark:bg-white/15"}`} aria-hidden />
              <p className="text-[10px] font-bold uppercase tracking-[.12em] opacity-45">{label}</p>
              <p className="mt-1 text-xl font-black leading-none tabular-nums">{data ? number(value) : "—"}</p>
            </button>
          ))}
      </div>

      {/* Product and audience live in the one filter row at the top of the console now — this
          panel used to carry its own copies, which is how the screen ended up with three
          separate rows of chrome saying the same thing. */}
      <label className="ow-field flex items-center gap-2 rounded-xl px-3 py-2">
        <span aria-hidden>⌕</span>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Search these rows" className="w-full bg-transparent text-sm outline-none"/>
      </label>

      <div className="ow-rail scrollbar-none flex gap-1 overflow-x-auto rounded-2xl p-1" role="tablist" aria-label="Traffic views">
        {TRAFFIC_VIEWS.map(([view, label]) => (
          <button key={view} role="tab" aria-selected={query.view === view} onClick={() => onQuery({ ...query, view })}
            className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-extrabold transition ${query.view === view ? "ow-chip-on text-brand" : "opacity-55 hover:opacity-100"}`}>{label}</button>
        ))}
      </div>

      {narrowed && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-[11px]">
          <span className="opacity-45">Narrowed to</span>
          {query.country && <button onClick={() => onQuery({ ...query, country: null })} className="rounded-full bg-brand/10 px-2 py-1 font-extrabold text-brand">{country(query.country)} ✕</button>}
          {query.device && <button onClick={() => onQuery({ ...query, device: null })} className="rounded-full bg-brand/10 px-2 py-1 font-extrabold text-brand">{query.device} ✕</button>}
          {search && <button onClick={() => { setDraft(""); onQuery({ ...query, search: "" }); }} className="rounded-full bg-brand/10 px-2 py-1 font-extrabold text-brand">{search} ✕</button>}
        </div>
      )}

      {error && <Problem what="Traffic detail isn’t available." detail={error}/>}
      {!data && !error && <div className="card h-40 animate-pulse"/>}

      {data && t && t.views === 0 && (
        <EmptySource what="Traffic in this window"
          why="Nothing was recorded between the start of this window and now. Widen the window with the chips above, or switch the audience to Everything to include crawlers."/>
      )}

      {data && !!data.rows.length && (
        <>
          <div className="flex items-center justify-between px-1 text-xs opacity-50">
            <span>{number(t?.rows)} {TRAFFIC_VIEWS.find(([v]) => v === query.view)?.[1].toLowerCase() ?? "rows"}</span>
            {pages > 1 && <span>Page {page + 1} of {number(pages)}</span>}
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            {data.rows.map((row, i) => <TrafficRow key={i} view={query.view} row={row} onNarrow={onQuery} query={query}/>)}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={page === 0} onClick={() => setPage((v) => Math.max(0, v - 1))}
                className={`rounded-xl border px-4 py-2 text-xs font-extrabold transition ${page === 0 ? "border-ink/10 opacity-55 dark:border-white/10" : "ow-edge hover:bg-brand/5"}`}>Previous</button>
              <button disabled={page + 1 >= pages} onClick={() => setPage((v) => v + 1)}
                className={`rounded-xl border px-4 py-2 text-xs font-extrabold transition ${page + 1 >= pages ? "border-ink/10 opacity-55 dark:border-white/10" : "ow-edge hover:bg-brand/5"}`}>Next</button>
            </div>
          )}
        </>
      )}

      {data && t && t.views > 0 && t.with_address === 0 && (query.view === "visitors" || query.view === "visits" || query.view === "views") && (
        <p className="card p-3 text-[11px] opacity-60">
          No network address is shown because the collector running today does not record one.
          Visits from before the move to One World do carry an address and will appear here once
          the old records are loaded. Recording it again for new visits is a one-line change and
          your call — it counts as personal data in Europe and in Colombia.
        </p>
      )}
    </div>
  );
}

/** One row of the explorer. What it shows depends on what was asked for, because a person, a visit
 *  and a page view are three different things, and one generic row would flatten all three into
 *  something that reads like none of them. */
/* ── IS THIS BOT GOOD OR BAD? ────────────────────────────────────────────────────────────────
   Lee, 22 Sep 2026: *"I'm curious about if these bots are bad or are good."*

   A count of "bots" answers nothing, because the word covers four different things and three of
   them are wanted. Googlebot indexing the site is how anybody finds it. A link preview fetched
   by WhatsApp is somebody sharing a listing. Our own test harness is us. Only the fourth —
   something scraping or probing that identifies as none of the above — is worth acting on.

   So every crawler row carries a verdict, and the counts separate on that verdict rather than on
   the bare is_bot flag. The classification is deliberately conservative: anything that does not
   clearly identify itself as one of the first three is called unknown, not bad. */
type Verdict = { key: "wanted" | "ours" | "preview" | "unknown"; label: string; why: string; tone: string };

const VERDICTS: Record<Verdict["key"], Omit<Verdict, "key">> = {
  wanted:  { label: "Wanted",   tone: "bg-teal/15 text-teal",
             why: "A search engine indexing the site. This is how people find One World — leave it alone." },
  ours:    { label: "Ours",     tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
             why: "Our own automated testing, not a visitor. It is why the bot share looks high." },
  preview: { label: "Harmless", tone: "bg-ink/10 dark:bg-white/15",
             why: "A chat app fetching a link someone pasted, to draw the preview card. Somebody is sharing us." },
  unknown: { label: "Unknown",  tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
             why: "Identifies as none of the known crawlers. Worth a look if the count climbs." },
};

function botVerdict(name: unknown, category: unknown, agent?: unknown): Verdict {
  const text = `${String(name ?? "")} ${String(category ?? "")} ${String(agent ?? "")}`.toLowerCase();
  let key: Verdict["key"] = "unknown";
  if (/googlebot|bingbot|duckduckbot|yandex|baiduspider|applebot|search/.test(text)) key = "wanted";
  else if (/headless|playwright|puppeteer|selenium|automation|chrome-lighthouse/.test(text)) key = "ours";
  else if (/whatsapp|facebookexternalhit|facebot|twitterbot|slackbot|telegram|discord|linkedinbot|skypeuripreview|preview/.test(text)) key = "preview";
  return { key, ...VERDICTS[key] };
}

function VerdictChip({ verdict }: { verdict: Verdict }) {
  return <span title={verdict.why}
    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${verdict.tone}`}>{verdict.label}</span>;
}

function TrafficRow({ view, row, onNarrow, query }:
  { view: TrafficView; row: Row; onNarrow: (q: TrafficQuery) => void; query: TrafficQuery }) {
  const place = [row.city, country(row.country)].filter(Boolean).join(", ") || "Location not recorded";
  const bot = !!row.is_bot;

  if (view === "visitors" || view === "visits") {
    const person = view === "visitors";
    return (
      <article className="card p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-extrabold tabular-nums">{show(row.ip) === "—" ? "Address not recorded" : String(row.ip)}</p>
            <p className="truncate text-xs opacity-50">{place}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-black tabular-nums">{number(row.views)}</p>
            <p className="text-[9px] uppercase opacity-40">page views</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          {!!row.device && <button onClick={() => onNarrow({ ...query, device: String(row.device) })}
            className="rounded-full bg-ink/5 px-2 py-0.5 font-bold transition hover:bg-brand/10 dark:bg-white/10">{titleCase(String(row.device))}</button>}
          {!!row.country && <button onClick={() => onNarrow({ ...query, country: String(row.country) })}
            className="rounded-full bg-ink/5 px-2 py-0.5 font-bold transition hover:bg-brand/10 dark:bg-white/10">{country(row.country)}</button>}
          {bot && <span className="rounded-full bg-ink/5 px-2 py-0.5 font-extrabold dark:bg-white/10">{show(row.bot_name) === "—" ? "Crawler" : String(row.bot_name)}</span>}
          {bot && <VerdictChip verdict={botVerdict(row.bot_name, row.bot_category, row.user_agent)}/>}
          {person
            ? <span className="rounded-full bg-ink/5 px-2 py-0.5 font-bold dark:bg-white/10">{number(row.visits)} visit{Number(row.visits) === 1 ? "" : "s"}</span>
            : <span className="rounded-full bg-ink/5 px-2 py-0.5 font-bold dark:bg-white/10">{secs(row.seconds)} on site</span>}
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-bold dark:bg-white/10">{number(row.pages)} page{Number(row.pages) === 1 ? "" : "s"}</span>
        </div>
        <dl className="mt-2.5 grid grid-cols-2 gap-2 border-t border-ink/5 pt-2 text-[11px] dark:border-white/5">
          <div><dt className="text-[9px] font-bold uppercase tracking-wide opacity-40">Came from</dt>
               <dd className="truncate font-semibold">{show(row.came_from) === "—" ? "Direct" : String(row.came_from)}</dd></div>
          <div><dt className="text-[9px] font-bold uppercase tracking-wide opacity-40">Landed on</dt>
               <dd className="truncate font-semibold">{show(row.landed_on)}</dd></div>
          <div><dt className="text-[9px] font-bold uppercase tracking-wide opacity-40">{person ? "First seen" : "Started"}</dt>
               <dd className="font-semibold">{exact(person ? row.first_seen : row.started)}</dd></div>
          <div><dt className="text-[9px] font-bold uppercase tracking-wide opacity-40">{person ? "Last seen" : "Ended"}</dt>
               <dd className="font-semibold">{exact(person ? row.last_seen : row.ended)}</dd></div>
        </dl>
      </article>
    );
  }

  if (view === "views") {
    return (
      <article className="card p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-extrabold">{show(row.page)}</p>
            <p className="truncate text-xs opacity-50">{show(row.ip) === "—" ? "Address not recorded" : String(row.ip)} · {place}</p>
          </div>
          <span className="shrink-0 text-[10px] opacity-45">{exact(row.at)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-bold dark:bg-white/10">{show(row.event)}</span>
          {!!row.device && <span className="rounded-full bg-ink/5 px-2 py-0.5 font-bold dark:bg-white/10">{titleCase(String(row.device))}</span>}
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-bold dark:bg-white/10">from {show(row.came_from) === "—" ? "direct" : String(row.came_from)}</span>
          {bot && <span className="rounded-full bg-ink/5 px-2 py-0.5 font-extrabold dark:bg-white/10">{show(row.bot_name) === "—" ? "Crawler" : String(row.bot_name)}</span>}
          {bot && <VerdictChip verdict={botVerdict(row.bot_name, row.bot_category, row.user_agent)}/>}
        </div>
      </article>
    );
  }

  /* The crawler list is the one place the verdict is the POINT of the row, so it leads with it
     and says in a sentence why that verdict was given. */
  if (view === "bots") {
    const verdict = botVerdict(row.key, row.category, row.key);
    return (
      <article className="card p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-extrabold">{show(row.key)}</p>
            <p className="truncate text-xs opacity-50">{number(row.visits)} visits · last {when(row.last_seen)}</p>
          </div>
          <VerdictChip verdict={verdict}/>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed opacity-55">{verdict.why}</p>
      </article>
    );
  }

  const narrow: Partial<TrafficQuery> =
      view === "countries" ? { country: String(row.key) }
    : view === "devices" ? { device: String(row.key) }
    : { search: String(row.key).split(",")[0] };
  return (
    <button onClick={() => onNarrow({ ...query, view: "visitors", country: null, device: null, ...narrow })}
      className="card flex items-center justify-between gap-3 p-3 text-left transition hover:bg-brand/5">
      <div className="min-w-0">
        <p className="truncate font-extrabold">{view === "countries" ? country(row.key) : show(row.key)}</p>
        <p className="truncate text-xs opacity-50">{number(row.visitors)} people · {number(row.visits)} visits · last {when(row.last_seen)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-black tabular-nums">{number(row.views)}</p>
        <p className="text-[9px] uppercase opacity-40">views</p>
      </div>
    </button>
  );
}

function GrowthSummary({ console: metrics }: { console: Console | undefined }) {
  if (!metrics) return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;
  const w = metrics.window.label;
  const g = metrics.growth;
  const coverage = metrics.coverage as Record<string, number>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard label="Visitors" value={g.visitors} windowLabel={w}/>
        <MetricCard label="Visits" value={g.visits} windowLabel={w}/>
        <MetricCard label="Page views" value={g.page_views} windowLabel={w}/>
        <MetricCard label="Bot visitors" value={g.bot_visitors} windowLabel={w}/>
        <MetricCard label="Signups" value={g.signups} windowLabel={w}/>
        <MetricCard label="Onboarded" value={g.onboarded} windowLabel={w}/>
        <MetricCard label="Emails sent" value={g.emails_sent} windowLabel={w}/>
        <MetricCard label="Email failures" value={g.email_failures} windowLabel={w} attention/>
      </div>
      {!coverage.waitlist_surveys && <EmptySource what="Waitlist" why="The waitlist survey ran on the old onesocial.ai database and its rows were never copied into One World. Restoring that history is a one-off data import, not a screen change." />}
      {!coverage.lead_gen_leads && <EmptySource what="Lead Gen" why="The lead desk tables exist here but carry no rows. The 9,653 leads recorded before the migration are still in the July backup and can be imported on your word." />}
      {!coverage.affiliates && <EmptySource what="Affiliates" why="The affiliate programme has no rows in this database yet. Same position as the waitlist — the screen is ready, the history needs importing." />}
    </div>
  );
}

const TAG: Record<string, { label: string; cls: string }> = {
  claimed: { label: "Claimed", cls: "bg-teal/15 text-teal" },
  migrated: { label: "Migrated", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  invited: { label: "Invited", cls: "bg-ink/10 text-ink/60 dark:bg-white/10 dark:text-white/60" },
};

/** THE ONE MEMBER DIRECTORY. It is rendered from the People tab and nowhere else. */
function PeopleDirectory({ isAdmin, isEs, console: metrics, onOpen, goto, product }:
  { isAdmin: boolean; isEs: boolean; console: Console | undefined; onOpen: (id: string) => void;
    goto: Goto; product: string }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSearch(draft.trim()), 250); return () => clearTimeout(timer); }, [draft]);
  const directory = useAsync(async () => {
    if (previewMode()) {
      setError("");
      const lowered = search.toLowerCase();
      const rows = PREVIEW_MEMBERS.filter((member) =>
        (!lowered || [member.full_name, member.email, member.phone].some((value) => value?.toLowerCase().includes(lowered))) &&
        (!product || member.products.some((item) => item.product === product && item.status === "active")) &&
        (!status || (status === "onboarding" ? member.onboarding_incomplete : member.membership === status)));
      return { total: rows.length, rows };
    }
    const { data, error: rpcError } = await supabase.rpc("admin_user_directory", {
      p_search: search || null, p_product: product || null, p_status: status || null, p_limit: 100, p_offset: 0,
    });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return data as unknown as Directory;
  }, [search, product, status, isAdmin], isAdmin);

  const people = (metrics?.people ?? {}) as Record<string, number>;
  const byProduct = (metrics?.people?.by_product ?? []) as Pair[];

  return <section className="space-y-3">
    {metrics && <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard accent="violet" label="Total members" value={people.real} note="Excludes seed rows"/>
        <MetricCard accent="violet" label="Onboarded" value={people.onboarded}
          note={people.real ? `${Math.round((people.onboarded / Math.max(people.real, 1)) * 100)}% of members` : "Lifetime total"}/>
        <MetricCard accent="violet" label="Pending onboarding" value={people.pending_onboarding} attention
          note={people.real ? `${Math.round((people.pending_onboarding / Math.max(people.real, 1)) * 100)}% of members` : "Lifetime total"}/>
        <MetricCard accent="violet" label="New this window" value={metrics.people.new_this_window as Kpi} windowLabel={metrics.window.label}/>
        <MetricCard accent="violet" label="Claimed" value={people.claimed}
          note={people.real ? `${Math.round((people.claimed / Math.max(people.real, 1)) * 100)}% of members` : "Lifetime total"}/>
        <MetricCard accent="violet" label="Never claimed" value={people.migrated} attention
          note={people.real ? `${Math.round((people.migrated / Math.max(people.real, 1)) * 100)}% never signed in` : "Lifetime total"}/>
        <MetricCard accent="violet" label="VIP" value={people.plan_vip}/>
        <MetricCard accent="violet" label="Pro" value={people.plan_pro}/>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Breakdown accent="violet" title="Members by product" rows={byProduct.map((row) => ({ label: productName(row.label), value: row.value }))}/>
        <OperationCard accent="violet" title="Account state" subtitle="All time"
          lead={{ label: "Public profiles", value: people.public_profiles,
                  note: people.real
                    ? `${Math.round((people.public_profiles / Math.max(people.real, 1)) * 100)}% of members are findable`
                    : "Nobody has signed up yet" }}
          rows={[
            { label: "From the waitlist", value: people.from_waitlist, of: people.real,
              open: () => goto("growth", "Waitlist"), zeroLabel: "None" },
            { label: "Promotional passes active", value: people.promo_active, of: people.real,
              open: () => goto("money", "Passes"), zeroLabel: "None active" },
            { label: "Suspended", value: people.suspended, of: people.real, tone: "warn", zeroLabel: "None" },
            { label: "Locked by an admin", value: people.admin_locked, of: people.real, tone: "warn",
              open: () => goto("ops", "Admin log"), zeroLabel: "None" },
            { label: "Sample or seed rows (excluded above)", value: people.sample_or_seed, zeroLabel: "None" },
          ]}/>
      </div>
    </>}

    {/* The product filter is the console's, at the top of the screen — this panel used to carry
        a second copy, so the page had two product pickers that could disagree with each other
        and with the tiles above them. One control, one answer. */}
    <div className="grid gap-1.5 md:grid-cols-[1fr_220px]">
      <label className="ow-field flex items-center gap-2 rounded-xl px-3 py-2">
        <span aria-hidden>⌕</span>
        <input value={draft} onChange={(event) => setDraft(event.target.value)}
          placeholder={isEs ? "Nombre, correo o teléfono" : "Name, email or phone"}
          className="w-full bg-transparent text-sm outline-none"/>
      </label>
      <Dropdown label="Account state" value={status} onChange={setStatus} align="right" options={[
        { value: "", label: "All account states", short: "All states" },
        { value: "claimed", label: "Claimed" },
        { value: "invited", label: "Invited" },
        { value: "migrated", label: "Migrated" },
        { value: "onboarding", label: "Onboarding incomplete", short: "Onboarding" },
      ]}/>
    </div>
    {error && <Problem what="The member directory isn’t available." detail={error}/>}
    <div className="flex items-center justify-between px-1 text-xs opacity-50"><span>{directory ? `${number(directory.total)} people` : "Loading people…"}</span><span>PII access audited</span></div>
    <div className="grid gap-2 xl:grid-cols-2">
      {!directory && !error && <div className="card h-24 animate-pulse"/>}
      {directory?.rows.map((member) => {
        const tag = TAG[member.membership] ?? TAG.invited;
        return <article key={member.user_id} className="card overflow-hidden">
          <button onClick={() => onOpen(member.user_id)} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-brand/5">
            <Avatar src={member.photo_url} name={member.full_name} size={42} rounded="rounded-full" textSize="text-sm"/>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><p className="truncate font-extrabold">{member.full_name ?? "No name"}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${tag.cls}`}>{tag.label}</span></div>
              <p className="truncate text-xs opacity-50">{member.email ?? "—"}</p>
            </div>
            <div className="text-right"><b>{member.score == null ? "—" : Math.round(member.score)}</b><p className="text-[9px] uppercase opacity-40">score</p></div>
          </button>
        </article>;
      })}
    </div>
    {directory && !directory.rows.length && <div className="card p-10 text-center text-sm opacity-50">Nobody matches these filters.</div>}
    <p className="px-1 text-[10px] opacity-40">Open a member to see their full record — access, plan, money, activity, consent and moderation.</p>
  </section>;
}

function MoneySummary({ console: metrics, goto }: { console: Console | undefined; goto: Goto }) {
  if (!metrics) return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;
  const m = metrics.money as Record<string, Kpi | number>;
  const w = metrics.window.label;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard accent="amber" label="Captured" value={m.gross_captured as Kpi} windowLabel={w} format={money}/>
        <MetricCard accent="amber" label="Platform fee" value={m.platform_fee as Kpi} windowLabel={w} format={money}/>
        <MetricCard accent="amber" label="Paid contracts" value={m.paid_agreements as Kpi} windowLabel={w}/>
        <MetricCard accent="amber" label="Stripe webhooks" value={m.stripe_webhooks as Kpi} windowLabel={w}/>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <OperationCard accent="amber" title="Contract money" subtitle="All time"
          lead={{ label: "Contracts written", value: num(m.agreements_total), open: () => goto("money", "Contracts"),
                  openLabel: "Open the contract list",
                  note: num(m.agreements_total)
                    ? `${number(num(m.awaiting_capture))} still awaiting capture`
                    : "No contract has been written yet" }}
          rows={[
            { label: "Awaiting capture", value: num(m.awaiting_capture), of: num(m.agreements_total), tone: "warn",
              open: () => goto("money", "Contracts"), zeroLabel: "None held" },
            { label: "Released to the payee", value: num(m.released), of: num(m.agreements_total), tone: "good",
              open: () => goto("money", "Contracts"), zeroLabel: "None yet" },
            { label: "Refunded", value: num(m.refunded), of: num(m.agreements_total), tone: "warn", zeroLabel: "None" },
            { label: "Payment failures", value: num(m.payment_failures), tone: "warn",
              open: () => goto("money", "Stripe"), zeroLabel: "None" },
          ]}
          empty="No contracts have been written in One World yet. This card fills the first time a member pays another member."/>

        <OperationCard accent="amber" title="Payouts and disputes" subtitle="All time"
          lead={{ label: "Paid out to members", value: num(m.payouts_paid), open: () => goto("money", "Payouts"),
                  openLabel: "Open the payout list",
                  note: num(m.payouts_failed) ? `${number(num(m.payouts_failed))} failed and need a retry` : "No failed payouts" }}
          rows={[
            { label: "Payouts failed", value: num(m.payouts_failed), of: num(m.payouts_paid) + num(m.payouts_failed),
              tone: "warn", open: () => goto("money", "Payouts"), zeroLabel: "None" },
            { label: "Disputes open", value: num(m.disputes_open), of: num(m.disputes_total), tone: "warn",
              open: () => goto("money", "Disputes"), zeroLabel: "None open" },
            { label: "Disputes, all time", value: num(m.disputes_total), open: () => goto("money", "Disputes"), zeroLabel: "Never disputed" },
            { label: "Active subscriptions", value: num(m.subscriptions_active), open: () => goto("money", "Subscriptions"), zeroLabel: "None active" },
          ]}
          empty="Nothing has been paid out and nothing has been disputed. Both are good states to be in this early."/>

        <OperationCard accent="amber" title="Promotions and events" subtitle="All time"
          lead={{ label: "Promo redemptions", value: num(m.promo_code_uses), open: () => goto("money", "Promo codes"),
                  openLabel: "Open the code list",
                  note: `${number(num(m.promo_codes_active))} code${num(m.promo_codes_active) === 1 ? "" : "s"} active right now` }}
          rows={[
            { label: "Promo codes active", value: num(m.promo_codes_active), open: () => goto("money", "Promo codes"), zeroLabel: "None active" },
            { label: "Event payments taken", value: num(m.event_payments_paid), open: () => goto("catalog", "Events"), zeroLabel: "None yet" },
            { label: "Event payments needing attention", value: num(m.event_payment_attention),
              of: num(m.event_payments_paid) + num(m.event_payment_attention), tone: "warn",
              open: () => goto("catalog", "Events"), zeroLabel: "All clear" },
            { label: "OneVoice invoices paid", value: num(m.onevoice_paid), zeroLabel: "None yet" },
          ]}
          empty="No promotion has been redeemed and no event payment has been taken yet."/>
      </div>
      <p className="px-1 text-[10px] opacity-40">
        Money figures are read from the platform's own records. Stripe balance, payout timing and refunds
        as Stripe sees them stay in the Stripe dashboard — this screen never moves money.
      </p>
    </div>
  );
}

function OpsHealth({ console: metrics, goto }: { console: Console | undefined; goto: Goto }) {
  if (!metrics) return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;
  const o = metrics.ops as Record<string, Kpi | number>;
  const alerts = (metrics.ops.alerts_recent ?? []) as AlertRow[];
  const backup = metrics.ops.last_backup as { started_at: string; status: string; records: number } | null;
  const w = metrics.window.label;
  const p = periodName(metrics.window);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard accent="sky" label="Open alerts" value={num(o.alerts_open)} attention note="Unresolved right now"/>
        <MetricCard accent="sky" label="Critical alerts" value={num(o.alerts_critical)} attention note="Unresolved right now"/>
        <MetricCard accent="sky" label="Admin actions" value={o.admin_actions as Kpi} windowLabel={w}/>
        <MetricCard accent="sky" label="Blocked attempts" value={o.blocked_attempts as Kpi} windowLabel={w}/>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <OperationCard accent="sky" title="Security" subtitle="Standing"
          lead={{ label: "Blocked or banned", value: num(o.blocked_ips) + num(o.banned_identities),
                  open: () => goto("ops", "Blocked"), openLabel: "Open the block list",
                  note: (num(o.blocked_ips) + num(o.banned_identities))
                    ? `${number(num(o.blocked_ips))} address${num(o.blocked_ips) === 1 ? "" : "es"} · ${number(num(o.banned_identities))} identit${num(o.banned_identities) === 1 ? "y" : "ies"}${num(o.blocked_attempts) ? ` · ${number(num(o.blocked_attempts))} attempts turned away in ${p}` : ""}`
                    : "Nothing has had to be blocked yet" }}
          rows={[
            { label: "Blocked IP addresses", value: num(o.blocked_ips), open: () => goto("ops", "Blocked"), zeroLabel: "None blocked" },
            { label: "Banned identities", value: num(o.banned_identities), open: () => goto("ops", "Ban list"), zeroLabel: "None banned" },
            { label: "Suppressed email addresses", value: num(o.suppressed_emails), open: () => goto("growth", "Suppressed"), zeroLabel: "None" },
            { label: "Content reports open", value: num(o.content_reports_open), tone: "warn",
              open: () => goto("ops", "Reports"), zeroLabel: "None open" },
            { label: "Money-truth violations", value: num(o.money_truth_violations), tone: "warn",
              open: () => goto("ops", "Admin log"), zeroLabel: "None" },
          ]}
          empty="Nothing has been banned, blocked or reported. Expect this card to fill as traffic grows."/>

        <OperationCard accent="sky" title="Health" subtitle="Needs a person"
          lead={{ label: "Items waiting on someone", value: num(o.alerts_unacked) + num(o.content_reports_open) + num(o.accountability_open),
                  open: () => goto("ops", "Alerts"), openLabel: "Open the alert list",
                  note: (num(o.alerts_unacked) + num(o.content_reports_open) + num(o.accountability_open))
                    ? "Unacknowledged alerts, open reports and accountability items"
                    : "Nothing is waiting on a human right now" }}
          rows={[
            { label: "Alerts not acknowledged", value: num(o.alerts_unacked), of: num(o.alerts_open), tone: "warn",
              open: () => goto("ops", "Alerts"), zeroLabel: "All acknowledged" },
            { label: "Onboarding incomplete", value: num(o.onboarding_incomplete), tone: "warn",
              open: () => goto("people", "Incomplete"), zeroLabel: "Everyone finished" },
            { label: `Email failures in ${p}`, value: num(o.email_failures_window), tone: "warn",
              open: () => goto("growth", "Failures"), zeroLabel: "None" },
            { label: "QA results recorded", value: num(o.qa_results), open: () => goto("ops", "QA"), zeroLabel: "No run recorded" },
            { label: "Accountability items open", value: num(o.accountability_open), tone: "warn",
              open: () => goto("ops", "Accountability"), zeroLabel: "None open" },
          ]}
          footer={backup
            ? `Last backup ${when(backup.started_at)} · ${backup.status} · ${number(backup.records)} records`
            : "No backup run has been recorded in this database."}/>

        <OperationCard accent="sky" title="Engagement" subtitle={p}
          lead={{ label: `Messages sent in ${p}`, value: num((metrics.engagement as Record<string, unknown>).messages),
                  note: `Across ${number(num((metrics.engagement as Record<string, unknown>).conversations))} conversation${num((metrics.engagement as Record<string, unknown>).conversations) === 1 ? "" : "s"}` }}
          rows={[
            { label: "Conversations", value: num((metrics.engagement as Record<string, unknown>).conversations), zeroLabel: "None started" },
            { label: "Media posts", value: num((metrics.engagement as Record<string, unknown>).media_posts), zeroLabel: "None posted" },
            { label: "Endorsements", value: num((metrics.engagement as Record<string, unknown>).endorsements), zeroLabel: "None given" },
            { label: "Testimonials", value: num((metrics.engagement as Record<string, unknown>).testimonials), zeroLabel: "None written" },
          ]}
          empty="Members have not started talking to each other yet in this window. Widen the window with the time chips above."/>
      </div>
      <section className="space-y-2">
        <h3 className="px-1 text-sm font-extrabold">Latest operational alerts</h3>
        <AlertList rows={alerts}/>
      </section>
    </div>
  );
}

function CoveragePanel({ console: metrics }: { console: Console | undefined }) {
  if (!metrics) return <div className="card h-48 animate-pulse"/>;
  const coverage = metrics.coverage as Record<string, number>;
  return (
    <section className="card p-4">
      <h3 className="font-extrabold">Where the data comes from</h3>
      <p className="mt-1 text-xs opacity-50">
        A source with no rows is listed here so an empty panel is never mistaken for a broken one.
        Most of these tables exist because they were recreated for One World; their records stayed
        behind in the old database and can be imported.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 text-xs md:grid-cols-3">
        {([
          ["Traffic events", coverage.analytics_events],
          ["Waitlist surveys", coverage.waitlist_surveys],
          ["Affiliates", coverage.affiliates],
          ["Lead-gen leads", coverage.lead_gen_leads],
          ["Agents", coverage.agents],
          ["Backup runs", coverage.aws_sync_runs],
          ["Chat transcripts", coverage.chat_transcripts],
          ["Nurture states", coverage.nurture_state],
        ] as Array<[string, number]>).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2">
            <dt className="opacity-60">{label}</dt>
            <dd className={value ? "font-black" : "font-black opacity-35"}>{value ? number(value) : "none yet"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ================================================== the console =========================== */

type Bucket = { slug: BucketSlug; label: string; blurb: string; tabs: string[]; accent: AccentKey };

const BUCKETS: Bucket[] = [
  { slug: "overview", label: "Overview", blurb: "Growth · People · Money · Ops", tabs: [] , accent: "brand" },
  { slug: "growth", label: "Growth", blurb: "Visitors, email, leads and partners — every signal that turns strangers into members.",
    tabs: ["Summary", "Traffic", "Emails", "Failures", "Delivery", "Suppressed", "Lead Gen", "Waitlist", "Affiliates", "Applications", "Nurture"] , accent: "brand" },
  { slug: "people", label: "People", blurb: "Members, claim state, plans and connected products — the human side of the platform.",
    tabs: ["Directory", "Incomplete", "Kickstarter", "Arena", "Careers"] , accent: "violet" },
  { slug: "money", label: "Money", blurb: "Contracts, payouts, disputes and promotions — every dollar in or out.",
    tabs: ["Summary", "Contracts", "Payouts", "Disputes", "Subscriptions", "Promo codes", "Passes", "Stripe"] , accent: "amber" },
  { slug: "ops", label: "Ops", blurb: "Alerts, security, admin activity and data coverage — keep the machine running.",
    tabs: ["Health", "Alerts", "Ban list", "Blocked", "Attempts", "Reports", "Admin log", "Accountability", "QA", "Transcripts", "Backups", "Data"] , accent: "sky" },
  { slug: "catalog", label: "Catalog", blurb: "What members have published — events and property listings.",
    tabs: ["Events", "Listings"] , accent: "emerald" },
];

/** Which allow-listed list each sub-tab reads. A tab with no entry here renders its own panel. */
const TAB_LIST: Record<string, string> = {
  "Emails": "emails", "Failures": "email_failures", "Delivery": "email_events", "Suppressed": "suppressed",
  "Lead Gen": "leads", "Waitlist": "waitlist", "Affiliates": "affiliates",
  "Applications": "affiliate_apps", "Nurture": "nurture",
  "Incomplete": "incomplete", "Kickstarter": "kickstarter", "Arena": "arena", "Careers": "applications",
  "Contracts": "contracts", "Payouts": "payouts", "Disputes": "disputes",
  "Subscriptions": "subscriptions", "Promo codes": "promo_codes", "Passes": "promo_passes",
  "Stripe": "stripe_events",
  "Alerts": "alerts", "Ban list": "banned", "Blocked": "blocked_ips", "Attempts": "blocked_attempts",
  "Reports": "reports", "Admin log": "audit", "Accountability": "accountability",
  "QA": "qa", "Transcripts": "transcripts", "Backups": "backups",
  "Events": "events", "Listings": "listings",
};

export default function AdminScreen() {
  const { lang } = useI18n();
  const isEs = lang === "es" || lang === "co";
  const isAdmin = useIsAdmin();
  const [bucket, setBucket] = useState<BucketSlug>("overview");
  const [tab, setTab] = useState(0);
  const [windowIndex, setWindowIndex] = useState(6); // 30d, the July default for the long view
  const [nonce, setNonce] = useState(0);
  const [member, setMember] = useState<string | null>(null);
  const [traffic, setTraffic] = useState<TrafficQuery>({ view: "visitors" });
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("human");
  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  /* The live promotional code, so the VIP link in the header carries a code that actually works
     rather than one hardcoded months ago. Reuses the allow-listed promo list — no new read. */
  const promo = useAsync(async () => {
    if (previewMode()) return "FOUNDER02";
    const { data, error: rpcError } = await supabase.rpc("admin_list", {
      p_list: "promo_codes", p_search: null, p_days: 3650, p_limit: 1, p_offset: 0,
    });
    if (rpcError) return null;
    const rows = (data as unknown as ListResult | null)?.rows ?? [];
    const code = rows[0]?.code;
    return typeof code === "string" && code ? code : null;
  }, [isAdmin, nonce], isAdmin);
  const promoCode = promo ?? null;

  /* Every figure on a summary card can be opened. goto("money","Disputes") lands on the list
     the figure was counted from, so a number and its evidence are never more than one tap apart. */
  const goto = useCallback((slug: BucketSlug, tabLabel: string) => {
    const target = BUCKETS.find((item) => item.slug === slug);
    if (!target) return;
    const index = target.tabs.indexOf(tabLabel);
    setMember(null);
    setBucket(slug);
    setTab(index < 0 ? 0 : index);
  }, []);

  const { data: metrics, error } = useConsole(isAdmin, windowIndex, nonce);
  const chosen = WINDOWS[windowIndex] ?? WINDOWS[6];

  /* Overview borrows the analytics aggregate for its trend line only; the tiles come from the
     console aggregate, so a traffic outage never blanks the rest of the screen. */
  const overview = useAsync(async () => {
    if (previewMode()) return PREVIEW_OVERVIEW;
    const { data, error: rpcError } = await supabase.rpc("admin_analytics_overview", { p_days: 30, p_product: product || null, p_traffic: audience });
    if (rpcError) return undefined;
    return data as unknown as Overview;
  }, [isAdmin, nonce, product, audience], isAdmin && bucket === "overview");

  const active = useMemo(() => BUCKETS.find((item) => item.slug === bucket) ?? BUCKETS[0], [bucket]);
  const tabName = active.tabs[tab] ?? active.tabs[0] ?? "";
  const listName = TAB_LIST[tabName];

  if (!isAdmin) return <div className="card p-8 text-center text-sm opacity-60">{isEs ? "No tienes acceso a esta pantalla." : "You don’t have access to this screen."}</div>;

  return <div className="space-y-3">
    <style>{ADMIN_CHROME_CSS}</style>

    {/* The blurb is ONE line, always. It used to be `line-clamp-2`, so Overview's short line and
        Growth's long one gave the header two different heights and the whole page moved down
        when you changed bucket. A fixed height cannot jump. The full text is still there for a
        screen reader and on a wide screen where it fits. */}
    <div>
      <ScreenHeading><span className="sm:hidden">Admin</span><span className="hidden sm:inline">Admin Dashboard</span></ScreenHeading>
      <div className="-mt-1.5 flex h-7 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold opacity-45" title={active.blurb}>{active.blurb}</p>
        <AdminQuickActions promo={promoCode}/>
      </div>
    </div>

    {/* Six buckets, one row, always. Compact enough to fit 390px without scrolling, so there is
        no second row to jump and nothing hidden off the edge. */}
    <div className="ow-buckets scrollbar-none flex items-stretch gap-0.5 overflow-x-auto rounded-2xl p-1"
      role="tablist" aria-label="Admin sections">
      {BUCKETS.map((item) => {
        const selected = bucket === item.slug;
        return <button key={item.slug} role="tab" aria-selected={selected}
          onClick={() => { setBucket(item.slug); setTab(0); setMember(null); }}
          className={`shrink-0 grow basis-0 whitespace-nowrap rounded-xl px-2 py-2 text-center text-[11px] font-extrabold transition sm:text-xs ${selected ? ACCENT[item.accent].tab : "opacity-55 hover:opacity-100"}`}>{item.label}</button>;
      })}
    </div>

    {active.tabs.length > 0 && !member && (
      <TabStrip items={active.tabs} index={tab} onPick={setTab} accent={active.accent}
        ariaLabel={`${active.label} views`}/>
    )}

    {!member && (
      <FilterBar index={windowIndex} onPick={setWindowIndex} onRefresh={refresh} busy={!metrics && !error}
        product={product} onProduct={setProduct} audience={audience} onAudience={setAudience}
        showWindow={!listName || !!LISTS[listName]?.windowed}
        showProduct={bucket === "overview" || bucket === "people" || (bucket === "growth" && tabName === "Traffic")}
        showAudience={bucket === "overview" || (bucket === "growth" && tabName === "Traffic")}/>
    )}

    {error && !member && <Problem
      what="The console metrics aren’t available."
      detail={`${error} — this screen needs the admin_console_metrics function released to the database.`}/>}

    {member
      ? <MemberRecordPanel userId={member} isAdmin={isAdmin} onBack={() => setMember(null)}/>
      : listName
        ? <ListPanel spec={LISTS[listName]} isAdmin={isAdmin} days={chosen.days} nonce={nonce}/>
        : <>
            {bucket === "overview" && <OverviewPanel console={metrics} overview={overview} goto={goto}
      openTraffic={(view) => { setBucket("growth"); setTab(1); setTraffic({ view }); }}/>}
            {bucket === "growth" && tabName === "Summary" && <GrowthSummary console={metrics}/>}
            {bucket === "growth" && tabName === "Traffic" && <TrafficExplorer isAdmin={isAdmin} days={chosen.days} hours={chosen.hours} query={traffic} onQuery={setTraffic} product={product} audience={audience}/>}
            {bucket === "people" && tabName === "Directory" && <PeopleDirectory isAdmin={isAdmin} isEs={isEs} console={metrics} onOpen={setMember} goto={goto} product={product}/>}
            {bucket === "money" && tabName === "Summary" && <MoneySummary console={metrics} goto={goto}/>}
            {bucket === "ops" && tabName === "Health" && <OpsHealth console={metrics} goto={goto}/>}
            {bucket === "ops" && tabName === "Data" && <CoveragePanel console={metrics}/>}
          </>}

    <p className="pt-2 text-center text-[10px] opacity-35">Server-authorized · Every read and every action is audited</p>
  </div>;
}
