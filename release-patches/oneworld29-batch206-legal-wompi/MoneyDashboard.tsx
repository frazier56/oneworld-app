import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, ScreenHeading, W, useI18n } from "@oneworld/shell";

/* ============================================================================================
 * MONEY — one dashboard for everyone, across every app (Lee, 29 Oct 2026).
 *
 * Lee: "If I keep paying my maid… I want to see how much I paid her over time… a breakdown and an
 * aggregate and a chart… What if I paid Uber drivers too? Categories: here's what I paid maids,
 * here's what I paid videographers… a drill down: from paying a freelancer, to that particular
 * freelancer, to the history of that freelancer and the aggregate. And if I'm receiving money,
 * who's giving me money… then zoom out to the day, week, month, year."
 *
 * So the screen answers four questions, in this order:
 *   1. How much came in / went out in this period, and is that more or less than last time?
 *   2. When? (chart at the chosen zoom: days, weeks, months, years)
 *   3. Who / what for? (people · categories · apps, ranked, each one tappable)
 *   4. Drill in: one person (all-time total with them, average, first and last payment, their
 *      history and their chart) or one category (who is in it, and how much each).
 * Currencies are never added together.
 * ============================================================================================ */
type Row = {
  occurred_at: string; app: string; direction: "in" | "out"; amount: number; currency: string; label: string; state: string;
  cp_id: string | null; cp_name: string; cp_photo: string | null; category: string;
};
type Dir = "in" | "out";
type Grain = "week" | "month" | "year" | "all";
type Group = "people" | "categories" | "apps";
type Drill = { kind: "person"; key: string } | { kind: "category"; key: string } | { kind: "app"; key: string } | null;

const APP_NAME: Record<string, string> = { onejob: "OneJob", oneride: "OneRide", oneevent: "OneEvent", onehome: "OneHome", onepay: "OnePay" };
const CAT_ES: Record<string, string> = {
  Services: "Servicios", Jobs: "Trabajos", Rides: "Viajes", Events: "Eventos", Tickets: "Entradas",
  "Rent & stays": "Arriendos y estadías", "Home purchase": "Compra de vivienda", "Home sales": "Venta de vivienda", Sales: "Ventas",
};
/* Fixed labels the server writes in English; titles people typed are shown as typed. */
const FIXED_ES: Record<string, string> = {
  Ride: "Viaje", Stay: "Estadía", Job: "Trabajo", Sale: "Venta", Event: "Evento",
  "Home purchase": "Compra de vivienda", "Home sale": "Venta de vivienda", Someone: "Alguien", "Walk-in customer": "Cliente en mostrador",
};
const tx = (s: string, lang: string) => (lang === "es" ? FIXED_ES[s] ?? s : s);
const STATE = (lang: string): Record<string, string> => ({
  paid: W(lang, "Paid", "Pagado"), held: W(lang, "Held until the job is done", "Retenido hasta terminar"),
  received: W(lang, "Received", "Recibido"), on_the_way: W(lang, "On the way", "En camino"), refunded: W(lang, "Refunded", "Reembolsado"),
});
const DAY = 86_400_000;
const personKey = (r: Row) => r.cp_id ?? `name:${r.cp_name.toLowerCase()}`;

function fmt(n: number, cur: string, lang: string) {
  return new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", {
    style: "currency", currency: cur, currencyDisplay: "code", maximumFractionDigits: cur === "COP" ? 0 : 2,
  }).format(n);
}
const dateShort = (d: Date, lang: string) => d.toLocaleDateString(lang === "es" ? "es-CO" : "en-US", { day: "numeric", month: "short" });

