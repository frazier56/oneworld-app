import { useState } from "react";
import { createPortal } from "react-dom";
type Opt = { value: string; label: string; count?: number };
export function FilterDropdown({ label, options, value, onChange }: { label: string; options: Opt[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.value === value);
  const active = value && value !== "all";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold ${active ? "border-teal bg-teal/10 text-teal" : "border-ink/10 dark:border-white/15"}`}>
        {active ? sel?.label : label} ▾
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-6" onClick={() => setOpen(false)}>
          <div className="glass-modal max-h-[60vh] w-full max-w-[320px] space-y-1 overflow-y-auto rounded-3xl p-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="mb-1 px-2 font-bold">{label}</p>
            {options.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${o.value === value ? "bg-teal text-white" : "hover:bg-teal/10"}`}>
                <span>{o.label}</span>{typeof o.count === "number" && <span className="opacity-50">{o.count}</span>}
              </button>
            ))}
          </div>
        </div>, document.body)}
    </>
  );
}
export default FilterDropdown;
