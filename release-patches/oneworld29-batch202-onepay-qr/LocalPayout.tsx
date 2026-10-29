import { useCallback, useEffect, useState } from "react";
import { supabase, W, useI18n, useOneId } from "@oneworld/shell";

/* ============================================================================================
 * GET PAID IN PESOS — where a person's money lands in Colombia (Lee, 28 Oct 2026).
 * *"Payout is how to get paid… you should be able to enter your bank information."*
 *
 * One destination per person, shared by every app (One ID): a Colombian bank account or a
 * Nequi number. The full number is stored server-side in a private schema; the screen only
 * ever reads it back masked (last four). Wompi pays it out.
 * ============================================================================================ */

export type LocalPayoutSummary = { kind: "bank" | "nequi"; bank_name: string | null; account_type: string | null; last4: string; holder_name: string };

const BANKS = [
  "Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA Colombia", "Banco de Occidente", "Banco Popular",
  "Banco AV Villas", "Banco Caja Social", "Scotiabank Colpatria", "Itaú", "Banco Agrario", "Banco Falabella",
  "Banco Pichincha", "GNB Sudameris", "Bancoomeva", "Banco W", "Lulo Bank", "Nu Colombia", "Daviplata",
];

const BOX = `h-[48px] rounded-[14px] border border-ink/15 bg-white/80 px-3.5 text-[15px] font-semibold outline-none
  focus:border-ink/50 dark:border-white/20 dark:bg-white/[0.08] dark:focus:border-white/60`;
const INPUT = `${BOX} w-full min-w-0`;

