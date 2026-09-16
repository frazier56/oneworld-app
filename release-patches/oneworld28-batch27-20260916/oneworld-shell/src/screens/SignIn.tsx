import OneWorldHomeLink from "../components/OneWorldHomeLink";
import CodeBoxes from "../components/CodeBoxes";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

import { useI18n, W } from "../lib/i18n";
import { sendEmailOtp } from "../lib/emailOtp";
import { OneIdNotice, recordOneIdNotice } from "../lib/oneId";
import Turnstile from "../components/Turnstile";
import LangPicker from "../components/LangPicker";
import ProviderDoors, { oauthSignIn, PENDING_NOTICE_KEY, stampPendingNotice } from "../components/ProviderDoors";
import { flushEntry } from "../lib/entryContext";
import { safeAuthReturn, signUpHref } from "../lib/authReturn";

/**
 * THE SIGN-IN SCREEN — ONE COMPONENT, FIVE DICTIONARIES.
 * ============================================================================
 * Lee, 2 August 2026:
 *
 *   "We need consistent logins across all the apps… the splash page, then the login page, all of
 *    that needs to be the same. Same format, same look. It's just gonna have different words. The
 *    messages and the text are gonna be different, but the boxes, how you log in, your options —
 *    they all need to be the same."
 *
 * So this file is imported by all five apps and never forked. The words come from the app's
 * dictionary; the structure does not vary. The option ORDER never varies either — somebody
 * signing into two apps in one week should not have to hunt for the button.
 *
 *   1. Google
 *   2. Apple
 *   3. Email -> 6-digit code
 *
 * ── The redirect, and the week it cost ───────────────────────────────────────────────────────
 * `redirectTo` must be THIS app's own origin. Supabase silently falls back to the project's Site
 * URL when the value sent is not on the Redirect URLs allowlist — and because the Site URL used
 * to be `https://onesocial.ai`, every app subdomain quietly bounced a signed-in user onto a
 * DIFFERENT registrable domain, where the session cookie could not follow. It read as "sign-in
 * doesn't hold". It was an allowlist entry.
 *
 * Two things to get right per app, and both are easy to half-do:
 *   · Add BOTH `https://<app>.oneworldlabs.ai` AND `https://<app>.oneworldlabs.ai/**`.
 *     The wildcard does NOT match the bare origin.
 *   · `www.oneworldlabs.ai` and `oneworldlabs.ai` are two separate entries.
 *
 * Prove it, don't assume it:
 *   curl -sI "https://<ref>.supabase.co/auth/v1/verify?token=x&type=magiclink\
 *   &redirect_to=https://<app>.oneworldlabs.ai/app/home" | grep -i location
 */

type Mode = "idle" | "emailCode" | "code" | "password";

/**
 * WHICH PROVIDERS ARE ACTUALLY SWITCHED ON — asked, not assumed.
 * ============================================================================================
 * The Apple button shipped and rendered for weeks while the Apple provider was DISABLED in
 * Supabase. Every tap returned "Unsupported provider". Worse, it sent me debugging Apple's POST
 * callback behaviour — a real problem, but one strictly downstream of a provider that had never
 * been turned on.
 *
 * A button that cannot work is worse than a missing button: it looks like the product is broken
 * rather than like the option does not exist yet.
 *
 * So the screen asks. `/auth/v1/settings` is a public, unauthenticated endpoint that reports
 * exactly which external providers are live. Buttons render only for the ones that are — which
 * also means Apple appears by itself, with no code change, the moment the provider is configured.
 *
 * Fails OPEN to Google + email: if the probe cannot be reached, showing the two providers that
 * have always been on beats showing an empty sign-in screen.
 */

/** Set before an OAuth redirect, read when we land back signed in. */

/**
 * STAMP THE ONE ID DISCLOSURE ONCE THE PERSON IS ACTUALLY SIGNED IN.
 *
 * An OAuth sign-up leaves the page entirely, so nothing on the sign-in screen can record
 * anything about it — the evidence has to be written on the way back, by which time there is a
 * real `auth.uid()` for the row to belong to.
 *
 * Mount this high in the app once. It is idempotent: the key is cleared as soon as the row is
 * written, and `record_one_id_notice` is safe to call more than once.
 */
