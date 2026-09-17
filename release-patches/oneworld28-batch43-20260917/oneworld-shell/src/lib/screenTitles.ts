import type { Lang } from "./i18n";

/**
 * THE SHARED SCREEN TITLES — one word per screen ROLE, for every app, in seven languages.
 * ============================================================================================
 * Lee, 10 Aug 2026:
 *
 *   *"Even on the new OneHome app and all the apps, the headers — the subheaders per screen —
 *    where you have like Discover, Messages, Profile, all that needs to be lined up properly on
 *    the same row… VAIA on the right side, the screen name or title on the left side, on the
 *    same row. Sometimes it's misaligned in their own different rows, or they're just not
 *    present. So we need to make sure they're present and they should not conflict with each
 *    other either… This fix should be made at the shell level. But still every app has different
 *    title pages, of course — the titles are like a placeholder in the shell, right? So the
 *    titles per screen should all be consistent, for the Discovery, Messages and Profile
 *    screens."*
 *
 * That is two requirements and they are easy to conflate:
 *
 *   1. **The ROW is the shell's.** Solved by `ScreenHeading` — title left, VAIA right, one row,
 *      one component, no screen chooses its own layout.
 *   2. **The WORDS on the shared screens are the shell's too.** Not solved, until this file.
 *      Every app was free to name its own home tab, and did: the products' dictionaries carried
 *      six different words for the same screen. Messages and Profile were hard-coded English/
 *      Spanish ternaries inside the shell screens themselves — so five of the seven languages
 *      the header offers showed English titles on the two screens every member visits daily.
 *
 * ── WHAT THIS FILE IS, AND WHAT IT IS NOT ────────────────────────────────────────────────────
 * It covers the screens that mean THE SAME THING in every product. Discover is a feed of what
 * this product has. Messages is your inbox. Profile is you. Those three are Lee's list and they
 * are the ones a member navigates by muscle memory, so they must read identically everywhere.
 *
 * It does NOT cover the screens that are the product — "My jobs", "List a place", "Roster",
 * "Deals". Those are each app's own word for its own work, they belong in that app's dictionary,
 * and forcing them through here would be the opposite mistake: one vocabulary flattening five
 * different businesses.
 *
 * ── WHY "DISCOVER" AND NOT "HOME" ────────────────────────────────────────────────────────────
 * Lee said "Discover" and it is also the more accurate word. Every product's first tab is a feed
 * of things you did not put there — jobs, events, posts, places. "Home" describes where the tab
 * sits, not what is on it, and it collides with OneHome's product name now that OneHome exists.
 * The TAB still says Home; the SCREEN TITLE says Discover. Those are different jobs: the tab
 * label is a destination, the screen title is a description of what you are looking at.
 */

export type ScreenTitleKey = "discover" | "messages" | "profile";

/**
 * Seven languages, no gaps. `shell.chrome-uat-r2.cjs` asserts every key exists in every language,
 * because the failure mode of a missing entry is not a crash — it is one English word sitting in
 * a Chinese interface, which nobody reports and everybody notices.
 */
const TITLES: Record<ScreenTitleKey, Record<Lang, string>> = {
  discover: {
    en: "Discover",
    /* Colombian Spanish and neutral Spanish agree here — `Descubre` is the imperative used by
       every Spanish-language app for this exact tab, and the usted/tú split does not reach it. */
    co: "Descubre",
    es: "Descubre",
    de: "Entdecken",
    ru: "Обзор",
    zh: "发现",
    pt: "Descubra",
  },
  messages: {
    en: "Messages",
    co: "Mensajes",
    es: "Mensajes",
    de: "Nachrichten",
    ru: "Сообщения",
    zh: "消息",
    pt: "Mensagens",
  },
  profile: {
    en: "Profile",
    co: "Perfil",
    es: "Perfil",
    de: "Profil",
    ru: "Профиль",
    zh: "个人资料",
    pt: "Perfil",
  },
};

/** One shared screen title, falling back to English rather than to a raw key on screen. */
export function screenTitle(lang: Lang | string, key: ScreenTitleKey): string {
  return (TITLES[key] as Record<string, string>)[lang] ?? TITLES[key].en;
}

/** Exported for the test harness: every language must carry every key. */
export const SCREEN_TITLES = TITLES;

/**
 * A PERSON'S NAME, SHORTENED SO IT CANNOT PUSH INTO VAIA.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"Sometimes the profile name is too long, and so we just need to shorten the
 * profile name if it's too long — that's the fix. So you don't have some title that runs into
 * VAIA."*
 *
 * `ScreenHeading` already guarantees the two can never physically collide: the title is
 * `min-w-0 … truncate` and the pill is `shrink-0`, so the browser clips the text rather than
 * letting it push. That is the *safety* net and it must stay — but on a 390px screen it turns
 * "María Fernanda Restrepo Álvarez" into "María Fernanda Restre…", which is a worse thing to
 * read than a name that was shortened on purpose.
 *
 * So: shorten deliberately first, clip only if that still does not fit.
 *
 *   "Isaac Agudelo"                    → "Isaac Agudelo"                (12 chars, untouched)
 *   "María Fernanda Restrepo Álvarez"  → "María Fernanda R."            (first + middle + initial)
 *   "Bartholomew Cumberbatch-Smythe"   → "Bartholomew C."
 *   "Pieter van der Berg"              → "Pieter van der B."            (particles kept with the surname)
 *
 * The rule is: keep every given name, initialise the LAST word only, and never initialise a
 * one-word name. Given names are what people answer to; surnames are what fits in the space.
 * Particles (`van`, `de`, `da`, `del`, `bin`, `al`) belong to the surname and are dropped with
 * it — initialising "van" would produce "Pieter v.", which is nobody.
 */
/* Particles (`van`, `de`, `da`, `del`, `bin`, `al`) belong to the surname and stay with the words
   we keep — the only thing they change is that we never initialise ONE of them on its own, which
   would produce "Pieter v." and name nobody.

   ⚠️ THE TEST CAUGHT A REAL BUG HERE, and it is worth recording because reading did not.
   The first version walked BACKWARDS past every particle to find "the real surname", then dropped
   the particles with it — so "Pieter van der Berghenson" came out as "Pieter V.", initialising
   the particle `van`. The walk was solving a problem that does not exist: the last word IS the
   surname, and everything before it is kept. The fix is that the algorithm got smaller. */
const PARTICLES = new Set([
  "van", "von", "der", "den", "de", "del", "della", "di", "da", "dos", "das", "du",
  "la", "le", "el", "bin", "ibn", "al", "st", "st.", "mac", "mc",
]);

export function shortenPersonName(full: string | null | undefined, limit = 18): string {
  const name = (full ?? "").trim().replace(/\s+/g, " ");
  if (!name) return "";
  if (name.length <= limit) return name;

  const parts = name.split(" ");
  /* One word and still too long — there is nothing to shorten. `ScreenHeading`'s truncate handles
     it, which is the correct outcome: we do not invent an abbreviation for a name we cannot
     parse. */
  if (parts.length < 2) return name;

  const surname = parts[parts.length - 1];
  /* A trailing particle is not a surname. Nothing to initialise that would still read as a name. */
  if (PARTICLES.has(surname.toLowerCase())) return name;

  const kept = parts.slice(0, -1);
  const short = [...kept, `${surname[0].toUpperCase()}.`].join(" ");

  /* If initialising did not actually help — a very long first name — return the original rather
     than something longer than what we started with. */
  return short.length < name.length ? short : name;
}
