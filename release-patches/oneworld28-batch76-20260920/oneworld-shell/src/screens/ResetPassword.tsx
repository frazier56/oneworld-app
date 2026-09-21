import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  decideMountPhase,
  recoveryEventUnlocks,
  performRequest,
  performReset,
  performAccountSetup,
} from "./resetRecovery";
import PasswordField, { PasswordChecklist } from "../components/PasswordField";
import { passwordAcceptable, isPasswordBreached } from "../lib/passwordRules";

/* ── STABLE, MODULE-SCOPE FIELD — the focus fix ──────────────────────────────────────────────
   This used to be declared INSIDE the component, so every keystroke re-created it as a new
   component type and React remounted the <input>, dropping the mobile keyboard after one letter —
   the exact bug the sign-up wizard already fixed. Hoisted here so the input keeps a stable
   identity across renders. Do NOT move a focusable field back inside the component. */
const Field = (p: {
  type: string; value: string; onChange: (v: string) => void;
  placeholder: string; autoComplete?: string; autoFocus?: boolean;
}) => (
  <input type={p.type} inputMode={p.type === "email" ? "email" : undefined}
    autoComplete={p.autoComplete} autoFocus={p.autoFocus} value={p.value} placeholder={p.placeholder}
    onChange={e => p.onChange(e.target.value)}
    className="card w-full rounded-2xl px-4 py-3.5 text-[16px] outline-none" />
);

/**
 * FORGOT / RESET PASSWORD — the shared recovery flow, one screen, two jobs.
 * ============================================================================================
 * Assigned by Max, 5 Aug 2026 (`MAX-20260805-1552`). It uses the ONE shared Supabase auth
 * client — no parallel auth, no second account flow — and lives at `/reset` on the single origin,
 * a neutral (bare) surface exactly like `/signin` and `/join`.
 *
 * Why one screen does both:
 *   • Arriving with NO recovery session  → REQUEST mode: enter an email, we send a reset link.
 *   • Arriving FROM the emailed link      → SET mode: a recovery session exists, set a new password.
 * That keeps the change to the frozen `SignIn.tsx` down to a single "Forgot password?" link.
 *
 * ── The recovery session, gated on real recovery context ─────────────────────────────────────
 * The client is PKCE with `detectSessionInUrl: true` (see `supabase.ts`), so when the person
 * lands here from the emailed `?code=…` link, auth-js exchanges it and fires `PASSWORD_RECOVERY`
 * (and/or a `SIGNED_IN` carrying the new session) on `onAuthStateChange`. We listen for that AND
 * read `getSession()` on mount, because the exchange may already be done by the time this
 * component renders. But SET mode unlocks ONLY on genuine recovery context — decided by
 * `resetRecovery.ts`: `PASSWORD_RECOVERY` always, or a `SIGNED_IN`/existing session only when the
 * URL was a recovery landing (`?code` / `type=recovery`). A member who is simply already signed in
 * and opens `/reset` — or an ordinary sign-in firing in another tab — gets the request form, not a
 * hijacked set-password screen. We never `await` inside the auth callback — auth-js holds the
 * storage lock while it fires and every PostgREST call resolves the session first, so awaiting
 * there deadlocks.
 *
 * ── Anti-enumeration, and RETURNED errors ────────────────────────────────────────────────────
 * A reset request must never reveal whether an email has an account. `resetPasswordForEmail`
 * returns `{ error }` (it does not throw), and it resolves with NO error for both known and unknown
 * emails — so a KNOWN and an UNKNOWN email get the byte-identical confirmation. A returned error is
 * therefore always a service condition (rate-limit, provider, config), never "unknown address": we
 * surface it as one generic, retryable message and stay non-enumerating. A thrown transport error
 * is treated the same. This handling lives in `performRequest`/`classifyRequestResult`.
 *
 * ── i18n ─────────────────────────────────────────────────────────────────────────────────────
 * English strings are inline here on purpose, the same way the sign-up wizard carries its own
 * dictionary rather than swelling `SHELL_STRINGS` (adding keys there throws at startup in all
 * eight products until all eight configs are edited). Translating this screen into the seven
 * languages is a follow-up gate, tracked in the claim matrix, not a reason to block the flow.
 */

type Phase =
  | "checking"      // deciding request-vs-set while the client settles the URL
  | "request"       // no recovery session: ask for an email
  | "requestSent"   // anti-enumeration confirmation
  | "set"           // recovery session present: set a new password
  | "expired"       // no recovery session AND arrived with a recovery-looking link that failed
  | "done";         // password changed, signing out, bouncing to /signin

const SIGN_IN = "/signin";

