import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { readPref, writePref } from "./safeStorage";
import { supabase } from "./supabase";

const VISITOR_KEY = "ow_analytics_visitor_v1";
const SESSION_KEY = "ow_analytics_session_v1";
let memorySession = "";

const uuid = () => {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
};

function visitorId() {
  const found = readPref(VISITOR_KEY);
  if (found && found.length >= 16) return found;
  const made = uuid();
  writePref(VISITOR_KEY, made);
  return made;
}

function sessionId() {
  try {
    const found = sessionStorage.getItem(SESSION_KEY);
    if (found && found.length >= 16) return found;
    const made = uuid();
    sessionStorage.setItem(SESSION_KEY, made);
    return made;
  } catch {
    if (!memorySession) memorySession = uuid();
    return memorySession;
  }
}

/** Removes IDs, tokens, emails, and all query/hash data before a route leaves the browser. */
export function privacySafePath(pathname: string) {
  return (pathname || "/").split("/").map((segment) => {
    if (!segment) return segment;
    const decoded = (() => { try { return decodeURIComponent(segment); } catch { return segment; } })();
    if (/^[0-9]+$/.test(decoded)) return ":id";
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(decoded)) return ":id";
    if (decoded.includes("@")) return ":email";
    if (decoded.length >= 24 && /^[a-z0-9_-]+$/i.test(decoded)) return ":token";
    return decoded.slice(0, 80);
  }).join("/").slice(0, 300) || "/";
}

function safeReferrer() {
  if (!document.referrer) return "";
  try {
    const url = new URL(document.referrer);
    return url.origin === window.location.origin ? `${url.origin}${privacySafePath(url.pathname)}` : url.origin;
  } catch { return ""; }
}

function analyticsProduct(key: string) {
  if (key === "onerental" || key === "onesale") return "onehome";
  return key || "oneworld";
}

/* ── HOW DID THIS VISIT GET HERE ─────────────────────────────────────────────────────────────
 * Lee, 3 Oct 2026: "Did they come in through SEO … AI search … a video … a link I sent them …
 * a promo code?" None of that could be answered: this file deliberately sent NO query
 * parameters, so the `src=agent-video-es3` on every video's button, a `utm_source=chatgpt.com`
 * that ChatGPT adds to its links, a `c=` campaign tag and a `promo=` code all died in the
 * browser. Only a member who later signed up kept a source (entryContext), and a visitor who
 * never signed up was always "direct".
 *
 * Still privacy-first: ONLY the marketing tags below leave the browser, each cut to 80
 * characters. Tokens, ids, emails, search text and every other parameter stay where they were.
 * Ad-click ids (gclid / fbclid / ttclid) are sent as a flag, never their value. The tags ride on
 * the FIRST page view of a visit, which is the only place a landing is decided. */
const TAGS = ["src", "ref", "c", "promo", "qr", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CLICK_IDS = ["gclid", "fbclid", "ttclid"] as const;
const LANDED_KEY = "ow_analytics_landed_v1";

function landingTags(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  try {
    const q = new URL(window.location.href).searchParams;
    for (const key of TAGS) {
      const value = q.get(key);
      if (value !== null) out[key] = value.replace(/[^\p{L}\p{N} ._:/+-]/gu, "").slice(0, 80) || true;
    }
    for (const key of CLICK_IDS) if (q.has(key)) out[key] = true;
  } catch { /* a malformed URL never blocks a page view */ }
  return out;
}

function firstOfVisit(): boolean {
  try {
    if (sessionStorage.getItem(LANDED_KEY)) return false;
    sessionStorage.setItem(LANDED_KEY, "1");
    return true;
  } catch { return false; }
}

/** One event, fire-and-forget. Used for things that are not a route change: the bot check on
 *  sign-in, and anything a screen wants counted. Never throws, never blocks. */
export function trackEvent(eventName: string, category: string, metadata: Record<string, string | number | boolean> = {},
                           productKey = "oneworld") {
  try {
    if (typeof window === "undefined") return;
    const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (navigator.doNotTrack === "1" || privacyNavigator.globalPrivacyControl) return;
    void supabase.functions.invoke("track-oneworld-event", {
      body: {
        event_name: eventName,
        event_category: category,
        product: analyticsProduct(productKey),
        page_path: privacySafePath(window.location.pathname),
        referrer: safeReferrer(),
        visitor_id: visitorId(),
        session_id: sessionId(),
        screen_width: window.screen?.width ?? 0,
        screen_height: window.screen?.height ?? 0,
        metadata,
      },
    }).catch(() => undefined);
  } catch { /* telemetry never breaks a screen */ }
}

/** Fire-and-forget route telemetry. It never blocks navigation. The only query values it sends
 *  are the marketing tags above, on the first page view of a visit. */
export function useRouteAnalytics(productKey: string) {
  const location = useLocation();
  const last = useRef("");
  useEffect(() => {
    if (typeof window === "undefined" || location.pathname.startsWith("/admin")) return;
    const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (navigator.doNotTrack === "1" || privacyNavigator.globalPrivacyControl) return;
    const pagePath = privacySafePath(location.pathname);
    const key = `${analyticsProduct(productKey)}:${pagePath}`;
    if (last.current === key) return;
    last.current = key;
    const tags = firstOfVisit() ? { ...landingTags(), landing: true } : landingTags();
    void supabase.functions.invoke("track-oneworld-event", {
      body: {
        event_name: "page_view",
        event_category: "navigation",
        product: analyticsProduct(productKey),
        page_path: pagePath,
        referrer: safeReferrer(),
        visitor_id: visitorId(),
        session_id: sessionId(),
        screen_width: window.screen?.width ?? 0,
        screen_height: window.screen?.height ?? 0,
        metadata: tags,
      },
    }).catch(() => undefined);
  }, [location.pathname, productKey]);
}
