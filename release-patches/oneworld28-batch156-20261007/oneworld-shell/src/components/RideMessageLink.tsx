import { Link } from "react-router-dom";
import { W, registerCopy } from "../lib/i18n";

/* Registered here, not in OneRide: a driver can read this bubble from any app's inbox. */
registerCopy({ de: { "Open ride": "Fahrt öffnen" }, ru: { "Open ride": "Открыть поездку" }, zh: { "Open ride": "打开行程" }, pt: { "Open ride": "Abrir viagem" } });

/**
 * The ride card's button inside a Messages bubble (OneRide, 9 Oct 2026).
 * Same shape as `ReservationMessageLink`: the server writes `metadata.ride_request_id` on every ride
 * message, and this turns it into one labelled button to the ride's page. Who may open the page is
 * the database's decision (RLS), not this button's.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default function RideMessageLink({ metadata, lang }: { metadata?: Record<string, unknown>; lang: string }) {
  const id = metadata?.ride_request_id;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  return (
    <Link to={`/rides/r/${id}`} className="ow-tap mt-2 inline-flex items-center gap-2 rounded-xl border border-brand/40 px-3 py-2 text-sm font-bold">
      {W(lang, "Open ride", "Abrir viaje")}
    </Link>
  );
}
