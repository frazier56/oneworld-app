import { useEffect, useMemo, useState } from "react";
import RouteCard, { useRoute } from "../components/RouteCard";
import PriceStepper from "../components/PriceStepper";
import { suggestFare } from "../lib/fare";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useI18n, useAsync, useOneId, productHref, W, Wt, ScreenHeading, PlacesInput, fmtMoney, useViewerCcy,
  GlassDate, GlassTimePicker, SegTabs, Field,
} from "@oneworld/shell";
import { listDrivers, createRide, myRides, isRefusal, type PriceMode } from "../lib/data";

const MAX_STOPS = 5;
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** /rides/request — the centre tab. Pickup, stops in order, drop-off, when, a note, the price style,
 *  and the drivers it goes to. One request, sent to each chosen driver as a Messages bubble. */
export default function Request() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const to = useMemo(() => (params.get("to") ?? "").split(",").filter(Boolean).slice(0, 10), [params]);
  const drivers = useAsync(() => listDrivers(), []);
  const chosen = (drivers ?? []).filter(d => to.includes(d.driver_id));

  const tomorrow = new Date(Date.now() + 864e5);
  const [pickup, setPickup] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [dropoff, setDropoff] = useState("");
  const [day, setDay] = useState(isoDay(tomorrow));
  const [time, setTime] = useState("08:00");
  const [mode, setMode] = useState<PriceMode>("offer");
  const [amount, setAmount] = useState("");
  const [viewerCcy] = useViewerCcy();
  const [ccy, setCcy] = useState<"COP" | "USD">(() => (viewerCcy === "USD" ? "USD" : "COP"));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const when = new Date(`${day}T${time || "08:00"}`);
  const route = useRoute(pickup ? { label: pickup } : null, stops.filter(s => s.trim()).map(label => ({ label })), dropoff ? { label: dropoff } : null, Number.isNaN(when.getTime()) ? null : when.toISOString());
  const suggested = route ? suggestFare(route.km, route.minutes, ccy) : null;
  /* The suggested price fills the box until the rider types their own (Lee: "something to go on"). */
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (suggested != null && !touched) setAmount(String(suggested)); }, [suggested, touched]);
  const price = Number(amount);
  const problems: string[] = [];
  if (!chosen.length) problems.push(W(lang, "Choose at least one driver.", "Elija al menos un conductor."));
  if (pickup.trim().length < 3) problems.push(W(lang, "Add the pickup.", "Agregue la recogida."));
  if (stops.some(s => s.trim().length < 3)) problems.push(W(lang, "Fill in or remove the empty stop.", "Complete o quite la parada vacía."));
  if (dropoff.trim().length < 3) problems.push(W(lang, "Add the drop-off.", "Agregue el destino."));
  if (!(when.getTime() > Date.now())) problems.push(W(lang, "Pick a time from now on.", "Elija una hora futura."));
  if (mode === "offer" && !(price > 0)) problems.push(W(lang, "Name your price.", "Ponga su precio."));

  const fmtWhen = when.toLocaleString(lang === "en" ? "en" : lang === "co" ? "es-CO" : lang, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const summary = [
    W(lang, "Ride request", "Solicitud de viaje"), fmtWhen, `${pickup.trim()} → ${dropoff.trim()}`,
    stops.length ? Wt(lang, "{0} stops", "{0} paradas", [stops.length]) : "",
    mode === "offer" && price > 0 ? fmtMoney(price, ccy, { cents: false }) : W(lang, "Asking for prices", "Pidiendo precios"),
  ].filter(Boolean).join(" · ");

  async function send() {
    setTried(true);
    if (busy || problems.length || !userId) return;
    setBusy(true); setErr(null);
    const sentAt = Date.now();
    try {
      const id = await createRide({
        pickup: { label: pickup.trim() }, stops: stops.map(s => ({ label: s.trim() })), dropoff: { label: dropoff.trim() },
        pickupAt: when, note: note.trim(), mode, offer: mode === "offer" ? price : null, currency: ccy,
        driverIds: chosen.map(d => d.driver_id), text: summary,
      });
      nav(productHref("oneride", `/r/${id}`), { replace: true });
    } catch (e) {
      if ((e as { code?: string } | null)?.code === "OW429") { setErr(W(lang, "Too many requests in the last hour. Try again later.", "Demasiadas solicitudes en la última hora. Intente más tarde.")); return; }
      if (!isRefusal(e)) {
        /* Outcome unknown: the request may exist. Read before offering to send it again. */
        const mine = await myRides(userId).catch(() => null);
        const hit = mine?.asked.find(r => r.pickup.label === pickup.trim() && Date.parse(r.created_at) > sentAt - 60_000);
        if (hit) { nav(productHref("oneride", `/r/${hit.id}`), { replace: true }); return; }
      }
      setErr(W(lang, "That was not sent. Try again.", "No se envió. Intente de nuevo."));
    } finally { setBusy(false); }
  }

  const pickHref = productHref("oneride", `/drivers${to.length ? `?to=${to.join(",")}` : ""}`);
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{W(lang, "Request a ride", "Pedir un viaje")}</ScreenHeading>
      <fieldset disabled={busy} className="min-w-0 disabled:opacity-60">
        <section className="card mt-4 space-y-4 !rounded-2xl !p-4">
          <Field label={W(lang, "Drivers", "Conductores")} lang={lang}>
            <div className="flex flex-wrap items-center gap-2">
              {chosen.map(d => (
                <span key={d.driver_id} className="rounded-full bg-teal/15 px-3 py-1.5 text-[13px] font-bold text-teal-deep dark:text-teal">{d.full_name?.trim() || W(lang, "Driver", "Conductor")}</span>
              ))}
              <Link to={pickHref} className="ow-tap ow-edge rounded-full border px-3 py-1.5 text-[13px] font-bold">
                {chosen.length ? W(lang, "Change", "Cambiar") : W(lang, "Choose drivers", "Elegir conductores")}
              </Link>
            </div>
          </Field>
          <Field label={W(lang, "Pickup", "Recogida")} lang={lang}>
            <PlacesInput id="ride-pickup" ariaLabel={W(lang, "Pickup", "Recogida")} value={pickup} onChange={setPickup} placeholder={W(lang, "Search for an address", "Buscar dirección")} />
          </Field>
          {stops.map((s, i) => (
            <Field key={i} label={Wt(lang, "Stop {0}", "Parada {0}", [i + 1])} lang={lang}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <PlacesInput id={`ride-stop-${i}`} ariaLabel={Wt(lang, "Stop {0}", "Parada {0}", [i + 1])} value={s}
                    onChange={v => setStops(x => x.map((y, j) => (j === i ? v : y)))} placeholder={W(lang, "Search for an address", "Buscar dirección")} />
                </div>
                <button type="button" onClick={() => setStops(x => x.filter((_, j) => j !== i))} aria-label={W(lang, "Remove stop", "Quitar parada")}
                  className="ow-tap ow-edge grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-[20px] leading-none">×</button>
              </div>
            </Field>
          ))}
          {stops.length < MAX_STOPS && (
            <button type="button" onClick={() => setStops(x => [...x, ""])} className="ow-tap text-[13.5px] font-bold underline underline-offset-4">
              {W(lang, "Add a stop", "Agregar parada")}
            </button>
          )}
          <Field label={W(lang, "Drop-off", "Destino")} lang={lang}>
            <PlacesInput id="ride-dropoff" ariaLabel={W(lang, "Drop-off", "Destino")} value={dropoff} onChange={setDropoff} placeholder={W(lang, "Search for an address", "Buscar dirección")} />
          </Field>
          <Field label={W(lang, "Date", "Fecha")} lang={lang}><GlassDate value={day} onChange={setDay} min={isoDay(new Date())} /></Field>
          <Field label={W(lang, "Time", "Hora")} lang={lang}><GlassTimePicker value={time} onChange={setTime} defaultTime="08:00" /></Field>
        </section>

        {pickup && dropoff && <RouteCard pickup={{ label: pickup }} stops={stops.filter(s => s.trim()).map(label => ({ label }))} dropoff={{ label: dropoff }} info={route} />}

        <section className="card mt-3 space-y-4 !rounded-2xl !p-4">
          <SegTabs<PriceMode> value={mode} onChange={setMode} options={[
            { value: "offer", label: W(lang, "My price", "Mi precio") },
            { value: "quotes", label: W(lang, "Ask for prices", "Pedir precios") },
          ]} />
          <p className="text-[12.5px] leading-snug opacity-65">
            {mode === "offer"
              ? W(lang, "The first driver to accept gets the ride. No takers? Raise it later.", "El primer conductor que acepte se lleva el viaje. ¿Nadie acepta? Súbalo después.")
              : W(lang, "Drivers send their prices. You pick one.", "Los conductores envían su precio. Usted elige uno.")}
          </p>
          {mode === "offer" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold opacity-70">{W(lang, "Your price", "Su precio")}</span>
                <SegTabs<"COP" | "USD"> value={ccy} onChange={c => { setCcy(c); setTouched(false); }} size="sm" options={[{ value: "COP", label: "COP" }, { value: "USD", label: "USD" }]} />
              </div>
              <PriceStepper value={amount} onChange={v => { setTouched(true); setAmount(v); }} currency={ccy} ariaLabel={W(lang, "Your price", "Su precio")} />
              {suggested != null && <p className="text-center text-[12.5px] opacity-65">{Wt(lang, "Suggested for this route: {0}", "Sugerido para esta ruta: {0}", [fmtMoney(suggested, ccy, { cents: false })])}</p>}
            </div>
          )}
          <Field label={W(lang, "Note for the driver", "Nota para el conductor")} optional lang={lang}>
            <textarea className="input min-h-[84px] w-full text-base" maxLength={500} value={note} onChange={e => setNote(e.target.value)}
              placeholder={W(lang, "Bags, child seat, where to wait…", "Maletas, silla de niño, dónde esperar…")} />
          </Field>
        </section>

        {tried && problems.length > 0 && (
          <ul role="alert" className="mt-3 space-y-1 rounded-2xl border border-red-500/35 bg-red-500/[0.07] p-3 text-[13.5px] font-semibold text-red-600 dark:text-red-400">
            {problems.map(p => <li key={p}>{p}</li>)}
          </ul>
        )}
        {err && <p role="alert" className="mt-3 text-sm font-bold text-rose-600 dark:text-rose-300">{err}</p>}
        <button type="button" onClick={send} aria-busy={busy} className="btn-primary mt-4 w-full disabled:opacity-50">
          {busy ? W(lang, "Sending…", "Enviando…") : chosen.length > 1 ? Wt(lang, "Send to {0} drivers", "Enviar a {0} conductores", [chosen.length]) : W(lang, "Send request", "Enviar solicitud")}
        </button>
      </fieldset>
    </div>
  );
}
