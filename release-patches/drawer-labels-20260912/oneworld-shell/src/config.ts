import type { AppKey } from "./lib/oneWorld";

/**
 * ONE SHELL, SIX APPS.
 * ============================================================================
 * (Five when Lee said the words below on 3 Aug 2026; OneHome made it six on 10 Aug. The count in
 * the heading is kept current because it is the first thing a new thread reads about the shell —
 * Max had to roll back stale five-app copy before pushing v15 on 11 Aug, and a file header that
 * still says five is how that comes back.)
 *
 * Lee, 3 August 2026:
 *
 *   "It could be one shell for every app, and it should be identical to what we've already
 *    built with OneJob… if we build one shell for four apps and then one shell for the OneJob
 *    app, I think that disconnect might be a problem. So build the shell, then take all of the
 *    code we have for OneJob and layer it onto the shell. That way we have a seamless
 *    integration across all five. That's gonna be most stable — instead of OneJob living on an
 *    island by itself."
 *
 * He is right, and it is worth stating why plainly: a shell that four apps use and a fifth does
 * not is two shells. The moment OneJob's copy drifts — and it will, because it is the app that
 * gets worked on — the "identical" guarantee is gone and single sign-on is being maintained in
 * two places again. **OneJob is rebuilt onto this shell like everything else.**
 *
 * ── What belongs in this file, and what does not ──────────────────────────────────────────────
 * This is the ONLY thing an app is allowed to vary. If you find yourself wanting to add a prop
 * to TopBar or a branch to Drawer for one app, stop: that is the drift starting. Either it
 * belongs to every app (put it in the shell) or it belongs to none (leave it out).
 *
 * Five values per app. Nothing else.
 */

/** An eight-step hue ramp. Every step is measured against BOTH backgrounds before use. */
export interface HueRamp {
  /**
   * The step used as plain text on a light background. MUST measure ≥4.5:1 on #FAFAF8.
   * This is the `DEFAULT` in the Tailwind token, and it is deliberately NOT the identity hue —
   * OneJob's #17A45C measures 3.23:1 as text and would have failed on ~175 call sites.
   */
  DEFAULT: string;
  /** The identity hue. Aurora, glows, gradient starts, the logo mark. NEVER text, never a flat button fill. */
  bright: string;
  /** Links, headings, emphasis on light. Usually the same as DEFAULT. */
  deep: string;
  /** Headers, closing bands, gradient ends. */
  dark: string;
  /** Deep panels, chrome. */
  darkest: string;
  /** Gradients and highlights on dark. MUST measure ≥7:1 on #0B0F1A — `.dark .text-brand` uses this. */
  light: string;
  /** Quiet backgrounds. */
  tint: string;
  /** Borders on tinted surfaces. */
  line: string;
}

/** One slot on the bottom bar. Exactly five, and the last two are fixed. */
export interface TabSpec {
  to: string;
  /** Dictionary key, not a literal — the bar is translated like everything else. */
  labelKey: string;
  /** Key into the shell's icon set. */
  icon: string;
  /**
   * The raised centre slot: the ONE action the app exists for. Exactly one tab sets this,
   * and it is always the middle of the five.
   */
  primary?: boolean;
}

export interface AppConfig {
  /** Which app this is. Drives the drawer's sibling list — an app never lists itself. */
  key: AppKey;

  /**
   * WHICH ENTITLEMENT THIS SHELL TURNS ON. Defaults to `key`, and only OneHome sets it.
   * ------------------------------------------------------------------------------------------
   * Max, 10 Aug 2026: *"Connecting/turning on OneHome should mark OneHome connected once.
   * Disconnecting should disconnect OneHome once. Do not require separate rent/sale app
   * connections."*
   *
   * `/rentals` and `/sales` are two mounted shells because they need different hues, footers and
   * money rules — but they are ONE thing a member turns on. Both configs therefore declare
   * `entitlement: "onehome"`, so opening either grants OneHome once and Your World has one row
   * to switch off. Without this field the alternative is a branch inside AppShell that names two
   * product keys, which is exactly the drift this file exists to prevent.
   */
  entitlement?: AppKey;

