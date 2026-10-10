/* ── RIDING OR DRIVING ─────────────────────────────────────────────────────────────────────
   Lee, 9 Oct 2026: "Uber has two apps, one for drivers and one for passengers … we can handle both.
   If you choose to accept rides, the middle icon changes for you forever, unless you switch over to
   riding." One app, two sides. The side you're on picks the raised tab's icon: steering wheel when
   driving, the SUV (Lee's pick S3, 10 Oct) when riding. Saving a car switches you to driving; the Home toggle switches back.
   Kept on this device for now (a profile-level setting can follow once the database is open). */
import { useEffect, useState } from "react";
import { setNavIconOverride } from "@oneworld/shell";

export type RideMode = "rider" | "driver";
const KEY = "oneride-mode";
const subs = new Set<(m: RideMode) => void>();

export function readMode(): RideMode {
  try { return localStorage.getItem(KEY) === "driver" ? "driver" : "rider"; } catch { return "rider"; }
}
function apply(m: RideMode) { setNavIconOverride("car", m === "driver" ? "steering" : "suv"); }
export function setMode(m: RideMode) {
  try { localStorage.setItem(KEY, m); } catch { /* private mode: still switch for this visit */ }
  apply(m); subs.forEach(fn => fn(m));
}
export function useRideMode(): [RideMode, (m: RideMode) => void] {
  const [m, setM] = useState<RideMode>(readMode);
  useEffect(() => { apply(m); const fn = (x: RideMode) => setM(x); subs.add(fn); return () => { subs.delete(fn); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [m, setMode];
}
/** Leaving OneRide puts the shared icon back (another product may use "car"). */
export function clearModeIcon() { setNavIconOverride("car", null); }
