import { useState } from "react";
import { ScreenHeading, useAsync } from "@oneworld/shell";
import { useT } from "../lib/dict";
import { useMerchant } from "../lib/useMerchant";
import { listCatalog, upsertCatalogItem, money, parsePesos } from "../lib/data";

export default function Catalog() {
  const { t, lang } = useT();
  const m = useMerchant();
  const [tick, setTick] = useState(0);
  const items = useAsync(async () => m.merchant ? listCatalog(m.merchant.id) : [], [m.merchant?.id, tick]);
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function save(id: string | null, n: string, p: number, active: boolean) {
    if (!m.merchant) return; setBusy(true); setErr(null);
    try { await upsertCatalogItem(m.merchant.id, id, n, p, active); setName(""); setPrice(""); setTick(x => x + 1); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("catalogTitle")}</ScreenHeading>
      <p className="mt-1 text-[13px] opacity-70">{t("catalogBody")}</p>
      <form onSubmit={e => { e.preventDefault(); if (name.trim() && parsePesos(price) >= 0) void save(null, name.trim(), parsePesos(price), true); }} className="card mt-4 flex gap-2 !rounded-2xl !p-3">
        <input className="field min-w-0 flex-1" value={name} onChange={e => setName(e.target.value)} placeholder={t("itemName")} maxLength={80} />
        <input className="field w-28 tabular-nums" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder={t("price")} />
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary shrink-0 px-3 disabled:opacity-50">{t("add")}</button>
      </form>
      {err && <p role="alert" className="mt-2 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
      <ul className="mt-3 space-y-2">
        {(items ?? []).map(c => (
          <li key={c.id} className={`card flex items-center justify-between !rounded-2xl !p-3 ${c.active ? "" : "opacity-50"}`}>
            <div><p className="text-[13.5px] font-bold">{c.name}</p><p className="text-[12px] tabular-nums opacity-60">{money(c.price_minor, lang)}</p></div>
            <button type="button" disabled={busy} onClick={() => save(c.id, c.name, c.price_minor, !c.active)} className="ow-tap rounded-full border border-ink/15 px-3 py-1 text-[11.5px] font-bold dark:border-white/15">{c.active ? t("active") : t("inactive")}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
