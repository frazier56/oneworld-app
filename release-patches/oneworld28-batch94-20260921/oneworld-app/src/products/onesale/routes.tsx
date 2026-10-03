import { lazy, Suspense } from "react";
import { Route, Outlet } from "react-router-dom";
import "../shared/onehome.css";
import { CONFIGS, MessagesScreen, ThreadScreen, ProfileScreen, PublicWorld, SettingsScreen, PlansScreen, lazyScreen, ScreenFallback} from "@oneworld/shell";
import { SaleTiles, SaleStats } from "./screens/ProfileSlots";

const Feed = lazyScreen(() => import("./screens/Feed"));
const Agents = lazyScreen(() => import("./screens/Agents"));
const SaleHub = lazyScreen(() => import("./screens/SaleHub"));
const PropertyDetail = lazyScreen(() => import("./screens/PropertyDetail"));
const MyListings = lazyScreen(() => import("./screens/MyListings"));
const SaleRequests = lazyScreen(() => import("./screens/Requests"));
/* The saved screen already renders BOTH sale and rent saves — see its own note. It is mounted
   here so a seller never leaves their own shell to look at their own shortlist. */
const Saved = lazyScreen(() => import("../onerental/screens/Saved"));
/* Compare with VAIA (2 Oct 2026) — same two screens as the rent side, so a buyer stays in /sales. */
const IdealHome = lazyScreen(() => import("../onerental/screens/IdealHome"));
const Compare = lazyScreen(() => import("../onerental/screens/Compare"));
/* One screen, two roles — see its own note on why a buyer profile is deliberately almost
   nothing and a seller profile is the same thing plus their properties. */
const SaleProfile = lazyScreen(() => import("./screens/SaleProfile"));
const Alerts = lazyScreen(() => import("./screens/Alerts"));
/* Sale agreement (promesa de compraventa) — start it, then one screen every signer shares. */
const AgreementNew = lazyScreen(() => import("./screens/AgreementNew"));
const AgreementView = lazyScreen(() => import("./screens/AgreementView"));
/* The same two screens are mounted on the rent side — twins, one component each. */
const MyDocuments = lazyScreen(() => import("../shared/MyDocuments"));
const Dashboard = lazyScreen(() => import("../shared/Dashboard"));

/**
 * ONESALE — every route under `/sales`. The buying half of One Home.
 *
 * LIVE, not coming-soon. Listing, agent search, the property detail with its sale history,
 * enquiries into the shared Messages spine, my-properties, plans, profile and the public world
 * all work today. The single "coming soon" in the whole product is the button that would move
 * earnest money — because a Colombian sale closes through attorneys and the purchase price will
 * never pass through us at all.
 */
export function SaleProviders() {
  return (
    /* `data-onehome` is what scopes OneHome's own panel weight — see shared/onehome.css. It is
       on the route wrapper rather than on a layout component so BOTH halves of OneHome carry it
       and nothing outside OneHome does. */
    <div data-onehome className="contents">
      <Suspense fallback={<ScreenFallback />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

import PublicListings from "../onerental/screens/PublicListings";


export const oneSaleChildRoutes = (
  <Route element={<SaleProviders />}>
    <Route index element={<Feed />} />
    <Route path="agents" element={<Agents />} />
    {/* ⚠️ THE RAISED CENTRE TAB LANDS ON A HUB, NOT ON A 60-FIELD FORM. 15 Aug 2026.
        Lee: *"the fifth button that sticks up in the middle is supposed to take you to like a
        dashboard, but it's just taking to this list of property."*

        This route used to mount `ListProperty` directly, and the note that stood here said so:
        *"this product has no hub."* That is the same defect Lee corrected on the rent side on
        11 August — the tab most people press to LOOK for somewhere opened a publishing form —
        left standing on the twin for four days.

        `SaleHub` keeps the form as a MODE behind `?form=1`, and reads `?edit=<id>` itself, so
        every existing link into `/sales/list?edit=…` lands exactly where it used to. That is why
        the old `ListPropertyRoute` wrapper is gone rather than kept beside it: two doors into one
        form is how the two drift. */}
    <Route path="list" element={<SaleHub />} />
    <Route path="s/:id" element={<PropertyDetail />} />
    <Route path="s/:id/agreement" element={<AgreementNew />} />
    <Route path="a/:id" element={<AgreementView />} />
    <Route path="documents" element={<MyDocuments product="onesale" />} />
    <Route path="dashboard" element={<Dashboard product="onesale" />} />
    <Route path="properties" element={<MyListings />} />
    <Route path="plans" element={<PlansScreen product="onesale" />} />
    <Route path="requests" element={<SaleRequests />} />
    <Route path="saved" element={<Saved />} />
    <Route path="ideal-home" element={<IdealHome />} />
    <Route path="compare" element={<Compare />} />
    <Route path="seller" element={<SaleProfile role="seller" />} />
    <Route path="buyer" element={<SaleProfile role="buyer" />} />
    <Route path="alerts" element={<Alerts />} />
    <Route path="messages" element={<MessagesScreen product="onesale" />} />
    {/* THE THREAD. `MessagesScreen` has always linked here; until 11 Aug 2026 nothing was
        mounted at it, so every conversation in every app opened Not found. */}
    <Route path="messages/:id" element={<ThreadScreen product="onesale" />} />
    <Route path="settings" element={<SettingsScreen product="onesale" />} />
    <Route path="profile" element={
      <ProfileScreen product="onesale" tilesSlot={<SaleTiles />} mediaOwnedByTiles statsSlot={<SaleStats />} />
    } />
    {/* Same slot, same reason — and it is the SAME component, reading both tables, so a visitor
        sees one person's whole portfolio no matter which half of OneHome they arrived from. */}
    <Route path="p/:userId" element={<PublicWorld product="onesale" primarySlot={<PublicListings publicView />}  mediaOwnedByPrimary />} />
  </Route>
);

export const ONESALE_CONFIG = CONFIGS.onesale;
