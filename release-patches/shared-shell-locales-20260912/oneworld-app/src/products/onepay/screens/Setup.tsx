import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeading, productHref } from "@oneworld/shell";
import { useT } from "../lib/dict";
import { createMerchant } from "../lib/data";

export default function Setup({ onCreated }: { onCreated?: () => void }) {
  const { t } = useT(); const nav = useNavigate();
  const [name, setName] = useState(""); const [city, setCity] = useState(""); const [legal, setLegal] = useState(""); const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (name.trim().length < 2) return;
    setBusy(true); setErr(null);
    try { await createMerchant(name.trim(), city.trim(), legal.trim(), taxId.trim()); onCreated?.(); nav(productHref("onepay"), { replace: true }); }
    catch (x) { setErr(String((x as Error).message)); }
    finally { setBusy(false); }
  }
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("setupTitle")}</ScreenHeading>
      <p className="mt-1 text-[13.5px] leading-relaxed opacity-70">{t("setupBody")}</p>
      <form onSubmit={submit} className="card mt-4 space-y-3 !rounded-2xl !p-4">
        <label className="block"><span className="text-[12px] font-bold opacity-65">{t("bizName")}</span>
          <input className="field mt-1 w-full" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120} autoFocus /></label>
        <label className="block"><span className="text-[12px] font-bold opacity-65">{t("bizCity")}</span>
          <input className="field mt-1 w-full" value={city} onChange={e => setCity(e.target.value)} maxLength={80} /></label>
        <label className="block"><span className="text-[12px] font-bold opacity-65">{t("bizLegal")}</span>
          <input className="field mt-1 w-full" value={legal} onChange={e => setLegal(e.target.value)} maxLength={160} /></label>
        <label className="block"><span className="text-[12px] font-bold opacity-65">{t("bizTaxId")}</span>
          <input className="field mt-1 w-full" value={taxId} onChange={e => setTaxId(e.target.value)} maxLength={40} inputMode="numeric" /></label>
        {err && <p role="alert" className="text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
        <button type="submit" disabled={busy || name.trim().length < 2} className="btn-primary w-full disabled:opacity-50">{t("create")}</button>
      </form>
    </div>
  );
}
