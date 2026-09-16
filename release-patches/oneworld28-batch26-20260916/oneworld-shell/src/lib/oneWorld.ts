/* ============================================================================
   WHERE EVERY ONE WORLD PRODUCT LIVES — the single source of truth.
   ----------------------------------------------------------------------------
   Lee, 2 Aug 2026: *"once I go click on one event, I go back to one job, then
   that route is broken also, so it takes me back to the old one job."*

   He was right, and this file is the reason it happened. Before this, the same
   handful of URLs were hard-coded in EIGHT different components — TopBar,
   OneWorldPanel, SisterProfileLinks, LinkScoreModal, StartJob, OneWorld,
   appStore — each written at a different time, each frozen at whatever the
   address happened to be that week. Among them were `/onejob-violet/p/:id`
   (a route from a build that no longer exists), `/onesocial-v2-preview/`
   (the old OneJob), `/onescore-preview/` and `/oneevents-preview/`.

   So the app could hand you a link to a version of itself from two rebuilds
   ago. Not a routing bug — a *duplication* bug. Eight copies of a fact that
   changes.

   THE RULE FROM NOW ON: no One World URL is written anywhere but here and in
   `routes.ts`. If you are about to type "oneworldlabs.ai" in a component, stop
   and import instead.

   ── Updated 3 Aug 2026: ONE ORIGIN ────────────────────────────────────────────
   The per-app hostnames are no longer where the app lives. Everything is served
   from `app.oneworldlabs.ai/<product>` — see `routes.ts` for why. The hostnames
   survive as marketing DOORWAYS only, and they are declared in `routes.ts` as
   `MARKETING_HOST` so there is exactly one list of them.

   `appHome()` therefore returns a PATH, not a URL. That is deliberate: a
   relative link keeps the person inside the installed app; a hostname walks
   them out of it into a browser tab. If you find yourself wanting the absolute
   form, you want `MARKETING_HOST` and you should be sure.
   ========================================================================== */

import { APP_ORIGIN_SINGLE, PRODUCT_PATH, MARKETING_HOST } from "../routes";

/**
 * Every product in the family — the five apps and the three services.
 *
 * Widened from five to eight on 3 Aug 2026. Lee: *"we might as well build the
 * shells for the 3 services too… they all still need shells anyway."* A type
 * that stops at five is a type that lets a service quietly skip the shell.
 *
 * Identical to `Product` in `lib/oneId`. They are the same set and are kept as
 * one alias rather than two unions that can drift apart.
 */
export type AppKey =
  | "onejob" | "onescore" | "oneevent" | "onesocial" | "oneagent"
  | "onehome" | "onerental" | "onesale"
  | "onevoice" | "onepage" | "oneapp"
  /* Products 7 and 8, 7 Sep 2026: OnePay (merchant payments) and One Business (the customer app
     for every One World Labs service). Registered in the database first — the five-place rule. */
  | "onepay" | "onebusiness";

/**
 * THE SIX. This is the app list a member sees, and it is the only list that decides what
 * counts as an app.
 * ============================================================================================
 * Lee and Max, 10 Aug 2026, from live screenshots: *"OneHome must appear as ONE app everywhere.
 * Do not show 'OneHome · For rent' and 'OneHome · For sale' as separate apps… Rentals and Sales
 * are internal sections inside OneHome."*
 *
 * The product lane's reasoning for two — different hues, different footers, different money —
 * was sound ENGINEERING and it survives untouched below as two mounted shells. What it got wrong
 * is that a member does not care how many shells there are. They asked for one thing called
 * OneHome, so the launcher, the drawer, the switcher, Your World, the counts and the tiles all
 * say OneHome, exactly once.
 *
 * The count went 5 → 6 → 7 → **6** in one day. Six is the number, and this list is why: anything
 * that iterates it gains or loses a row in EVERY product at once.
 */
/* v16 (Lee, 18 Aug 2026): drawer order is OneScore, OneJob, (OneEvent,) OneSocial, OneHome,
   OneAgent — the current app is filtered out by the drawer, so every product sees the same
   sequence minus itself. */
/* EIGHT from 7 Sep 2026: OnePay and One Business join. Lee: OnePay is the seventh app, One Business
   the eighth. Everything that iterates this list gains two rows in every product at once. */
export const CONSUMER_APPS = ["onescore", "onejob", "oneevent", "onesocial", "onehome", "oneagent", "onepay", "onebusiness"] as const;

/**
 * The two halves of OneHome. NOT apps — sections, with their own mounted shell each, reachable
 * as deep links (`/rentals`, `/sales`) and from the segment strip on either feed.
 *
 * They stay real `AppKey`s because each one genuinely has its own hue, footer and money rules,
 * and pretending otherwise would mean one shell branching on a segment — which is the drift the
 * config file exists to prevent. What they must never be is *counted*.
 */
