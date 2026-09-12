import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { safeAuthReturn, signUpHref } from "../lib/authReturn";
import Wordmark from "./Wordmark";
import Avatar from "./Avatar";
import { NavIcon } from "./NavIcons";
import { useI18n } from "../lib/i18n";
import { shellControlCopy } from "../lib/controlCopy";
import { useTheme } from "../lib/theme";
import { useOneId } from "../lib/oneId";
import { useIsAdmin } from "../lib/useIsAdmin";
import AdminViewAs from "./AdminViewAs";
import { productHref } from "../routes";
import { PRODUCT_BRAND, ONE_WORLD_DOT, HUB, CONSUMER_APPS, SERVICES, launcherKey, appDoorway,
  type AppKey } from "../lib/oneWorld";
import type { AppConfig } from "../config";


/** "Edit profile", per language — same local-map reason as DELETE_ACCOUNT_LABEL above. */

/**
 * THE HAMBURGER DRAWER — identical in all eight products. No exceptions, no props to bend it.
 * ============================================================================================
 * Lee, 3 Aug 2026: *"the header needs to be the same, the hamburger icon needs to reflect the
 * same information… the footer information is going to vary depending on the app."*
 *
 * That split is the right one and it is worth naming why, because the temptation to "just add
 * one thing here for this app" will come up:
 *
 *   The header and the drawer are how someone knows WHERE THEY ARE and HOW TO LEAVE. Those must
 *   never differ, or eight products stop reading as one company. The footer is how someone DOES
 *   THE WORK of this particular product, and the work genuinely differs — OneJob has five things
 *   you do, OneVoice has one dashboard you look at.
 *
 * So this component takes the config and reads from it; it never takes a "variant".
 *
 * ── The sibling list ────────────────────────────────────────────────────────────────────────
 * Lee, 2 Aug 2026: the drawer *"needs to be updated with the proper links… they all need to look
 * exactly the same"* on every product. OneSocial and OneAgent were missing from OneJob's drawer
 * entirely, which is why the drawer could not be used to reach OneSocial at all.
 *
 * Every product lists all the OTHERS plus the hub. A product never lists itself — you cannot
 * navigate to where you already are, and a dead row in a menu teaches people the menu is
 * unreliable.
 *
 * The links are PATHS, not hostnames. Everything is served from one origin, so a sibling is a
 * route; a hostname would walk an installed-app user out into a browser tab.
 */

