import { useState } from "react";
import { W, useI18n, useOneId } from "@oneworld/shell";
import { LocalPaySheet, useLocalPayReturn, type LocalPayResult } from "./LocalPaySheet";

/* WOMPI 1 test bench (28 Oct 2026). LINKED FROM NOTHING — reached by typing /pay-test.
   Runs only while the payment backend is in test mode; the server refuses this purpose in production. */
export default function PayTest() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [pesos, setPesos] = useState("10000");
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<LocalPayResult | null>(null);
  const back = useLocalPayReturn();
  const shown = last ?? (back && back !== "checking" ? back : null);
  const n = Math.round(Number(pesos.replace(/\D/g, "")) || 0);
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-[440px] flex-col gap-4 px-5 pt-8 text-ink dark:text-white" data-ow="pay-test">
      <h1 className="m-0 text-[24px] font-black">{W(lang, "Pay in pesos — test", "Pagar en pesos — prueba")}</h1>
      {!userId && <p className="m-0">{W(lang, "Sign in first.", "Ingrese primero.")}</p>}
      <input value={pesos} onChange={e => setPesos(e.target.value)} inputMode="numeric"
        className="h-[50px] rounded-[16px] border border-ink/20 bg-white/80 px-4 text-[16px] font-bold dark:border-white/25 dark:bg-white/10" />
      <button type="button" disabled={!userId || n < 1500} onClick={() => setOpen(true)}
        className="ow-tap h-[52px] rounded-[18px] bg-[#2C2622] text-[16px] font-extrabold text-white disabled:opacity-40 dark:bg-white dark:text-[#201B16]">
        {W(lang, "Pay", "Pagar")} COP {n.toLocaleString("es-CO")}
      </button>
      {back === "checking" && <p className="m-0" data-ow-pay-status="checking">{W(lang, "Checking with your bank…", "Confirmando con su banco…")}</p>}
      {shown && <p className="m-0 font-extrabold" data-ow-pay-status={shown.status}>{shown.status}</p>}
      {open && (
        <LocalPaySheet purpose="sandbox_test" extra={{ amount_pesos: n }} amountLabel={`COP ${n.toLocaleString("es-CO")}`}
          returnPath="/pay-test" onClose={() => setOpen(false)} onDone={setLast} />
      )}
    </div>
  );
}
