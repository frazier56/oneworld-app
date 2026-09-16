import { lazy, Suspense, type ReactNode } from "react";
import { Route, Outlet } from "react-router-dom";
import {
  CONFIGS, MessagesScreen, ThreadScreen, ProfileScreen, PublicWorld, SettingsScreen, lazyScreen} from "@oneworld/shell";
import { AuthProvider } from "@job/hooks/useAuth";
import { QueryProvider } from "@job/lib/query";
import { JobTiles, JobStats, JobCalendar } from "@job/screens/ProfileSlots";

const Home = lazyScreen(() => import("@job/screens/Home"));
const MyJobs = lazyScreen(() => import("@job/screens/MyJobs"));
const StartJob = lazyScreen(() => import("@job/screens/QRPay"));
const FindWork = lazyScreen(() => import("@job/screens/Jobs"));
const JobDetail = lazyScreen(() => import("@job/screens/JobDetail"));
const CalendarScreen = lazyScreen(() => import("@job/screens/CalendarPage"));
const Reviews = lazyScreen(() => import("@job/screens/Reviews"));
const Plans = lazyScreen(() => import("@job/screens/Plans"));
const Wallet = lazyScreen(() => import("@job/screens/Wallet"));
const Alerts = lazyScreen(() => import("@job/screens/Alerts"));

/**
 * ONEJOB — every route under `/jobs`, mounted by App.tsx inside <AppShell config={CONFIGS.onejob}>.
 * ============================================================================================
 * Task 2.1's whole point: OneJob is a ROUTE inside the one app, not a deployment. The SHELL
 * screens are IMPORTED, never rebuilt — Profile, Public world, Messages, Settings and the World
 * hub all come from `@oneworld/shell`, and this file supplies only OneJob's own screens and the
 * three profile slots.
 *
 * Footer (ONEJOB config, unchanged): Home · My jobs · **Start a job** (raised centre, the money
 * button) · Messages · Profile. Drawer extras: Calendar · Plans · Settings.
 *
 * ── What is SHELL here, so nobody forks it later ────────────────────────────────────────────
 *   `/jobs`            → HomeTop (shell head) + OneJob's feed as `feedSlot`
 *   `/jobs/profile`    → ProfileScreen (shell) + tiles/stats/calendar slots
 *   `/jobs/p/:userId`  → PublicWorld (shell)
 *   `/jobs/messages`   → MessagesScreen (shell)
 *   `/jobs/settings`   → SettingsScreen (shell)
 *   `/jobs/world/:id`  → OneWorldHub (shell), mounted BARE by App.tsx — no product chrome
 *
 * ── Why two providers wrap the subtree ──────────────────────────────────────────────────────
 * `AuthProvider` is the One ID compat adapter: the ported screens keep calling `useAuth()` and
 * get the SHARED session, not a second one. `QueryProvider` is the ported screens' data cache —
 * app-level only; the shell deliberately depends on no query library. Both are mounted here, once,
 * above every OneJob screen, so no screen has to know they exist.
 *
 * CODE-SPLIT: every screen is a lazy chunk, so somebody opening OneScore never downloads OneJob's
 * contract and money code.
 */
export function JobProviders({ children }: { children?: ReactNode } = {}) {
  return (
    <QueryProvider>
      <AuthProvider>
        <Suspense fallback={<div className="py-16 text-center text-sm opacity-50">…</div>}>
          {children ?? <Outlet />}
        </Suspense>
      </AuthProvider>
    </QueryProvider>
  );
}

export const oneJobChildRoutes = (
  <Route element={<JobProviders />}>
    {/* HOME — the shared head, OneJob's feed. */}
    <Route index element={<Home />} />

    {/* TAB 2 — My jobs. The config's second tab is `/jobs/jobs`; that repetition is the
        single-origin shape (`/<product>/<screen>`), not a typo. */}
    <Route path="jobs" element={<MyJobs />} />

    {/* THE RAISED CENTRE — "Start a job": readiness, contract, and the Quick-Hire QR.
        This is the money button and the only reason the centre slot is raised at all. */}
    <Route path="qr" element={<StartJob />} />

    {/* Find work / Hire pros, and one job's detail page. */}
    <Route path="find" element={<FindWork />} />
    <Route path="j/:id" element={<JobDetail />} />

    {/* Drawer extras (ONEJOB.drawerExtras) — a drawer row that 404s is a broken control. */}
    <Route path="calendar" element={<CalendarScreen />} />
    <Route path="plans" element={<Plans />} />
    <Route path="reviews" element={<Reviews />} />
    <Route path="wallet" element={<Wallet />} />

    {/* The bell (ONEJOB.notificationsPath). */}
    <Route path="alerts" element={<Alerts />} />

    {/* ── SHELL SCREENS. Imported, never rebuilt. ────────────────────────────────────────── */}
    <Route path="messages" element={<MessagesScreen product="onejob" />} />
    {/* THE THREAD. `MessagesScreen` has always linked here; until 11 Aug 2026 nothing was
        mounted at it, so every conversation in every app opened Not found. */}
    <Route path="messages/:id" element={<ThreadScreen product="onejob" />} />
    <Route path="settings" element={<SettingsScreen product="onejob" />} />
    <Route path="profile" element={
      <ProfileScreen
        product="onejob"
        tilesSlot={<JobTiles />}
        statsSlot={<JobStats />}
        calendarSlot={<JobCalendar />}
      />
    } />
    {/* PUBLIC — a shared profile link must open without a sign-in wall. */}
    <Route path="p/:userId" element={<PublicWorld product="onejob" />} />
  </Route>
);

export const ONEJOB_CONFIG = CONFIGS.onejob;
