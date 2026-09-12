import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@evt/lib/places";

/** Google Places address autocomplete with a custom glass dropdown.
 *  - variant "address": streets/cities/regions (full formatted address).
 *  - variant "establishment": business/building names (picking one fills the
 *    full address via its description, e.g. "The Fox Theatre, Peachtree St…").
 *  Manual entry ALWAYS works — if Google can't load or has no matches, the
 *  typed text is kept as-is. onSelect(desc) fires with the chosen full string;
 *  onChange fires on every keystroke. */
export default function PlacesInput({
  value, onChange, onSelect, onResolve, placeholder, className = "input", variant = "address",
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (v: string) => void;
  onResolve?: (r: { name?: string; address: string }) => void;
  placeholder?: string;
  className?: string;
  variant?: "address" | "establishment";
}) {
  const [preds, setPreds] = useState<{ id: string; text: string }[]>([]);
  const [open, setOpen] = useState(false);
  const svcRef = useRef<any>(null);
  const psRef = useRef<any>(null);
  const box = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<any>(null);

  useEffect(() => {
    let dead = false;
    loadGoogleMaps().then((g) => {
      if (dead) return;
      svcRef.current = new g.maps.places.AutocompleteService();
      psRef.current = new g.maps.places.PlacesService(document.createElement("div"));
      tokenRef.current = new g.maps.places.AutocompleteSessionToken();
    }).catch(() => {}); // silent → manual entry still works
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => { dead = true; document.removeEventListener("click", close); };
  }, []);

  const query = (v: string) => {
    const svc = svcRef.current;
    if (!svc || v.trim().length < 3) { setPreds([]); setOpen(false); return; }
    svc.getPlacePredictions(
      {
        input: v,
        sessionToken: tokenRef.current,
        types: variant === "establishment" ? ["establishment"] : ["geocode"],
      },
      (res: any[], status: string) => {
        if (status !== "OK" || !res?.length) { setPreds([]); setOpen(false); return; }
        setPreds(res.slice(0, 6).map((p) => ({ id: p.place_id, text: p.description })));
        setOpen(true);
      }
    );
  };

  const pick = (text: string, placeId?: string) => {
    onChange(text);
    onSelect?.(text);
    setPreds([]); setOpen(false);
    // Resolve name + full formatted address from place details so the venue
    // name and address fields can auto-fill each other. Falls back to the
    // typed/description text if details aren't available.
    if (onResolve) {
      if (psRef.current && placeId) {
        psRef.current.getDetails(
          { placeId, fields: ["name", "formatted_address"] },
          (place: any, status: string) => {
            if (status === "OK" && place) onResolve({ name: place.name, address: place.formatted_address || text });
            else onResolve({ address: text });
          }
        );
      } else {
        onResolve({ address: text });
      }
    }
  };

  return (
    <div ref={box} className="relative">
      <input
        className={className + " pr-9"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); query(e.target.value); }}
        onFocus={() => preds.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {value && (
        <button type="button" onClick={() => { onChange(""); setPreds([]); setOpen(false); }} aria-label="Clear"
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-ink/10 text-xs dark:bg-white/15">✕</button>
      )}
      {open && preds.length > 0 && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink/10 bg-white shadow-xl dark:border-white/10 dark:bg-[#111827]">
          {preds.map((p) => (
            <button type="button" key={p.id} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-teal/10"
              onClick={() => pick(p.text, p.id)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-teal"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>{p.text}</button>
          ))}
        </div>
      )}
    </div>
  );
}
