import { MapPin } from "lucide-react";

export function LocationCombobox({ value, onChange, availableLocations = [] }: { value: string; onChange: (v: string) => void; availableLocations?: string[] }) {
  return (
    <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 dark:bg-white/5 dark:border-white/15 md:w-64">
      <MapPin size={16} className="shrink-0 opacity-50" />
      <input list="oe-locations" value={value} onChange={e => onChange(e.target.value)} placeholder="Anywhere" className="flex-1 bg-transparent text-sm outline-none" />
      <datalist id="oe-locations">{availableLocations.map(l => <option key={l} value={l} />)}</datalist>
    </div>
  );
}
export default LocationCombobox;
