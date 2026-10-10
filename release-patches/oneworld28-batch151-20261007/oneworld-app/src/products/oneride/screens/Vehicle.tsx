import { useEffect, useState } from "react";
import { useI18n, useOneId, W, ScreenHeading, SegTabs } from "@oneworld/shell";
import { setMode } from "../lib/mode";
import { getMyVehicle, saveMyVehicle, removeMyVehicle, normalisePlate, type Vehicle as Car, type ServiceType } from "../lib/data";

type Form = { year: string; make: string; model: string; colour: string; plate: string; serviceType: ServiceType; operationCard: string };
const EMPTY: Form = { year: "", make: "", model: "", colour: "", plate: "", serviceType: "private", operationCard: "" };
const fromCar = (c: Car): Form => ({ year: String(c.year), make: c.make, model: c.model, colour: c.colour, plate: c.plate, serviceType: c.service_type, operationCard: c.operation_card ?? "" });

/** /rides/vehicle — the driver's one car. Verification is server-only: this screen shows it and can
 *  never set it, and changing the year, make, model or plate clears it on the server. */
export default function Vehicle() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [car, setCar] = useState<Car | null | undefined>(undefined);
  const [f, setF] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [arming, setArming] = useState(false);

  useEffect(() => {
    if (!userId) { setCar(null); return; } // guest: look, but saving asks for an account
    let alive = true;
    getMyVehicle(userId).then(c => { if (!alive) return; setCar(c); setF(c ? fromCar(c) : EMPTY); }).catch(() => { if (alive) setCar(null); });
    return () => { alive = false; };
  }, [userId]);

  const maxYear = new Date().getFullYear() + 1;
  const up = (k: keyof Form, v: string) => { setF(x => ({ ...x, [k]: v })); setSaved(false); setErr(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!userId) return setErr(W(lang, "Sign in to add your car.", "Inicie sesión para agregar su carro."));
    const year = Number(f.year);
    if (![f.make, f.model, f.colour, f.plate].every(x => x.trim())) return setErr(W(lang, "Fill in every field.", "Complete todos los campos."));
    if (!Number.isInteger(year) || year < 1980 || year > maxYear) return setErr(W(lang, "Enter a year between 1980 and next year.", "Escriba un año entre 1980 y el próximo año."));
    if (!/^[A-Z0-9-]{2,12}$/.test(normalisePlate(f.plate))) return setErr(W(lang, "Use 2 to 12 letters or numbers for the plate.", "La placa debe tener de 2 a 12 letras o números."));
    if (f.serviceType === "public" && !/^[A-Z0-9-]{3,30}$/.test(normalisePlate(f.operationCard))) return setErr(W(lang, "Add the operating card number.", "Agregue el número de la tarjeta de operación."));
    setBusy(true); setErr(null);
    try {
      const c = await saveMyVehicle(userId, { year, make: f.make, model: f.model, colour: f.colour, plate: f.plate, serviceType: f.serviceType, operationCard: f.operationCard });
      setMode("driver"); // adding a car means you drive: the raised tab becomes the steering wheel
      setCar(c); setF(fromCar(c)); setSaved(true);
    } catch { setErr(W(lang, "That did not save. Try again.", "No se guardó. Intente de nuevo.")); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!userId) return;
    setBusy(true); setErr(null);
    try { await removeMyVehicle(userId); setCar(null); setF(EMPTY); setArming(false); setSaved(false); }
    catch { setErr(W(lang, "That did not save. Try again.", "No se guardó. Intente de nuevo.")); }
    finally { setBusy(false); }
  }

  const field = (k: Exclude<keyof Form, "serviceType">, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="min-w-0">
      <label htmlFor={`ride-${k}`} className="mb-1.5 block text-[14px] font-semibold opacity-70">{label}</label>
      <input id={`ride-${k}`} className="input w-full text-base" value={f[k]} onChange={e => up(k, e.target.value)} {...extra} />
    </div>
  );

  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{W(lang, "My car", "Mi carro")}</ScreenHeading>
      {car === undefined ? <div className="card ow-shimmer mt-4 h-72" /> : (
        <form onSubmit={submit} className="card mt-4 !rounded-2xl !p-4">
          {car && (
            <p className="mb-3">
              {car.verified_at
                ? <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-teal-deep dark:text-teal">{W(lang, "Verified", "Verificado")}</span>
                : <span className="text-[12.5px] font-semibold opacity-60">{W(lang, "Not verified yet", "Aún sin verificar")}</span>}
            </p>
          )}
          <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-60">
            <div>
              <span className="mb-1.5 block text-[14px] font-semibold opacity-70">{W(lang, "Service type", "Tipo de servicio")}</span>
              <SegTabs<ServiceType> value={f.serviceType} onChange={v => { setF(x => ({ ...x, serviceType: v })); setSaved(false); setErr(null); }} options={[
                { value: "private", label: W(lang, "Private", "Particular") },
                { value: "public", label: W(lang, "Public service", "Servicio público") },
              ]} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("year", W(lang, "Year", "Año"), { inputMode: "numeric", maxLength: 4, autoComplete: "off", placeholder: String(maxYear - 3) })}
              {field("colour", W(lang, "Colour", "Color"), { maxLength: 30, autoComplete: "off" })}
            </div>
            {field("make", W(lang, "Make", "Marca"), { maxLength: 40, autoComplete: "off", placeholder: "Toyota" })}
            {field("model", W(lang, "Model", "Modelo"), { maxLength: 40, autoComplete: "off", placeholder: "Corolla" })}
            <div>
              {field("plate", W(lang, "Plate", "Placa"), { maxLength: 14, autoComplete: "off", autoCapitalize: "characters", className: "input w-full text-base uppercase tracking-wider" })}
              <p className="mt-1.5 text-[12.5px] leading-snug opacity-60">{W(lang, "Only you can see the plate. A rider sees it once you accept their ride.", "Solo usted ve la placa. Un pasajero la ve cuando usted acepta su viaje.")}</p>
            </div>
            {f.serviceType === "public" && (
              <div>
                {field("operationCard", W(lang, "Operating card number", "Número de tarjeta de operación"), { maxLength: 32, autoComplete: "off", autoCapitalize: "characters", className: "input w-full text-base uppercase tracking-wider" })}
                <p className="mt-1.5 text-[12.5px] leading-snug opacity-60">{W(lang, "By saving, you confirm this vehicle holds the licences, operating card and insurance its rides require.", "Al guardar, usted confirma que este vehículo tiene las licencias, la tarjeta de operación y los seguros que sus viajes exigen.")}</p>
              </div>
            )}
            {err && <p role="alert" className="text-sm font-bold text-rose-600 dark:text-rose-300">{err}</p>}
            <button type="submit" aria-busy={busy} className="btn-primary w-full disabled:opacity-50">
              {busy ? W(lang, "Saving…", "Guardando…") : saved ? W(lang, "Saved", "Guardado") : W(lang, "Save car", "Guardar carro")}
            </button>
          </fieldset>
        </form>
      )}
      {car && !arming && (
        <button type="button" onClick={() => setArming(true)} className="ow-tap mt-3 w-full rounded-xl border border-rose-500/50 py-3 text-[14px] font-bold text-rose-600 dark:text-rose-300">
          {W(lang, "Remove car", "Quitar carro")}
        </button>
      )}
      {car && arming && (
        <div className="card mt-3 !rounded-2xl !p-4">
          <p className="text-[13.5px] leading-snug">{W(lang, "Riders will no longer see you as a driver.", "Los pasajeros ya no lo verán como conductor.")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => setArming(false)} className="ow-tap ow-edge rounded-xl border py-3 text-[14px] font-bold">{W(lang, "Keep", "Conservar")}</button>
            <button type="button" disabled={busy} onClick={remove} className="ow-tap rounded-xl bg-rose-600 py-3 text-[14px] font-bold text-white disabled:opacity-50">{W(lang, "Remove", "Quitar")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
