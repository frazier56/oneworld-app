import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadGoogleMaps, GOOGLE_MAPS_KEY } from "../lib/places";
import { useI18n } from "../lib/i18n";
import { IconPin } from "./ActionIcons";

/** Google Places address autocomplete with a custom glass dropdown.
 *  - variant "address": streets/cities/regions (full formatted address).
 *  - variant "establishment": business/building names (picking one fills the
 *    full address via its description, e.g. "The Fox Theatre, Peachtree St…").
 *  Manual entry ALWAYS works — if Google can't load or has no matches, the
 *  typed text is kept as-is. onSelect(desc) fires with the chosen full string;
 *  onChange fires on every keystroke.
 *
 *  FIX-C (Jul 26 2026): the suggestions used to be an `absolute` child (z-40) of this
 *  input's wrapper. The sibling Price card has its own stacking context (backdrop-blur),
 *  so it painted ON TOP of the list and hid the results. Dropdowns must always be above
 *  everything (Lee's canon). We now render the list in a PORTAL to <body> with position
 *  fixed and a high z-index, anchored to the input's on-screen rect — same pattern as the
 *  glass date/time pickers. */
/* Module-level: one console line per session, not one per keystroke. */
let warned = false;

export default function PlacesInput({
  value, onChange, onSelect, onSelectParts, placeholder, className = "input", variant = "address",
  countries, bias, id, ariaLabel, disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (v: string) => void;
  /** Fires alongside onSelect with the prediction split into its place NAME
   *  (main_text, e.g. "Improv Playhouse Theater") and ADDRESS (secondary_text). */
  onSelectParts?: (parts: { name: string; address: string; full: string; placeId?: string }) => void;
  id?: string; ariaLabel?: string; disabled?: boolean;
  placeholder?: string;
  className?: string;
  variant?: "address" | "establishment" | "city" | "neighbourhood";
  /** Restrict predictions to these ISO country codes. OneHome runs in Colombia, so `["co"]`
   *  keeps "Medellín" from competing with Medellin, Ohio. Omit for worldwide. */
  countries?: string[];
  /**
   * Bias results toward a place, by name — usually the city already chosen on the form.
   *
   * Found by testing the live key from production on 11 Aug 2026: searching the BUILDING field for
   * "torre" returned "Torre de Cali Plaza Hotel" in Cali, 400km from the Medellín listing being
   * written. Country restriction alone is not enough for establishment search, because building
   * names repeat across every Colombian city.
   *
   * Bias, not restriction: a genuinely better match outside the city still wins, and somebody
   * listing in a town the geocoder does not resolve is not locked out of naming their building.
   */
  bias?: string | null;
}) {
  const { lang } = useI18n(); const es = lang === "es" || lang === "co";
  const menuId = useId(); const requestVersion = useRef(0);
  const [active, setActive] = useState(-1);
  useEffect(() => { if (disabled) { requestVersion.current++; setOpen(false); } }, [disabled]);
  const [preds, setPreds] = useState<{ id: string; text: string; main: string; secondary: string }[]>([]);
  const [open, setOpen] = useState(false);
  /* ── WHY THIS STATE EXISTS ────────────────────────────────────────────────────────────────
     Lee, 11 Aug 2026: *"the address still isn't working. I should be able to type address in."*
     Third report. The code has been correct every time; the KEY is not.

     Checked live against the production referer on 11 Aug 2026, and this is the whole finding:
       REQUEST_DENIED — "You must enable Billing on the Google Cloud Project"

     ── A CORRECTION I HAVE TO WRITE DOWN, BECAUSE I GOT IT WRONG IN THE HANDOFF ──────────────
     I first reported this as "Places has never worked, in OneHome or in OneJob." That was not
     something I had tested and it was not true. Lee: *"it did work before on OneJob, it's just not
     working now… you should only say things that you know factually."* He is right. What the test
     above establishes is the CURRENT state and nothing else — one live request, on one day. It
     says nothing about last month, and a billing card that lapses is the ordinary way a working
     integration stops working.

     So the accurate statement is: as of 11 Aug 2026 the project's billing is not active, which is
     why Places is refusing requests today. The likely cause is a card on file that has expired or
     been declined. The 9 Aug note in `places.ts` guessing at a referrer allow-list is a separate,
     unverified guess and should not be treated as the cause either.

     Silent failure is what made this cost three round trips. Manual typing still works — that part
     of the design is right and stays — but the component now SAYS so, and logs Google's own status
     once, so the next person can tell "no suggestions" from "no matches" without a packet capture. */
  const [denied, setDenied] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const svcRef = useRef<any>(null);
  /** Resolved lazily from `bias`, cached, and never blocking a search if it fails. */
  const biasRef = useRef<{ for: string; loc: any } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<any>(null);

  // Anchor the portal list directly under the input, in viewport (fixed) coordinates.
  const place = () => {
    const r = box.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, top: r.bottom + 4, width: r.width });
  };

  useEffect(() => {
    let dead = false;
    loadGoogleMaps().then((g) => {
      if (dead) return;
      svcRef.current = new g.maps.places.AutocompleteService();
      tokenRef.current = new g.maps.places.AutocompleteSessionToken();
    }).catch(() => {}); // silent → manual entry still works
    // Close on an outside click. The list now lives in a portal, so check BOTH the input
    // wrapper and the portal menu before deciding a click was "outside".
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => { dead = true; document.removeEventListener("click", close); };
  }, []);

  // While open, keep the list glued to the input as the page scrolls/resizes.
  useEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => { window.removeEventListener("scroll", onMove, true); window.removeEventListener("resize", onMove); };
  }, [open]);

  /* Geocode the bias string ONCE per value. A failure is silently ignored — an unbiased search is
     the previous behaviour, which was serviceable; a search that waits on a geocode is not. */
  const ensureBias = async () => {
    const want = (bias || "").trim();
    if (!want) return null;
    if (biasRef.current?.for === want) return biasRef.current.loc;
    try {
      const g = await loadGoogleMaps();
      const r: any = await new Promise(resolve => new g.maps.Geocoder().geocode(
        { address: want, ...(countries?.length ? { componentRestrictions: { country: countries[0] } } : {}) },
        (res: any[], status: string) => resolve(status === "OK" && res?.length ? res[0] : null)));
      const loc = r?.geometry?.location ?? null;
      biasRef.current = { for: want, loc };
      return loc;
    } catch { return null; }
  };

  const query = async (v: string) => {
    const version = ++requestVersion.current; setActive(-1);
    const svc = svcRef.current;
    if (!svc || v.trim().length < 3) { setPreds([]); setOpen(false); return; }
    const around = await ensureBias();
    if (version !== requestVersion.current) return;
    svc.getPlacePredictions(
      {
        input: v,
        sessionToken: tokenRef.current,
        /* `(cities)` is Google's own collection for locality + administrative_area_level_3. It is
           what makes a city field return "Medellín, Antioquia, Colombia" instead of every street
           in it — Lee, 11 Aug: *"the city should be based on Google places."* */
        /* ── THE NEIGHBOURHOOD VARIANT (Lee, 12 Aug 2026) ────────────────────────────────
           *"When you type in the neighbourhood it should give you the Google places for the
           neighbourhood."*

           `(regions)` is Google's collection for locality, sublocality, postal_code and
           NEIGHBORHOOD — the only prediction type that returns "El Poblado" as a place rather
           than as a street match. `(cities)` excludes it and `geocode` buries it under every
           address in the barrio, which is why typing a barrio into the city field never worked.

           `neighborhood` alone is NOT a valid standalone type for the Autocomplete service, so
           the collection is the right call here rather than a narrower filter. Bias the request
           to the chosen city and the six real answers come back first. */
        types: variant === "establishment" ? ["establishment"]
             : variant === "city" ? ["(cities)"]
             : variant === "neighbourhood" ? ["(regions)"]
             : ["geocode"],
        ...(countries?.length ? { componentRestrictions: { country: countries } } : {}),
        /* 30km covers a metropolitan area — the Aburrá valley end to end — without excluding a
           suburb somebody would reasonably call part of the city. */
        ...(around ? { locationBias: { center: around, radius: 30_000 } } : {}),
      },
      (res: any[], status: string) => {
        /* ZERO_RESULTS is a normal answer — nothing matched. Anything else is the service refusing
           us, and that is a configuration fault the product should not hide. */
        if (version !== requestVersion.current) return;
        if (status !== "OK" && status !== "ZERO_RESULTS") {
          if (!warned) {
            warned = true;
            console.error(
              `[shell] Google Places refused the request: ${status}. ` +
              `Address autocomplete is OFF across every product until this is fixed — check that ` +
              `billing is enabled on the Google Cloud project and that the Places API is on for ` +
              `key ${"…" + String(GOOGLE_MAPS_KEY).slice(-6)}. Typing an address by hand still works.`);
          }
          setDenied(true);
        }
        if (version !== requestVersion.current) return;
        if (status !== "OK" || !res?.length) { setPreds([]); setOpen(false); return; }
        setDenied(false);
        setPreds(res.slice(0, 6).map((p) => ({
          id: p.place_id, text: p.description,
          main: p.structured_formatting?.main_text ?? p.description,
          secondary: p.structured_formatting?.secondary_text ?? "",
        })));
        place();
        setOpen(true);
      }
    );
  };

  const pick = (p: { id: string; text: string; main: string; secondary: string }) => {
    if (disabled) return; requestVersion.current++;
    onChange(p.text);
    onSelect?.(p.text);
    onSelectParts?.({ name: p.main, address: p.secondary, full: p.text, placeId: p.id });
    setPreds([]); setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <input
        id={id} aria-label={ariaLabel} disabled={disabled} role="combobox" aria-autocomplete="list"
        aria-expanded={open && !disabled} aria-controls={open ? menuId : undefined}
        aria-activedescendant={open && active >= 0 ? `${menuId}-${active}` : undefined}
        onKeyDown={e => {
          if (e.key === "Escape") { requestVersion.current++; setOpen(false); return; }
          if (e.key === "Tab") { requestVersion.current++; setOpen(false); return; }
          if (!open || !preds.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setActive(x => (x + (e.key === "ArrowDown" ? 1 : -1) + preds.length) % preds.length);
          } else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(preds[active]); }
          else if (e.key === "Tab") setOpen(false);
        }}
        className={className + " pr-9"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); query(e.target.value); }}
        onFocus={() => { if (preds.length > 0) { place(); setOpen(true); } }}
        autoComplete="off"
      />
      {value && (
        <button  type="button" disabled={disabled} onClick={() => { requestVersion.current++; onChange(""); setPreds([]); setOpen(false); }} aria-label={es ? "Borrar" : "Clear"}
          className="ow-tap absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center">
          <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-ink/10 dark:bg-white/15">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
        </button>
      )}
      {/* Shown only once Google has actually refused — never while it is merely still loading, and
          never on a genuine "no matches". Quiet, because the field works: this is an explanation,
          not an error. */}
      {denied && (
        <p className="mt-1 text-[11px] leading-snug opacity-50">
          {es ? "Las sugerencias no están disponibles. Puede escribir la ubicación manualmente." : "Suggestions are unavailable. You can enter the location manually."}
        </p>
      )}
      {open && !disabled && preds.length > 0 && rect && createPortal(
        <div ref={menuRef} id={menuId} role="listbox" aria-label={ariaLabel ?? (es ? "Ubicaciones" : "Locations")}
          style={{ position: "fixed", left: rect.left, top: rect.top, width: rect.width, zIndex: 130 }}
          className="max-h-64 overflow-y-auto rounded-xl border border-ink/10 bg-white shadow-xl dark:border-white/10 dark:bg-[#111827]">
          {preds.map((p, i) => (
            <button type="button" key={p.id} id={`${menuId}-${i}`} role="option" aria-selected={active === i} tabIndex={-1} className={`block w-full px-3.5 py-2.5 text-left text-sm hover:bg-brand/10 ${active === i ? "bg-brand/10" : ""}`}
              onClick={() => pick(p)}><IconPin size={13} className="mr-1.5 inline-block align-[-2px] opacity-60" />{p.main ? <><span className="font-semibold">{p.main}</span>{p.secondary ? <span className="opacity-60"> · {p.secondary}</span> : null}</> : p.text}</button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
