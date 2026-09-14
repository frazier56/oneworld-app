import { lazy, Suspense } from "react";
import { Route, Outlet } from "react-router-dom";
import {
  CONFIGS, MessagesScreen, ProfileScreen, PublicWorld, SettingsScreen, PlansScreen, lazyScreen} from "@oneworld/shell";
import { RentalTiles, RentalStats, RentalCalendar } from "./screens/ProfileSlots";
import PublicListings from "./screens/PublicListings";
import { RENTAL_TIERS } from "./lib/plans";

const Feed = lazyScreen(() => import("./screens/Feed"));
const Agents = lazyScreen(() => import("./screens/Agents"));
const ListHub = lazyScreen(() => import("./screens/ListHub"));
const Saved = lazyScreen(() => import("./screens/Saved"));
const RenterProfile = lazyScreen(() => import("./screens/RenterProfile"));
const HostProfile = lazyScreen(() => import("./screens/HostProfile"));
const ApplicationView = lazyScreen(() => import("./screens/ApplicationView"));
const PaymentSetup = lazyScreen(() => import("./screens/PaymentSetup"));
const PropertyDetail = lazyScreen(() => import("./screens/PropertyDetail"));
const MyProperties = lazyScreen(() => import("./screens/MyProperties"));
const ContractScreen = lazyScreen(() => import("./screens/ContractScreen"));
const ContractView = lazyScreen(() => import("./screens/ContractView"));
const Walkthrough = lazyScreen(() => import("./screens/Walkthrough"));
const CalendarScreen = lazyScreen(() => import("./screens/CalendarScreen"));
const Alerts = lazyScreen(() => import("./screens/Alerts"));
const Requests = lazyScreen(() => import("./screens/Requests"));
const RentalThread = lazyScreen(() => import("./screens/RentalThread"));

/**
 * ONERENTAL — every route under `/rentals`, mounted by App.tsx inside <AppShell config=ONERENTAL>.
 * ============================================================================================
 * Footer (Lee, 10 Aug 2026): Home · Agents · **List a place** (raised centre) · Messages · Profile.
 *
 *   /rentals                    HomeTop (shell head) + the listing feed
 *   /rentals/agents             search the people who list — counts + OneScore
 *   /rentals/list               ★ create a listing (the raised centre)
 *   /rentals/r/:id              one property, comments, and "ask about this place"
 *   /rentals/r/:id/contract     draft a contract from the Colombian template or an upload
 *   /rentals/c/:id              the contract — accept it, or read the signed copy
 *   /rentals/c/:id/walkthrough  the photo evidence both sides sign off on
 *   /rentals/properties         my listings, in every state (drawer)
 *   /rentals/calendar           what is booked (drawer)
 *   /rentals/plans              the shared paid-tier screen (shell)
 *   /rentals/messages           shell · /rentals/settings shell · /rentals/profile shell + slots
 *   /rentals/p/:userId          PublicWorld (shell) — public, no sign-in wall
 *
 * CODE-SPLIT: every screen is a lazy chunk, so somebody opening OneScore never downloads
 * OneRental's contract and evidence code. No provider wrapper is needed — nothing here was
 * ported from an app with its own auth context, so `useOneId()` is the only identity in play.
 */
export function RentalProviders() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm opacity-50">…</div>}>
      <Outlet />
    </Suspense>
  );
}

export const oneRentalChildRoutes = (
  <Route element={<RentalProviders />}>
    <Route index element={<Feed />} />
    <Route path="agents" element={<Agents />} />
    {/* THE CENTRE TAB IS A DASHBOARD, NOT A FORM. `?form=1` deep-links straight into the form,
        which is how every other "List a place" button in the app still works. The pattern is
        OneJob's QRPay — see the header of ListHub.tsx. */}
    <Route path="list" element={<ListHub />} />
    <Route path="saved" element={<Saved />} />
    {/* The renter's side — fill it in once, then show a QR. Modelled on OneJob's QRPay. */}
    <Route path="renter" element={<RenterProfile />} />
    {/* Private owner/manager setup. Reused for every listing and contract; never public profile data. */}
    <Route path="host-profile" element={<HostProfile />} />
    {/* PUBLIC. An agent scanning a renter's code at a viewing must not hit a sign-in wall —
        the token IS the authorisation, and the renter can revoke it by rolling it. */}
    <Route path="apply/:token" element={<ApplicationView />} />
    <Route path="r/:id" element={<PropertyDetail />} />
    <Route path="r/:id/contract" element={<ContractScreen />} />
    {/* Lee: "we do need to have a portal in here where people can set up payments." Writes a
        SCHEDULE — what will be charged and when — and moves no money. */}
    <Route path="r/:id/payments" element={<PaymentSetup />} />
    <Route path="c/:id" element={<ContractView />} />
    <Route path="c/:contractId/walkthrough" element={<Walkthrough />} />
    <Route path="properties" element={<MyProperties />} />
    <Route path="calendar" element={<CalendarScreen />} />
    {/* Lee set the prices (Free · $9.99 · $19.99); the ladder sells ATTENTION, never trust —
        see lib/plans.ts. Checkout is honestly "opening soon" until the money leg ships. */}
    <Route path="plans" element={<PlansScreen product="onerental" tiers={RENTAL_TIERS} />} />
    <Route path="alerts" element={<Alerts />} />
    <Route path="requests" element={<Requests />} />

    {/* ── SHELL SCREENS. Imported, never rebuilt. ───────────────────────────────────────── */}
    <Route path="messages" element={<MessagesScreen product="onerental" />} />
    {/* THE THREAD. `MessagesScreen` has always linked here; until 11 Aug 2026 nothing was
        mounted at it, so every conversation in every app opened Not found. */}
    <Route path="messages/:id" element={<RentalThread />} />
    <Route path="settings" element={<SettingsScreen product="onerental" />} />
    <Route path="profile" element={
      <ProfileScreen
        product="onerental"
        tilesSlot={<RentalTiles />}
        mediaOwnedByTiles
        statsSlot={<RentalStats />}
        calendarSlot={<RentalCalendar />}
      />
    } />
    {/* PUBLIC — a shared listing or profile link must open without a sign-in wall. */}
    {/* Lee: *"if I click on my name, it just shows my profile. It should show my listings on my
        page."* The shell has always taken a `belowSlot` for this; OneHome passed nothing. */}
    <Route path="p/:userId" element={<PublicWorld product="onerental" primarySlot={<PublicListings publicView />}  mediaOwnedByPrimary />} />
  </Route>
);

export const ONERENTAL_CONFIG = CONFIGS.onerental;
