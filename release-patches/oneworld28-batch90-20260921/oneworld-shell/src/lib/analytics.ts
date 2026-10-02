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

/** Fire-and-forget route telemetry. It never blocks navigation and never sends query parameters. */
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
      },
    }).catch(() => undefined);
  }, [location.pathname, productKey]);
}

