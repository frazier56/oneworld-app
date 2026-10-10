import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Avatar from "../components/Avatar";
import ScreenHeading from "../components/ScreenHeading";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { useIsAdmin } from "../lib/useIsAdmin";
import { PromoCatalog, TestingScoreboard } from "../components/admin/QualityPanels";

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

const PREVIEW_FUNNEL: Funnel = {
  window: { days: 30, hours: null, label: "30d" },
  funnel: [
    { key: "visited", label: "Visited", value: 2847 },
    { key: "signed_up", label: "Signed up", value: 186 },
    { key: "onboarded", label: "Onboarded", value: 61 },
    { key: "activated", label: "Using a product", value: 44 },
    { key: "transacted", label: "Paid or got paid", value: 7 },
  ],
  growth: { signups: 186, signups_prev: 154 },
  activation: { onboard_rate: 32.8, activate_rate: 23.7, median_hours_to_onboard: 0.3 },
  retention: { visitors: 2847, visitors_returning: 412, visitor_return_rate: 14.5,
               members_active_7d: 38, members_active_30d: 40, members_total: 128,
               members_never_signed_in: 78, member_active_rate: 31.3 },
  money: { captured: 0, fee: 0, paid: 0, captured_prev: 400000 },
  products: [
    { product: "oneevent", active: 42, new_in_window: 24, lost_in_window: 0 },
    { product: "onejob", active: 24, new_in_window: 18, lost_in_window: 0 },
    { product: "onehome", active: 18, new_in_window: 17, lost_in_window: 0 },
    { product: "onesocial", active: 5, new_in_window: 4, lost_in_window: 0 },
    { product: "onebusiness", active: 5, new_in_window: 5, lost_in_window: 0 },
  ],
  entry: [{ label: "oneevent", value: 21 }, { label: "onehome", value: 9 }, { label: "unknown", value: 6 }],
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

/* Every time on this screen is US Central and says so once per screen (Lee's standing rule).
   "Oct 3, 26, 12:24 AM" read as a date in 2026 or the 26th — the year only appears when it is
   not this year. */
const CT = "America/Chicago";
const thisYear = new Date().getFullYear();
const when = (iso: unknown) => {
  if (!iso || typeof iso !== "string") return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ago`;
  const days = Math.floor(mins / 1440);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { timeZone: CT, month: "short", day: "numeric",
    ...(date.getFullYear() === thisYear ? {} : { year: "numeric" }) });
};
const exact = (iso: unknown) => {
  if (!iso || typeof iso !== "string") return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { timeZone: CT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    ...(date.getFullYear() === thisYear ? {} : { year: "numeric" }) });
};
const clock = (iso: unknown) => {
  if (!iso || typeof iso !== "string") return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("en-US", { timeZone: CT, hour: "numeric", minute: "2-digit" });
};
const span = (seconds: unknown) => {
  const s = Math.max(0, Math.round(Number(seconds ?? 0)));
  if (s < 60) return s ? `${s} sec` : "under a minute";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
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
  onescore: "OneScore", onebusiness: "OneBusiness", onepay: "OnePay", oneagent: "OneAgent", oneride: "OneRide",
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
type BucketSlug = "overview" | "growth" | "people" | "money" | "ops" | "catalog" | "marketing";
type Goto = (bucket: BucketSlug, tab: string) => void;
type AccentKey = "brand" | "violet" | "amber" | "sky" | "emerald" | "pink";
type Accent = { tab: string; bar: string; text: string; soft: string };
const ACCENT: Record<AccentKey, Accent> = {
  brand:   { tab: "bg-brand text-white shadow-sm",       bar: "bg-brand",
             text: "text-brand",                              soft: "hover:border-brand hover:bg-ink/5 dark:hover:bg-white/10" },
  violet:  { tab: "bg-violet-500 text-white shadow-sm",  bar: "bg-violet-500",
             text: "text-violet-600 dark:text-violet-300",    soft: "hover:border-violet-500/40 hover:bg-violet-500/5" },
  amber:   { tab: "bg-amber-500 text-white shadow-sm",   bar: "bg-amber-500",
             text: "text-amber-700 dark:text-amber-300",      soft: "hover:border-amber-500/40 hover:bg-amber-500/5" },
  sky:     { tab: "bg-sky-500 text-white shadow-sm",     bar: "bg-sky-500",
             text: "text-sky-700 dark:text-sky-300",          soft: "hover:border-sky-500/40 hover:bg-sky-500/5" },
  emerald: { tab: "bg-emerald-500 text-white shadow-sm", bar: "bg-emerald-500",
             text: "text-emerald-700 dark:text-emerald-300",  soft: "hover:border-emerald-500/40 hover:bg-emerald-500/5" },
  pink:    { tab: "bg-pink-500 text-white shadow-sm",    bar: "bg-pink-500",
             text: "text-pink-700 dark:text-pink-300",        soft: "hover:border-pink-500/40 hover:bg-pink-500/5" },
};

/* ---------------------------------------------------------------------------- small pieces */

/* The 23 Sep scrubbable TimeChart is retired by ADMIN30 overlay 7: the Overview trend now reads
   admin_audience (real people only, in the window you picked) through AudienceTrend below. */

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
              <span className="[overflow-wrap:anywhere] opacity-70">{row.label}</span>
              <b className="tabular-nums">{number(row.value)}</b>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
              <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
            </div>
          </>;
          return onOpen
            ? <button key={row.label} onClick={() => onOpen(row.label)}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">{inner}</button>
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
    <p className="mt-1 [overflow-wrap:anywhere] text-[10px] opacity-40">
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
            <dt className={`min-w-0 flex-1 [overflow-wrap:anywhere] text-left ${zero ? "opacity-35" : "opacity-60"}`}>{row.label}</dt>
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
        <span className="[overflow-wrap:anywhere]">{chosen?.short ?? chosen?.label ?? label}</span>
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
                  ${active ? "bg-ink/5 text-brand dark:bg-white/10" : index === cursor ? "bg-ink/5 dark:bg-white/10" : ""}`}>
                <span className="[overflow-wrap:anywhere]">{option.label}</span>
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
    label: item.hours === 1 ? "Last hour" : item.hours ? `Last ${item.hours} hours` : item.days === 1 ? "Last 24 hours"
      : item.days === 365 ? "Last year" : `Last ${item.days} days`,
    short: item.hours === 1 ? "1 hour" : item.hours ? `${item.hours} hours` : item.days === 1 ? "24 hours"
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
                className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="[overflow-wrap:anywhere] font-extrabold">{show(row[spec.primary])}</p>
                    {badgeText && <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${bad ? "bg-red-500/15 text-red-500" : good ? "bg-teal/15 text-teal" : "bg-ink/10 text-ink/60 dark:bg-white/10 dark:text-white/60"}`}>{badgeText}</span>}
                  </div>
                  <p className="[overflow-wrap:anywhere] text-xs opacity-50">
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
            className={`rounded-xl border px-4 py-2 text-xs font-extrabold transition ${page === 0 ? "border-ink/10 opacity-55 dark:border-white/10" : "ow-edge hover:bg-ink/5 dark:hover:bg-white/10"}`}>
            Previous
          </button>
          <button disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}
            className={`rounded-xl border px-4 py-2 text-xs font-extrabold transition ${page + 1 >= pages ? "border-ink/10 opacity-55 dark:border-white/10" : "ow-edge hover:bg-ink/5 dark:hover:bg-white/10"}`}>
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
                      "onehome", "onevoice", "onepage", "oneapp", "onepay", "onebusiness", "oneride"] as const;

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
              className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${action.destructive ? "border-red-500/40 text-red-500 hover:bg-red-500/10" : "ow-edge hover:bg-ink/5 dark:hover:bg-white/10"}`}>
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
              className="rounded-xl border ow-edge px-4 py-2 text-xs font-extrabold transition hover:bg-ink/5 dark:hover:bg-white/10">
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
            className="rounded-xl border ow-edge px-3 py-2 text-xs font-extrabold transition hover:bg-ink/5 dark:hover:bg-white/10">
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
    <button onClick={onBack} className="rounded-xl border ow-edge px-3 py-2 text-xs font-extrabold transition hover:bg-ink/5 dark:hover:bg-white/10">
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
            <h2 className="[overflow-wrap:anywhere] text-lg font-black">{show(p.full_name)}</h2>
            <span className="rounded-full bg-ink/5 dark:bg-white/10 px-2 py-0.5 text-[9px] font-extrabold uppercase text-brand">{show(account.membership)}</span>
            {account.suspended_at && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-extrabold uppercase text-red-500">Suspended</span>}
            {account.admin_locked && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-extrabold uppercase text-amber-600 dark:text-amber-400">Locked</span>}
          </div>
          <p className="[overflow-wrap:anywhere] text-xs opacity-50">{show(p.email)}</p>
          {p.phone && <p className="[overflow-wrap:anywhere] text-xs opacity-50">{p.phone}</p>}
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
              <span key={item.product} className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "active" ? "bg-ink/5 dark:bg-white/10 text-brand" : "bg-ink/10 opacity-60 dark:bg-white/10"}`}>
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
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere] font-extrabold">{show(c.title)}</span>
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

/* ══ THE ANALYST VIEW ════════════════════════════════════════════════════════════════════════
   Lee, 23 Sep 2026: *"Review the console as a data analyst would: what a CEO needs at a glance."*

   Everything above this point answers "how many". None of it answers "where are we losing
   people", which is the only question a founder actually puts to a dashboard. Counts are a
   scoreboard; a funnel is a diagnosis.

   Five stages, each a strict subset of the last, so the gap between any two is a real loss and
   not two different populations being compared. The panel leads with the WORST step, because
   that is the one piece of information that should change what Lee does this week. */

type Stage = { key: string; label: string; value: number };
type Funnel = {
  window: { days: number; hours: number | null; label: string };
  funnel: Stage[];
  growth: { signups: number; signups_prev: number };
  activation: { onboard_rate: number | null; activate_rate: number | null; median_hours_to_onboard: number | null };
  retention: { visitors: number; visitors_returning: number; visitor_return_rate: number | null;
               members_active_7d: number; members_active_30d: number; members_total: number;
               members_never_signed_in: number; member_active_rate: number | null };
  money: { captured: number; fee: number; paid: number; captured_prev: number };
  products: Array<{ product: string; active: number; new_in_window: number; lost_in_window: number }>;
  entry: Pair[];
};

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`);

function FunnelPanel({ data }: { data: Funnel | undefined }) {
  const nav = useNav();
  if (!data) return <div className="card h-64 animate-pulse"/>;
  const stages = data.funnel ?? [];
  const top = stages[0]?.value ?? 0;

  /* The worst step is the headline. A funnel where every stage is shown at equal weight makes
     the reader find the leak; naming it is the job. */
  let worst: { from: Stage; to: Stage; lost: number; rate: number } | null = null;
  for (let i = 1; i < stages.length; i++) {
    const from = stages[i - 1], to = stages[i];
    if (!from.value) continue;
    const lost = from.value - to.value;
    const rate = (lost / from.value) * 100;
    if (!worst || rate > worst.rate) worst = { from, to, lost, rate };
  }

  const where: Record<string, () => void> = {
    visited: () => nav.audience({}),
    signed_up: () => nav.drill("signups", "Signed up"),
    onboarded: () => nav.drill("funnel_onboarded", "Signed up and onboarded"),
    activated: () => nav.drill("funnel_activated", "Signed up and using a product"),
    transacted: () => nav.drill("funnel_transacted", "Signed up and paid or got paid"),
  };
  /* The people LOST at each step: tap "↓ 3 lost" and see the three. */
  const lostAt: Record<string, () => void> = {
    signed_up: () => nav.audience({}),
    onboarded: () => nav.drill("funnel_lost_signed_up", "Signed up, not onboarded"),
    activated: () => nav.drill("funnel_lost_onboarded", "Onboarded, no product yet"),
    transacted: () => nav.drill("funnel_lost_activated", "Using a product, no money yet"),
  };

  return (
    <section className="card relative overflow-hidden p-4 pl-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden/>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-extrabold">Where the business leaks</h3>
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-[.12em] opacity-35">{data.window.label}</p>
      </div>

      {worst && worst.lost > 0 && (
        <button onClick={lostAt[worst.to.key]} className="mt-3 block w-full rounded-xl bg-amber-500/10 px-3 py-2.5 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-amber-700 dark:text-amber-300">Biggest drop-off</p>
          <p className="mt-1 text-sm font-black">
            {number(worst.lost)} of {number(worst.from.value)} lost between {worst.from.label.toLowerCase()} and {worst.to.label.toLowerCase()}
          </p>
          <p className="mt-0.5 text-[11px] opacity-60">
            {Math.round(worst.rate)}% of everyone at “{worst.from.label}” never reached “{worst.to.label}”. <b className="text-brand">See who →</b>
          </p>
        </button>
      )}

      <ol className="mt-3 space-y-1.5">
        {stages.map((stage, i) => {
          const share = top ? Math.round((stage.value / top) * 100) : 0;
          const prev = i > 0 ? stages[i - 1] : null;
          const lost = prev ? prev.value - stage.value : 0;
          const lostRate = prev && prev.value ? Math.round((lost / prev.value) * 100) : 0;
          const open = where[stage.key];
          const worstHere = worst && worst.to.key === stage.key;
          return (
            <li key={stage.key}>
              {prev && lost > 0 && (
                <button onClick={lostAt[stage.key]} className={`mb-1 pl-1 text-[10px] font-bold ${worstHere ? "text-amber-600 dark:text-amber-400" : "opacity-50 hover:opacity-100"}`}>
                  ↓ {number(lost)} lost ({lostRate}%) →
                </button>
              )}
              <button onClick={open} disabled={!open}
                className="ow-field flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition disabled:opacity-60">
                <span className="w-[5.6rem] shrink-0 text-[10px] font-extrabold leading-tight opacity-70">{stage.label}</span>
                <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-brand"
                    style={{ width: `${Math.max(share, stage.value ? 3 : 0)}%` }}/>
                </span>
                <span className="w-14 shrink-0 text-right text-sm font-black tabular-nums">{number(stage.value)}</span>
                <span className="w-9 shrink-0 text-right text-[10px] tabular-nums opacity-40">{share}%</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-ink/5 pt-3 text-center dark:border-white/5">
        <button onClick={() => nav.drill("funnel_onboarded", "Signed up and onboarded")} className="rounded-lg transition hover:bg-ink/5 dark:hover:bg-white/10">
          <p className="text-[9px] font-bold uppercase tracking-[.12em] opacity-40">Finish onboarding</p>
          <p className="mt-0.5 text-lg font-black tabular-nums">{pct(data.activation?.onboard_rate)}</p>
          <p className="text-[10px] opacity-40">
            {data.activation?.median_hours_to_onboard !== null && data.activation?.median_hours_to_onboard !== undefined
              ? `Takes about ${data.activation.median_hours_to_onboard < 1
                  ? `${Math.round(data.activation.median_hours_to_onboard * 60)} minutes`
                  : `${data.activation.median_hours_to_onboard} hours`} for those who do`
              : "No one has finished yet"}
          </p>
        </button>
        <div>
          <button onClick={() => nav.drill("active_30d", "Signed in, last 30 days")} className="w-full rounded-lg transition hover:bg-ink/5 dark:hover:bg-white/10">
            <p className="text-[9px] font-bold uppercase tracking-[.12em] opacity-40">Members signed in, 30d</p>
            <p className="mt-0.5 text-lg font-black tabular-nums">{pct(data.retention?.member_active_rate)}</p>
          </button>
          <button onClick={() => nav.drill("never_signed_in", "Never signed in")} className="text-[10px] opacity-50 hover:opacity-100">
            {number(data.retention?.members_never_signed_in)} of {number(data.retention?.members_total)} never signed in →
          </button>
        </div>
      </div>
    </section>
  );
}

function ProductSplit({ data }: { data: Funnel | undefined }) {
  const nav = useNav();
  if (!data) return <div className="card h-48 animate-pulse"/>;
  const rows = data.products ?? [];
  const max = Math.max(1, ...rows.map((r) => r.active));
  return (
    <section className="card relative overflow-hidden p-4 pl-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-violet-500" aria-hidden/>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-extrabold">Which product people actually use</h3>
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-[.12em] opacity-35">Active now</p>
      </div>
      {rows.length === 0
        ? <p className="mt-3 text-xs opacity-45">No product entitlements yet.</p>
        : <ul className="mt-3 space-y-2">
            {rows.map((r) => (
              <li key={r.product}>
                <button onClick={() => nav.drill("product_holders", `${productName(r.product)} — who holds it`, r.product)}
                  className="flex w-full items-center gap-3 text-left">
                  <span className="w-24 shrink-0 [overflow-wrap:anywhere] text-[11px] font-extrabold">{productName(r.product)}</span>
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                    <span className="block h-full rounded-full bg-violet-500" style={{ width: `${(r.active / max) * 100}%` }}/>
                  </span>
                  <span className="w-10 shrink-0 text-right text-sm font-black tabular-nums">{number(r.active)}</span>
                  <span className="w-12 shrink-0 text-right text-[10px] font-bold tabular-nums text-teal">
                    {r.new_in_window ? `+${number(r.new_in_window)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>}
      <p className="mt-3 text-[10px] opacity-40">Green is new in this window. Tap a product to see who holds it.</p>
    </section>
  );
}

function OverviewPanel({ console: metrics, overview, openDay, goto, funnel, isAdmin, hours, nonce, openAudience }:
  { console: Console | undefined; overview: Overview | undefined;
    openDay: (day: string) => void; goto: Goto; funnel: Funnel | undefined;
    isAdmin: boolean; hours: number; nonce: number; openAudience: (q: Partial<AudienceQuery>) => void }) {
  const nav = useNav();
  const [showAll, setShowAll] = useState(false);
  if (!metrics) return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;
  const w = metrics.window.label;
  const p = periodName(metrics.window);
  const g = metrics.growth;
  const people = metrics.people as Record<string, number>;
  const ops = metrics.ops as Record<string, number>;
  /* Registrations come from event_registrations (the console read event_applications and said
     "0 registrations" while 26 existed). Older databases without the key fall back to 0. */
  const ev = ((metrics as unknown as { events?: Record<string, number> }).events
    ?? { registrations: 0, registrations_paid: 0 }) as Record<string, number>;
  const m = metrics.money as Record<string, unknown>;
  const byProduct = (m.by_product as Array<{ product: string; currency: string; window: number; window_count: number; all_time: number; all_time_count: number }> | undefined) ?? [];
  const lifetime = byProduct.filter((r) => r.all_time_count > 0)
    .map((r) => `${productName(r.product)} ${/^(COP|CLP)$/.test(r.currency) ? number(Math.round(r.all_time)) : money(r.all_time)} ${r.currency} (${r.all_time_count})`).join(" · ");

  /* The four essentials the July Overview led with, everything else behind one toggle. */
  const essentials: Array<[string, Kpi | number, AccentKey, (() => void) | undefined, string | undefined]> = [
    ["Real visitors", g.visitors, "brand", () => openAudience({ group: "visitor" }), "See who"],
    ["Visits", g.visits, "brand", () => openAudience({ group: "visitor" }), "See each visit"],
    ["Signups", g.signups, "violet", () => nav.drill("signups", "Signed up"), "See who joined"],
    ["Onboarded", g.onboarded, "violet", () => nav.drill("onboarded_window", "Finished onboarding"), "See who"],
  ];
  const rest: Array<[string, Kpi | number, () => void]> = [
    ["Page views", g.page_views, () => nav.places("page")],
    ["Product actions", g.product_actions, () => nav.drill("product_actions_window", "Product actions")],
    ["Bot visitors", g.bot_visitors, () => openAudience({ cls: "bot" })],
    ["Our own visitors", g.our_visitors ?? 0, () => openAudience({ cls: "ours" })],
    ["Locations", g.locations, () => nav.places("city")],
    ["Emails sent", g.emails_sent, () => nav.drill("emails_sent_window", "Emails sent")],
    ["Email failures", g.email_failures, () => nav.drill("email_failures_window", "Email failures")],
    ["Real members", people.real, () => nav.drill("members_real", "Real members")],
    ["Active products", people.products_active, () => nav.drill("products_active", "Active products")],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {essentials.map(([label, value, accent, onOpen, openLabel]) =>
          <MetricCard key={label} label={label} value={value} windowLabel={w} accent={accent} onOpen={onOpen} openLabel={openLabel} />)}
      </div>
      <button onClick={() => setShowAll((value) => !value)} className="w-full rounded-xl border ow-edge py-2 text-[11px] font-extrabold text-brand transition hover:bg-ink/5 dark:hover:bg-white/10">
        {showAll ? "Hide extra metrics" : `Show all metrics (+${rest.length})`}
      </button>
      {showAll && <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {rest.map(([label, value, onOpen]) => <MetricCard key={label} label={label} value={value} windowLabel={w} onOpen={onOpen} openLabel="See them" />)}
      </div>}

      <AudienceTrend isAdmin={isAdmin} hours={hours} nonce={nonce} onOpenDay={openDay}
        onOpenVisitors={(cls) => openAudience({ cls })}/>

      <div className="grid gap-3 md:grid-cols-2">
        <FunnelPanel data={funnel}/>
        <ProductSplit data={funnel}/>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <OperationCard accent="violet" title="People" subtitle="All time"
          lead={{ label: "Real members", value: people.real, open: () => nav.drill("members_real", "Real members"),
                  openLabel: "See them",
                  note: people.real
                    ? `${Math.round((people.onboarded / Math.max(people.real, 1)) * 100)}% have finished onboarding`
                    : "Nobody has signed up yet" }}
          rows={[
            { label: "Onboarded", value: people.onboarded, of: people.real, tone: "good",
              open: () => nav.drill("onboarded_all", "Onboarded"), zeroLabel: "None yet" },
            { label: "Signed in, not onboarded", value: people.signed_in_not_onboarded ?? 0, of: people.real, tone: "warn",
              open: () => nav.drill("signed_in_not_onboarded", "Signed in, not onboarded"), zeroLabel: "Nobody waiting" },
            { label: "Signed in at least once", value: people.claimed, of: people.real,
              open: () => nav.drill("claimed", "Signed in at least once"), zeroLabel: "None yet" },
            { label: "Moved over, never signed in", value: people.migrated, of: people.real, tone: "warn",
              open: () => nav.drill("migrated", "Moved over, never signed in"), zeroLabel: "None outstanding" },
            { label: "Test, sample and team accounts (left out)", value: people.internal ?? 0,
              open: () => nav.drill("members_internal", "Test, sample and team accounts"), zeroLabel: "None" },
          ]}
          footer="The full roster lives on the People tab — it is not repeated here."/>

        {overview && <OperationCard accent="emerald" title="OneEvent" subtitle="All time"
          lead={{ label: "Events published", value: overview.operations.oneevent.events,
                  open: () => nav.drill("events_all", "Events published"), openLabel: "See them",
                  note: overview.operations.oneevent.events
                    ? `${number(ev.registrations)} registration${ev.registrations === 1 ? "" : "s"} · ${number(ev.registrations_paid)} paid`
                    : "No event has been published yet" }}
          rows={[
            { label: "Registrations", value: ev.registrations,
              open: () => nav.drill("event_registrations", "Registrations"), zeroLabel: "None yet" },
            { label: "Paid tickets", value: ev.registrations_paid, of: ev.registrations, tone: "good",
              open: () => nav.drill("event_registrations_paid", "Paid tickets"), zeroLabel: "None paid" },
            { label: "Applications, last 30 days", value: overview.operations.oneevent.applications,
              open: () => nav.drill("event_applications_30d", "Applications, last 30 days"), zeroLabel: "None received" },
            { label: "Pending approvals", value: overview.operations.oneevent.pending_approvals, tone: "warn",
              open: () => nav.drill("event_pending", "Pending approvals"), zeroLabel: "All cleared" },
            { label: "Applications with unsettled payment", value: overview.operations.oneevent.payment_attention, tone: "warn",
              open: () => nav.drill("event_payment_attention", "Applications with unsettled payment"), zeroLabel: "All clear" },
          ]}
          empty="No events have been published yet, so nothing has been registered or paid for."/>}

        {overview && <OperationCard accent="emerald" title="OneHome" subtitle="All time"
          lead={{ label: "Properties listed", value: overview.operations.onehome.rental_listings + overview.operations.onehome.sale_listings,
                  open: () => nav.drill("listings_all", "Properties listed"), openLabel: "See them",
                  note: (overview.operations.onehome.rental_listings + overview.operations.onehome.sale_listings)
                    ? `${number(overview.operations.onehome.rental_listings)} to rent · ${number(overview.operations.onehome.sale_listings)} for sale`
                    : "No property has been listed yet" }}
          rows={[
            { label: "Stay requests, last 30 days", value: overview.operations.onehome.rental_requests,
              open: () => nav.drill("rental_requests_30d", "Stay requests, last 30 days"), zeroLabel: "None received" },
            { label: "Active rental contracts", value: overview.operations.onehome.active_contracts, tone: "good",
              open: () => nav.drill("rental_contracts_active", "Active rental contracts"), zeroLabel: "None active" },
            { label: "Sale deals", value: overview.operations.onehome.sale_deals, tone: "good",
              open: () => nav.drill("sale_deals", "Sale deals"), zeroLabel: "None yet" },
          ]}
          empty="No property has been listed yet, so there is nothing to request or contract."/>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <OperationCard accent="sky" title="Needs attention" subtitle="Right now"
          lead={{ label: "Things waiting on you", value: ops.alerts_open + ops.onboarding_incomplete + ops.money_truth_violations,
                  open: () => goto("ops", "Health"), openLabel: "Open Ops",
                  note: (ops.alerts_open + ops.onboarding_incomplete + ops.money_truth_violations)
                    ? "Open alerts, people stuck at the sign-up gate and money-truth violations"
                    : "Nothing is waiting on a human right now" }}
          rows={[
            { label: "Open alerts", value: ops.alerts_open, tone: "warn", open: () => nav.drill("alerts_open", "Open alerts"), zeroLabel: "None open" },
            { label: "Critical alerts", value: ops.alerts_critical, of: ops.alerts_open, tone: "warn",
              open: () => nav.drill("alerts_critical", "Critical alerts"), zeroLabel: "None critical" },
            { label: "Stuck at the sign-up gate", value: ops.onboarding_incomplete, of: people.real, tone: "warn",
              open: () => nav.drill("stuck_at_gate", "Stuck at the sign-up gate"), zeroLabel: "Nobody stuck" },
            { label: `Email failures in ${p}`, value: ops.email_failures_window, tone: "warn",
              open: () => nav.drill("email_failures_window", "Email failures"), zeroLabel: "None" },
            { label: "Money-truth violations", value: ops.money_truth_violations, tone: "warn",
              open: () => nav.drill("money_truth_violations", "Money-truth violations"), zeroLabel: "None" },
          ]}
          empty="Nothing needs a human right now. This card is the one you want to stay empty."/>

        <OperationCard accent="amber" title="Money at a glance" subtitle={p}
          lead={{ label: `Captured in ${p} (USD, every product)`, value: num(m.gross_captured), money: true,
                  open: () => nav.drill("captured_usd_window", `USD captured in ${p}`), openLabel: "See the payments",
                  note: lifetime ? `All time: ${lifetime}` : `Platform fee ${money(num(m.platform_fee))}` }}
          rows={[
            { label: `Paid OneJob contracts in ${p}`, value: num((metrics.money as Record<string, unknown>).paid_agreements),
              open: () => nav.drill("contracts_paid_window", "Paid OneJob contracts"), zeroLabel: "None" },
            { label: "Awaiting capture", value: num((metrics.money as Record<string, unknown>).awaiting_capture), tone: "warn",
              open: () => nav.drill("awaiting_capture", "Awaiting capture"), zeroLabel: "None held" },
            { label: "Open disputes", value: num((metrics.money as Record<string, unknown>).disputes_open), tone: "warn",
              open: () => nav.drill("disputes_open", "Open disputes"), zeroLabel: "None open" },
            { label: "Active subscriptions", value: num((metrics.money as Record<string, unknown>).subscriptions_active),
              open: () => nav.drill("subscriptions_active", "Active subscriptions"), zeroLabel: "None active" },
            { label: "Active promo codes", value: num((metrics.money as Record<string, unknown>).promo_codes_active),
              open: () => nav.drill("promo_codes_active", "Active promo codes"), zeroLabel: "None active" },
          ]}
          empty="No money has moved through One World in this window. Widen the window with the time chips above, or check the Money tab for lifetime figures."/>
      </div>
    </div>
  );
}

/* The collector records whatever the platform hands it, so the same country arrives as "CO" one
   day and "Colombia" the next. A reader should not have to know ISO codes. (Kept from the retired
   Traffic explorer, which ADMIN30 overlay 9 replaced with Pages & places.) */
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

function GrowthSummary({ console: metrics }: { console: Console | undefined }) {
  const nav = useNav();
  if (!metrics) return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;
  const w = metrics.window.label;
  const g = metrics.growth;
  const coverage = metrics.coverage as Record<string, number>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard label="Real visitors" value={g.visitors} windowLabel={w} onOpen={() => nav.audience({ group: "visitor" })} openLabel="See who"/>
        <MetricCard label="Visits" value={g.visits} windowLabel={w} onOpen={() => nav.audience({ group: "visitor" })} openLabel="See each visit"/>
        <MetricCard label="Page views" value={g.page_views} windowLabel={w} onOpen={() => nav.places("page")} openLabel="See the pages"/>
        <MetricCard label="Bot visitors" value={g.bot_visitors} windowLabel={w} onOpen={() => nav.audience({ cls: "bot" })} openLabel="See them"/>
        <MetricCard label="Signups" value={g.signups} windowLabel={w} onOpen={() => nav.drill("signups", "Signed up")} openLabel="See who"/>
        <MetricCard label="Onboarded" value={g.onboarded} windowLabel={w} onOpen={() => nav.drill("onboarded_window", "Finished onboarding")} openLabel="See who"/>
        <MetricCard label="Emails sent" value={g.emails_sent} windowLabel={w} onOpen={() => nav.drill("emails_sent_window", "Emails sent")} openLabel="See them"/>
        <MetricCard label="Email failures" value={g.email_failures} windowLabel={w} attention onOpen={() => nav.drill("email_failures_window", "Email failures")} openLabel="See them"/>
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
function PeopleDirectory({ isAdmin, isEs, console: metrics, onOpen, product }:
  { isAdmin: boolean; isEs: boolean; console: Console | undefined; onOpen: (id: string) => void;
    product: string }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const nav = useNav();
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
        <MetricCard accent="violet" label="Real members" value={people.real} note="Test, sample and team accounts left out"
          onOpen={() => nav.drill("members_real", "Real members")} openLabel="See them"/>
        <MetricCard accent="violet" label="Onboarded" value={people.onboarded} onOpen={() => nav.drill("onboarded_all", "Onboarded")} openLabel="See them"
          note={people.real ? `${Math.round((people.onboarded / Math.max(people.real, 1)) * 100)}% of members` : "Lifetime total"}/>
        <MetricCard accent="violet" label="Pending onboarding" value={people.pending_onboarding} attention
          onOpen={() => nav.drill("pending_onboarding", "Pending onboarding")} openLabel="See them"
          note={people.real ? `${Math.round((people.pending_onboarding / Math.max(people.real, 1)) * 100)}% of members` : "Lifetime total"}/>
        <MetricCard accent="violet" label="New this window" value={metrics.people.new_this_window as Kpi} windowLabel={metrics.window.label}
          onOpen={() => nav.drill("members_new", "New members")} openLabel="See them"/>
        <MetricCard accent="violet" label="Claimed" value={people.claimed} onOpen={() => nav.drill("claimed", "Signed in at least once")} openLabel="See them"
          note={people.real ? `${Math.round((people.claimed / Math.max(people.real, 1)) * 100)}% of members` : "Lifetime total"}/>
        <MetricCard accent="violet" label="Never claimed" value={people.migrated} attention
          onOpen={() => nav.drill("migrated", "Moved over, never signed in")} openLabel="See them"
          note={people.real ? `${Math.round((people.migrated / Math.max(people.real, 1)) * 100)}% never signed in` : "Lifetime total"}/>
        <MetricCard accent="violet" label="VIP" value={people.plan_vip} note="On the VIP plan now" onOpen={() => nav.drill("plan_vip", "VIP members")} openLabel="See them"/>
        <MetricCard accent="violet" label="Pro" value={people.plan_pro} note="On the Pro plan now" onOpen={() => nav.drill("plan_pro", "Pro members")} openLabel="See them"/>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Breakdown accent="violet" title="Members by product" rows={byProduct.map((row) => ({ label: productName(row.label), value: row.value }))}
          onOpen={(label) => { const hit = byProduct.find((row) => productName(row.label) === label); if (hit) nav.drill("product_holders", `${label} — who holds it`, hit.label); }}/>
        <OperationCard accent="violet" title="Account state" subtitle="All time"
          lead={{ label: "Public profiles", value: people.public_profiles, open: () => nav.drill("public_profiles", "Public profiles"), openLabel: "See them",
                  note: people.real
                    ? `${Math.round((people.public_profiles / Math.max(people.real, 1)) * 100)}% of members are findable`
                    : "Nobody has signed up yet" }}
          rows={[
            { label: "From the waitlist", value: people.from_waitlist, of: people.real,
              open: () => nav.drill("from_waitlist", "Came from the waitlist"), zeroLabel: "None" },
            { label: "Promotional passes active", value: people.promo_active,
              open: () => nav.drill("promo_passes_active", "Promotional passes active"), zeroLabel: "None active" },
            { label: "Suspended", value: people.suspended, tone: "warn",
              open: () => nav.drill("suspended", "Suspended"), zeroLabel: "None" },
            { label: "Locked by an admin", value: people.admin_locked, tone: "warn",
              open: () => nav.drill("admin_locked", "Locked by an admin"), zeroLabel: "None" },
            { label: "Test, sample and team accounts (left out)", value: people.internal ?? 0,
              open: () => nav.drill("members_internal", "Test, sample and team accounts"), zeroLabel: "None" },
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
          <button onClick={() => onOpen(member.user_id)} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">
            <Avatar src={member.photo_url} name={member.full_name} size={42} rounded="rounded-full" textSize="text-sm"/>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><p className="[overflow-wrap:anywhere] font-extrabold">{member.full_name ?? "No name"}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${tag.cls}`}>{tag.label}</span></div>
              <p className="[overflow-wrap:anywhere] text-xs opacity-50">{member.email ?? "—"}</p>
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
  const nav = useNav();
  if (!metrics) return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;
  const m = metrics.money as Record<string, Kpi | number>;
  const w = metrics.window.label;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard accent="amber" label="Captured, USD" value={m.gross_captured as Kpi} windowLabel={w} format={money}
          onOpen={() => nav.drill("captured_usd_window", "USD captured")} openLabel="See the payments"/>
        <MetricCard accent="amber" label="Platform fee, USD" value={m.platform_fee as Kpi} windowLabel={w} format={money}
          onOpen={() => nav.drill("captured_usd_window", "USD captured")} openLabel="See the payments"/>
        <MetricCard accent="amber" label="Paid OneJob contracts" value={m.paid_agreements as Kpi} windowLabel={w}
          onOpen={() => nav.drill("contracts_paid_window", "Paid OneJob contracts")} openLabel="See them"/>
        <MetricCard accent="amber" label="Stripe webhooks" value={m.stripe_webhooks as Kpi} windowLabel={w}
          onOpen={() => goto("money", "Stripe")} openLabel="See them"/>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <OperationCard accent="amber" title="Contract money" subtitle="All time"
          lead={{ label: "Contracts written", value: num(m.agreements_total), open: () => nav.drill("contracts_all", "Contracts written"),
                  openLabel: "See them",
                  note: num(m.agreements_total)
                    ? `${number(num(m.awaiting_capture))} still awaiting capture`
                    : "No contract has been written yet" }}
          rows={[
            { label: "Awaiting capture", value: num(m.awaiting_capture), of: num(m.agreements_total), tone: "warn",
              open: () => nav.drill("awaiting_capture", "Awaiting capture"), zeroLabel: "None held" },
            { label: "Released to the payee", value: num(m.released), of: num(m.agreements_total), tone: "good",
              open: () => nav.drill("released", "Released to the payee"), zeroLabel: "None yet" },
            { label: "Refunded", value: num(m.refunded), of: num(m.agreements_total), tone: "warn",
              open: () => nav.drill("refunded", "Refunded"), zeroLabel: "None" },
            { label: "Payment failures", value: num(m.payment_failures), tone: "warn",
              open: () => nav.drill("payment_failures", "Payment failures"), zeroLabel: "None" },
          ]}
          empty="No contracts have been written in One World yet. This card fills the first time a member pays another member."/>

        <OperationCard accent="amber" title="Payouts and disputes" subtitle="All time"
          lead={{ label: "Payouts made to members", value: num(m.payouts_paid), open: () => nav.drill("payouts_paid", "Payouts made"),
                  openLabel: "See them",
                  note: num(m.payouts_failed) ? `${number(num(m.payouts_failed))} failed and need a retry` : "No failed payouts" }}
          rows={[
            { label: "Payouts failed", value: num(m.payouts_failed), of: num(m.payouts_paid) + num(m.payouts_failed),
              tone: "warn", open: () => nav.drill("payouts_failed", "Payouts failed"), zeroLabel: "None" },
            { label: "Disputes open", value: num(m.disputes_open), of: num(m.disputes_total), tone: "warn",
              open: () => nav.drill("disputes_open", "Open disputes"), zeroLabel: "None open" },
            { label: "Disputes, all time", value: num(m.disputes_total), open: () => nav.drill("disputes_all", "Disputes, all time"), zeroLabel: "Never disputed" },
            { label: "Active subscriptions", value: num(m.subscriptions_active), open: () => nav.drill("subscriptions_active", "Active subscriptions"), zeroLabel: "None active" },
          ]}
          empty="Nothing has been paid out and nothing has been disputed. Both are good states to be in this early."/>

        <OperationCard accent="amber" title="Promotions and events" subtitle="All time"
          lead={{ label: "Promo redemptions", value: num(m.promo_code_uses), open: () => nav.drill("promo_code_uses", "Promo codes that were used"),
                  openLabel: "See the codes",
                  note: `${number(num(m.promo_codes_active))} code${num(m.promo_codes_active) === 1 ? "" : "s"} active right now` }}
          rows={[
            { label: "Promo codes active", value: num(m.promo_codes_active), open: () => nav.drill("promo_codes_active", "Active promo codes"), zeroLabel: "None active" },
            { label: "Event tickets paid", value: num(m.event_payments_paid), open: () => nav.drill("event_registrations_paid", "Paid tickets"), zeroLabel: "None yet" },
            { label: "Event applications with unsettled payment", value: num(m.event_payment_attention), tone: "warn",
              open: () => nav.drill("event_payment_attention", "Applications with unsettled payment"), zeroLabel: "All clear" },
            { label: "OneVoice invoices paid", value: num(m.onevoice_paid), open: () => nav.drill("onevoice_paid", "OneVoice invoices paid"), zeroLabel: "None yet" },
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
  const nav = useNav();
  if (!metrics) return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>;
  const o = metrics.ops as Record<string, Kpi | number>;
  const alerts = (metrics.ops.alerts_recent ?? []) as AlertRow[];
  const backup = metrics.ops.last_backup as { started_at: string; status: string; records: number } | null;
  const w = metrics.window.label;
  const p = periodName(metrics.window);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard accent="sky" label="Open alerts" value={num(o.alerts_open)} attention note="Unresolved right now"
          onOpen={() => nav.drill("alerts_open", "Open alerts")} openLabel="See them"/>
        <MetricCard accent="sky" label="Critical alerts" value={num(o.alerts_critical)} attention note="Unresolved right now"
          onOpen={() => nav.drill("alerts_critical", "Critical alerts")} openLabel="See them"/>
        <MetricCard accent="sky" label="Admin actions" value={o.admin_actions as Kpi} windowLabel={w}
          onOpen={() => goto("ops", "Admin log")} openLabel="See the log"/>
        <MetricCard accent="sky" label="Blocked attempts" value={o.blocked_attempts as Kpi} windowLabel={w}
          onOpen={() => nav.drill("blocked_attempts_window", "Blocked attempts")} openLabel="See them"/>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <OperationCard accent="sky" title="Security" subtitle="Standing"
          lead={{ label: "Blocked or banned", value: num(o.blocked_ips) + num(o.banned_identities),
                  open: () => goto("ops", "Blocked"), openLabel: "Open the block list",
                  note: (num(o.blocked_ips) + num(o.banned_identities))
                    ? `${number(num(o.blocked_ips))} address${num(o.blocked_ips) === 1 ? "" : "es"} · ${number(num(o.banned_identities))} identit${num(o.banned_identities) === 1 ? "y" : "ies"}${num(o.blocked_attempts) ? ` · ${number(num(o.blocked_attempts))} attempts turned away in ${p}` : ""}`
                    : "Nothing has had to be blocked yet" }}
          rows={[
            { label: "Blocked IP addresses", value: num(o.blocked_ips), open: () => nav.drill("blocked_ips_active", "Blocked addresses"), zeroLabel: "None blocked" },
            { label: "Banned identities", value: num(o.banned_identities), open: () => nav.drill("banned_identities", "Banned identities"), zeroLabel: "None banned" },
            { label: "Suppressed email addresses", value: num(o.suppressed_emails), open: () => goto("growth", "Suppressed"), zeroLabel: "None" },
            { label: "Content reports open", value: num(o.content_reports_open), tone: "warn",
              open: () => nav.drill("reports_open", "Open content reports"), zeroLabel: "None open" },
            { label: "Money-truth violations", value: num(o.money_truth_violations), tone: "warn",
              open: () => nav.drill("money_truth_violations", "Money-truth violations"), zeroLabel: "None" },
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
              open: () => nav.drill("alerts_unacked", "Alerts not acknowledged"), zeroLabel: "All acknowledged" },
            { label: "Stuck at the sign-up gate", value: num(o.onboarding_incomplete), tone: "warn",
              open: () => nav.drill("stuck_at_gate", "Stuck at the sign-up gate"), zeroLabel: "Everyone finished" },
            { label: `Email failures in ${p}`, value: num(o.email_failures_window), tone: "warn",
              open: () => nav.drill("email_failures_window", "Email failures"), zeroLabel: "None" },
            { label: "QA results recorded", value: num(o.qa_results), open: () => goto("ops", "QA"), zeroLabel: "No run recorded" },
            { label: "Accountability items open", value: num(o.accountability_open), tone: "warn",
              open: () => nav.drill("accountability_open", "Accountability items open"), zeroLabel: "None open" },
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
          footer="Counts only. Members' messages and conversations are private, so they are never listed here."
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
  const nav = useNav();
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
          ["Traffic events", coverage.analytics_events, () => nav.audience({ cls: "all" })],
          ["Waitlist surveys", coverage.waitlist_surveys, () => nav.goto("growth", "Waitlist")],
          ["Affiliates", coverage.affiliates, () => nav.goto("growth", "Affiliates")],
          ["Lead-gen leads", coverage.lead_gen_leads, () => nav.goto("growth", "Lead Gen")],
          ["Agents", coverage.agents, null],
          ["Backup runs", coverage.aws_sync_runs, () => nav.goto("ops", "Backups")],
          ["Chat transcripts", coverage.chat_transcripts, () => nav.goto("ops", "Transcripts")],
          ["Nurture states", coverage.nurture_state, () => nav.goto("growth", "Nurture")],
        ] as Array<[string, number, (() => void) | null]>).map(([label, value, open]) => {
          const inner = <>
            <dt className="opacity-60">{label}</dt>
            <dd className={value ? "font-black" : "font-black opacity-35"}>{value ? number(value) : "none yet"}{value && open ? <span className="ml-1 text-brand">→</span> : null}</dd>
          </>;
          return value && open
            ? <button key={label} onClick={open} className="flex items-center justify-between py-2 text-left">{inner}</button>
            : <div key={label} className="flex items-center justify-between py-2">{inner}</div>;
        })}
      </dl>
    </section>
  );
}

/* ============================================ refund problems (ONEHOME30 overlay 34) =========
 * A refund OneHome recorded can fail LATER at the card company (closed or expired card). The
 * hourly sweep moves it to `failed_after_refund`, tells the payer "support is on it" and raises a
 * critical alert that ends "a person must decide". This is where that person decides.
 *
 * Stripe's guidance for a failed refund is that the money comes back to the platform balance and
 * the customer is paid ANOTHER way. So this panel moves no money: support pays the payer, then
 * records how. The server checks the admin, the state, the reference and the note, closes the
 * alert, writes the admin log, and tells the payer in the app and by text.
 * ========================================================================================== */
type RefundProblem = {
  id: string; kind: "rental" | "sale"; state: "card_failed" | "stuck"; unresolved: boolean;
  amount_minor: number; currency: string; decimals: number;
  payer: { id: string; name: string | null; email: string | null }; payee: { id: string | null; name: string | null };
  reason: string | null; stripe_refund_id: string | null; at: string; refunded_at: string | null;
  resolution: { method: string; reference: string | null; note: string; by: string | null; at: string } | null;
};
type FixMethod = "bank_transfer" | "card_again" | "other";
const FIX_METHODS: Array<{ key: FixMethod; label: string; ref: string; hint: string }> = [
  { key: "bank_transfer", label: "Bank transfer", ref: "Transfer reference", hint: "The reference from the bank receipt." },
  { key: "card_again", label: "Card again", ref: "New Stripe refund id", hint: "Refund the charge again in Stripe first, then paste the new id (re_…)." },
  { key: "other", label: "Another way", ref: "Reference (optional)", hint: "Cash, Nequi, Daviplata… say which in the note." },
];
const refundAmount = (r: RefundProblem) => {
  const major = r.amount_minor / 10 ** r.decimals;
  return /^(COP|CLP)$/.test(r.currency)
    ? `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(major)} ${r.currency}`
    : `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(major)} ${r.currency}`;
};
const PREVIEW_REFUND_PROBLEMS: RefundProblem[] = [
  { id: "00000000-0000-4000-8000-0000000000c1", kind: "rental", state: "card_failed", unresolved: true, amount_minor: 204250000, currency: "COP", decimals: 2,
    payer: { id: "p1", name: "Camila Restrepo", email: "camila@example.com" }, payee: { id: "h1", name: "Juan Pérez" },
    reason: "expired_or_canceled_card", stripe_refund_id: "re_3Pq7Example", at: new Date(Date.now() - 86400000).toISOString(),
    refunded_at: new Date(Date.now() - 3 * 86400000).toISOString(), resolution: null },
  { id: "00000000-0000-4000-8000-0000000000c3", kind: "sale", state: "stuck", unresolved: true, amount_minor: 150000, currency: "USD", decimals: 2,
    payer: { id: "p2", name: "Daniel Ortiz", email: "daniel@example.com" }, payee: { id: "h2", name: "Aria Montoya" },
    reason: "api_connection_error", stripe_refund_id: null, at: new Date(Date.now() - 8 * 3600000).toISOString(), refunded_at: null, resolution: null },
];

function RefundProblems({ isAdmin, nonce }: { isAdmin: boolean; nonce: number }) {
  const [rows, setRows] = useState<RefundProblem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [method, setMethod] = useState<FixMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let dead = false;
    setLoadError(null);
    if (previewMode()) { setRows(PREVIEW_REFUND_PROBLEMS); return; }
    void supabase.rpc("admin_refund_problems").then(({ data, error }) => {
      if (dead) return;
      if (error) { setLoadError(error.message); setRows([]); return; }
      setRows((data as unknown as RefundProblem[]) ?? []);
    });
    return () => { dead = true; };
  }, [isAdmin, nonce, reload]);

  const start = (id: string) => { setOpen(id); setMethod("bank_transfer"); setReference(""); setNote(""); setProblem(null); };
  const spec = FIX_METHODS.find(m => m.key === method)!;
  const refOk = method === "card_again" ? /^re_[A-Za-z0-9]+$/.test(reference.trim()) : method === "bank_transfer" ? reference.trim().length > 0 : true;
  const ready = refOk && note.trim().length >= 5;

  async function record(r: RefundProblem) {
    if (!ready) return;
    setBusy(true); setProblem(null);
    if (previewMode()) {
      setRows(list => (list ?? []).map(x => x.id === r.id ? { ...x, unresolved: false,
        resolution: { method, reference: reference.trim() || null, note: note.trim(), by: "You", at: new Date().toISOString() } } : x));
      setBusy(false); setOpen(null); return;
    }
    const { error } = await supabase.rpc("admin_resolve_refund_problem", {
      p_refund: r.id, p_method: method, p_reference: reference.trim() || null, p_note: note.trim() });
    setBusy(false);
    /* A returned error without a SQLSTATE may still have committed — re-read instead of retrying. */
    if (error && !error.code) { setProblem("We couldn’t confirm whether that was saved. Refreshing to check."); setReload(x => x + 1); return; }
    if (error) { setProblem(error.message); if (error.code === "23505") setReload(x => x + 1); return; }
    setOpen(null); setReload(x => x + 1);
  }

  if (loadError) return <Problem what="Refund problems aren’t available." detail={`${loadError} — this tab needs the admin_refund_problems function released to the database.`}/>;
  if (!rows) return <div className="space-y-2">{[0, 1].map(i => <div key={i} className="card h-24 animate-pulse"/>)}</div>;

  const waiting = rows.filter(r => r.state === "card_failed" && r.unresolved).length;
  return (
    <div className="space-y-3">
      <div className="card p-4">
        <h3 className="text-sm font-extrabold">Refund problems</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed opacity-65">
          Refunds the card company failed after OneHome recorded them. The money is back in the Stripe balance and the payer
          has not received it. Pay them another way, then record how — they’re told in the app and by text.
        </p>
        <p className="mt-2 text-[12.5px] font-bold">{waiting ? `${number(waiting)} waiting for a person` : "Nothing waiting"}</p>
      </div>

      {!rows.length && (
        <div className="card p-4 text-[13px] opacity-70">
          No refund problems. When a card company fails a refund after it was recorded, it appears here within the hour.
        </div>
      )}

      {rows.map(r => (
        <article key={r.id} className="card space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-black">{refundAmount(r)}</p>
              <p className="[overflow-wrap:anywhere] text-[12.5px] opacity-70">
                To {r.payer.name ?? "the payer"}{r.payer.email ? ` · ${r.payer.email}` : ""}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              !r.unresolved ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : r.state === "card_failed" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-ink/10 dark:bg-white/10"}`}>
              {!r.unresolved ? "Resolved" : r.state === "card_failed" ? "Card company failed it" : "Stuck mid-way"}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            <dt className="opacity-55">{r.kind === "rental" ? "Rental booking" : "Sale payment"}</dt>
            <dd className="text-right">{r.payee.name ? `Payee ${r.payee.name}` : "—"}</dd>
            <dt className="opacity-55">Why</dt><dd className="[overflow-wrap:anywhere] text-right">{r.reason ?? "—"}</dd>
            <dt className="opacity-55">{r.state === "card_failed" ? "Failed" : "Since"}</dt><dd className="text-right">{exact(r.at)}</dd>
            {r.stripe_refund_id && <><dt className="opacity-55">Stripe refund</dt><dd className="[overflow-wrap:anywhere] text-right font-mono text-[11px]">{r.stripe_refund_id}</dd></>}
          </dl>

          {r.state === "stuck" && (
            <p className="text-[12px] leading-relaxed opacity-65">
              The payee’s share was taken back but the card refund didn’t go through. The hourly sweep keeps retrying;
              if it is still here tomorrow, check the charge in Stripe.
            </p>
          )}

          {r.resolution && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-[12.5px] leading-relaxed">
              Paid back {r.resolution.method === "bank_transfer" ? "by bank transfer" : r.resolution.method === "card_again" ? "to the card again" : "another way"}
              {r.resolution.reference ? ` (${r.resolution.reference})` : ""} · {exact(r.resolution.at)}{r.resolution.by ? ` · ${r.resolution.by}` : ""}
              <br/><span className="opacity-70">{r.resolution.note}</span>
            </p>
          )}

          {r.state === "card_failed" && r.unresolved && open !== r.id && (
            <button type="button" className="btn-primary h-10 w-full text-[13.5px]" onClick={() => start(r.id)}>Record how it was paid back</button>
          )}

          {open === r.id && (
            <fieldset disabled={busy} className="space-y-2 border-t border-ink/10 pt-3 dark:border-white/10">
              <legend className="sr-only">How the money was paid back</legend>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="How it was paid back">
                {FIX_METHODS.map(m => (
                  <button key={m.key} type="button" role="radio" aria-checked={method === m.key} onClick={() => { setMethod(m.key); setProblem(null); }}
                    className={`h-10 rounded-xl border text-[12.5px] font-bold ${method === m.key
                      ? "border-transparent bg-ink text-paper dark:bg-white dark:text-ink" : "border-ink/20 dark:border-white/20"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              <label className="block text-[12px] font-bold">{spec.ref}
                <input className="input mt-1 h-10 w-full text-[13.5px]" value={reference} onChange={e => setReference(e.target.value)}
                  placeholder={method === "card_again" ? "re_…" : ""} maxLength={120}/>
              </label>
              <p className="-mt-1 text-[11.5px] opacity-60">{spec.hint}</p>
              <label className="block text-[12px] font-bold">Note
                <textarea className="input mt-1 min-h-[72px] w-full py-2 text-[13.5px]" value={note} onChange={e => setNote(e.target.value)}
                  maxLength={1000} placeholder="What was done, and who confirmed it"/>
              </label>
              {problem && <p role="alert" className="text-[12.5px] font-semibold text-red-600 dark:text-red-400">{problem}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn-ghost h-10 flex-1 text-[13.5px]" onClick={() => setOpen(null)}>Cancel</button>
                <button type="button" className="btn-primary h-10 flex-[2] whitespace-nowrap text-[13.5px] disabled:opacity-50" disabled={!ready} onClick={() => void record(r)}>
                  {busy ? "Saving…" : "Save and notify"}
                </button>
              </div>
            </fieldset>
          )}
        </article>
      ))}
    </div>
  );
}

/* ============================================== WHO CAME, FROM WHERE, AND DID THEY JOIN ======
 * ADMIN30 overlay 7 — Lee, 3 Oct 2026:
 *   "I click on one hour. Is it truly showing the visitors from that one hour? Let's say there's
 *    five visitors in the last hour. Can I see those visitors? Can I click on the five? … Did
 *    they sign up? When? What's their name? … What pages did they go to? … Were there bots? …
 *    Did they come in through SEO … AI search … a video … a link I sent … a promo code?"
 *
 * Four screens answer that, all reading ONE server definition of "a visitor" (admin_visitor_rows)
 * and ONE definition of "us" (admin_is_internal_user), so no two numbers can disagree:
 *   Visitors — every person in the window; tap one for their whole story
 *   Sources  — each channel: visitors → sign-ups → conversion; tap to see the people
 *   Videos   — each agent video: viewed → played → finished → tapped → signed up
 *   Bots     — who was a bot, what was blocked, how the sign-in check is doing
 * ============================================================================================ */

type Cls = "human" | "ours" | "bot" | "all";
type AudienceGroup = "address" | "network" | "visitor";
type AudienceQuery = { cls: Cls; channel: string | null; detail: string | null; search: string; day: string | null;
                       group: AudienceGroup; network: string | null; country: string | null; city: string | null;
                       device: string | null; page: string | null };
const AUDIENCE_DEFAULT: AudienceQuery = { cls: "human", channel: null, detail: null, search: "", day: null,
  group: "visitor", network: null, country: null, city: null, device: null, page: null };

type AudienceRow = {
  visitor_id: string; cls: Exclude<Cls, "all">; ip: string | null; ips: string[] | null;
  country: string | null; city: string | null; region?: string | null; isp: string | null; vpn: boolean;
  device: string | null; browser: string | null; first_seen: string; last_seen: string;
  visits: number; views: number; pages: number; seconds: number; landed_on: string | null; last_page: string | null;
  channel: string; channel_label: string; channel_detail: string | null; products: string[] | null; bot_name: string | null;
  member_id: string | null; member_name: string | null; member_email: string | null; member_since: string | null;
  member_for: string | null; member_onboarded: string | null; joined_in_window: boolean; joined_after_visit: boolean;
};
type ChannelRow = { channel: string; label: string; visitors: number; signups: number; rate: number | null;
                    details: Array<{ detail: string; visitors: number; signups: number }> };
type Audience = {
  window: { start: string; end: string; label: string; hourly: boolean };
  classes: { human: { visitors: number; visits: number; views: number }; ours: { visitors: number; views: number }; bot: { visitors: number; views: number } };
  signups: number; converted: number; channels: ChannelRow[];
  series: Array<{ t: string; visitors: number; signups: number }>;
  total_rows: number; rows: AudienceRow[];
};
type SignupRow = { member_id: string; name: string | null; email: string | null; signed_up_at: string; signed_up_for: string;
                   onboarded_at: string | null; channel: string; channel_label: string; channel_detail: string | null;
                   listings: number; published: number; campaign: string | null; source: string | null };
type VideoRow = { slug: string; title: string; tag: string; lang: string; path: string; viewers: number; plays: number;
                  halfway: number; finished: number; tapped: number; reached_join: number; signups: number;
                  signups_all_time: number; listed_all_time: number; first_tracked: string | null };
type PromoRow = { code: string; label: string | null; kind: string | null; value: number | null; uses: number | null;
                  max_uses: number | null; active: boolean; expires_at: string | null; rotates: boolean | null; visitors: number; signups: number };
type Acquisition = { window: { label: string }; signups: SignupRow[]; videos: VideoRow[]; promo_codes: PromoRow[];
                     unattributed_signups: number; tracking_note: string };
type Journey = {
  visitor_id: string; class: Exclude<Cls, "all">; first_seen: string; last_seen: string; total_events: number;
  addresses: Array<{ ip: string; country: string | null; city: string | null; isp: string | null; vpn: boolean; first: string; last: string; hits: number }>;
  devices: Array<{ device: string | null; agent: string }>;
  sessions: Array<{ session_id: string; started: string; ended: string; seconds: number; views: number; landed_on: string;
                    channel: string; channel_label: string; channel_detail: string | null }>;
  events: Array<{ at: string; event: string; page: string; product: string | null; from: string | null; ip: string | null;
                  session_id: string; signed_in: boolean; detail: Record<string, unknown> | null }>;
  member: null | { id: string; name: string | null; email: string | null; photo_url: string | null; signed_up_at: string;
                   signed_up_for: string; onboarded_at: string | null; internal: boolean;
                   source: { channel: string; label: string; detail: string | null }; raw_source: string | null; campaign: string | null;
                   last_sign_in: string | null; products: Array<{ product: string; status: string; since: string }>;
                   listings: number; other_devices: number };
};
type BotRow = { name: string; category: string | null; hits: number; visitors: number; addresses: number; last_seen: string;
                sample_ips: string[] | null; verdict: "wanted" | "preview" | "ours" | "blocked" | "unknown" };
type BlockedRow = { ip: string; reason: string | null; bot: string | null; agent: string | null; since: string; attempts: number | null;
                    last_attempt: string | null; expires_at: string | null; active: boolean };
type BotShield = { window: { label: string }; humans: number; bots: BotRow[]; blocked_now: number; blocked_new: number;
                   attempts: number; blocked: BlockedRow[]; captcha: Record<string, number>;
                   protection: { turnstile: string; collector: string; site: string } };

const plural = (n: number, one: string, many = `${one}s`) => `${number(n)} ${n === 1 ? one : many}`;
const hoursOf = (win: { days: number; hours: number | null }) => win.hours ?? win.days * 24;

/* One colour per channel, so a list of forty visitors can be read by colour before by word.
   Teal is STATE in the design canon, so no channel wears it. */
const CHANNEL_TONE: Record<string, string> = {
  video: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  ai: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  search: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  social: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  campaign: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  promo: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  shared: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  qr: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  email: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  paid: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  site: "bg-ink/5 text-brand dark:bg-white/10",
};
const CHANNEL_ORDER = ["video", "ai", "search", "social", "campaign", "promo", "shared", "qr", "email", "paid", "site", "referral", "direct", "unknown"];

function ChannelChip({ channel, label, detail }: { channel: string; label: string; detail?: string | null }) {
  return <span className={`inline-flex max-w-full items-center gap-1 [overflow-wrap:anywhere] rounded-full px-2 py-0.5 text-[10px] font-extrabold ${CHANNEL_TONE[channel] ?? "bg-ink/5 dark:bg-white/10"}`}>
    {label}{detail ? <span className="opacity-75">· {detail}</span> : null}
  </span>;
}
const Pill = ({ children, tone = "" }: { children: React.ReactNode; tone?: string }) =>
  <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${tone || "bg-ink/5 dark:bg-white/10"}`}>{children}</span>;
/* City, state, country, in full (Lee, 5 Oct: "What's the city and state? I can't tell"). */
const place = (city: string | null, country: string | null, region?: string | null) =>
  [city, region && region !== city ? region : null, country].filter(Boolean).join(", ") || "Location pending";
const CLASS_LABEL: Record<Exclude<Cls, "all">, string> = { human: "Real person", ours: "Us", bot: "Bot" };
const productNames = (list: string[] | null | undefined) => (list ?? []).map(productName).join(" · ");

/* ── Visitors ─────────────────────────────────────────────────────────────────────────────── */
function AudiencePanel({ isAdmin, hours, query, onQuery, onOpenVisitor, nonce }: {
  isAdmin: boolean; hours: number; query: AudienceQuery; onQuery: (q: AudienceQuery) => void;
  onOpenVisitor: (id: string) => void; nonce: number;
}) {
  const nav = useNav();
  const [draft, setDraft] = useState(query.search);
  const [limit, setLimit] = useState(40);
  const [error, setError] = useState("");
  useEffect(() => { const t = setTimeout(() => { if (draft.trim() !== query.search) onQuery({ ...query, search: draft.trim() }); }, 300); return () => clearTimeout(t); }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLimit(40); }, [hours, query.cls, query.channel, query.detail, query.search, query.day]);

  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_audience", {
      p_hours: hours, p_class: query.cls, p_channel: query.channel, p_detail: query.detail,
      p_search: query.search || null, p_limit: limit, p_offset: 0, p_day: query.day,
    });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as Audience;
  }, [isAdmin, hours, query.cls, query.channel, query.detail, query.search, query.day, limit, nonce], isAdmin);

  if (error) return <div className="space-y-3"><GroupSwitch query={query} onQuery={onQuery}/>
    <Problem what="The visitor list isn’t available." detail={`${error} — it needs ADMIN30 overlay 7's database part.`}/></div>;
  if (!data) return <div className="space-y-2"><GroupSwitch query={query} onQuery={onQuery}/>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-24 animate-pulse"/>)}</div>;

  const c = data.classes;
  const classes: Array<[Cls, string, number]> = [
    ["human", "Real visitors", c.human.visitors], ["ours", "Us", c.ours.visitors], ["bot", "Bots", c.bot.visitors],
    ["all", "Everyone", c.human.visitors + c.ours.visitors + c.bot.visitors],
  ];
  // ov8: a chip filters VISITORS, so a channel with sign-ups but no visit in the window ("Not recorded 0") is left out
  // here. It still shows on the Sources tab, where its sign-ups count.
  const channels = [...data.channels].filter((ch) => ch.visitors > 0)
    .sort((a, b) => CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel));
  const picked = channels.find((ch) => ch.channel === query.channel);

  return (
    <div className="space-y-3">
      <GroupSwitch query={query} onQuery={onQuery}/>
      {query.day && (
        <div className="card flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
          <span><b>{data.window.label}</b> only (Central time)</span>
          <button onClick={() => onQuery({ ...query, day: null })} className="font-extrabold text-brand">Show the whole window</button>
        </div>
      )}

      {/* Who: the three kinds of traffic, each one tap away. Real people is the default — the
          other two are counted, never mixed in. */}
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Kind of visitor">
        {classes.map(([key, label, n]) => (
          <button key={key} role="tab" aria-selected={query.cls === key} onClick={() => onQuery({ ...query, cls: key })}
            className={`card px-2 py-2.5 text-center transition ${query.cls === key ? "ring-2 ring-teal" : "opacity-75 hover:opacity-100"}`}>
            <p className="text-lg font-black tabular-nums leading-none">{number(n)}</p>
            <p className="mt-1 [overflow-wrap:anywhere] text-[10px] font-extrabold opacity-60">{label}</p>
          </button>
        ))}
      </div>

      {query.cls === "human" && (
        <p className="px-1 text-[11px] opacity-60">
          {number(c.human.visitors)} real {c.human.visitors === 1 ? "visitor" : "visitors"} in the {data.window.label}
          {" · "}<button onClick={() => nav.drill("signups", "Signed up")} className="font-extrabold text-brand">{number(data.signups)} signed up</button>
          {c.human.visitors ? ` · ${number(data.converted)} of these visitors joined (${Math.round((data.converted / c.human.visitors) * 1000) / 10}%)` : ""}
        </p>
      )}
      {query.cls === "ours" && <p className="px-1 text-[11px] opacity-60">You and your test accounts (the same phone or computer they signed in on) and the Claude test browsers. A guest on your Wi-Fi using her own phone counts as a real visitor.</p>}

      {/* From where: every channel that brought someone, as chips. Tap one to see only those people. */}
      {query.cls !== "bot" && channels.length > 0 && (
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <button onClick={() => onQuery({ ...query, channel: null, detail: null })}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold transition ${!query.channel ? "bg-brand text-white" : "ow-field"}`}>All sources</button>
          {channels.map((ch) => (
            <button key={ch.channel} onClick={() => onQuery({ ...query, channel: ch.channel, detail: null })}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold transition ${query.channel === ch.channel ? "bg-brand text-white" : "ow-field"}`}>
              {ch.label} <span className="tabular-nums opacity-70">{ch.visitors}</span>
            </button>
          ))}
        </div>
      )}
      {picked && picked.details.length > 0 && (
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {picked.details.map((d) => (
            <button key={d.detail} onClick={() => onQuery({ ...query, detail: query.detail === d.detail ? null : d.detail })}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition ${query.detail === d.detail ? "bg-ink/5 text-brand dark:bg-white/10" : "ow-field"}`}>
              {d.detail} · {d.visitors} visited · {d.signups} joined
            </button>
          ))}
        </div>
      )}

      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search a name, email, address, city or page"
        aria-label="Search visitors" className="ow-field w-full rounded-xl px-3 py-2 text-xs outline-none"/>

      {!data.rows.length && <EmptySource what="Nobody here yet"
        why={query.channel || query.search ? "No visitor in this window matches. Clear the source or the search, or widen the window."
          : `No ${query.cls === "human" ? "real person" : query.cls === "bot" ? "bot" : "visit"} in the ${data.window.label}. Widen the window above.`}/>}

      <div className="grid gap-2 md:grid-cols-2">
        {data.rows.map((row) => <VisitorCard key={row.visitor_id} row={row} onOpen={() => onOpenVisitor(row.visitor_id)}/>)}
      </div>
      {data.rows.length < data.total_rows && (
        <button onClick={() => setLimit((n) => Math.min(200, n + 40))}
          className="w-full rounded-xl border ow-edge py-2 text-[11px] font-extrabold text-brand transition hover:bg-ink/5 dark:hover:bg-white/10">
          Show more ({number(data.total_rows - data.rows.length)} left)
        </button>
      )}
      <p className="text-center text-[10px] opacity-40">Times are US Central.</p>
    </div>
  );
}

function VisitorCard({ row, onOpen }: { row: AudienceRow; onOpen: () => void }) {
  const joined = row.member_id && row.joined_after_visit;
  return (
    <button onClick={onOpen} className="card relative block w-full overflow-hidden p-4 pl-5 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">
      <span className={`absolute inset-y-0 left-0 w-1 ${joined ? "bg-teal" : row.member_id ? "bg-violet-500" : row.cls === "bot" ? "bg-amber-500" : "bg-brand"}`} aria-hidden/>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="[overflow-wrap:anywhere] text-sm font-extrabold">{row.member_name ?? row.ip ?? "Unknown address"}</p>
          <p className="[overflow-wrap:anywhere] text-[11px] opacity-55">
            {row.member_name ? `${row.ip ?? "—"} · ` : ""}{place(row.city, country(row.country) || null, row.region)}{row.isp ? ` · ${row.isp}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-black leading-none tabular-nums">{number(row.views)}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide opacity-40">pages seen</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {row.cls === "bot"
          ? <Pill tone="bg-amber-500/15 text-amber-700 dark:text-amber-300">{row.bot_name ?? "Bot"}</Pill>
          : <ChannelChip channel={row.channel} label={row.channel_label} detail={row.channel_detail}/>}
        {joined && <Pill tone="bg-teal/15 text-teal">Signed up {clock(row.member_since)}</Pill>}
        {row.member_id && !joined && <Pill tone="bg-violet-500/15 text-violet-700 dark:text-violet-300">Member since {when(row.member_since)}</Pill>}
        {!row.member_id && row.cls === "human" && <Pill>Not signed up</Pill>}
        {row.cls === "ours" && <Pill>Us</Pill>}
        {row.vpn && <Pill tone="bg-amber-500/15 text-amber-700 dark:text-amber-300">Data centre / VPN</Pill>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <div><p className="font-bold uppercase tracking-wide opacity-40">Came in</p><p className="[overflow-wrap:anywhere] font-semibold">{exact(row.first_seen)}</p></div>
        <div><p className="font-bold uppercase tracking-wide opacity-40">Landed on</p><p className="[overflow-wrap:anywhere] font-semibold">{row.landed_on ?? "—"}</p></div>
        <div><p className="font-bold uppercase tracking-wide opacity-40">On site</p><p className="[overflow-wrap:anywhere] font-semibold">{span(row.seconds)}</p></div>
      </div>
      <p className="mt-2 [overflow-wrap:anywhere] text-[10px] opacity-45">
        {[row.device, row.browser, `${row.visits} visit${row.visits === 1 ? "" : "s"}`, productNames(row.products)].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-2 text-[10px] font-extrabold text-brand">See every page and time →</p>
    </button>
  );
}

/* ── One visitor, end to end ──────────────────────────────────────────────────────────────── */
const EVENT_WORDS: Record<string, string> = {
  page_view: "Viewed", video_play: "Played the video", video_progress: "Watched", video_complete: "Finished the video",
  video_cta: "Tapped “Create my profile”", captcha: "Security check",
};
function eventWords(e: Journey["events"][number]) {
  const d = e.detail ?? {};
  if (e.event === "video_progress") return `Watched ${String(d.pct ?? "")}% of the video`;
  if (e.event === "captcha") return ({ ok: "Passed the security check", error: "Failed the security check",
    expired: "Security check expired", unavailable: "Security check blocked by the browser" } as Record<string, string>)[String(d.status)] ?? "Security check";
  return EVENT_WORDS[e.event] ?? titleCase(e.event);
}

function VisitorJourneyPanel({ visitorId, isAdmin, onBack, onOpenMember }: {
  visitorId: string; isAdmin: boolean; onBack: () => void; onOpenMember: (id: string) => void;
}) {
  const nav = useNav();
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [blocking, setBlocking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_visitor_journey", { p_visitor: visitorId });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as Journey;
  }, [visitorId, reload, isAdmin], isAdmin);

  async function block(ip: string, on: boolean) {
    setBusy(true); setNote("");
    const { error: rpcError } = await supabase.rpc("admin_set_ip_block", { p_ip: ip, p_block: on, p_reason: on ? reason.trim() : null, p_hours: null });
    setBusy(false);
    if (rpcError) { setNote(rpcError.message); return; }
    setBlocking(null); setReason(""); setNote(on ? `${ip} is blocked.` : `${ip} is unblocked.`); setReload((n) => n + 1);
  }
  async function markInternal(id: string, on: boolean) {
    setBusy(true); setNote("");
    const { error: rpcError } = await supabase.rpc("admin_set_internal", { p_user: id, p_internal: on, p_label: on ? "marked from the console" : null });
    setBusy(false);
    if (rpcError) { setNote(rpcError.message); return; }
    setNote(on ? "Counted as us from now on." : "Counted as a real member from now on."); setReload((n) => n + 1);
  }

  const backButton = <button onClick={onBack} className="ow-field flex h-8 items-center gap-1 rounded-lg px-3 text-[11px] font-extrabold transition hover:text-brand">
    <span aria-hidden>{"←"}</span> Back</button>;
  if (error) return <div className="space-y-3">{backButton}<Problem what="This visitor can’t be opened." detail={error}/></div>;
  if (!data) return <div className="space-y-2">{backButton}<div className="card h-40 animate-pulse"/><div className="card h-64 animate-pulse"/></div>;

  const m = data.member;
  const firstAddress = data.addresses[0];
  const bySession = data.sessions.map((s) => ({ ...s, events: data.events.filter((e) => e.session_id === s.session_id) }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Pill tone={data.class === "human" ? "bg-teal/15 text-teal" : data.class === "bot" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : ""}>{CLASS_LABEL[data.class]}</Pill>
      </div>

      {/* WHO */}
      <section className="card p-4">
        {m ? <>
          <div className="flex items-center gap-3">
            <Avatar src={m.photo_url} name={m.name} size={48} rounded="rounded-full" textSize="text-base"/>
            <div className="min-w-0">
              <p className="[overflow-wrap:anywhere] text-base font-extrabold">{m.name ?? "Unnamed member"}</p>
              <p className="[overflow-wrap:anywhere] text-xs opacity-60">{m.email ?? "—"}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
            <div><p className="font-bold uppercase tracking-wide opacity-40">Signed up</p><p className="font-semibold">{exact(m.signed_up_at)}</p></div>
            <div><p className="font-bold uppercase tracking-wide opacity-40">Signed up for</p><p className="font-semibold">{productName(m.signed_up_for)}</p></div>
            <div><p className="font-bold uppercase tracking-wide opacity-40">Came from</p><ChannelChip channel={m.source.channel} label={m.source.label} detail={m.source.detail}/></div>
            <div><p className="font-bold uppercase tracking-wide opacity-40">Onboarding</p><p className="font-semibold">{m.onboarded_at ? `Finished ${exact(m.onboarded_at)}` : "Not finished"}</p></div>
            <div><p className="font-bold uppercase tracking-wide opacity-40">Uses</p><p className="font-semibold">{m.products.filter((p) => p.status === "active").map((p) => productName(p.product)).join(" · ") || "Nothing yet"}</p></div>
            <div><p className="font-bold uppercase tracking-wide opacity-40">Listings</p><p className="font-semibold">{number(m.listings)}</p></div>
            <div><p className="font-bold uppercase tracking-wide opacity-40">Last signed in</p><p className="font-semibold">{exact(m.last_sign_in)}</p></div>
            <div><p className="font-bold uppercase tracking-wide opacity-40">Other devices</p><p className="font-semibold">{number(m.other_devices)}</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => onOpenMember(m.id)} className="rounded-xl bg-brand px-3 py-2 text-[11px] font-extrabold text-white">Open member record</button>
            <button disabled={busy} onClick={() => void markInternal(m.id, !m.internal)}
              className="ow-field rounded-xl px-3 py-2 text-[11px] font-extrabold transition hover:text-brand">
              {m.internal ? "Count as a real member" : "Count as us"}
            </button>
          </div>
        </> : <>
          <p className="text-base font-extrabold">{firstAddress?.ip ?? "Unknown address"}</p>
          <p className="text-xs opacity-60">{firstAddress ? place(firstAddress.city, firstAddress.country) : "Location pending"} · has not signed up</p>
        </>}
        <p className="mt-3 text-[10px] opacity-45">First seen {exact(data.first_seen)} · last seen {exact(data.last_seen)} · {number(data.total_events)} recorded actions (pages opened, taps, video plays) · times are US Central</p>
        {note && <p className="mt-2 text-[11px] font-bold text-brand">{note}</p>}
      </section>

      {/* WHERE FROM, ON WHAT */}
      <section className="card p-4">
        <h3 className="text-sm font-extrabold">Addresses and devices</h3>
        <div className="mt-2 divide-y divide-ink/10 dark:divide-white/10">
          {data.addresses.map((a) => (
            <div key={a.ip} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <button onClick={() => nav.address(a.ip)} className="[overflow-wrap:anywhere] text-xs font-extrabold tabular-nums text-brand">{a.ip} →</button>
                  <p className="[overflow-wrap:anywhere] text-[11px] opacity-60">{place(a.city, a.country)}{a.isp ? ` · ${a.isp}` : ""}{a.vpn ? " · data centre or VPN" : ""}</p>
                  <p className="text-[10px] opacity-45">{number(a.hits)} actions · {exact(a.first)} to {exact(a.last)}</p>
                </div>
                {data.class !== "ours" && <button onClick={() => { setBlocking(blocking === a.ip ? null : a.ip); setReason(""); }}
                  className="ow-field shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-extrabold text-red-500">Block</button>}
              </div>
              {blocking === a.ip && (
                <div className="mt-2 flex gap-1.5">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (required)"
                    className="ow-field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] outline-none"/>
                  <button disabled={busy || reason.trim().length < 3} onClick={() => void block(a.ip, true)}
                    className="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40">Block address</button>
                </div>
              )}
            </div>
          ))}
          {!data.addresses.length && <p className="py-2 text-xs opacity-50">No address was recorded for this visitor.</p>}
        </div>
        {data.devices.slice(0, 3).map((d, i) => <p key={i} className="mt-1 break-words text-[10px] opacity-45">{titleCase(d.device ?? "device")} — {d.agent}</p>)}
      </section>

      {/* WHAT THEY DID — one block per visit, newest first, every step with its time */}
      {bySession.map((s) => (
        <section key={s.session_id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold">Visit · {exact(s.started)}</h3>
            <ChannelChip channel={s.channel} label={s.channel_label} detail={s.channel_detail}/>
          </div>
          <p className="text-[10px] opacity-45">{number(s.views)} pages · {span(s.seconds)} active · landed on {s.landed_on}</p>
          <ol className="mt-2 space-y-1.5 border-l border-ink/10 pl-3 dark:border-white/10">
            {s.events.slice().reverse().map((e, i) => (
              <li key={i} className="text-[11px]">
                <span className="mr-2 tabular-nums opacity-45">{clock(e.at)}</span>
                <span className="font-semibold">{eventWords(e)}</span>
                {e.event === "page_view" && <span className="opacity-70"> {e.page}</span>}
                {e.signed_in && <span className="ml-1 text-[9px] font-extrabold text-teal">signed in</span>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/* ── Sources ──────────────────────────────────────────────────────────────────────────────── */
function useAcquisition(isAdmin: boolean, hours: number, nonce: number) {
  const [error, setError] = useState("");
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_acquisition", { p_hours: hours, p_day: null });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as Acquisition;
  }, [isAdmin, hours, nonce], isAdmin);
  return { data, error };
}

function SourcesPanel({ isAdmin, hours, nonce, onOpenChannel, onOpenMember }: {
  isAdmin: boolean; hours: number; nonce: number;
  onOpenChannel: (channel: string, detail?: string | null) => void; onOpenMember: (id: string) => void;
}) {
  const acq = useAcquisition(isAdmin, hours, nonce);
  const nav = useNav();
  const aud = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_audience", { p_hours: hours, p_class: "human", p_limit: 1 });
    return rpcError ? undefined : result as unknown as Audience;
  }, [isAdmin, hours, nonce], isAdmin);
  if (acq.error) return <Problem what="Sources aren’t available." detail={`${acq.error} — it needs ADMIN30 overlay 7's database part.`}/>;
  if (!acq.data || !aud) return <div className="space-y-2"><div className="card h-56 animate-pulse"/><div className="card h-40 animate-pulse"/></div>;

  const rows = [...aud.channels].sort((a, b) => CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel));
  const totalV = aud.classes.human.visitors;
  return (
    <div className="space-y-3">
      <section className="card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-extrabold">Where real people came from</h3>
          <span className="text-[10px] font-bold opacity-45">{aud.window.label}</span>
        </div>
        <p className="mt-0.5 text-[10px] opacity-45">Tap a source to see the people. Conversion = signed up ÷ visited. Us and bots are left out.</p>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-0 text-[11px]">
          <span className="pb-1 font-bold uppercase tracking-wide opacity-40">Source</span>
          <span className="pb-1 text-right font-bold uppercase tracking-wide opacity-40">Visited</span>
          <span className="pb-1 text-right font-bold uppercase tracking-wide opacity-40">Joined</span>
          <span className="pb-1 text-right font-bold uppercase tracking-wide opacity-40">Rate</span>
          {rows.map((r) => [
            <button key={`${r.channel}-a`} onClick={() => onOpenChannel(r.channel)} className="col-span-4 grid grid-cols-subgrid items-center rounded-lg py-1.5 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">
              <span className="min-w-0"><ChannelChip channel={r.channel} label={r.label}/></span>
              <b className="text-right tabular-nums">{number(r.visitors)}</b>
              <b className="text-right tabular-nums">{number(r.signups)}</b>
              <span className="text-right tabular-nums opacity-70">{r.rate === null ? "—" : `${r.rate}%`}</span>
            </button>,
            ...r.details.map((d) => (
              <button key={`${r.channel}-${d.detail}`} onClick={() => onOpenChannel(r.channel, d.detail)}
                className="col-span-4 grid grid-cols-subgrid items-center rounded-lg py-1 pl-4 text-left text-[10px] transition hover:bg-ink/5 dark:hover:bg-white/10">
                <span className="[overflow-wrap:anywhere] opacity-70">{d.detail}</span>
                <span className="text-right tabular-nums">{number(d.visitors)}</span>
                <span className="text-right tabular-nums">{number(d.signups)}</span>
                <span className="text-right tabular-nums opacity-60">{d.visitors ? `${Math.round((d.signups / d.visitors) * 1000) / 10}%` : "—"}</span>
              </button>
            )),
          ])}
        </div>
        {!rows.length && <p className="py-5 text-center text-xs opacity-45">No real visitor or sign-up in this window.</p>}
        <p className="mt-3 text-[10px] opacity-45">
          <button onClick={() => nav.audience({})} className="font-bold text-brand">{number(totalV)} real visitors</button>
          {" · "}<button onClick={() => nav.drill("signups", "Signed up")} className="font-bold text-brand">{number(aud.signups)} sign-ups</button>. {acq.data.tracking_note}</p>
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-extrabold">Who signed up · {acq.data.window.label}</h3>
        <div className="mt-2 divide-y divide-ink/10 dark:divide-white/10">
          {acq.data.signups.map((s) => (
            <button key={s.member_id} onClick={() => onOpenMember(s.member_id)} className="block w-full py-2.5 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 [overflow-wrap:anywhere] text-xs font-extrabold">{s.name ?? s.email ?? "Unnamed"}</p>
                <span className="shrink-0 text-[10px] tabular-nums opacity-55">{exact(s.signed_up_at)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <ChannelChip channel={s.channel} label={s.channel_label} detail={s.channel_detail}/>
                <Pill>For {productName(s.signed_up_for)}</Pill>
                <Pill tone={s.onboarded_at ? "bg-teal/15 text-teal" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}>{s.onboarded_at ? "Onboarded" : "Not onboarded"}</Pill>
                {s.listings > 0 && <Pill>{s.published}/{s.listings} listings live</Pill>}
              </div>
            </button>
          ))}
          {!acq.data.signups.length && <p className="py-5 text-center text-xs opacity-45">Nobody new signed up in this window. Test, sample and team accounts are not counted.</p>}
        </div>
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-extrabold">Promo codes</h3>
        <p className="mt-0.5 text-[10px] opacity-45">Uses are counted at checkout. Visits arriving with a code in the link show under Sources → Promo code.</p>
        <div className="mt-2 divide-y divide-ink/10 dark:divide-white/10">
          {acq.data.promo_codes.map((p) => (
            <button key={p.code} onClick={() => nav.audience({ group: "visitor", channel: "promo", detail: p.code })}
              className="flex w-full items-center justify-between gap-2 py-2 text-left text-[11px] transition hover:bg-ink/5 dark:hover:bg-white/10">
              <div className="min-w-0">
                <p className="[overflow-wrap:anywhere] font-extrabold tabular-nums">{p.code} <span className="font-semibold opacity-55">{p.label ?? ""}</span></p>
                <p className="opacity-55">{p.kind === "percent_off" ? `${p.value}% off` : p.kind ?? ""}{p.expires_at ? ` · ends ${exact(p.expires_at)}` : ""}{p.rotates ? " · rotates" : ""}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-black tabular-nums">{number(p.uses ?? 0)}{p.max_uses ? ` / ${p.max_uses}` : ""}</p>
                <p className={`text-[10px] font-bold ${p.active ? "text-teal" : "opacity-45"}`}>{p.active ? "Active" : "Off"}</p>
              </div>
            </button>
          ))}
          {!acq.data.promo_codes.length && <p className="py-4 text-center text-xs opacity-45">No promo codes exist.</p>}
        </div>
      </section>
    </div>
  );
}

/* ── Videos ───────────────────────────────────────────────────────────────────────────────── */
function VideosPanel({ isAdmin, hours, nonce, onOpenVideo }: {
  isAdmin: boolean; hours: number; nonce: number; onOpenVideo: (slug: string) => void;
}) {
  const acq = useAcquisition(isAdmin, hours, nonce);
  if (acq.error) return <Problem what="Video numbers aren’t available." detail={`${acq.error} — it needs ADMIN30 overlay 7's database part.`}/>;
  if (!acq.data) return <div className="grid gap-2 md:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-40 animate-pulse"/>)}</div>;
  const anyTracked = acq.data.videos.some((v) => v.first_tracked);
  return (
    <div className="space-y-3">
      {!anyTracked && <p className="card px-4 py-3 text-[11px] opacity-70">
        View, play and tap counts start the day the video pages carry the tracker (ADMIN30 overlay 7). Sign-ups from each video are already counted — they kept their source.
      </p>}
      <div className="grid gap-2 md:grid-cols-2">
        {acq.data.videos.map((v) => {
          const steps: Array<[string, number]> = [["Viewed page", v.viewers], ["Pressed play", v.plays], ["Watched half", v.halfway],
            ["Finished", v.finished], ["Tapped create profile", v.tapped], ["Reached sign-up", v.reached_join], ["Signed up", v.signups]];
          const top = Math.max(1, ...steps.map(([, n]) => n));
          return (
            <button key={v.slug} onClick={() => onOpenVideo(v.slug)} className="card block p-4 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-extrabold">{v.slug} <span className="text-xs font-semibold opacity-55">{v.title}</span></p>
                <span className="text-[10px] font-bold opacity-45">{acq.data!.window.label}</span>
              </div>
              <div className="mt-3 space-y-1.5">
                {steps.map(([label, n]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-[10px]"><span className="opacity-65">{label}</span><b className="tabular-nums">{number(n)}</b></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${n ? Math.max(4, (n / top) * 100) : 0}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] opacity-55">All time: {number(v.signups_all_time)} signed up · {number(v.listed_all_time)} listed a property</p>
              <p className="mt-1 text-[10px] font-extrabold text-brand">See the people from {v.slug} →</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Bots and protection ──────────────────────────────────────────────────────────────────── */
const VERDICT_WORDS: Record<BotRow["verdict"], [string, string]> = {
  wanted: ["Search engine — wanted", "bg-teal/15 text-teal"],
  preview: ["Link preview — harmless", "bg-sky-500/15 text-sky-700 dark:text-sky-300"],
  ours: ["Our own tests", "bg-ink/5 dark:bg-white/10"],
  blocked: ["Blocked on sight", "bg-red-500/10 text-red-500"],
  unknown: ["Unknown — watching", "bg-amber-500/15 text-amber-700 dark:text-amber-300"],
};
function BotsPanel({ isAdmin, hours, nonce }: { isAdmin: boolean; hours: number; nonce: number }) {
  const nav = useNav();
  const [reload, setReload] = useState(0);
  const [ip, setIp] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_bot_shield", { p_hours: hours });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as BotShield;
  }, [isAdmin, hours, nonce, reload], isAdmin);
  /* Bot VISITORS come from the same count as the Visitors tab. Summing the per-bot rows counted a
     browser twice when it showed up under two bot names. */
  const classes = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_audience", { p_hours: hours, p_class: "bot", p_limit: 1 });
    return rpcError ? undefined : (result as unknown as Audience).classes;
  }, [isAdmin, hours, nonce], isAdmin);

  async function setBlock(address: string, on: boolean, reason: string | null) {
    setBusy(true); setNote("");
    const { error: rpcError } = await supabase.rpc("admin_set_ip_block", { p_ip: address, p_block: on, p_reason: reason, p_hours: null });
    setBusy(false);
    if (rpcError) { setNote(rpcError.message); return; }
    setNote(on ? `${address} is blocked.` : `${address} is unblocked.`); setIp(""); setWhy(""); setReload((n) => n + 1);
  }

  if (error) return <Problem what="Bot numbers aren’t available." detail={`${error} — it needs ADMIN30 overlay 7's database part.`}/>;
  if (!data) return <div className="space-y-2"><div className="card h-32 animate-pulse"/><div className="card h-56 animate-pulse"/></div>;
  const botVisitors = classes?.bot.visitors ?? data.bots.reduce((t, b) => t + b.visitors, 0);
  const cap = data.captcha;
  const capTotal = Object.values(cap).reduce((t, n) => t + n, 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard label="Real visitors" value={data.humans} note={data.window.label} accent="brand"
          onOpen={() => nav.audience({})} openLabel="See who"/>
        <MetricCard label="Bot visitors" value={botVisitors} note={data.window.label} accent="amber"
          onOpen={() => nav.audience({ cls: "bot" })} openLabel="See them"/>
        <MetricCard label="Blocked now" value={data.blocked_now} note={`${number(data.blocked_new)} new in ${data.window.label}`} accent="sky"
          onOpen={() => nav.drill("blocked_ips_active", "Blocked addresses")} openLabel="See them"/>
        <MetricCard label="Blocked attempts" value={data.attempts} note={`refused in ${data.window.label}`} accent="sky"
          onOpen={() => nav.drill("blocked_attempts_window", "Blocked attempts")} openLabel="See them"/>
      </div>

      <section className="card p-4">
        <h3 className="text-sm font-extrabold">Every bot that came</h3>
        <div className="mt-2 divide-y divide-ink/10 dark:divide-white/10">
          {data.bots.map((b) => {
            const [label, tone] = VERDICT_WORDS[b.verdict];
            return (
              <div key={b.name} className="py-2.5">
                <button onClick={() => nav.audience({ cls: b.verdict === "ours" ? "ours" : "all", group: "address", search: b.name })}
                  className="flex w-full items-center justify-between gap-2 text-left">
                  <p className="min-w-0 [overflow-wrap:anywhere] text-xs font-extrabold">{b.name} <span className="text-brand">→</span></p>
                  <b className="shrink-0 text-xs tabular-nums">{number(b.hits)} hits</b>
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1"><Pill tone={tone}>{label}</Pill>
                  <span className="text-[10px] opacity-50">{plural(b.visitors, "visitor")} · {plural(b.addresses, "address", "addresses")} · last {when(b.last_seen)}</span></div>
                {!!b.sample_ips?.length && <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] tabular-nums">
                  {b.sample_ips.map((sample) => <button key={sample} onClick={() => nav.address(sample)} className="opacity-55 hover:text-brand hover:opacity-100">{sample}</button>)}
                </div>}
              </div>
            );
          })}
          {!data.bots.length && <p className="py-5 text-center text-xs opacity-45">No bot in this window.</p>}
        </div>
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-extrabold">Sign-in security check (Cloudflare Turnstile)</h3>
        {capTotal === 0
          ? <p className="mt-1 text-[11px] opacity-60">No sign-in attempt has reported a result yet in this window. Results are recorded from ADMIN30 overlay 7 on.</p>
          : <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              {([["ok", "Passed"], ["error", "Failed"], ["expired", "Expired"], ["unavailable", "Blocked by browser"]] as Array<[string, string]>).map(([k, l]) => (
                <div key={k}><p className="text-lg font-black tabular-nums">{number(cap[k] ?? 0)}</p><p className="text-[10px] font-bold opacity-55">{l}</p></div>
              ))}
            </div>}
        <ul className="mt-3 space-y-1.5 text-[11px] opacity-70">
          <li>{data.protection.turnstile}</li><li>{data.protection.collector}</li><li>{data.protection.site}</li>
        </ul>
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-extrabold">Blocked addresses</h3>
        <div className="mt-2 flex gap-1.5">
          <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="Address to block" aria-label="Address to block"
            className="ow-field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] outline-none"/>
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why" aria-label="Why"
            className="ow-field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] outline-none"/>
          <button disabled={busy || !ip.trim() || why.trim().length < 3} onClick={() => void setBlock(ip.trim(), true, why.trim())}
            className="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40">Block</button>
        </div>
        {note && <p className="mt-2 text-[11px] font-bold text-brand">{note}</p>}
        <div className="mt-2 divide-y divide-ink/10 dark:divide-white/10">
          {data.blocked.map((b) => (
            <div key={b.ip} className="flex items-center justify-between gap-2 py-2 text-[11px]">
              <div className="min-w-0">
                <button onClick={() => nav.address(b.ip)} className="[overflow-wrap:anywhere] font-extrabold tabular-nums text-brand">{b.ip} <span className="font-semibold text-ink opacity-55 dark:text-white">{b.bot ?? ""}</span></button>
                <p className="[overflow-wrap:anywhere] opacity-55">{titleCase(b.reason ?? "blocked")} · {number(b.attempts ?? 0)} attempts · {b.active ? (b.expires_at ? `until ${exact(b.expires_at)}` : "permanent") : "expired"}</p>
              </div>
              {b.active && <button disabled={busy} onClick={() => void setBlock(b.ip, false, null)}
                className="ow-field shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-extrabold">Unblock</button>}
            </div>
          ))}
          {!data.blocked.length && <p className="py-4 text-center text-xs opacity-45">Nothing is blocked. Scrapers are blocked automatically the first time they show up.</p>}
        </div>
      </section>
    </div>
  );
}

/* ── The Overview trend: real people and sign-ups, in the window you picked ──────────────────
   It used to plot a fixed 30 days whatever window was chosen, and its legend said "Bots 0"
   while 150 bots were on record. Now it reads the same aggregate as the Visitors tab. A bar is
   an hour in short windows and a Central-time day in long ones; tapping a day opens that day. */
function AudienceTrend({ isAdmin, hours, nonce, onOpenDay, onOpenVisitors }: {
  isAdmin: boolean; hours: number; nonce: number; onOpenDay: (day: string) => void; onOpenVisitors: (cls: Cls) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_audience", { p_hours: hours, p_class: "human", p_limit: 1 });
    return rpcError ? undefined : result as unknown as Audience;
  }, [isAdmin, hours, nonce], isAdmin);
  if (!data) return <section className="card h-44 animate-pulse"/>;
  const pts = data.series;
  const top = Math.max(1, ...pts.map((p) => p.visitors));
  const shown = hover !== null ? pts[hover] : null;
  const label = (t: string) => data.window.hourly
    ? new Date(t).toLocaleString("en-US", { timeZone: CT, weekday: "short", hour: "numeric" })
    : new Date(t).toLocaleDateString("en-US", { timeZone: CT, month: "short", day: "numeric" });
  const dayOf = (t: string) => new Date(t).toLocaleDateString("en-CA", { timeZone: CT });
  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-extrabold">Real visitors, {data.window.hourly ? "hour by hour" : "day by day"}</h3>
          <p className="[overflow-wrap:anywhere] text-xs opacity-45">{shown ? `${label(shown.t)}: ${shown.visitors} people · ${shown.signups} signed up` : `${data.window.label} · tap a ${data.window.hourly ? "bar to read it" : "day to open it"}`}</p>
        </div>
        <div className="shrink-0 text-right text-[10px] font-bold">
          <button onClick={() => onOpenVisitors("human")} className="block text-brand">{number(data.classes.human.visitors)} real</button>
          <button onClick={() => onOpenVisitors("ours")} className="block opacity-55 hover:opacity-100">{number(data.classes.ours.visitors)} us</button>
          <button onClick={() => onOpenVisitors("bot")} className="block opacity-55 hover:opacity-100">{number(data.classes.bot.visitors)} bots</button>
        </div>
      </div>
      {/* Lee, 5 Oct: "it should actually have the number too, on top of the bar" — every bar
          carries its count, so the chart reads without hovering and without a y-axis. */}
      <div className="mt-3 flex h-32 items-end gap-px" onPointerLeave={() => setHover(null)}>
        {pts.map((p, i) => (
          <button key={p.t} aria-label={`${label(p.t)}: ${p.visitors} people, ${p.signups} signed up`}
            onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)}
            onClick={() => (data.window.hourly ? setHover(i) : onOpenDay(dayOf(p.t)))}
            className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            {p.signups > 0 && <span className="mb-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden/>}
            {p.visitors > 0 && <span className={`mb-0.5 shrink-0 font-bold leading-none tabular-nums ${pts.length > 40 ? "text-[7px]" : "text-[9px]"} ${hover === i ? "" : "opacity-70"}`}>{p.visitors}</span>}
            <span className={`block w-full shrink-0 rounded-t bg-brand ${hover === i ? "" : "opacity-50"}`}
              style={{ height: `${p.visitors ? Math.max(4, (p.visitors / top) * 72) : 1}%` }}/>
          </button>
        ))}
      </div>
      {pts.length > 1 && <div className="mt-1 flex justify-between text-[10px] opacity-40"><span>{label(pts[0].t)}</span><span>{label(pts[pts.length - 1].t)}</span></div>}
      <p className="mt-1 text-[10px] opacity-40">Teal dot = someone signed up. Us and bots are not in the bars.</p>
    </section>
  );
}


/* ══ ADMIN30 overlay 9 ════════════════════════════════════════════════════════════════════════
   Lee, 3 Oct 2026: "I shouldn't see 19 boxes from the same IP address … show me, okay, it's this
   IP address, now show me all the activity from this IP address." And: "If I see a number 15, I
   should click it and it should tell me what the 15 are."

   Three pieces live here:
   · Visitors grouped BY ADDRESS (default) or BY NETWORK — one card per internet address, one
     line per provider + city — with the old one-card-per-browser view one tap away.
   · One address, end to end: who used it, every step, its neighbourhood, block / unblock.
   · DrillPanel: the list behind any number. Every metric key maps to a branch of the server's
     admin_drill, which copies the WHERE clause of the figure it explains (63 of 63 match).
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
type Nav = {
  drill: (metric: string, label: string, arg?: string | null) => void;
  audience: (q: Partial<AudienceQuery>) => void;
  address: (ip: string) => void;
  visitor: (id: string) => void;
  member: (id: string) => void;
  goto: Goto;
  places: (by: PlaceBy) => void;
};
const NavContext = createContext<Nav | null>(null);
function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("AdminScreen navigation is missing");
  return nav;
}

type AddressRow = {
  ip: string; cls: Exclude<Cls, "all">; country: string | null; city: string | null; region?: string | null; isp: string | null; vpn: boolean;
  network: string | null; visitors: number; visits: number; views: number; pages: number; steps: number;
  first_seen: string; last_seen: string; landed_on: string | null; last_page: string | null; top_pages: string[];
  devices: string[]; bot_names: string[]; members: Array<{ id: string; name: string | null; internal: boolean }>;
  channel: string | null; channel_label: string | null; channel_detail: string | null; blocked: boolean;
};
type NetworkRow = { key: string; isp: string; city: string | null; country: string | null; addresses: number; visitors: number;
                    views: number; blocked: number; last_seen: string; kinds: { human: number; ours: number; bot: number } };
type Addresses = { window: { label: string }; classes: { human: number; ours: number; bot: number }; not_recorded: number;
                   total_rows: number; networks: NetworkRow[]; rows: AddressRow[] };
type AddressDetail = {
  ip: string; class: Exclude<Cls, "all">; ours_range: boolean; used_by_us: boolean; country: string | null; city: string | null;
  isp: string | null; vpn: boolean; network: string | null; first_seen: string; last_seen: string; total_steps: number;
  region?: string | null; total_views?: number; total_seconds?: number;
  blocked_now: boolean;
  block: null | { reason: string | null; since: string; until: string | null; offences: number | null; attempts: number | null; active: boolean };
  network_block: null | { cidr: string; reason: string; since: string; until: string | null; addresses: number; auto: boolean };
  attempts: Array<{ at: string; page: string | null; bot: string | null }>;
  people: Array<{ visitor_id: string; first_seen: string; last_seen: string; views: number; visits: number; bot: boolean;
                  bot_name: string | null; device: string | null; agent: string | null; member_id: string | null;
                  member_name: string | null; internal: boolean; pages?: number; seconds?: number; screen?: string | null }>;
  sessions: Array<{ session_id: string; visitor_id: string; started: string; ended: string; views: number; landed_on: string;
                    channel: string; channel_label: string; channel_detail: string | null }>;
  events: Array<{ at: string; event: string; page: string; session_id: string; visitor_id: string; signed_in: boolean;
                  detail: Record<string, unknown> | null }>;
  neighbours: Array<{ ip: string; steps: number; last_seen: string; blocked: boolean }>;
};
type DrillRow = { title: string; sub?: string | null; at?: string | null; amount?: number | null; currency?: string | null;
                  status?: string | null; member_id?: string | null; link?: string | null };
type DrillResult = { metric: string; window: { start: string; label: string }; total: number;
                     sums: Array<{ currency: string; amount: number; count: number }>; rows: DrillRow[] };
type DrillTarget = { metric: string; label: string; arg: string | null; days: number; hours: number | null };
type PlaceBy = "page" | "country" | "city" | "device";

const CLASS_TONE: Record<Exclude<Cls, "all">, string> = {
  human: "bg-teal/15 text-teal", ours: "bg-ink/5 dark:bg-white/10", bot: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};
const GROUPS: Array<[AudienceGroup, string]> = [["visitor", "By visitor"], ["address", "By address"], ["network", "By network"]];

/* The three ways to read the same visitors. Each is one tap from the others and keeps the filters. */
function GroupSwitch({ query, onQuery }: { query: AudienceQuery; onQuery: (q: AudienceQuery) => void }) {
  return (
    <div className="ow-rail grid grid-cols-3 gap-1 rounded-2xl p-1" role="tablist" aria-label="Group visitors">
      {GROUPS.map(([key, label]) => (
        <button key={key} role="tab" aria-selected={query.group === key} onClick={() => onQuery({ ...query, group: key })}
          className={`rounded-xl px-2 py-1.5 text-[11px] font-extrabold transition ${query.group === key ? "ow-chip-on text-brand" : "opacity-55 hover:opacity-100"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* Filters that came from a tap elsewhere (a country, a page, a network), each removable. */
function ActiveFilters({ query, onQuery }: { query: AudienceQuery; onQuery: (q: AudienceQuery) => void }) {
  const chips: Array<[keyof AudienceQuery, string]> = [];
  if (query.network) chips.push(["network", query.network]);
  if (query.country) chips.push(["country", country(query.country)]);
  if (query.city) chips.push(["city", query.city]);
  if (query.device) chips.push(["device", titleCase(query.device)]);
  if (query.page) chips.push(["page", query.page]);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 text-[11px]">
      <span className="opacity-45">Only</span>
      {chips.map(([key, label]) => (
        <button key={key} onClick={() => onQuery({ ...query, [key]: null })}
          className="max-w-full [overflow-wrap:anywhere] rounded-full bg-ink/5 px-2 py-0.5 font-extrabold text-brand dark:bg-white/10">{label} ✕</button>
      ))}
    </div>
  );
}

/* ── Visitors by address / by network ───────────────────────────────────────────────────── */
function AddressesPanel({ isAdmin, hours, query, onQuery, nonce }: {
  isAdmin: boolean; hours: number; query: AudienceQuery; onQuery: (q: AudienceQuery) => void; nonce: number;
}) {
  const nav = useNav();
  const [draft, setDraft] = useState(query.search);
  const [limit, setLimit] = useState(40);
  const [error, setError] = useState("");
  useEffect(() => { const t = setTimeout(() => { if (draft.trim() !== query.search) onQuery({ ...query, search: draft.trim() }); }, 300); return () => clearTimeout(t); }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLimit(40); }, [hours, query.cls, query.search, query.day, query.network, query.country, query.city, query.device, query.page]);

  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_addresses", {
      p_hours: hours, p_class: query.cls, p_search: query.search || null, p_day: query.day,
      p_network: query.network, p_country: query.country, p_city: query.city, p_device: query.device, p_page: query.page,
      p_channel: null, p_limit: limit, p_offset: 0,
    });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as Addresses;
  }, [isAdmin, hours, query.cls, query.search, query.day, query.network, query.country, query.city, query.device, query.page, limit, nonce], isAdmin);

  if (error) return <div className="space-y-3"><GroupSwitch query={query} onQuery={onQuery}/>
    <Problem what="The address list isn’t available." detail={`${error} — it needs ADMIN30 overlay 9's database part.`}/></div>;
  if (!data) return <div className="space-y-2"><GroupSwitch query={query} onQuery={onQuery}/>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-24 animate-pulse"/>)}</div>;

  const c = data.classes;
  const classes: Array<[Cls, string, number]> = [
    ["human", "Real addresses", c.human], ["ours", "Our addresses", c.ours], ["bot", "Bot addresses", c.bot], ["all", "All addresses", c.human + c.ours + c.bot],
  ];
  const byNetwork = query.group === "network";

  return (
    <div className="space-y-3">
      <GroupSwitch query={query} onQuery={onQuery}/>
      {query.day && (
        <div className="card flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
          <span><b>{data.window.label}</b> only (Central time)</span>
          <button onClick={() => onQuery({ ...query, day: null })} className="font-extrabold text-brand">Show the whole window</button>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Kind of address">
        {classes.map(([key, label, n]) => (
          <button key={key} role="tab" aria-selected={query.cls === key} onClick={() => onQuery({ ...query, cls: key })}
            className={`card px-2 py-2.5 text-center transition ${query.cls === key ? "ring-2 ring-teal" : "opacity-75 hover:opacity-100"}`}>
            <p className="text-lg font-black tabular-nums leading-none">{number(n)}</p>
            <p className="mt-1 [overflow-wrap:anywhere] text-[10px] font-extrabold opacity-60">{label}</p>
          </button>
        ))}
      </div>
      <p className="px-1 text-[11px] opacity-60">
        {byNetwork
          ? `${plural(data.networks.length, "network")} · ${plural(data.total_rows, "address", "addresses")} in the ${data.window.label}. A network is one internet provider in one city.`
          : `${plural(data.total_rows, "address", "addresses")} in the ${data.window.label}. An address is one internet connection (a home Wi-Fi, a phone's data line), so one address can hold several people. The visitor count is under "By visitor" above.`}
      </p>
      <ActiveFilters query={query} onQuery={onQuery}/>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search an address, provider, city, name, page or bot"
        aria-label="Search addresses" className="ow-field w-full rounded-xl px-3 py-2 text-xs outline-none"/>

      {byNetwork ? (
        <div className="grid gap-2 md:grid-cols-2">
          {data.networks.map((n) => (
            <button key={n.key} onClick={() => onQuery({ ...query, group: "address", network: n.key })}
              className="card relative block overflow-hidden p-4 pl-5 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">
              <span className={`absolute inset-y-0 left-0 w-1 ${n.kinds.bot ? "bg-amber-500" : n.kinds.ours === n.addresses ? "bg-ink/20 dark:bg-white/20" : "bg-brand"}`} aria-hidden/>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="[overflow-wrap:anywhere] text-sm font-extrabold">{n.isp}</p>
                  <p className="[overflow-wrap:anywhere] text-[11px] opacity-55">{place(n.city, country(n.country) || null)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-black leading-none tabular-nums">{number(n.addresses)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wide opacity-40">{n.addresses === 1 ? "address" : "addresses"}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {n.kinds.human > 0 && <Pill tone={CLASS_TONE.human}>{number(n.kinds.human)} real</Pill>}
                {n.kinds.ours > 0 && <Pill tone={CLASS_TONE.ours}>{n.kinds.ours === n.addresses ? "All ours" : `${number(n.kinds.ours)} ours`}</Pill>}
                {n.kinds.bot > 0 && <Pill tone={CLASS_TONE.bot}>{plural(n.kinds.bot, "bot")}</Pill>}
                {n.blocked > 0 && <Pill tone="bg-red-500/10 text-red-500">{number(n.blocked)} blocked</Pill>}
              </div>
              <p className="mt-2 text-[10px] opacity-50">{plural(n.visitors, "browser")} · {plural(n.views, "page")} seen · last {when(n.last_seen)}</p>
              <p className="mt-2 text-[10px] font-extrabold text-brand">See these addresses →</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {data.rows.map((row) => <AddressCard key={row.ip} row={row} onOpen={() => nav.address(row.ip)}/>)}
        </div>
      )}
      {!byNetwork && !data.rows.length && <EmptySource what="No address here"
        why={query.search || query.network || query.country || query.city || query.device || query.page
          ? "No address in this window matches. Clear the filter or the search, or widen the window."
          : `No ${query.cls === "human" ? "real person’s" : query.cls === "bot" ? "bot" : ""} address in the ${data.window.label}. Widen the window above.`}/>}
      {!byNetwork && data.rows.length < data.total_rows && (
        <button onClick={() => setLimit((n) => Math.min(200, n + 40))}
          className="w-full rounded-xl border ow-edge py-2 text-[11px] font-extrabold text-brand transition hover:bg-ink/5 dark:hover:bg-white/10">
          Show more ({number(data.total_rows - data.rows.length)} left)
        </button>
      )}
      {data.not_recorded > 0 && (
        <button onClick={() => onQuery({ ...query, group: "visitor" })} className="card block w-full px-4 py-3 text-left text-[11px] transition hover:bg-ink/5 dark:hover:bg-white/10">
          <span className="opacity-70">{plural(data.not_recorded, "browser")} in this window came before addresses were recorded (23 Sep), so they have no address to group by. </span>
          <span className="font-extrabold text-brand">See them by browser →</span>
        </button>
      )}
      <p className="text-center text-[10px] opacity-40">Times are US Central.</p>
    </div>
  );
}

/* "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 …) … Instagram 370" → "Instagram app on an iPhone".
   Lee, 5 Oct: "I'm trying to figure out who is this visitor" — the device is the best clue an
   anonymous visit carries, so it is spelled out in words. */
function describeAgent(agent: string | null | undefined): string {
  const a = agent ?? "";
  if (!a) return "Unknown device";
  const model = a.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/)?.[1]?.trim();
  const os = /iPhone/.test(a) ? "an iPhone" : /iPad/.test(a) ? "an iPad"
    : /Android/.test(a) ? (model && model !== "K" ? `an Android phone (${model})` : "an Android phone")
    : /Windows/.test(a) ? "a Windows computer" : /Macintosh|Mac OS X/.test(a) ? "a Mac" : /Linux/.test(a) ? "a Linux computer" : "a device";
  const app = /Instagram/.test(a) ? "Instagram app" : /FBAN|FBAV/.test(a) ? "Facebook app" : /WhatsApp/.test(a) ? "WhatsApp"
    : /EdgA?\//.test(a) ? "Edge" : /SamsungBrowser/.test(a) ? "Samsung Internet" : /CriOS|Chrome\//.test(a) ? "Chrome"
    : /FxiOS|Firefox\//.test(a) ? "Firefox" : /Safari\//.test(a) ? "Safari" : "a browser";
  return `${app} on ${os}`;
}
const timeOnPage = (events: Array<{ at: string; event: string }>, i: number) => {
  /* events are oldest first here; time on a page = until the next step in the same visit. */
  const next = events[i + 1];
  if (!next) return null;
  const s = (new Date(next.at).getTime() - new Date(events[i].at).getTime()) / 1000;
  return s > 0 && s < 1800 ? span(Math.round(s)) : null;
};

function AddressCard({ row, onOpen }: { row: AddressRow; onOpen: () => void }) {
  const real = row.members.filter((m) => !m.internal);
  return (
    <button onClick={onOpen} className="card relative block w-full overflow-hidden p-4 pl-5 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">
      <span className={`absolute inset-y-0 left-0 w-1 ${row.blocked ? "bg-red-500" : real.length ? "bg-violet-500" : row.cls === "bot" ? "bg-amber-500" : row.cls === "ours" ? "bg-ink/20 dark:bg-white/20" : "bg-brand"}`} aria-hidden/>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="[overflow-wrap:anywhere] text-sm font-extrabold tabular-nums">{row.ip}</p>
          <p className="[overflow-wrap:anywhere] text-[11px] opacity-55">{place(row.city, country(row.country) || null, row.region)}{row.isp ? ` · ${row.isp}` : ""}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-black leading-none tabular-nums">{number(row.views)}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide opacity-40">pages seen</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Pill tone={CLASS_TONE[row.cls]}>{CLASS_LABEL[row.cls]}</Pill>
        {real.map((m) => <Pill key={m.id} tone="bg-violet-500/15 text-violet-700 dark:text-violet-300">{m.name ?? "Member"}</Pill>)}
        {row.cls === "bot" && row.bot_names.slice(0, 2).map((b) => <Pill key={b} tone={CLASS_TONE.bot}>{b}</Pill>)}
        {row.cls !== "bot" && row.channel && row.channel_label && <ChannelChip channel={row.channel} label={row.channel_label} detail={row.channel_detail}/>}
        {row.vpn && row.cls !== "ours" && <Pill tone="bg-amber-500/15 text-amber-700 dark:text-amber-300">Data centre / VPN</Pill>}
        {row.blocked && <Pill tone="bg-red-500/10 text-red-500">Blocked</Pill>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <div><p className="font-bold uppercase tracking-wide opacity-40">First seen</p><p className="[overflow-wrap:anywhere] font-semibold">{exact(row.first_seen)}</p></div>
        <div><p className="font-bold uppercase tracking-wide opacity-40">Last seen</p><p className="[overflow-wrap:anywhere] font-semibold">{exact(row.last_seen)}</p></div>
        <div><p className="font-bold uppercase tracking-wide opacity-40">From it</p><p className="[overflow-wrap:anywhere] font-semibold">{plural(row.visitors, "browser")} · {plural(row.visits, "visit")}</p></div>
      </div>
      {!!row.top_pages.length && <p className="mt-2 [overflow-wrap:anywhere] text-[10px] opacity-45">Most seen: {row.top_pages.join(" · ")}</p>}
      <p className="mt-2 text-[10px] font-extrabold text-brand">See everything from this address →</p>
    </button>
  );
}

/* ── One address, end to end ─────────────────────────────────────────────────────────────── */
function AddressPanel({ ip, isAdmin }: { ip: string; isAdmin: boolean }) {
  const nav = useNav();
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"" | "address" | "network">("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_address_detail", { p_ip: ip });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as AddressDetail;
  }, [ip, reload, isAdmin], isAdmin);

  async function blockAddress(on: boolean) {
    setBusy(true); setNote("");
    const { error: rpcError } = await supabase.rpc("admin_set_ip_block", { p_ip: ip, p_block: on, p_reason: on ? reason.trim() : null, p_hours: null });
    setBusy(false);
    if (rpcError) { setNote(rpcError.message); return; }
    setMode(""); setReason(""); setNote(on ? `${ip} is blocked.` : `${ip} is unblocked.`); setReload((n) => n + 1);
  }
  async function blockNetwork(cidr: string, on: boolean) {
    setBusy(true); setNote("");
    const { error: rpcError } = await supabase.rpc("admin_set_network_block", { p_cidr: cidr, p_block: on, p_reason: on ? reason.trim() : null, p_hours: null });
    setBusy(false);
    if (rpcError) { setNote(rpcError.message); return; }
    setMode(""); setReason(""); setNote(on ? `Every address in ${cidr} is blocked.` : `${cidr} is unblocked.`); setReload((n) => n + 1);
  }

  if (error) return <Problem what="This address can’t be opened." detail={error}/>;
  if (!data) return <div className="space-y-2"><div className="card h-40 animate-pulse"/><div className="card h-64 animate-pulse"/></div>;

  const ours = data.class === "ours";
  const verdict = data.ours_range ? "Our own test browser — the Claude cloud browsers in San Francisco that run every check of the app."
    : data.used_by_us && data.class === "ours" ? "One of our own accounts signed in from this address in the last 30 days, so it counts as us."
    : data.class === "bot" ? `Not a person. Everything from this address was automated${data.people.some((p) => p.bot_name) ? `: ${[...new Set(data.people.map((p) => p.bot_name).filter(Boolean))].join(", ")}` : ""}.${data.people.some((p) => /Google/.test(p.bot_name ?? "")) ? " Google fetches pages to preview them or read them aloud; each fetch looks like a new browser." : ""}`
    : data.people.some((p) => p.member_id && !p.internal) ? "A real member used this address."
    : "A real person who has not signed up.";
  const labelOf = new Map(data.people.map((p, i) => [p.visitor_id, p.member_name ?? (p.bot ? (p.bot_name ?? "Automated") : `Visitor ${i + 1}`)]));
  const bySession = data.sessions.map((s) => ({ ...s, events: data.events.filter((e) => e.session_id === s.session_id) }));

  return (
    <div className="space-y-3">
      <section className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="[overflow-wrap:anywhere] text-base font-extrabold tabular-nums">{data.ip}</p>
            <p className="[overflow-wrap:anywhere] text-sm font-semibold">{place(data.city, country(data.country) || null, data.region)}</p>
            {data.isp && <p className="[overflow-wrap:anywhere] text-xs opacity-60">Internet provider: {data.isp}</p>}
          </div>
          <Pill tone={CLASS_TONE[data.class]}>{CLASS_LABEL[data.class]}</Pill>
        </div>
        <p className="mt-2 text-[11px] opacity-70">{verdict}{data.vpn && !ours ? " The address belongs to a data centre or VPN, not a home or phone line." : ""}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div><p className="font-bold uppercase tracking-wide opacity-40">First seen</p><p className="font-semibold">{exact(data.first_seen)}</p></div>
          <div><p className="font-bold uppercase tracking-wide opacity-40">Last seen</p><p className="font-semibold">{exact(data.last_seen)}</p></div>
          <div><p className="font-bold uppercase tracking-wide opacity-40">Time on site</p><p className="font-semibold">{span(data.total_seconds ?? 0)}</p></div>
        </div>
        <p className="mt-2 text-[11px] opacity-60">{plural(data.total_views ?? 0, "page")} viewed in {plural(data.sessions.length, "visit")}.</p>

        {/* Block state and the two blocking actions. Our own addresses can never be blocked. */}
        <div className="mt-3 rounded-xl bg-ink/5 p-3 text-[11px] dark:bg-white/5">
          {data.network_block
            ? <p><b className="text-red-500">Blocked with its neighbourhood</b> ({data.network_block.cidr}) — {titleCase(data.network_block.reason)}, {data.network_block.until ? `until ${exact(data.network_block.until)}` : "permanently"}.</p>
            : data.block?.active
            ? <p><b className="text-red-500">Blocked</b> — {titleCase(data.block.reason ?? "blocked")}, {data.block.until ? `until ${exact(data.block.until)}` : "permanently"} · offence {number(data.block.offences ?? 1)} · {plural(data.block.attempts ?? 0, "attempt")} refused.</p>
            : <p className="opacity-70">{ours ? "Never blocked: this is one of our own addresses." : data.block ? `Not blocked now. Blocked before (${plural(data.block.offences ?? 1, "time")}); a next offence gets a longer block.` : "Not blocked."}</p>}
          {!ours && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.block?.active
                ? <button disabled={busy} onClick={() => void blockAddress(false)} className="ow-field rounded-lg px-2.5 py-1 text-[10px] font-extrabold">Unblock address</button>
                : <button onClick={() => { setMode(mode === "address" ? "" : "address"); setReason(""); }} className="ow-field rounded-lg px-2.5 py-1 text-[10px] font-extrabold text-red-500">Block address</button>}
              {data.network && (data.network_block
                ? <button disabled={busy} onClick={() => void blockNetwork(data.network_block!.cidr, false)} className="ow-field rounded-lg px-2.5 py-1 text-[10px] font-extrabold">Unblock neighbourhood</button>
                : <button onClick={() => { setMode(mode === "network" ? "" : "network"); setReason(""); }} className="ow-field rounded-lg px-2.5 py-1 text-[10px] font-extrabold text-red-500">Block neighbourhood ({data.network})</button>)}
            </div>
          )}
          {mode && (
            <div className="mt-2 flex gap-1.5">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (required)"
                className="ow-field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] outline-none"/>
              <button disabled={busy || reason.trim().length < 3}
                onClick={() => void (mode === "address" ? blockAddress(true) : blockNetwork(data.network!, true))}
                className="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40">Block</button>
            </div>
          )}
          {note && <p className="mt-2 font-bold text-brand">{note}</p>}
        </div>
      </section>

      <section className="card p-4">
        {/* Lee, 5 Oct: "One person used five different browsers? I don't believe that." A browser is
            one app on one device; the same device can appear more than once (cookies cleared, or
            an in-app browser), so the devices are counted too. */}
        <h3 className="text-sm font-extrabold">Devices on this address</h3>
        <p className="mt-0.5 text-[11px] opacity-60">
          {(() => {
            const devices = new Set(data.people.map((p) => `${p.agent ?? ""}|${p.screen ?? ""}`)).size;
            return data.class === "bot"
              ? `${plural(data.people.length, "automated fetch", "automated fetches")}, not people.`
              : `${plural(devices, "device")} seen${data.people.length > devices ? ` (${plural(data.people.length, "browser session")}: the same device shows up again when it clears cookies or opens a link inside an app)` : ""}.`;
          })()}
        </p>
        <div className="mt-2 divide-y divide-ink/10 dark:divide-white/10">
          {data.people.map((p, i) => (
            <div key={p.visitor_id} className="flex items-start justify-between gap-2 py-2.5">
              <button onClick={() => nav.visitor(p.visitor_id)} className="min-w-0 flex-1 text-left">
                <p className="[overflow-wrap:anywhere] text-xs font-extrabold">{p.member_name ?? (p.bot ? (p.bot_name ?? "Automated") : `Visitor ${i + 1}`)}</p>
                <p className="[overflow-wrap:anywhere] text-[11px] opacity-75">{describeAgent(p.agent)}{p.screen ? ` · screen ${p.screen.replace("x", " × ")}` : ""}</p>
                <p className="[overflow-wrap:anywhere] text-[10px] opacity-55">{plural(p.visits, "visit")} · {plural(p.views, "page")} viewed · {span(p.seconds ?? 0)} on site · {exact(p.first_seen)} to {exact(p.last_seen)}</p>
              </button>
              {p.member_id && <button onClick={() => nav.member(p.member_id!)} className="ow-field shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold">Member</button>}
            </div>
          ))}
        </div>
      </section>

      {bySession.map((s) => (
        <section key={s.session_id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold">Visit · {exact(s.started)}</h3>
            <ChannelChip channel={s.channel} label={s.channel_label} detail={s.channel_detail}/>
          </div>
          <p className="[overflow-wrap:anywhere] text-[10px] opacity-55">{labelOf.get(s.visitor_id)} · {plural(s.views, "page")} · {span(s.events.slice().reverse().reduce((t, e, i, all) => { const n = all[i + 1]; const g = n ? (new Date(n.at).getTime() - new Date(e.at).getTime()) / 1000 : 0; return t + (g > 0 && g < 1800 ? g : 0); }, 0))} · landed on {s.landed_on}</p>
          <ol className="mt-2 space-y-1.5 border-l border-ink/10 pl-3 dark:border-white/10">
            {s.events.slice().reverse().map((e, i, all) => (
              <li key={i} className="[overflow-wrap:anywhere] text-[11px]">
                <span className="mr-2 tabular-nums opacity-45">{clock(e.at)}</span>
                <span className="font-semibold">{eventWords({ ...e, product: null, from: null, ip: null } as Journey["events"][number])}</span>
                {e.event === "page_view" && <span className="opacity-70"> {e.page}</span>}
                {timeOnPage(all, i) && <span className="opacity-45"> · {timeOnPage(all, i)}</span>}
                {e.signed_in && <span className="ml-1 text-[9px] font-extrabold text-teal">signed in</span>}
              </li>
            ))}
          </ol>
        </section>
      ))}

      {!!data.neighbours.length && (
        <section className="card p-4">
          <h3 className="text-sm font-extrabold">Same neighbourhood <span className="font-semibold opacity-50">· {data.network}</span></h3>
          <p className="mt-0.5 text-[10px] opacity-45">Other addresses in the same block of 256, last 30 days. A bot that switches address usually stays in its neighbourhood.</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {data.neighbours.map((n) => (
              <button key={n.ip} onClick={() => nav.address(n.ip)} className="ow-field flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px]">
                <span className="[overflow-wrap:anywhere] font-extrabold tabular-nums">{n.ip}</span>
                <span className="shrink-0 opacity-55">{n.blocked ? "blocked · " : ""}{plural(n.steps, "action")}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!!data.attempts.length && (
        <section className="card p-4">
          <h3 className="text-sm font-extrabold">Refused while blocked</h3>
          <div className="mt-2 space-y-1 text-[11px]">
            {data.attempts.map((a, i) => <p key={i}><span className="mr-2 tabular-nums opacity-45">{exact(a.at)}</span>{a.page ?? "—"}{a.bot ? <span className="opacity-55"> · {a.bot}</span> : null}</p>)}
          </div>
        </section>
      )}
      <p className="text-center text-[10px] opacity-40">Times are US Central.</p>
    </div>
  );
}

/* ── The list behind any number ──────────────────────────────────────────────────────────── */
const WINDOWED = new Set(["members_new", "signups", "onboarded_window", "product_actions_window", "emails_sent_window",
  "email_failures_window", "event_registrations_window", "payments_window", "captured_usd_window", "contracts_paid_window",
  "blocked_attempts_window", "funnel_onboarded", "funnel_activated", "funnel_transacted", "funnel_lost_signed_up",
  "funnel_lost_onboarded", "funnel_lost_activated"]);

function DrillPanel({ target, isAdmin }: { target: DrillTarget; isAdmin: boolean }) {
  const nav = useNav();
  const [limit, setLimit] = useState(60);
  const [error, setError] = useState("");
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_drill", {
      p_metric: target.metric, p_days: target.days, p_hours: target.hours, p_arg: target.arg, p_limit: limit, p_offset: 0,
    });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as DrillResult;
  }, [target.metric, target.arg, target.days, target.hours, limit, isAdmin], isAdmin);

  if (error) return <Problem what="This list isn’t available." detail={`${error} — it needs ADMIN30 overlay 9's database part.`}/>;
  if (!data) return <div className="space-y-2"><div className="card h-24 animate-pulse"/><div className="card h-64 animate-pulse"/></div>;

  function open(row: DrillRow) {
    if (row.link?.startsWith("address:")) return nav.address(row.link.slice(8));
    if (row.link?.startsWith("visitor:")) return nav.visitor(row.link.slice(8));
    if (row.member_id) return nav.member(row.member_id);
  }
  return (
    <div className="space-y-3">
      <section className="card relative overflow-hidden p-4 pl-5">
        <span className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden/>
        <p className="text-[10px] font-bold uppercase tracking-[.12em] opacity-45">{target.label}</p>
        <p className="mt-1 text-3xl font-black leading-none tabular-nums">{number(data.total)}</p>
        <p className="mt-1 text-[11px] opacity-50">{WINDOWED.has(target.metric) ? data.window.label : /_30d$/.test(target.metric) || target.metric === "active_30d" ? "last 30 days" : "all time, as of now"}</p>
        {!!data.sums.length && <p className="mt-1 text-[11px] font-semibold opacity-70">
          {data.sums.map((s) => `${/^(COP|CLP)$/.test(s.currency) ? number(Math.round(s.amount)) : money(s.amount)} ${s.currency}`).join(" · ")}
        </p>}
      </section>
      <div className="grid gap-2 md:grid-cols-2">
        {data.rows.map((row, i) => {
          const openable = !!(row.member_id || row.link);
          const body = <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="[overflow-wrap:anywhere] text-xs font-extrabold">{row.title}</p>
                {row.sub && <p className="[overflow-wrap:anywhere] text-[10px] opacity-55">{row.sub}</p>}
              </div>
              {row.amount !== undefined && row.amount !== null && <p className="shrink-0 text-xs font-black tabular-nums">
                {/^(COP|CLP)$/.test(row.currency ?? "") ? number(Math.round(Number(row.amount))) : money(row.amount)} <span className="text-[9px] opacity-50">{row.currency}</span></p>}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
              {row.status && !String(row.sub ?? "").toLowerCase().includes(String(row.status).toLowerCase())
                ? <Pill>{titleCase(String(row.status))}</Pill> : <span/>}
              <span className="tabular-nums opacity-50">{exact(row.at)}</span>
            </div>
          </>;
          return openable
            ? <button key={i} onClick={() => open(row)} className="card block p-3 text-left transition hover:bg-ink/5 dark:hover:bg-white/10">{body}</button>
            : <div key={i} className="card p-3">{body}</div>;
        })}
      </div>
      {!data.rows.length && <EmptySource what="Nothing here" why="The number is zero, so there is nothing to list."/>}
      {data.rows.length < data.total && (
        <button onClick={() => setLimit((n) => Math.min(500, n + 60))}
          className="w-full rounded-xl border ow-edge py-2 text-[11px] font-extrabold text-brand transition hover:bg-ink/5 dark:hover:bg-white/10">
          Show more ({number(data.total - data.rows.length)} left)
        </button>
      )}
      <p className="text-center text-[10px] opacity-40">Tap a row to open the member, address or visitor behind it. Times are US Central.</p>
    </div>
  );
}

/* ── Pages & places (replaces the old Traffic explorer) ──────────────────────────────────────
   The old explorer counted "human" as "not a bot", so our own test browsers filled it (Lee's
   3 Oct screenshot: nineteen San Francisco cards). This counts on the same address rule as the
   Visitors tab, and every row opens the addresses behind it. */
const PLACE_VIEWS: Array<[PlaceBy, string]> = [["page", "Pages"], ["country", "Countries"], ["city", "Cities"], ["device", "Devices"]];
type Breakdown2 = { window: { label: string }; by: PlaceBy; rows: Array<{ key: string; addresses: number; visitors: number; views: number; last_seen: string }> };

function PlacesPanel({ isAdmin, hours, by, onBy, nonce }: { isAdmin: boolean; hours: number; by: PlaceBy; onBy: (b: PlaceBy) => void; nonce: number }) {
  const nav = useNav();
  const [cls, setCls] = useState<Cls>("human");
  const [error, setError] = useState("");
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_breakdown", { p_hours: hours, p_by: by, p_class: cls, p_day: null });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as Breakdown2;
  }, [isAdmin, hours, by, cls, nonce], isAdmin);
  const max = Math.max(1, ...(data?.rows ?? []).map((r) => r.addresses));
  return (
    <div className="space-y-3">
      <div className="ow-rail scrollbar-none flex gap-1 overflow-x-auto rounded-2xl p-1" role="tablist" aria-label="Break down by">
        {PLACE_VIEWS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={by === key} onClick={() => onBy(key)}
            className={`shrink-0 grow rounded-xl px-3 py-1.5 text-[11px] font-extrabold transition ${by === key ? "ow-chip-on text-brand" : "opacity-55 hover:opacity-100"}`}>{label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {([["human", "Real people"], ["ours", "Us"], ["bot", "Bots"], ["all", "Everyone"]] as Array<[Cls, string]>).map(([key, label]) => (
          <button key={key} onClick={() => setCls(key)}
            className={`rounded-full px-3 py-1 text-[11px] font-extrabold transition ${cls === key ? "bg-brand text-white" : "ow-field"}`}>{label}</button>
        ))}
      </div>
      {error && <Problem what="Pages and places aren’t available." detail={`${error} — it needs ADMIN30 overlay 9's database part.`}/>}
      {!data && !error && <div className="card h-40 animate-pulse"/>}
      {data && (
        <section className="card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-extrabold">{PLACE_VIEWS.find(([k]) => k === by)?.[1]}</h3>
            <span className="text-[10px] font-bold opacity-45">{data.window.label}</span>
          </div>
          <p className="mt-0.5 text-[10px] opacity-45">Counted by internet address, on the same rule as Visitors. Tap a row to see the addresses.</p>
          <div className="mt-3 space-y-1">
            {data.rows.map((r) => (
              <button key={r.key} onClick={() => nav.audience({ group: "address", cls, [by]: r.key === "Not recorded" ? null : r.key })}
                disabled={r.key === "Not recorded"}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left transition hover:bg-ink/5 disabled:opacity-60 dark:hover:bg-white/10">
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{by === "country" ? country(r.key) : by === "device" ? titleCase(r.key) : r.key}</span>
                  <span className="shrink-0 tabular-nums"><b>{plural(r.addresses, "address", "addresses")}</b><span className="opacity-50"> · {plural(r.views, "view")}</span></span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (r.addresses / max) * 100)}%` }}/>
                </div>
              </button>
            ))}
            {!data.rows.length && <p className="py-5 text-center text-xs opacity-45">Nothing recorded in this window.</p>}
          </div>
        </section>
      )}
    </div>
  );
}


/* ══ Marketing → Posts (ADMIN30 overlays 9 + 10) ═══════════════════════════════════════════════
   Lee, 3 Oct 2026: "what post is going out, which one is queued … when did the post go … the
   sequence of posts coming next." And (via STUDIO): "I should be able to drag and drop to
   reprioritise, so I don't have to leave a message. The links need to be in the admin panel too,
   in case I want to send one to somebody."

   THE POSTING RULE, shared with the studio and the posting agent: the numbers 1..n are Lee's order.
   On any day the post that goes out is the highest one whose "not before" date has arrived and that
   he has cleared. A post with no date waits. A post can go out more than once.

   Lee changes the order (drag, or the arrows on a phone) and the dates here; the studio and the
   posting agent write everything else through marketing_upsert_post / marketing_log_post. */
type MarketingPost = {
  slug: string; app: string | null; title: string; series: string | null; audience: string | null; platform: string;
  account: string | null; languages: string[]; status: "planned" | "producing" | "ready" | "hold" | "scheduled" | "posting" | "posted" | "failed" | "killed";
  hold_reason: string | null; not_before: string | null; scheduled_for: string | null; position: number | null; priority: number | null;
  posted_at: string | null; post_url: string | null; caption: string | null; link: string | null; page_url: string | null;
  story_link: string | null; cover_url: string | null; video_url: string | null;
  posted_count: number; last_posted_at: string | null; post_urls: Array<{ at: string; url: string | null }>;
  duration_s: number | null; credits_spent: number | null; metrics: Record<string, Record<string, number>>; notes: string | null;
  updated_at: string; events: Array<{ at: string; kind: string; detail: Record<string, unknown>; actor: string | null }>;
};
type MarketingData = {
  today: string;
  counts: { posted: number; postings: number; posted_7d: number; queued: number; hold: number; producing: number; failed: number; killed: number };
  last_posted: null | { slug: string; title: string; at: string; url: string | null };
  next_up: null | { slug: string; title: string; status: string; when: string | null; hold_reason: string | null; position: number | null };
  posts: MarketingPost[];
};
const POST_STATUS: Record<MarketingPost["status"], [string, string]> = {
  posting:   ["Going out now", "bg-teal/15 text-teal"],
  scheduled: ["Scheduled", "bg-sky-500/15 text-sky-700 dark:text-sky-300"],
  ready:     ["Ready", "bg-teal/15 text-teal"],
  hold:      ["Waiting for your go", "bg-amber-500/15 text-amber-700 dark:text-amber-300"],
  producing: ["Being made", "bg-violet-500/15 text-violet-700 dark:text-violet-300"],
  planned:   ["Planned", "bg-ink/5 dark:bg-white/10"],
  posted:    ["Live", "bg-teal/15 text-teal"],
  failed:    ["Failed", "bg-red-500/10 text-red-500"],
  killed:    ["Dropped", "bg-ink/5 opacity-70 dark:bg-white/10"],
};
const POST_EVENT_WORDS: Record<string, string> = { added: "Added to the list", reordered: "Moved in your order", date_changed: "Date changed", metrics: "Numbers updated" };
type PostFilter = "all" | "queue" | "live" | "making" | "stopped";
const QUEUE_STATES = ["posting", "scheduled", "ready", "hold"];
/* A plain calendar date ("not before 6 Oct") must not drift a day in Central time. */
const day = (d: string | null) => d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { timeZone: CT, weekday: "short", month: "short", day: "numeric" }) : "—";
const METRIC_WORDS: Array<[string, string]> = [["views", "views"], ["likes", "likes"], ["shares", "shares"], ["saves", "saves"], ["follows", "follows"], ["link_clicks", "link taps"]];
/* The tag that tells Growth → Sources which share a visit came from: en5 for /v/agent/en5/, else the slug. */
const tagOf = (p: MarketingPost) => (p.story_link ?? "").match(/\/v\/agent\/([a-z0-9]+)/)?.[1] ?? p.slug.replace(/^\d{8}-/, "");
const withTag = (url: string, tag: string) => `${url}${url.includes("?") ? "&" : "?"}c=${tag}`;

function MarketingPanel({ isAdmin, nonce }: { isAdmin: boolean; nonce: number }) {
  const [filter, setFilter] = useState<PostFilter>("all");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState<MarketingData | null>(null);
  const fetched = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_marketing_posts");
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError(""); setSaved(null);
    return result as unknown as MarketingData;
  }, [isAdmin, nonce], isAdmin);
  const data = saved ?? fetched;

  /* Every change Lee makes returns the whole list, so the screen shows what the database now holds. */
  const save = async (fn: "admin_marketing_reorder" | "admin_marketing_set_date", args: Record<string, unknown>) => {
    setSaveError("");
    const { data: result, error: rpcError } = await supabase.rpc(fn as never, args as never);
    if (rpcError) { setSaveError(`Not saved: ${rpcError.message}`); return; }
    setSaved(result as unknown as MarketingData);
  };

  if (error) return <Problem what="The posting tracker isn’t available." detail={`${error} — it needs ADMIN30 overlay 10's database part.`}/>;
  if (!data) return <div className="space-y-2"><div className="card h-28 animate-pulse"/><div className="card h-64 animate-pulse"/></div>;

  const c = data.counts;
  const queue = data.posts.filter((p) => QUEUE_STATES.includes(p.status)).sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  const live = data.posts.filter((p) => p.status === "posted");
  const making = data.posts.filter((p) => p.status === "producing" || p.status === "planned");
  const stopped = data.posts.filter((p) => p.status === "failed" || p.status === "killed");
  const show = (f: PostFilter) => filter === "all" || filter === f;
  const pick = (f: PostFilter) => setFilter(filter === f ? "all" : f);
  const nxt = data.next_up;
  const setDate = (slug: string, d: string | null) => save("admin_marketing_set_date", { p_slug: slug, p_not_before: d });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard accent="pink" label="Live" value={c.posted} note={c.posted ? `${number(c.postings)} ${c.postings === 1 ? "posting" : "postings"} · ${number(c.posted_7d)} this week` : "Nothing posted yet"}
          onOpen={() => pick("live")} openLabel="See them"/>
        <MetricCard accent="pink" label="In the queue" value={c.queued + c.hold}
          note={c.hold ? `${number(c.hold)} waiting for your go` : c.queued ? "All cleared to post" : "Nothing queued"} attention={c.hold > 0}
          onOpen={() => pick("queue")} openLabel="See the order"/>
        <MetricCard accent="pink" label="Being made" value={c.producing} note="In the studio" onOpen={() => pick("making")} openLabel="See them"/>
        <MetricCard accent="pink" label="Dropped or failed" value={c.killed + c.failed} note={c.failed ? `${number(c.failed)} failed to post` : "None failed"}
          attention={c.failed > 0} onOpen={() => pick("stopped")} openLabel="See them"/>
      </div>

      {/* The one line that answers "what goes out next?" — by the posting rule, not just #1. */}
      <section className="card relative overflow-hidden p-4 pl-5">
        <span className="absolute inset-y-0 left-0 w-1 bg-pink-500" aria-hidden/>
        <p className="text-[10px] font-bold uppercase tracking-[.12em] opacity-45">Next to go out</p>
        {nxt ? <>
          <p className="mt-1 text-base font-extrabold">{nxt.title}</p>
          <p className="mt-0.5 text-[11px] opacity-60">
            {nxt.status === "scheduled" && nxt.when ? `Scheduled for ${exact(nxt.when)}` : nxt.when ? `Not before ${day(nxt.when.slice(0, 10))}` : "No date yet"}
            {nxt.position ? ` · #${nxt.position} in your order` : ""}
            {nxt.status === "hold" ? " · waiting for your go" : ""}
          </p>
        </> : <p className="mt-1 text-sm opacity-60">{queue.length ? "Nothing in the queue has a date yet. Give one a date below." : "Nothing is queued. The studio needs to make more."}</p>}
        {data.last_posted && <p className="mt-2 text-[11px] opacity-60">Last post: <b>{data.last_posted.title}</b>, {exact(data.last_posted.at)}</p>}
      </section>

      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {([["all", "Everything"], ["queue", `Queue · ${queue.length}`], ["live", `Live · ${live.length}`], ["making", `Being made · ${making.length}`], ["stopped", `Dropped · ${stopped.length}`]] as Array<[PostFilter, string]>).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold transition ${filter === key ? "bg-brand text-white" : "ow-field"}`}>{label}</button>
        ))}
      </div>
      {saveError && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-600 dark:text-red-300">{saveError}</p>}

      {show("queue") && <QueueSection posts={queue} setDate={setDate}
        onReorder={(slugs) => save("admin_marketing_reorder", { p_slugs: slugs })}/>}
      {show("live") && <PostSection title="Went live" posts={live} setDate={setDate}
        empty={queue.length ? `Nothing has been posted yet. The first post can go out ${nxt?.when ? `on ${day(nxt.when.slice(0, 10))}` : "once it has a date"}, after you say go.` : "Nothing has been posted yet."}/>}
      {show("making") && <PostSection title="Being made in the studio" posts={making} setDate={setDate} empty="Nothing is in production."/>}
      {show("stopped") && <PostSection title="Dropped or failed" posts={stopped} setDate={setDate} empty="Nothing dropped or failed."/>}
      <p className="px-1 text-[10px] opacity-40">Your order and dates save as you change them; the posting agent reads them before every post. The studio and the posting agent update everything else. Nothing posts without your go. Times are US Central.</p>
    </div>
  );
}

/* ══ Marketing → Posts, folders (ADMIN30 overlay 13) ══════════════════════════════════════════════
   Lee, 5 Oct 2026: "every particular video is four of them … Spanish and English, and then an
   Instagram version and the URL version … call it like a folder … click it … it expands into the
   four versions … label them … the thumbnail needs to be big enough … we don't need anything cut
   off … wrap the text."

   One folder per video (the English and Spanish rows share a slug, the Spanish one ends in -es).
   Each language has two versions:
   · the Instagram Reel, which goes in the feed and the Reels tab, where links can't be tapped;
   · the link page, which is what the Story link sticker, WhatsApp and Facebook point at.
   The cover fills the left of the card; the number and the ▲▼ arrows sit on top of it. */
type PostFamily = { key: string; posts: MarketingPost[] };
const familyKey = (p: MarketingPost) => p.slug.replace(/-(es|en)$/, "");
const langOf = (p: MarketingPost) => (/-es$/.test(p.slug) ? "es" : p.languages[0] ?? "en");
const LANG_NAME: Record<string, string> = { en: "English", es: "Spanish" };
function familiesOf(posts: MarketingPost[]): PostFamily[] {
  const groups = new Map<string, MarketingPost[]>();
  for (const p of posts) {
    const k = familyKey(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  /* English first, then Spanish, whatever order the queue had them in. */
  return [...groups.entries()].map(([key, ps]) => ({ key, posts: [...ps].sort((a, b) => (langOf(a) === "en" ? 0 : 1) - (langOf(b) === "en" ? 0 : 1)) }));
}
/* "Chase v2 (ES)" and "Chase v2 — Spanish" both become "Chase v2" for the folder name. */
const familyTitle = (f: PostFamily) => f.posts[0].title.replace(/\s*[(—–-]\s*(ES|EN|Spanish|English|Español)\)?\s*$/i, "");

/* The queue in Lee's order, one folder per video. Drag a folder (desktop) or use its arrows. */
function QueueSection({ posts, setDate, onReorder }: {
  posts: MarketingPost[]; setDate: (slug: string, d: string | null) => void; onReorder: (slugs: string[]) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const fams = familiesOf(posts);
  const keys = fams.map((f) => f.key);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= keys.length || from === to) return;
    const next = [...fams]; const [f] = next.splice(from, 1); next.splice(to, 0, f);
    onReorder(next.flatMap((x) => x.posts.map((p) => p.slug)));
    const dir = to < from ? "up" : "down";
    window.setTimeout(() => {
      const el = document.querySelector<HTMLButtonElement>(`[data-move="${f.key}-${dir}"]:not(:disabled)`)
        ?? document.querySelector<HTMLButtonElement>(`[data-move="${f.key}-${dir === "up" ? "down" : "up"}"]`);
      el?.focus();
    }, 400);
  };
  return (
    <section className="space-y-2">
      <div className="flex flex-col gap-0.5 px-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <h3 className="text-sm font-extrabold">Up next, in your order</h3>
        {fams.length > 1 && <p className="text-[11px] opacity-50">Drag a video, or use the arrows on its picture</p>}
      </div>
      {!fams.length && <p className="card px-4 py-3 text-[11px] opacity-60">Nothing is queued. Finished videos land here the moment the studio marks them ready.</p>}
      {fams.map((f, i) => (
        <div key={f.key} draggable
          onDragStart={(e) => { setDragging(f.key); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { if (dragging) { e.preventDefault(); setOver(f.key); } }}
          onDragLeave={() => setOver((o) => (o === f.key ? null : o))}
          onDrop={(e) => { e.preventDefault(); if (dragging) move(keys.indexOf(dragging), i); setDragging(null); setOver(null); }}
          onDragEnd={() => { setDragging(null); setOver(null); }}
          className={`rounded-2xl transition ${dragging === f.key ? "opacity-40" : ""} ${over === f.key && dragging !== f.key ? "ring-2 ring-pink-500" : ""}`}>
          <FamilyCard fam={f} setDate={setDate} rank={i + 1}
            mover={<>
              <button type="button" aria-label={`Move ${familyTitle(f)} up`} data-move={`${f.key}-up`} disabled={i === 0} onClick={() => move(i, i - 1)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-black/55 text-sm text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-30">▲</button>
              <button type="button" aria-label={`Move ${familyTitle(f)} down`} data-move={`${f.key}-down`} disabled={i === fams.length - 1} onClick={() => move(i, i + 1)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-black/55 text-sm text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-30">▼</button>
            </>}/>
        </div>
      ))}
    </section>
  );
}

function PostSection({ title, posts, empty, setDate }: {
  title: string; posts: MarketingPost[]; empty: string; setDate: (slug: string, d: string | null) => void;
}) {
  const fams = familiesOf(posts);
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-sm font-extrabold">{title}</h3>
      {!fams.length && <p className="card px-4 py-3 text-[11px] opacity-60">{empty}</p>}
      {fams.map((f) => <FamilyCard key={f.key} fam={f} setDate={setDate}/>)}
    </section>
  );
}

/* A link Lee can send to someone: the words, the whole link (wrapped, never cut off), then Copy. */
function LinkRow({ label, hint, url, copyable = true }: { label: string; hint?: string; url: string; copyable?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-bold uppercase tracking-wide opacity-45">{label}</p>
        {hint && <p className="opacity-55">{hint}</p>}
        <a href={safeUrl(url)} target="_blank" rel="noreferrer" className="block break-all text-brand underline-offset-2 hover:underline">{url.replace(/^https:\/\//, "")}</a>
      </div>
      {copyable && <button type="button" aria-label={`Copy ${label}`}
        onClick={async () => { try { await navigator.clipboard.writeText(url); } catch { return; } setDone(true); setTimeout(() => setDone(false), 1400); }}
        className={`ow-field shrink-0 rounded-lg px-3 py-2 text-[11px] font-extrabold ${done ? "text-teal" : ""}`}>{done ? "Copied" : "Copy"}</button>}
    </div>
  );
}

/* Only https links become clickable — a stored "javascript:" value can never run. */
const safeUrl = (u: string | null | undefined) => (u && /^https:\/\//.test(u) ? u : undefined);
/* Saves once, when the date is complete and sensible — not on every keystroke (a half-typed year
   like 0002 used to save and make a post due at once). The server checks the same range. */
function DateField({ value, onSave }: { value: string | null; onSave: (d: string) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const [bad, setBad] = useState(false);
  useEffect(() => { setDraft(value ?? ""); setBad(false); }, [value]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: CT });
  const commit = () => {
    if (!draft || draft === (value ?? "")) return;
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(draft) && draft >= today && draft <= new Date(Date.now() + 400 * 864e5).toISOString().slice(0, 10);
    setBad(!ok);
    if (ok) onSave(draft);
  };
  return <span className="inline-flex flex-wrap items-center gap-2">
    <input type="date" value={draft} min={today} aria-invalid={bad}
      onChange={(e) => { setDraft(e.target.value); setBad(false); }} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
      className={`ow-field rounded-lg px-2 py-1.5 text-[11px] ${bad ? "ring-2 ring-red-500" : ""}`}/>
    {bad && <span className="text-[11px] font-semibold text-red-600 dark:text-red-300">Pick today or later</span>}
  </span>;
}

const postWhen = (p: MarketingPost) => p.status === "posted" ? `Went live ${exact(p.posted_at)}`
  : p.scheduled_for ? `Scheduled for ${exact(p.scheduled_for)}`
  : p.not_before ? `Not before ${day(p.not_before)}` : QUEUE_STATES.includes(p.status) ? "No date yet, so it waits" : null;
const pageOf = (p: MarketingPost) => safeUrl(p.story_link) ?? safeUrl(p.page_url) ?? safeUrl(p.link);
const shareUrlOf = (p: MarketingPost) => pageOf(p) ?? safeUrl(p.video_url);

/* One video: the cover fills the left, everything else wraps on the right. Opening the folder shows
   its versions: English and Spanish, each as the Instagram Reel and as the link page. */
function FamilyCard({ fam, setDate, rank, mover }: {
  fam: PostFamily; setDate: (slug: string, d: string | null) => void; rank?: number; mover?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  /* One thumbnail per folder (Lee, 5 Oct): try every version's cover in turn, then fall back
     to a frame of the video itself, so a folder with a video is never blank. */
  const [badCovers, setBadCovers] = useState<string[]>([]);
  const [frameOk, setFrameOk] = useState(true);
  const lead = fam.posts[0];
  const cover = fam.posts.map((p) => safeUrl(p.cover_url)).find((u) => u && !badCovers.includes(u));
  const video = fam.posts.map((p) => safeUrl(p.video_url)).find(Boolean);
  const title = familyTitle(fam);
  const versions = fam.posts.length * 2;
  const meta = [lead.app, lead.series, lead.duration_s ? `${Math.round(lead.duration_s)} seconds` : null].filter(Boolean).join(" · ");
  const panelId = `fam-${fam.key}`;
  const toggle = <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={panelId}
    className="ow-field inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-extrabold sm:w-auto">
    <span aria-hidden>{open ? "▾" : "▸"}</span>{open ? "Close the folder" : `Open the folder · ${versions} versions`}</button>;
  const tiles = fam.posts.flatMap((p) => {
    const lang = LANG_NAME[langOf(p)] ?? langOf(p).toUpperCase();
    const reel = p.status === "posted" ? "Posted" : safeUrl(p.video_url) ? POST_STATUS[p.status][0] : p.status === "producing" || p.status === "planned" ? "Being made" : "No video stored";
    const page = shareUrlOf(p) ? "Link ready to copy" : "Not made yet";
    return [
      <button key={`${p.slug}-r`} type="button" onClick={() => setOpen(true)} className="rounded-xl bg-pink-500/10 px-3 py-2 text-left text-[11px] transition hover:bg-pink-500/20">
        <span className="block font-black text-pink-700 dark:text-pink-300">{lang} · Instagram Reel</span><span className="block opacity-70">{reel}</span></button>,
      <button key={`${p.slug}-p`} type="button" onClick={() => setOpen(true)} className="rounded-xl bg-teal/10 px-3 py-2 text-left text-[11px] transition hover:bg-teal/20">
        <span className="block font-black text-teal">{lang} · {pageOf(p) ? "Link page" : "Video URL"}</span><span className="block opacity-70">{page}</span></button>,
    ];
  });
  return (
    <article className="card overflow-hidden">
      <div className="flex items-stretch">
        {/* The picture: as tall as the card, never smaller than a phone-sized 9:16 thumbnail. */}
        {/* Phone: a true 9:16 thumbnail with breathing room, so it reads like the Reel it is.
            Wider screens: the cover runs the full height of the card. */}
        <div className="relative m-3 mr-0 aspect-[9/16] w-[40%] max-w-[10rem] shrink-0 self-start overflow-hidden rounded-xl bg-ink/10 shadow-sm sm:m-0 sm:aspect-auto sm:min-h-[11rem] sm:w-36 sm:max-w-none sm:self-stretch sm:rounded-none sm:shadow-none dark:bg-white/10">
          {cover
            ? <img key={cover} src={cover} alt="" loading="lazy" onError={() => setBadCovers((b) => [...b, cover])} className="absolute inset-0 h-full w-full object-cover"/>
            : video && frameOk
            ? <video src={`${video}#t=1`} muted playsInline preload="metadata" aria-hidden onError={() => setFrameOk(false)}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"/>
            : <div className={`absolute inset-x-0 grid place-items-center p-2 text-center text-[11px] font-semibold opacity-50 ${video ? "top-12" : "inset-y-0"}`}>No cover yet</div>}
          {rank !== undefined && <span className="absolute left-2 top-2 grid h-8 min-w-8 place-items-center rounded-full bg-pink-600 px-2 text-sm font-black text-white shadow"
            title="Your order">{rank}</span>}
          {video && <a href={video} target="_blank" rel="noreferrer" aria-label={`Play ${title}`}
            className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75">▶</a>}
          {mover && <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">{mover}</div>}
        </div>

        <div className="min-w-0 flex-1 space-y-2 p-4">
          <p className="text-base font-extrabold leading-snug">{title}</p>
          {meta && <p className="text-[11px] opacity-60">{meta}</p>}
          <ul className="space-y-1">
            {fam.posts.map((p) => {
              const [label, tone] = POST_STATUS[p.status];
              const when = postWhen(p);
              return <li key={p.slug} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                <span className="font-extrabold">{LANG_NAME[langOf(p)] ?? langOf(p).toUpperCase()}</span>
                <Pill tone={tone}>{label}</Pill>
                {when && <span className="font-semibold opacity-75">{when}</span>}
                {p.posted_count > 0 && p.status !== "posted" && <span className="opacity-60">Posted {p.posted_count === 1 ? "once" : `${p.posted_count} times`}, this is a repeat</span>}
                {p.status === "hold" && p.hold_reason && <span className="basis-full text-amber-700 dark:text-amber-300">{p.hold_reason}</span>}
              </li>;
            })}
          </ul>
          <div className="hidden sm:block">{toggle}</div>
        </div>
        {/* The versions at a glance: to the right on a wide screen, under the picture on a phone. */}
        <div className="hidden w-[26rem] shrink-0 content-start gap-2 p-4 pl-0 lg:grid lg:grid-cols-2">{tiles}</div>
      </div>
      <div className="space-y-2 p-3 sm:hidden">
        <div className="grid grid-cols-2 gap-1.5">{tiles}</div>
        {toggle}
      </div>
      <div className="hidden px-4 pb-4 sm:grid sm:grid-cols-2 sm:gap-1.5 lg:hidden">{tiles}</div>

      {open && <div id={panelId} className="grid gap-2 border-t border-ink/5 bg-ink/[.02] p-3 lg:grid-cols-2 dark:border-white/5 dark:bg-white/[.02]">
        {fam.posts.flatMap((p) => [
          <ReelVersion key={`${p.slug}-reel`} post={p} setDate={setDate}/>,
          <PageVersion key={`${p.slug}-page`} post={p}/>,
        ])}
      </div>}
    </article>
  );
}

/* The Instagram Reel: the feed and Reels-tab post. Links in its caption can't be tapped. */
function ReelVersion({ post: p, setDate }: { post: MarketingPost; setDate: (slug: string, d: string | null) => void }) {
  const [more, setMore] = useState(false);
  const [label, tone] = POST_STATUS[p.status];
  const lang = LANG_NAME[langOf(p)] ?? langOf(p).toUpperCase();
  const queued = QUEUE_STATES.includes(p.status);
  const windows = Object.entries(p.metrics ?? {}).filter(([, v]) => v && typeof v === "object");
  return (
    <div className="card space-y-2 p-3 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-pink-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-pink-700 dark:text-pink-300">{lang} · Instagram Reel</span>
        <Pill tone={tone}>{label}</Pill>
      </div>
      <p className="opacity-60">Goes in the feed and the Reels tab. Feed posts can't carry a tappable link, so the caption says "link in bio".</p>
      {postWhen(p) && <p className="font-semibold">{postWhen(p)}</p>}
      {p.status === "posted" && windows.length > 0 && <p className="opacity-75">
        {windows.map(([w, m]) => `${w}: ${METRIC_WORDS.filter(([k]) => m[k] !== undefined).map(([k, word]) => `${number(m[k])} ${word}`).join(", ")}`).join(" · ")}
      </p>}
      <div className="flex flex-wrap gap-1.5">
        {safeUrl(p.post_url) && <a href={safeUrl(p.post_url)} target="_blank" rel="noreferrer" className="rounded-lg bg-brand px-3 py-2 font-extrabold text-white">Open the post</a>}
        {safeUrl(p.video_url) ? <a href={safeUrl(p.video_url)} target="_blank" rel="noreferrer" className="ow-field rounded-lg px-3 py-2 font-extrabold">Play the video</a>
          : <span className="px-1 py-2 opacity-50">No video stored yet</span>}
        {safeUrl(p.video_url) && <a href={safeUrl(p.video_url)} download={`${p.slug}.mp4`} className="ow-field rounded-lg px-3 py-2 font-extrabold" aria-label={`Download ${lang} video`}>Download video</a>}
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="ow-field rounded-lg px-3 py-2 font-extrabold">{more ? "Less" : "Date, caption and history"}</button>
      </div>
      {more && <div className="space-y-3 border-t border-ink/5 pt-2 dark:border-white/5">
        {queued && <label className="flex flex-wrap items-center gap-2">
          <span className="font-bold uppercase tracking-wide opacity-45">Not before</span>
          <DateField value={p.not_before} onSave={(d) => setDate(p.slug, d)}/>
          {p.not_before && <button type="button" onClick={() => setDate(p.slug, null)} className="underline opacity-60">No date (wait)</button>}
        </label>}
        {p.caption ? <div><p className="font-bold uppercase tracking-wide opacity-45">Caption</p><p className="whitespace-pre-line break-words opacity-85">{p.caption}</p></div>
          : <p className="opacity-50">No caption yet.</p>}
        <div className="grid grid-cols-2 gap-2">
          <div><p className="font-bold uppercase tracking-wide opacity-45">Where</p><p>{titleCase(p.platform)}{p.account ? ` · ${p.account}` : ""}</p></div>
          {p.credits_spent !== null && <div><p className="font-bold uppercase tracking-wide opacity-45">Studio credits</p><p>{number(p.credits_spent)}</p></div>}
        </div>
        {p.post_urls.length > 0 && <div>
          <p className="font-bold uppercase tracking-wide opacity-45">Every time it went out</p>
          <ol className="mt-1 space-y-0.5">{p.post_urls.map((u, i) => <li key={i}><span className="tabular-nums opacity-60">{exact(u.at)}</span>
            {safeUrl(u.url) ? <> · <a href={safeUrl(u.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline">open</a></> : null}</li>)}</ol>
        </div>}
        {p.notes && <p className="break-words opacity-60">{p.notes}</p>}
        {!!p.events.length && <ol className="space-y-1 border-l border-ink/10 pl-3 dark:border-white/10">
          {p.events.map((e, i) => (
            <li key={i}><span className="mr-2 tabular-nums opacity-45">{exact(e.at)}</span>
              <span className="font-semibold">{POST_EVENT_WORDS[e.kind] ?? POST_STATUS[e.kind as MarketingPost["status"]]?.[0] ?? titleCase(e.kind)}</span>
              {e.kind === "reordered" && e.detail.to ? <span className="opacity-60"> to #{String(e.detail.to)}</span> : null}
              {e.kind === "date_changed" ? <span className="opacity-60"> to {e.detail.to ? day(String(e.detail.to)) : "no date"}</span> : null}
              {e.actor ? <span className="opacity-45"> · {e.actor === "admin" ? "you" : e.actor}</span> : null}</li>
          ))}
        </ol>}
      </div>}
    </div>
  );
}

/* The link page: never posted to the feed. It's what the Story link sticker, WhatsApp and
   Facebook point at, each with its own tag so Performance can tell them apart. */
function PageVersion({ post: p }: { post: MarketingPost }) {
  const lang = LANG_NAME[langOf(p)] ?? langOf(p).toUpperCase();
  const page = shareUrlOf(p);
  const directVideo = !pageOf(p) && !!safeUrl(p.video_url);
  const tag = tagOf(p);
  return (
    <div className="card space-y-2 p-3 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-teal/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-teal">{lang} · {directVideo ? "Video URL" : "Link page"}</span>
        {!page && <Pill tone="bg-ink/5 dark:bg-white/10">Not made yet</Pill>}
      </div>
      <p className="opacity-60">{directVideo ? "The same video, opened by a shareable URL." : "Not a feed post. Use it for the Instagram Story link sticker, WhatsApp and Facebook."}</p>
      {page && directVideo ? <LinkRow label={`${lang} video URL`} url={page}/> : page ? <div className="space-y-2">
        <LinkRow label="Instagram Story sticker" url={withTag(page, `ig-story-${tag}`)}/>
        <LinkRow label="WhatsApp" url={withTag(page, `wa-${tag}`)}/>
        <LinkRow label="Facebook" url={withTag(page, `fb-${tag}`)}/>
        <LinkRow label="Plain link" hint="Untagged. Visits show up as direct." url={page}/>
      </div> : <p className="opacity-50">The studio adds the page when the video is ready.</p>}
    </div>
  );
}

/* ══ Marketing → Performance (ADMIN30 overlay 12) ══════════════════════════════════════════════
   Lee, 5 Oct 2026: "how well they're performing … who's clicking on what … what IP address … who
   signed up from it, how effective the ad is, A-B testing … should we run it again? It was a
   complete failure …"

   One card per post: the funnel (reached → played → watched → tapped Join → signed up), where the
   clicks came from (Instagram Story, Instagram, Facebook, WhatsApp), the link-tag variants side by
   side, Meta's own numbers when the posting agent has logged them, and a plain verdict. "Who
   clicked" lists every person with their address, place, device and the member they became.
   Bots and our own people are never counted. */
type PerfPost = {
  slug: string; title: string; series: string | null; platform: string; languages: string[]; status: string;
  live_at: string | null; posted_count: number; post_url: string | null; cover_url: string | null; page: string | null;
  meta: Record<string, Record<string, number>>; reached: number; addresses: number; played: number; watched_75: number;
  completed: number; tapped_join: number; signups: number; existing_members: number; conversion: number;
  verdict: "not_live" | "too_early" | "run_again" | "fix_ending" | "retire" | "keep_watching";
  avg_reached: number; avg_conversion: number;
  sources: Array<{ source: string; reached: number; signups: number }>;
  variants: Array<{ variant: string; reached: number; tapped_join: number; signups: number }>;
};
type PerfData = {
  days: number; totals: { reached: number; addresses: number; tapped_join: number; signups: number };
  posts: PerfPost[];
  groups: Array<{ series: string; enough_data: boolean; posts: Array<{ slug: string; title: string; reached: number; tapped_join: number; signups: number; conversion: number }> }>;
};
type ClickRow = {
  visitor_id: string; first_at: string; ip: string | null; country: string | null; city: string | null; isp: string | null;
  device: string | null; browser: string | null; source: string; variant: string | null; played: boolean; watched_pct: number;
  completed: boolean; tapped_join: boolean; member_id: string | null; member_name: string | null; signed_up: boolean;
};
const VERDICT: Record<PerfPost["verdict"], [string, string, string]> = {
  run_again:     ["Run it again", "bg-teal/15 text-teal", "It brings sign-ups at or above your average."],
  fix_ending:    ["Good reach, no sign-ups", "bg-amber-500/15 text-amber-700 dark:text-amber-300", "People watch it but nobody joins. Change the ending or the offer, then run it again."],
  retire:        ["Retire it", "bg-red-500/10 text-red-500", "Few people opened it and nobody joined."],
  keep_watching: ["Keep watching", "bg-sky-500/15 text-sky-700 dark:text-sky-300", "Some results, not enough to call yet."],
  too_early:     ["Too early to judge", "bg-ink/5 dark:bg-white/10", "Judged after 72 hours or 30 people, whichever comes first."],
  not_live:      ["Not posted yet", "bg-ink/5 dark:bg-white/10", "Visits so far are people opening its page directly, before the post."],
};
const share100 = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

function MarketingPerformance({ isAdmin, nonce }: { isAdmin: boolean; nonce: number }) {
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_marketing_performance" as never, { p_days: days } as never);
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return result as unknown as PerfData;
  }, [isAdmin, nonce, days], isAdmin);

  if (error) return <Problem what="Post performance isn’t available." detail={`${error} — it needs ADMIN30 overlay 12's database part.`}/>;
  if (!data) return <div className="space-y-2"><div className="card h-28 animate-pulse"/><div className="card h-64 animate-pulse"/></div>;
  const t = data.totals;
  return (
    <div className="space-y-3">
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold transition ${days === d ? "bg-brand text-white" : "ow-field"}`}>Last {d} days</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard accent="pink" label="People reached" value={t.reached} note="Opened a post's page"/>
        <MetricCard accent="pink" label="Different addresses" value={t.addresses} note="Behind those people"/>
        <MetricCard accent="pink" label="Tapped Join" value={t.tapped_join} note={`${share100(t.tapped_join, t.reached)}% of people reached`}/>
        <MetricCard accent="pink" label="Signed up" value={t.signups} note={`${share100(t.signups, t.reached)}% of people reached`} attention={t.reached >= 30 && t.signups === 0}/>
      </div>

      {data.groups.length > 0 && <section className="space-y-2">
        <h3 className="px-1 text-sm font-extrabold">A/B: versions of the same video</h3>
        {data.groups.map((g) => (
          <div key={g.series} className="card p-4 text-[11px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-extrabold">{g.series}</p>
              <span className="opacity-55">{g.enough_data ? "Winner on sign-ups, then conversion" : "Not enough data yet: each needs 30 people"}</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {g.posts.map((p, i) => (
                <div key={p.slug} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {i === 0 && g.enough_data && <Pill tone="bg-teal/15 text-teal">Winner</Pill>}
                    <span className="min-w-0 [overflow-wrap:anywhere] font-semibold">{p.title}</span>
                  </span>
                  <span className="shrink-0 tabular-nums opacity-70">{number(p.reached)} reached · {number(p.signups)} joined · {p.conversion}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>}

      <section className="space-y-2">
        <h3 className="px-1 text-sm font-extrabold">Each post</h3>
        {data.posts.map((p) => <PerfCard key={p.slug} post={p} days={data.days} open={open === p.slug} onToggle={() => setOpen(open === p.slug ? null : p.slug)}/>)}
      </section>
      <p className="px-1 text-[10px] opacity-40">A click counts once per person per post. Bots and our own team are left out. "Signed up" means they became a member after opening the post. Instagram's own numbers appear once the posting agent logs them, at 24 and 72 hours.</p>
    </div>
  );
}

function PerfCard({ post: p, days, open, onToggle }: { post: PerfPost; days: number; open: boolean; onToggle: () => void }) {
  const [label, tone, why] = VERDICT[p.verdict];
  const steps: Array<[string, number]> = [["Reached", p.reached], ["Played", p.played], ["Watched", p.watched_75], ["Tapped", p.tapped_join], ["Joined", p.signups]];
  const meta = Object.entries(p.meta ?? {}).filter(([, v]) => v && typeof v === "object");
  const views = Math.max(0, ...meta.map(([, m]) => m.views ?? 0));
  return (
    <article className="card overflow-hidden">
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <p className="min-w-0 flex-1 basis-40 text-sm font-extrabold">{p.title}</p>
          <Pill tone={tone}>{label}</Pill>
        </div>
        <p className="mt-0.5 text-[11px] opacity-55">
          {[titleCase(p.platform), p.languages.map((l) => l.toUpperCase()).join(" · ") || null,
            p.live_at ? `Live since ${exact(p.live_at)}` : null, p.posted_count > 1 ? `posted ${p.posted_count} times` : null].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-[11px] opacity-75">{why}{p.avg_reached > 0 && p.live_at ? ` Your average post reaches ${Math.round(p.avg_reached)} people and converts ${p.avg_conversion}%.` : ""}</p>

        <div className="mt-3 grid grid-cols-5 gap-1">
          {steps.map(([name, n], i) => (
            <div key={name} className="min-w-0 rounded-lg bg-ink/5 px-1.5 py-2 text-center dark:bg-white/5">
              <p className="text-base font-black tabular-nums">{number(n)}</p>
              <p className="text-[10px] leading-tight opacity-60">{name}</p>
              {i > 0 && <p className="text-[10px] font-semibold tabular-nums opacity-80">{share100(n, p.reached)}%</p>}
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] opacity-45">Watched = 75% or more · Tapped = tapped Join</p>

        {(p.sources.length > 0 || views > 0) && <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {p.sources.map((s) => <span key={s.source} className="ow-field rounded-full px-2.5 py-1"><b>{s.source}</b> {number(s.reached)}{s.signups ? ` · ${number(s.signups)} joined` : ""}</span>)}
          {views > 0 && <span className="ow-field rounded-full px-2.5 py-1"><b>Instagram views</b> {number(views)} · {share100(p.reached, views)}% clicked through</span>}
        </div>}

        {p.variants.length > 1 && <div className="mt-3 text-[11px]">
          <p className="font-bold uppercase tracking-wide opacity-40">Link versions</p>
          {p.variants.map((v) => (
            <div key={v.variant} className="mt-1 flex items-center justify-between gap-2">
              <span className="[overflow-wrap:anywhere] font-mono">{v.variant}</span>
              <span className="shrink-0 tabular-nums opacity-70">{number(v.reached)} reached · {number(v.tapped_join)} tapped Join · {number(v.signups)} joined</span>
            </div>
          ))}
        </div>}

        {meta.length > 0 && <p className="mt-2 text-[11px] opacity-70">
          {meta.map(([w, m]) => `${w}: ${METRIC_WORDS.filter(([k]) => m[k] !== undefined).map(([k, word]) => `${number(m[k])} ${word}`).join(", ")}`).join(" · ")}
        </p>}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={onToggle} aria-expanded={open} disabled={!p.reached}
            className="ow-field rounded-lg px-3 py-1.5 text-[11px] font-extrabold disabled:opacity-40">{open ? "Hide" : `Who clicked · ${number(p.reached)}`}</button>
          {safeUrl(p.post_url) && <a href={safeUrl(p.post_url)} target="_blank" rel="noreferrer" className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-extrabold text-white">Open the post</a>}
        </div>
      </div>
      {open && <ClickList slug={p.slug} days={days}/>}
    </article>
  );
}

function ClickList({ slug, days }: { slug: string; days: number }) {
  const nav = useNav();
  const [error, setError] = useState("");
  const data = useAsync(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_marketing_post_clicks" as never, { p_slug: slug, p_days: days } as never);
    if (rpcError) { setError(rpcError.message); return undefined; }
    return (result as unknown as { rows: ClickRow[] }).rows;
  }, [slug, days], true);
  if (error) return <p className="border-t border-ink/5 px-4 py-3 text-[11px] text-red-500 dark:border-white/5">{error}</p>;
  if (!data) return <div className="border-t border-ink/5 px-4 py-3 dark:border-white/5"><div className="h-16 animate-pulse rounded-lg bg-ink/5 dark:bg-white/5"/></div>;
  return (
    <ol className="divide-y divide-ink/5 border-t border-ink/5 text-[11px] dark:divide-white/5 dark:border-white/5">
      {data.map((r) => (
        <li key={r.visitor_id} className="px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="font-semibold">{[r.city, r.country].filter(Boolean).join(", ") || "Unknown place"}</span>
            <span className="flex flex-wrap gap-1">
              {r.signed_up && <Pill tone="bg-teal/15 text-teal">Signed up</Pill>}
              {!r.signed_up && r.member_id && <Pill tone="bg-sky-500/15 text-sky-700 dark:text-sky-300">Already a member</Pill>}
              {!r.member_id && r.tapped_join && <Pill tone="bg-amber-500/15 text-amber-700 dark:text-amber-300">Tapped Join</Pill>}
            </span>
          </div>
          <p className="mt-0.5 opacity-70">
            {[r.source, r.variant ? `link ${r.variant}` : null, [r.device, r.browser].filter(Boolean).join(" · ") || null, r.isp,
              r.completed ? "watched it all" : r.played ? `watched ${r.watched_pct}%` : "did not press play"].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular-nums opacity-50">{exact(r.first_at)}</span>
            {r.ip && <button type="button" onClick={() => nav.address(r.ip!)} className="font-mono text-brand underline-offset-2 hover:underline">{r.ip}</button>}
            <button type="button" onClick={() => nav.visitor(r.visitor_id)} className="text-brand underline-offset-2 hover:underline">Their visits</button>
            {r.member_id && <button type="button" onClick={() => nav.member(r.member_id!)} className="font-semibold text-brand underline-offset-2 hover:underline">{r.member_name || "Member"}</button>}
          </div>
        </li>
      ))}
    </ol>
  );
}


/* ================================================== the console =========================== */

type Bucket = { slug: BucketSlug; label: string; blurb: string; tabs: string[]; accent: AccentKey };

const BUCKETS: Bucket[] = [
  { slug: "overview", label: "Overview", blurb: "Growth · People · Money · Ops", tabs: [] , accent: "brand" },
  { slug: "growth", label: "Growth", blurb: "Who came, from where, and who joined — plus email, leads and partners.",
    tabs: ["Summary", "Visitors", "Sources", "Videos", "Bots", "Pages & places", "Emails", "Failures", "Delivery", "Suppressed", "Lead Gen", "Waitlist", "Affiliates", "Applications", "Nurture"] , accent: "brand" },
  { slug: "people", label: "People", blurb: "Members, claim state, plans and connected products — the human side of the platform.",
    tabs: ["Directory", "Incomplete", "Kickstarter", "Arena", "Careers"] , accent: "violet" },
  { slug: "money", label: "Money", blurb: "Contracts, payouts, disputes and promotions — every dollar in or out.",
    tabs: ["Summary", "Refund problems", "Contracts", "Payouts", "Disputes", "Subscriptions", "Promo codes", "Passes", "Stripe"] , accent: "amber" },
  { slug: "ops", label: "Ops", blurb: "Alerts, security, admin activity and data coverage — keep the machine running.",
    tabs: ["Health", "Testing", "Alerts", "Ban list", "Blocked", "Attempts", "Reports", "Admin log", "Accountability", "QA", "Transcripts", "Backups", "Data"] , accent: "sky" },
  { slug: "catalog", label: "Catalog", blurb: "What members have published — events and property listings.",
    tabs: ["Events", "Listings"] , accent: "emerald" },
  { slug: "marketing", label: "Marketing", blurb: "What goes out on Instagram, Facebook and WhatsApp, what is queued next, and how each post did.",
    tabs: ["Posts", "Performance"], accent: "pink" },
];

/** Which allow-listed list each sub-tab reads. A tab with no entry here renders its own panel. */
const TAB_LIST: Record<string, string> = {
  "Emails": "emails", "Failures": "email_failures", "Delivery": "email_events", "Suppressed": "suppressed",
  "Lead Gen": "leads", "Waitlist": "waitlist", "Affiliates": "affiliates",
  "Applications": "affiliate_apps", "Nurture": "nurture",
  "Incomplete": "incomplete", "Kickstarter": "kickstarter", "Arena": "arena", "Careers": "applications",
  "Contracts": "contracts", "Payouts": "payouts", "Disputes": "disputes",
  "Subscriptions": "subscriptions", "Passes": "promo_passes",
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
  const [windowIndex, setWindowIndex] = useState(3); // Lee, 5 Oct 2026: open on the last 24 hours
  const [nonce, setNonce] = useState(0);
  const [member, setMember] = useState<string | null>(null);
  const [placesBy, setPlacesBy] = useState<PlaceBy>("page");
  const [visitor, setVisitor] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillTarget | null>(null);
  const [aud, setAud] = useState<AudienceQuery>(AUDIENCE_DEFAULT);
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

  /* ── WHERE YOU CAME FROM ──────────────────────────────────────────────────────────────────
     Lee, 23 Sep 2026: *"Back returns to the same scroll position and range."*

     Drilling in is only half a drill-down. Without this, opening a figure from halfway down
     Overview and coming back put you at the top of the screen with the window reset, so the
     second look cost as much as the first and you lost your place in a long page.

     Every drill-in pushes the whole view — bucket, tab, member, traffic query, time window AND
     scroll offset — and Back pops it and restores all six. The scroll is restored after paint,
     because the panel it belongs to has to exist before it can be scrolled to. */
  type Place = { bucket: BucketSlug; tab: number; member: string | null; visitor: string | null; aud: AudienceQuery;
                 placesBy: PlaceBy; address: string | null; drill: DrillTarget | null; windowIndex: number; scroll: number };
  const [history, setHistory] = useState<Place[]>([]);
  const pendingScroll = useRef<number | null>(null);

  const push = useCallback(() => {
    setHistory((stack) => [...stack.slice(-19), {
      bucket, tab, member, visitor, aud, placesBy, address, drill, windowIndex,
      scroll: typeof window === "undefined" ? 0 : window.scrollY,
    }]);
  }, [bucket, tab, member, visitor, aud, placesBy, address, drill, windowIndex]);

  const back = useCallback(() => {
    setHistory((stack) => {
      const last = stack[stack.length - 1];
      if (!last) return stack;
      setBucket(last.bucket); setTab(last.tab); setMember(last.member);
      setVisitor(last.visitor); setAud(last.aud);
      setPlacesBy(last.placesBy); setAddress(last.address); setDrill(last.drill); setWindowIndex(last.windowIndex);
      pendingScroll.current = last.scroll;
      return stack.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    if (pendingScroll.current === null) return;
    const to = pendingScroll.current;
    pendingScroll.current = null;
    const id = requestAnimationFrame(() => window.scrollTo({ top: to, behavior: "auto" }));
    return () => cancelAnimationFrame(id);
  });

  /* Every figure on a summary card can be opened. goto("money","Disputes") lands on the list
     the figure was counted from, so a number and its evidence are never more than one tap apart. */
  const goto = useCallback((slug: BucketSlug, tabLabel: string) => {
    const target = BUCKETS.find((item) => item.slug === slug);
    if (!target) return;
    const index = target.tabs.indexOf(tabLabel);
    push();
    setMember(null);
    setVisitor(null);
    setAddress(null);
    setDrill(null);
    setBucket(slug);
    setTab(index < 0 ? 0 : index);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [push]);

  /* Every drill-in to people goes through these three, so Back always returns to the exact
     list, filter, window and scroll position the tap came from. */
  const growthTab = (label: string) => Math.max(0, BUCKETS.find((b) => b.slug === "growth")!.tabs.indexOf(label));
  const clearDetail = () => { setMember(null); setVisitor(null); setAddress(null); setDrill(null); };
  const openAudience = useCallback((q: Partial<AudienceQuery>) => {
    push(); clearDetail(); setBucket("growth"); setTab(growthTab("Visitors"));
    /* A source (video, promo code, campaign) is a property of a VISIT, so those drill-ins open the
       per-browser view; everything else opens grouped by address. */
    setAud({ ...AUDIENCE_DEFAULT, ...(q.channel ? { group: "visitor" as AudienceGroup } : {}), ...q });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [push]); // eslint-disable-line react-hooks/exhaustive-deps
  const openVisitor = useCallback((id: string) => {
    push(); clearDetail(); setVisitor(id); window.scrollTo({ top: 0, behavior: "auto" });
  }, [push]);
  const openMember = useCallback((id: string) => {
    push(); clearDetail(); setMember(id); window.scrollTo({ top: 0, behavior: "auto" });
  }, [push]);
  const openAddress = useCallback((ip: string) => {
    push(); clearDetail(); setAddress(ip); window.scrollTo({ top: 0, behavior: "auto" });
  }, [push]);
  const openPlaces = useCallback((by: PlaceBy) => {
    push(); clearDetail(); setBucket("growth"); setTab(growthTab("Pages & places")); setPlacesBy(by);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [push]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: metrics, error } = useConsole(isAdmin, windowIndex, nonce);
  const chosen = WINDOWS[windowIndex] ?? WINDOWS[6];
  /* The list behind a number is read for the SAME window the number was read for. */
  const openDrill = useCallback((metric: string, label: string, arg: string | null = null) => {
    push(); clearDetail(); setDrill({ metric, label, arg, days: chosen.days, hours: chosen.hours });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [push, chosen]); // eslint-disable-line react-hooks/exhaustive-deps
  const nav = useMemo<Nav>(() => ({
    drill: openDrill, audience: openAudience, address: openAddress, visitor: openVisitor,
    member: openMember, goto, places: openPlaces,
  }), [openDrill, openAudience, openAddress, openVisitor, openMember, goto, openPlaces]);
  const detailOpen = !!(member || visitor || address || drill);

  /* Overview borrows the analytics aggregate for its trend line only; the tiles come from the
     console aggregate, so a traffic outage never blanks the rest of the screen. */
  const overview = useAsync(async () => {
    if (previewMode()) return PREVIEW_OVERVIEW;
    const { data, error: rpcError } = await supabase.rpc("admin_analytics_overview", { p_days: 30, p_product: null, p_traffic: "human" });
    if (rpcError) return undefined;
    return data as unknown as Overview;
  }, [isAdmin, nonce], isAdmin && bucket === "overview");

  /* The analyst read. Its own call so a slow aggregate never blanks the rest of the screen. */
  const funnel = useAsync(async () => {
    if (previewMode()) return PREVIEW_FUNNEL;
    const { data, error: rpcError } = await supabase.rpc("admin_console_funnel", {
      p_days: chosen.days, p_hours: chosen.hours,
    });
    if (rpcError) return undefined;
    return data as unknown as Funnel;
  }, [isAdmin, nonce, windowIndex], isAdmin && bucket === "overview");

  const active = useMemo(() => BUCKETS.find((item) => item.slug === bucket) ?? BUCKETS[0], [bucket]);
  const tabName = active.tabs[tab] ?? active.tabs[0] ?? "";
  const listName = TAB_LIST[tabName];

  if (!isAdmin) return <div className="card p-8 text-center text-sm opacity-60">{isEs ? "No tienes acceso a esta pantalla." : "You don’t have access to this screen."}</div>;

  return <NavContext.Provider value={nav}><div className="space-y-3">
    <style>{ADMIN_CHROME_CSS}</style>

    {/* The blurb is ONE line, always. It used to be `line-clamp-2`, so Overview's short line and
        Growth's long one gave the header two different heights and the whole page moved down
        when you changed bucket. A fixed height cannot jump. The full text is still there for a
        screen reader and on a wide screen where it fits. */}
    <div>
      <ScreenHeading><span className="sm:hidden">Admin</span><span className="hidden sm:inline">Admin Dashboard</span></ScreenHeading>
      <div className="-mt-1 flex min-h-[2.5rem] items-center gap-2">
        {history.length > 0 && (
          <button onClick={back} title="Back to where you were"
            className="ow-field flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-extrabold transition hover:text-brand">
            <span aria-hidden>{"\u2190"}</span> Back
          </button>
        )}
        <p className="min-w-0 flex-1 [overflow-wrap:anywhere] text-[11px] font-semibold opacity-45" title={active.blurb}>{active.blurb}</p>
        <AdminQuickActions promo={promoCode}/>
      </div>
    </div>

    {/* Seven buckets since Marketing joined (3 Oct). On a phone they sit in a FIXED 4 + 3 grid, so
        nothing hides off the edge and the height never changes between buckets; one row on wider screens. */}
    <div className="ow-buckets grid grid-cols-4 items-stretch gap-0.5 rounded-2xl p-1 sm:flex"
      role="tablist" aria-label="Admin sections">
      {BUCKETS.map((item) => {
        const selected = bucket === item.slug;
        return <button key={item.slug} role="tab" aria-selected={selected}
          onClick={() => { setBucket(item.slug); setTab(0); clearDetail(); }}
          className={`shrink-0 grow basis-0 whitespace-nowrap rounded-xl px-2 py-2 text-center text-[11px] font-extrabold transition sm:text-xs ${selected ? ACCENT[item.accent].tab : "opacity-55 hover:opacity-100"}`}>{item.label}</button>;
      })}
    </div>

    {active.tabs.length > 0 && !detailOpen && (
      <TabStrip items={active.tabs} index={tab} onPick={setTab} accent={active.accent}
        ariaLabel={`${active.label} views`}/>
    )}

    {!detailOpen && (
      <FilterBar index={windowIndex} onPick={setWindowIndex} onRefresh={refresh} busy={!metrics && !error}
        product={product} onProduct={setProduct} audience={audience} onAudience={setAudience}
        showWindow={(!listName && tabName !== "Refund problems" && bucket !== "marketing") || !!LISTS[listName]?.windowed}
        showProduct={bucket === "people"}
        showAudience={false}/>
    )}

    {error && !detailOpen && <Problem
      what="The console metrics aren’t available."
      detail={`${error} — this screen needs the admin_console_metrics function released to the database.`}/>}

    {address
      ? <AddressPanel ip={address} isAdmin={isAdmin}/>
      : drill
      ? <DrillPanel target={drill} isAdmin={isAdmin}/>
      : visitor
      ? <VisitorJourneyPanel visitorId={visitor} isAdmin={isAdmin} onBack={() => (history.length ? back() : setVisitor(null))} onOpenMember={openMember}/>
      : member
      ? <MemberRecordPanel userId={member} isAdmin={isAdmin} onBack={() => (history.length ? back() : setMember(null))}/>
      : listName
        ? <ListPanel spec={LISTS[listName]} isAdmin={isAdmin} days={chosen.days} nonce={nonce}/>
        : <>
            {bucket === "overview" && <OverviewPanel console={metrics} overview={overview} goto={goto}
      funnel={funnel} isAdmin={isAdmin} hours={hoursOf(chosen)} nonce={nonce} openAudience={openAudience}
      openDay={(day) => openAudience({ day })}/>}
            {bucket === "growth" && tabName === "Summary" && <GrowthSummary console={metrics}/>}
            {bucket === "growth" && tabName === "Visitors" && (aud.group === "visitor"
              ? <AudiencePanel isAdmin={isAdmin} hours={hoursOf(chosen)} query={aud} onQuery={setAud} onOpenVisitor={openVisitor} nonce={nonce}/>
              : <AddressesPanel isAdmin={isAdmin} hours={hoursOf(chosen)} query={aud} onQuery={setAud} nonce={nonce}/>)}
            {bucket === "growth" && tabName === "Sources" && <SourcesPanel isAdmin={isAdmin} hours={hoursOf(chosen)} nonce={nonce}
              onOpenChannel={(channel, detail) => openAudience({ channel, detail: detail ?? null })} onOpenMember={openMember}/>}
            {bucket === "growth" && tabName === "Videos" && <VideosPanel isAdmin={isAdmin} hours={hoursOf(chosen)} nonce={nonce}
              onOpenVideo={(slug) => openAudience({ channel: "video", detail: slug })}/>}
            {bucket === "growth" && tabName === "Bots" && <BotsPanel isAdmin={isAdmin} hours={hoursOf(chosen)} nonce={nonce}/>}
            {bucket === "growth" && tabName === "Pages & places" && <PlacesPanel isAdmin={isAdmin} hours={hoursOf(chosen)} by={placesBy} onBy={setPlacesBy} nonce={nonce}/>}
            {bucket === "people" && tabName === "Directory" && <PeopleDirectory isAdmin={isAdmin} isEs={isEs} console={metrics} onOpen={openMember} product={product}/>}
            {bucket === "money" && tabName === "Summary" && <MoneySummary console={metrics} goto={goto}/>}
            {bucket === "money" && tabName === "Refund problems" && <RefundProblems isAdmin={isAdmin} nonce={nonce}/>}
            {bucket === "ops" && tabName === "Health" && <OpsHealth console={metrics} goto={goto}/>}
            {bucket === "ops" && tabName === "Data" && <CoveragePanel console={metrics}/>}
            {bucket === "marketing" && tabName === "Posts" && <MarketingPanel isAdmin={isAdmin} nonce={nonce}/>}
            {bucket === "marketing" && tabName === "Performance" && <MarketingPerformance isAdmin={isAdmin} nonce={nonce}/>}
            {/* ONEHOME30 overlay 43 — the nine-level testing scoreboard and the one promo catalogue. */}
            {bucket === "ops" && tabName === "Testing" && <TestingScoreboard isAdmin={isAdmin} nonce={nonce}/>}
            {bucket === "money" && tabName === "Promo codes" && <PromoCatalog isAdmin={isAdmin} nonce={nonce}/>}
          </>}

    <p className="pt-2 text-center text-[10px] opacity-35">Server-authorized · Every read and every action is audited</p>
  </div></NavContext.Provider>;
}
