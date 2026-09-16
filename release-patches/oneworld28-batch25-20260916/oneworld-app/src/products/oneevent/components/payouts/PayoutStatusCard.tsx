import { useState } from "react";
import { usePayoutStatus } from "@evt/hooks/usePayoutStatus";
import { Wallet, Check } from "lucide-react";
export function PayoutStatusCard({ returnPath }: { returnPath?: string }) {
  const s = usePayoutStatus();
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    setBusy(true);
    try { const url = await s.startOnboarding(returnPath); if (url) window.location.href = url; } catch (e: any) { alert(e?.message || "Could not reach Stripe."); }
    setBusy(false);
  };
  if (s.loading) return <div className="card !rounded-2xl p-4"><div className="h-5 w-32 animate-pulse rounded bg-ink/10 dark:bg-white/10" /></div>;
  const ready = s.payouts_enabled;
  // Cleaner layout (Lee, Jul 22): title + short copy on top, full-width Connect
  // button below — no cramped button-beside-wrapping-text on narrow phones.
  return (
    <div className="card !rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ready ? "bg-teal/15 text-teal" : "bg-amber-500/15 text-amber-500"}`}>{ready ? <Check size={18} /> : <Wallet size={18} />}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{ready ? "Payouts ready" : "Set up payouts"}</p>
          <p className="mt-0.5 text-[13px] leading-snug opacity-60">{ready ? (s.bank_name ? `${s.bank_name} ••${s.bank_last4}` : "Connected to Stripe") : "Connect your bank to get paid for ticket sales."}</p>
        </div>
      </div>
      {!ready && (
        <button onClick={connect} disabled={busy} className="btn-primary mt-3 w-full !py-2.5 text-sm font-semibold">
          {busy ? "Connecting…" : "Connect bank / payout account"}
        </button>
      )}
    </div>
  );
}
export default PayoutStatusCard;
