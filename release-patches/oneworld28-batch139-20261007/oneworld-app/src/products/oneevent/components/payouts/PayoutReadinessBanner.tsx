import { usePayoutStatus } from "@evt/hooks/usePayoutStatus";
import { PayoutStatusCard } from "./PayoutStatusCard";
export function PayoutReadinessBanner({ returnPath }: { variant?: string; context?: string; returnPath?: string }) {
  const s = usePayoutStatus();
  if (s.loading || s.payouts_enabled) return null;
  return <div className="mb-3"><PayoutStatusCard returnPath={returnPath} /></div>;
}
export default PayoutReadinessBanner;
