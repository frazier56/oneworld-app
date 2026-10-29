import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, ScreenHeading, W, useI18n } from "@oneworld/shell";

/* ============================================================================================
 * MONEY — one dashboard for everyone, across every app (Lee, 29 Oct 2026).
 * *"Everyone has a dashboard so you can see if they're making money, if people are paying them,
 * they're paying out money… two big categories: money received, money paid… some metrics and
 * probably some graphs."*
 * Read-only. Every figure comes from the records each app already keeps (my_money_activity).
 * Currencies are never added together: the screen shows one currency at a time.
 * ============================================================================================ */
type Row = { occurred_at: string; app: string; direction: "in" | "out"; amount: number; currency: string; label: string; state: string };

const APP_NAME: Record<string, string> = { onejob: "OneJob", oneride: "OneRide", oneevent: "OneEvent", onehome: "OneHome", onepay: "OnePay" };
const STATE = (lang: string): Record<string, string> => ({
  paid: W(lang, "Paid", "Pagado"), held: W(lang, "Held until done", "Retenido hasta terminar"),
  received: W(lang, "Received", "Recibido"), on_the_way: W(lang, "On the way", "En camino"), refunded: W(lang, "Refunded", "Reembolsado"),
});

const fmt = (n: number, cur: string, lang: string) =>
  new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", { style: "currency", currency: cur, currencyDisplay: "code", maximumFractionDigits: cur === "COP" ? 0 : 2 }).format(n);
const short = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n));

