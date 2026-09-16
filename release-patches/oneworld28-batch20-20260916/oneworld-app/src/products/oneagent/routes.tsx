import { lazy, Suspense } from "react";
import { Route, Outlet, Navigate } from "react-router-dom";
import { MessagesScreen, ThreadScreen, ProfileScreen, PublicWorld, SettingsScreen, lazyScreen} from "@oneworld/shell";
const Home = lazyScreen(() => import("./screens/Home"));
const Deals = lazyScreen(() => import("./screens/Deals"));
const Partner = lazyScreen(() => import("./screens/Partner"));
const Roster = lazyScreen(() => import("./screens/Roster"));
const RosterMember = lazyScreen(() => import("./screens/RosterMember"));
const CalendarScreen = lazyScreen(() => import("./screens/CalendarScreen"));
const Alerts = lazyScreen(() => import("./screens/Alerts"));
import ProfileTiles, { ProfileStats, ProfileCalendarSlot } from "./screens/ProfileSlots";

/**
 * ONEAGENT — every route under `/agent`, mounted by App.tsx inside <AppShell config=ONEAGENT>.
 * ============================================================================================
 * Footer (LOCKED 8 Aug): Home · Deals · Ask (centre) · Messages · Profile. The product is a
 * HUMAN middleman (Lee's 8 Aug ruling): a real agent representing talent and companies. The
 * roster and the pipeline are the product; Ask is the one action it exists for.
 *
 * NO transaction code lives here yet — the consent model is counsel-gated and payments run
 * through OneJob's money layer when they arrive. Screens read/write only agent-owned tables
 * (draft SQL beside this file; NOT migrated — deploys and migrations are Lee-only).
 */
export function AgentProviders() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm opacity-50">…</div>}>
      <Outlet />
    </Suspense>
  );
}

export const oneAgentChildRoutes = (
  <Route element={<AgentProviders />}>
    <Route index element={<Home />} />
    <Route path="deals" element={<Deals />} />
    {/* PARTNER is the centre word (Lee, 9 Aug 2026) — the grow-your-book doorway. The old
        /agent/ask address stays alive as a redirect so printed QRs and shared links resolve. */}
    <Route path="partner" element={<Partner />} />
    <Route path="ask" element={<Navigate to="/agent/partner" replace />} />
    <Route path="roster" element={<Roster />} />
    <Route path="roster/:memberId" element={<RosterMember />} />
    <Route path="calendar" element={<CalendarScreen />} />
    <Route path="messages" element={<MessagesScreen product="oneagent" />} />
    {/* THE THREAD. `MessagesScreen` has always linked here; until 11 Aug 2026 nothing was
        mounted at it, so every conversation in every app opened Not found. */}
    <Route path="messages/:id" element={<ThreadScreen product="oneagent" />} />
    <Route path="settings" element={<SettingsScreen product="oneagent" />} />
    <Route path="alerts" element={<Alerts />} />
    <Route path="profile" element={
      <ProfileScreen product="oneagent"
        tilesSlot={<ProfileTiles />} statsSlot={<ProfileStats />} calendarSlot={<ProfileCalendarSlot />} />
    } />
    <Route path="p/:userId" element={<PublicWorld product="oneagent" />} />
  </Route>
);