export const HOME_SECTIONS = ["onerental", "onesale"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

/** True for a key that is a section of another app rather than an app in its own right. */
export const isSection = (k: AppKey): k is HomeSection =>
  (HOME_SECTIONS as readonly string[]).includes(k);

/**
 * THE ONE NORMALISER. A section key in, the app key a member would name out.
 *
 * Every surface that answers "which app am I in" or "is this app connected" runs the key through
 * here first. Without it, standing in `/sales` makes the switcher highlight nothing and Your
 * World shows OneHome as not-connected while the person is literally inside it — which is the
 * bug in Lee's screenshot, one level up.
 */
export const launcherKey = (k: AppKey): AppKey => (isSection(k) ? "onehome" : k);
/** The three that are services. */
export const SERVICES = ["onevoice", "onepage", "oneapp"] as const;

/**
 * The display name and the brand dot, for every product, in ONE place.
 *
 * The drawer paints a coloured dot per product rather than an emoji: emoji render
 * differently on every device, and these are brand marks, not decoration.
 *
 * OneSocial's hue is UNRESOLVED and is flagged rather than silently chosen — violet
 * `#8B3DEA` collides with the Trusted badge tier, and teal `#15C2B2` is the shared
 * State colour. It ships violet until Lee picks, because that is what is live today.
 */
export const PRODUCT_BRAND: Record<AppKey, { name: string; dot: string }> = {
  onejob:    { name: "OneJob",    dot: "#17A45C" },
  onescore:  { name: "OneScore",  dot: "#E0A21F" },   // amber belongs to OneScore alone
  oneevent:  { name: "OneEvent",  dot: "#E2711D" },
  onesocial: { name: "OneSocial", dot: "#8B3DEA" },   // ← unresolved, see above
  oneagent:  { name: "OneAgent",  dot: "#7B2D3B" },
  /* THE APP. One name, one dot, everywhere a member can see it.
     MEDIUM TEAL from 11 Aug 2026 — Lee asked for teal twice; the reasoning, the measurement and
     the one narrow restriction that comes with it are in `products/hues.ts` under `onehome`.
     This dot and that ramp's `bright` are the same colour and must be changed together. */
  onehome:   { name: "OneHome",   dot: "#0D9488" },
  /* The two SECTIONS. These names appear on the segment strip inside OneHome and in nothing that
     counts apps — never in the drawer, the switcher, Your World or a tile. The suffixed forms
     ("OneHome · For rent") are gone: they are what made one app read as two. */
  onerental: { name: "For rent",  dot: "#0EA5E9" },
  onesale:   { name: "For sale",  dot: "#0E7490" },   // deep petrol — the sale half of OneHome
  onevoice:  { name: "OneVoice",  dot: "#2E6BE6" },
  onepage:   { name: "OnePage",   dot: "#D6338B" },   // magenta, per the brand doc
  oneapp:    { name: "OneApp",    dot: "#8E2F6B" },   // berry, per the brand doc
  /* OnePay: coral, provisional per the 7 Sep brief until brand records settle it. Distinct from
     OneEvent's orange by being pink-leaning; never amber. */
  onepay:      { name: "OnePay",       dot: "#F3765C" },
  /* One Business: deep navy — the "business" blue, deliberately darker than OneVoice's #2E6BE6
     because OneVoice is the flagship service INSIDE it and the two sit side by side. */
  onebusiness: { name: "One Business", dot: "#1F4E79" },
};

/** The conic sweep used for the One World Labs entry itself. Not any one product's colour. */
export const ONE_WORLD_DOT =
  "conic-gradient(#E0A21F,#17A45C,#E2711D,#8B3DEA,#15C2B2,#E0A21F)";

/** The umbrella marketing site. NOT the app. */
export const HUB = "https://www.oneworldlabs.ai";

/**
 * A product's home, INSIDE the single app. A path, never a hostname — see the header.
 */
export const appHome = (k: AppKey) => PRODUCT_PATH[k];

/**
 * The absolute doorway for a product. Adverts, emails, printed material, anything
 * that has to survive outside the app. Redirects into `app.oneworldlabs.ai/<product>`.
 */
export const appDoorway = (k: AppKey) => MARKETING_HOST[k];

/**
 * Someone's public profile inside a given product.
 *
 * Every app publishes profiles at `<product>/p/:userId`. Keeping the shape here rather
 * than at each call site is what stopped `/onejob-violet/p/:id` from being quietly
 * correct-looking for weeks.
 */
export const appProfile = (k: AppKey, userId: string) =>
  `${PRODUCT_PATH[k]}/p/${encodeURIComponent(userId)}`;

/** OneJob's "hire me" link. Absolute, because it is pasted OUTSIDE the app. */
export const hireLink = (userId: string) =>
  `${MARKETING_HOST.onejob}/hire/${encodeURIComponent(userId)}`;

/**
 * A contract someone is being asked to sign. Public, and pasted into messages.
 *
 * Contract acceptance is an authenticated application workflow, so this link belongs on the
 * single app origin. The OneJob marketing doorway is useful for adverts, but sending a financial
 * workflow through it made the final route depend on a separate site's redirect rules and left
 * the integrated app with no matching destination.
 */
export const contractLink = (token: string) =>
  `${APP_ORIGIN_SINGLE}/contract/${encodeURIComponent(token)}`;

/**
 * RETIRED — do not link to any of these. Listed so a future reader can recognise one on
 * sight, and so the check in `scripts/` (and any grep) has a canonical list to fail against.
 */
export const RETIRED_PATHS = [
  "/onejob-violet/",          // a build that no longer exists
  "/onesocial-v2-preview/",   // served OneJob historically; confusing and stale
  "/onescore-preview/",       // still resolves; NOT canonical
  "/oneevents-preview/",      // still resolves; NOT canonical
  "/onesocial-preview/",      // still resolves; NOT canonical
  "https://onesocial.ai",     // different registrable domain; cannot share the session
] as const;