export default function MoneyDashboard() {
  const { lang } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState(false);
  const [cur, setCur] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("my_money_activity" as never, { p_limit: 1000 } as never).then(({ data, error }) => {
      if (error) { setErr(true); setRows([]); return; }
      setRows(((data ?? []) as Row[]).map(r => ({ ...r, amount: Number(r.amount) })));
    });
  }, []);

  const currencies = useMemo(() => {
    const c = new Map<string, number>();
    (rows ?? []).forEach(r => c.set(r.currency, (c.get(r.currency) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [rows]);
  const currency = cur && currencies.includes(cur) ? cur : currencies[0] ?? "COP";
  const mine = (rows ?? []).filter(r => r.currency === currency);
  const live = mine.filter(r => r.state !== "refunded");
  const sum = (f: (r: Row) => boolean) => live.filter(f).reduce((s, r) => s + r.amount, 0);
  const received = sum(r => r.direction === "in" && r.state === "received");
  const coming = sum(r => r.direction === "in" && r.state === "on_the_way");
  const paid = sum(r => r.direction === "out");
  const held = sum(r => r.direction === "out" && r.state === "held");

  /* Six months, oldest first. */
  const months = useMemo(() => {
    const out: { key: string; label: string; in: number; out: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(lang === "es" ? "es-CO" : "en-US", { month: "short" }), in: 0, out: 0 });
    }
    live.forEach(r => {
      const d = new Date(r.occurred_at); const m = out.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m[r.direction] += r.amount;
    });
    return out;
  }, [live, lang]);
  const peak = Math.max(1, ...months.flatMap(m => [m.in, m.out]));

  const byApp = useMemo(() => {
    const m = new Map<string, { in: number; out: number }>();
    live.forEach(r => { const v = m.get(r.app) ?? { in: 0, out: 0 }; v[r.direction] += r.amount; m.set(r.app, v); });
    return [...m.entries()].sort((a, b) => (b[1].in + b[1].out) - (a[1].in + a[1].out));
  }, [live]);

  return (
    <div className="space-y-4 pb-10" data-ow="money-dashboard">
      <ScreenHeading>{W(lang, "Money", "Dinero")}</ScreenHeading>

      {rows === null ? (
        <div className="card p-5 text-sm opacity-60">{W(lang, "Loading…", "Cargando…")}</div>
      ) : err ? (
        <div className="card p-5 text-sm">{W(lang, "Couldn't load your money right now. Try again.", "No se pudo cargar su dinero ahora. Intente de nuevo.")}</div>
      ) : !rows.length ? (
        <div className="card p-5 text-center">
          <p className="m-0 text-[16px] font-extrabold">{W(lang, "No money moved yet", "Aún no hay movimientos")}</p>
          <p className="m-0 mt-1 text-[13.5px] opacity-65">{W(lang, "Payments you make and receive in any app show up here.", "Aquí verá lo que paga y recibe en todas las apps.")}</p>
        </div>
      ) : (
        <>
          {currencies.length > 1 && (
            <div className="flex gap-2" role="tablist" aria-label={W(lang, "Currency", "Moneda")}>
              {currencies.map(c => (
                <button key={c} type="button" role="tab" aria-selected={c === currency} onClick={() => setCur(c)}
                  className={`ow-tap h-9 rounded-full px-4 text-[13px] font-extrabold ${c === currency ? "bg-[#2C2622] text-white dark:bg-white dark:text-[#201B16]" : "border border-ink/20 dark:border-white/25"}`}>{c}</button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4" data-ow-money="received">
              <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] opacity-55">{W(lang, "Money received", "Dinero recibido")}</p>
              <p className="m-0 mt-1 text-[20px] font-black tabular-nums text-teal-dark dark:text-teal">{fmt(received, currency, lang)}</p>
              {coming > 0 && <p className="m-0 mt-1 text-[12px] opacity-65">{fmt(coming, currency, lang)} {W(lang, "on the way", "en camino")}</p>}
            </div>
            <div className="card p-4" data-ow-money="paid">
              <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] opacity-55">{W(lang, "Money paid", "Dinero pagado")}</p>
              <p className="m-0 mt-1 text-[20px] font-black tabular-nums">{fmt(paid, currency, lang)}</p>
              {held > 0 && <p className="m-0 mt-1 text-[12px] opacity-65">{fmt(held, currency, lang)} {W(lang, "held until done", "retenido hasta terminar")}</p>}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <p className="m-0 text-[14px] font-extrabold">{W(lang, "Last 6 months", "Últimos 6 meses")}</p>
              <div className="flex items-center gap-3 text-[11.5px] font-bold opacity-75">
                <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0FB5A6]" />{W(lang, "Received", "Recibido")}</span>
                <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2C2622] dark:bg-white/80" />{W(lang, "Paid", "Pagado")}</span>
              </div>
            </div>
            <div className="mt-3 flex h-[140px] items-end gap-2" role="img"
              aria-label={W(lang, "Money received and paid by month", "Dinero recibido y pagado por mes")}>
              {months.map(m => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-[112px] w-full items-end justify-center gap-[3px]">
                    <div className="w-[42%] rounded-t-[4px] bg-[#0FB5A6]" style={{ height: `${(m.in / peak) * 100}%`, minHeight: m.in ? 3 : 0 }} title={fmt(m.in, currency, lang)} />
                    <div className="w-[42%] rounded-t-[4px] bg-[#2C2622] dark:bg-white/80" style={{ height: `${(m.out / peak) * 100}%`, minHeight: m.out ? 3 : 0 }} title={fmt(m.out, currency, lang)} />
                  </div>
                  <span className="text-[11px] font-bold capitalize opacity-60">{m.label}</span>
                </div>
              ))}
            </div>
            <p className="m-0 mt-2 text-right text-[11px] opacity-50">{W(lang, "Top of chart", "Tope de la gráfica")}: {short(peak)} {currency}</p>
          </div>

          {byApp.length > 0 && (
            <div className="card divide-y divide-ink/5 p-2 dark:divide-white/10">
              {byApp.map(([app, v]) => (
                <div key={app} className="flex items-center justify-between gap-3 px-2 py-2.5 text-[14px]">
                  <span className="font-bold">{APP_NAME[app] ?? app}</span>
                  <span className="text-right text-[12.5px] tabular-nums">
                    {v.in > 0 && <span className="block font-bold text-teal-dark dark:text-teal">+{fmt(v.in, currency, lang)}</span>}
                    {v.out > 0 && <span className="block opacity-75">−{fmt(v.out, currency, lang)}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] opacity-45">{W(lang, "Recent", "Recientes")}</p>
            <div className="card divide-y divide-ink/5 p-2 dark:divide-white/10">
              {mine.slice(0, 25).map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-black ${r.direction === "in" ? "bg-teal/15 text-teal-dark dark:text-teal" : "bg-ink/5 dark:bg-white/10"}`} aria-hidden>
                    {r.direction === "in" ? "↓" : "↑"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{r.label}</span>
                    <span className="block text-[11.5px] opacity-60">
                      {APP_NAME[r.app] ?? r.app} · {new Date(r.occurred_at).toLocaleDateString(lang === "es" ? "es-CO" : "en-US", { day: "numeric", month: "short" })} · {STATE(lang)[r.state] ?? r.state}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[14px] font-extrabold tabular-nums ${r.direction === "in" ? "text-teal-dark dark:text-teal" : ""} ${r.state === "refunded" ? "line-through opacity-50" : ""}`}>
                    {r.direction === "in" ? "+" : "−"}{fmt(r.amount, r.currency, lang)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/jobs/wallet" className="card ow-tap p-3 text-center text-[13.5px] font-bold">{W(lang, "Wallet (how to pay)", "Billetera (cómo pagar)")}</Link>
        <Link to="/jobs/payout" className="card ow-tap p-3 text-center text-[13.5px] font-bold">{W(lang, "Payout (how you get paid)", "Cobros (cómo le pagan)")}</Link>
      </div>
    </div>
  );
}
