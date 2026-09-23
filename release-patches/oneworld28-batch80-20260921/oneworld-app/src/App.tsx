import { lazy, Suspense } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useParams, useLocation, Outlet } from "react-router-dom";
import {
  ProfileEdit,
  AppShell, CONFIGS, ONE_WORLD_HUE, ComingSoon, OneWorldEntry, SignIn, SignUp, ResetPassword, DeleteAccount, LegalDoc,
  I18nProvider,
  registerVaiaPanel,
  PRODUCT_PATH, safeAuthReturn, type AppKey,
  ProfileScreen, PublicWorld, MessagesScreen, SettingsScreen, OneWorldHub, PlansScreen, AdminScreen, lazyScreen, ScreenFallback} from "@oneworld/shell";
import Placeholder from "./Placeholder";
/* The world feed at `/sandbox` — lazy, because nothing else in the app links to it. */
const WorldFeed = lazy(() => import("./products/world/WorldFeed"));
/* The One World opener film (R13). NOT lazy and NOT inside a route: it is the first thing a
   first-time visitor sees, and it navigates the app underneath itself while it plays — a lazy
   chunk would arrive after the moment it exists for, and a route-mounted copy would unmount
   itself on the navigation it just made. See products/world/Opener.tsx. */
import Opener from "./products/world/Opener";

/* Shared One ID and legal routes belong to the One World parent, never to whichever product
   happened to send the visitor there. Using OneJob's hue on these bare routes caused the live
   signup to start green and then jump to blue on Your World. Keep the routing/config contract,
   but replace only its hue so every entry point presents one continuous One World experience. */
const ONE_WORLD_CONFIG = { ...CONFIGS.onejob, hue: ONE_WORLD_HUE };

/**
 * ONEHOME'S DOORWAY. Carries a deep path from `/home/...` through to `/rentals/...`.
 *
 * `<Navigate>` alone cannot do this — the target has to be computed from the current URL — and a
 * doorway that silently dropped the rest of the path would turn every `/home/r/:id` advert link
 * into "here is the feed, go find it yourself".
 */
function HomeDoorway() {
  const { pathname, search, hash } = useLocation();
  const rest = pathname.slice(PRODUCT_PATH.onehome.length);
  return <Navigate to={`${PRODUCT_PATH.onerental}${rest}${search}${hash}`} replace />;
}
/* Phase two, MERGED 8 Aug 2026 — Thread A (OneEvent + OneAgent, route trees in
   src/products/<key>/routes.tsx) and Thread B (OneScore + OneSocial, screens imported below).
   Four products carry real screens; the rest keep the honest Placeholder. */
import { JobProviders, oneJobChildRoutes } from "./products/onejob/routes";
import { oneEventChildRoutes } from "./products/oneevent/routes";
/* ── ONE VAIA, ABOVE EVERY PRODUCT (Lee, 14 September 2026) ──────────────────────────────────
   *"Why would you have different models of VAIA?"* — so there is one, and it is OneEvent's real
   voice-first panel, not a second one written for everybody else. It used to be mounted inside
   OneEvent's own route tree, which is the whole reason tapping "Tap for insights" did nothing on
   OneHome, OneJob, OneScore and the rest: the pill is shell chrome and fires `ow-vaia-open` on
   every screen of every product, and only OneEvent was listening.

   REGISTERED, not rendered here. The first attempt mounted her at this root, above every
   `AppShell`, and she threw on sight: she calls `useOneId()`, and the shell's hooks refuse to
   guess outside `<OneIdProvider>`. `AppShell` renders whatever is registered, inside its own
   providers — see `shell/lib/vaiaPanel.ts`. Module scope, so it lands before the first frame.

   Lazy, so her chunk — markdown, framer-motion, the voice hook — is only fetched when somebody
   actually opens her. */
const VaiaChatMount = lazy(() => import("./products/oneevent/components/app/VaiaChatMount"));
registerVaiaPanel(() => (
  <Suspense fallback={null}><VaiaChatMount /></Suspense>
));
import { oneAgentChildRoutes } from "./products/oneagent/routes";
import { onePayChildRoutes } from "./products/onepay/routes";
import { oneBusinessChildRoutes } from "./products/onebusiness/routes";
/* OneRental — the SIXTH app, opened 10 Aug 2026. Colombia-only, sky blue, 8.99% = 1.50 host + 7.49 guest (set 14 Sep 2026). Its route tree
   lives in src/products/onerental/routes.tsx like OneEvent's and OneAgent's, so this file only
   mounts it and the product stays a route inside the shell rather than a deployment. */
import { oneRentalChildRoutes } from "./products/onerental/routes";
/* OneSale — the buying half of One Home, opened 10 Aug 2026. */
import { oneSaleChildRoutes } from "./products/onesale/routes";
const ScoreFeed = lazyScreen(() => import("./products/onescore/Feed"));
const ScoreScreen = lazyScreen(() => import("./products/onescore/ScoreScreen"));
const ConnectScreen = lazyScreen(() => import("./products/onescore/ConnectScreen"));
const SimulatorScreen = lazyScreen(() => import("./products/onescore/SimulatorScreen"));
const HowScreen = lazyScreen(() => import("./products/onescore/HowScreen"));
import { ScoreTiles, ScoreStats } from "./products/onescore/profileSlots";
const SocialFeed = lazyScreen(() => import("./products/onesocial/Feed"));
const PeopleScreen = lazyScreen(() => import("./products/onesocial/PeopleScreen"));
const PostScreen = lazyScreen(() => import("./products/onesocial/PostScreen"));
/* The raised centre since 9 Aug (Lee): connect + manage your social platforms. Post stays a
   real screen — the HomeTop composer routes there. */
