import { useEffect, useRef, useState } from "react";
import { IconPin } from "./ActionIcons";

let CITIES: string[] | null = null;
async function loadCities(): Promise<string[]> {
  if (CITIES) return CITIES;
  const r = await fetch(`${import.meta.env.BASE_URL}cities.json`);
  CITIES = await r.json();
  return CITIES!;
}

export default function CityInput({ value, onChange, placeholder, className = "input" }:
  { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [sugs, setSugs] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const update = async (v: string) => {
    onChange(v);
    if (v.trim().length < 2) { setSugs([]); setOpen(false); return; }
    const all = await loadCities();
    const q = v.trim().toLowerCase();
    const starts = all.filter(c => c.toLowerCase().startsWith(q)).slice(0, 8);
    const incl = starts.length < 8 ? all.filter(c => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q)).slice(0, 8 - starts.length) : [];
    const out = [...starts, ...incl];
    setSugs(out); setOpen(out.length > 0);
  };

  return (
    <div ref={box} className="relative">
      <input className={className + " pr-9"} value={value} placeholder={placeholder}
        onChange={e => update(e.target.value)} onFocus={() => value.trim().length >= 2 && sugs.length > 0 && setOpen(true)} />
      {value && (
        <button  onClick={() => { onChange(""); setSugs([]); setOpen(false); }} aria-label="Clear"
          className="ow-tap absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center">
          <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-ink/10 dark:bg-white/15">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
        </button>
      )}
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink/10 bg-white shadow-xl dark:border-white/10 dark:bg-[#111827]">
          {sugs.map(c => (
            <button key={c} className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-brand/10"
              onClick={() => { onChange(c); setOpen(false); }}><IconPin size={13} className="mr-1.5 inline-block align-[-2px] opacity-60" />{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}
