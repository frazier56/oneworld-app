import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, supabase, productHref, W, Wt, ScreenHeading, monthYearLabel, intlLocale } from "@oneworld/shell";

/**
 * Dashboard — the numbers an agent, seller or landlord actually asks about.
 * ============================================================================================
 * Lee, 29 Sep 2026: *"how many sales you had, how much money you made per month, per year,
 * commission versus the actual revenue of the properties, the average ... what would an agent
 * want to know?"*
 *
 * ⚠️ REAL NUMBERS ONLY. Lee said "something you can kind of make up" about WHICH metrics — not
 * about their values. OneHome is the credibility-first platform; a dashboard showing sales that
 * never happened is the one screen that would make every other number on it suspect. So it reads
 * the signed agreements and leases, and shows zero until there is something to count.
 *
 * Money is summed PER CURRENCY and never converted: a peso sale and a dollar sale added together
 * at today's rate would be a number nobody earned.
 */
type Sale = { price: number; currency: string; commission_pct: number | null; completed_at: string | null;
  status: string; agent_id: string | null; created_by: string; property_id: string };
type Lease = { rent_amount: number; currency: string; status: string; starts_on: string; ends_on: string;
  bill_interval: "days" | "months"; bill_interval_count: number; property_id: string };

const fmt = (n: number, ccy: string, es: boolean) => {
  try { return new Intl.NumberFormat(es ? "es-CO" : "en-US", { style: "currency", currency: ccy, currencyDisplay: "code", maximumFractionDigits: 0 }).format(n).replace(/ /g, " "); }
  catch { return `${ccy} ${Math.round(n).toLocaleString()}`; }
};
const compact = (n: number, es: boolean) =>
  new Intl.NumberFormat(es ? "es-CO" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Monthly equivalent of a lease's rent. `days` leases quote a price per N days. */
const monthly = (l: Lease) => l.bill_interval === "months"
  ? l.rent_amount / Math.max(1, l.bill_interval_count || 1)
  : (l.rent_amount / Math.max(1, l.bill_interval_count || 1)) * 30;

function last12(): { key: string; start: Date; end: Date }[] {
  const now = new Date(); const out = [];
  for (let i = 11; i >= 0; i--) {
    const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push({ key: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`, start: s, end: e });
  }
  return out;
}

export default function Dashboard({ product }: { product: "onerental" | "onesale" }) {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const es = lang === "es" || lang === "co";
  const [side, setSide] = useState<"sale" | "rent">(product === "onesale" ? "sale" : "rent");

  const data = useAsync(async () => {
    if (!userId) return null;
    const [sa, rc, sp, rp, sh] = await Promise.all([
      supabase.from("sale_agreements").select("price, currency, commission_pct, completed_at, status, agent_id, created_by, property_id")
        .or(`created_by.eq.${userId},agent_id.eq.${userId},seller_id.eq.${userId}`).limit(1000),
      supabase.from("rental_contracts").select("rent_amount, currency, status, starts_on, ends_on, bill_interval, bill_interval_count, property_id")
        .eq("agent_id", userId).limit(1000),
      supabase.from("sale_properties").select("id, created_at, status").eq("agent_id", userId),
      supabase.from("rental_properties").select("id, status").eq("agent_id", userId),
      supabase.from("property_showings").select("id", { count: "exact", head: true }).eq("host_id", userId),
    ]);
    return {
      sales: (sa.data ?? []) as Sale[], leases: (rc.data ?? []) as Lease[],
      saleProps: (sp.data ?? []) as { id: string; created_at: string; status: string }[],
      rentProps: (rp.data ?? []) as { id: string; status: string }[],
      showings: sh.count ?? 0,
    };
  }, [userId]);

  const m = useMemo(() => {
    if (!data) return null;
    const months = last12();
    const now = new Date(); const y0 = new Date(now.getFullYear(), 0, 1); const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
    const closed = data.sales.filter(s => s.status === "signed" && s.completed_at);
    const ccys = [...new Set(closed.map(s => s.currency))];
    const main = ccys[0] ?? "COP";
    const earned = (s: Sale) => s.agent_id === userId && s.commission_pct ? s.price * s.commission_pct / 100 : 0;
    const byCcy = (f: (s: Sale) => number) => ccys.map(c => ({ c, v: closed.filter(s => s.currency === c).reduce((a, s) => a + f(s), 0) }));
    const created = new Map(data.saleProps.map(p => [p.id, p.created_at]));
    const dom = closed.map(s => created.get(s.property_id) ? (new Date(s.completed_at!).getTime() - new Date(created.get(s.property_id)!).getTime()) / 864e5 : null)
      .filter((x): x is number => x != null && x >= 0);
    const iAmAgent = closed.some(s => s.agent_id === userId);
    const saleSeries = months.map(mo => ({
      key: mo.key, start: mo.start,
      v: closed.filter(s => s.currency === main && new Date(s.completed_at!) >= mo.start && new Date(s.completed_at!) < mo.end)
        .reduce((a, s) => a + (iAmAgent ? earned(s) : s.price), 0),
    }));

    const live = data.leases.filter(l => ["active", "awaiting_first_payment", "ended"].includes(l.status));
    const today = now.toISOString().slice(0, 10);
    const active = live.filter(l => l.status === "active" && l.starts_on <= today && l.ends_on >= today);
    const rccys = [...new Set(live.map(l => l.currency))];
    const rmain = rccys[0] ?? "COP";
    const rentSeries = months.map(mo => {
      const a = mo.start.toISOString().slice(0, 10), b = mo.end.toISOString().slice(0, 10);
      return { key: mo.key, start: mo.start,
        v: live.filter(l => l.currency === rmain && l.starts_on < b && l.ends_on >= a).reduce((s, l) => s + monthly(l), 0) };
    });
    const in60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
    const published = data.rentProps.filter(p => p.status === "published").length;

    return {
      sale: {
        month: closed.filter(s => new Date(s.completed_at!) >= m0).length,
        year: closed.filter(s => new Date(s.completed_at!) >= y0).length,
        value: byCcy(s => s.price), commission: byCcy(earned),
        avg: ccys.map(c => { const xs = closed.filter(s => s.currency === c); return { c, v: xs.reduce((a, s) => a + s.price, 0) / Math.max(1, xs.length) }; }),
        dom: dom.length ? Math.round(dom.reduce((a, b) => a + b, 0) / dom.length) : null,
        pending: data.sales.filter(s => s.status === "sent").length,
        agreements: data.sales.filter(s => s.status !== "cancelled").length,
        showings: data.showings, iAmAgent, main, series: saleSeries,
      },
      rent: {
        active: active.length,
        occupancy: published ? Math.round(100 * new Set(active.map(l => l.property_id)).size / published) : null,
        monthly: rccys.map(c => ({ c, v: active.filter(l => l.currency === c).reduce((s, l) => s + monthly(l), 0) })),
        avg: rccys.map(c => { const xs = active.filter(l => l.currency === c); return { c, v: xs.reduce((s, l) => s + monthly(l), 0) / Math.max(1, xs.length) }; }),
        moveOuts: active.filter(l => l.ends_on <= in60).length,
        main: rmain, series: rentSeries,
      },
    };
  }, [data, userId]);

  const money = (xs: { c: string; v: number }[] | undefined) =>
    !xs || xs.length === 0 ? "0" : xs.map(x => fmt(x.v, x.c, es)).join(" + ");

  return (
    <div className="space-y-4 pb-28">
      <Link to={productHref(product, product === "onesale" ? "/seller" : "/host-profile")}
        className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, "Back to my profile", "Volver a mi perfil")}
      </Link>
      <ScreenHeading>{W(lang, "Dashboard", "Panel")}</ScreenHeading>

      <div className="grid grid-cols-2 gap-2">
        {(["sale", "rent"] as const).map(k => (
          <button key={k} type="button" onClick={() => setSide(k)} className={side === k ? "btn-primary" : "btn-ghost"}>
            {k === "sale" ? W(lang, "Sales", "Ventas") : W(lang, "Rentals", "Arriendos")}
          </button>
        ))}
      </div>

      {!m && <p className="py-8 text-center opacity-55">…</p>}

      {m && side === "sale" && (<>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={W(lang, "Sales this month", "Ventas este mes")} value={String(m.sale.month)} />
          <Tile label={W(lang, "Sales this year", "Ventas este año")} value={String(m.sale.year)} />
          <Tile wide label={W(lang, "Value sold", "Valor vendido")} value={money(m.sale.value)} />
          <Tile wide label={W(lang, "Commission earned", "Comisión ganada")} value={money(m.sale.commission)}
            note={W(lang, "Your share as the agent, from signed agreements", "Su parte como agente, de promesas firmadas")} />
          <Tile wide label={W(lang, "Average price", "Precio promedio")} value={money(m.sale.avg)} />
          <Tile label={W(lang, "Days on market", "Días en el mercado")} value={m.sale.dom == null ? "—" : String(m.sale.dom)} />
          <Tile label={W(lang, "Showings", "Visitas")} value={String(m.sale.showings)} />
          <Tile wide label={W(lang, "Agreements", "Promesas")} value={String(m.sale.agreements)}
            note={m.sale.pending ? Wt(lang, "{0} waiting for signatures", "{0} esperando firmas", [m.sale.pending]) : undefined} />
        </div>
        <Bars es={es} lang={lang} ccy={m.sale.main} series={m.sale.series}
          title={m.sale.iAmAgent ? W(lang, "Commission per month", "Comisión por mes") : W(lang, "Value sold per month", "Valor vendido por mes")} />
      </>)}

      {m && side === "rent" && (<>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={W(lang, "Active leases", "Arriendos vigentes")} value={String(m.rent.active)} />
          <Tile label={W(lang, "Occupancy", "Ocupación")} value={m.rent.occupancy == null ? "—" : `${m.rent.occupancy}%`}
            note={W(lang, "Of your published properties, rented today", "De sus inmuebles publicados, arrendados hoy")} />
          <Tile wide label={W(lang, "Rent under contract, per month", "Canon bajo contrato, por mes")} value={money(m.rent.monthly)} />
          <Tile wide label={W(lang, "Average rent", "Canon promedio")} value={money(m.rent.avg)} />
          <Tile wide label={W(lang, "Move-outs in 60 days", "Salidas en 60 días")} value={String(m.rent.moveOuts)} />
        </div>
        <Bars es={es} lang={lang} ccy={m.rent.main} series={m.rent.series} title={W(lang, "Rent under contract per month", "Canon bajo contrato por mes")} />
      </>)}

      <p className="text-center text-[11.5px] opacity-50">
        {W(lang, "From your signed agreements. Currencies are never mixed.", "De sus contratos firmados. Las monedas nunca se mezclan.")}
      </p>
    </div>
  );
}

function Tile({ label, value, note, wide }: { label: string; value: string; note?: string; wide?: boolean }) {
  return (
    <div className={`ow-panel p-3.5 ${wide ? "col-span-2" : ""}`}>
      <p className="text-[11.5px] font-bold uppercase tracking-wide opacity-55">{label}</p>
      <p className="mt-1 break-words text-[20px] font-black leading-tight">{value}</p>
      {note && <p className="mt-0.5 text-[11px] opacity-50">{note}</p>}
    </div>
  );
}

/** One series, so no legend — the title names it. Tap or hover a bar for its value. */
function Bars({ series, title, ccy, es, lang }: { series: { key: string; start: Date; v: number }[]; title: string; ccy: string; es: boolean; lang: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(0, ...series.map(s => s.v));
  const mon = (d: Date) => d.toLocaleDateString(intlLocale(lang), { month: "short" }).replace(".", "");
  const pick = sel ?? (max > 0 ? series.findIndex(s => s.v === max) : series.length - 1);
  const cur = series[pick];
  return (
    <section className="ow-panel p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">{title}</h2>
        <span className="shrink-0 text-[11.5px] opacity-50">{ccy}</span>
      </div>
      <p className="mt-1 text-[13px]">
        <span className="font-bold">{monthYearLabel(cur.start, lang)}</span>
        <span className="opacity-70"> · {fmt(cur.v, ccy, es)}</span>
      </p>
      <div className="mt-3 flex h-36 items-end gap-[2px] border-b border-current/15" role="img" aria-label={title}>
        {series.map((s, i) => (
          <button key={s.key} type="button" onClick={() => setSel(i)} onMouseEnter={() => setSel(i)}
            title={`${mon(s.start)} · ${fmt(s.v, ccy, es)}`}
            className="group flex h-full flex-1 items-end" aria-label={`${mon(s.start)} ${fmt(s.v, ccy, es)}`}>
            <span className={`block w-full rounded-t-[4px] ${i === pick ? "bg-teal-700 dark:bg-teal-300" : "bg-teal-600/70 dark:bg-teal-400/60"}`}
              style={{ height: max > 0 ? `${Math.max(s.v > 0 ? 3 : 0, (s.v / max) * 100)}%` : "0%" }} />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[9.5px] opacity-50">
        {series.map((s, i) => <span key={s.key} className="flex-1 text-center">{i % 2 === 0 ? mon(s.start) : ""}</span>)}
      </div>
      {max === 0 && <p className="mt-2 text-center text-[12px] opacity-55">{es ? "Aún no hay nada que contar." : "Nothing to count yet."}</p>}
      <p className="sr-only">{series.map(s => `${s.key}: ${compact(s.v, es)}`).join("; ")}</p>
    </section>
  );
}
