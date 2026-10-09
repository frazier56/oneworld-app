import { useState } from "react";
import { ScreenHeading, useAsync } from "@oneworld/shell";
import { useT, dateLocale } from "../lib/dict";
import { useMerchant } from "../lib/useMerchant";
import { listDevices, registerDevice } from "../lib/data";

export default function Devices() {
  const { t, lang } = useT();
  const m = useMerchant();
  const [tick, setTick] = useState(0);
  const devices = useAsync(async () => m.merchant ? listDevices(m.merchant.id) : [], [m.merchant?.id, tick]);
  const [label, setLabel] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function reg() { if (!m.merchant || !label.trim()) return; setBusy(true); setErr(null); try { await registerDevice(m.merchant.id, label.trim()); setLabel(""); setTick(x => x + 1); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("devicesTitle")}</ScreenHeading>
      <p className="mt-1 text-[13px] opacity-70">{t("devicesBody")}</p>
      <div className="card mt-4 flex gap-2 !rounded-2xl !p-3">
        <input className="field min-w-0 flex-1" value={label} onChange={e => setLabel(e.target.value)} placeholder={t("deviceLabel")} maxLength={60} />
        <button type="button" onClick={reg} disabled={busy || !label.trim()} className="btn-primary shrink-0 px-3 disabled:opacity-50">{t("registerThis")}</button>
      </div>
      {err && <p role="alert" className="mt-2 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
      <ul className="mt-3 space-y-2">
        {(devices ?? []).map(d => (
          <li key={d.id} className="card flex items-center justify-between !rounded-2xl !p-3">
            <div><p className="text-[13.5px] font-bold">{d.label}</p><p className="text-[12px] opacity-60">{d.platform} · {new Date(d.registered_at).toLocaleDateString(dateLocale(lang))}</p></div>
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${d.tap_capable ? "bg-brand/15 text-brand-deep dark:text-brand-light" : "bg-ink/10"}`}>{d.tap_capable ? t("tapCapable") : t("notTap")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