export function useLocalPayout() {
  const { userId } = useOneId();
  const [state, setState] = useState<{ loading: boolean; data: LocalPayoutSummary | null }>({ loading: true, data: null });
  const load = useCallback(async () => {
    if (!userId) { setState({ loading: false, data: null }); return; }
    const { data } = await supabase.rpc("my_local_payout");
    setState({ loading: false, data: (Array.isArray(data) && data[0]) ? data[0] as LocalPayoutSummary : null });
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  return { ...state, reload: load };
}

export default function LocalPayout({ onChanged }: { onChanged?: () => void }) {
  const { lang } = useI18n();
  const { loading, data, reload } = useLocalPayout();
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<"bank" | "nequi">("bank");
  const [bank, setBank] = useState("Bancolombia");
  const [acctType, setAcctType] = useState<"ahorros" | "corriente">("ahorros");
  const [acct, setAcct] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [idType, setIdType] = useState("CC");
  const [idNum, setIdNum] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const digits = (s: string) => s.replace(/\D/g, "");
  const valid = name.trim().length >= 3 && idNum.replace(/\W/g, "").length >= 5 &&
    (kind === "bank" ? /^\d{6,20}$/.test(digits(acct)) : /^3\d{9}$/.test(digits(phone)));

  async function save() {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("set_local_payout", {
      p_kind: kind, p_bank_name: bank, p_account_type: acctType, p_account_number: digits(acct),
      p_phone: digits(phone), p_holder_name: name.trim(), p_holder_id_type: idType, p_holder_id_number: idNum.trim(),
    });
    setBusy(false);
    if (error) { setErr(W(lang, "Couldn't save. Check the details and try again.", "No se pudo guardar. Revise los datos e intente de nuevo.")); return; }
    setAcct(""); setIdNum(""); setEditing(false);
    await reload(); onChanged?.();
  }
  async function remove() {
    setBusy(true);
    await supabase.rpc("remove_local_payout");
    setBusy(false); await reload(); onChanged?.();
  }

  if (loading) return <div className="card p-4 text-sm opacity-60">{W(lang, "Loading…", "Cargando…")}</div>;

  if (data && !editing) {
    return (
      <div className="card p-4" data-ow="local-payout">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] opacity-50">{W(lang, "Paid out in pesos to", "Se le paga en pesos a")}</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink/5 text-lg dark:bg-white/10">{data.kind === "nequi" ? "📲" : "🏦"}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">
              {data.kind === "nequi" ? "Nequi" : data.bank_name} •••• {data.last4}
            </span>
            <span className="block text-[12px] opacity-60">
              {data.kind === "bank" ? (data.account_type === "corriente" ? W(lang, "Checking", "Corriente") : W(lang, "Savings", "Ahorros")) + " · " : ""}{data.holder_name}
            </span>
          </span>
          <span className="rounded-full bg-teal/15 px-2.5 py-1 text-[11px] font-bold text-teal-dark dark:text-teal">{W(lang, "Ready", "Listo")}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setEditing(true)} className="ow-tap h-10 flex-1 rounded-xl border border-ink/20 text-[13.5px] font-bold dark:border-white/25">{W(lang, "Change", "Cambiar")}</button>
          <button type="button" disabled={busy} onClick={remove} className="ow-tap h-10 flex-1 rounded-xl border border-ink/20 text-[13.5px] font-bold text-red-500 dark:border-white/25">{W(lang, "Remove", "Quitar")}</button>
        </div>
      </div>
    );
  }

  const seg = (k: "bank" | "nequi", label: string) => (
    <button type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
      className={`ow-tap h-[44px] flex-1 rounded-[13px] text-[14.5px] font-extrabold ${kind === k ? "bg-[#2C2622] text-white dark:bg-white dark:text-[#201B16]" : "border border-ink/20 dark:border-white/25"}`}>{label}</button>
  );

  return (
    <div className="card p-4" data-ow="local-payout-form">
      <p className="m-0 text-[16px] font-extrabold">{W(lang, "Get paid in pesos", "Reciba pagos en pesos")}</p>
      <p className="m-0 mt-1 text-[12.5px] opacity-65">{W(lang, "Where your money lands in Colombia.", "Donde le llega su dinero en Colombia.")}</p>
      <div className="mt-3 flex gap-2">{seg("bank", W(lang, "Bank account", "Cuenta bancaria"))}{seg("nequi", "Nequi")}</div>
      <div className="mt-3 flex flex-col gap-2.5">
        {kind === "bank" ? (
          <>
            <select value={bank} onChange={e => setBank(e.target.value)} className={INPUT} aria-label={W(lang, "Bank", "Banco")}>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={acctType} onChange={e => setAcctType(e.target.value as "ahorros" | "corriente")} className={`${BOX} w-[130px] shrink-0`} aria-label={W(lang, "Account type", "Tipo de cuenta")}>
                <option value="ahorros">{W(lang, "Savings", "Ahorros")}</option>
                <option value="corriente">{W(lang, "Checking", "Corriente")}</option>
              </select>
              <input value={acct} onChange={e => setAcct(e.target.value)} inputMode="numeric" autoComplete="off"
                placeholder={W(lang, "Account number", "Número de cuenta")} className={INPUT} />
            </div>
          </>
        ) : (
          <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national"
            placeholder={W(lang, "Nequi phone number", "Celular Nequi")} className={INPUT} />
        )}
        <input value={name} onChange={e => setName(e.target.value)} autoComplete="name"
          placeholder={W(lang, "Account holder's full name", "Nombre completo del titular")} className={INPUT} />
        <div className="flex gap-2">
          <select value={idType} onChange={e => setIdType(e.target.value)} className={`${BOX} w-[92px] shrink-0`} aria-label={W(lang, "ID type", "Tipo de documento")}>
            <option value="CC">CC</option><option value="CE">CE</option><option value="NIT">NIT</option><option value="PP">PP</option>
          </select>
          <input value={idNum} onChange={e => setIdNum(e.target.value)} autoComplete="off"
            placeholder={W(lang, "Holder's ID number", "Documento del titular")} className={INPUT} />
        </div>
      </div>
      {err && <p role="alert" className="m-0 mt-2 text-[13px] font-bold text-red-500">{err}</p>}
      <div className="mt-3 flex gap-2">
        {data && <button type="button" onClick={() => setEditing(false)} className="ow-tap h-[48px] flex-1 rounded-[14px] border border-ink/20 text-[15px] font-bold dark:border-white/25">{W(lang, "Cancel", "Cancelar")}</button>}
        <button type="button" disabled={!valid || busy} onClick={save}
          className="ow-tap h-[48px] flex-1 rounded-[14px] bg-[#2C2622] text-[15px] font-extrabold text-white disabled:opacity-40 dark:bg-white dark:text-[#201B16]">
          {busy ? "…" : W(lang, "Save", "Guardar")}</button>
      </div>
      <p className="m-0 mt-2.5 text-[11.5px] leading-snug opacity-55">{W(lang, "🔒 Only you see these details. Apps show the last four digits.", "🔒 Solo usted ve estos datos. Las apps muestran los últimos cuatro dígitos.")}</p>
    </div>
  );
}
