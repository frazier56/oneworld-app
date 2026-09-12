import { lazy, Suspense } from "react";
import { Route, Outlet } from "react-router-dom";
import { CONFIGS, MessagesScreen, ThreadScreen, ProfileScreen, PublicWorld, SettingsScreen, lazyScreen} from "@oneworld/shell";
import { AuthProvider } from "./hooks/useAuth";
import "./oneevent.css";
const Home = lazyScreen(() => import("./screens/Home"));
const Hosts = lazyScreen(() => import("./screens/Hosts"));
const MyEvents = lazyScreen(() => import("./screens/MyEvents"));
const EventDetailScreen = lazyScreen(() => import("./screens/EventDetailScreen"));
const EventApplyScreen = lazyScreen(() => import("./screens/EventApplyScreen"));
const EventCheckoutScreen = lazyScreen(() => import("./screens/EventCheckoutScreen"));
const EventReceiptScreen = lazyScreen(() => import("./screens/EventReceiptScreen"));
const EventManageScreen = lazyScreen(() => import("./screens/EventManageScreen"));
const ManagerInviteClaim = lazyScreen(() => import("./pages/ManagerInviteClaim"));
const EventTicketScreen = lazyScreen(() => import("./screens/EventTicketScreen"));
const TicketsScreen = lazyScreen(() => import("./screens/TicketsScreen"));
const CalendarScreen = lazyScreen(() => import("./screens/CalendarScreen"));
const PricingScreen = lazyScreen(() => import("./screens/PricingScreen"));
import ProfileTiles, { ProfileStats, ProfileCalendarSlot } from "./screens/ProfileSlots";
import { PublicEventProfileSignals, PublicHostedEvents } from "./components/PublicEventProfileAddons";
const Alerts = lazyScreen(() => import("./screens/Alerts"));
const EventSlugRedirect = lazyScreen(() => import("./pages/EventSlugRedirect"));
/* Guest ticket (tokenized, PUBLIC — the 48-hex token in the URL is the key) and VAIA's
   popup mount. GuestTicket is a page, not a screen: it renders inside the shell chrome
   like any route but needs no auth. */
const GuestTicket = lazyScreen(() => import("./pages/GuestTicket"));
const ExpressGate = lazyScreen(() => import("./pages/ExpressGate"));
const VaiaChatMount = lazy(() => import("./components/app/VaiaChatMount"));

/**
 * ONEEVENT — every route under `/events`, mounted by App.tsx inside <AppShell config=ONEEVENT>.
 * ============================================================================================
 * Footer (LOCKED 8 Aug): Home · Hosts · My Events (centre) · Messages · Profile. Shell screens
 * are IMPORTED (Messages, Settings, Profile, PublicWorld) — the app supplies only its slots and
 * its event screens, ported from the 2026-07-23 canonical source.
 *
 * `EventProviders` is a layout route: the ported screens' `useAuth()` compat context wraps the
 * whole subtree once, above every screen.
 */
/* CODE-SPLIT (8 Aug 2026): every screen below is a lazy chunk, so a person opening OneScore
   never downloads OneEvent's ticketing code. One Suspense at the layout keeps the chrome
   painted while a screen chunk loads. */
export function EventProviders() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="py-16 text-center text-sm opacity-50">…</div>}>
        <Outlet />
      </Suspense>
      {/* VAIA — the "Tap for insights" pill dispatches `ow-vaia-open`; until 17 Aug 2026
          NOTHING listened, so tapping her did nothing. Mounted once above every screen. */}
      <Suspense fallback={null}>
        <VaiaChatMount />
      </Suspense>
    </AuthProvider>
  );
}

export const oneEventChildRoutes = (
  <Route element={<EventProviders />}>
    <Route index element={<Home />} />
    <Route path="hosts" element={<Hosts />} />
    {/* centre tab — config points at /events/events */}
    <Route path="events" element={<MyEvents />} />
    <Route path="events/:id/manage" element={<EventManageScreen />} />
    {/* v22 CB — event-manager invite link (public path; claim bounces through join-express). */}
    <Route path="manage-invite/:token" element={<ManagerInviteClaim />} />
    {/* attendee flow. PUBLIC in spirit — a shared event link must open without a wall. */}
    <Route path="e/:id" element={<EventDetailScreen />} />
    <Route path="e/:id/apply" element={<EventApplyScreen />} />
    <Route path="e/:id/checkout" element={<EventCheckoutScreen />} />
    <Route path="e/:id/receipt/:orderId" element={<EventReceiptScreen />} />
    <Route path="ticket/:regId" element={<EventTicketScreen />} />
    {/* guest ticket — public, the token is the credential (App.tsx publicPaths lets it through) */}
    <Route path="gt/:token" element={<GuestTicket />} />
    {/* express gate — public; the 20-second account for any gated action, then back to ?next= */}
    <Route path="join-express" element={<ExpressGate />} />
    <Route path="tickets" element={<TicketsScreen />} />
    <Route path="calendar" element={<CalendarScreen />} />
    <Route path="pricing" element={<PricingScreen />} />
    <Route path="messages" element={<MessagesScreen product="oneevent" />} />
    {/* THE THREAD. `MessagesScreen` has always linked here; until 11 Aug 2026 nothing was
        mounted at it, so every conversation in every app opened Not found. */}
    <Route path="messages/:id" element={<ThreadScreen product="oneevent" />} />
    <Route path="settings" element={<SettingsScreen product="oneevent" />} />
    <Route path="alerts" element={<Alerts />} />
    <Route path="profile" element={
      <ProfileScreen product="oneevent"
        tilesSlot={<ProfileTiles />} statsSlot={<ProfileStats />} calendarSlot={<ProfileCalendarSlot />} />
    } />
    <Route path="p/:userId" element={
      <PublicWorld product="oneevent" primarySlot={<PublicHostedEvents />} belowSlot={<PublicEventProfileSignals />} />
    } />
    {/* Vanity slug (oneworldlabs.ai…/events/summer-gala) — a DYNAMIC segment, so React Router
        ranks every static route above it and only unmatched single segments land here. The
        redirect resolves slug → /events/e/:id. Printed short-QR codes go through /e/:id and
        decode base64url inline (EventDetail). */}
    <Route path=":slug" element={<EventSlugRedirect />} />
  </Route>
);

export const ONEEVENT_CONFIG = CONFIGS.oneevent;
