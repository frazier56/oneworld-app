import { useState } from "react";
import { MapPin } from "lucide-react";
export function DistanceFilter({ onDistanceChange }: { onDistanceChange: (d: number | null, coords: { lat: number; lng: number } | null) => void }) {
  const [on, setOn] = useState(false);
  const toggle = () => {
    if (on) { setOn(false); onDistanceChange(null, null); return; }
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setOn(true); onDistanceChange(50, { lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { setOn(false); onDistanceChange(null, null); }
    );
  };
  return <button type="button" onClick={toggle} className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold ${on ? "border-teal bg-teal/10 text-teal" : "border-ink/10 dark:border-white/15"}`}><MapPin size={14} className="mr-1 inline-block align-[-2px]" />Near me</button>;
}
export default DistanceFilter;
