import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomTabs from "../components/BottomTabs";
import VaiaSubheader from "../components/VaiaSubheader";
import { useVaiaSlotProvider } from "../components/ScreenHeading";
import ScreenBoundary from "../components/ScreenBoundary";
import AuthGate from "./AuthGate";
import { useOneIdNoticeStamp } from "./SignIn";
import AccountSetup, { needsAccountSetup } from "./AccountSetup";
import SignUp from "./SignUp";
import { I18nProvider, useI18n, type Lang } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { ThemeProvider } from "../lib/theme";
import { OneIdProvider, useOneId } from "../lib/oneId";
import { applyHue } from "../lib/hue";
import { assertConfig, type AppConfig } from "../config";
import { IS_SERVICE } from "../routes";
import { captureEntry } from "../lib/entryContext";
import { rememberPrimary } from "./OneWorldEntry";
import { useRouteAnalytics } from "../lib/analytics";

/**
 * THE SHELL. Every product mounts this and writes zero chrome, zero auth and zero i18n code.
 * ============================================================================================
 * Lee, 3 Aug 2026:
 *
 *   "It could be one shell for every app, and it should be identical to what we've already built
 *    with OneJob… if we build one shell for four apps and then one shell for the OneJob app, I
 *    think that disconnect might be a problem. So build the shell, then take all of the code we
 *    have for OneJob and layer it onto the shell… instead of OneJob living on an island by
 *    itself."
 *
 * And on the services: *"we might as well build the shells for the 3 services too… they all
 * still need shells anyway — the login stuff, the header, the hamburger thing, the footer."*
 *
 * So all eight products mount this. There is no exemption, including for the product it was
 * extracted from, because a shell that seven products use and an eighth does not is two shells.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────────────────────
 *   <BrowserRouter>
 *     <Routes>
 *       <Route element={<AppShell config={oneJobConfig} />}>
 *         <Route path="/job"          element={<Home />} />
 *         <Route path="/job/messages" element={<Messages />} />
 *       </Route>
 *     </Routes>
 *   </BrowserRouter>
 *
 * The product supplies screens. That is all it supplies.
 */

/**
 * BACK-TO-TOP — visible while you are scrolling, gone the moment it would be in the way.
 * ============================================================================================
 * LEFT side, because the assistant lives on the right in every product.
 *
 * Lee, 11 Aug 2026, with three screenshots of it sitting on top of things:
 *
 *   *"That button is overlapping the Save draft. And that same button is actually overlapping
 *   the messages too — when you're in the messages section and you scroll and you want to type
 *   something into the bar, that up arrow conflicts with the section where you're typing into…
 *   it's in the way on a lot of screens. I would say make it disappear when it's overlapping
 *   some text. It should only appear maybe a second or two when you're in active scrolling mode,
 *   and once you stop scrolling it should just disappear."*
 *
 * Both halves of that are implemented, and they are different mechanisms:
 *
 * 1. IDLE FADE. It shows while the page is moving and hides ~1.4s after it stops. A control
 *    for getting back to the top is only wanted by somebody who is currently travelling away
 *    from the top; parked on a still page it is decoration that happens to cover things.
 *
 * 2. COLLISION TEST. Even mid-scroll it stays hidden if something interactive is underneath it.
 *    `elementsFromPoint` at the button's own centre asks the browser what is actually there —
 *    no list of screens to maintain, no guessing, and it is automatically right for a screen
 *    nobody has written yet. It fires on scroll (cheap, and the layout only moves then).
 *
 * The composer and the sticky Save-draft bar are the two real cases today. Neither is named
 * here, which is the point: the rule is "do not cover a control", not "do not cover these two".
 */
const BTT_IDLE_MS = 1400;

const BACK_TO_TOP_LABELS: Record<Lang, string> = {
  en: "Back to top",
  co: "Volver arriba",
  es: "Volver arriba",
  de: "Nach oben",
  ru: "Вернуться наверх",
  zh: "返回顶部",
  pt: "Voltar ao topo",
};