/* The chart's buckets for a zoom level, newest last. */
function buckets(grain: Grain, rows: Row[], lang: string) {
  const loc = lang === "es" ? "es-CO" : "en-US";
  const now = new Date();
  const out: { start: number; end: number; label: string; total: number }[] = [];
  if (grain === "week" || grain === "month") {
    const days = grain === "week" ? 7 : 30;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    for (let i = days - 1; i >= 0; i--) {
      const s = today - i * DAY; const d = new Date(s);
      out.push({ start: s, end: s + DAY, total: 0,
        label: grain === "week" ? d.toLocaleDateString(loc, { weekday: "short" }) : (i % 5 === 0 ? String(d.getDate()) : "") });
    }
  } else if (grain === "year") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      out.push({ start: d.getTime(), end: e.getTime(), total: 0, label: d.toLocaleDateString(loc, { month: "narrow" }) });
    }
  } else {
    const first = rows.length ? new Date(rows[rows.length - 1].occurred_at).getFullYear() : now.getFullYear();
    for (let y = Math.min(first, now.getFullYear() - 1); y <= now.getFullYear(); y++)
      out.push({ start: new Date(y, 0, 1).getTime(), end: new Date(y + 1, 0, 1).getTime(), total: 0, label: String(y) });
  }
  rows.forEach(r => { const t = new Date(r.occurred_at).getTime(); const b = out.find(x => t >= x.start && t < x.end); if (b) b.total += r.amount; });
  return out;
}
function periodStart(grain: Grain): number {
  const now = Date.now();
  return grain === "week" ? now - 7 * DAY : grain === "month" ? now - 30 * DAY : grain === "year" ? now - 365 * DAY : 0;
}

