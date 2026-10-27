/**
 * IN-APP BROWSERS — W:P0-AUTH (ORCHESTRATOR, 19 Oct 2026, 10:45 PM Central).
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Live logs: eight Google sign-in starts in a day, one came back, six of the eight from inside
 * Instagram's browser. Google refuses OAuth inside an embedded browser ("disallowed_useragent"),
 * so a member who tapped our link in Instagram could press "Continue with Google" all evening and
 * never be signed in.
 *
 * This is a UX AID, not a security boundary (Security, 19 Oct): user-agent sniffing can miss a
 * browser or name the wrong one. Getting it wrong only changes which door is offered first; every
 * door still works or fails on its own.
 *
 * The native One World app is NOT an in-app browser even though its Android WebView carries the
 * same "; wv)" marker: it sends OAuth out to the system browser (`oauthSignIn`).
 */
import { isNativeApp } from "./storeBuild";

export type InAppBrowser = { app: string; platform: "android" | "ios" | "other" };

const FAMILIES: Array<[RegExp, string]> = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i, "Facebook"],
  [/WhatsApp/i, "WhatsApp"],
  [/musical_ly|BytedanceWebview|TikTok|trill/i, "TikTok"],
  [/LinkedInApp/i, "LinkedIn"],
  [/\bLine\//i, "LINE"],
  [/Snapchat/i, "Snapchat"],
  [/Twitter|TwitterAndroid/i, "X"],
  [/MicroMessenger/i, "WeChat"],
];

/** Which embedded browser this page is running in, or null for a real browser / the native app. */
export function detectInAppBrowser(ua: string = typeof navigator !== "undefined" ? navigator.userAgent || "" : ""): InAppBrowser | null {
  if (isNativeApp()) return null;
  const platform: InAppBrowser["platform"] = /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : "other";
  for (const [re, app] of FAMILIES) if (re.test(ua)) return { app, platform };
  /* A generic Android WebView inside some other app. Chrome itself never carries "; wv)". */
  if (platform === "android" && /; wv\)/.test(ua)) return { app: "", platform };
  return null;
}

/* FIXED, trusted pieces only (Security, 19 Oct): the intent URL is never built from `next` or
   from the current address, so nothing a link carries can be smuggled into intent syntax, and a
   copied link never contains a code, a token or a callback. */
export const SIGNIN_HOST = "app.oneworldlabs.ai";
export const SIGNIN_URL = `https://${SIGNIN_HOST}/signin`;
export const CHROME_INTENT_URL = `intent://${SIGNIN_HOST}/signin#Intent;scheme=https;package=com.android.chrome;end`;
