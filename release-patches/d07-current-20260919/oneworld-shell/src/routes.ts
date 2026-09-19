import type { Product } from "./lib/oneId";

/**
 * ONE ADDRESS, EIGHT PRODUCTS.
 * ============================================================================================
 * Settled with Lee, 3 August 2026, after a real disagreement worth recording.
 *
 * He pushed back on "single origin", and he was right to — I had explained it badly. The rule is
 * not about the DOMAIN. `onejob.oneworldlabs.ai` and `oneevent.oneworldlabs.ai` share a domain
 * and are still two different places as far as the browser is concerned: an installed app is
 * locked to the exact host it was installed from, so tapping a switcher to a sibling subdomain
 * walks the user out of the installed app and into a browser tab.
 *
 * Lee's own framing settled it: *"if it's one app, then that means they're all under one
 * website."* Exactly. And "one address" never meant "no subdomain" — it meant ONE subdomain
 * instead of five. `app.oneworldlabs.ai/job` is a single origin.
 *
 * What that buys, and it is most of the hard problems from the last two days:
 *   · One install, one icon.
 *   · One session, automatically. Same origin means the session is simply shared — the
 *     parent-domain cookie adapter becomes unnecessary, and with it a whole class of failure.
 *   · The sign-on test shrinks from twenty app-pairs to almost nothing.
 *   · No cross-origin anything.
 *
 * The per-product subdomains stay alive as DOORWAYS. Someone clicks a OneJob advert, lands on
 * `onejob.oneworldlabs.ai`, and is walked into `app.oneworldlabs.ai/job`. The advert still says
 * OneJob and still has a OneJob address — the marketing never changes.
 */

/** The one place the app is served from. Everything below is a path under it. */
export const APP_ORIGIN_SINGLE = "https://app.oneworldlabs.ai";

/**
 * Path per product.
 *
 * Lee, 3 Aug 2026: *"We don't need to say OneJob, OneEvent — we can just keep it as one word.
 * But OneScore itself needs to say OneScore, because that is the leading marketing, marquee and
 * trademark."*
 *
 * So every path is the bare word, and OneScore keeps its full name. That is a brand decision, not
 * an oversight — do not "tidy" it to `/score`.
 */
export const PRODUCT_PATH: Record<Product, string> = {
  /* PLURAL where the product is a place you browse a COLLECTION. Lee, 3 Aug 2026: *"the URL for
     job should be plural — jobs — and for event, events."* He is right and it is not cosmetic:
     `/jobs` reads as a list you can look through, `/job` reads as one specific job you were sent
     to. The address is the first promise the product makes about what is behind it.

     `/social`, `/voice`, `/page` and `/app` stay singular because they are not collections — you
     do not browse "socials". `/agent` is the open one: OneAgent is about human agents representing
     talent, so `/agents` would follow the same logic, but Lee named only two and I am not
     pluralising a product he did not mention. */
  onejob:    "/jobs",
  oneevent:  "/events",
  onesocial: "/social",
  oneagent:  "/agent",
  onescore:  "/onescore",
  /* ── ONEHOME: ONE LAUNCHER, TWO SECTIONS ────────────────────────────────────────────────────
     `/home` is the canonical entry and the ONLY address any launcher, card, drawer row, tile or
     advert may point at. It is what makes OneHome one product to a member.

     `/rentals` and `/sales` stay exactly as they are — real mounted shells, real routes, real
     deep links. Max, 10 Aug: *"keep /rentals and /sales as internal/deep links if needed, but
     the launcher card should open OneHome as one product."* That is this, precisely.

     Deliberately NOT `/homes`: the plural rule (a collection you browse) belongs to the two
     sections, which already have it. `/home` is the product, not the shelf. */
  onehome:   "/home",
  onerental: "/rentals",
  onesale:   "/sales",
  onevoice:  "/voice",
  onepage:   "/page",
  oneapp:    "/app",
  /* Singular, both: you do not browse "pays" or "businesses" — you open YOUR till and YOUR business. */
  onepay:      "/pay",
  onebusiness: "/business",
};

/** The reverse lookup, so a URL can say which product the person is standing in. */
export const PATH_PRODUCT: Record<string, Product> = Object.fromEntries(
  Object.entries(PRODUCT_PATH).map(([p, path]) => [path, p as Product])
) as Record<string, Product>;

/** Which product is this URL in? Null on shared surfaces — the switcher, settings, sign-in. */
export function productFromPath(pathname: string): Product | null {
  const first = "/" + (pathname.split("/")[1] ?? "");
  return PATH_PRODUCT[first] ?? null;
}

/** A link to a product, inside the single app. Always relative — never a hostname. */
export const productHref = (p: Product, sub = "") => `${PRODUCT_PATH[p]}${sub}`;

/**
 * The marketing doorways. These are the ONLY places a full hostname still appears, and they exist
 * so adverts can keep saying "OneJob" and keep a OneJob address. Each one redirects into the app.
 *
 * `onescore.oneworldlabs.ai` matters most — it is the marquee, and it is the address most likely
 * to be typed by hand.
 */
