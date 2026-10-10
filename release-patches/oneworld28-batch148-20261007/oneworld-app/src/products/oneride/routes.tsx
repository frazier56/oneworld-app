import { Suspense } from "react";
import { Route, Outlet } from "react-router-dom";
import { MessagesScreen, ThreadScreen, ProfileScreen, PublicWorld, SettingsScreen, ComingSoon, MARKETING_HOST, lazyScreen, ScreenFallback, useIsAdmin } from "@oneworld/shell";
import "./lib/copy";
import ProfileTiles from "./screens/ProfileSlots";
const Home = lazyScreen(() => import("./screens/Home"));
const Drivers = lazyScreen(() => import("./screens/Drivers"));
const Request = lazyScreen(() => import("./screens/Request"));
const Vehicle = lazyScreen(() => import("./screens/Vehicle"));
const Alerts = lazyScreen(() => import("./screens/Alerts"));
const RideDetail = lazyScreen(() => import("./screens/RideDetail"));

/**
 * ONERIDE — every route under `/rides`, mounted by App.tsx inside <AppShell config={CONFIGS.oneride}>.
 * Footer: Home · Drivers · REQUEST (centre) · Messages · Profile. Drawer: My car, Settings.
 *
 * COMING SOON TO THE PUBLIC (Lee, 5 Oct 2026: the public must not reach a coming-soon app inside
 * the app). Platform admins see the real screens so Lee can test; everyone else gets the shared
 * Coming soon screen pointing at the marketing page. `useIsAdmin` is answered by the database and
 * fails closed. Opening OneRide to everybody = delete the gate below and flip COMING_SOON.oneride.
 */
function Gate() {
  const admin = useIsAdmin();
  if (!admin) return <ComingSoon product="oneride" learnMoreUrl={MARKETING_HOST.oneride} />;
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
    <Route path="alerts" element={<Alerts />} />
    <Route path="profile" element={<ProfileScreen product="oneride" tilesSlot={<ProfileTiles />} />} />
    <Route path="p/:userId" element={<PublicWorld product="oneride" />} />
  </Route>
);
