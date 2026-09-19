import { useMemo, useRef, useState } from "react";
import { useI18n, W } from "../lib/i18n";
import { sc } from "../lib/shellCopy";
import { useOneId, type Product } from "../lib/oneId";
import { Link } from "react-router-dom";
import { productHref, IS_SERVICE, COMING_SOON } from "../routes";
import { accessState } from "../lib/accessState";
import { PRODUCT_BRAND } from "../lib/oneWorld";
import { usePrimaryMirror } from "./OneWorldEntry";
import { personalWorldTitle } from "../lib/personalWorld";
import Wordmark from "../components/Wordmark";
import { useNavigate } from "react-router-dom";

/**
 * THE ONE WORLD SWITCHER — a corner affordance, never a destination.
 *
 * RENAMED AND RE-SCOPED 3 Aug 2026 after research into how the multi-product companies
 * actually solve this. I first built it as a "home" screen. That was wrong, and the
 * correction is specific enough to be worth recording.
 * ============================================================================================
 *
 * Lee, 3 August 2026, thinking through the one-app model:
 *
 *   "The concern I have is that people are downloading One World and they only need one service.
 *    They only need the job piece. So how do they navigate to that without having to be burdened
 *    by seeing all this stuff?… If that home screen with the five apps doesn't look correct,
 *    users are gonna be overwhelmed. They're gonna go, okay, what am I doing? Am I trying to get
 *    a job? Am I trying to get an event?… Do we let them pick the app and then create the
 *    account, or do they create the account and then pick the app? We gotta decide."
 *
 * ── The decision: NEITHER. The chooser is not the first screen at all. ──────────────────────
 *
 * Both orderings share a hidden assumption — that the person arrives without an intent and we
 * have to help them form one. They don't. They clicked an advert that said "get hired and get
 * paid". Nobody has ever clicked an advert that said "One World".
 *
 * So a five-box chooser at first launch asks someone to re-make a decision they made BEFORE
 * they downloaded. That is precisely the "what am I doing?" moment Lee is worried about, and
 * putting it on screen one is how you manufacture it.
 *
 * **The install link carries the intent.** Someone who came from a OneJob advert opens straight
 * into OneJob, exactly as it was built. They never meet a chooser. If the intent genuinely is
 * unknown — a direct visit to the hub with no campaign attached — THEN this screen runs, once,
 * as a single question.
 *
 * The other products are DISCOVERED later, in context, at the moment they become relevant:
 * "this job pays through the Vault", "your OneScore is 70 — here's what moves it". That is a
 * far stronger cross-sell than a wall of boxes, because it arrives with a reason attached.
 *
 * ── Where the account creation goes: at the moment of value, not before it ──────────────────
 *
 * Neither "pick then create" nor "create then pick". Let them look first. Browsing jobs, events
 * and profiles needs no account, and every marketplace that converts well works this way. The
 * account is asked for at the first action that genuinely requires one — apply, post, message,
 * see your own score. At that moment the person has already seen why it is worth it, which is
 * the only moment a sign-up form is cheap.
 *
 * That also disposes of Lee's other worry — *"people will be creating an account and they don't
 * even know which app they're in"* — because by then they have been using one app for several
 * minutes and are creating the account in order to do a specific thing in it.
 *
 * ── What the research changed ───────────────────────────────────────────────────────────────
 *
 * Google: gmail.com opens the inbox. Signed out it renders "Sign in — to continue to Gmail",
 * Google wordmark small, product name large. The waffle grid is a corner affordance. There has
 * never been a "choose your Google product" screen.
 *
 * Microsoft has been on both sides and both lessons are useful. They are demoting their launcher
 * home into the waffle menu right now — AND when they removed the launcher entirely from Copilot,
 * users revolted until it came back. So: the switcher must EXIST and must NOT be home.
 *
 * Adobe Creative Cloud is the one major that does ship a chooser as screen one. It is their most
 * complained-about surface; users describe it as an ad shelf, and Adobe's own remedy was a
 * preference to bypass it.
 *
 * Atlassian is the correction to what I built. Atlassian Home is a WORK FEED — your open issues,
 * your recent pages — not a menu of product tiles. It shipped with a 2.6% opt-out across 485k
 * monthly users. Rows of work, never a grid of logos.
 *
 * So this component is the SWITCHER, reached from the waffle and from the bottom of the drawer.
 * It is not what a returning member sees first. A member with two or more products should land on
 * a feed of their actual work — jobs awaiting a response, tickets sold, a score that moved, money
 * ready to release. That feed belongs in the app, not in this package, because only the app knows
 * what its work looks like.
 *
 * ── On greying things out ───────────────────────────────────────────────────────────────────
 *
 * Lee floated: *"maybe they're all greyed out except for the one they really want."* I would not.
 * Greyed-out reads as broken or locked — as something being withheld — not as something
 * available. It creates the question "why can't I have that?" at the exact moment we want the
 * answer to be "of course you can". What someone uses is on their grid; everything else sits one
 * tap behind a single Explore tile that explains each in one sentence. Nothing looks disabled,
 * nothing is hidden, and the grid stays as short as their actual life.
 *
 * ── OneScore goes first ─────────────────────────────────────────────────────────────────────
 * Lee: *"OneScore should always be at the top for sure, because that's the big selling point."*
 * Agreed, and it is also the one that makes the others make sense — it is the reason to trust
 * anyone you meet in the other four.
 */

