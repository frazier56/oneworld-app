import { useState } from "react";
import { ScreenHeading, useAsync } from "@oneworld/shell";
import { useT } from "../lib/dict";
import { useMerchant } from "../lib/useMerchant";
import { listMembers, addMember, setMemberActive } from "../lib/data";

export default function Staff() {
  const { t } = useT();
  const m = useMerchant();
  const [tick, setTick] = useState(0);
  const members = useAsync(async () => m.merchant ? listMembers(m.merchant.id) : [], [m.merchant?.id, tick]);
  const [uid, setUid] = useState(""); const [role, setRole] = useState<"manager" | "staff">("staff"); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) { setBusy(true); setErr(null); try { await fn(); setUid(""); setTick(x => x + 1); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }
  const roleLabel = (r: string) => r === "owner" ? t("owner") : r === "manager" ? t("manager") : t("staffRole");
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{t("staffTitle")}</ScreenHeading>
      <p className="mt-1 text-[13px] opacity-70">{t("staffBody")}</p>
      <form onSubmit={e => { e.preventDefault(); if (m.merchant && /^[0-9a-f-]{36}$/i.test(uid.trim())) void run(() => addMember(m.merchant!.id, uid.trim(), role)); }} className="card mt-4 !rounded-2xl !p-3">
        <input className="field w-full" value={uid} onChange={e => setUid(e.target.value)} placeholder="One ID" />
        <p className="mt-1 text-[11px] opacity-60">{t("userIdHint")}</p>
        <div className="mt-2 flex gap-2">
          <select className="field flex-1" value={role} onChange={e => setRole(e.target.value as "manager" | "staff")} aria-label={t("role")}>
            <option value="staff">{t("staffRole")}</option><option value="manager">{t("manager")}</option>
          </select>
          <button type="submit" disabled={busy || !/^[0-9a-f-]{36}$/i.test(uid.trim())} className="btn-primary px-4 disabled:opacity-50">{t("addStaff")}</button>
        </div>
      </form>
      {err && <p role="alert" className="mt-2 text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{err}</p>}
      <ul className="mt-3 space-y-2">
        {(members ?? []).map(x => (
          <li key={x.user_id} className={`card flex items-center justify-between !rounded-2xl !p-3 ${x.active ? "" : "opacity-50"}`}>
            <div><p className="text-[13.5px] font-bold">{x.full_name ?? x.user_id.slice(0, 8)}</p><p className="text-[12px] opacity-60">{roleLabel(x.role)}</p></div>
            {x.role !== "owner" && <button type="button" disabled={busy} onClick={() => run(() => setMemberActive(m.merchant!.id, x.user_id, !x.active))} className="ow-tap rounded-full border border-ink/15 px-3 py-1 text-[11.5px] font-bold dark:border-white/15">{x.active ? t("remove") : t("restore")}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