  /** Wordmark: the mark is the letter O, then this in ink, then this in the brand hue. */
  wordmark: { ink: string; brand: string; tagline: string; markSrc: string };

  hue: HueRamp;

  /**
   * THE FOOTER VARIES BY PRODUCT. THE HEADER AND DRAWER NEVER DO.
   *
   * Lee, 3 Aug 2026: *"They all still need shells anyway. The header needs to be the same, the
   * hamburger icon needs to reflect the same information… the footer information is going to
   * vary depending on the app."*
   *
   * That split is exactly right, and it is worth naming why. The header and the drawer are how
   * someone knows WHERE THEY ARE and HOW TO LEAVE — those must never differ, or the family
   * stops reading as one company. The footer is how someone DOES THE WORK of this particular
   * product, and the work genuinely differs: OneJob has five things you do, OneVoice has one
   * screen you look at.
   *
   * So the five consumer apps carry five tabs, with Messages fourth and Profile fifth, always.
   * A service may carry fewer, or none at all — `assertConfig` only enforces the canon on the
   * five-tab shape.
   */
  tabs: TabSpec[];

  /**
   * Pages reachable from the drawer that are not tabs. Order is preserved.
   */
  drawerExtras: { to: string; labelKey: string; icon: string }[];

  /**
   * Where the bell goes. The bell is the FIRST of the header trio (bell → flag → hamburger) and
   * it renders in every product that names a destination — which should be all of them, because
   * a two-item header next to a three-item one is a difference people feel without naming it.
   */
  notificationsPath: string;

  /**
   * Per-language copy. Keys the shell itself needs are listed in `ShellStrings`; anything else
   * in here belongs to the app. Same seven language keys as the hub: en · co · es · de · ru ·
   * zh · pt.
   */
  dictionary: Record<string, Record<string, string>>;

  /**
   * OPTIONAL. The language this product OPENS in when the person has never chosen one.
   * Added for OneRental (Lee, 10 Aug 2026): Colombia-only, aimed at expatriates and tourists in
   * Medellín, Bogotá, Cali and Cartagena, so opening in English would make it read as a foreign
   * site in the only market it serves. Every other product omits this and opens in English.
   * A DEFAULT, never a lock — a stored language preference always wins.
   */
  defaultLang?: "en" | "co" | "es" | "de" | "ru" | "zh" | "pt";

  /** The splash screen's words. Everything else about splash is identical in every app. */
  /**
   * `pitchKey` is the 2-3 sentences that go UNDER the sign-in block.
   *
   * Lee, 13 Aug 2026: *"every splash and landing page needs two or three sentences of
   * marketing under the sign-in block explaining what the app actually is. Right now
   * there is nothing."*
   *
   * The gap was structural, not an oversight in the copy: a splash could state a slogan
   * (`subKey`) but had nowhere to say what the product DID, so somebody who followed an
   * advert had to sign up to find out. Optional, so a product without one degrades to
   * exactly the screen that shipped before rather than rendering a bare key.
   */
  splash: { headlineKey: string; subKey: string; pitchKey?: string };

  /**
   * The first-use terms gate. Shown ONCE per product, per person, and recorded.
   *
   * Lee, 3 Aug 2026: *"just put a message that people have to click the agree to terms and
   * conditions… we need to know when they first use that app."* One ID means somebody can
   * arrive in OneVoice having only ever agreed to OneJob's terms, so agreement is recorded per
   * product rather than once for the account.
   *
   * `pointKeys` are three or four short lines in plain language — the summary, not the
   * document. Someone who reads only these should not be surprised later. All are dictionary
   * keys, because a terms gate that appears in English to a Spanish speaker is not informed
   * consent in any of the markets this ships into.
   */
  terms: { titleKey: string; pointKeys: string[]; url: string };
}

/**
 * Strings the shell renders itself. Every app's dictionary must supply all of them in every
 * language it marks `ready`, or the shell will fall back to English and the app will look
 * half-translated — which is worse than being untranslated.
 */
