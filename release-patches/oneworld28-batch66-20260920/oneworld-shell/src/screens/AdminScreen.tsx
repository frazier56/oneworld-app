import { useEffect, useState } from "react";
import Avatar from "../components/Avatar";
import ScreenHeading from "../components/ScreenHeading";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { useIsAdmin } from "../lib/useIsAdmin";

type Pair = { label: string; value: number };
type Kpi = { current: number; previous: number };
type Daily = { day: string; visitors: number; visits: number; page_views: number };
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

type Product = { product: string; status: string; plan: string | null; granted_at: string | null };
type Member = {
  user_id: string; full_name: string | null; email: string | null; phone: string | null;
  profession: string | null; location: string | null; photo_url: string | null;
  score: number | null; is_public: boolean | null; created_at: string | null;
  last_sign_in_at: string | null; apps_connected: number; membership: string;
  onboarding_incomplete: boolean; products: Product[];
};
type Directory = { total: number; rows: Member[] };

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

const when = (iso: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
};
const number = (value: number | null | undefined) => new Intl.NumberFormat().format(Number(value ?? 0));
const change = (kpi: Kpi) => {
  if (!kpi.previous) return kpi.current ? "+100%" : "—";
  const value = Math.round(((kpi.current - kpi.previous) / kpi.previous) * 100);
  return `${value > 0 ? "+" : ""}${value}%`;
};

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