function BackToTop() {
  const { lang } = useI18n();
  const [show, setShow] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    /* Would the button be sitting on top of something a person could use? Ask the DOM, at the
       exact point the button occupies. `pointer-events-none` on the button itself is not needed:
       we read the stack under its centre and skip the button if it is in the list. */
    const blocked = () => {
      const r = btn.current?.getBoundingClientRect();
      /* Not mounted yet — assume the spot is clear, or the button could never appear at all. */
      if (!r) return false;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const stack = document.elementsFromPoint(x, y) as HTMLElement[];
      return stack.some(el =>
        el !== btn.current && !btn.current?.contains(el) &&
        (/^(button|a|input|textarea|select|label)$/.test(el.tagName.toLowerCase()) ||
         el.getAttribute?.("role") === "button" ||
         el.isContentEditable));
    };

    const onScroll = () => {
      if (idle.current) clearTimeout(idle.current);
      setShow(window.scrollY > 500 && !blocked());
      /* Lee's "a second or two". Hiding on idle also means a screen that never scrolls never
         shows it, which is most of the screens he found it covering something on. */
      idle.current = setTimeout(() => setShow(false), BTT_IDLE_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idle.current) clearTimeout(idle.current);
    };
  }, []);

  return (
    <button ref={btn} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={BACK_TO_TOP_LABELS[lang] ?? BACK_TO_TOP_LABELS.en} aria-hidden={!show} tabIndex={show ? 0 : -1}
      className={`ow-tap fixed bottom-24 left-3 z-40 grid h-11 w-11 place-items-center rounded-full shadow-lg
                  transition-opacity duration-200 ${show ? "opacity-100" : "pointer-events-none opacity-0"}`}
      style={{
        background: "var(--overlay-bg)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    </button>
  );
}

/** The chrome itself, inside the providers so it can read theme, language and identity. */
function Chrome({
  config, badges, rightSlot, children,
}: {
  config: AppConfig;
  badges?: Record<string, number>;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const loc = useLocation();

  /* Every screen starts at the top. Without this, opening a detail from halfway down a list
     drops you halfway down the detail — which reads as a rendering bug, not as a scroll
     position, because there is nothing on screen to explain it. */
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  /* A service has no five-tab footer, so it has no strip to clear at the bottom. Padding for a
     bar that is not there leaves a dead band on every screen. */
  const hasTabs = config.tabs.length > 0;
  const isMessagesRoute = /\/messages(?:\/|$)/.test(loc.pathname);
  const [hideTabsForComposer, setHideTabsForComposer] = useState(false);

  /* The VAIA slot. `standalone` is true until a `ScreenHeading` claims the pill; the claim runs
     in a layout effect, so the swap happens before paint and there is no one-frame twitch on
     navigation. */
  const { api: vaiaApi, Provider: VaiaProvider, standalone: vaiaStandalone } = useVaiaSlotProvider();

  useEffect(() => {
    setHideTabsForComposer(false);
    const onComposerFocus = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      setHideTabsForComposer(isMessagesRoute && active);
    };
    window.addEventListener("ow-thread-composer-focus", onComposerFocus);
    return () => window.removeEventListener("ow-thread-composer-focus", onComposerFocus);
  }, [isMessagesRoute, loc.pathname]);

  return (
    <div className="min-h-screen">
      <TopBar config={config} rightSlot={rightSlot} />
      <main className={`mx-auto px-4 pt-4 ${loc.pathname.startsWith("/admin") ? "max-w-7xl" : "max-w-lg"} ${hasTabs ? "pb-28" : "pb-10"}`}>
        {/* VAIA — SHELL, on every screen (matrix), identical on all apps.
            A screen with a title puts the pill on the TITLE'S ROW via `ScreenHeading`, which
            claims the slot below and stands this standalone row down (Lee, 10 Aug 2026). A
            screen with no title of its own — a detail view, a wizard step — keeps the pill here
            rather than losing VAIA entirely. */}
        <VaiaProvider value={vaiaApi}>
          {!isMessagesRoute && (vaiaStandalone && <VaiaSubheader />)}
          {/* §4.14 — a screen that throws must not take the whole application off screen. Every
              product screen is a lazy chunk; <Suspense> catches PENDING, not THROWING, so one bad
              read used to unmount the entire tree, chrome included, and render a blank white page
              (Lee's 9-Aug screenshot). The boundary sits INSIDE main on purpose: the header,
              drawer and tab bar stay alive, so a member can walk away from a broken screen
              instead of being trapped on it. Keyed by pathname so navigating away clears it. */}
          <ScreenBoundary key={loc.pathname}>
            {children ?? <Outlet />}
          </ScreenBoundary>
        </VaiaProvider>
      </main>
      <BackToTop />
      {!hideTabsForComposer && <BottomTabs config={config} badges={badges} />}
    </div>
  );
}

/**
 * The two gates, INSIDE the i18n provider.
 *
 * This is a separate component for one reason and it is not cosmetic: `t()` only exists below
 * `<I18nProvider>`. Resolving the splash and terms copy in `AppShell` would mean reaching into
 * `config.dictionary.en` by hand — and shipping an English splash to every Spanish speaker who
 * has not signed in yet, which is precisely the audience the splash is written for.
 */
function Gated({
  config, badges, rightSlot, publicPaths, bare, skipTerms, skipSetup, children,
}: {
  config: AppConfig;
  badges?: Record<string, number>;
  rightSlot?: React.ReactNode;
  publicPaths?: (string | RegExp)[];
  bare?: boolean;
  skipTerms?: boolean;
  skipSetup?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  useRouteAnalytics(config.entitlement ?? config.key);
  /* Writes the One ID disclosure record once an OAuth sign-in lands back here. */
  useOneIdNoticeStamp();
  /* And answers "how did they get here" while the answer is still in the URL. Runs on the FIRST
     screen of every visit, signed in or out, because by the time there is an account the URL that
     carried the campaign, the QR flag or the contract token is three redirects in the past. */
  useEffect(() => { captureEntry(); }, []);

  /* ── ARRIVING AT A PRODUCT MAKES IT YOUR DEFAULT (Lee, 13 Aug 2026) ──────────────────────
     *"If you're on the OneJob page and you click download the app, it's gonna be coded to take
     you or prioritise OneJob… when you create an account and go to Your World, OneJob would be
     sitting right there for you. Or if you entered in from the OneEvent page, you'll be coded to
     take you to OneEvent."*

     The pieces for this were all built and none of them were connected. `rememberPrimary` decides
     which app Your World opens on, and it was only ever called from the One World entry screen —
     the shared front door. So somebody who followed a OneHome advert straight to /home used
     OneHome for an hour and still found Your World offering them something else, because nothing
     on the product's own path ever recorded that they were there.

     Mounting a product's shell IS the signal. It cannot be faked by a stray link the way a query
     parameter can, it needs no marketing-side co-operation, and it self-corrects: whichever app
     you actually opened last is the one waiting for you.

     `bare` is excluded deliberately. Your World and a public profile hang off every product's
     path — `/agent/world/:id` renders under OneAgent's config — so counting those would make the
     default whichever product's URL a shared profile link happened to use. */
  useEffect(() => {
    /* `IS_SERVICE` is a lookup table, not a function — OneVoice, OnePage and OneApp are things
       we run FOR somebody, not apps they open, so they must never become the default. */
    if (!bare && !IS_SERVICE[config.key]) rememberPrimary(config.key);
  }, [config.key, bare]);
  return (
    /* ORDER MATTERS, and it is the same in every product:
         AuthGate   — who are you? Nothing renders until this is answered.
         TermsGate  — have you agreed to THIS product's terms? First use only.
         Chrome     — header, footer, screen.

       Terms sit INSIDE auth because agreement is recorded against a user, and there is nobody
       to record it against until sign-in has happened. A service is gated the same way as an
       app: Lee, 3 Aug — *"they just need the shell correct, the sign-in correct, the hamburger
       working, the translation working."* */
    <AuthGate
      headline={t(config.splash.headlineKey)}
      sub={t(config.splash.subKey)}
      /* `t` returns the KEY when a string is missing, so a product that has no pitch yet
         would print "splashPitch" on its sign-in screen. Compare and drop it instead. */
      pitch={config.splash.pitchKey && t(config.splash.pitchKey) !== config.splash.pitchKey
               ? t(config.splash.pitchKey) : undefined}
      wordmark={config.wordmark}
      publicPaths={publicPaths ?? DEFAULT_PUBLIC}>
      {/* ── A SHARED SURFACE HAS NO PRODUCT TERMS TO ACCEPT ────────────────────────────
          Found 4 Aug 2026 while driving Your World as a signed-in member: `/switch` mounts with
          OneJob's config to borrow its chrome, so it also inherited OneJob's TERMS GATE. A
          member who came in through OneVoice and tapped "Your World" was asked to accept
          OneJob's terms — for a product they had not opened, on a screen belonging to no product
          — and accepting would have granted them OneJob, silently, from a menu.

          That is the entitlement-before-intent failure the gate was built to prevent, arriving
          through the back door. Terms belong to a product; Your World is not one. */}
      {/* ── THE THREE CHOICES, ONCE, BEFORE ANYTHING ELSE ─────────────────────────────
          Lee, 4 Aug 2026: *"the biometrics, the ninety day, the notification — all that stuff is
          the normal flow for everyone. Every app goes to that same process. The only difference
          per app is that the background colour may be different, but the information and how
          it's laid out should be identical, because you're creating profile-level information.
          It's not specific to the app itself, it's specific to the person."*

          So it sits HERE — inside auth, above terms, above the chrome. Above terms because it is
          about the person rather than the product, and a person should not have to accept
          OneJob's terms before being asked whether their face should unlock their phone. Inside
          auth because there is no person to ask until sign-in has happened.

          The product's hue is already applied by the time this paints, so the aurora behind it
          is OneJob's green or OneScore's amber for free. Identical screen, different light. */}
      <MaybeSetup skip={skipSetup}>
      <MaybeTerms skip={skipTerms} config={config} t={t}>
        {/* ── `bare`: A ONE WORLD SURFACE, NOT A PRODUCT SURFACE ─────────────────────────
            The bare origin renders Your World, and with the normal chrome it did so under
            OneJob's green header and OneJob's five tabs — "One World. Your World." sitting
            beneath a wordmark that says GET HIRED · GET PAID. That is not a small mismatch: the
            origin is the one screen whose whole job is to say the products are one company, and
            it was wearing one product's clothes.

            A neutral chrome is the real answer and it needs a One World mark, a hue and a
            config — that belongs to the hub thread, which is already scoped to build it. Until
            then, showing NO product chrome is strictly better than showing the WRONG product's:
            nothing on the screen makes a claim that is untrue.

            Safe because this surface carries its own way forward — Your World has a Sign in
            control when signed out and a row per product when signed in — so removing the
            header does not strand anybody. Product routes are untouched; they never pass this. */}
        {bare
          ? <div className="min-h-screen"><main className="mx-auto max-w-lg px-4 py-6">{children}</main></div>
          : <Chrome config={config} badges={badges} rightSlot={rightSlot}>{children}</Chrome>}
      </MaybeTerms>
      </MaybeSetup>
    </AuthGate>
  );
}

/**
 * Runs the one-time account setup, then gets out of the way permanently.
 *
 * A separate component rather than an inline branch because it needs `useOneId`, and that hook
 * only has an answer INSIDE `AuthGate` — reading it in `AppShell` itself would ask before the
 * provider had loaded and always say "no user".
 */
function MaybeSetup({ skip, children }: { skip?: boolean; children: React.ReactNode }) {
  const { userId, loading } = useOneId();
  const location = useLocation();
  const [pending, setPending] = useState(() => needsAccountSetup(userId));
  const [requiredProfile, setRequiredProfile] = useState<"loading" | "required" | "complete" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => { setPending(needsAccountSetup(userId)); }, [userId]);
  /* ── v23 CM (Lee's UAT, 18 Aug 2026): two cases where this interstitial chain must NOT fire ──
     1. ADMIN VIEW-AS: the session is a borrowed account. Enrolling biometrics / stay-signed-in
        / notifications would bind the IMPERSONATED account to the admin's device — and it
        hijacked the admin's navigation three screens deep mid-UAT.
     2. MID-TASK DEEP LINKS: someone opening an apply link, a guest ticket, or a manager invite
        is mid-task — three enrollment screens before the thing they tapped is a conversion
        killer. Deferred (not stamped): it shows next time they land on a normal surface. */
  const impersonating = typeof window !== "undefined" && !!sessionStorage.getItem("ow_real_admin_id");
  const setupDeepLink = typeof window !== "undefined" &&
    /\/events\/(e\/|gt\/|manage-invite\/|join-express)/.test(window.location.pathname);
  /* Do not replace an active short account task. Ticket Express is fully exempt at the server;
     OneHome's review route is only deferred long enough to finish account claim + walkthrough. */
  const shortAccountHandoff = typeof window !== "undefined" && (
    /\/events\/(join-express(?:\/|$)|e\/[^/]+\/checkout(?:\/|$))/.test(window.location.pathname) ||
    /\/rentals\/review\/[0-9a-f]{48}\/?$/i.test(window.location.pathname)
  );

  /* The required identity profile is checked on the server. localStorage can still remember the
     optional biometrics/notification tour, but it cannot decide whether a NEW account supplied
     phone and location. Existing profiles are grandfathered by a NULL required version.
     Ticket Express profiles are exempt from the full standard profile by the server status
     contract; checkout itself still requires their phone before payment. */
  useEffect(() => {
    if (skip || impersonating || shortAccountHandoff || loading || !userId) return;
    let alive = true;
    setRequiredProfile("loading");
    void supabase.rpc("my_onboarding_status" as any).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setRequiredProfile("error"); return; }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { setRequiredProfile("error"); return; }
      setRequiredProfile(row?.is_required && !row?.is_complete ? "required" : "complete");
    });
    return () => { alive = false; };
  }, [skip, impersonating, shortAccountHandoff, loading, userId, retry]);

  if (impersonating || shortAccountHandoff) return <>{children}</>;
  /* ── THE SIGN-UP WIZARD OWNS ONBOARDING; DO NOT HIJACK IT ─────────────────────────────────
     Lee UAT, 7 Aug 2026: creating an account jumped straight to biometrics and SKIPPED name,
     location and password. Root cause: the `/join` wizard signs the person in at the email-code
     step, and the instant `userId` appears this gate replaced the still-running wizard with the
     AccountSetup screen — so the remaining identity steps never rendered. `/join` passes `skip`, runs every step
     itself, and finishes with a full navigation to `/yourworld`, where THIS gate then shows the
     biometrics/stay-signed-in/notifications screens once — profile details first, setup after. */
  if (skip || loading || !userId) return <>{children}</>;
  if (requiredProfile === "loading") {
    return <div className="mx-auto w-full max-w-sm py-16 text-center text-sm opacity-50">Checking your One ID…</div>;
  }
  if (requiredProfile === "error") {
    return (
      <div className="mx-auto grid min-h-[70dvh] max-w-sm place-items-center px-5 text-center">
        <div>
          <h1 className="text-xl font-extrabold">We couldn’t check your One ID</h1>
          <p className="mt-2 text-sm opacity-65">Your account is safe. Check your connection and try again.</p>
          <button onClick={() => setRetry((n) => n + 1)} className="ow-tap btn-primary mt-5 w-full rounded-2xl py-3.5 text-sm font-bold">Try again</button>
        </div>
      </div>
    );
  }
  if (requiredProfile === "required") {
    const next = `${location.pathname}${location.search}${location.hash}` || "/yourworld";
    return <SignUp next={next} />;
  }
  if (setupDeepLink) return <>{children}</>;
  if (!pending) return <>{children}</>;
  return <AccountSetup onDone={() => setPending(false)} />;
}

