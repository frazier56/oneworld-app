import { supabase } from "@oneworld/shell";

/** A driver's car. The plate is private: only its owner ever reads this row (RLS). */
export type Vehicle = { id: string; year: number; make: string; model: string; colour: string; plate: string; verified_at: string | null };
/** What anyone, a guest included, may see of a driver. No plate — the function does not return it. */
export type PublicDriver = { driver_id: string; full_name: string | null; photo_url: string | null; score: number | null; year: number; make: string; model: string; colour: string; verified: boolean };
export type VehicleInput = { year: number; make: string; model: string; colour: string; plate: string };

const COLS = "id, year, make, model, colour, plate, verified_at";

export async function getMyVehicle(userId: string): Promise<Vehicle | null> {
  const { data, error } = await supabase.from("ride_vehicles").select(COLS).eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  return (data as Vehicle | null) ?? null;
}

/** The server normalises the plate (upper case, no spaces); compare the way it stores it. */
export const normalisePlate = (p: string) => p.replace(/\s/g, "").toUpperCase();

/**
 * Save the one car a driver has. A RETURNED error with no SQLSTATE is "outcome unknown", not
 * "refused" (the architecture rule): the row is read back, and if it already says what was sent,
 * the save happened.
 */
export async function saveMyVehicle(userId: string, v: VehicleInput): Promise<Vehicle> {
  const row = { owner_id: userId, year: v.year, make: v.make.trim(), model: v.model.trim(), colour: v.colour.trim(), plate: normalisePlate(v.plate) };
  const { data, error } = await supabase.from("ride_vehicles").upsert(row, { onConflict: "owner_id" }).select(COLS).single();
  if (!error && data) return data as Vehicle;
  if (error && /^([0-9A-Z]{5}|PGRST\d{3})$/.test(error.code ?? "")) throw error;
  const now = await getMyVehicle(userId);
  if (now && now.year === row.year && now.make === row.make && now.model === row.model && now.colour === row.colour && now.plate === row.plate) return now;
  throw error ?? new Error("save failed");
}

export async function removeMyVehicle(userId: string): Promise<void> {
  const { error } = await supabase.from("ride_vehicles").delete().eq("owner_id", userId);
  if (error && /^([0-9A-Z]{5}|PGRST\d{3})$/.test(error.code ?? "")) throw error;
  if (error && (await getMyVehicle(userId))) throw error;   // unknown outcome: the row decides
}

export async function listDrivers(): Promise<PublicDriver[]> {
  const { data, error } = await supabase.rpc("ride_public_drivers", { p_limit: 50 });
  if (error) throw error;
  return (data ?? []) as PublicDriver[];
}

/* ── Ride requests (overlay 2) ─────────────────────────────────────────────────────────────────
   Every write is an RPC. The database locks the request row, so "the first driver to accept wins"
   holds even when two drivers tap in the same second. */
export type Place = { label: string };
export type PriceMode = "offer" | "quotes";
export type RideStatus = "open" | "booked" | "cancelled";
export type DriverState = "sent" | "quoted" | "declined" | "won" | "lost" | "withdrawn";
export type RideRequest = {
  id: string; rider_id: string; pickup: Place; stops: Place[]; dropoff: Place; pickup_at: string; note: string | null;
  price_mode: PriceMode; offer_amount: number | null; currency: string; status: RideStatus;
  booked_driver_id: string | null; agreed_amount: number | null; booked_at: string | null; created_at: string;
};
export type RideDriverRow = { driver_id: string; state: DriverState; quote_amount: number | null; responded_at: string | null };
export type Person = { id: string; full_name: string | null; photo_url: string | null };
export type BookedCar = { year: number; make: string; model: string; colour: string; plate: string };

const REQ = "id, rider_id, pickup, stops, dropoff, pickup_at, note, price_mode, offer_amount, currency, status, booked_driver_id, agreed_amount, booked_at, created_at";
const num = (v: unknown) => (v == null ? null : Number(v));
const asReq = (r: Record<string, unknown>): RideRequest => ({ ...(r as unknown as RideRequest), offer_amount: num(r.offer_amount), agreed_amount: num(r.agreed_amount) });

