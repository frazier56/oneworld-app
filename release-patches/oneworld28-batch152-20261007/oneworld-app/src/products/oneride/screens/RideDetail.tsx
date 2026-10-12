import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n, useOneId, productHref, W, Wt, ScreenHeading, requestReviewCheck } from "@oneworld/shell";
import RouteCard, { useRoute, type RouteInfo } from "../components/RouteCard";
import PriceStepper from "../components/PriceStepper";
import { useRideMoney } from "../components/RideMoney";
import { suggestFare, fareStep } from "../lib/fare";
import {
  getRide, driverRespond, riderAccept, riderRaise, cancelRide, cancelBooking, tripStep, bookedCar, isRefusal, isExpired,
  type RideRequest, type RideDriverRow, type Person, type BookedCar, type DriverState,
} from "../lib/data";

type Loaded = { ride: RideRequest; drivers: RideDriverRow[]; people: Map<string, Person> };

/** /rides/r/:id — one ride. The rider sees every driver's answer and picks; a driver sees only
 *  their own row and answers. Every button is a database function that locks the ride first. */
export default function RideDetail() {
  const { id = "" } = useParams();
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [car, setCar] = useState<BookedCar | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rideMoney = useRideMoney();
  const route = useRoute(data?.ride.pickup ?? null, data?.ride.stops ?? [], data?.ride.dropoff ?? null, data?.ride.pickup_at);
  const load = useCallback(async () => {
    try {
      const d = await getRide(id); setData(d);
      if ((d?.ride.status === "booked" || d?.ride.status === "in_progress") && d.ride.rider_id === userId) setCar(await bookedCar(id).catch(() => null));
    } catch { setData(null); }
  }, [id, userId]);
  useEffect(() => { void load(); }, [load]);

  /** Run one action. A refusal shows its reason; an unknown outcome is settled by reading the ride. */
  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setErr(null);
    try { await fn(); }
    catch (e) {
      if (isRefusal(e)) setErr(refusalText(lang, String((e as { message?: string }).message ?? "")));
    } finally { await load(); setBusy(false); }
  }

  if (data === undefined) return <div className="px-4"><ScreenHeading>{W(lang, "Ride", "Viaje")}</ScreenHeading><div className="card ow-shimmer mt-4 h-64" /></div>;
  if (data === null) return (
    <div className="px-4 pb-10"><ScreenHeading>{W(lang, "Ride", "Viaje")}</ScreenHeading>
      <div className="card mt-4 p-8 text-center text-sm font-bold">{W(lang, "This ride is not available to you.", "Este viaje no está disponible para usted.")}</div></div>
  );

  const { ride, drivers, people } = data;
  const isRider = ride.rider_id === userId;
  const mine = drivers.find(d => d.driver_id === userId);
  const money = (n: number | null) => rideMoney(n, ride.currency);
  const name = (pid: string | null) => (pid && people.get(pid)?.full_name?.trim()) || W(lang, "Member", "Miembro");
  const expired = isExpired(ride);
  const open = ride.status === "open" && !expired;
  const trip = (isRider || mine?.state === "won") && ["booked", "in_progress", "completed"].includes(ride.status)
    ? <TripPanel ride={ride} isRider={isRider} other={isRider ? name(ride.booked_driver_id) : name(ride.rider_id)} lang={lang} busy={busy}
        onStep={step => act(async () => { const st = await tripStep(ride.id, step); if (st === "completed") requestReviewCheck(); })} />
    : null;
  const cancelBooked = (other: string) => act(() => cancelBooking(ride.id, Wt(lang, "Ride cancelled by {0}", "Viaje cancelado por {0}", [other])));
  const when = new Date(ride.pickup_at).toLocaleString(lang === "en" ? "en" : lang === "co" ? "es-CO" : lang,
    { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{W(lang, "Ride", "Viaje")}</ScreenHeading>

      <section className="card mt-4 !rounded-2xl !p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-extrabold leading-snug">{when}</p>
          <StatusChip status={expired ? "expired" : ride.status} lang={lang} />
        </div>
        <ol className="mt-3 space-y-2.5">
          <Stop n="A" label={ride.pickup.label} />
          {ride.stops.map((s, i) => <Stop key={i} n={String(i + 1)} label={s.label} />)}
          <Stop n="B" label={ride.dropoff.label} />
        </ol>
        {ride.note && <p className="mt-3 rounded-xl bg-ink/[0.04] p-3 text-[13px] leading-snug dark:bg-white/[0.06]">{ride.note}</p>}
        <p className="mt-3 text-[13.5px] font-bold">
          {ride.agreed_amount != null ? Wt(lang, "Agreed price: {0}", "Precio acordado: {0}", [money(ride.agreed_amount)])
            : ride.price_mode === "offer" ? Wt(lang, "Rider's price: {0}", "Precio del pasajero: {0}", [money(ride.offer_amount)])
            : W(lang, "Asking for prices", "Pidiendo precios")}
        </p>
        {!isRider && <p className="mt-1 text-[12.5px] opacity-60">{Wt(lang, "Requested by {0}", "Solicitado por {0}", [name(ride.rider_id)])}</p>}
      </section>

      {(isRider || !!mine) && <RouteCard pickup={ride.pickup} stops={ride.stops} dropoff={ride.dropoff} info={route} />}

      {err && <p role="alert" className="mt-3 text-sm font-bold text-rose-600 dark:text-rose-300">{err}</p>}

      {ride.status === "cancelled" && ride.cancelled_by && ride.booked_driver_id && (
        <p className="card mt-3 !rounded-2xl !p-4 text-[14px] font-bold">
          {ride.cancelled_by === userId ? W(lang, "You cancelled this ride.", "Usted canceló este viaje.")
            : isRider ? W(lang, "Your driver cancelled. Send a new request to book another.", "Su conductor canceló. Envíe una nueva solicitud para reservar otro.")
            : W(lang, "The rider cancelled this ride.", "El pasajero canceló este viaje.")}
        </p>
      )}
      {expired && <p className="card mt-3 !rounded-2xl !p-4 text-[14px] font-bold">{W(lang, "This request's time has passed.", "La hora de esta solicitud ya pasó.")}</p>}

      {isRider && <RiderPanel ride={ride} drivers={drivers} name={name} money={money} lang={lang} busy={busy} car={car} open={open} trip={trip}
        onCancelBooked={() => cancelBooked(name(ride.rider_id))}
        onAccept={d => act(() => riderAccept(ride.id, d, Wt(lang, "Booked at {0}", "Reservado por {0}", [money(drivers.find(x => x.driver_id === d)?.quote_amount ?? null)])))}
        route={route} onRaise={n => act(() => riderRaise(ride.id, n, Wt(lang, "New price: {0}", "Nuevo precio: {0}", [money(n)])))}
        onCancel={() => act(() => cancelRide(ride.id, W(lang, "Ride request cancelled", "Solicitud de viaje cancelada")))} />}

      {!isRider && mine && <DriverPanel ride={ride} me={mine} money={money} lang={lang} busy={busy} open={open} route={route}
        riderName={name(ride.rider_id)} trip={trip} onCancelBooked={() => cancelBooked(name(mine.driver_id))}
        onAccept={() => act(() => driverRespond(ride.id, "accept", null, Wt(lang, "Accepted at {0}", "Aceptado por {0}", [money(ride.offer_amount)])))}
        onQuote={n => act(() => driverRespond(ride.id, "quote", n, Wt(lang, "My price: {0}", "Mi precio: {0}", [money(n)])))}
        onDecline={() => act(() => driverRespond(ride.id, "decline", null, ""))} />}

      <Link to={productHref("oneride", "/messages")} className="ow-tap mt-4 block text-center text-[13.5px] font-bold underline underline-offset-4">
        {W(lang, "Messages", "Mensajes")}
      </Link>
    </div>
  );
}