function Breakdown({ title, rows, empty = "No data yet" }: { title: string; rows: Pair[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="card p-4">
      <h3 className="text-sm font-extrabold">{title}</h3>
      <div className="mt-3 space-y-3">
        {!rows.length && <p className="py-5 text-center text-xs opacity-45">{empty}</p>}
        {rows.slice(0, 8).map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="truncate opacity-70">{row.label}</span><b>{number(row.value)}</b></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: Kpi }) {
  const delta = change(value);
  const positive = delta.startsWith("+");
  return (
    <div className="card p-4">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] opacity-45">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-black">{number(value.current)}</p>
        <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${positive ? "bg-teal/15 text-teal" : delta === "—" ? "bg-ink/5 opacity-45 dark:bg-white/10" : "bg-red-500/10 text-red-500"}`}>{delta}</span>
      </div>
      <p className="mt-1 text-[10px] opacity-40">Previous period: {number(value.previous)}</p>
    </div>
  );
}

function OperationCard({ title, rows }: { title: string; rows: Array<[string, number, boolean?]> }) {
  return (
    <section className="card p-4">
      <h3 className="font-extrabold">{title}</h3>
      <dl className="mt-3 divide-y divide-ink/5 text-sm dark:divide-white/5">
        {rows.map(([label, value, attention]) => (
          <div key={label} className="flex items-center justify-between py-2.5"><dt className="opacity-60">{label}</dt><dd className={attention && value ? "font-black text-amber-600 dark:text-amber-400" : "font-black"}>{number(value)}</dd></div>
        ))}
      </dl>
    </section>
  );
}

function OverviewPanel({ isAdmin }: { isAdmin: boolean }) {
  const [days, setDays] = useState(30);
  const [product, setProduct] = useState("");
  const [traffic, setTraffic] = useState("human");
  const [error, setError] = useState("");
  const overview = useAsync(async () => {
    if (previewMode()) { setError(""); return PREVIEW_OVERVIEW; }
    const { data, error: rpcError } = await supabase.rpc("admin_analytics_overview", {
      p_days: days, p_product: product || null, p_traffic: traffic,
    });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return data as unknown as Overview;
  }, [days, product, traffic, isAdmin], isAdmin);

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap gap-2 p-2">
        <select aria-label="Date range" value={days} onChange={(event) => setDays(Number(event.target.value))} className="min-w-[8rem] flex-1 rounded-xl bg-ink/5 px-3 py-2 text-xs font-bold outline-none dark:bg-white/10">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
        <select aria-label="Product" value={product} onChange={(event) => setProduct(event.target.value)} className="min-w-[8rem] flex-1 rounded-xl bg-ink/5 px-3 py-2 text-xs font-bold outline-none dark:bg-white/10">
          {PRODUCTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Traffic type" value={traffic} onChange={(event) => setTraffic(event.target.value)} className="min-w-[8rem] flex-1 rounded-xl bg-ink/5 px-3 py-2 text-xs font-bold outline-none dark:bg-white/10">
          <option value="human">Human traffic</option><option value="bot">Bot traffic</option><option value="all">All traffic</option>
        </select>
      </div>

      {error && <div className="card border border-amber-500/30 p-4 text-sm"><b>Dashboard data isn’t available yet.</b><p className="mt-1 opacity-60">The local database migration must be reviewed and released before this screen can read the new aggregates.</p></div>}
      {!overview && !error && <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="card h-28 animate-pulse" />)}</div>}
      {overview && <>
        {overview.collection.event_count === 0 && (
          <div className="card border border-brand/20 bg-brand/5 p-4 text-sm"><b>Analytics collection is ready, with no history yet.</b><p className="mt-1 opacity-60">Numbers will begin here after the migration and privacy-safe collector are released. Existing product and operations totals below are already sourced from live records.</p></div>
        )}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <MetricCard label="Visitors" value={overview.kpis.visitors}/><MetricCard label="Visits" value={overview.kpis.visits}/>
          <MetricCard label="Signups" value={overview.kpis.signups}/><MetricCard label="Onboarded" value={overview.kpis.onboarded}/>
          <MetricCard label="Product actions" value={overview.kpis.product_actions}/>
        </div>
        <section className="card p-4">
          <div className="flex items-start justify-between"><div><h3 className="font-extrabold">Audience trend</h3><p className="text-xs opacity-45">Unique visitors per day</p></div><p className="text-right text-xs opacity-45">Human {number(overview.traffic.human)}<br/>Bots {number(overview.traffic.bot)}</p></div>
          <Sparkline points={overview.daily}/>
        </section>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Breakdown title="Traffic sources" rows={overview.referrers}/><Breakdown title="Devices" rows={overview.devices}/><Breakdown title="Products connected" rows={overview.products}/>
          <Breakdown title="Countries" rows={overview.countries}/><Breakdown title="Cities" rows={overview.cities}/><Breakdown title="Landing pages" rows={overview.landing_pages}/>
          {(traffic === "bot" || traffic === "all") && <Breakdown title="Search & discovery crawlers" rows={overview.bots}/>}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <OperationCard title="OneEvent" rows={[["Events", overview.operations.oneevent.events], ["Applications", overview.operations.oneevent.applications], ["Registrations", overview.operations.oneevent.registrations], ["Pending approvals", overview.operations.oneevent.pending_approvals, true], ["Payment attention", overview.operations.oneevent.payment_attention, true]]}/>
          <OperationCard title="OneHome" rows={[["Rental listings", overview.operations.onehome.rental_listings], ["Rental requests", overview.operations.onehome.rental_requests], ["Active contracts", overview.operations.onehome.active_contracts], ["Sale listings", overview.operations.onehome.sale_listings], ["Sale deals", overview.operations.onehome.sale_deals]]}/>
          <OperationCard title="Operations health" rows={[["Open alerts", overview.operations.health.open_alerts, true], ["Onboarding incomplete", overview.operations.health.onboarding_incomplete, true], ["Email failures", overview.operations.health.email_failures, true]]}/>
        </div>
      </>}
    </div>
  );
}

const TAG: Record<string, { label: string; cls: string }> = {
  claimed: { label: "Claimed", cls: "bg-teal/15 text-teal" },
  migrated: { label: "Migrated", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  invited: { label: "Invited", cls: "bg-ink/10 text-ink/60 dark:bg-white/10 dark:text-white/60" },
};

function PeoplePanel({ isAdmin, isEs, compact = false, onViewAll }: { isAdmin: boolean; isEs: boolean; compact?: boolean; onViewAll?: () => void }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
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
      p_search: search || null, p_product: product || null, p_status: status || null, p_limit: compact ? 6 : 100, p_offset: 0,
    });
    if (rpcError) { setError(rpcError.message); return undefined; }
    setError("");
    return data as unknown as Directory;
  }, [search, product, status, isAdmin], isAdmin);

  return <section className="space-y-3">
    {compact && <div className="flex items-end justify-between px-1"><div><h2 className="font-extrabold">Members</h2><p className="text-[11px] opacity-45">One ID, claim state and connected products</p></div><button onClick={onViewAll} className="text-xs font-extrabold text-brand">View all</button></div>}
    {!compact && <div className="card grid gap-2 p-2 md:grid-cols-[1fr_180px_180px]">
      <label className="flex items-center gap-2 rounded-xl bg-ink/5 px-3 py-2.5 dark:bg-white/10"><span aria-hidden>⌕</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={isEs ? "Nombre, correo o teléfono" : "Name, email or phone"} className="w-full bg-transparent text-sm outline-none"/></label>
      <select aria-label="Product" value={product} onChange={(event) => setProduct(event.target.value)} className="rounded-xl bg-ink/5 px-3 py-2 text-xs font-bold outline-none dark:bg-white/10">{PRODUCTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Account status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl bg-ink/5 px-3 py-2 text-xs font-bold outline-none dark:bg-white/10"><option value="">All account states</option><option value="claimed">Claimed</option><option value="invited">Invited</option><option value="migrated">Migrated</option><option value="onboarding">Onboarding incomplete</option></select>
    </div>}
    {error && <div className="card border border-amber-500/30 p-4 text-sm"><b>User directory isn’t available yet.</b><p className="mt-1 opacity-60">The local server-authorized directory migration must be reviewed and released first.</p></div>}
    <div className="flex items-center justify-between px-1 text-xs opacity-50"><span>{directory ? `${number(directory.total)} people` : "Loading people…"}</span><span>PII access audited</span></div>
    <div className="grid gap-2 xl:grid-cols-2">
      {!directory && !error && <div className="card h-24 animate-pulse"/>}
      {directory?.rows.map((member) => {
        const tag = TAG[member.membership] ?? TAG.invited;
        const expanded = open === member.user_id;
        return <article key={member.user_id} className="card overflow-hidden">
          <button onClick={() => setOpen(expanded ? null : member.user_id)} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-brand/5">
            <Avatar src={member.photo_url} name={member.full_name} size={42} rounded="rounded-full" textSize="text-sm"/>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-extrabold">{member.full_name ?? "No name"}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${tag.cls}`}>{tag.label}</span></div><p className="truncate text-xs opacity-50">{member.email ?? "—"}</p></div>
            <div className="text-right"><b>{member.score == null ? "—" : Math.round(member.score)}</b><p className="text-[9px] uppercase opacity-40">score</p></div>
          </button>
          {expanded && <div className="border-t border-ink/5 p-3 dark:border-white/5">
            <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-3">{[["Phone", member.phone ?? "—"], ["Profession", member.profession ?? "—"], ["Location", member.location ?? "—"], ["Last sign-in", when(member.last_sign_in_at)], ["Joined", when(member.created_at)], ["Profile", member.is_public ? "Public" : "Private"]].map(([key, value]) => <div key={key}><dt className="text-[9px] font-bold uppercase tracking-wide opacity-40">{key}</dt><dd className="mt-0.5 truncate font-semibold">{value}</dd></div>)}</dl>
            <div className="mt-3 flex flex-wrap gap-1.5">{member.products.filter((item) => item.status === "active").map((item) => <span key={item.product} className="rounded-full bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand">{item.product.replace(/^one/, "One")}{item.plan ? ` · ${item.plan}` : ""}</span>)}{!member.apps_connected && <span className="text-[10px] opacity-40">No active products</span>}</div>
            {member.onboarding_incomplete && <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Onboarding is incomplete</p>}
          </div>}
        </article>;
      })}
    </div>
    {directory && !directory.rows.length && <div className="card p-10 text-center text-sm opacity-50">Nobody matches these filters.</div>}
  </section>;
}