/** A server refusal carries a SQLSTATE; anything else is "outcome unknown" (the architecture rule). */
export const isRefusal = (e: unknown) => /^([0-9A-Z]{5}|PGRST\d{3})$/.test(String((e as { code?: string } | null)?.code ?? ""));

export async function createRide(input: {
  pickup: Place; stops: Place[]; dropoff: Place; pickupAt: Date; note: string;
  mode: PriceMode; offer: number | null; currency: string; driverIds: string[]; text: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("ride_request_create", {
    p_pickup: input.pickup, p_stops: input.stops, p_dropoff: input.dropoff, p_pickup_at: input.pickupAt.toISOString(),
    p_note: input.note, p_price_mode: input.mode, p_offer: input.mode === "offer" ? input.offer : null,
    p_currency: input.currency, p_driver_ids: input.driverIds, p_text: input.text,
  });
  if (error) throw error;
  return data as string;
}

export async function getRide(id: string): Promise<{ ride: RideRequest; drivers: RideDriverRow[]; people: Map<string, Person> } | null> {
  const { data, error } = await supabase.from("ride_requests").select(REQ).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ride = asReq(data as Record<string, unknown>);
  const { data: rows, error: e2 } = await supabase.from("ride_request_drivers")
    .select("driver_id, state, quote_amount, responded_at").eq("request_id", id);
  if (e2) throw e2;
  const drivers = (rows ?? []).map(r => ({ ...(r as RideDriverRow), quote_amount: num((r as { quote_amount: unknown }).quote_amount) }));
  const ids = [...new Set([ride.rider_id, ...drivers.map(d => d.driver_id)])];
  const { data: ps } = await supabase.from("profiles").select("id, full_name, photo_url").in("id", ids);
  return { ride, drivers, people: new Map((ps ?? []).map(p => [(p as Person).id, p as Person])) };
}

/** Rides I asked for, and rides sent to me, newest first. */
export async function myRides(userId: string): Promise<{ asked: RideRequest[]; forMe: (RideRequest & { myState: DriverState })[] }> {
  const [{ data: a, error: e1 }, { data: mine, error: e2 }] = await Promise.all([
    supabase.from("ride_requests").select(REQ).eq("rider_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("ride_request_drivers").select("request_id, state").eq("driver_id", userId).limit(50),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  const states = new Map((mine ?? []).map(r => [(r as { request_id: string }).request_id, (r as { state: DriverState }).state]));
  let forMe: (RideRequest & { myState: DriverState })[] = [];
  if (states.size) {
    const { data: f, error: e3 } = await supabase.from("ride_requests").select(REQ).in("id", [...states.keys()])
      .order("created_at", { ascending: false });
    if (e3) throw e3;
    forMe = (f ?? []).map(r => ({ ...asReq(r as Record<string, unknown>), myState: states.get((r as { id: string }).id)! }));
  }
  return { asked: (a ?? []).map(r => asReq(r as Record<string, unknown>)), forMe };
}

export async function driverRespond(id: string, action: "accept" | "quote" | "decline", amount: number | null, text: string) {
  const { data, error } = await supabase.rpc("ride_driver_respond", { p_request: id, p_action: action, p_amount: amount, p_text: text });
  if (error) throw error;
  return data as string;
}
export async function riderAccept(id: string, driverId: string, text: string) {
  const { error } = await supabase.rpc("ride_rider_accept", { p_request: id, p_driver: driverId, p_text: text });
  if (error) throw error;
}
export async function riderRaise(id: string, amount: number, text: string) {
  const { error } = await supabase.rpc("ride_rider_raise", { p_request: id, p_amount: amount, p_text: text });
  if (error) throw error;
}
export async function cancelRide(id: string, text: string) {
  const { error } = await supabase.rpc("ride_request_cancel", { p_request: id, p_text: text });
  if (error) throw error;
}
export async function bookedCar(id: string): Promise<BookedCar | null> {
  const { data, error } = await supabase.rpc("ride_booked_car", { p_request: id });
  if (error) throw error;
  return ((data ?? []) as BookedCar[])[0] ?? null;
}