/** Renders the product's terms gate, or nothing at all on a shared One World surface. */
function MaybeTerms({ skip, config, t, children }: {
  skip?: boolean; config: AppConfig; t: (k: string) => string; children: React.ReactNode;
}) {
  /* ── PER-APP TERMS REMOVED — Lee, 7 Aug 2026 (CEO ruling) ──────────────────────────────────
     *"When someone selects the Terms & Conditions during the World onboarding, that's it — they
     don't have any additional Terms per application. All terms are rolled under the one Terms &
     Conditions you accept during onboarding."* So no product shows a second terms gate; this
     always renders through.

     Opening a product still CONNECTS it — that is what the old terms-accept did via claimProduct,
     and dropping it would silently break the switcher's "Connected" state and product membership.
     So the connect is preserved here, just without the second consent wall; opening a product is
     the intent to use it, and the consent basis is the single onboarding agreement.

     ⚠️ MAX / COUNSEL, before this is the final word:
       1. The onboarding Terms doc must ENCOMPASS every product's schedule (how funds are held, the
          One World Labs fee, when OneJob charges, OneVoice call recording, OneScore publishing).
       2. OneVoice's per-call recording ANNOUNCEMENT is still required for the other party's
          consent — this gate never was that, and its removal doesn't change that obligation. */
  void skip; void t;
  const { userId, has, claimProduct } = useOneId();
  /* ── CONNECT THE APP, NOT THE SECTION ──────────────────────────────────────────────────────
     `config.entitlement ?? config.key` — see `AppConfig.entitlement`. Opening `/rentals` or
     `/sales` both grant the single `onehome` row, so a member turns OneHome on once and off once.
     Every other product is unaffected: with no `entitlement` declared this is `config.key`,
     which is exactly what it was. */
  const ent = config.entitlement ?? config.key;
  useEffect(() => {
    if (userId && ent && !has(ent)) void claimProduct(ent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ent]);
  return <>{children}</>;
}

/**
 * Public by default, everywhere.
 *
 * `/p/:id` is a person's public profile and `/contract/:token` is a document a client was sent —
 * both are meant to be opened by strangers, and both are minted as absolute links by
 * `hireLink()` / `contractLink()` precisely so they can leave the app. `/switch` is the product
 * switcher; a signed-out visitor who lands there should see what One World is, not a wall.
 *
 * A product can replace this list, but it should think hard before shortening it.
 */
const DEFAULT_PUBLIC: (string | RegExp)[] = [
  /* Fixture-only visual review. DEV is statically false in the production build. */
  ...(import.meta.env.DEV ? [/^\/admin$/] : []),
  /^\/[a-z]+\/p\//, /^\/[a-z]+\/hire\//, /^\/[a-z]+\/contract\//,
  /* `/<product>/apply/<token>` — a renter's QR, scanned by an agent at a viewing.
     The token IS the authorisation (see `renter_profile_by_token`), and it is revocable by the
     renter. Putting a sign-in wall in front of it would mean the code only works for people who
     already have an account, which is nobody at the moment somebody hands you a phone. Anchored,
     and requiring a non-empty segment after `apply/`, so it opens exactly this shape and no
     other. */
  /^\/[a-z]+\/apply\/[^/]+$/,
  /* `/switch` — THE COMMENT ABOVE CLAIMED THIS AND THE ARRAY DID NOT CONTAIN IT.
     A signed-out visitor at Your World got OneJob's "Get hired. Get paid." splash instead, which
     is exactly what Lee hit twice: at the bare origin, and again after signing out. A doc comment
     describing behaviour the code does not have is worse than no comment, because it stops the
     next person checking.

     ANCHORED REGEXES, NOT STRINGS. `publicPaths` matches strings with `startsWith`, so the entry
     "/switch" would also open "/switcheroo" and "/" would open THE ENTIRE APP. These two are the
     shared One World surfaces and they are exactly two paths, so they are pinned to exactly two
     paths. */
  /^\/(switch|yourworld)$/,
  /* Root renders Your World, which decides for itself what to show a signed-out visitor. Without
     this it inherited OneJob's splash, which is the bare-origin bug in its second form: fixing
     the ROUTE was not enough while the GATE in front of it still had an opinion. */
  /^\/$/,
];

export default function AppShell({
  config,
  badges,
  rightSlot,
  publicPaths,
  bare,
  skipTerms,
  skipSetup,
  children,
}: {
  config: AppConfig;
  /** Per-tab counts, keyed by the tab's path. The product owns its own counting. */
  badges?: Record<string, number>;
  /** Header slot, LEFT of the flag. A notification bell and nothing structural. */
  rightSlot?: React.ReactNode;
  /** Paths a signed-out stranger may open. Defaults to public profiles, hire links, contracts. */
  publicPaths?: (string | RegExp)[];
  /**
   * Render WITHOUT the product header and footer — providers, gates and hue only.
   *
   * For the shared One World surfaces (the bare origin) where a product's chrome would tell the
   * person they are somewhere they are not. Never for a product route.
   */
  bare?: boolean;
  /**
   * Skip the product terms gate. For shared One World surfaces only — Your World and the bare
   * origin belong to no product, so there is no document for them to gate on, and accepting one
   * from a menu would grant a product the person never opened.
   */
  skipTerms?: boolean;
  /**
   * Skip the one-time AccountSetup interstitial (biometrics / stay-signed-in / notifications).
   * ONLY for the `/join` sign-up wizard, which runs its OWN multi-step onboarding after sign-in
   * and must not be replaced mid-flow. It finishes with a navigation to `/yourworld`, where the
   * interstitial then shows once. Without this, creating an account skips name/profession/location/password.
   */
  skipSetup?: boolean;
  /** Screens, if the product is not using nested routes. */
  children?: React.ReactNode;
}) {
  /* Fail loudly at startup rather than shipping a shell that quietly differs. Every rule
     `assertConfig` checks has already been broken once in this codebase, and each is invisible
     until someone notices the products feel different — which is the exact failure this package
     exists to prevent. A thrown error in development is cheap; eight products that drifted for
     a month is not. */
  assertConfig(config);

  /* THE HUE, BEFORE THE BROWSER PAINTS.
     `useLayoutEffect` runs after render and BEFORE paint, which is exactly the window this needs:
     a plain `useEffect` paints the placeholder grey first and flashes, and calling `applyHue` in
     the render body is a DOM side effect during render — a rules-of-React violation that runs
     again on every re-render for no reason. */
  useLayoutEffect(() => { applyHue(config.hue); }, [config.hue]);

  return (
    <ThemeProvider>
      <I18nProvider dict={config.dictionary} defaultLang={config.defaultLang}>
        <OneIdProvider app={config.key}>
          <Gated config={config} badges={badges} rightSlot={rightSlot} publicPaths={publicPaths} bare={bare} skipTerms={skipTerms} skipSetup={skipSetup}>
            {children}
          </Gated>
        </OneIdProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

/** Re-exported so a product can branch on it without re-deriving the list. */
export { IS_SERVICE };