export const SHELL_STRINGS = [
  "signin", "signout", "join", "continueGoogle", "continueApple", "comingSoon", "continueEmail",
  "emailPlaceholder", "sendCode", "enterCode", "verify", "codeSent",
  "home", "messages", "profile", "settings", "language", "theme", "back", "menu", "close",
  "vaiaInsights", "vaiaInsightsAria", "notifications", "notificationsUnread",
  "country", "currency", "pricesIn", "ratesLoading",
] as const;

export type ShellString = (typeof SHELL_STRINGS)[number];

/**
 * Fail loudly at startup rather than shipping a shell that quietly differs.
 *
 * Every rule checked here is one that has already been broken once in this codebase, and each
 * one is invisible until someone notices the apps feel different — which is exactly the failure
 * mode this package exists to prevent. A thrown error in development is cheap; four apps that
 * drifted for a month is not.
 */
export function assertConfig(c: AppConfig): void {
  const die = (m: string) => { throw new Error(`[oneworld-shell] ${c.key}: ${m}`); };

  /* The five consumer apps share one footer shape and it is not negotiable. Services are
     exempt from the SHAPE, never from the header or the drawer. */
  const isService = ["onevoice", "onepage", "oneapp"].includes(c.key);

  if (!isService) {
    if (c.tabs.length !== 5) die("consumer apps must define exactly 5 tabs");
    if (c.tabs.filter(t => t.primary).length !== 1) die("exactly one tab must be `primary` (the raised centre slot)");
    if (!c.tabs[2].primary) die("the primary tab must be the MIDDLE one — it is the raised centre slot");
    if (!/profile/.test(c.tabs[4].to)) die("Profile is always the last tab. Canon, every app.");
    /* Messages is second-to-last on FOUR of the five apps. OneScore is the exception, LOCKED by
       Lee on 8 Aug 2026: its footer is Home · Connect · My score · Simulator · Profile, with no
       Messages tab at all — the Simulator sits in that slot. So Home (1) and Profile (5) are the
       only truly-fixed tabs; Messages is required at 4 for everyone but OneScore. */
    if (c.key !== "onescore" && !/messages/.test(c.tabs[3].to))
      die("Messages is always second-to-last, beside Profile (every app except OneScore).");
  } else {
    if (c.tabs.length > 5) die("a service may carry fewer tabs than an app, never more");
    if (c.tabs.filter(t => t.primary).length > 1) die("at most one primary tab");
  }

  // The contrast trap, caught before it ships for a fourth time.
  if (c.hue.DEFAULT === c.hue.bright)
    die("hue.DEFAULT must be the DEEP step, not the identity hue — the identity hue fails 4.5:1 as text on light");

  const AMBER_IS_ONESCORES = /^#e0a21f$|^#f59e0b$|^#eab308$/i;
  if (c.key !== "onescore" && AMBER_IS_ONESCORES.test(c.hue.bright))
    die("amber belongs to OneScore alone — pick another hue");

  /* ── The half-translated trap ───────────────────────────────────────────────────────────
     A language is OFFERED only when its dictionary is real (`readyLangs` derives the picker
     from the dictionary, so a flag can never do nothing). But a dictionary that exists and is
     MISSING shell strings is worse than one that does not exist: the picker offers German, the
     screen switches, and the header still says "Sign in". A member who taps a flag and sees
     half a translation concludes the product is broken — and on a screen that moves money that
     is a defect, not a rough edge.

     So: any language this product claims must carry every string the SHELL itself renders. The
     product's own copy is the product's business; the chrome is this package's. */
  for (const [code, entries] of Object.entries(c.dictionary)) {
    if (!entries || Object.keys(entries).length === 0) continue;   // absent is fine — not offered
    const missing = SHELL_STRINGS.filter(k => !entries[k]);
    if (missing.length)
      die(`dictionary "${code}" is offered but is missing shell strings: ${missing.join(", ")}`);
  }

  if (!c.dictionary.en) die("English is the fallback for every other language and cannot be absent");

  /* Terms are recorded PER PRODUCT — One ID means somebody can arrive here having only ever
     agreed to another product's terms. A gate with no document behind it is not agreement. */
  if (!c.terms?.url) die("terms.url is required — the summary is not the document");
  if (!c.terms.pointKeys?.length) die("terms.pointKeys is required — a bare 'I agree' is not informed");
}