const SocialConnect = lazyScreen(() => import("./products/onesocial/ConnectPlatformsScreen"));
const PublicSocialFeed = lazyScreen(() => import("./products/onesocial/PublicSocialFeed"));
const SharedContract = lazyScreen(() => import("./products/onejob/screens/SharedContract"));
import { SocialTiles, SocialStats } from "./products/onesocial/profileSlots";
/* Published legal documents, imported verbatim as raw text (Vite `?raw`) and rendered by the
   shared LegalDoc screen. OneHome's rental terms supplement the platform terms and privacy policy. */
import TERMS_V5 from "./legal/platform-terms-20260906.md?raw";
import ONEHOME_TERMS from "./legal/onehome-terms-20260906.md?raw";
import PRIVACY_V3 from "./legal/platform-privacy-20260906.md?raw";

/**
 * ONE APP, EIGHT PRODUCTS, ONE ORIGIN.
 * ============================================================================================
 * This is what `app.oneworldlabs.ai` serves. Every product is a ROUTE here, not a deployment —
 * which is the entire single-origin decision made concrete:
 *
 *   · One install, one home-screen icon. An installed PWA is locked to the host it was installed
 *     from, so a switcher across eight subdomains would walk the user out of their own app.
 *   · One session, automatically. Same origin means the session is simply shared — no cookie
 *     handoff, no redirect dance, no class of bug.
 *   · The sign-on matrix shrinks from 56 ordered pairs to almost nothing.
 *
 * The per-product subdomains stay alive as marketing DOORWAYS that redirect in here, so an
 * advert can still say OneJob and still carry a OneJob address.
 *
 * ── What is deliberately NOT here ────────────────────────────────────────────────────────────
 * Screens. Every product below mounts the real shell — real header, real drawer, real sign-in,
 * real terms gate, real translation — with a placeholder in the content area. That is Phase 2 of
 * the build order on purpose: stand the origin up, prove single sign-on across all eight, and
 * only then layer functionality in, one product per thread.
 *
 * Shipping the chrome first is not a shortcut. The chrome is what the sign-on matrix tests, and
 * nothing else may start until that matrix is green.
 */
/* The UAT preview file is opened from disk (`file://`), where there is no server to rewrite
   /onescore back to index.html — so the preview build routes after the `#`. Production is
   ALWAYS BrowserRouter; VITE_PREVIEW is defined only by vite.preview.config.ts. */
const Router = import.meta.env.VITE_PREVIEW === "1" ? HashRouter : BrowserRouter;

/* ── THE TEST SITE (PUB30, 20 September 2026) ───────────────────────────────────────────────
   The same build answers at two addresses on the SAME origin:

     app.oneworldlabs.ai            production — what members use
     app.oneworldlabs.ai/sandbox    the test site — the next version, before it goes live

   One origin because One ID is a same-origin session: a staging hostname would force a second
   sign-in and would therefore not mirror production, which is the whole point of having it.

   ONE WORD, not two. It was `/next` for an afternoon and Lee was right that two names for one
   idea is one too many — the test site is "sandbox" and nothing else.

   `index.html` is byte-identical at both addresses, because promoting to production is a copy of
   that one file. So the basename cannot come from the build — it is read from the address the
   page was served at, once, at mount. `undefined` rather than `"/"`, because react-router treats
   an explicit "/" basename differently for a bare root and production must keep the behaviour it
   has had since August. */
const SANDBOX_BASE = "/sandbox";
function mountBasename(): string | undefined {
  try {
    const here = window.location.pathname;
    if (here === SANDBOX_BASE || here.startsWith(SANDBOX_BASE + "/")) return SANDBOX_BASE;
  } catch { /* no window — the preview build and the tests render without one */ }
  return undefined;
}
const BASENAME = mountBasename();
const IN_SANDBOX = BASENAME === SANDBOX_BASE;