function Stop({ n, label }: { n: string; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-black text-white dark:bg-brand-light dark:text-ink">{n}</span>
      <span className="pt-0.5 text-[13.5px] leading-snug">{label}</span>
    </li>
  );
}

function StatusChip({ status, lang }: { status: RideRequest["status"] | "expired"; lang: string }) {
  const label = status === "booked" ? W(lang, "Booked", "Reservado") : status === "cancelled" ? W(lang, "Cancelled", "Cancelado")
    : status === "in_progress" ? W(lang, "On the way", "En curso") : status === "completed" ? W(lang, "Completed", "Completado")
    : status === "expired" ? W(lang, "Expired", "Vencida") : W(lang, "Open", "Abierto");
  const cls = status === "booked" || status === "in_progress" || status === "completed" ? "bg-teal/15 text-teal-deep dark:text-teal" : status === "cancelled" || status === "expired" ? "bg-ink/[0.06] opacity-70 dark:bg-white/10" : "ow-edge border";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${cls}`}>{label}</span>;
}

function stateLabel(s: DriverState, lang: string, ride: RideRequest, open: boolean) {
  if (ride.status === "cancelled" && s === "won") return W(lang, "Cancelled", "Cancelado");
  if (ride.status === "open" && !open && (s === "sent" || s === "quoted")) return W(lang, "No answer in time", "Sin respuesta a tiempo");
  switch (s) {
    case "sent": return W(lang, "Waiting", "Esperando");
    case "quoted": return W(lang, "Sent a price", "Envió precio");
    case "declined": return W(lang, "Declined", "Rechazó");
    case "won": return W(lang, "Booked", "Reservado");
    case "lost": return W(lang, "Not chosen", "No elegido");
    default: return W(lang, "Withdrawn", "Retirado");
  }
}

function RiderPanel({ ride, drivers, name, money, lang, busy, car, open, trip, route, onAccept, onRaise, onCancel, onCancelBooked }: {
  ride: RideRequest; drivers: RideDriverRow[]; name: (id: string | null) => string; money: (n: number | null) => string;
  lang: string; busy: boolean; car: BookedCar | null; open: boolean; trip: React.ReactNode; route: RouteInfo | null | undefined; onAccept: (driver: string) => void; onRaise: (n: number) => void;
  onCancel: () => void; onCancelBooked: () => void;
}) {
  const [raise, setRaise] = useState(() => String((ride.offer_amount ?? 0) + fareStep(ride.currency)));
  const [arming, setArming] = useState(false);
  const next = Number(raise);
  const suggested = route ? suggestFare(route.km, route.minutes, ride.currency) : null;
  return (
    <>
      {["booked", "in_progress", "completed"].includes(ride.status) && (
        <section className="card mt-3 !rounded-2xl !p-4">
          <p className="text-[12px] font-bold uppercase tracking-wide opacity-60">{W(lang, "Your driver", "Su conductor")}</p>
          <p className="mt-1 text-[15px] font-extrabold">{name(ride.booked_driver_id)}</p>
          {car && <p className="mt-1 text-[13.5px]">{car.year} {car.make} {car.model} · {car.colour} · <span className="font-black tracking-wider">{car.plate}</span></p>}
        </section>
      )}
      {trip}
      {ride.status === "booked" && <CancelBooked lang={lang} busy={busy} other={name(ride.booked_driver_id)} onConfirm={onCancelBooked} />}
      {!["booked", "in_progress", "completed"].includes(ride.status) && <section className="mt-3">
        <h2 className="px-1 text-[13px] font-extrabold uppercase tracking-wide opacity-60">{W(lang, "Drivers", "Conductores")}</h2>
        <div className="mt-2 space-y-2">
          {drivers.map(d => (
            <div key={d.driver_id} className="card flex items-center gap-3 !rounded-2xl !p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold">{name(d.driver_id)}</p>
                <p className="text-[12.5px] opacity-65">{stateLabel(d.state, lang, ride, open)}{d.quote_amount != null ? ` · ${money(d.quote_amount)}` : ""}</p>
              </div>
              {open && d.state === "quoted" && d.quote_amount != null && (
                <button type="button" disabled={busy} onClick={() => onAccept(d.driver_id)} className="btn-primary shrink-0 !px-4 !py-2.5 text-[13.5px] disabled:opacity-50">
                  {Wt(lang, "Accept {0}", "Aceptar {0}", [money(d.quote_amount)])}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>}
      {open && ride.price_mode === "offer" && (
        <section className="card mt-3 !rounded-2xl !p-4">
          <p className="text-[13.5px] font-bold">{W(lang, "No takers? Raise your price.", "¿Nadie acepta? Suba su precio.")}</p>
          {suggested != null && <p className="mt-0.5 text-[12.5px] opacity-65">{Wt(lang, "Suggested for this route: {0}", "Sugerido para esta ruta: {0}", [money(suggested)])}</p>}
          <div className="mt-2"><PriceStepper value={raise} onChange={setRaise} currency={ride.currency} min={(ride.offer_amount ?? 0) + 1} ariaLabel={W(lang, "New price", "Nuevo precio")} /></div>
          <button type="button" disabled={busy || !(next > (ride.offer_amount ?? 0))} onClick={() => onRaise(next)}
            className="btn-primary mt-3 w-full disabled:opacity-50">{Wt(lang, "Raise to {0}", "Subir a {0}", [money(next || null)])}</button>
        </section>
      )}
      {open && !arming && (
        <button type="button" onClick={() => setArming(true)} className="ow-tap mt-3 w-full rounded-xl border border-rose-500/50 py-3 text-[14px] font-bold text-rose-600 dark:text-rose-300">
          {W(lang, "Cancel request", "Cancelar solicitud")}
        </button>
      )}
      {open && arming && (
        <div className="card mt-3 !rounded-2xl !p-4">
          <p className="text-[13.5px] leading-snug">{W(lang, "Every driver you asked will be told.", "Se avisará a cada conductor que eligió.")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => setArming(false)} className="ow-tap ow-edge rounded-xl border py-3 text-[14px] font-bold">{W(lang, "Keep", "Conservar")}</button>
            <button type="button" disabled={busy} onClick={onCancel} className="ow-tap rounded-xl bg-rose-600 py-3 text-[14px] font-bold text-white disabled:opacity-50">{W(lang, "Cancel ride", "Cancelar viaje")}</button>
          </div>
        </div>
      )}
    </>
  );
}

function DriverPanel({ ride, me, money, lang, busy, open, riderName, trip, route, onAccept, onQuote, onDecline, onCancelBooked }: {
  ride: RideRequest; me: RideDriverRow; money: (n: number | null) => string; lang: string; busy: boolean; open: boolean;
  riderName: string; trip: React.ReactNode; route: RouteInfo | null | undefined; onAccept: () => void; onQuote: (n: number) => void; onDecline: () => void; onCancelBooked: () => void;
}) {
  const suggested = route ? suggestFare(route.km, route.minutes, ride.currency) : null;
  const [price, setPrice] = useState("");
  /* Start the driver on the suggested price for this route the moment it is known (Lee: "at least
     they have something to go on instead of nothing"). They step it up or down from there. */
  useEffect(() => { if (suggested != null && !price) setPrice(String(suggested)); }, [suggested]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = Number(price);
  const canAnswer = open && ["sent", "quoted", "declined"].includes(me.state);
  const outcome =
    ride.status === "cancelled" ? (ride.booked_driver_id ? null : W(lang, "The rider cancelled.", "El pasajero canceló."))
    : me.state === "won" ? (ride.status === "booked" ? W(lang, "You have this ride.", "Usted tiene este viaje.") : null)
    : me.state === "lost" ? W(lang, "Another driver has this ride.", "Otro conductor tomó este viaje.")
    : me.state === "withdrawn" ? W(lang, "The rider cancelled.", "El pasajero canceló.")
    : me.state === "quoted" ? Wt(lang, "You sent {0}. Waiting for the rider.", "Envió {0}. Esperando al pasajero.", [money(me.quote_amount)])
    : me.state === "declined" ? W(lang, "You declined.", "Usted rechazó.") : null;
  if (!outcome && !canAnswer) return <>{trip}</>;
  return (
    <>
    <section className="card mt-3 space-y-3 !rounded-2xl !p-4">
      {outcome && <p className="text-[14px] font-bold">{outcome}</p>}
      {canAnswer && ride.price_mode === "offer" && (
        <button type="button" disabled={busy} onClick={onAccept} className="btn-primary w-full disabled:opacity-50">
          {Wt(lang, "Accept {0}", "Aceptar {0}", [money(ride.offer_amount)])}
        </button>
      )}
      {canAnswer && (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold opacity-70">
            {ride.price_mode === "offer" ? W(lang, "Or send your own price", "O envíe su propio precio") : W(lang, "Your price", "Su precio")}
          </p>
          {suggested != null && <p className="mb-2 text-[12.5px] opacity-65">{Wt(lang, "Suggested for this route: {0}", "Sugerido para esta ruta: {0}", [money(suggested)])}</p>}
          <PriceStepper value={price} onChange={setPrice} currency={ride.currency} ariaLabel={W(lang, "Your price", "Su precio")} />
          <button type="button" disabled={busy || !(n > 0)} onClick={() => onQuote(n)} className="btn-primary mt-3 w-full disabled:opacity-50">
            {n > 0 ? Wt(lang, "Send {0}", "Enviar {0}", [money(n)]) : W(lang, "Send price", "Enviar precio")}
          </button>
        </div>
      )}
      {canAnswer && me.state !== "declined" && (
        <button type="button" disabled={busy} onClick={onDecline} className="ow-tap ow-edge w-full rounded-xl border py-3 text-[14px] font-bold">{W(lang, "Decline", "Rechazar")}</button>
      )}
    </section>
    {trip}
    {ride.status === "booked" && me.state === "won" && <CancelBooked lang={lang} busy={busy} other={riderName} onConfirm={onCancelBooked} />}
    </>
  );
}

/** Either side may cancel a booked ride. Arm first, then confirm; the other person is told. */
function CancelBooked({ lang, busy, other, onConfirm }: { lang: string; busy: boolean; other: string; onConfirm: () => void }) {
  const [arming, setArming] = useState(false);
  if (!arming) return (
    <button type="button" onClick={() => setArming(true)} className="ow-tap mt-3 w-full rounded-xl border border-rose-500/50 py-3 text-[14px] font-bold text-rose-600 dark:text-rose-300">
      {W(lang, "Cancel ride", "Cancelar viaje")}
    </button>
  );
  return (
    <div className="card mt-3 !rounded-2xl !p-4">
      <p className="text-[13.5px] leading-snug">{Wt(lang, "{0} will be told.", "Se le avisará a {0}.", [other])}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => setArming(false)} className="ow-tap ow-edge rounded-xl border py-3 text-[14px] font-bold">{W(lang, "Keep", "Conservar")}</button>
        <button type="button" disabled={busy} onClick={onConfirm} className="ow-tap rounded-xl bg-rose-600 py-3 text-[14px] font-bold text-white disabled:opacity-50">{W(lang, "Cancel ride", "Cancelar viaje")}</button>
      </div>
    </div>
  );
}

/** The database's refusal, said by the screen. Unknown reasons get one plain line. */
function refusalText(lang: string, msg: string) {
  if (/no longer open/i.test(msg)) return W(lang, "This ride is no longer open.", "Este viaje ya no está abierto.");
  if (/time has passed/i.test(msg)) return W(lang, "This ride's time has passed.", "La hora de este viaje ya pasó.");
  if (/must be higher/i.test(msg)) return W(lang, "The new price must be higher.", "El nuevo precio debe ser mayor.");
  if (/too early to start/i.test(msg)) return W(lang, "Start opens 2 hours before pickup.", "Iniciar se habilita 2 horas antes de la recogida.");
  if (/too late to start/i.test(msg)) return W(lang, "This ride can no longer be started.", "Este viaje ya no se puede iniciar.");
  if (/only a booked ride/i.test(msg)) return W(lang, "This ride is no longer booked.", "Este viaje ya no está reservado.");
  if (/already answered/i.test(msg)) return W(lang, "You have already answered.", "Usted ya respondió.");
  return W(lang, "That did not go through. Try again.", "No se completó. Intente de nuevo.");
}

/** Both press Start, both press End (Lee). Each side sees their own button and who they wait on. */
function TripPanel({ ride, isRider, other, lang, busy, onStep }: {
  ride: RideRequest; isRider: boolean; other: string; lang: string; busy: boolean; onStep: (s: "start" | "end") => void;
}) {
  const iStarted = !!(isRider ? ride.rider_started_at : ride.driver_started_at);
  const iEnded = !!(isRider ? ride.rider_ended_at : ride.driver_ended_at);
  const opensAt = new Date(ride.pickup_at).getTime() - 2 * 3600_000;
  const early = Date.now() < opensAt;
  let line: string | null = null;
  let button: { step: "start" | "end"; label: string } | null = null;
  if (ride.status === "completed") line = W(lang, "Ride complete.", "Viaje terminado.");
  else if (ride.status === "booked") {
    if (!iStarted) { if (early) line = W(lang, "Start opens 2 hours before pickup.", "Iniciar se habilita 2 horas antes de la recogida."); else button = { step: "start", label: W(lang, "Start ride", "Iniciar viaje") }; }
    else line = Wt(lang, "Waiting for {0} to press Start.", "Esperando a que {0} oprima Iniciar.", [other]);
  } else if (ride.status === "in_progress") {
    if (!iEnded) button = { step: "end", label: W(lang, "End ride", "Terminar viaje") };
    else line = Wt(lang, "Waiting for {0} to press End.", "Esperando a que {0} oprima Terminar.", [other]);
  }
  return (
    <section className="card mt-3 space-y-3 !rounded-2xl !p-4">
      {line && <p className="text-[14px] font-bold">{line}</p>}
      {button && (
        <button type="button" disabled={busy} onClick={() => onStep(button!.step)} className="btn-primary w-full disabled:opacity-50">{button.label}</button>
      )}
      {ride.status !== "completed" && (
        <p className="text-[12.5px] leading-snug opacity-60">{W(lang, "The ride starts when you both press Start, and finishes when you both press End.", "El viaje empieza cuando ambos oprimen Iniciar y termina cuando ambos oprimen Terminar.")}</p>
      )}
    </section>
  );
}