export default function AdminScreen() {
  const { lang } = useI18n();
  const isEs = lang === "es" || lang === "co";
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<"overview" | "people">("overview");
  if (!isAdmin) return <div className="card p-8 text-center text-sm opacity-60">{isEs ? "No tienes acceso a esta pantalla." : "You don’t have access to this screen."}</div>;
  return <div className="space-y-3">
    <div>
      <ScreenHeading><span className="sm:hidden">Admin</span><span className="hidden sm:inline">Admin Dashboard</span></ScreenHeading>
      <p className="-mt-2 text-[11px] font-semibold opacity-45">Growth · People · Money · Ops</p>
    </div>
    <div className="card flex gap-1 overflow-x-auto p-1" role="tablist" aria-label="Admin sections">
      {(["Overview", "Growth", "People", "Money", "Ops"] as const).map((name) => {
        const available = name === "Overview" || name === "People";
        const selected = tab === name.toLowerCase();
        return <button key={name} role="tab" aria-selected={selected} aria-disabled={!available} disabled={!available}
          onClick={() => available && setTab(name.toLowerCase() as "overview" | "people")}
          title={available ? name : `${name} remains in the mapped next vertical slice`}
          className={`min-w-[5.4rem] flex-1 rounded-xl px-3 py-2.5 text-xs font-extrabold transition ${selected ? "bg-brand text-white shadow-sm" : available ? "opacity-55 hover:opacity-100" : "cursor-not-allowed opacity-25"}`}>{name}</button>;
      })}
    </div>
    {tab === "overview" ? (
      <><PeoplePanel isAdmin={isAdmin} isEs={isEs} compact onViewAll={() => setTab("people")}/><OverviewPanel isAdmin={isAdmin}/></>
    ) : (
      <PeoplePanel isAdmin={isAdmin} isEs={isEs}/>
    )}
    <p className="pt-2 text-center text-[10px] opacity-35">Read-only · Server-authorized · Sensitive views are audited</p>
  </div>;
}