export default function App() {
  return (
    <Router basename={BASENAME}>
      {/* ── THE OPENER, ABOVE EVERY ROUTE ──────────────────────────────────────────────────
          Sixteen seconds of film on a fresh arrival at the front door, then a 320 ms fade into
          a screen that has been mounted and painted underneath it the whole time — which is the
          only way to get Lee's "no cut and no white frame". It arms itself only at the root and
          only once per device (every refresh in the sandbox, where it is being designed), and
          every failure path it has ends with the app rather than with a black rectangle.

          Its own I18nProvider, because it sits above `AppShell` and therefore above the shell's:
          the provider reads the device's stored language, so "Skip" is in the visitor's own
          language on the very first screen they ever see. */}
      <I18nProvider dict={ONE_WORLD_CONFIG.dictionary}>
        <Opener replayAlways={IN_SANDBOX} />
      </I18nProvider>
      <Routes>
        {/* The bare origin sends people to the product their intent points at. Never a chooser:
            they clicked an advert that said "get hired and get paid" — nobody ever clicked one
            that said "One World". */}
        {/* ── SUPERSEDED 3 Aug 2026, BY LEE'S OWN SIGNED-IN TEST ────────────────────────────
            The note above stays because the reasoning in it is still true — it was simply being
            applied in the wrong place. `landingPath(null)` always falls back to OneJob, so the
            bare origin dropped every visitor, signed in or out, into ONE product's sales pitch.

            "The advert carries the intent, so never show a chooser" is right, and that is exactly
            why the origin is the wrong place to enforce it: somebody arriving WITH intent lands
            on `/jobs` from a marketing doorway or a deep link and never types the origin.
            Arriving at the origin IS the no-intent case. OneJob-by-default was answering a
            question nobody had asked.

            ONE REFINEMENT, and it is load-bearing: an installed app's start_url is the bare
            origin, so this route runs on EVERY launch. A member who has turned on exactly one
            product would meet a chooser every single time they opened their app — which is
            Adobe's most-complained-about surface and the specific thing the switcher was designed
            not to become. `autoForward` sends a one-product member straight through; everyone
            else — signed out, or holding two or more — gets Your World.

            Reaching Your World deliberately from the drawer (`/switch`) never forwards. */}
        {/* ── `autoForward` IS GONE. THIS IS THE BUG LEE REPORTED ~40 TIMES. ────────────────
            *"When you type in app.oneworldlabs.ai you still get the OneJob page, and the URL
            defaults to /jobs. If you delete the /jobs part off the URL it still defaults to the
            jobs page. Even in incognito. I've been stressing that issue for half a day."*

            Reproduced 4 Aug 2026 in his own browser, and it was not a redirect, a cache or a DNS
            rule — it was this prop. `OneWorldEntry autoForward` reads `ow.primary` off the device
            and, if it names one product, navigates straight into it. His device has `onejob`
            written there, so the origin bounced to `/jobs` every single time, signed in or out.
            Deleting `/jobs` from the address bar just re-ran the same forward. There was nothing
            to find in the network tab, which is exactly why half a day went into it.

            The reasoning behind `autoForward` was real — an installed PWA launches at the bare
            origin, so a one-product member would meet a chooser on every launch. It was still
            wrong, and the reason is the one Lee has been giving all along: THE ORIGIN IS THE
            COMPANY, not a product. app.oneworldlabs.ai belongs to One World Labs, the same way
            the front door of a building belongs to the building and not to whoever rents the
            ground floor. A member who wants OneJob taps OneJob, or installs from `/jobs` so the
            product's own start_url points there.

            DO NOT REINTRODUCE THIS, in any form — not as a redirect, not as a default route, not
            as a "smart" first-launch shortcut. The origin renders One World. */}
        {/* THE FRONT DOOR IS THE FEED — production as well as the sandbox (Lee, 22 Sep 2026).
            The line that used to stand here said the production front door "stays unchanged until
            Lee says otherwise". He has said otherwise, more than once, and the last time was after
            signing in to production and landing on Your World again:

              *"everyone who signs in lands on the new feed page… You should be able to get to
              [Your World] through the hamburger icon. But that's it."*

            So both addresses render the same screen and there is no longer a branch here. This is
            NOT the `autoForward` mistake the block above forbids: nothing is redirected, no product
            is guessed at, and the origin still belongs to One World rather than to any product —
            the feed IS One World's own screen, carrying all four lanes.

            `/yourworld` still exists and is still reachable from the hamburger. It is simply no
            longer anybody's destination. `safeAuthReturn` in the shell enforces the other half of
            that: a sign-in return trip pointed at `/yourworld` resolves to the feed instead. */}
        <Route path="/" element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms>
            <Suspense fallback={<ScreenFallback />}><WorldFeed /></Suspense>
          </AppShell>
        } />

        {/* ── ONESCORE — real screens (Thread B). Footer LOCKED 8 Aug: Home · Connect ·
            My score (centre) · Simulator · Profile. NO Messages TAB — but the Messages SCREEN
            is still shell and still routed, reachable from conversations elsewhere. */}
        <Route path={`${PRODUCT_PATH.onescore}/*`} element={<AppShell config={CONFIGS.onescore} />}>
          <Route element={<Suspense fallback={<ScreenFallback />}><Outlet /></Suspense>}>
          <Route index element={<ScoreFeed />} />
          <Route path="connect" element={<ConnectScreen />} />
          <Route path="score" element={<ScoreScreen />} />
          <Route path="simulator" element={<SimulatorScreen />} />
          <Route path="profile" element={<ProfileScreen product="onescore" tilesSlot={<ScoreTiles />} statsSlot={<ScoreStats />} />} />
          <Route path="messages" element={<MessagesScreen product="onescore" />} />
          <Route path="settings" element={<SettingsScreen product="onescore" />} />
          <Route path="how" element={<HowScreen />} />
          <Route path="plans" element={<PlansScreen product="onescore" />} />
          <Route path="alerts" element={<Placeholder config={CONFIGS.onescore} screen="alerts" />} />
          {/* PUBLIC — a minted tap-to-share URL lands here; a stranger must never hit a wall. */}
          <Route path="p/:userId" element={<PublicWorld product="onescore" />} />
          <Route path="*" element={<Placeholder config={CONFIGS.onescore} screen="notfound" />} />
          </Route>
        </Route>
        {/* "‹Name›'s World" — standalone, no app header, One World blue, mounted BARE. */}
        <Route path={`${PRODUCT_PATH.onescore}/world/:userId`} element={
          <AppShell config={CONFIGS.onescore} bare skipTerms publicPaths={[/^\/[a-z]+\/world\//]}>
            <OneWorldHub product="onescore" />
          </AppShell>
        } />

        {/* ── ONESOCIAL — real screens (Thread B). Home · People · Post (centre) · Messages ·
            Profile. The combiner app: My World hub + sister-app surfacing carry the weight.
            ZERO money copy on any OneSocial surface — fees live in OneJob/OneEvent only. */}
        <Route path={`${PRODUCT_PATH.onesocial}/*`} element={<AppShell config={CONFIGS.onesocial} />}>
          <Route element={<Suspense fallback={<ScreenFallback />}><Outlet /></Suspense>}>
          <Route index element={<SocialFeed />} />
          <Route path="people" element={<PeopleScreen />} />
          <Route path="connect" element={<SocialConnect />} />
          <Route path="post" element={<PostScreen />} />
          <Route path="messages" element={<MessagesScreen product="onesocial" />} />
          <Route path="profile" element={<ProfileScreen product="onesocial" tilesSlot={<SocialTiles />} statsSlot={<SocialStats />} />} />
          <Route path="settings" element={<SettingsScreen product="onesocial" />} />
          <Route path="search" element={<PeopleScreen />} />
          <Route path="alerts" element={<Placeholder config={CONFIGS.onesocial} screen="alerts" />} />
          <Route path="plans" element={<PlansScreen product="onesocial" />} />
          {/* A visitor sees the person's cross-platform feed under the shared public header
              (Lee, 9 Aug) — all their social media, one place, no wall. */}
          <Route path="p/:userId" element={<PublicWorld product="onesocial" belowSlot={<PublicSocialFeed />} />} />
          <Route path="*" element={<Placeholder config={CONFIGS.onesocial} screen="notfound" />} />
          </Route>
        </Route>
        <Route path={`${PRODUCT_PATH.onesocial}/world/:userId`} element={
          <AppShell config={CONFIGS.onesocial} bare skipTerms publicPaths={[/^\/[a-z]+\/world\//]}>
            <OneWorldHub product="onesocial" />
          </AppShell>
        } />

        {/* ── PHASE TWO, Thread A (8 Aug 2026): OneEvent + OneAgent carry REAL screens. ──────
            Their route trees live in src/products/<key>/routes.tsx — this file only mounts
            them, so the products stay "a route inside the shell", never a deployment. The
            other six keys keep the Placeholder until their own threads land. */}
        {/* ── ONEJOB — real screens (Task 2.1, 9 Aug 2026; re-integrated onto v6, 10 Aug). ────
            THE FIRST APP ON THE SHELL. Footer: Home · My jobs · **Start a job** (raised
            centre — the money button) · Messages · Profile. Its route tree lives in
            src/products/onejob/routes.tsx, so OneJob is a route inside this app and never a
            deployment of its own.

            The slots it fills, and nothing more: the home feed, the Start-a-job/QR centre
            action, the My-jobs screen, and the profile's quick tiles + stats + calendar.
            Profile, Public world, Messages, Settings and the World hub are SHELL — imported by
            that file, not rebuilt. A change wanted in any of them is made once, in the shell,
            for all eight products. */}
        <Route path={`${PRODUCT_PATH.onejob}/*`} element={<AppShell config={CONFIGS.onejob} />}>
          {oneJobChildRoutes}
          <Route path="*" element={<Placeholder config={CONFIGS.onejob} screen="notfound" />} />
        </Route>
        {/* A contract link is minted at the shared origin, not under /jobs. Keep it public so the
            recipient can read the terms before creating One ID; mutations remain authenticated. */}
        <Route path="/contract/:token" element={
          <AppShell config={CONFIGS.onejob} bare skipTerms skipSetup publicPaths={[/^\/contract\/[^/]+\/?$/]}>
            <JobProviders><SharedContract /></JobProviders>
          </AppShell>
        } />
        {/* "‹Name›'s World" — standalone, no product header, mounted BARE. */}
        <Route path={`${PRODUCT_PATH.onejob}/world/:userId`} element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms publicPaths={[/^\/[a-z]+\/world\//]}>
            <OneWorldHub product="onejob" />
          </AppShell>
        } />

        {/* PUBLIC EVENT PAGES (Lee, 16 Aug 2026): "any user should be able to publicly see an
            event without signing in first" — a host's shared link must open the event, never a
            sign-up wall. /events/e/ = event pages (checkout included), /events/p/ = public
            profiles, /events/gt/ = tokenized guest tickets, and single-segment vanity slugs
            (app.oneworldlabs.ai/events/RoundtableEvent) excluding the signed-in screens.
            The ACCOUNT moment moves to Register (express checkout). */}
        <Route path={`${PRODUCT_PATH.oneevent}/*`} element={<AppShell config={CONFIGS.oneevent} publicPaths={[
          /^\/events\/e\//, /^\/events\/p\//, /^\/events\/gt\//, /^\/events\/join-express(\/|$)/,
          /* v22 CB: manager invite links open signed-out, then bounce through join-express. */
          /^\/events\/manage-invite\//,
          /^\/events\/(?!(?:events|tickets|calendar|pricing|messages|settings|alerts|profile|hosts|ticket|join-express)(?:\/|$))[A-Za-z0-9-]+\/?$/,
        ]} />}>
          {oneEventChildRoutes}
          <Route path="*" element={<Placeholder config={CONFIGS.oneevent} screen="notfound" />} />
        </Route>
        {/* ── ONEHOME: THE CANONICAL ENTRY ─────────────────────────────────────────────────
            `/home` is the ONE address any launcher, drawer row, switcher tile, marketing card or
            advert points at. It lands on the rent segment, and the segment strip at the top of
            that feed takes the person to `/sales` — so OneHome is one product with two sections,
            which is what Lee and Max asked for.

            A `<Navigate replace>` rather than a mounted shell, deliberately:
              · `replace` keeps `/home` out of history, so Back from the rent feed goes wherever
                the person actually came from rather than bouncing through the doorway.
              · No second AppShell means no second entitlement claim and no second chrome mount —
                the person sees OneHome's header exactly once.
            The splat form carries deep paths through, so `/home/r/123` reaches the property it
            names instead of dumping the person on the feed. That matters for the claim links and
            adverts that will point at `/home/...` from outside the app. */}
        <Route path={PRODUCT_PATH.onehome} element={<Navigate to={PRODUCT_PATH.onerental} replace />} />
        <Route path={`${PRODUCT_PATH.onehome}/*`} element={<HomeDoorway />} />

        <Route path={`${PRODUCT_PATH.onesale}/*`} element={<AppShell config={CONFIGS.onesale}
          publicPaths={[/^\/sales\/s\/[^/]+\/?$/]} />}>
          {oneSaleChildRoutes}
          <Route path="*" element={<Placeholder config={CONFIGS.onesale} screen="notfound" />} />
        </Route>
        <Route path={`${PRODUCT_PATH.onerental}/*`} element={<AppShell config={CONFIGS.onerental}
          publicPaths={[/^\/rentals\/r\/[^/]+\/?$/]} />}>
          {oneRentalChildRoutes}
          <Route path="*" element={<Placeholder config={CONFIGS.onerental} screen="notfound" />} />
        </Route>
        {/* ── ONEAGENT IS CLOSED, 12 Aug 2026 ──────────────────────────────────────────────
            Lee: *"I wanna put a coming-soon stamp on the agent screen. We still want them to be
            able to click and learn about it, but we still want them to know that it's coming
            soon. I don't want them to be able to access the app portion, but they should be able
            to access the website where they can learn about it."*

            So the tile stays in the switcher, the link still works, and EVERY path under
            `/agent` lands on the stamp — `/agent`, `/agent/deals`, `/agent/partner`, a bookmark,
            a deep link from an old message. A banner over the working screens would not have
            satisfied the middle requirement: the first person to tap past it judges the whole
            ecosystem by a half-built product.

            `oneAgentChildRoutes` is deliberately left imported and unmounted rather than
            deleted. Opening OneAgent again is restoring these four lines; nothing about the
            product's own code changes, and nothing needs unpicking from a feature flag.

            Mounted BARE and with `skipTerms`: there is no product to agree to terms for yet, and
            the product chrome would offer a footer full of tabs that all lead back here. The
            path is public so a signed-out person following a link reads the notice instead of a
            sign-in wall — the whole point is that they can learn about it. */}
        <Route path={`${PRODUCT_PATH.oneagent}/*`} element={
          <AppShell config={CONFIGS.oneagent} bare skipTerms publicPaths={[/^\/agent(\/|$)/]}>
            <ComingSoon product="oneagent" />
          </AppShell>
        } />
        {/* ── ONEPAY, the seventh app (7 Sep 2026) ────────────────────────────────────────────
            Every route under /pay. Receipts are public-readable by their own members only, so
            nothing here is public; the shell's sign-in wall applies to all of it. */}
        <Route path={`${PRODUCT_PATH.onepay}/*`} element={<AppShell config={CONFIGS.onepay} />}>
          {onePayChildRoutes}
          <Route path="*" element={<Placeholder config={CONFIGS.onepay} screen="notfound" />} />
        </Route>
        {/* ── ONE BUSINESS, the eighth app (7 Sep 2026) ───────────────────────────────────── */}
        <Route path={`${PRODUCT_PATH.onebusiness}/*`} element={<AppShell config={CONFIGS.onebusiness} />}>
          {oneBusinessChildRoutes}
          <Route path="*" element={<Placeholder config={CONFIGS.onebusiness} screen="notfound" />} />
        </Route>
        {/* "‹Name›'s World" — standalone, no product header, mounted BARE (the kickoff's
            contract). One per phase-two product; siblings gain theirs with their threads. */}
        <Route path={`${PRODUCT_PATH.oneevent}/world/:userId`} element={
          <AppShell config={CONFIGS.oneevent} bare skipTerms publicPaths={[/^\/[a-z]+\/world\//]}>
            <OneWorldHub product="oneevent" />
          </AppShell>
        } />
        <Route path={`${PRODUCT_PATH.onesale}/world/:userId`} element={
          <AppShell config={CONFIGS.onesale} bare skipTerms publicPaths={[/^\/[a-z]+\/world\//]}>
            <OneWorldHub product="onesale" />
          </AppShell>
        } />
        <Route path={`${PRODUCT_PATH.onerental}/world/:userId`} element={
          <AppShell config={CONFIGS.onerental} bare skipTerms publicPaths={[/^\/[a-z]+\/world\//]}>
            <OneWorldHub product="onerental" />
          </AppShell>
        } />
        <Route path={`${PRODUCT_PATH.oneagent}/world/:userId`} element={
          <AppShell config={CONFIGS.oneagent} bare skipTerms publicPaths={[/^\/[a-z]+\/world\//]}>
            <OneWorldHub product="oneagent" />
          </AppShell>
        } />

        {(Object.keys(CONFIGS) as AppKey[]).filter(k => !["onejob", "oneevent", "oneagent", "onescore", "onesocial", "onehome", "onerental", "onesale", "onepay", "onebusiness"].includes(k)).map(key => {
          const config = CONFIGS[key];
          const root = PRODUCT_PATH[key];
          return (
            <Route key={key} path={`${root}/*`} element={<AppShell config={config} />}>
              <Route index element={<Placeholder config={config} screen="home" />} />
              {config.tabs.slice(1).map(t => (
                <Route key={t.to} path={t.to.slice(root.length + 1)}
                       element={<Placeholder config={config} screen={t.labelKey} />} />
              ))}
              {config.drawerExtras.map(t => (
                <Route key={t.to} path={t.to.slice(root.length + 1)}
                       element={<Placeholder config={config} screen={t.labelKey} />} />
              ))}
              <Route path="alerts" element={<Placeholder config={config} screen="alerts" />} />
              {/* PUBLIC. A stranger opening a shared profile or a client opening a contract must
                  not hit a sign-in wall — those links exist to be opened from outside. */}
              <Route path="p/:id" element={<PublicProfile />} />
              <Route path="*" element={<Placeholder config={config} screen="notfound" />} />
            </Route>
          );
        })}

        {/* ── OLD SINGULAR PATHS STILL RESOLVE ──────────────────────────────────────────────
            `/job` became `/jobs` and `/event` became `/events` on 3 Aug 2026. Anything already
            shared — a link in a message, a bookmark, a QR code printed on a card — still points at
            the old one. A renamed route that 404s the links you already handed out is a
            self-inflicted outage, and it is the kind that shows up weeks later with no explanation.

            `replace` so the old address does not sit in history and send the back button in a
            loop. The deeper path is preserved, so `/job/messages` lands on `/jobs/messages`. */}
        <Route path="/job/*"   element={<Redirect from="/job"   to="/jobs" />} />
        <Route path="/event/*" element={<Redirect from="/event" to="/events" />} />

        {/* ── YOUR WORLD, AND IT IS `bare` TOO ─────────────────────────────────────────────
            Lee's screenshot, 4 Aug 2026: `/switch` under a green OneJob header, a green "Your
            World.", and OneJob's five tabs across the bottom. *"It still says OneJob at the top,
            and the URL says switch. So it's still off anyway. Not even correct."*

            Right on both counts. This screen belongs to no product, so it takes no product's
            chrome — same treatment the origin already had, applied to the other shared surface.
            And it goes through `OneWorldEntry` rather than straight to the switcher, so a
            signed-OUT visitor here gets the One World splash instead of a possessive heading
            over eight things they do not own.

            No `autoForward` — a person who asked for this screen gets this screen, however many
            products they hold. */}
        {/* ── `/yourworld`, NOT `/switch` ──────────────────────────────────────────────────
            Lee, 4 Aug 2026: *"the URL says app.oneworldlabs.ai but it really should say Your
            World — yourworld.oneworldlabs.ai."*

            The path is renamed to match the screen, which is the half of that worth doing. The
            SUBDOMAIN half is the one thing on this platform I will keep saying no to: a different
            hostname is a different origin, the session cannot follow it, and rebuilding that
            cookie handoff is the exact bug the single-origin decision was made to delete. Tapping
            "Your World" would sign the person out in front of their own eyes.

            `/switch` still resolves — it has been live, it is in the drawer of every build
            somebody may still have cached, and a renamed route that drops the old address is a
            self-inflicted outage. */}
        <Route path="/yourworld" element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms><OneWorldEntry /></AppShell>
        } />
        <Route path="/switch" element={<Navigate to="/yourworld" replace />} />

        {/* ── /sandbox — THE WORLD FEED, A ROUTE AND NOT A HOSTNAME (Lee, 20 September 2026) ──
            *"a secondary environment, like a sandbox, app dot oneworldlabs dot ai slash sandbox,
            that looks just like the real environment so we can test without affecting
            production."*

            A ROUTE, because One ID is a same-origin session. `sandbox.oneworldlabs.ai` is a
            different origin, the session cannot follow it, and the member would be asked to sign
            in again — so a staging hostname would not mirror production, it would only look like
            it. That is the single-origin ruling from August, and this is the same ruling.

            ⛔ IT IS LINKED FROM NOTHING. No launcher, no drawer row, no card, no tile. You reach
            it by typing it. `/` is the One World home and is NOT touched — Lee has reported an
            auto-forward regression on `/` about forty times, and when he approves this screen it
            will be `/` that changes, on his word, not by a shortcut added here.

            `bare`, like `/` and `/yourworld`: the feed carries FOUR products, so no single
            product's header, tab bar or terms may be put in front of it. It draws its own
            chrome — one row, lane name left, bell and menu right — and the lane's hue comes
            from `lanes.ts`, per column, not from a config. */}
        <Route path="/sandbox" element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms>
            <Suspense fallback={<ScreenFallback />}><WorldFeed /></Suspense>
          </AppShell>
        } />

        {/* ── SIGN IN AS A REAL ADDRESS ─────────────────────────────────────────────────────
            The drawer's signed-out rows have always pointed at `/signin`, and `/signin` was not
            a route — so it fell through the catch-all to `/jobs`. Signed-out drawers are only
            reachable on public surfaces (a shared profile, a contract), which is exactly why
            nobody caught it: the one visitor who could hit it is a stranger holding a link
            somebody sent them, and they got silently dumped in OneJob.

            `publicPaths` must be passed explicitly here or AuthGate would put its own sign-in
            wall in front of the sign-in screen.

            ── `bare` — Max, 5 Aug 2026 (MAX-20260805-0420-HOOKFIX) ───────────────────────────
            This route shipped WITHOUT `bare`, so a returning member signed in under OneJob's
            wordmark and "Get hired · Get paid" tagline — one product's chrome over the whole
            company's front desk, the `/switch` class of inconsistency. Signing in is a ONE ID
            act: like `/`, `/yourworld` and `/join` it wears no product's chrome. The separation
            is deliberate and browser-asserted in `smoke.mjs`: `/signin` is returning-member
            access only, `/join` is account creation only, and neither carries a product pitch. */}
        <Route path="/signin" element={
          <AppShell config={ONE_WORLD_CONFIG} bare publicPaths={["/signin"]} skipTerms skipSetup>
            {/* Vertically centred, not top-pinned. Lee UAT 7 Aug: the biometric-first sign-in
                sat in the top third of the screen. A short returning-member screen belongs in the
                optical centre.

                ⚠️ BUT `80vh` + `place-items-center` PUT IT BELOW THE FOLD. — 21 Sep 2026
                Lee: *"the page that says Welcome back doesn't populate at the top, at least not
                on my phone. You have to scroll back up to the top."* Two faults, both here:

                · `vh` is the LARGE viewport — the height the screen has when the browser's URL
                  bar is hidden. With the bar showing, 80vh is most of a screen the person cannot
                  fully see, so the card's optical centre sits below the real one. `dvh` is the
                  viewport as it is right now, and `100dvh - 3rem` is exactly the screen minus
                  `main`'s own `py-6`, so the block fills what is visible and nothing more.

                · `place-items-center` is the worse half. When content is TALLER than its
                  container — a small phone, a big font, the sign-up form with its bot check —
                  centring overflows in BOTH directions, and the part above the top is
                  unreachable: scrolling up does not reach it, because it is above the scroll
                  origin. `safe center` centres while it fits and falls back to the top when it
                  does not, which is the whole behaviour we want in one keyword.

                Centred when it fits, top-aligned when it cannot. Both of Lee's rulings hold. */}
            <div className="grid min-h-[calc(100dvh-3rem)] justify-items-center px-1" style={{ alignItems: "safe center" }}>
              {/* RETURN TRIP (Lee, 16 Aug 2026): a guest who tapped Register on a public event
                  signs in HERE and must land back on that checkout, not on Your World. ?next=
                  is validated to a same-origin path in SignInWithReturn below. */}
              <div className="w-full max-w-md"><SignInWithReturn /></div>
            </div>
          </AppShell>
        } />

        {/* ── RESET PASSWORD — `/reset` ────────────────────────────────────────────────────
            The shared forgot/reset flow (Max 1552). Same neutral treatment as `/signin` and
            `/join`: `bare` (a One ID surface, no product chrome), `skipTerms`, and public — a
            person recovering a password is signed out by definition, and the emailed recovery
            link must land without a sign-in wall in front of it. The screen owns both the request
            form and the set-new-password form; it never creates an account or routes to `/join`. */}
        <Route path="/reset" element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms skipSetup publicPaths={["/reset"]}>
            <div className="mx-auto w-full max-w-md py-6"><ResetPassword /></div>
          </AppShell>
        } />

        {/* ── ADMIN — `/admin` (§4.4, restored 10 Aug 2026) ─────────────────────────────────
            One route for the whole ecosystem, not one per product: the roster is the same list of
            people whichever app you happen to be standing in, and five copies would be five
            things to keep in step. Signed-in only (AuthGate gates it), and the screen itself
            renders a refusal for a non-admin — but the real gate is server-side: every admin RPC
            re-checks `is_platform_admin()` and raises 42501, so a forged client-side flag buys a
            menu item and a screen full of errors. Read paths only. */}
        <Route path="/admin" element={
          <AppShell config={CONFIGS.onejob} skipTerms skipSetup>
            <AdminScreen />
          </AppShell>
        } />

        {/* ── DELETE ACCOUNT — `/account/delete` ────────────────────────────────────────────
            Apple 5.1.1(v) and Google Play both REQUIRE an in-app path to initiate AND complete
            account deletion; a mailto link is a guaranteed rejection. Deliberately NOT public —
            deletion requires the signed-in person, so AuthGate must gate it (a signed-out visitor
            gets the sign-in wall, correctly). `bare` (a One ID surface, no product chrome),
            `skipTerms`, `skipSetup` (never interrupt a deletion with a biometrics prompt). The
            server is the money-safe authority; this screen is the honest, deliberate front end. */}
        {/* ── EDIT YOUR PROFILE — `/account/profile` ────────────────────────────────────────
            `Drawer.tsx` has linked here for weeks, the shell has exported `ProfileEdit` the whole
            time, and this route did not exist. Checked on production, signed in: it silently
            redirected to the home page — you tap "Edit profile" and land on the hub with no error.
            Exactly the shape of the version 54 messages bug, where 475 conversations were never
            openable because nothing was routed behind the link.

            ⚠️ `bare` ONLY — deliberately not `skipTerms`/`skipSetup` like the deletion route below
            it. Deletion skips the terms gate because nobody should have to accept terms in order to
            leave; editing your profile is not leaving, and skipping it would let somebody who has
            not accepted the terms edit their public profile. That is a policy change, not a route
            fix. AuthGate gates it, so a signed-out visitor correctly gets the sign-in wall. */}
        <Route path="/account/profile" element={
          <AppShell config={ONE_WORLD_CONFIG} bare>
            <div className="grid min-h-[calc(100dvh-3rem)] justify-items-center px-1" style={{ alignItems: "safe center" }}>
              <div className="w-full max-w-md"><ProfileEdit next="/yourworld" /></div>
            </div>
          </AppShell>
        } />

        <Route path="/account/delete" element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms skipSetup>
            <div className="grid min-h-[calc(100dvh-3rem)] justify-items-center px-1" style={{ alignItems: "safe center" }}>
              <div className="w-full max-w-md"><DeleteAccount next="/" /></div>
            </div>
          </AppShell>
        } />

        {/* ── CREATE AN ACCOUNT — `/join` ───────────────────────────────────────────────────
            The sign-up wizard, wired at last: `SignUp` was exported from the package root at
            `650c8ad` and nothing routed to it, and a screen no route reaches cannot be UAT'd.

            Three deliberate choices, each mirroring a decision already made elsewhere in this
            file rather than inventing a new one:

            · `bare` — sign-up creates a ONE ID, not a OneJob account, so like `/` and
              `/yourworld` it takes no product's chrome. (`/signin` currently wears OneJob's
              chrome; that is an existing inconsistency in the frozen sign-in lane, noted for
              Max, not copied.)
            · `publicPaths={["/join"]}` — a person creating an account is signed out by
              definition; without this AuthGate would put a sign-in wall in front of sign-up,
              the same trap `/signin` documents above.
            · `skipTerms` — terms are INSIDE the wizard, as small print on the last screen, by
              Lee's explicit design. Gating the wizard on the terms it exists to present would
              be a loop.

            `next="/yourworld"`: a person who has just created their One World account lands on
            their world, exactly as proposed to Max in the 03:05 READY_FOR_MAX. A product that
            wants people back on its own screen after joining passes its own `next`. */}
        <Route path="/join" element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms skipSetup publicPaths={["/join"]}>
            {/* ?next= return trip (Lee, 17 Aug 2026) — same validation as /signin; a ticket
                buyer creating an account comes back to the ticket, where it attaches. */}
            <div className="mx-auto w-full max-w-md py-6"><SignUpWithReturn /></div>
          </AppShell>
        } />

        {/* ── PUBLISHED LEGAL DOCUMENTS ──────────────────────────────────────────────────────
            These public routes must remain readable without sign-in, onboarding, or a terms gate.
            OneHome Rental Terms supplement the platform Terms and Privacy Policy. */}
        <Route path="/onehome/terms" element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms skipSetup publicPaths={["/onehome/terms"]}>
            <LegalDoc title="OneHome Rental Terms" source={ONEHOME_TERMS} published />
          </AppShell>
        } />
        <Route path="/terms" element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms skipSetup publicPaths={["/terms"]}>
            <LegalDoc title="Terms of Service" source={TERMS_V5} published />
          </AppShell>
        } />
        <Route path="/privacy" element={
          <AppShell config={ONE_WORLD_CONFIG} bare skipTerms skipSetup publicPaths={["/privacy"]}>
            <LegalDoc title="Privacy Policy" source={PRIVACY_V3} published />
          </AppShell>
        } />

        {/* An address that matches nothing goes to the FRONT DOOR, not into a product.
            It used to land on `/jobs` — so a typo, a stale link or a renamed path silently
            produced OneJob's home screen with no sign that anything had gone wrong. Max's
            regression pass read exactly that as "five products resolve to OneJob".

            Product-scoped typos are unaffected: `/jobs/nonsense` is caught by OneJob's own
            catch-all above and stays in OneJob, which is right — you know where you are. Only a
            completely unknown first segment reaches here, and for that Your World is the honest
            answer. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

/** Carries the rest of the path across a rename, so a deep link survives it. */
/* /signin and /join with an optional validated `?next=` return path (Lee, 16–17 Aug 2026).
   Only a same-origin absolute path is honoured: it must start with "/" and not "//" —
   anything else falls back to Your World exactly as before. */
function SignInWithReturn() {
  const { search } = useLocation();
  const raw = new URLSearchParams(search).get("next") || "";
  const next = safeAuthReturn(raw);
  return <SignIn next={next} />;
}
function SignUpWithReturn() {
  const { search } = useLocation();
  const raw = new URLSearchParams(search).get("next") || "";
  const next = safeAuthReturn(raw);
  return <SignUp next={next} />;
}

function Redirect({ from, to }: { from: string; to: string }) {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(from, to) + search} replace />;
}

function PublicProfile() {
  const { id } = useParams();
  return (
    <div className="card !rounded-3xl">
      <p className="text-[13px] font-bold uppercase tracking-widest opacity-40">Public profile</p>
      <p className="mt-2 text-sm opacity-70">
        Profile <code className="font-mono">{id}</code> — visible without an account, by design.
      </p>
    </div>
  );
}
