import { useEffect, useRef, useState } from "react";
import { Field, GlassSelect, PlacesInput, W, Wt, checkAddress, checkCity, samePlaceName, type PlaceDetails } from "@oneworld/shell";
import { countryLabel, countryOptions } from "../onerental/lib/countries";
import "./whereCopy";

/**
 * WHERE IT IS — ONE address block for the rent form AND the sale form (overlay 48, 6 Oct 2026).
 * ============================================================================================
 * Lee, on the rent form: *"I clicked United States and then I clicked Medellín… it allows you to put
 * Medellín even though you selected the United States… if you select a different country, it should
 * automatically cancel out your whole address… when you put the address in, it just automatically
 * populates the city and your country and your state… don't let them click next and think that
 * somehow they can get away with that."*
 *
 * The rules, in the order a person meets them:
 *  1. ADDRESS FIRST, then the building (optional). Supersedes the 14 Sep "building first" order —
 *     Lee asked for the swap on 6 Oct.
 *  2. PICKING an address from Google OVERRIDES the rest: neighbourhood, city, state and country all
 *     come from Google's own address components. That pick becomes the ANCHOR.
 *  3. CHANGING the country, or picking a city, that the anchored address is not in clears the
 *     address (and the building and neighbourhood that came with it), says why, and offers Undo.
 *  4. The city box suggests cities IN the chosen country only.
 *  5. An address TYPED by hand is looked up inside the chosen country. Not found, or found in a
 *     different city, is a blocker on this step until it is fixed or the host says "keep it as I
 *     typed it" — Google does not know every Colombian address, so the host can always proceed
 *     knowingly. Google not answering at all never blocks anybody.
 *  6. The neighbourhood is REQUIRED in Colombia only (only the barrio is shown publicly there) and
 *     can always be typed freely, picked from Google, or tapped from the curated chips.
 * The parent owns the values (they are saved with the listing); this block owns the judgement.
 */
export type WhereValue = {
  buildingName: string;
  addressLine: string;
  neighbourhood: string;
  cityText: string;
  regionText: string;
  countryCode: string;
};

type Anchor = { country: string; city: string };

/** Is the neighbourhood required for this country? Colombia only. */
export const neighbourhoodRequired = (countryCode: string) => !countryCode || countryCode.toUpperCase() === "CO";

