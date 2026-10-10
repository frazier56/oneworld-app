import { matchIdentity } from "./identityMatch";
import type { ClaimedAccount, KnownPerson, MatchVerdict } from "./identityMatch";

/**
 * SOCIAL CONNECT — one tap, the platform's own "Was this you?", done (SHELL).
 * ============================================================================================
 * Lee, 8 October 2026, on what connecting an account has to feel like:
 *
 *   *"I should be able to go to OneSocial, my profile, and then click connect, and then it
 *   works. It's going to go through some type of process where it's going to say, open up your
 *   Instagram and click yes, One World is trying to access your account. Then boom, it comes
 *   back. Then boom, it's connected. And then five seconds later all the posts start showing
 *   up… Forget SDK. Forget technical stuff. From a user's perspective they don't know anything.
 *   Remember our Porsche Taycan theory."*
 *
 * And the rule that kills every shortcut: **"We're not talking about a code anywhere."** No code
 * in a bio, no code in a comment, nothing to copy, nothing to remember.
 *
 * ── THE WHOLE FLOW, EVERY STEP ─────────────────────────────────────────────────────────────
 *  1. The member taps Connect beside Instagram.
 *  2. We send them to the provider's start address with their One ID and where to come back to.
 *     Nothing is written yet.
 *  3. The provider sends them to Instagram's own approval screen. They are already signed in on
 *     the phone, so Instagram shows them "One World Labs wants to connect to your account".
 *  4. They tap yes. Instagram sends them back to the provider; the provider sends them back to
 *     us with a one-time reference in the address.
 *  5. We exchange that reference for what the account says about itself — handle, display name,
 *     and whatever contact details the platform releases.
 *  6. **`matchIdentity` scores it against their One ID** — name, email, phone, location. The
 *     approval proved somebody CONTROLS the account; this asks whether it looks like THEM.
 *  7. Pass: we write the connection and start pulling posts. Not sure: one puzzle first. No:
 *     we do not connect it, and we say why.
 *  8. The posts arrive in the Social media section on their profile.
 *
 * Steps 2 and 5 are the provider's. **Everything in this file is steps 1, 6 and 7**, which are
 * ours and which work the same whichever provider is behind it.
 *
 * ── ⚠️ NOTHING HERE DEPENDS ON AN EDGE FUNCTION THAT IS NOT DEPLOYED ───────────────────────
 * `compose-description` is the scar: a client shipped against a half-deployed function sent
 * property listings to be written as party invitations. So this follows the light-up-when-
 * configured rule the shell already uses three times over — Apple sign-in, Places autocomplete,
 * the writing assist. `canTapToConnect()` DERIVES whether the one-tap path really exists. Until
 * it does, the button is not drawn at all. **Hidden, not disabled** — a greyed control
 * advertises a feature and then refuses it, which reads as a broken app.
 */

/** Platforms the one-tap path can serve once a provider is configured. */
export const TAP_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "twitter", "twitch"] as const;
export type TapPlatform = (typeof TAP_PLATFORMS)[number];

const ALIAS: Record<string, string> = { x: "twitter" };
const norm = (p: string) => ALIAS[p.toLowerCase().trim()] ?? p.toLowerCase().trim();

/* Vite inlines these at build time, so an unset variable is the string "undefined" or empty —
   never assume a truthy object. Read defensively and treat anything unexpected as "not ready". */
function env(key: string): string {
  try {
    const e = (import.meta as unknown as { env?: Record<string, string> }).env;
    const v = e?.[key];
    return typeof v === "string" && v !== "undefined" ? v.trim() : "";
  } catch { return ""; }
}

/**
 * Is the one-tap path actually live for this platform, right now?
 * Both halves must be true: a start address is configured, and the platform is on the list the
 * provider has switched on. One missing piece means the button is not drawn.
 */
export function canTapToConnect(platform: string): boolean {
  const key = norm(platform);
  if (!env("VITE_SOCIAL_CONNECT_START")) return false;
  const on = env("VITE_SOCIAL_CONNECT_PLATFORMS");
  if (!on) return false;
  if (on === "*") return (TAP_PLATFORMS as readonly string[]).includes(key);
  return on.toLowerCase().split(",").map(s => norm(s)).includes(key);
}