export default function Drawer({
  config, open, onClose,
}: { config: AppConfig; open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const copy = shellControlCopy(lang);
  const { theme, toggle } = useTheme();
  const { userId, email, displayName, photoUrl, jobTitle, primary, signOutEverywhere, signOutError } = useOneId();
  const navigate = useNavigate();
  const location = useLocation();
  const authNext = safeAuthReturn(location.pathname === "/" ? "/yourworld" : location.pathname + location.search + location.hash);
  /* ONE admin check for the whole shell — see useIsAdmin. */
  const isAdmin = useIsAdmin();
  /**
   * WHICH GROUP IS OPEN — one at a time, and neither by default.
   *
   * Lee, 4 Aug 2026: *"the hamburger menu is still long because it has those eight or nine or ten
   * buttons in it... I'm thinking we can collapse the apps and the services into two expandable
   * sections. When they click open that drawer they don't have such a long list that overwhelms
   * them... So you can't see both at the same time. That's gonna help keep the options limited in
   * their mind at one time."*
   *
   * He is right, and the count is worse than he said: seven siblings plus Your World plus One
   * World is NINE coloured rows, under a settings list, in a 218px column. To someone who joined
   * three minutes ago through a jobs advert, eight of those nine are unexplained brand names in
   * unexplained colours. A menu whose job is "where am I and how do I leave" was answering a
   * question nobody asked, at length.
   *
   * Accordion rather than two independent toggles — opening one closes the other — so the drawer
   * can never grow back to the list this replaces.
   *
   * ── APPS OPENS EXPANDED. FOR EVERYONE. ──────────────────────────────────────────────────────
   * Lee, 10 Aug 2026: *"I want the hamburger drawer to automatically be expanded for the apps by
   * default for everyone. So that's just a shell requirement, not just me — that means everyone.
   * When they click the hamburger icon and they see the drawer, it should automatically have the
   * other apps expanded, and they could collapse it if they want to."*
   *
   * So the initial state is `"apps"`, not `null`. The accordion behaviour is untouched: opening
   * Services still closes Apps, and tapping Apps still collapses it — the person can put it back
   * exactly as before, which is the half of Lee's instruction that is easy to drop.
   *
   * Two things this deliberately is NOT:
   *   · It is not remembered. `useState` re-initialises every time the drawer mounts, so EVERY
   *     open starts expanded — "for everyone", every time, which is what was asked. Persisting a
   *     collapse would quietly re-create the old behaviour for the people who tapped it once.
   *   · It is not a per-product choice. This is the shell, and the drawer is one of the two
   *     surfaces (with the header) that may never differ between products.
   *
   * The cost Lee's 4 Aug note was guarding against — an overwhelming list — is smaller than it
   * was: the app rows went from seven to SIX when OneHome stopped being counted twice, and the
   * current product never lists itself, so it is five rows under a heading, not nine.
   */
  const [group, setGroup] = useState<"apps" | "services" | null>("apps");

  if (!open) return null;

  /* The drawer is the REFERENCE surface for glass in the family — everything else is measured
     against it. A specular highlight along the top edge, then the fill.

     THE FILL IS `--overlay-bg`, NOT A HARD-CODED GRADIENT. The version this replaces ran
     84% → 74% in light mode, so below the specular band the drawer was 74% opaque and the page
     read through the menu. Lee, 2 Aug 2026: *"it needs to be translucent, but still dark enough
     to read without being disturbed by the translucency."* 88% is the floor and the token is
     97%. Extracting the old gradient verbatim would have propagated one product's bug to eight. */
  const drawerGlass = theme === "dark"
    ? "linear-gradient(152deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,0) 46%), var(--overlay-bg)"
    : "linear-gradient(152deg, rgba(255,255,255,.58) 0%, rgba(255,255,255,0) 46%), var(--overlay-bg)";

  const Row = ({ to, icon, label }: { to: string; icon: string; label: string }) => (
    <Link to={to} onClick={onClose}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition hover:bg-brand/10">
      <NavIcon name={icon} className="opacity-70" /><span className="truncate">{label}</span>
    </Link>
  );

  /* ── THE DRAWER SHOWS WHAT THE FOOTER CANNOT ────────────────────────────────────────────
     Lee, 3 Aug 2026: *"I'm on OneJob, and when I open the hamburger drawer it says home, my
     jobs, start a job, messages, profile. All of that is already down at the bottom. They
     wouldn't need to open the drawer to see those same items."*

     He is right, and the rule falls straight out of it: **a drawer row must earn its place by
     going somewhere the footer cannot reach.** Repeating the tabs makes the list twice as long
     as it needs to be and teaches people that the drawer is where they already were.

     Filtered by destination rather than by list, so a product that promotes a drawer item into
     the footer automatically stops showing it twice — nobody has to remember to remove it.

     This self-corrects for services too: OneVoice has three tabs, so three fewer rows here. A
     product with NO tabs shows everything, which is also correct — nothing is being duplicated. */
  const inFooter = new Set(config.tabs.map(t => t.to));
  const own = config.drawerExtras.filter(i => !inFooter.has(i.to));

  /* ── EVERYONE EXCEPT ME — and "me" means the APP, not the shell I happen to be mounted in ──
     Lee, 11 Aug 2026: *"I still see that it says the one home and for rent, and that's not the
     case. It's just one home. And plus if you're already at one home, that option shouldn't even
     be in your hamburger drawer anyway because you're already on that app… the hamburger drawer
     only shows the OTHER apps."*

     Two faults, one line. This read `Object.keys(PRODUCT_BRAND)`, which is the ELEVEN-key union —
     six apps, three services AND the two OneHome sections. So the drawer painted "For rent" and
     "For sale" as their own rows beside OneHome: one app listed three times, which is precisely
     the thing `CONSUMER_APPS` exists to stop. `PRODUCT_BRAND` is a lookup table for NAMES; it was
     never the list of what a member picks between, and using it as one made the launcher inherit
     every key anybody ever needed a label for.

     Second: standing inside `/rentals`, `config.key` is `onerental`, so filtering on it removed a
     row that was never shown and left OneHome — the app you are already standing in — in the
     list. `launcherKey()` is the normaliser for exactly this, and it is why it exists.

     Iterate the two CANONICAL lists and exclude the app you are in. A tenth product joins every
     drawer by being added to `CONSUMER_APPS` or `SERVICES`, and a new SECTION of an existing app
     can never leak into a launcher again. */
  const here = launcherKey(config.key);
  const siblingApps = CONSUMER_APPS.filter(k => k !== here) as AppKey[];
  const siblingServices = SERVICES.filter(k => k !== here) as AppKey[];

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      {/* NEUTRAL SELECTION INK. This was rgba(28,14,52) — a violet-black left over from a
          pre-green build, which is what tinted OneJob's Create Contract screen. The scrim sits
          over every colour in the family, so it must never carry a hue of its own. */}
      <div className="absolute inset-0"
        style={{ background: "rgba(11,15,26,.42)", backdropFilter: "blur(2px)" }}
        onClick={onClose} />

      {/* ── HEIGHT IS `dvh`, NOT `vh`. THIS IS WHY SIGN OUT WAS UNREACHABLE ──────────────────
          On a mobile browser `100vh` is the LARGE viewport — the height the page would have if
          the URL bar were collapsed — so it is TALLER than what is actually on screen. The drawer
          therefore measured itself as fitting, never turned on its scrollbar, and quietly put its
          last row (sign out) underneath the browser chrome. Nothing looked broken; the row simply
          was not there.

          `100dvh` is the DYNAMIC viewport — what is visible right now.

          The fallback is expressed as a CLASS (`vh`) overridden by an inline STYLE (`dvh`), NOT
          as two keys in one style object — a JS object cannot hold the same key twice, so the
          usual CSS two-declaration fallback silently collapses to whichever line is written last
          and the older browser gets nothing. Inline style beats class, so this cascades properly
          in both directions.

          Belt and braces: the sign-out block below is also `sticky bottom-0`, so even if a future
          product adds enough rows to overflow a tall desktop window, the one control a person
          most needs to find stays pinned in view. */}
      <nav className="absolute right-3 top-3 flex max-h-[calc(100vh-24px)] w-[218px] max-w-[76vw] flex-col overflow-y-auto overscroll-contain rounded-3xl border border-white/40 p-3 shadow-2xl dark:border-white/10"
        style={{
          maxHeight: "calc(100dvh - 24px)",
          background: drawerGlass,
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          /* The drop shadow takes the product's hue, at low alpha. It is the only place in the
             drawer that does — everything else here is deliberately family-neutral. */
          boxShadow: "var(--frostedge), 0 26px 70px rgba(7,12,20,.30)",
        }}>

        <div className="mb-2 flex items-center justify-between">
          {userId ? (
            <Link to={`${productHref(config.key)}/profile`} onClick={onClose}
              className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar src={photoUrl} name={displayName} size={32} rounded="rounded-full" textSize="text-xs" />
              <div className="min-w-0">
                {/* FIRST NAME ONLY. At 218px, beside an avatar and two buttons, there is room
                    for one word — and a drawer is a greeting, not an identity document. The
                    full name lives on the profile, one tap away.

                    This rendered the literal word "Menu" in the first cut, because the identity
                    context carried no name at all to render. Both halves are fixed: `useOneId`
                    now reads the shared `profiles` row, and this takes the first word of it. */}
                <p className="truncate text-[13px] font-bold leading-tight">
                  {(displayName ?? "").trim().split(/\s+/).filter(Boolean)[0] ?? t("profile")}
                </p>
                <p className="truncate text-[11px] opacity-50">{jobTitle ?? email}</p>
              </div>
            </Link>
          ) : <Wordmark wordmark={config.wordmark} h={26} />}

          <div className="flex shrink-0 items-center gap-1">
            {/* Light/dark MOVED into the list below. Lee, 3 Aug 2026: *"we could even put the
                light and dark mode there in the list too, so it doesn't have to be so close to
                the X."* Two small circular controls sitting side by side is a mis-tap waiting to
                happen — one closes the drawer, the other repaints the entire app, and at 28px
                they are a thumb-width apart. Only the close button lives up here now. */}
            <button onClick={onClose}
              className="ow-tap grid h-7 w-7 place-items-center rounded-full border border-ink/10 text-base dark:border-white/15"
              aria-label={t("close")}>×</button>
          </div>
        </div>

        <div className="space-y-0.5">
          {userId ? (<>
            {/* v16 (Lee, 18 Aug 2026): light/dark FIRST, then the app's own rows (Calendar,
                Settings) — "the light and dark mode should be at the top, then calendar,
                then settings." Shell-level, so every product orders the same way. */}
            <button onClick={() => { toggle(); onClose(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition hover:bg-brand/10">
              {theme === "light" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 opacity-70" aria-hidden>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 opacity-70" aria-hidden>
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
                </svg>
              )}
              <span>{theme === "light" ? copy.darkMode : copy.lightMode}</span>
            </button>
            {own.map(i => <Row key={i.to} to={i.to} icon={i.icon} label={t(i.labelKey)} />)}
          </>) : (<>
            <Row to={"/signin?next=" + encodeURIComponent(authNext)} icon="signin" label={t("signin")} />
            <Link to={signUpHref(authNext)} onClick={onClose}
              className="block rounded-xl bg-clay px-3 py-2.5 text-center font-semibold text-white">
              {t("join")}
            </Link>
          </>)}
        </div>

        <div className="my-3 h-px bg-ink/10 dark:bg-white/10" />

        {/* ── TWO GROUPS, NOT NINE ROWS ────────────────────────────────────────────────────
            THE WORDS: "Apps" and "Services", not "Work" and "Services".

            Lee asked the question himself — *"do we use work and services? Or credibility and
            services? Or trust, maybe work?"* — and invited a push-back, so here it is.

            **Work does not cover them.** OneSocial is a network, OneScore is a reputation, and
            neither is work. Somebody looking for their profile would not open a drawer marked
            Work to find it. The moment one item in a group does not belong to the label, the
            label stops being navigation and becomes a riddle.

            **Apps / Services is already the company's own split**, in three places that all
            agree: the hub's own menu uses exactly these two headings; the splash Lee approved
            says "apps you use and services we run for you"; and the strapline says "six apps ·
            three services". Inventing a fourth vocabulary here would put the drawer at odds with
            the marketing site on the one screen whose job is orientation.

            **And it is the distinction that actually matters to a person.** An app is something
            you open and do; a service is something that runs whether or not you open it. That is
            also exactly where the money model changes — apps are free, services are paid — so
            the two halves of the drawer quietly teach the pricing without a word about pricing.

            Credibility and trust are the right words for OneScore's marketing. They are not
            group labels: they describe one product, not five. */}
        <Group
          label={copy.apps} hint={copy.appsHint}
          items={siblingApps}
          open={group === "apps"} onToggle={() => setGroup(g => g === "apps" ? null : "apps")}
          onClose={onClose} />
        <Group
          label={copy.services} hint={copy.servicesHint}
          items={siblingServices}
          open={group === "services"} onToggle={() => setGroup(g => g === "services" ? null : "services")}
          onClose={onClose} />

        <div className="my-3 h-px bg-ink/10 dark:bg-white/10" />

        {/* These two stay OUT of the groups and stay visible. They are not products — they are
            "everything of mine" and "everything there is" — and burying the way back to your own
            page inside an accordion labelled Apps would be the same mistake one level down. */}
        <div className="space-y-0.5">
          {/* YOUR WORLD — the person's own page. What THEY have, and it grows.
              Lee, 3 Aug 2026: *"one world, your world — I think that's the right line."* */}
          <Link to="/yourworld" onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-brand/10">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ONE_WORLD_DOT }} />
            {copy.yourWorld}
          </Link>
          {/* ONE WORLD — the parent page. Everything, not just what this person holds.
              Named "One World", not "One World Labs": Lee, 3 Aug — *"that should just say One
              World."* That naming stands and is not being changed here.

              ⚠️ BUT ON 16 AUGUST LEE SAID THERE WAS NO LINK TO THE WEBSITE IN THE DRAWER, AND
              THIS IS IT. The row was here the whole time, pointing at the right hostname. He had
              been in this drawer and not recognised it — because "One World" beside a hollow dot,
              sitting between "Your World" and "Admin", reads as another internal screen. Nothing
              on it says it opens a website.

              A link somebody cannot recognise is a link that does not exist, so the row keeps its
              name and gains the same outward arrow the service rows now carry. One glyph, one
              meaning, everywhere in this drawer: this leaves the app. */}
          <a href={HUB} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-brand/10">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-current opacity-50" />
            <span className="min-w-0 flex-1">One World</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
              className="shrink-0 opacity-40">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <path d="M15 3h6v6" /><path d="M10 14 21 3" />
            </svg>
          </a>
          {/* ── ADMIN — restored 10 Aug 2026 (§4.4). It disappeared from the hamburger and Lee
                 noticed. The gate is `useIsAdmin()`: ONE check, in the shell, answered by the
                 database's `is_platform_admin()` — no email literal in any component, and every
                 admin RPC re-checks server-side, so showing this row is a courtesy and never the
                 permission. */}
          {isAdmin && (
            <Link to="/admin" onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-brand/10">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
              {copy.admin}
            </Link>
          )}
          {/* v15 (Lee): "View as user" — the OneSocial impersonation, ported. The component
              renders nothing for non-admins; while impersonating it shows only the
              "Return to my account" row so Lee always has the way back. */}
          <AdminViewAs onClose={onClose} />
        </div>

        {userId && (
          /* PINNED. Sticky to the bottom of the scroll box and given the drawer's own fill, so it
             never scrolls out of reach and never has other rows showing through it. */
          <div className="sticky bottom-0 -mx-3 -mb-3 mt-3 px-3 pb-3 pt-0"
               style={{ background: drawerGlass }}>
            <div className="mb-2 h-px bg-ink/10 dark:bg-white/10" />
            {/* GLOBAL sign-out. `signOutEverywhere` revokes every refresh token on the SERVER,
                not just this device's — clearing the local session alone leaves live sessions
                behind, and with one identity across eight products that is the whole estate.

                ── AND THEN IT GOES SOMEWHERE ────────────────────────────────────────────────
                Signing out used to leave the person exactly where they stood, which meant the
                last thing they saw after leaving the ecosystem was ONE PRODUCT'S sales pitch —
                "Get hired. Get paid." — as though OneJob were the thing they had just left.
                Lee, 3 Aug 2026, on his own sign-out test: it should land on a global signed-out
                One World state, not the last app's splash.

                ── AND "SOMEWHERE" IS THEIR OWN PRODUCT ──────────────────────────────────────
                Lee, 4 Aug 2026: *"if you downloaded the app in OneJob and you log out of OneJob,
                you should be brought to the splash screen for OneJob. So the system needs to know
                what their primary download was, and it takes them there."*

                So sign-out goes to HOME — `profiles.signup_app`, which the member can change —
                and that route renders its own splash because they are now signed out. Somebody
                with no home recorded goes to the origin, which shows the One World splash.

                It deliberately does NOT go to the product they happen to be standing in. Someone
                who wandered from OneJob into OneEvent and signed out there is still a OneJob
                person; landing them on an events pitch would be the app forgetting who they are.

                `replace` so the back button cannot walk into a session that no longer exists. */}
            <button onClick={async () => {
              /* OneHome is a deliberate product context. Keep its signed-out landing page so a
                 member who signs out and back in here does not get redirected into OneEvent just
                 because that older product is recorded as their primary download. */
              const home = launcherKey(config.key) === "onehome"
                ? productHref(config.key)
                : primary ? productHref(primary) : "/";
              if (await signOutEverywhere()) { onClose(); navigate(home, { replace: true }); }
            }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-red-500 hover:bg-red-500/10">
              <NavIcon name="signout" className="opacity-70" /><span>{t("signout")}</span>
            </button>
            {signOutError && <p role="alert" className="px-3 pt-2 text-xs leading-relaxed text-red-500">{signOutError}</p>}
            {/* v16 (Lee): Edit profile and Delete account are SETTINGS features — both live
                on the Settings screen (delete stays in-app for App Store 5.1.1(v)); the drawer
                keeps only Sign out down here. */}
          </div>
        )}
      </nav>
    </div>,
    document.body
  );
}

/**
 * A COLLAPSED GROUP OF SIBLING PRODUCTS.
 *
 * A real `<button>` with `aria-expanded`, not a `<details>`: the drawer needs the accordion
 * behaviour (opening one closes the other), and `<details>` cannot be told to close by a sibling
 * without fighting it.
 */
function Group({ label, hint, items, open, onToggle, onClose }: {
  label: string; hint: string; items: AppKey[];
  open: boolean; onToggle: () => void; onClose: () => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <button onClick={onToggle} aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-brand/10">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-tight">{label}</span>
          <span className="block whitespace-normal text-[11px] leading-snug opacity-45">{hint}</span>
        </span>
        <span className="text-[11px] font-bold tabular-nums opacity-40">{items.length}</span>
        {/* The chevron rotates rather than swapping glyph — a control that changes shape reads as
            a different control. */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className={`shrink-0 opacity-45 transition-transform ${open ? "rotate-90" : ""}`}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div className="ml-1 space-y-0.5 border-l border-ink/10 pb-1 pl-2 dark:border-white/10">
          {/* ── ⚠️ AN APP IS A ROUTE. A SERVICE IS A WEBSITE. ────────────────────────────────
              This renderer was handing every row a `productHref`, so tapping OneVoice or OnePage
              walked into `/voice` or `/page` — shell routes with nothing behind them but the
              placeholder card reading *"The shell is live on this route. The screen itself lands
              in this product's own thread."* Lee photographed it. It is the MediaWall rule again:
              a row that looks like a product and lands on a placeholder is a dead control.

              The three services are not unbuilt apps. They are marketing and a checkout, and a
              OneVoice customer's actual dashboard is a different system with its own login. There
              is no signed-in screen for the shell to show, and the copy changes weekly — in here
              that is a deploy per price change, on the website it is a push.

              `appDoorway()` has existed in `lib/oneWorld.ts` since the beginning and returns the
              product's real hostname. It was simply never wired to this list. The architecture
              already calls these doorways rather than deployments; this makes the drawer agree.

              `target="_blank"` so the app is never replaced. Inside the native wrapper this is the
              hook an in-app browser attaches to, so the page opens over the app with a Done button
              rather than ejecting anybody — the same thing Airbnb and Uber do for a help centre. */}
          {items.map(k => {
            const isService = (SERVICES as readonly string[]).includes(k);
            const dot = <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRODUCT_BRAND[k].dot }} />;
            const cls = "flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] font-medium hover:bg-brand/10";
            return isService ? (
              <a key={k} href={appDoorway(k)} target="_blank" rel="noreferrer" onClick={onClose} className={cls}>
                {dot}
                <span className="min-w-0 flex-1">{PRODUCT_BRAND[k].name}</span>
                {/* The outward arrow is the promise that this leaves the app. A row that opens a
                    new tab with no warning reads as the app having crashed. */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                  className="shrink-0 opacity-40">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <path d="M15 3h6v6" /><path d="M10 14 21 3" />
                </svg>
              </a>
            ) : (
              <Link key={k} to={productHref(k)} onClick={onClose} className={cls}>
                {dot}
                {PRODUCT_BRAND[k].name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