export default function WhereItIs({ lang, value, onPatch, hoods, addressHint, onConflict }: {
  lang: string;
  value: WhereValue;
  onPatch: (patch: Partial<WhereValue>) => void;
  /** Curated barrio chips for the city in the box (empty outside the cities we curate). */
  hoods: string[];
  addressHint: string;
  /** The step's blocker: a sentence while the address and the city/country disagree, else null. */
  onConflict: (message: string | null) => void;
}) {
  const v = value;
  const cityLabel = v.cityText.split(",")[0].trim() || v.cityText.trim();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [notice, setNotice] = useState<{ text: string; undo: WhereValue; anchor: Anchor | null } | null>(null);
  const [verdict, setVerdict] = useState<{ key: string; kind: "not_found" | "other_city"; city?: string; details?: PlaceDetails } | null>(null);
  const [keptKey, setKeptKey] = useState<string | null>(null);
  /** A city typed by hand that Google cannot find in the chosen country ("Medellín" + United States). */
  const [cityMissing, setCityMissing] = useState<string | null>(null);
  const cityPickedRef = useRef(false);
  /* Testing, 6 Oct (P1): "pending is neither a validated result nor a deliberate override." The key
     each lookup last SETTLED for — any answer counts, including "Google did not answer". Until the
     current input's key has settled, the step reports "Checking the address…" as its blocker. */
  const [addrSettled, setAddrSettled] = useState<string | null>(null);
  const [citySettled, setCitySettled] = useState<string | null>(null);
  const valueRef = useRef(v); valueRef.current = v;
  const anchorRef = useRef(anchor); anchorRef.current = anchor;

  const countryName = (code: string) => countryLabel(code, lang) || code;
  const cleared = (snapshot: WhereValue, text: string) => setNotice({ text, undo: snapshot, anchor: anchorRef.current });

  /** A picked address or building: everything below it comes from Google, and it is the anchor. */
  function fillFrom(d: PlaceDetails) {
    const cur = valueRef.current;
    const cityChanged = !!d.city && !samePlaceName(d.city, cur.cityText);
    onPatch({
      countryCode: d.country || cur.countryCode,
      cityText: d.city || cur.cityText,
      regionText: d.region || (cityChanged ? "" : cur.regionText),
      neighbourhood: d.neighbourhood || (cityChanged ? "" : cur.neighbourhood),
    });
    setAnchor(d.country ? { country: d.country, city: d.city } : null);
    setVerdict(null); setNotice(null);
  }

  function changeCountry(next: string) {
    const cur = valueRef.current;
    if (!next || next === cur.countryCode) return;
    const a = anchorRef.current;
    if (a && a.country && a.country !== next) {
      cleared(cur, Wt(lang,
        "The address was in {0}, so it was cleared. Enter an address in {1}.",
        "La dirección era de {0}, así que se borró. Ingrese una dirección en {1}.",
        [countryName(a.country), countryName(next)]));
      onPatch({ countryCode: next, addressLine: "", buildingName: "", cityText: "", regionText: "", neighbourhood: "" });
      setAnchor(null); setVerdict(null);
      return;
    }
    // No picked address to protect, but a city from another country cannot stay either.
    if (cur.cityText.trim() || cur.neighbourhood.trim()) {
      cleared(cur, Wt(lang,
        "The country changed to {0}, so the city and neighbourhood were cleared.",
        "El país cambió a {0}, así que se borraron la ciudad y el barrio.",
        [countryName(next)]));
      onPatch({ countryCode: next, cityText: "", regionText: "", neighbourhood: "" });
    } else {
      onPatch({ countryCode: next });
    }
  }

  function pickCity(d: PlaceDetails, name: string) {
    const cur = valueRef.current;
    const nextCity = d.city || name.split(",")[0].trim();
    const a = anchorRef.current;
    const addressElsewhere = !!a && ((a.country && d.country && a.country !== d.country) || (a.city && !samePlaceName(a.city, nextCity)));
    const cityChanged = !samePlaceName(nextCity, cur.cityText);
    if (addressElsewhere) {
      cleared(cur, Wt(lang,
        "The address was in {0}, so it was cleared. Enter an address in {1}.",
        "La dirección era de {0}, así que se borró. Ingrese una dirección en {1}.",
        [a!.city || countryName(a!.country), nextCity]));
      onPatch({ cityText: nextCity, regionText: d.region, countryCode: d.country || cur.countryCode, addressLine: "", buildingName: "", neighbourhood: "" });
      setAnchor(null); setVerdict(null);
      return;
    }
    onPatch({ cityText: nextCity, regionText: d.region, countryCode: d.country || cur.countryCode, ...(cityChanged ? { neighbourhood: "" } : {}) });
  }

  /* ── An address typed by hand: look it up inside the chosen country, after a pause in typing. ── */
  const checkKey = `${v.addressLine.trim()}|${cityLabel}|${v.countryCode}`;
  const addressCheckApplies = !anchor && v.addressLine.trim().length >= 5 && !!v.countryCode;
  useEffect(() => {
    if (!addressCheckApplies) { setVerdict(null); return; }
    let live = true;
    const key = checkKey;
    const t = setTimeout(() => {
      void checkAddress(v.addressLine.trim(), cityLabel, v.countryCode).then(r => {
        if (!live) return;
        setAddrSettled(key);
        if (r.status === "not_found") setVerdict({ key: checkKey, kind: "not_found" });
        else if (r.status === "other_city") setVerdict({ key: checkKey, kind: "other_city", city: r.details.city, details: r.details });
        else {
          setVerdict(null);
          // Found where they said: fill only what is still BLANK — never overwrite what they typed.
          if (r.status === "ok") {
            const cur = valueRef.current;
            const patch: Partial<WhereValue> = {};
            if (!cur.cityText.trim() && r.details.city) patch.cityText = r.details.city;
            if (!cur.regionText.trim() && r.details.region) patch.regionText = r.details.region;
            if (!cur.neighbourhood.trim() && r.details.neighbourhood) patch.neighbourhood = r.details.neighbourhood;
            if (Object.keys(patch).length) onPatch(patch);
          }
        }
      });
    }, 900);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkKey, anchor]);

  /* ── A city typed by hand, with no address to judge it by: does it exist in that country? ── */
  const cityKey = `${cityLabel}|${v.countryCode}`;
  const cityCheckApplies = !cityPickedRef.current && !anchor && v.addressLine.trim().length < 5 && cityLabel.length >= 2 && !!v.countryCode;
  useEffect(() => {
    setCityMissing(null);
    if (!cityCheckApplies) return;
    let live = true;
    const key = cityKey;
    const t = setTimeout(() => { void checkCity(cityLabel, v.countryCode).then(ok => { if (!live) return; setCitySettled(key); if (ok === false) setCityMissing(key); }); }, 900);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey, anchor, v.addressLine.trim().length >= 5]);

  /* ── The conflict this step reports, in one sentence. ── */
  const anchorCityConflict = !!anchor && !!anchor.city && !!cityLabel && !samePlaceName(anchor.city, cityLabel);
  const activeVerdict = verdict && verdict.key === checkKey && keptKey !== checkKey ? verdict : null;
  const conflict = anchorCityConflict
    ? Wt(lang, "The address is in {0}, not {1}.", "La dirección está en {0}, no en {1}.", [anchor!.city, cityLabel])
    : activeVerdict?.kind === "other_city"
    ? Wt(lang, "This address is in {0}, not {1}.", "Esta dirección está en {0}, no en {1}.", [activeVerdict.city ?? "", cityLabel || countryName(v.countryCode)])
    : activeVerdict?.kind === "not_found"
    ? Wt(lang, "We can't find this address in {0}.", "No encontramos esta dirección en {0}.", [[cityLabel, countryName(v.countryCode)].filter(Boolean).join(", ")])
    : cityMissing === cityKey && keptKey !== cityKey
    ? Wt(lang, "We can't find {0} in {1}.", "No encontramos {0} en {1}.", [cityLabel, countryName(v.countryCode)])
    : null;
  /* Still looking it up for THIS input: not a pass, not a failure — the step waits. An old answer or an
     old "Keep as typed" never stands in for the current input, because both are keyed to it. */
  const checking = !conflict && ((addressCheckApplies && addrSettled !== checkKey) || (cityCheckApplies && citySettled !== cityKey));
  const blocker = conflict ?? (checking ? W(lang, "Checking the address…", "Verificando la dirección…") : null);
  useEffect(() => { onConflict(blocker); }, [blocker]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onConflict(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const fixCity = anchorCityConflict ? anchor!.city : activeVerdict?.kind === "other_city" ? activeVerdict.city : null;
  const required = neighbourhoodRequired(v.countryCode);

  return (
    <>
      <Field label={W(lang, "Address", "Dirección")} hint={addressHint}>
        <PlacesInput
          variant="address" bias={cityLabel}
          value={v.addressLine}
          onChange={value => { onPatch({ addressLine: value }); setAnchor(null); }}
          onSelectParts={({ name, full }) => onPatch({ addressLine: name || full })}
          onDetails={fillFrom}
          placeholder={W(lang, "e.g. Carrera 43A #7-50", "Ej.: Carrera 43A #7-50")} />
        {conflict && (
          <div role="alert" className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[12.5px] font-semibold text-amber-800 dark:text-amber-200" data-ow="address-conflict">
            <p>{conflict}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {fixCity && (
                <button type="button" className="ow-tap rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-paper dark:bg-white dark:text-ink"
                  onClick={() => {
                    const d = activeVerdict?.details;
                    onPatch({ cityText: fixCity, ...(d ? { regionText: d.region, countryCode: d.country || v.countryCode } : {}) });
                    if (d) setAnchor({ country: d.country, city: d.city });
                  }}>
                  {Wt(lang, "Use {0}", "Usar {0}", [fixCity])}
                </button>
              )}
              {!anchorCityConflict && (
                <button type="button" className="ow-tap rounded-full border border-amber-700/40 px-3 py-1.5 text-[12px] font-bold dark:border-amber-200/40"
                  onClick={() => setKeptKey(cityMissing === cityKey && !activeVerdict ? cityKey : checkKey)}>
                  {W(lang, "Keep as typed", "Dejar como está")}
                </button>
              )}
            </div>
          </div>
        )}
        {checking && (
          <p className="mt-1.5 text-[12px] font-semibold opacity-60" aria-live="polite" data-ow="address-checking">
            {W(lang, "Checking the address…", "Verificando la dirección…")}
          </p>
        )}
        {notice && (
          <div role="status" className="mt-2 flex items-start justify-between gap-3 rounded-xl border border-ink/15 bg-ink/[0.04] px-3 py-2.5 text-[12.5px] dark:border-white/15 dark:bg-white/[0.05]" data-ow="address-cleared">
            <p className="min-w-0">{notice.text}</p>
            <button type="button" className="ow-tap shrink-0 font-bold text-brand underline"
              onClick={() => { onPatch(notice.undo); setAnchor(notice.anchor); setNotice(null); }}>
              {W(lang, "Undo", "Deshacer")}
            </button>
          </div>
        )}
      </Field>

      <Field label={W(lang, "Building or complex name", "Nombre del edificio o unidad")} optional>
        <PlacesInput
          variant="establishment" bias={cityLabel}
          countries={v.countryCode ? [v.countryCode.toLowerCase()] : undefined}
          value={v.buildingName}
          onChange={value => onPatch({ buildingName: value })}
          onSelectParts={({ name, address: addr, full }) => {
            const cur = valueRef.current;
            onPatch({ buildingName: name || full, ...(!cur.addressLine.trim() && addr ? { addressLine: addr } : {}) });
          }}
          /* A building only answers the location when no picked address already did. */
          onDetails={d => { if (!anchorRef.current) fillFrom(d); }}
          placeholder={W(lang, "e.g. Torre Bahía", "Ej.: Torre Bahía")} />
      </Field>

      <Field label={W(lang, "Neighbourhood", "Barrio")} optional={!required}>
        <PlacesInput variant="neighbourhood" countries={v.countryCode ? [v.countryCode.toLowerCase()] : undefined} bias={cityLabel}
          value={v.neighbourhood} onChange={value => onPatch({ neighbourhood: value })}
          onSelectParts={({ name }) => onPatch({ neighbourhood: name })}
          placeholder={W(lang, "Type it, or pick a suggestion", "Escríbalo o elija una sugerencia")} />
        {/* The curated barrios are Colombian — never offered under another country's flag. */}
        {hoods.length > 0 && (!v.countryCode || v.countryCode === "CO") && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hoods.map(h => (
              <button key={h} type="button" onClick={() => onPatch({ neighbourhood: v.neighbourhood === h ? "" : h })}
                className={`ow-tap rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${v.neighbourhood === h ? "border-transparent bg-ink text-paper dark:bg-white dark:text-ink" : "ow-edge opacity-70"}`}>
                {h}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label={W(lang, "City", "Ciudad")}
        hint={W(lang, "Filled in from the address. Suggestions are cities in the country below.", "Se llena con la dirección. Las sugerencias son ciudades del país de abajo.")}>
        <PlacesInput
          variant="city"
          countries={v.countryCode ? [v.countryCode.toLowerCase()] : undefined}
          value={v.cityText}
          onChange={value => { cityPickedRef.current = false; onPatch({ cityText: value }); }}
          onDetails={d => { cityPickedRef.current = true; setCityMissing(null); pickCity(d, d.city); }}
          placeholder={W(lang, "City", "Ciudad")} />
        {v.cityText.trim() && (
          <p className="mt-1.5 text-[12.5px] opacity-60">
            {[v.regionText, countryLabel(v.countryCode, lang)].filter(Boolean).join(" · ")}
          </p>
        )}
      </Field>

      <Field label={W(lang, "Country", "País")}>
        <GlassSelect value={v.countryCode} onChange={changeCountry} searchable
          ariaLabel={W(lang, "Country", "País")}
          triggerLabel={v.countryCode ? countryLabel(v.countryCode, lang) : W(lang, "Filled in from the address", "Se llena con la dirección")}
          options={countryOptions(lang)} className="w-full" />
      </Field>
    </>
  );
}
