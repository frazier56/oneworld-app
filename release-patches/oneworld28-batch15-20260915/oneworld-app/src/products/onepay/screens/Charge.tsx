import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ScreenHeading, useAsync, productHref, NavIcon } from "@oneworld/shell";
import { useT } from "../lib/dict";
import { useMerchant } from "../lib/useMerchant";
import {
  listCatalog, openOrder, startAttempt, confirmTransfer, cancelAttempt, fetchAttempt,
  money, parsePesos, idem, type LineInput, type Method, type Order, type Attempt, type CatalogItem,
} from "../lib/data";
import Setup from "./Setup";

/**
 * CHARGE — the one screen OnePay exists for. Three steps on one screen:
 *   build the charge → pick how the customer pays → watch the real result.
 * The browser sends LINES, never a total. The server prices the lines, freezes the order, and
 * the attempt's state is whatever the server says it is. Cash is paid on the spot by the person
 * holding the cash; a transfer waits for a manager to confirm arrival; tap/link/QR are shown only
 * when the merchant's provider has switched them on — otherwise the buttons do not exist.
 */
type Line = LineInput & { key: string; label: string; unit: number };

export default function Charge() {
  const { t, lang } = useT();
  const m = useMerchant();
  const catalog = useAsync(async () => m.merchant ? listCatalog(m.merchant.id) : [], [m.merchant?.id]);
  const [lines, setLines] = useState<Line[]>([]);
  const [amount, setAmount] = useState(""); const [desc, setDesc] = useState("");
  const [discount, setDiscount] = useState(""); const [tip, setTip] = useState(""); const [customer, setCustomer] = useState(""); const [note, setNote] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unit * l.qty, 0), [lines]);
  const total = Math.max(0, subtotal - parsePesos(discount) + parsePesos(tip));

  // poll a pending provider attempt so the screen follows the server, not a callback
  useEffect(() => {
    if (!attempt || !["pending", "unresolved"].includes(attempt.state) || attempt.method === "transfer") return;
    const id = window.setInterval(async () => { const a = await fetchAttempt(attempt.id); if (a) setAttempt(a); }, 3000);
    return () => window.clearInterval(id);
  }, [attempt]);

  if (m.status === "loading") return <p className="px-4 py-10 text-center text-sm opacity-50">{t("loading")}</p>;
  if (!m.userId) return <p className="px-4 py-10 text-center text-sm opacity-60">{t("signInFirst")}</p>;
  if (m.status === "none") return <Setup onCreated={m.refresh} />;
  if (!m.merchant) return null;
  const merchant = m.merchant;

  const addCustom = () => {
    const unit = parsePesos(amount); if (unit <= 0) return;
    setLines(ls => [...ls, { key: idem(), name: desc.trim() || undefined, unit_minor: unit, qty: 1, label: desc.trim() || t("customLine"), unit }]);
    setAmount(""); setDesc("");
  };
  const addItem = (c: CatalogItem) => setLines(ls => {
    const i = ls.findIndex(l => l.catalog_item_id === c.id);
    if (i >= 0) { const c2 = [...ls]; c2[i] = { ...c2[i], qty: c2[i].qty + 1 }; return c2; }
    return [...ls, { key: idem(), catalog_item_id: c.id, qty: 1, label: c.name, unit: c.price_minor }];
  });
  const setQty = (key: string, qty: number) => setLines(ls => qty <= 0 ? ls.filter(l => l.key !== key) : ls.map(l => l.key === key ? { ...l, qty } : l));

  async function review() {
    if (!lines.length) { setErr(t("emptyLines")); return; }
    setBusy(true); setErr(null);
    try {
      const o = await openOrder(merchant.id, lines.map(({ key: _k, label: _l, unit: _u, ...rest }) => rest), parsePesos(discount), parsePesos(tip), note, customer);
      setOrder(o);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  async function pay(method: Method) {
    if (!order) return;
    setBusy(true); setErr(null);
    try { setAttempt(await startAttempt(order.id, method, idem(), method === "transfer" ? ref : undefined)); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!attempt) return; setBusy(true); setErr(null);
    try { setAttempt(await confirmTransfer(attempt.id, ref)); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  async function cancel() {
    if (!attempt) return; setBusy(true); setErr(null);
    try { setAttempt(await cancelAttempt(attempt.id)); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const reset = () => { setLines([]); setOrder(null); setAttempt(null); setRef(""); setDiscount(""); setTip(""); setCustomer(""); setNote(""); setErr(null); };

  /* ── step 3: result ── */
  if (attempt) {
    const st = attempt.state;
    const label = st === "paid" ? t("paid") : st === "failed" ? t("failed") : st === "voided" ? t("voided") : st === "unresolved" ? t("unresolved") : t("pendingState");
    const tone = st === "paid" ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : st === "failed" || st === "voided" ? "bg-rose-500/15 text-rose-700 dark:text-rose-200" : "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    return (
      <div className="px-4 pb-10">
        <ScreenHeading>{t("chargeTitle")}</ScreenHeading>
        <section className="card mt-4 !rounded-2xl !p-5 text-center">
          <span className={`inline-block rounded-full px-3 py-1 text-[12px] font-black ${tone}`}>{label}</span>
          <p className="mt-3 text-3xl font-black tabular-nums">{money(attempt.amount_minor, lang)}</p>
          <p className="mt-1 text-[12.5px] opacity-60">#{order?.order_no} · {t(attempt.method === "cash" ? "cash" : attempt.method === "transfer" ? "transfer" : attempt.method === "tap" ? "tap" : attempt.method === "qr" ? "qr" : "link")}</p>
          {st === "pending" && attempt.method === "transfer" && (
            <div className="mt-4 text-left">
              <p className="text-[12px] opacity-70">{t("transferHint")}</p>
              <input className="field mt-2 w-full" value={ref} onChange={e => setRef(e.target.value)} placeholder={t("transferRef")} />
              <button type="button" onClick={confirm} disabled={busy} className="btn-primary mt-2 w-full disabled:opacity-50">{t("confirmTransfer")}</button>
              <button type="button" onClick={cancel} disabled={busy} className="ow-tap mt-2 w-full rounded-xl border border-ink/15 py-3 text-sm font-bold dark:border-white/15">{t("cancelAttempt")}</button>
            </div>
          )}
          {st === "pending" && attempt.method !== "transfer" && (
            <div className="mt-4"><p className="text-[12.5px] opacity-70">{t("startTap")}</p>
              {!attempt.provider_ref && <button type="button" onClick={cancel} disabled={busy} className="ow-tap mt-3 w-full rounded-xl border border-ink/15 py-3 text-sm font-bold dark:border-white/15">{t("cancelAttempt")}</button>}
            </div>
          )}
          {st === "failed" && attempt.failure_reason && <p className="mt-2 text-[12px] opacity-70">{attempt.failure_reason}</p>}
          {err && <p role="alert" className="mt-3 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2">
            {st === "paid" && order && <Link to={productHref("onepay", `/receipt/${order.id}`)} className="btn-primary text-center">{t("receipt")}</Link>}
            <button type="button" onClick={reset} className={`card ow-tap !rounded-xl !py-3 text-sm font-bold ${st === "paid" ? "" : "col-span-2"}`}>{t("another")}</button>
          </div>
        </section>
      </div>
    );
  }

  /* ── step 2: method ── */
  if (order) {
    const all: { id: Method; label: string; on: boolean }[] = [
      { id: "cash", label: t("cash"), on: true },
      { id: "transfer", label: t("transfer"), on: true },
      { id: "tap", label: t("tap"), on: merchant.tap_enabled },
      { id: "link", label: t("link"), on: merchant.link_enabled },
      { id: "qr", label: t("qr"), on: merchant.qr_enabled },
    ];
    const methods = all.filter(x => x.on);   // hidden, not disabled — the light-up-when-configured rule
    return (
      <div className="px-4 pb-10">
        <ScreenHeading>{t("chargeTitle")}</ScreenHeading>
        <section className="card mt-4 !rounded-2xl !p-4">
          <p className="text-[12px] font-bold uppercase tracking-wide opacity-60">{t("total")} · #{order.order_no}</p>
          <p className="text-3xl font-black tabular-nums">{money(order.total_minor, lang)}</p>
          {(order.discount_minor > 0 || order.tip_minor > 0) && <p className="mt-1 text-[12px] opacity-60">{t("subtotal")} {money(order.subtotal_minor, lang)}{order.discount_minor > 0 ? ` · ${t("discount")} −${money(order.discount_minor, lang)}` : ""}{order.tip_minor > 0 ? ` · ${t("tip")} +${money(order.tip_minor, lang)}` : ""}</p>}
        </section>
        <h2 className="mt-5 text-sm font-black">{t("howPaid")}</h2>
        <div className="mt-2 space-y-2">
          {methods.map(x => (
            <button key={x.id} type="button" disabled={busy} onClick={() => pay(x.id)}
              className="card ow-tap flex w-full items-center justify-between !rounded-2xl !p-4 text-left text-[14px] font-bold disabled:opacity-50">
              <span>{x.label}</span><NavIcon name={x.id === "tap" ? "device" : x.id === "qr" ? "qr" : x.id === "link" ? "connect" : "money"} className="text-brand" />
            </button>
          ))}
        </div>
        {err && <p role="alert" className="mt-3 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
        <button type="button" onClick={reset} disabled={busy} className="ow-tap mt-4 w-full rounded-xl border border-ink/15 py-3 text-sm font-bold dark:border-white/15">{t("void")}</button>
      </div>
    );
  }

  /* ── step 1: build ── */
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("chargeTitle")}</ScreenHeading>
      <section className="card mt-4 !rounded-2xl !p-4">
        <label className="block text-[12px] font-bold opacity-65">{t("amount")}</label>
        <div className="mt-1 flex gap-2">
          <input className="field w-full text-xl font-black tabular-nums" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" aria-label={t("amount")} />
          <button type="button" onClick={addCustom} disabled={parsePesos(amount) <= 0} className="btn-primary shrink-0 px-4 disabled:opacity-50">+</button>
        </div>
        <input className="field mt-2 w-full" value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("description")} maxLength={80} />
      </section>
      {catalog && catalog.filter(c => c.active).length > 0 && (
        <section className="mt-3">
          <p className="text-[12px] font-bold opacity-65">{t("addItem")}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {catalog.filter(c => c.active).map(c => (
              <button key={c.id} type="button" onClick={() => addItem(c)} className="card ow-tap !rounded-full !px-3 !py-1.5 text-[12.5px] font-bold">{c.name} · {money(c.price_minor, lang)}</button>
            ))}
          </div>
        </section>
      )}
      {lines.length > 0 && (
        <section className="card mt-3 !rounded-2xl !p-4">
          <ul className="space-y-2">
            {lines.map(l => (
              <li key={l.key} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-bold">{l.label}</span>
                <span className="flex items-center gap-1">
                  <button type="button" aria-label="−" onClick={() => setQty(l.key, l.qty - 1)} className="ow-tap h-8 w-8 rounded-full border border-ink/15 dark:border-white/15">−</button>
                  <span className="w-6 text-center tabular-nums">{l.qty}</span>
                  <button type="button" aria-label="+" onClick={() => setQty(l.key, l.qty + 1)} className="ow-tap h-8 w-8 rounded-full border border-ink/15 dark:border-white/15">+</button>
                </span>
                <span className="w-28 text-right tabular-nums font-bold">{money(l.unit * l.qty, lang)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block"><span className="text-[11px] font-bold opacity-60">{t("discount")}</span><input className="field mt-1 w-full tabular-nums" inputMode="numeric" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" /></label>
            <label className="block"><span className="text-[11px] font-bold opacity-60">{t("tip")}</span><input className="field mt-1 w-full tabular-nums" inputMode="numeric" value={tip} onChange={e => setTip(e.target.value)} placeholder="0" /></label>
          </div>
          <input className="field mt-2 w-full" value={customer} onChange={e => setCustomer(e.target.value)} placeholder={t("customer")} maxLength={80} />
          <input className="field mt-2 w-full" value={note} onChange={e => setNote(e.target.value)} placeholder={t("note")} maxLength={200} />
          <div className="mt-3 flex items-baseline justify-between border-t border-ink/10 pt-2 dark:border-white/10">
            <span className="text-sm font-black">{t("total")}</span><span className="text-xl font-black tabular-nums">{money(total, lang)}</span>
          </div>
        </section>
      )}
      {err && <p role="alert" className="mt-3 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
      <button type="button" onClick={review} disabled={busy || !lines.length} className="btn-primary mt-4 w-full disabled:opacity-50">{t("review")}</button>
    </div>
  );
}
