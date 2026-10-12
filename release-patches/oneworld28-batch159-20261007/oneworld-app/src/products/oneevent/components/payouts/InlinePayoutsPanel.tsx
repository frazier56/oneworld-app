import { PayoutStatusCard } from "./PayoutStatusCard";
export default function InlinePayoutsPanel() {
  return <div className="space-y-3"><PayoutStatusCard returnPath="/events/events" /></div>;
}