/** True when at least one platform can be connected with a tap — for a heading or a hint. */
export const anyTapToConnect = () => TAP_PLATFORMS.some(canTapToConnect);

/**
 * Step 1 and 2. Hands the member to the provider, which hands them to the platform.
 * Returns the address rather than navigating, so the caller decides and so this stays testable.
 * `returnTo` is a path on our own origin — never a full URL from anywhere else, which is how an
 * open redirect gets built by accident.
 */
export function connectStartUrl(platform: string, userId: string, returnTo: string): string | null {
  const key = norm(platform);
  if (!canTapToConnect(key) || !userId) return null;
  const base = env("VITE_SOCIAL_CONNECT_START");
  const path = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
  const u = new URL(base, window.location.origin);
  u.searchParams.set("platform", key);
  u.searchParams.set("user_id", userId);
  u.searchParams.set("return_to", path);
  return u.toString();
}

/**
 * ⚠️ THE SECOND STEP IS A FRESH SIGN-IN AT THE PLATFORM, NOT A PHOTO QUIZ.
 *
 * I proposed showing the member nine thumbnails and asking them to pick the three from the
 * account they were claiming. TESTING took it apart on 8 October and they are right: **the
 * attacker we are defending against is somebody who already controls the account.** They can
 * open it and look at its posts. Most of those posts are public anyway. So the puzzle is a test
 * the thief passes as easily as the owner — it filters nobody and it costs the honest person
 * ten seconds and their patience. I argued for it; it was wrong.
 *
 * What actually separates the two is something only the real owner can produce ON DEMAND:
 *   1. a FRESH sign-in at the platform itself, forced, not a cached session — the stolen-session
 *      case fails here, and the platform's own risk engine gets a second look at them; or
 *   2. a possession check on a channel the member verified on their One ID BEFORE this
 *      connection attempt — their own phone or email on our side, which the platform thief has
 *      no reach into.
 *
 * Neither is a code to copy, so Lee's rule holds: the member taps, the platform asks, done.
 */
export interface ConnectReturn {
  platform: string;
  /** One-time reference. Exchanged server-side; never a token, and never stored. */
  ref: string;
  /** Present only when coming back from a forced fresh sign-in. The finalizer re-checks it. */
  stepUp?: string;
  error?: string;
}

export function readConnectReturn(search: string): ConnectReturn | null {
  const q = new URLSearchParams(search);
  const platform = q.get("connected");
  if (!platform) return null;
  return {
    platform: norm(platform),
    ref: q.get("ref") ?? "",
    stepUp: q.get("step_up") || undefined,
    error: q.get("error") ?? undefined,
  };
}

/**
 * Step up: send them back to the platform with a forced fresh sign-in. Same start address, one
 * extra parameter, so there is no second endpoint to deploy and no second thing to get wrong.
 *
 * ⚠️ The token that comes back is proof FOR THE SERVER. The client refusing to continue without
 * it is a courtesy to the member; **the finalizer must reject any connection whose verdict was
 * `check` and which carries no valid, unexpired, single-use step-up token.** A gate enforced
 * only in the browser is not a gate.
 */
export function stepUpUrl(platform: string, userId: string, returnTo: string): string | null {
  const base = connectStartUrl(platform, userId, returnTo);
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set("step_up", "1");
  u.searchParams.set("prompt", "login");   // force a fresh sign-in, never a cached session
  return u.toString();
}

/** Step 6, as one call, so a caller cannot forget to run it. */
export function judgeClaimedAccount(person: KnownPerson, account: ClaimedAccount): MatchVerdict {
  return matchIdentity(person, account);
}

/**
 * Step 7 — what the screen should do with a verdict. Kept here rather than in the component so
 * the rule is in one place and the same in every app that ever shows this.
 */
export function nextStepFor(v: MatchVerdict): "connect" | "challenge" | "stop" {
  return v.verdict === "pass" ? "connect" : v.verdict === "check" ? "challenge" : "stop";
}