/**
 * ONE registry, not two.
 *
 * This file used to re-declare every product's name and dot — and it had ALREADY drifted from
 * `PRODUCT_BRAND`: OnePage was magenta here and teal in the drawer, OneApp plum here and violet
 * there, OneVoice off by one digit. On the same screen session a user would have seen OnePage
 * wearing two different colours. That is exactly the "eight copies of a fact that changes"
 * failure `lib/oneWorld.ts` exists to eliminate, reintroduced in a file written a day later.
 *
 * Only the BLURB lives here now, because a blurb is copy belonging to this screen and nothing
 * else reads it. Name and colour come from the registry.
 */
const BLURB: Record<Product, string> = {
  onescore:  "Your credibility, in one number people can check.",
  onejob:    "Get hired, get paid — with the money held until the job is done.",
  oneevent:  "Host events and sell tickets, or find one to go to.",
  onesocial: "Your professional network, built on proof rather than followers.",
  oneagent:  "Represent other people's work, and get credit for the deals you close.",
  /* ONE blurb for ONE app, and it has to hold both halves without naming two products. Renting
     leads because it is the half with a signed lease and money moving through us. */
  onehome:   "Rent or buy a place in Colombia — with a signed contract and the deposit held safe.",
  /* The section blurbs survive so the record stays total. `ORDER` never reaches them. */
  onerental: "Rent out a place, or find one — with a signed lease and the deposit held safe.",
  onesale:   "Property for sale in Colombia — with the sale history nobody else keeps.",
  onevoice:  "An AI receptionist that answers your phone and books the work.",
  onepage:   "A website that actually brings you customers.",
  oneapp:    "Your own customer app, without building one.",
  onepay:      "Take payments on your phone and keep every sale, receipt and refund in one place.",
  onebusiness: "Every service you buy from One World Labs — calls, website, leads and results — in one account.",
};

/** OneScore first, deliberately. Then the four it makes sense of. Services last. */
/* SIX apps then three services. The two OneHome SECTIONS are deliberately absent: the switcher
   is the surface that answers "what do I have", and the answer is one OneHome. */
const ORDER: Product[] = [
  "onescore", "onejob", "oneevent", "onesocial", "oneagent", "onehome", "onepay", "onebusiness",
  "onevoice", "onepage", "oneapp",
];

/**
 * CONNECTED ≠ SIGNED IN, AND THE LABEL USED TO SAY THEY WERE THE SAME THING.
 * ============================================================================================
 * Lee, 3 Aug 2026, from his real signed-in test: *"apps show as connected, but OneVoice, OnePage
 * and OneApp do not show as connected even though I'm authenticated there."*
 *
 * The data was right and the WORDS were wrong. Two different facts were being printed as one:
 *
 *   SIGNED IN — One ID. Global, automatic, all eight, the moment you authenticate anywhere. It
 *               is never partial and there is nothing to turn on.
 *   CONNECTED — an entitlement row in `one_world_products`. Per product. The five apps are free,
 *               so accepting a product's terms grants it. The three services are PAID, so only a
 *               Stripe/GHL webhook running as service_role can grant them — `claim_product()`
 *               refuses them outright, deliberately, or a signed-in stranger could hand
 *               themselves a paid service by typing a URL.
 *
 * So a service showing as not-connected while you are signed in is the system working. The old
 * header — "CONNECTED · SIGNED IN" — welded the two together and made correct behaviour read as
 * a bug. It now names the session state in a full sentence, and the services carry their own
 * label so nobody has to guess why the rule differs.
 */