function Bars({ data, color, cur, lang }: { data: { label: string; total: number }[]; color: string; cur: string; lang: string }) {
  const peak = Math.max(1, ...data.map(d => d.total));
  return (
    <div>
      <div className="flex h-[120px] items-end gap-[3px]" role="img" aria-label={W(lang, "Chart over time", "Gráfica en el tiempo")}>
        {data.map((d, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div className="w-full rounded-t-[3px]" title={`${d.label} · ${fmt(d.total, cur, lang)}`}
              style={{ height: `${(d.total / peak) * 100}%`, minHeight: d.total ? 3 : 0, background: color }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {data.map((d, i) => <span key={i} className="flex-1 text-center text-[10px] font-bold capitalize opacity-55">{d.label}</span>)}
      </div>
    </div>
  );
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  return photo
    ? <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" loading="lazy" />
    : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/10 text-[14px] font-black dark:bg-white/15" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>;
}

export default function MoneyDashboard() {
  const { lang } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState(false);
  const [cur, setCur] = useState<string | null>(null);
  const [dir, setDir] = useState<Dir | null>(null);
  const [grain, setGrain] = useState<Grain>("month");
  const [group, setGroup] = useState<Group>("people");
  const [drill, setDrill] = useState<Drill>(null);

  useEffect(() => {
    supabase.rpc("my_money_activity_v2" as never, { p_limit: 2000 } as never).then(({ data, error }) => {
      if (error) { setErr(true); setRows([]); return; }
      setRows(((data ?? []) as Row[]).map(r => ({ ...r, amount: Number(r.amount) })));
    });
  }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [drill]);

  const all = rows ?? [];
  const currencies = useMemo(() => {
    const c = new Map<string, number>(); all.forEach(r => c.set(r.currency, (c.get(r.currency) ?? 0) + r.amount));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [all]);
  const currency = cur && currencies.includes(cur) ? cur : currencies[0] ?? "COP";
  const live = all.filter(r => r.currency === currency && r.state !== "refunded");
  /* Open on whichever side this person mostly lives on: a pro sees money received, a client money paid. */
  const inTotal = live.filter(r => r.direction === "in").reduce((s, r) => s + r.amount, 0);
  const outTotal = live.filter(r => r.direction === "out").reduce((s, r) => s + r.amount, 0);
  const side: Dir = dir ?? (inTotal >= outTotal ? "in" : "out");
  const sideRows = live.filter(r => r.direction === side);
  const color = side === "in" ? "#0FB5A6" : "#6D5BE0";

  const start = periodStart(grain);
  const inPeriod = sideRows.filter(r => new Date(r.occurred_at).getTime() >= start);
  const prevStart = grain === "all" ? 0 : start - (Date.now() - start);
  const prevTotal = grain === "all" ? 0 : sideRows.filter(r => { const t = new Date(r.occurred_at).getTime(); return t >= prevStart && t < start; })
    .reduce((s, r) => s + r.amount, 0);
  const total = inPeriod.reduce((s, r) => s + r.amount, 0);
  const people = new Set(inPeriod.map(personKey)).size;
  const delta = grain !== "all" && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const pending = sideRows.filter(r => r.state === "on_the_way" || r.state === "held").reduce((s, r) => s + r.amount, 0);

  const ranked = useMemo(() => {
    const m = new Map<string, { key: string; name: string; photo: string | null; sub: string; total: number; count: number }>();
    inPeriod.forEach(r => {
      const key = group === "people" ? personKey(r) : group === "categories" ? r.category : r.app;
      const v = m.get(key) ?? {
        key, total: 0, count: 0, photo: group === "people" ? r.cp_photo : null,
        name: group === "people" ? tx(r.cp_name, lang) : group === "categories" ? (lang === "es" ? CAT_ES[r.category] ?? r.category : r.category) : APP_NAME[r.app] ?? r.app,
        sub: group === "people" ? (lang === "es" ? CAT_ES[r.category] ?? r.category : r.category) : "",
      };
      v.total += r.amount; v.count += 1; m.set(key, v);
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [inPeriod, group, lang]);

  const PERIOD = { week: W(lang, "this week", "esta semana"), month: W(lang, "in the last 30 days", "en los últimos 30 días"),
    year: W(lang, "in the last 12 months", "en los últimos 12 meses"), all: W(lang, "all time", "en total") }[grain];
  const PREV = { week: W(lang, "last week", "la semana anterior"), month: W(lang, "the 30 days before", "los 30 días anteriores"),
    year: W(lang, "the year before", "el año anterior"), all: "" }[grain];

  const chip = (on: boolean) => `ow-tap h-9 rounded-full px-3.5 text-[13px] font-extrabold ${on ? "bg-[#2C2622] text-white dark:bg-white dark:text-[#201B16]" : "border border-ink/20 dark:border-white/25"}`;

  /* ── DRILL: ONE PERSON, ONE CATEGORY OR ONE APP ─────────────────────────────────────────── */
  if (drill && rows) {
    const mineAll = all.filter(r => r.currency === currency);
    const sel = mineAll.filter(r => drill.kind === "person" ? personKey(r) === drill.key
      : drill.kind === "category" ? r.category === drill.key && r.direction === side : r.app === drill.key && r.direction === side);
    const counted = sel.filter(r => r.state !== "refunded");
    const youPaid = counted.filter(r => r.direction === "out").reduce((s, r) => s + r.amount, 0);
    const youGot = counted.filter(r => r.direction === "in").reduce((s, r) => s + r.amount, 0);
    const n = counted.length;
    const avg = n ? (youPaid + youGot) / n : 0;
    const first = sel.length ? new Date(sel[sel.length - 1].occurred_at) : null;
    const last = sel.length ? new Date(sel[0].occurred_at) : null;
    const head = sel[0];
    const title = drill.kind === "person" ? (head ? tx(head.cp_name, lang) : "—")
      : drill.kind === "category" ? (lang === "es" ? CAT_ES[drill.key] ?? drill.key : drill.key) : APP_NAME[drill.key] ?? drill.key;
    const inside = drill.kind !== "person" ? (() => {
      const m = new Map<string, { key: string; name: string; photo: string | null; total: number; count: number }>();
      counted.forEach(r => { const k = personKey(r); const v = m.get(k) ?? { key: k, name: tx(r.cp_name, lang), photo: r.cp_photo, total: 0, count: 0 }; v.total += r.amount; v.count++; m.set(k, v); });
      return [...m.values()].sort((a, b) => b.total - a.total);
    })() : [];
    return (
      <div className="space-y-4 pb-10" data-ow="money-drill">
        <button type="button" onClick={() => setDrill(null)} className="ow-tap px-1 text-[14px] font-bold">← {W(lang, "Money", "Dinero")}</button>
        <div className="flex items-center gap-3 px-1">
          {drill.kind === "person" && head && <Avatar name={head.cp_name} photo={head.cp_photo} />}
          <div className="min-w-0">
            <h1 className="m-0 truncate text-[24px] font-black">{title}</h1>
            {drill.kind === "person" && head && <p className="m-0 text-[13px] opacity-60">{lang === "es" ? CAT_ES[head.category] ?? head.category : head.category}</p>}
          </div>
        </div>
        <div className={`grid gap-3 ${youPaid > 0 && youGot > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
          {youPaid > 0 && (
            <div className="card p-4"><p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] opacity-55">
              {drill.kind === "person" ? W(lang, "You paid them", "Usted les pagó") : W(lang, "You paid", "Usted pagó")}</p>
              <p className="m-0 mt-1 text-[19px] font-black tabular-nums" style={{ color: "#6D5BE0" }}>{fmt(youPaid, currency, lang)}</p></div>
          )}
          {youGot > 0 && (
            <div className="card p-4"><p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] opacity-55">
              {drill.kind === "person" ? W(lang, "They paid you", "Le pagaron") : W(lang, "You received", "Usted recibió")}</p>
              <p className="m-0 mt-1 text-[19px] font-black tabular-nums text-teal-dark dark:text-teal">{fmt(youGot, currency, lang)}</p></div>
          )}
        </div>
        {/* One row of facts, so the grid never leaves a hole. */}
        <div className="card grid grid-cols-3 divide-x divide-ink/10 p-0 dark:divide-white/10">
          <div className="p-3 text-center"><p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] opacity-55">{W(lang, "Payments", "Pagos")}</p>
            <p className="m-0 mt-1 text-[18px] font-black tabular-nums">{n}</p></div>
          <div className="p-3 text-center"><p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] opacity-55">{W(lang, "Average", "Promedio")}</p>
            <p className="m-0 mt-1 text-[14px] font-black tabular-nums">{fmt(avg, currency, lang)}</p></div>
          <div className="p-3 text-center"><p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] opacity-55">{W(lang, "Since", "Desde")}</p>
            <p className="m-0 mt-1 text-[14px] font-black">{first ? `${dateShort(first, lang)} ${String(first.getFullYear()).slice(2)}` : "—"}</p>
            {first && last && last.toDateString() !== first.toDateString() && (
              <p className="m-0 text-[11px] opacity-60">{W(lang, "Last", "Último")} {dateShort(last, lang)}</p>
            )}</div>
        </div>
        <div className="card p-4">
          <p className="m-0 mb-3 text-[14px] font-extrabold">{W(lang, "Last 12 months", "Últimos 12 meses")}</p>
          <Bars data={buckets("year", counted, lang)} color={youGot > youPaid ? "#0FB5A6" : "#6D5BE0"} cur={currency} lang={lang} />
        </div>
        {inside.length > 0 && (
          <div>
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] opacity-45">{W(lang, "People", "Personas")}</p>
            <div className="card divide-y divide-ink/5 p-2 dark:divide-white/10">
              {inside.map(p => (
                <button key={p.key} type="button" onClick={() => setDrill({ kind: "person", key: p.key })}
                  className="ow-tap flex w-full items-center gap-3 px-2 py-2.5 text-left">
                  <Avatar name={p.name} photo={p.photo} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-bold">{p.name}</span>
                    <span className="block text-[12px] opacity-60">{p.count} {p.count === 1 ? W(lang, "payment", "pago") : W(lang, "payments", "pagos")}</span></span>
                  <span className="text-[14px] font-extrabold tabular-nums">{fmt(p.total, currency, lang)}</span><span className="opacity-30">›</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] opacity-45">{W(lang, "Every payment", "Todos los pagos")}</p>
          <PaymentList rows={sel} lang={lang} showWho={drill.kind !== "person"} />
        </div>
      </div>
    );
  }

  /* ── OVERVIEW ───────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 pb-10" data-ow="money-dashboard">
      <ScreenHeading>{W(lang, "Money", "Dinero")}</ScreenHeading>

      {rows === null ? (
        <div className="card p-5 text-sm opacity-60">{W(lang, "Loading…", "Cargando…")}</div>
      ) : err ? (
        <div className="card p-5 text-sm">{W(lang, "Couldn't load your money right now. Try again.", "No se pudo cargar su dinero ahora. Intente de nuevo.")}</div>
      ) : !all.length ? (
        <div className="card p-5 text-center">
          <p className="m-0 text-[16px] font-extrabold">{W(lang, "No money moved yet", "Aún no hay movimientos")}</p>
          <p className="m-0 mt-1 text-[13.5px] opacity-65">{W(lang, "What you pay and get paid in any app shows up here: who, how much and when.", "Aquí verá lo que paga y le pagan en cualquier app: a quién, cuánto y cuándo.")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-ink/10 p-1 dark:border-white/15" role="tablist">
            {(["in", "out"] as Dir[]).map(d => (
              <button key={d} type="button" role="tab" aria-selected={side === d} onClick={() => setDir(d)}
                className={`ow-tap h-11 rounded-[14px] text-[15px] font-extrabold ${side === d ? "bg-[#2C2622] text-white dark:bg-white dark:text-[#201B16]" : ""}`}>
                {d === "in" ? W(lang, "Received", "Recibido") : W(lang, "Paid", "Pagado")}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["week", "month", "year", "all"] as Grain[]).map(g => (
              <button key={g} type="button" onClick={() => setGrain(g)} className={chip(grain === g)} aria-pressed={grain === g}>
                {{ week: W(lang, "Week", "Semana"), month: W(lang, "Month", "Mes"), year: W(lang, "Year", "Año"), all: W(lang, "All", "Todo") }[g]}
              </button>
            ))}
            {currencies.length > 1 && (
              <select value={currency} onChange={e => setCur(e.target.value)} aria-label={W(lang, "Currency", "Moneda")}
                className="ml-auto h-9 rounded-full border border-ink/20 bg-transparent px-3 text-[13px] font-extrabold dark:border-white/25">
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          <div className="card p-4" data-ow-money={side}>
            <p className="m-0 text-[13px] font-bold opacity-60">
              {side === "in" ? W(lang, "You received", "Usted recibió") : W(lang, "You paid", "Usted pagó")} {PERIOD}
            </p>
            <p className="m-0 mt-1 text-[30px] font-black leading-tight tabular-nums" style={{ color }}>{fmt(total, currency, lang)}</p>
            <p className="m-0 mt-1 text-[13px] opacity-75">
              {inPeriod.length} {inPeriod.length === 1 ? W(lang, "payment", "pago") : W(lang, "payments", "pagos")}
              {" · "}{people} {people === 1 ? W(lang, "person", "persona") : W(lang, "people", "personas")}
              {inPeriod.length > 0 && <>{" · "}{W(lang, "avg", "prom.")} {fmt(total / inPeriod.length, currency, lang)}</>}
            </p>
            {delta !== null && (
              <p className={`m-0 mt-1 text-[13px] font-bold ${delta >= 0 ? "text-teal-dark dark:text-teal" : "text-[#C0392B] dark:text-[#FF8A80]"}`}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% {W(lang, "vs", "vs.")} {PREV}
              </p>
            )}
            {pending > 0 && (
              <p className="m-0 mt-2 rounded-xl bg-ink/[0.05] px-3 py-2 text-[12.5px] font-semibold dark:bg-white/[0.08]">
                {side === "in"
                  ? `${fmt(pending, currency, lang)} ${W(lang, "of this is still on its way to you.", "de esto aún va en camino a usted.")}`
                  : `${fmt(pending, currency, lang)} ${W(lang, "of this is held until the work is done.", "de esto está retenido hasta terminar el trabajo.")}`}
              </p>
            )}
            <div className="mt-4"><Bars data={buckets(grain, sideRows, lang)} color={color} cur={currency} lang={lang} /></div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="m-0 text-[13px] font-extrabold">
                {side === "in" ? W(lang, "Who paid you", "Quién le pagó") : W(lang, "Who you paid", "A quién le pagó")}
              </p>
              <div className="flex gap-1">
                {(["people", "categories", "apps"] as Group[]).map(g => (
                  <button key={g} type="button" onClick={() => setGroup(g)} aria-pressed={group === g}
                    className={`ow-tap rounded-full px-2.5 py-1 text-[12px] font-extrabold ${group === g ? "bg-ink/10 dark:bg-white/15" : "opacity-60"}`}>
                    {{ people: W(lang, "People", "Personas"), categories: W(lang, "Categories", "Categorías"), apps: "Apps" }[g]}
                  </button>
                ))}
              </div>
            </div>
            {ranked.length === 0 ? (
              <div className="card p-4 text-[13.5px] opacity-65">{W(lang, "Nothing in this period.", "Nada en este periodo.")}</div>
            ) : (
              <div className="card divide-y divide-ink/5 p-2 dark:divide-white/10">
                {ranked.map(x => (
                  <button key={x.key} type="button"
                    onClick={() => setDrill(group === "people" ? { kind: "person", key: x.key } : group === "categories" ? { kind: "category", key: x.key } : { kind: "app", key: x.key })}
                    className="ow-tap flex w-full items-center gap-3 px-2 py-2.5 text-left">
                    {group === "people" && <Avatar name={x.name} photo={x.photo} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold">{x.name}</span>
                      <span className="block text-[12px] opacity-60">
                        {x.sub ? `${x.sub} · ` : ""}{x.count} {x.count === 1 ? W(lang, "payment", "pago") : W(lang, "payments", "pagos")}
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink/[0.07] dark:bg-white/10">
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (x.total / (ranked[0]?.total || 1)) * 100)}%`, background: color }} />
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[14px] font-extrabold tabular-nums">{fmt(x.total, currency, lang)}</span>
                      <span className="block text-[11px] opacity-55">{total ? Math.round((x.total / total) * 100) : 0}%</span>
                    </span>
                    <span className="opacity-30">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 px-1 text-[13px] font-extrabold">{W(lang, "Recent payments", "Pagos recientes")}</p>
            <PaymentList rows={all.filter(r => r.currency === currency && r.direction === side).slice(0, 15)} lang={lang} showWho />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/jobs/wallet" className="card ow-tap p-3 text-center text-[13px] font-bold">{W(lang, "Wallet (how to pay)", "Billetera (cómo pagar)")}</Link>
        <Link to="/jobs/payout" className="card ow-tap p-3 text-center text-[13px] font-bold">{W(lang, "Payout (how you get paid)", "Cobros (cómo le pagan)")}</Link>
      </div>
    </div>
  );
}

function PaymentList({ rows, lang, showWho }: { rows: Row[]; lang: string; showWho: boolean }) {
  if (!rows.length) return <div className="card p-4 text-[13.5px] opacity-65">{W(lang, "No payments yet.", "Aún no hay pagos.")}</div>;
  return (
    <div className="card divide-y divide-ink/5 p-2 dark:divide-white/10">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-black ${r.direction === "in" ? "bg-teal/15 text-teal-dark dark:text-teal" : "bg-[#6D5BE0]/15 text-[#6D5BE0]"}`} aria-hidden>
            {r.direction === "in" ? "↓" : "↑"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold">{showWho ? tx(r.cp_name, lang) : tx(r.label, lang)}</span>
            <span className="block truncate text-[11.5px] opacity-60">
              {showWho ? `${tx(r.label, lang)} · ` : ""}{APP_NAME[r.app] ?? r.app} · {dateShort(new Date(r.occurred_at), lang)} · {STATE(lang)[r.state] ?? r.state}
            </span>
          </span>
          <span className={`shrink-0 text-[14px] font-extrabold tabular-nums ${r.direction === "in" ? "text-teal-dark dark:text-teal" : ""} ${r.state === "refunded" ? "line-through opacity-50" : ""}`}>
            {r.direction === "in" ? "+" : "−"}{fmt(r.amount, r.currency, lang)}
          </span>
        </div>
      ))}
    </div>
  );
}
