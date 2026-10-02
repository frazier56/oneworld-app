import { useState } from "react";
import { Switch } from "@evt/components/ui/switch";
export default function WiseReceivingToggle({ context }: { context?: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="card flex items-center justify-between gap-3 !rounded-2xl p-4">
      <div><p className="font-semibold">Accept Wise / PayPal {context || ""}</p><p className="text-sm opacity-60">Let attendees pay you directly via your payout links.</p></div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}
