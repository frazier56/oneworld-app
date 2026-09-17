import { createPortal } from "react-dom";
import { useState } from "react";
import type { JobItem } from "./JobDetailModal";

import { useI18n, W } from "@job/lib/i18n";
/**
 * In-app payment receipt (Lee, §3.2). Lives in the job — opened via "View receipt" on a
 * COMPLETED job. Self-contained (built from the job item; no extra fetch). "Share" uses the
 * native share sheet, falling back to clipboard, so it can go anywhere as text.
 * NOTE: formal "send receipt to the other party's in-app inbox" + send-to-non-app come with the
 * Share/guest-flow work (see project-onejob-share-qr-guest-blocked). This is the view + text share.
 */
export default function ReceiptModal({ item, onClose }: { item: JobItem; onClose: () => void }) {
  const { lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const amount = Number(item.amount) || 0;
  const rail = item.money?.payment_rail ?? null;
  const rawFee = item.money?.platform_fee;
  const hasFrozenFee = rawFee !== null && rawFee !== undefined && Number.isFinite(Number(rawFee));
  // A receipt is historical evidence. Use the amount actually stored at payment time; never
  // rewrite history with today's configured rate. Known fee-free rails are exactly zero. Legacy
  // rows with no snapshot say so instead of inventing a number.
  const fee = hasFrozenFee ? Math.max(0, Number(rawFee)) : rail === "external" || rail === "promo" ? 0 : null;
  const total = fee === null ? null : Math.round((amount + fee) * 100) / 100;
  // NEVER infer a money role from a translated UI string. `amountLabel` is localised, so
  // Spanish ("Pagado") failed /paid/i and every Spanish receipt showed the payee side of a
  // payer's transaction. Use the explicit role the row already carries. (UAT Jul 25 2026)
  const isPayer = (item as any).isPayer ?? ((item as any).counterRole === "Payee");
  const receiptNo = (item.key || "").replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase() || "—";
  const cur = (item as any).currency || "USD";
  const money = (n: number) => { try { return new Intl.NumberFormat("en", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n); } catch { return `$${n.toFixed(2)}`; } };
  const feePct = fee !== null && amount > 0
    ? `${((fee / amount) * 100).toFixed(2).replace(/\.00$/, "")}%`
    : fee === 0 ? "0%" : null;
  const feeText = fee === null ? W(lang, "Not recorded", "No registrada") : money(fee);
  const paidText = isPayer
    ? total === null ? W(lang, "See payment record", "Ver registro de pago") : money(total)
    : money(amount);
  const custodyText = rail === "external"
    ? W(lang,
      "Paid directly outside OneJob. OneJob did not hold or release these funds.",
      "Pagado directamente fuera de OneJob. OneJob no retuvo ni liberó estos fondos.")
    : rail === "promo"
      ? W(lang,
        "Fee-free contract. OneJob did not process or hold a payment.",
        "Contrato sin comisión. OneJob no procesó ni retuvo un pago.")
      : item.money?.paid_out_at
        ? W(lang,
          "Released to the professional; the bank payout is recorded.",
          "Liberado al profesional; el pago bancario está registrado.")
        : item.money?.released_at
          ? W(lang,
            "Released to the professional after both parties marked complete.",
            "Liberado al profesional después de que ambas partes marcaron el trabajo como completado.")
          : item.money?.captured_at
            ? W(lang,
              "Held in the OneJob Vault; release to the professional is still pending.",
              "Retenido en la Bóveda de OneJob; la liberación al profesional sigue pendiente.")
            : item.money?.authorized_at
              ? W(lang,
                "Card hold authorized; no completed capture is recorded.",
                "Retención de tarjeta autorizada; no hay un cobro completado registrado.")
              : W(lang,
                "Payment custody details are not recorded.",
                "Los detalles de custodia del pago no están registrados.");

  const text =
    `OneJob — Payment receipt\n#${receiptNo}\n\n${item.title}\n${item.dateText || ""}\n` +
    `With: ${item.withName || "—"} (${item.withRole})\n\n` +
    `Amount: ${money(amount)}\nService fee${feePct ? ` (${feePct})` : ""}: ${feeText}\n` +
    `${isPayer ? W(lang, "You paid", "Pagaste") : W(lang, "You earned", "Ganaste")}: ${paidText}\n` +
    `${W(lang, "Status", "Estado")}: ${W(lang, "Completed", "Completado")} — ${custodyText}`;

  const share = async () => {
    if ((navigator as any).share) { try { await (navigator as any).share({ title: W(lang, "OneJob receipt", "Recibo de OneJob"), text }); return; } catch {} }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const Line = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
    <div className={`flex items-center justify-between ${strong ? "font-extrabold" : "text-sm opacity-70"}`}><span>{k}</span><span>{v}</span></div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[95] grid place-items-end sm:place-items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl border border-ink/10 bg-paper p-0 shadow-2xl dark:border-white/10 dark:bg-ink sm:m-4 sm:rounded-3xl">
        {/* header */}
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-br from-brand/20 via-brand/5 to-transparent px-6 pb-5 pt-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">OneJob receipt</p>
            <p className="mt-0.5 text-xs opacity-55">#{receiptNo}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 dark:border-white/15">×</button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold leading-tight">{item.title}</h2>
            <p className="mt-0.5 text-xs opacity-55">{item.dateText}</p>
          </div>

          <div className="rounded-xl bg-ink/[0.03] px-3 py-2.5 text-sm dark:bg-white/[0.05]">
            <div className="flex justify-between"><span className="opacity-50">With</span><span className="font-semibold">{item.withName || "—"} · {item.withRole}</span></div>
          </div>

          <div className="space-y-1.5 border-t border-ink/10 pt-3 dark:border-white/10">
            <Line k={W(lang, "Amount", "Monto")} v={money(amount)} />
            <Line k={`${W(lang, "Service fee", "Comisión")}${feePct ? ` (${feePct})` : ""}`} v={feeText} />
            <div className="my-1 h-px bg-ink/10 dark:bg-white/10" />
            <Line k={isPayer ? W(lang, "You paid", "Pagaste") : W(lang, "You earned", "Ganaste")} v={paidText} strong />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-brand/10 px-3 py-2 text-xs font-semibold text-brand">
            <span>✓ {W(lang, "Completed", "Completado")}</span><span className="opacity-60">· {custodyText}</span>
          </div>

          <button onClick={share} className="btn-primary w-full">{copied ? W(lang, "✓ Copied", "✓ Copiado") : W(lang, "Share receipt", "Compartir recibo")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