export function useOneIdNoticeStamp() {
  useEffect(() => {
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive || !session) return;
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      /* ── ENTRY CONTEXT RIDES THE SAME MOMENT ─────────────────────────────────────────
         "How did this person get here" is captured before there is an account and can only be
         written once there is one. That is the identical order problem the disclosure stamp
         solves, at the identical instant, so it flushes here rather than growing a second
         auth listener that fires at the same time for the same reason. Deferred with everything
         else — never call Supabase while auth-js holds the storage lock. */
      setTimeout(() => { void flushEntry(); }, 0);

      let pending: string | null = null;
      try { pending = localStorage.getItem(PENDING_NOTICE_KEY); } catch { /* private mode */ }
      if (!pending) return;
      /* Deferred: never call Supabase inside this callback while it holds the storage lock. */
      setTimeout(() => {
        recordOneIdNotice(pending!, { ecosystem_account: true })
          .then(() => { try { localStorage.removeItem(PENDING_NOTICE_KEY); } catch { /* ignore */ } })
          .catch(() => { /* leave the key so the next sign-in retries */ });
      }, 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
}

/* ── THE DEFAULT DESTINATION IS THE ORIGIN, NOT A PRODUCT ───────────────────────────────────
   This has now been the same bug three times wearing three different hats: `autoForward` on the
   entry screen, `landingPath(null)` in AuthGate, and this default parameter — the last one left.

   Lee, 4 Aug 2026, after creating a brand-new account from the company's own front door:
   *"It actually takes me to OneJob again, which is not correct. It should have taken me to One
   World Labs, because that's where I started a brand new account from. So why am I on the OneJob
   screen?"*

   Because every one of these fallbacks quietly answered "which product?" with OneJob. A caller
   that does not name a destination has not earned one: send them to `/`, which renders One World.
   A product that genuinely wants somebody back on its own screen passes `next` explicitly, which
   AuthGate already does. */
export default function SignIn({ next: requestedNext = "/yourworld" }: { next?: string }) {
  const next = safeAuthReturn(requestedNext);
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState<null | "google" | "apple" | "email">(null);
  useEffect(() => {
    const resume = () => setBusy(null);
    window.addEventListener("pageshow", resume);
    return () => window.removeEventListener("pageshow", resume);
  }, []);
  /* THE BOT CHECK. Lee, 3 Aug 2026: *"there was no captcha thing in place… usually there's a
     capture thing right above the call-to-action button at the bottom. We should definitely have
     that captcha in place like we normally do."*

     `null` means the widget has not answered yet; `""` means it could not load (blocked script,
     corporate proxy, a country that cannot reach Cloudflare) and the human must NOT be trapped —
     the server decides what to do about a missing token. Trapping a real person on a sign-up
     screen because their ad blocker ate a script is a worse outcome than the bot. */
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaStatus, setCaptchaStatus] = useState<"loading" | "ok" | "expired" | "error" | "unavailable">("loading");
  /* A Turnstile token is SINGLE-USE and expires. `captchaNonce` is the widget's React key;
     bumping it after a consuming auth attempt mints a fresh token for a retry. */
  const [captchaNonce, setCaptchaNonce] = useState(0);
  /* Email/password requests require a completed challenge in production. Google remains available
     without it, while an expired or blocked email challenge exposes its own in-place retry. */
  const remintCaptcha = () => { setCaptcha(null); setCaptchaStatus("loading"); setCaptchaNonce(n => n + 1); };
  const captchaBusy = captchaStatus !== "ok";
  const [mode, setMode] = useState<Mode>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  /* No One ID behind the email they typed — a state, not an error string, because it renders
     with the door to /join rather than as red text. (P0 sign-in guard, see sendCode.) */
  const [noAccount, setNoAccount] = useState(false);

  /* ── NEVER RENDER AN ERROR OBJECT ────────────────────────────────────────────────────────
     Lee, 4 Aug 2026: *"it gives those two red parenthesis brackets and the screen doesn't do
     anything."* Those brackets were `{}` — the sign-up call returned
     `{"code":"unexpected_failure","message":"Database error saving new user"}`, and the client
     read `.message` off a shape that did not carry one, so React printed the object.

     The underlying database fault is fixed. This is the second half: whatever comes back, the
     person gets a sentence. An error a customer cannot read is the same as no error at all —
     they sit on a dead screen and leave. */
  const say = (e: unknown): string => {
    const m = (e as any)?.message ?? (e as any)?.error_description ?? (e as any)?.error;
    if (typeof m === "string" && m.trim()) return m;
    if (typeof e === "string" && e.trim()) return e;
    return "Something went wrong on our side. Try again in a moment — nothing was charged and no account was created.";
  };

  /* This app's own origin, always. Never a hard-coded host, and never `location.href` — a
     query string or hash on the current URL would ride along into the redirect and Supabase
     would compare a value the allowlist has never seen. */
  const redirectTo = `${window.location.origin}${next}`;

  const oauth = async (provider: "google" | "apple") => {
    setErr(null); setBusy(provider);
    /* THE DISCLOSURE IS RECORDED AFTER THE ROUND TRIP, NOT HERE — see `useOneIdNoticeStamp`.
       My first attempt stamped it on this line, before `signInWithOAuth`. That is a guaranteed
       no-op twice over: the caller is still `anon`, so `auth.uid()` is null and
       `record_one_id_notice` raises "not signed in"; and `anon` has no EXECUTE on the function
       to begin with. Because the call was `void`-ed, both failures were silent.
       Google is button #1, so every OAuth account would have been created with no notice
       timestamp and no consent row — exactly the GDPR Art. 13 / Ley 1581 evidence this exists to
       produce. Remembering the language across the redirect is what `pendingLocale` is for. */
    stampPendingNotice(lang);
    const { error } = await oauthSignIn(provider, redirectTo);
    if (error) { setErr(say(error)); setBusy(null); }
  };

  const sendCode = async () => {
    if (!email.includes("@")) { setErr(t("validEmail")); return; }
    if (captchaBusy) { setErr("Complete or restart the security check to continue."); return; }
    setErr(null); setNoAccount(false); setBusy("email");
    /* The token rides along with the request. Server-side enforcement is a PROJECT-WIDE switch on
       the shared database, and turning it on used to break every sibling app that did not send a
       token. That reason is now gone: all eight products share this one sign-in screen, so once
       this ships everywhere the switch can finally be turned on. Until it is, treat the captcha as
       DECORATIVE and do not record it as a working bot gate. */
    /* ── NOT `signInWithOtp` — SEE `lib/emailOtp.ts` ────────────────────────────────────────
       The SDK helper reads `flowType` off the client and, because ours is `pkce` (correctly, for
       OAuth), posts a `code_challenge` on every call. GoTrue then stores a `pkce_`-prefixed
       token while `verifyOtp` submits the bare six digits, so the code in the email could never
       verify. Confirmed in `auth.one_time_tokens` and in auth-js 2.112.2 source, after the auth
       logs disproved my first explanation. */
    /* ── shouldCreateUser: FALSE — THE /signin P0 GUARD (OneHome UAT; re-asserted v23r2) ──
       `lib/emailOtp.ts` defaults `create_user` to true, so without this flag the SIGN-IN
       screen silently mints brand-new accounts — outside the phone/name/location/password
       signup wizard entirely. Sign-in signs in; only /join creates. (Max caught v23's cut
       reverting this — MAX-20260818-ONEEVENT-V23-BLOCKED-SIGNIN-REGRESSION.) */
    const { error } = await sendEmailOtp(email, { captchaToken: captcha, shouldCreateUser: false });
    setBusy(null);
    remintCaptcha();   // single-use token spent — mint a fresh one for a resend/retry
    if (error) {
      /* No account behind that email → a real answer with the real door, not a dead error.
         GoTrue says "Signups not allowed for otp" when create_user is false and no user exists. */
      const msg = String((error as any)?.message || (error as any)?.error_description || "");
      if (/signup|not allowed|otp_disabled|user.*not.*found/i.test(msg)) {
        setNoAccount(true);
      } else {
        setErr(say(error));
      }
    } else {
      setMode("code");
    }
  };

  const signInWithPassword = async () => {
    if (!email.includes("@")) { setErr(t("validEmail")); return; }
    if (!password) {
      setErr(W(lang, "Enter your password.", "Escribe tu contraseña."));
      return;
    }
    if (captchaBusy) {
      setErr(W(lang, "Complete or restart the security check to continue.", "Completa o reinicia la verificación de seguridad para continuar."));
      return;
    }
    if (!captcha) {
      setErr(W(lang, "Complete the browser check first.", "Completa primero la verificación del navegador."));
      return;
    }
    setErr(null); setNoAccount(false); setBusy("email");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(), password, options: { captchaToken: captcha },
    });
    setBusy(null);
    remintCaptcha();
    if (error) {
      setErr(W(lang, "That email or password is not correct.", "El correo o la contraseña no son correctos."));
      return;
    }
    window.location.replace(next);
  };

  /* Same single-use guard as the sign-up wizard. `CodeBoxes` auto-submits on the sixth digit AND
     there is a Verify button, so the same token could go up twice: the first spends it and signs
     you in, the second returns "Token has expired or is invalid" and paints that over a sign-in
     that worked. Refs, because this must be true before the next render rather than after it. */
  const verifying = useRef(false);
  const spentTokens = useRef<Set<string>>(new Set());

  const verify = async (explicit?: string) => {
    const token = (explicit ?? code).trim();
    if (token.length < 6) return;          // never send an empty token to /verify
    if (verifying.current || spentTokens.current.has(token)) return;
    verifying.current = true;
    spentTokens.current.add(token);
    setErr(null); setBusy("email");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(), token, type: "email",
    });
    setBusy(null);
    verifying.current = false;
    if (error) { setErr(say(error)); return; }
    /* Proof that the One ID disclosure was shown, stamped the moment the account becomes
       real. GDPR Art. 13 wants notice at collection; Colombia's Ley 1581 additionally
       requires KEEPING evidence of the authorization. A timestamp is the cheapest way to
       be able to prove it a year from now. */
    await recordOneIdNotice(lang, { ecosystem_account: true });
    window.location.replace(next);
  };

  return (
    <div className="mx-auto w-full max-w-sm space-y-3">
      {/* Language recovery must remain available before authentication. A person who lands in
          the wrong language cannot reasonably navigate through profile settings to fix it. */}
      <div className="flex justify-center pb-2">
        <LangPicker dropUp={false} />
      </div>
      {/* ── ONE ID BELONGS HERE, NOT ON THE SPLASH ───────────────────────────────────────────
          Lee, 4 Aug 2026, sending the hub's "Sign in with One ID" pill: *"I don't know if it
          works on the next page or on this page. I think it can work on this page. You know, but
          if you put it on this page, then it's gonna be biased towards Google."*

          His own objection is the answer, and it decides it. That hub pill is a GOOGLE button
          wearing the One ID name. On the splash it would make Google look like the only door and
          push email — the option most people in Colombia will actually use — behind a "more
          options" tap. It would also have to be redesigned the day Apple is switched on.

          So the splash keeps one neutral "Sign in", and THIS screen — the one whose whole job is
          "which door" — carries the One ID name at the top, above all the doors equally. One ID
          is what you get; Google and email are how you get it. Naming the brand above the
          providers is true in a way that naming it on one provider is not.

          The Google button keeps the Google mark and honest wording, which is also what Google's
          own branding terms require. */}
      <div className="mb-1 flex items-center justify-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-brand/15">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
               className="text-brand" aria-hidden>
            <path d="M12 2 4 5.5v6c0 4.6 3.2 8.6 8 10.5 4.8-1.9 8-5.9 8-10.5v-6z" />
            <path d="m8.8 12.2 2.1 2.1 4.3-4.6" />
          </svg>
        </span>
        <span className="text-[13px] font-extrabold tracking-tight text-brand">One ID</span>
        <span className="text-[12px] opacity-45">· one account, all apps</span>
      </div>

      {mode === "idle" ? (
        <>
          {/* The landing screen contains choices only: Google first, password second, email code
              third. No email can be sent until the person deliberately chooses the code path. */}

          {/* 1 — THE TOP THIRD. Not empty for its own sake: it is the part of a phone screen a
              thumb has to stretch for, so it carries the sentence and not the button. */}
          <div className="pt-6 pb-1 text-center">
            <h1 className="text-[22px] font-extrabold tracking-tight">
              {W(lang, "Welcome back", "Bienvenido de nuevo")}
            </h1>
            <p className="mt-1 text-[13.5px] leading-snug opacity-55">
              {W(lang, "Sign in to continue.", "Inicia sesión para continuar.")}
            </p>
          </div>

          {/* Google first, password second, email code third, then Apple. Injecting the two email
              choices into the shared provider stack keeps Apple available without placing it
              between Google and the password door. */}
          <ProviderDoors onPick={p => void oauth(p)} busy={!!busy} afterGoogle={(
            <>
              <div className="flex items-center gap-3 py-1 text-[11px] font-semibold uppercase tracking-widest opacity-35">
                <span className="h-px flex-1 bg-current" />{W(lang, "or", "o")}<span className="h-px flex-1 bg-current" />
              </div>

              <button type="button" onClick={() => { setMode("password"); setErr(null); }} disabled={!!busy}
                className="ow-tap card grid min-h-[46px] w-full place-items-center rounded-2xl px-4 text-[14px] font-semibold disabled:opacity-50">
                {W(lang, "Sign in with email and password", "Ingresar con correo y contraseña")}
              </button>

              <button type="button" onClick={() => { setMode("emailCode"); setErr(null); }} disabled={!!busy}
                className="ow-tap card grid min-h-[46px] w-full place-items-center rounded-2xl px-4 text-[14px] font-semibold disabled:opacity-50">
                {W(lang, "Use a 6-digit email code", "Usar un código de 6 dígitos")}
              </button>
            </>
          )} />

        </>
      ) : mode === "emailCode" ? (
        <>
          <button type="button" onClick={() => { setMode("idle"); setErr(null); }}
            className="ow-tap min-h-[40px] self-start text-[13px] font-semibold opacity-65">
            ← {W(lang, "Back to sign-in options", "Volver a las opciones")}
          </button>
          <div className="pt-2 text-center">
            <h1 className="text-[22px] font-extrabold tracking-tight">
              {W(lang, "Email me a sign-in code", "Envíame un código por correo")}
            </h1>
            <p className="mt-1 text-[13.5px] opacity-55">
              {W(lang, "We'll send one six-digit code.", "Enviaremos un código de seis dígitos.")}
            </p>
          </div>
          <input type="email" inputMode="email" autoComplete="email" autoFocus
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="card w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none" />
          <button onClick={sendCode} disabled={!email.includes("@") || captchaBusy || !!busy}
            className="ow-tap btn-primary w-full rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-50">
            {busy === "email" ? "…" : W(lang, "Send 6-digit code", "Enviar código de 6 dígitos")}
          </button>
          <button type="button" onClick={() => { setMode("password"); setErr(null); }}
            className="ow-tap grid min-h-[40px] w-full place-items-center rounded-xl text-[13px] font-semibold text-brand">
            {W(lang, "Use password instead", "Usar contraseña")}
          </button>
        </>
      ) : mode === "code" ? (
        <>
          {/* ── SIX BOXES, NOT ONE LONG FIELD ────────────────────────────────────────────
              Lee, 4 Aug 2026: *"that should be six boxes, like rounded type little boxes that
              the code goes into. Not one long thing. That's the standard practice."*

              He is right, and the old field had a second defect that the boxes remove for free:
              the placeholder inherited `tracking-[0.4em]`, so "Enter the code" rendered as
              "Enter the co" — letter-spacing meant for six digits applied to sixteen letters.
              Boxes carry no placeholder at all, so the instruction moves up into the sentence
              above, where it belongs. */}
          <p className="text-center text-sm opacity-70">{t("codeSent")}</p>
          <CodeBoxes value={code} invalid={!!err} onChange={value => { setCode(value); setErr(null); }} onComplete={(c) => { void verify(c); }} />
          <button onClick={() => void verify()} disabled={code.length < 6 || !!busy}
            className="ow-tap btn-primary w-full rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-50">
            {busy === "email" ? "…" : t("verify")}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => { setMode("idle"); setPassword(""); setErr(null); }}
            className="ow-tap min-h-[40px] self-start text-[13px] font-semibold opacity-65">
            ← {W(lang, "Back to sign-in options", "Volver a las opciones")}
          </button>
          <div className="pt-2 text-center">
            <h1 className="text-[22px] font-extrabold tracking-tight">
              {W(lang, "Sign in with email and password", "Ingresa con correo y contraseña")}
            </h1>
          </div>
          <input type="email" inputMode="email" autoComplete="username webauthn" autoFocus
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="card w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none" />
          <input type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void signInWithPassword(); }}
            placeholder={W(lang, "Password", "Contraseña")}
            className="card w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none" />
          <button type="button" onClick={() => void signInWithPassword()} disabled={!password || captchaBusy || !!busy}
            className="ow-tap btn-primary w-full rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-50">
            {busy === "email" ? "…" : W(lang, "Sign in", "Ingresar")}
          </button>
          <Link to="/reset"
            className="ow-tap grid min-h-[40px] place-items-center text-center text-[13px] font-medium opacity-55">
            {W(lang, "Forgot your password?", "¿Olvidó su contraseña?")}
          </Link>
        </>
      )}

      {/* Cloudflare belongs only to the selected email/password flow. Google is not blocked by a
          challenge it does not use, and the six-digit code screen does not show a second check.
          Expiry/error recovery is handled in-place by Turnstile with an explicit restart action. */}
      {email.includes("@") && (mode === "password" || mode === "emailCode") && (
        <div className="pt-1">
          <Turnstile key={captchaNonce} onToken={(tok, status) => {
            setCaptcha(tok); setCaptchaStatus(status);
          }} />
          {captchaStatus === "loading" && (
            <p className="text-center text-[12px] font-medium opacity-55">
              {W(lang, "Checking your browser…", "Comprobando su navegador…")}
            </p>
          )}
        </div>
      )}

      {err && <p className="pt-1 text-center text-[13px] font-medium text-red-500">{err}</p>}

      {/* No One ID behind that email — say so plainly and open the right door instead of a
          dead red error. Sign-in never creates accounts; /join does (with the full wizard). */}
      {noAccount && (
        <div className="mt-1 rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] p-3 text-center">
          <p className="text-[13px] font-semibold">
            {W(lang, "There's no One ID for that email yet.", "Aún no existe un One ID con ese correo.")}
          </p>
          <Link to={signUpHref(next)} className="mt-1 inline-block text-[13px] font-bold underline">
            {W(lang, "Create your One ID — it takes about 20 seconds →", "Crea tu One ID — toma unos 20 segundos →")}
          </Link>
        </div>
      )}

      {/* Before the account exists, not after. See lib/oneId.tsx for why this is one line
          under the button rather than a modal in front of it. */}
      <OneIdNotice className="pt-3" />
      <OneWorldHomeLink />
    </div>
  );
}

/**
 * THE SIX-BOX CODE INPUT.
 * ============================================================================================
 * One real `<input>` underneath, six drawn boxes on top. That shape is deliberate and it is the
 * only one that survives a real phone:
 *
 *  · `autoComplete="one-time-code"` only fires for a SINGLE input. Six separate inputs kill
 *    iOS and Android's one-tap autofill outright — the exact convenience the boxes are meant to
 *    look like they have.
 *  · Paste works. Lee asked for a copy button in the email; the other half of that is a field
 *    that accepts a six-digit paste in one go, which six separate boxes famously do not.
 *  · Backspace, arrow keys and the software keyboard's own behaviour all come free, because the
 *    browser is still driving one ordinary text field.
 *
 * The boxes are `pointer-events-none` decoration. The caret is hidden and drawn as a pulsing
 * border on the active box instead.
 */