export const MARKETING_HOST: Record<Product, string> = {
  onejob:    "https://onejob.oneworldlabs.ai",
  oneevent:  "https://oneevent.oneworldlabs.ai",
  onesocial: "https://onesocial.oneworldlabs.ai",
  oneagent:  "https://oneagent.oneworldlabs.ai",
  onescore:  "https://onescore.oneworldlabs.ai",
  /* One doorway for the app. `onehome.oneworldlabs.ai` is the address that goes on print and
     into adverts. The two section doorways survive so an existing link never dies, but nothing
     in the product should generate them any more. */
  onehome:   "https://onehome.oneworldlabs.ai",
  onerental: "https://onerental.oneworldlabs.ai",
  onesale:   "https://onesale.oneworldlabs.ai",
  onevoice:  "https://onevoice.oneworldlabs.ai",
  onepage:   "https://onepage.oneworldlabs.ai",
  oneapp:    "https://oneapp.oneworldlabs.ai",
  /* No doorway subdomain exists yet for the two newest products; their marketing pages live on
     the umbrella site under the apps path. A doorway can be added later without touching code
     that reads these — nothing appends a sub-path to either. */
  onepay:      "https://www.oneworldlabs.ai/apps/onepay/",
  onebusiness: "https://www.oneworldlabs.ai/apps/onebusiness/",
};

/** The parent marketing site. Not the app. */
export const HUB = "https://www.oneworldlabs.ai";

/**
 * Where a signed-in person should land.
 *
 * Never a chooser. The advert they clicked decides, and that intent is recorded on their profile
 * the first time they arrive. A member with no recorded intent lands in OneJob, because it is the
 * money rail and the only plausible daily habit.
 *
 * Lee, 3 Aug: the switcher is reached from the drawer, never as a landing page. Adobe ships a
 * chooser as screen one and it is their most complained-about surface.
 */
export function landingPath(entryProduct: Product | null): string {
  return PRODUCT_PATH[entryProduct ?? "onejob"];
}

/**
 * Services behave differently once someone is inside, and this is deliberate.
 *
 * Lee, 3 Aug 2026: *"The services don't need the glassmorphism makeover — they already have it.
 * They just need the shell correct, the sign-in correct, the hamburger working, the translation
 * working."* And what a signed-in person SEES differs by service: OneVoice is a dashboard of who
 * called, OnePage edits their website, OneApp edits their app.
 *
 * So a service is a product with an entitlement and a signed-in surface, not a full app with five
 * tabs. The shell renders its chrome and hands the middle of the screen to the service.
 */
export const IS_SERVICE: Record<Product, boolean> = {
  onejob: false, oneevent: false, onesocial: false, oneagent: false, onescore: false,
  onehome: false, onerental: false, onesale: false,
  onevoice: true, onepage: true, oneapp: true,
  onepay: false, onebusiness: false,
};

/**
 * Not built yet — "coming soon" (Task 1.1.d). These have no signed-in surface to open and no
 * entitlement to turn on, so the switcher must LABEL them, never present them as turn-on-able.
 *
 * `oneagent` (the middle-man app) and `oneapp` (the app-builder) are placeholders in the ecosystem:
 * the foundation + framework exist, the product does not. Shell CONFIG, not a database field — a
 * product's built-ness is a fact about the codebase, not about a member. When one ships, flip it to
 * false here and it becomes a normal Available/Subscription row with no other change.
 */
export const COMING_SOON: Record<Product, boolean> = {
  onejob: false, oneevent: false, onesocial: false, onescore: false, onevoice: false, onepage: false,
  oneapp: true,
  /* ── ONEAGENT IS LIVE. THIS SAID `true` AND WAS WRONG. ────────────────────────────────────
     Max, 10 Aug 2026: *"OneAgent must not say 'Coming soon'; it is live and should open the
     OneAgent route."* He is right, and the flag was stale rather than arguable: the product has
     eight real screens (Home, Roster, RosterMember, Deals, Partner, Calendar, Alerts,
     ProfileSlots) mounted at `/agent` in App.tsx, and Lee's own Your World screenshot shows
     OneAgent CONNECTED with its real description. The flag was set when the folder was empty and
     nobody cleared it, so the switcher has been labelling a shipped product as unbuilt — which
     also means it could not be turned on from the one screen designed to turn products on. */
  oneagent: false,
  /* OneHome opened 10 Aug 2026 with real screens on both sections, so NOT coming-soon — but not
     deployed either. Flip nothing here on its behalf until Lee pushes it. */
  onehome: false,
  onerental: false,
  /* NOT coming-soon. Lee, 10 Aug: *"we don't need to make the whole for-sale section coming
     soon — we just need to make pieces within it coming soon."* Listing, searching, messaging,
     documents and the sale history all work. The only thing that says "coming soon" is the
     button that would MOVE MONEY, because that is the only part that genuinely is not built. */
  onesale: false,
  /* Products 7 and 8 mount real screens from 7 Sep 2026. Not coming-soon: a member can open
     them and turn them on. What is NOT yet real inside OnePay (phone tap acceptance) hides itself
     until the provider is configured — the light-up-when-configured pattern, not a stamp. */
  onepay: false,
  onebusiness: false,
};