export default function OneWorldSwitcher() {
  const { products, loading, userId, displayName, disconnectProduct, primary, setPrimary, signOutEverywhere, signOutError } = useOneId();
  const { lang } = useI18n();
  const [pickHome, setPickHome] = useState(false);
  const navigate = useNavigate();
  /* Mirror HOME to the device so the signed-out splash knows which product to show. */
  usePrimaryMirror(primary);

  /* Every product's group comes from the one shared `accessState` decision — held (Connected),
     free (Available), paid (Subscription), or not-built (Coming soon) — so the four states can
     never drift apart or be re-derived per app. */
  const { mine, restApps, restServices, comingSoon } = useMemo(() => {
    const held = new Set(products);
    const g = { mine: [] as Product[], restApps: [] as Product[], restServices: [] as Product[], comingSoon: [] as Product[] };
    for (const p of ORDER) {
      switch (accessState({ held: held.has(p), isService: IS_SERVICE[p], comingSoon: COMING_SOON[p] })) {
        case "connected": g.mine.push(p); break;
        case "available": g.restApps.push(p); break;
        case "subscription": g.restServices.push(p); break;
        case "coming-soon": g.comingSoon.push(p); break;
      }
    }
    return g;
  }, [products]);

  /* ── THE MARKETING-SITE EJECT IS GONE. Lee reversed it, and he was right. ───────────────
     For a few hours the bare origin sent a signed-out visitor out to www.oneworldlabs.ai. The
     reasoning was website reasoning: no session at a bare origin means show them the story.

     Lee, 4 Aug 2026: *"I didn't really think that in the app world. Once you download the app,
     you won't go to the marketing page. If you log out of an app like Instagram, it just takes
     you to the splash screen... we're prepping for it to be an app, right?"*

     Correct. An app that navigates to a website when you sign out has, as far as the person
     holding the phone is concerned, closed itself. The marketing site is where somebody goes
     BEFORE they have the app — adverts point at it directly — and it is not a screen the app
     navigates to, ever. `OneWorldEntry` now owns the signed-out front door: the member's own
     product splash if this device knows one, and the One World splash if it does not. */

  if (loading) return null;

  /* No single-product forward. See the note in OneWorldEntry: the origin is the company. */

  /* A PATH, not a hostname. Everything serves from one origin as of 3 Aug 2026, so switching
     products is a route change inside the installed app. A hostname here would walk an
     installed-app user out into a browser tab — which is the exact failure the single-origin
     decision was made to remove, and a switcher is where it would bite hardest. */
  const href = (p: Product) => productHref(p);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
      {/* THE FRAMING, set by Lee 3 Aug 2026: "One World." then "Your World." then the line about
          who it is for. Three beats, in that order.

          The point of the second line is possessive. The company is One World; what the member has
          is THEIR world, and it grows. Using both words on the same screen is what teaches that —
          which is also why the section below says "the rest of YOUR world" rather than "explore One
          World". Lee's own objection to the old wording, and it is exactly right: *"it's like,
          well, you're already exploring One World. You just have to explore the rest of your
          world."* */}
      {/* ── THE MARK BELONGS HERE TOO ────────────────────────────────────────────────────
          Lee, 4 Aug 2026: *"the logo is missing at the top. One World should still have his
          logo — the full logo, not half of it. Below that it should say Your World. Both centred,
          and the AI-based solutions line centred also."*

          The mark was on the signed-out splash and nowhere else, so signing in removed the
          company's name from the company's own screen. Same treatment as the splash — full
          wordmark, centred, because this is an app. */}
      <header className="text-center">
        <div className="mb-5 flex justify-center">
          <Wordmark
            wordmark={{ ink: "ne", brand: "World", tagline: "Small business solutions",
                        markSrc: "/mark-oneworld.png" }}
            /* ── BIGGER HERE THAN ON THE SPLASH, ON PURPOSE ─────────────────────────────
               Lee, 4 Aug 2026: *"the text portion of the logo for Your World is too small — the
               W-O-R-L-D part. It needs to be bigger text."*

               The lockup's internal proportions were matched to his own artwork earlier today, so
               the fix is NOT to re-tune the type against the mark — that would break the ratio on
               all nine splashes to fix one screen. `h` scales the whole object, mark and words
               together, and Your World has the room for it: it is a heading, not a splash mark
               sitting above a headline. */
            h={46} />
        </div>
        {/* PERSONAL when we know them, generic when we do not (Max 1831). "Isaac's World" beats a
            generic chooser once you are signed in; a missing name falls back to the localized
            "Your World". Derivation lives in `lib/personalWorld.ts` — pure and unit-tested. */}
        <h1 className="text-2xl font-extrabold leading-tight text-brand">
          {personalWorldTitle(displayName, lang, sc(lang, "yourWorld"))}
        </h1>
        <p className="mt-1.5 text-sm opacity-60">
          {sc(lang, "yourWorldSub")}
        </p>
      </header>

      {/* ── WHAT THEY ACTUALLY HAVE ──────────────────────────────────────────────────────────
          Lee, 3 Aug 2026: *"you should be able to see that these are the apps that I'm connected
          to… there's no separation. Maybe a faint line that separates the ones you're connected to
          versus the ones you're not."*

          He is right, and the reason matters more than the line: without a label, a member cannot
          tell whether the list is what they HAVE or what EXISTS. Those are completely different
          questions, and getting it wrong makes the whole screen feel like an advert. Naming the
          state — CONNECTED — answers it before they have to wonder.

          Short by design either way. This is their life, not our catalogue. */}
      {/* ── THE SESSION, STATED IN WORDS ─────────────────────────────────────────────────────
          This is the only screen that can teach what One ID is, because it is the only one that
          shows more than one product at a time. Lee, 3 Aug 2026: the signed-out and sign-in copy
          *"does not clearly explain that one sign-in gives access across the whole ecosystem."*
          It is cheapest to say here, where the person is looking at the ecosystem. */}
      {/* Same One ID treatment as the splash — a named badge rather than a sentence, so the two
          screens agree about what One ID looks like. Lee: *"you could probably put the One ID in
          like a little box to format it."* */}
      {/* No icon — see the note on the splash. An icon on the left makes the BOX centred while
          the TEXT sits right of its middle, and the eye centres on the words. */}
      <div className="mx-auto inline-block rounded-2xl border-[1.5px] border-brand/70 bg-brand/[0.09] px-5 py-2 text-center leading-tight">
        <span className="block text-[13.5px] font-extrabold tracking-tight text-brand">One ID</span>
        <span className="block text-[11.5px] font-medium opacity-60">
          {sc(lang, userId ? "oneIdSignedIn" : "oneIdWorks")}
        </span>
      </div>

      {/* Signed out, this screen is the front door — the bare origin lands here and so does
          signing out. It has to offer the way in, or it is a menu of things you cannot open. */}
      {!userId && (
        <Link to="/signin"
          className="ow-tap btn-primary block w-full rounded-2xl py-3.5 text-center text-[15px] font-bold">
          Sign in
        </Link>
      )}

      {mine.length > 0 && (
        <p className="px-1 text-[11px] font-bold uppercase tracking-widest opacity-40">
          {sc(lang, "connected")}
        </p>
      )}
      <div className="space-y-2.5">
        {/* <Link>, not <a>. An <a href="/event"> is a full page reload of the SPA — it throws
            away the session cache, re-runs every provider and flashes white, on the one screen
            whose entire job is to prove the products are one app. */}
        {mine.map(p => (
          <SwipeRow key={p} product={p} to={href(p)}
            disconnectable={!IS_SERVICE[p]}
            onDisconnect={() => disconnectProduct(p)} />
        ))}
      </div>

      {/* ── THE HINT, WHERE LEE ASKED FOR IT ─────────────────────────────────────────────────
          Lee, 4 Aug 2026: *"you could even put something at the bottom that's slide to
          disconnect… I would put it at the bottom of the list before you get to not connected
          yet… put slide, and maybe a couple arrows to show that you can slide this."*

          A gesture nobody can see is a gesture nobody uses — this is the entire reason iOS
          shipped a visible "Edit" button next to swipe-to-delete for a decade. One quiet line
          costs nothing and is the difference between the feature existing and the feature being
          found. It disappears once there is nothing to slide. */}
      {mine.some(p => !IS_SERVICE[p]) && (
        <p className="flex items-center justify-center gap-1.5 px-1 pt-0.5 text-[11px] font-medium uppercase tracking-widest opacity-35">
          <Arrows /> {sc(lang, "slideToDisconnect")}
        </p>
      )}

      {/* ── HOME ──────────────────────────────────────────────────────────────────────────
          Lee, 4 Aug 2026: *"people should have the ability to switch their primary app focus.
          Let's say they download OneJob and decide, hey, I like OneScore better from now on...
          they may evolve over time."*

          It sits here rather than buried in settings because this is the only screen that shows
          the whole set at once — the question "which of these is my main one?" is only askable
          where all the answers are visible. And it is a LINK-weight control, not a button: most
          people will never touch it, and the ones who do are looking for it. */}
      {userId && mine.length > 1 && (
        <div className="px-1 pt-1">
          <button onClick={() => setPickHome(v => !v)}
            className="ow-tap text-[11px] font-medium uppercase tracking-widest opacity-40">
            {sc(lang, "homeLabel")} · {primary ? PRODUCT_BRAND[primary].name : sc(lang, "homeNotSet")} · {sc(lang, "change")}
          </button>
          {pickHome && (
            <div className="mt-2 space-y-1 rounded-2xl border border-ink/10 p-2 dark:border-white/10">
              {/* Only products they hold. Offering a home they have not turned on would sign
                  them out onto a splash for something they do not use. */}
              {mine.map(p => (
                <button key={p} onClick={async () => { await setPrimary(p); setPickHome(false); }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] transition hover:bg-brand/10 ${p === primary ? "font-bold" : ""}`}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRODUCT_BRAND[p].dot }} />
                  {PRODUCT_BRAND[p].name}
                  {p === primary && <span className="ml-auto text-[10px] uppercase tracking-widest opacity-45">{sc(lang, "homeLabel")}</span>}
                </button>
              ))}
              <p className="px-2.5 pt-1 text-[11px] leading-snug opacity-45">
                {sc(lang, "signOutReturns")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Everything else — ONE collapsed tile, not eight greyed-out rows. Greyed-out reads as
          withheld or broken; collapsed reads as "there is more when you want it".

          Separated from the connected list by a real rule, so the two groups are unmistakably
          different things rather than one long list. */}
      {(restApps.length + restServices.length + comingSoon.length) > 0 && (<>
        {mine.length > 0 && <div className="mx-1 h-px bg-ink/10 dark:bg-white/10" />}
        <p className="px-1 text-[11px] font-bold uppercase tracking-widest opacity-40">
          {mine.length > 0 ? sc(lang, "notConnected") : sc(lang, "everything")}
        </p>
        {/* OPEN BY DEFAULT when nothing is connected. A signed-out visitor — or a member on the
            day they join — arrives with an empty "yours" list, and a collapsed tile saying
            "explore the rest of your world" over an empty world is a closed door on an empty
            room. Once they hold something, it collapses again and the screen stays short. */}
        <details className="card ow-row !rounded-3xl px-4 py-3.5" open={mine.length === 0}>
          <summary className="cursor-pointer list-none font-bold">
            {mine.length > 0 ? "Explore the rest of your world" : "See what is here"}
            <span className="ml-2 text-[12.5px] font-medium opacity-55">
              {restApps.length + restServices.length + comingSoon.length} more
            </span>
          </summary>
          <div className="mt-3 space-y-2.5 border-t border-ink/10 pt-3 dark:border-white/10">
            {restApps.map(p => <RestRow key={p} p={p} to={href(p)} note="Free — turn it on any time" />)}

            {/* ── THE SERVICES ARE LABELLED, NOT HIDDEN ────────────────────────────────────
                They can never move into "Connected" by being visited, because they are paid and
                the entitlement only arrives with a subscription. Saying so on the row is the
                whole fix for "why is OneVoice not connected when I'm signed in?" — the answer is
                that connecting it is a purchase, not a login. */}
            {restServices.length > 0 && (<>
              <p className="pt-1 text-[10.5px] font-bold uppercase tracking-widest opacity-35">
                Services
              </p>
              {restServices.map(p => <RestRow key={p} p={p} to={href(p)} note="Starts with a subscription" />)}
            </>)}

            {/* ── COMING SOON — labelled, never turn-on-able (Task 1.1.d) ──────────────────────
                A product that is not built has no surface to open and no entitlement to claim.
                Rendered as plain rows (NOT links), so a tap does nothing and no activation fires —
                the honest answer to "why can't I open OneAgent?" is "it isn't here yet", said on
                the row instead of by a dead link. */}
            {comingSoon.length > 0 && (<>
              <p className="pt-1 text-[10.5px] font-bold uppercase tracking-widest opacity-35">
                Coming soon
              </p>
              {comingSoon.map(p => <ComingSoonRow key={p} p={p} />)}
            </>)}
          </div>
        </details>
      </>)}

      {/* ── SIGN OUT, AT THE VERY BOTTOM ─────────────────────────────────────────────────────
          Lee, 4 Aug 2026: *"when you're on Your World and you see all of your apps, there is no
          sign out. There's no way to sign out if you want to. You gotta have a sign out at the
          bottom."*

          He is right, and the cause was a decision made two screens away: Your World renders
          `bare` — no product header — precisely so it stops wearing OneJob's chrome. The drawer
          went with the header, and the only sign-out on the platform went with the drawer. Fixing
          one screen's branding quietly removed the exit from another.

          Same behaviour as the drawer's: global revoke, then land on HOME so they arrive at a
          splash they recognise rather than a screen that belongs to nobody. */}
      {userId && (
        <div className="mt-2 border-t border-ink/10 pt-4 dark:border-white/10">
          <button
            onClick={async () => {
              const home = primary ? productHref(primary) : "/";
              if (await signOutEverywhere()) navigate(home, { replace: true });
            }}
            className="ow-tap w-full rounded-2xl py-3 text-[14px] font-semibold text-red-500 transition hover:bg-red-500/10">
            {W(lang, "Sign out", "Cerrar sesión")}
          </button>
          {signOutError && <p role="alert" className="mt-2 text-center text-xs text-red-500">{signOutError}</p>}
        </div>
      )}
    </div>
  );
}

/** Two chevrons pointing the way the finger goes. Deliberately not the word "left" — Lee asked
 *  for arrows rather than a direction in words, and he is right: the arrows are the same in
 *  every one of the seven languages this ships in. */
const Arrows = () => (
  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <path d="M8 1.6 4 5l4 3.4M15 1.6 11 5l4 3.4" />
  </svg>
);

/**
 * A CONNECTED ROW YOU CAN SLIDE OFF.
 * ============================================================================================
 * Lee, 4 Aug 2026: *"let's just say one person wants to disconnect it so it doesn't show up in
 * their list of connected accounts… I think sliding it would be the best way… and it just moves
 * itself back into the not connected file."*
 *
 * ── Slide REVEALS, tap CONFIRMS. Not slide-to-commit. ───────────────────────────────────────
 * The reason for this feature is that a person can undo an accidental connect. A gesture that
 * disconnects the instant your thumb leaves the glass would create the identical problem facing
 * the other way — and worse, because a connect is one deliberate tap through a terms screen
 * while a stray horizontal scroll is something people do by accident all day. So the slide
 * uncovers a button and the button does the work. That is Mail's pattern on both platforms, so
 * it is also the one people already know.
 *
 * ── Pointer events, not touch events ────────────────────────────────────────────────────────
 * One code path covers finger, trackpad and mouse. `touchstart` alone would have made this a
 * phone-only feature, and Lee tests on both.
 *
 * ── The row is still a link ─────────────────────────────────────────────────────────────────
 * It has to be — its main job is to open the product. So a drag past a few pixels suppresses
 * the click that a pointer-up would otherwise fire, or every attempted swipe would navigate
 * away mid-gesture and look like the swipe "did nothing".
 */
function SwipeRow({ product, to, disconnectable, onDisconnect }: {
  product: Product; to: string; disconnectable: boolean; onDisconnect: () => Promise<void>;
}) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  /* ── THE OFFSET LIVES IN A REF AS WELL AS IN STATE, AND THAT IS NOT BELT-AND-BRACES ──────
     `dx` state is what RENDERS. `dxRef` is what the release DECIDES on.

     Reading the state variable inside the pointer-up handler is the bug this replaces, and it
     was invisible in every way that matters: the row slid perfectly under the finger — verified
     frame by frame, translateX went -10, -30, -60, -95 — and then snapped straight back to zero
     on release, every single time, because the value the handler compared against the threshold
     was from an earlier render. It reads as "the swipe does not stick", which sounds like a
     threshold that needs tuning, and no amount of tuning would ever have fixed it. */
  const dxRef = useRef(0);
  const setOffset = (v: number) => { dxRef.current = v; setDx(v); };

  const REVEAL = 104;   // how far the row rests when open — the width of the button behind it
  const TRIGGER = 52;   // past this on release, it opens; before it, it snaps back

  const onDown = (e: React.PointerEvent) => {
    if (!disconnectable || busy) return;
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };

  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    /* VERTICAL WINS. If the finger is travelling more up-down than left-right the person is
       scrolling the page, and hijacking that would make the whole screen feel broken. Bail out
       of the gesture entirely rather than fighting it. */
    if (!moved.current && Math.abs(ddy) > Math.abs(ddx)) { start.current = null; return; }
    if (Math.abs(ddx) > 4) moved.current = true;
    /* Left only, and never past the button. Rubber-banding to the right would suggest there is
       something hidden on that side, and there is not. */
    setOffset(Math.max(Math.min(ddx + (open ? -REVEAL : 0), 0), -REVEAL));
  };

  const onUp = () => {
    if (!start.current) { return; }
    const shouldOpen = dxRef.current < -TRIGGER;
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -REVEAL : 0);
    start.current = null;
    /* The click that closes the gesture must not also navigate. Cleared on the next tick, after
       React has flushed the click that this pointer-up produces. */
    if (moved.current) setTimeout(() => { moved.current = false; }, 0);
  };

  const disconnect = async () => {
    setBusy(true); setErr(null);
    try {
      await onDisconnect();
      /* No snap-back on success: the row is about to leave this list entirely, because
         `products` reloads and it moves down into "Not connected yet". */
    } catch (e: any) {
      /* PUT IT BACK AND SAY WHY. A row that silently stays put after you press Disconnect reads
         as a broken button, and the person presses it again. */
      setErr(e?.message?.includes("subscription") ? "Cancel this from its plan screen." : "Could not disconnect.");
      setBusy(false);
      setOpen(false); setOffset(0);
    }
  };

  return (
    <div className="relative">
      {/* BEHIND the row. Not rendered conditionally — a button that mounts mid-gesture cannot be
          animated toward, and the reveal would flicker. */}
      {/* HIDDEN UNTIL THE FINGER MOVES. The card in front of it is GLASS — the family's whole
          visual language is translucency — so a red panel sitting behind a closed row bled
          through it and every connected product read as if it were in an error state, with the
          word "Disconnect" ghosting through the blurb. Opacity rather than conditional
          rendering: the panel stays mounted and laid out, so it fades in on the first pixel of
          travel instead of popping into existence mid-gesture. */}
      {disconnectable && (
        <div
          style={{ opacity: dx < 0 || open ? 1 : 0, transition: "opacity .12s linear" }}
          className={`absolute inset-y-0 right-0 flex w-[104px] items-center justify-center rounded-r-3xl bg-red-500/90 ${dx < 0 || open ? "" : "pointer-events-none"}`}>
          <button onClick={disconnect} disabled={busy}
            className="ow-tap h-full w-full text-[13px] font-bold text-white disabled:opacity-60"
            aria-label={`Disconnect ${PRODUCT_BRAND[product].name}`}>
            {busy ? "…" : "Disconnect"}
          </button>
        </div>
      )}

      {/* ── `draggable={false}` IS LOAD-BEARING, NOT A TIDY-UP ────────────────────────────
          The row is an anchor, and every desktop browser treats a mouse drag on an anchor as the
          start of a NATIVE link drag. `dragstart` fires, the browser takes over the pointer, and
          it immediately sends `pointercancel` — so the swipe died on the third mouse-move, every
          time, with nothing in the console. Confirmed by instrumenting the real row:

              pointerdown → pointermove → DRAGSTART → POINTERCANCEL   (transform never moved)

          Touch never showed it, because touch does not start link drags. Without this the
          feature would have looked finished, passed a phone test, and been dead on every laptop.
          `select-none` goes with it — otherwise the drag paints a text selection across the
          card. */}
      <Link to={to} draggable={false} onDragStart={(e) => e.preventDefault()}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        /* ── TWO DIFFERENT CLICKS, AND TELLING THEM APART IS THE WHOLE THING ────────────────
           A pointer-up that ends a swipe ALSO produces a click. `pointerup` and `click` are
           separate events, so React flushes between them — which means the click handler runs
           with `open` already true and, in the first version, immediately closed the row it had
           just opened. The row slid to -95 under the finger and snapped back to 0 the instant
           you let go, every time, with no error and nothing to see in the source.

           `moved.current` is the discriminator: it says "this click is the tail of a gesture".
           Those clicks do nothing but suppress navigation. A click with no movement behind it is
           a real tap, and a real tap on an open row closes it. */
        onClick={(e) => {
          if (moved.current) { e.preventDefault(); return; }
          if (open) { e.preventDefault(); setOpen(false); setOffset(0); }
        }}
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? "none" : "transform .22s cubic-bezier(.2,.8,.2,1)" }}
        className="card ow-row relative flex select-none items-center gap-3 !rounded-3xl px-4 py-3.5 touch-pan-y">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PRODUCT_BRAND[product].dot }} />
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-tight">{PRODUCT_BRAND[product].name}</span>
          {/* WRAPS. It used to be `ow-fade` — one line, faded off at the right edge — which is
              the correct treatment for a name that ran out of room. A sentence is different:
              every blurb here is longer than the card, so EVERY row cut mid-word ("…in one
              number peo") and the screen read as broken rather than as tight. */}
          <span className="block text-[12.5px] leading-snug opacity-55">{BLURB[product]}</span>
          {err && <span className="mt-1 block text-[11.5px] font-semibold text-red-500">{err}</span>}
        </span>
        <Chevron />
      </Link>
    </div>
  );
}

/** One row inside the collapsed section. Same shape for a free app and for a paid service — only
 *  the note differs, because the only thing that differs is how you come to hold it. */
const RestRow = ({ p, to, note }: { p: Product; to: string; note: string }) => (
  <Link to={to} className="flex items-start gap-3 py-1.5">
    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRODUCT_BRAND[p].dot }} />
    <span className="min-w-0">
      <span className="block text-[15px] font-semibold leading-tight">{PRODUCT_BRAND[p].name}</span>
      <span className="block text-[12.5px] leading-snug opacity-55">{BLURB[p]}</span>
      <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide opacity-35">{note}</span>
    </span>
  </Link>
);

/** A not-built product. Deliberately NOT a <Link> — it has nowhere to go and nothing to turn on,
 *  so it is a plain, dimmed row that says "Coming soon" and does nothing when tapped. */
const ComingSoonRow = ({ p }: { p: Product }) => (
  <div aria-disabled="true" className="flex items-start gap-3 py-1.5 opacity-55">
    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRODUCT_BRAND[p].dot }} />
    <span className="min-w-0">
      <span className="block text-[15px] font-semibold leading-tight">{PRODUCT_BRAND[p].name}</span>
      <span className="block text-[12.5px] leading-snug opacity-55">{BLURB[p]}</span>
      <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide opacity-45">Coming soon</span>
    </span>
  </div>
);

const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
       className="shrink-0 opacity-35" aria-hidden>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

/**
 * Pinning and reordering: NOT at onboarding.
 *
 * Lee floated letting people choose which products appear before they start. The pattern exists
 * — Zoho and Microsoft both allow pinning, and Atlassian's headline change was a customizable
 * sidebar — but in every case it is a power-user escape hatch reached from settings, never a step
 * a new member is walked through. Adobe's "skip the launcher" preference is the tell: curation is
 * what people use to AVOID a chooser, not a chooser they wanted.
 *
 * So: offer it in settings, after a second product is actually adopted. Not before the first.
 */

/**
 * The way back, from anywhere.
 *
 * Lee: *"how did they get back to it? I guess they come back to the home screen — in the
 * hamburger icon there's the home screen at the very bottom that says One World Labs, and it
 * really should say One World."*
 *
 * Right on both counts, and it is already where the drawer puts it. Renaming it to "One World"
 * matters more than it sounds: "One World Labs" is the company, and a person navigating an app
 * is not looking for a company — they are looking for the place the other products live.
 */
export const HOME_LABEL = "One World";

