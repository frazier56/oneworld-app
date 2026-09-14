import { Suspense } from "react";
import { Route, Outlet } from "react-router-dom";
import { MessagesScreen, ThreadScreen, ProfileScreen, PublicWorld, SettingsScreen, lazyScreen } from "@oneworld/shell";
import ProfileTiles, { ProfileStats } from "./screens/ProfileSlots";
const Overview = lazyScreen(() => import("./screens/Overview"));
const Services = lazyScreen(() => import("./screens/Services"));
const Leads = lazyScreen(() => import("./screens/Leads"));
const LeadDetail = lazyScreen(() => import("./screens/LeadDetail"));
const Voice = lazyScreen(() => import("./screens/Voice"));
const Pipeline = lazyScreen(() => import("./screens/Pipeline"));
const Results = lazyScreen(() => import("./screens/Results"));
const Businesses = lazyScreen(() => import("./screens/Businesses"));
const Setup = lazyScreen(() => import("./screens/Setup"));
const Alerts = lazyScreen(() => import("./screens/Alerts"));

/**
 * ONE BUSINESS — every route under `/business`, mounted by App.tsx inside <AppShell config={CONFIGS.onebusiness}>.
 * Footer: Overview · Leads · SERVICES (centre) · Messages · Profile. Drawer: OneVoice, Results,
 * Sales pipeline (entitlement-gated on the server AND here), Businesses, Settings.
 */
function Providers() { return <Suspense fallback={<div className="py-16 text-center text-sm opacity-50">…</div>}><Outlet /></Suspense>; }
export const oneBusinessChildRoutes = (
  <Route element={<Providers />}>
    <Route index element={<Overview />} />
    <Route path="setup" element={<Setup />} />
    <Route path="services" element={<Services />} />
    <Route path="services/:serviceKey" element={<Services />} />
    <Route path="leads" element={<Leads />} />
    <Route path="leads/:id" element={<LeadDetail />} />
    <Route path="voice" element={<Voice />} />
    <Route path="pipeline" element={<Pipeline />} />
    <Route path="results" element={<Results />} />
    <Route path="businesses" element={<Businesses />} />
    <Route path="messages" element={<MessagesScreen product="onebusiness" />} />
    <Route path="messages/:id" element={<ThreadScreen product="onebusiness" />} />
    <Route path="settings" element={<SettingsScreen product="onebusiness" />} />
    <Route path="alerts" element={<Alerts />} />
    <Route path="profile" element={<ProfileScreen product="onebusiness" tilesSlot={<ProfileTiles />} statsSlot={<ProfileStats />} />} />
    <Route path="p/:userId" element={<PublicWorld product="onebusiness" />} />
  </Route>
);
