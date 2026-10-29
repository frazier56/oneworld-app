import { Suspense, useEffect } from "react";
import { readMode, setMode, clearModeIcon } from "./lib/mode";
import { Route, Outlet } from "react-router-dom";
import { MessagesScreen, ThreadScreen, ProfileScreen, PublicWorld, SettingsScreen, lazyScreen, ScreenFallback } from "@oneworld/shell";
import "./lib/copy";
import ProfileTiles from "./screens/ProfileSlots";
const Home = lazyScreen(() => import("./screens/Home"));
const Drivers = lazyScreen(() => import("./screens/Drivers"));
const Request = lazyScreen(() => import("./screens/Request"));
const Vehicle = lazyScreen(() => import("./screens/Vehicle"));
const Alerts = lazyScreen(() => import("./screens/Alerts"));
const RideDetail = lazyScreen(() => import("./screens/RideDetail"));
const PayoutScreen = lazyScreen(() => import("../shared/PayoutScreen"));

/**
 * ONERIDE — every route under `/rides`, mounted by App.tsx inside <AppShell config={CONFIGS.oneride}>.
 * Footer: Home · Drivers · REQUEST (centre) · Messages · Profile. Drawer: My car, Settings.
 *
 * OPEN TO EVERYONE (Lee, 15 Oct 2026: move OneRide to production so everyone can see it). The
 * admin-only gate is gone and COMING_SOON.oneride is false. Paying inside the app is not available
 * yet (no local Colombian payments): riders pay the driver directly, and the in-app pay button
 * shows "Local payments for Colombia coming soon" (RideDetail · PaymentPanel).
 */
function Gate() {
  /* The raised tab shows the side you're on (steering wheel when driving), and gives "car" back on leaving. */
  useEffect(() => { setMode(readMode()); return clearModeIcon; }, []);
  return <Suspense fallback={<ScreenFallback />}><Outlet /></Suspense>;
}
export const oneRideChildRoutes = (
  <Route element={<Gate />}>
    <Route index element={<Home />} />
    <Route path="drivers" element={<Drivers />} />
    <Route path="request" element={<Request />} />
    <Route path="vehicle" element={<Vehicle />} />
    <Route path="r/:id" element={<RideDetail />} />
    <Route path="messages" element={<MessagesScreen product="oneride" />} />
    <Route path="messages/:id" element={<ThreadScreen product="oneride" />} />
    <Route path="settings" element={<SettingsScreen product="oneride" />} />
    {/* Payout — how you get paid, in every app (Lee, 28 Oct 2026). */}
    <Route path="payout" element={<PayoutScreen productLabel="OneRide" returnPath="/rides/payout" />} />
    <Route path="alerts" element={<Alerts />} />
    <Route path="profile" element={<ProfileScreen product="oneride" tilesSlot={<ProfileTiles />} />} />
    <Route path="p/:userId" element={<PublicWorld product="oneride" />} />
  </Route>
);
