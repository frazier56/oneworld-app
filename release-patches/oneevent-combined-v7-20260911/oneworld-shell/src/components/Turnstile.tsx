import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile — the bot check on the join screen.
 *
 * Widget "OneJob signup", created 29 Jul 2026 on the Cloudflare account, Managed mode, scoped to
 * oneworldlabs.ai / www.oneworldlabs.ai / onesocial.ai / frazier56.github.io / localhost.
 *
 * ── WHAT THIS COMPONENT IS AND IS NOT ───────────────────────────────────────────────────────────
 * This is the CLIENT half. It renders the challenge and produces a token. On its own it stops
 * nothing at all — an attacker hitting the auth endpoint directly never loads this file. The token
 * only becomes a defence when the server verifies it against Cloudflare's siteverify API before
 * doing anything expensive (sending an email, sending an SMS, creating a user). That check lives in
 * the edge function. If you ever find yourself trusting this component's `onToken` without a
 * server-side verification behind it, the captcha is decorative.
 *
 * ── WHY THE SITE KEY IS HARDCODED ───────────────────────────────────────────────────────────────
 * The site key is public by design. It ships in every page that renders the widget and Cloudflare
 * publishes it as such. The SECRET key is the one that matters and it lives only in Supabase Edge
 * Function Secrets as TURNSTILE_SECRET_KEY, never in this repo.
 *
 * ── FAILURE POSTURE ─────────────────────────────────────────────────────────────────────────────
 * If the script is blocked — a privacy extension, a corporate proxy, a country that can't reach
 * Cloudflare — this reports `unavailable` rather than hanging. The screen stays usable: the server
 * decides what to do about a missing token. Silently trapping a real person on a sign-up screen
 * because their ad blocker ate a script is a worse outcome than the bot we were trying to stop.
 */

const SITE_KEY = "0x4AAAAAAEAsMHkBsF_CmIVg";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window { turnstile?: any }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script blocked"));
    document.head.appendChild(s);
    // Belt and braces: a proxy that hangs the request rather than failing it would leave onerror
    // unfired forever, and with it the sign-up button disabled forever.
    setTimeout(() => reject(new Error("turnstile script timeout")), 10000);
  });
  return scriptPromise;
}

export default function Turnstile({ onToken, theme = "auto" }: {
  onToken: (token: string | null, status: "loading" | "ok" | "expired" | "error" | "unavailable") => void;
  theme?: "auto" | "light" | "dark";
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "recovery" | "unavailable">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let dead = false;
    loadTurnstile()
      .then(() => {
        if (dead || !boxRef.current || !window.turnstile) return;
        setState("ready");
        widgetId.current = window.turnstile.render(boxRef.current, {
          sitekey: SITE_KEY,
          theme,
          callback: (token: string) => onToken(token, "ok"),
          "expired-callback": () => { setState("recovery"); onToken(null, "expired"); },
          "error-callback": () => { setState("recovery"); onToken(null, "error"); },
        });
      })
      .catch(() => {
        if (dead) return;
        setState("unavailable");
        onToken(null, "unavailable");
      });
    return () => {
      dead = true;
      try { if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current); } catch { /* already gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, theme]);

  const retry = () => {
    try { if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current); } catch { /* already gone */ }
    widgetId.current = null;
    scriptPromise = window.turnstile ? Promise.resolve() : null;
    setState("loading");
    onToken(null, "loading");
    setAttempt(value => value + 1);
  };

  if (state === "unavailable" || state === "recovery") {
    const expired = state === "recovery";
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-center">
        <p className="text-[13px] font-bold text-foreground">
          {expired ? "The security check expired." : "The security check could not start."}
        </p>
        <p className="mt-1 text-[12px] leading-snug opacity-65">
          {expired ? "Start a fresh check to continue signing in." : "Check your connection or Cloudflare blocker, then try again."}
        </p>
        <button type="button" onClick={retry}
          className="ow-tap mt-3 min-h-[40px] rounded-xl border border-current/15 px-4 text-[13px] font-bold text-brand">
          Restart security check
        </button>
      </div>
    );
  }
  return <div ref={boxRef} className="flex justify-center" aria-label="Bot check" />;
}
