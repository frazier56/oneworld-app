import { useCallback, useEffect, useState } from "react";
import { supabase, W } from "@oneworld/shell";
import { LocalPaySheet, useLocalPayReturn } from "../../shared/LocalPaySheet";

/* ============================================================================================
 * ONEHOME FEE IN PESOS — Lee, 29 Oct 2026: "Fee only… Both sides."
 * Rent goes straight from tenant to host. Each side pays only its own OneHome fee here, with
 * Nequi or PSE. The server decides the amount (my_onehome_fee / wompi-pay resolver); this card
 * only shows it. Renders nothing when no peso fee is due for the signed-in side.
 * ============================================================================================ */
type Fee = { side: "guest" | "host"; amount: number; paid: boolean; paid_at: string | null };

export default function OneHomeFeePay({ requestId, lang, returnPath }: { requestId: string; lang: string; returnPath: string }) {
  const [fee, setFee] = useState<Fee | null>(null);
  const [open, setOpen] = useState(false);
  const back = useLocalPayReturn();

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_onehome_fee", { p_request: requestId });
    const row = Array.isArray(data) ? data[0] : null;
    setFee(row ? { ...row, amount: Number(row.amount) } as Fee : null);
  }, [requestId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (back && back !== "checking") void load(); }, [back, load]);

  if (!fee || (!fee.paid && !(fee.amount > 0))) return null;
  const money = new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", { style: "currency", currency: "COP", currencyDisplay: "code", maximumFractionDigits: 0 }).format(fee.amount);
  const host = fee.side === "host";

  if (fee.paid) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-teal/30 bg-teal/[0.08] p-3" data-ow="onehome-fee-paid">
        <span aria-hidden>✓</span>
        <p className="m-0 text-[13px] font-bold">{W(lang, "OneHome fee paid", "Tarifa de OneHome pagada")}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-ink/15 p-3 dark:border-white/20" data-ow="onehome-fee">
      <p className="m-0 text-sm font-black">{host ? W(lang, "Your OneHome host fee", "Su tarifa de anfitrión OneHome") : W(lang, "Your OneHome service fee", "Su tarifa de servicio OneHome")}</p>
      <p className="m-0 mt-1 text-[11.5px] opacity-65">{host
        ? W(lang, "Rent comes straight to you. This is the only amount OneHome charges you.", "El canon le llega directo. Este es el único valor que OneHome le cobra.")
        : W(lang, "Rent goes straight to the host. This is the only amount you pay OneHome.", "El canon va directo al anfitrión. Este es el único valor que usted le paga a OneHome.")}</p>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary mt-3 w-full">
        {W(lang, `Pay ${money} with Nequi or PSE`, `Pagar ${money} con Nequi o PSE`)}
      </button>
      {open && (
        <LocalPaySheet purpose={host ? "onehome_host_fee" : "onehome_guest_fee"} amountLabel={money}
          extra={{ request_id: requestId }} returnPath={returnPath}
          onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} />
      )}
    </div>
  );
}
