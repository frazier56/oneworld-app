import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, productHref, W, ScreenHeading, NavIcon, fmtMoney } from "@oneworld/shell";
import { getMyVehicle, myRides, type RideRequest } from "../lib/data";

/** /rides — what OneRide is, the two ways in (ride or drive), and the four steps of a ride. */
export default function Home() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const car = useAsync(async () => (userId ? getMyVehicle(userId) : null), [userId]);
  const rides = useAsync(async () => (userId ? myRides(userId) : null), [userId]);
  const forMe = (rides?.forMe ?? []).filter(r => r.status === "open" && ["sent", "quoted"].includes(r.myState));
  const asked = (rides?.asked ?? []).filter(r => r.status !== "cancelled").slice(0, 5);
  const steps = [
    W(lang, "You ask a driver, with your stops and time.", "Usted le pide a un conductor, con sus paradas y la hora."),
    W(lang, "The driver replies with a price.", "El conductor responde con un precio."),
    W(lang, "You accept it, and the ride is a contract.", "Usted lo acepta y el viaje queda como contrato."),
    W(lang, "You both press Start, and both press End.", "Los dos oprimen Iniciar y los dos oprimen Terminar."),
  ];
  return (
    <div className="px-4 pb-10">
      <ScreenHeading>{W(lang, "Rides", "Viajes")}</ScreenHeading>
      {forMe.length > 0 && (
        <RideList title={W(lang, "Requests for you", "Solicitudes para usted")} rows={forMe} lang={lang} />
      )}
      {asked.length > 0 && (
        <RideList title={W(lang, "Your rides", "Sus viajes")} rows={asked} lang={lang} />
      )}
      <section className="card mt-4 !rounded-2xl !p-4">
        <h2 className="text-[16px] font-extrabold">{W(lang, "Need a ride?", "¿Necesita un viaje?")}</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed opacity-70">{W(lang, "Pick a driver, send your stops and time, and they reply with a price.", "Elija un conductor, envíe sus paradas y la hora, y le responde con un precio.")}</p>
        <Link to={productHref("oneride", "/drivers")} className="btn-primary mt-3 block w-full text-center">{W(lang, "See drivers", "Ver conductores")}</Link>
      </section>
      <section className="card mt-3 !rounded-2xl !p-4">
        <h2 className="text-[16px] font-extrabold">{W(lang, "Drive with OneRide", "Conduzca con OneRide")}</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed opacity-70">{W(lang, "Riders see your car's make, model and colour. Your plate stays private until a ride is accepted.", "Los pasajeros ven la marca, el modelo y el color de su carro. Su placa queda privada hasta que se acepte un viaje.")}</p>
        <Link to={productHref("oneride", "/vehicle")} className="ow-tap ow-edge mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-[14px] font-bold">
          <NavIcon name="keys" className="h-4 w-4" />
          {car ? W(lang, "My car", "Mi carro") : W(lang, "Add my car", "Agregar mi carro")}
        </Link>
      </section>
      <section className="mt-5">
        <h2 className="px-1 text-[13px] font-extrabold uppercase tracking-wide opacity-60">{W(lang, "How a ride works", "Cómo funciona un viaje")}</h2>
        <ol className="card mt-2 space-y-3 !rounded-2xl !p-4">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-black text-white dark:bg-brand-light dark:text-ink">{i + 1}</span>
              <span className="pt-0.5 text-[13.5px] leading-snug">{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function RideList({ title, rows, lang }: { title: string; rows: RideRequest[]; lang: string }) {
  return (
    <section className="mt-4">
      <h2 className="px-1 text-[13px] font-extrabold uppercase tracking-wide opacity-60">{title}</h2>
      <div className="mt-2 space-y-2">
        {rows.map(r => {
          const when = new Date(r.pickup_at).toLocaleString(lang === "en" ? "en" : lang === "co" ? "es-CO" : lang, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
          const price = r.status === "booked" ? r.agreed_amount : r.offer_amount;
          return (
            <Link key={r.id} to={productHref("oneride", `/r/${r.id}`)} className="card ow-tap block !rounded-2xl !p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[14px] font-bold">{r.pickup.label} → {r.dropoff.label}</p>
                {r.status === "booked" && <span className="shrink-0 rounded-full bg-teal/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-teal-deep dark:text-teal">{W(lang, "Booked", "Reservado")}</span>}
              </div>
              <p className="mt-0.5 text-[12.5px] opacity-65">{when}{price != null ? ` · ${fmtMoney(price, r.currency, { cents: false })}` : ""}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
