import { Suspense } from "react";
import { Route, Outlet } from "react-router-dom";
import { MessagesScreen, ThreadScreen, ProfileScreen, PublicWorld, SettingsScreen, lazyScreen } from "@oneworld/shell";
import ProfileTiles, { ProfileStats } from "./screens/ProfileSlots";
const Overview = lazyScreen(() => import("./screens/Overview"));
const Activity = lazyScreen(() => import("./screens/Activity"));
const Charge = lazyScreen(() => import("./screens/Charge"));
const Closeout = lazyScreen(() => import("./screens/Closeout"));
const Catalog = lazyScreen(() => import("./screens/Catalog"));
const Staff = lazyScreen(() => import("./screens/Staff"));
const Devices = lazyScreen(() => import("./screens/Devices"));
const Setup = lazyScreen(() => import("./screens/Setup"));
const OrderDetail = lazyScreen(() => import("./screens/OrderDetail"));
const ReceiptScreen = lazyScreen(() => import("./screens/ReceiptScreen"));
const Alerts = lazyScreen(() => import("./screens/Alerts"));

/**
 * ONEPAY — every route under `/pay`, mounted by App.tsx inside <AppShell config={CONFIGS.onepay}>.
 * Footer: Overview · Activity · CHARGE (centre) · Messages · Profile. Drawer: Closeout, Catalog,
 * Staff, Devices, Settings. Money is server-authoritative; see lib/data.ts.
 */
function Providers() {
  return <Suspense fallback={<div className="py-16 text-center text-sm opacity-50">…</div>}><Outlet /></Suspense>;
}
export const onePayChildRoutes = (
  <Route element={<Providers />}>
    <Route index element={<Overview />} />
    <Route path="setup" element={<Setup />} />
    <Route path="activity" element={<Activity />} />
    <Route path="charge" element={<Charge />} />
    <Route path="closeout" element={<Closeout />} />
    <Route path="catalog" element={<Catalog />} />
    <Route path="staff" element={<Staff />} />
    <Route path="devices" element={<Devices />} />
    <Route path="order/:id" element={<OrderDetail />} />
    <Route path="receipt/:id" element={<ReceiptScreen />} />
    <Route path="messages" element={<MessagesScreen product="onepay" />} />
    <Route path="messages/:id" element={<ThreadScreen product="onepay" />} />
    <Route path="settings" element={<SettingsScreen product="onepay" />} />
    <Route path="alerts" element={<Alerts />} />
    <Route path="profile" element={<ProfileScreen product="onepay" tilesSlot={<ProfileTiles />} statsSlot={<ProfileStats />} />} />
    <Route path="p/:userId" element={<PublicWorld product="onepay" />} />
  </Route>
);