export default function ResetPassword() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [breached, setBreached] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const settled = useRef(false);

  const setupMode = (() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("setup") === "1";
  })();
  const setupLinkExpired = new URLSearchParams(window.location.search).get("setup") === "expired";
  const [setupToken] = useState(() => new URLSearchParams(window.location.search).get("setup_token") ?? "");
  const [setupRecoveryTokenHash] = useState(() => new URLSearchParams(window.location.search).get("recovery_token_hash") ?? "");
  const setupNext = (() => {
    const value = new URLSearchParams(window.location.search).get("next") ?? "/";
    return value.startsWith("/") && !value.startsWith("//") ? value : "/";
  })();

  /* Print the server's own sentence, never a friendly summary — a catch-all hid four root
     causes in a single week on this codebase. */
  const say = (e: unknown): string => {
    const m = (e as any)?.message ?? (e as any)?.error_description ?? (e as any)?.error;
    if (typeof m === "string" && m.trim()) return m;
    if (typeof e === "string" && e.trim()) return e;
    return "Something went wrong on our side. Try again in a moment.";
  };

  /* An arrival is a recovery link if the URL carries the PKCE `code` (query) or the legacy
     `type=recovery` (hash). We only use this to decide "was this MEANT to be a recovery landing"
     so a failed/expired exchange lands on a helpful `expired` screen instead of a bare request
     form with no explanation. */
  const looksLikeRecoveryLink = (): boolean => {
    try {
      const q = new URLSearchParams(window.location.search);
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      return q.has("code") || h.get("type") === "recovery" || q.get("type") === "recovery";
    } catch { return false; }
  };

  useEffect(() => {
    let alive = true;
    // Whether this was MEANT to be a recovery landing is decided once, from the URL as it was on
    // arrival, and gates everything below. A generic signed-in session with no recovery link must
    // never reach set mode.
    const isRecoveryLanding = looksLikeRecoveryLink();

    if (setupLinkExpired) {
      settled.current = true;
      setPhase("expired");
      return;
    }

    const toSetMode = () => {
      if (!alive || settled.current) return;
      settled.current = true;
      setPhase("set");
    };

    // The exchange may already be complete by first render. `decideMountPhase` gates set mode on
    // real recovery context, not on the mere presence of a session.
    /* Admin-generated recovery links currently return Supabase's legacy recovery tokens in the
       fragment even though the shared browser client otherwise uses PKCE. A PKCE client does not
       reliably consume that legacy fragment for us, which made a valid account-setup link look
       expired in a fresh browser. Import only this narrowly-scoped setup recovery session, then
       let the same recovery gate below decide the screen. Ordinary reset/sign-in URLs never take
       this path. */
    const settleSetupRecovery = async () => {
      if (!setupMode || !setupToken) return;
      if (setupRecoveryTokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: setupRecoveryTokenHash,
          type: "recovery",
        });
        if (error) throw error;
        return;
      }
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = h.get("access_token") ?? "";
      const refresh_token = h.get("refresh_token") ?? "";
      if (h.get("type") !== "recovery" || !access_token || !refresh_token) return;
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
    };

    settleSetupRecovery().then(() => supabase.auth.getSession()).then(({ data }) => {
      if (!alive || settled.current) return;
      const decision = decideMountPhase(!!data.session, isRecoveryLanding);
      if (decision === "set") { toSetMode(); return; }
      if (decision === "request") { setPhase("request"); return; }
      // "await": a recovery landing whose PKCE exchange has not settled — give it a moment, then
      // fall to `set` if it produced a session, or `expired` if the link was stale/reused.
      window.setTimeout(() => {
        if (!alive || settled.current) return;
        supabase.auth.getSession().then(({ data: d2 }) => {
          if (!alive || settled.current) return;
          settled.current = true;
          setPhase(d2.session ? "set" : "expired");
        });
      }, 1400);
    }).catch(() => {
      if (!alive || settled.current) return;
      settled.current = true;
      setPhase("expired");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Only genuine recovery unlocks set mode: PASSWORD_RECOVERY always; a PKCE SIGNED_IN only
      // when the URL was a recovery landing. An ordinary sign-in elsewhere must not unlock it.
      if (recoveryEventUnlocks(event, !!session, isRecoveryLanding)) {
        // Defer: never touch the client while it holds the storage lock in this callback.
        window.setTimeout(toSetMode, 0);
      }
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [setupLinkExpired]);

  /* Once PKCE has exchanged the recovery code, remove the private setup token from the address
     bar and browser history. Keep it only in component memory until the successful save. */
  useEffect(() => {
    if (phase !== "set" || !setupToken) return;
    const clean = new URL(window.location.href);
    clean.searchParams.delete("setup_token");
    clean.searchParams.delete("recovery_token_hash");
    clean.searchParams.delete("type");
    clean.hash = "";
    window.history.replaceState(null, "", `${clean.pathname}${clean.search}`);
  }, [phase, setupToken]);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  /* REQUEST — a healthy send always ends on the same confirmation, whether or not the address has
     an account. A RETURNED error (rate-limit / provider / config) or a thrown transport error is a
     service failure: one generic, retryable message, and never a user-not-found distinction —
     Supabase returns no error for unknown emails, so this branch never keys on account existence. */
  const requestReset = async () => {
    if (!emailOk) return;
    setErr(null); setBusy(true);
    const outcome = await performRequest(supabase, email, window.location.origin);
    setBusy(false);
    if (outcome === "serviceError") {
      setErr("We couldn't send a reset link right now. Please try again in a moment.");
      return;
    }
    setPhase("requestSent");   // identical result whether or not that address has an account
  };

  /* Debounced breach check — the SAME policy as sign-up (shared passwordRules). Fail-open. */
  useEffect(() => {
    if (pw.length < 10) { setBreached(null); return; }
    setBreached(null);
    let alive = true;
    const id = window.setTimeout(async () => {
      const b = await isPasswordBreached(pw);
      if (alive) setBreached(b);
    }, 500);
    return () => { alive = false; window.clearTimeout(id); };
  }, [pw]);

  /* SET — write the new password on the recovery session, then take the safest disposition:
     sign OUT everywhere so a reused recovery link or a shared device cannot stay authenticated.
     `performReset` reads the RETURNED sign-out error and falls back to a local sign-out if global
     revocation failed, so this device is signed out either way and we never claim a global
     revocation that did not happen. On success we send the person to the neutral sign-in to log
     in fresh — never a new account, never `/join`. */
  const setNewPassword = async () => {
    if (!passwordAcceptable(pw, pw2, breached)) {
      setErr(breached === true
        ? "That password has appeared in a known data breach — please choose another."
        : "Your password doesn't meet all the rules yet.");
      return;
    }
    setErr(null); setBusy(true);
    const result = setupMode
      ? await performAccountSetup(supabase, pw)
      : await performReset(supabase, pw);
    if (!result.ok) { setBusy(false); setErr(say(result.error)); return; }
    if (setupMode) {
      const { error: finalizeError } = await supabase.functions.invoke("redeem-account-setup", {
        method: "POST",
        body: { token: setupToken },
      });
      if (finalizeError) {
        setBusy(false);
        setErr("Your password was saved, but setup could not be finalized. Select Save new password again.");
        return;
      }
    }
    setPhase("done");
    window.location.replace(setupMode ? setupNext : `${SIGN_IN}?reset=success`);
  };

  const Primary = (p: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button onClick={p.onClick} disabled={p.disabled}
      className="ow-tap btn-primary w-full rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-50">
      {p.children}
    </button>
  );

  const BackToSignIn = () => (
    <Link to={SIGN_IN} className="ow-tap mt-4 block text-center text-[13px] font-medium opacity-55">
      Back to sign in
    </Link>
  );

  const Head = (p: { title: string; sub?: string }) => (
    <div className="mb-1 text-center">
      <h1 className="text-[19px] font-extrabold tracking-tight">{p.title}</h1>
      {p.sub && <p className="mt-1 text-[13px] opacity-55">{p.sub}</p>}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-sm space-y-4 py-6">
      {phase === "checking" && (
        <div className="py-16 text-center opacity-40">…</div>
      )}

      {phase === "request" && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (emailOk && !busy) void requestReset(); }}>
          <Head title="Reset your password" sub="Enter your email and we'll send you a reset link." />
          <Field type="email" value={email} onChange={setEmail}
            placeholder="you@example.com" autoComplete="username" autoFocus />
          {err && <p className="text-[13px] font-medium text-red-500">{err}</p>}
          <Primary onClick={() => void requestReset()} disabled={!emailOk || busy}>
            {busy ? "…" : "Send reset link"}
          </Primary>
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
          <BackToSignIn />
        </form>
      )}

      {phase === "requestSent" && (
        <>
          <Head
            title="Check your email"
            sub="If an account exists for that email, we've sent a link to reset your password. It expires soon, so use it right away." />
          <BackToSignIn />
        </>
      )}

      {phase === "set" && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (passwordAcceptable(pw, pw2, breached) && !busy) void setNewPassword(); }}>
          <Head
            title={setupMode ? "Finish setting up your account" : "Choose a new password"}
            sub={setupMode
              ? "Choose your password. You’ll continue directly to your existing account."
              : "Enter it twice so we know it's right."} />
          <PasswordField value={pw} onChange={setPw} placeholder="New password" autoComplete="new-password" autoFocus />
          <PasswordField value={pw2} onChange={setPw2} placeholder="Confirm new password" autoComplete="new-password" />
          {pw.length > 0 && <PasswordChecklist pw={pw} pw2={pw2} breached={breached} />}
          {err && <p className="text-[13px] font-medium text-red-500">{err}</p>}
          <Primary onClick={() => void setNewPassword()} disabled={!passwordAcceptable(pw, pw2, breached) || busy}>
            {busy ? "…" : "Save new password"}
          </Primary>
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
        </form>
      )}

      {phase === "expired" && (
        <>
          <Head
            title="This reset link has expired"
            sub="Reset links are single-use and time out quickly. Request a fresh one and use it right away." />
          <Primary onClick={() => { setErr(null); setPhase("request"); }}>Request a new link</Primary>
          <BackToSignIn />
        </>
      )}

      {phase === "done" && (
        <div className="py-16 text-center opacity-60">
          {setupMode ? "Account ready. Opening your property…" : "Password changed. Taking you to sign in…"}
        </div>
      )}
    </div>
  );
}
