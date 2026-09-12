/**
 * EXPRESS ACCOUNT CREATION — "the ticket way" (Lee, 17 Aug 2026, second ruling).
 * ============================================================================================
 * For ticket buying there is NO six-digit code, no verification step, nothing to check in
 * another tab: Google one-tap, or name + email + phone → account → payment. The account is
 * minted server-side (`express-account`): real One ID member, notifications work, email
 * marked unverified in metadata for the agreed STEP-UP rule (heavier surfaces like OneJob
 * money flows will demand real verification later — deliberately not built yet).
 *
 * THE ONE HARD RULE: an email that already has an account NEVER gets an express session —
 * the server refuses and the card flips to "you already have an account, sign in" (Google,
 * biometrics or the code flow at /signin). Otherwise typing someone else's address would
 * hand over their account.
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@oneworld/shell";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Fingerprint,
  Mail,
  Ticket,
} from "lucide-react";
import QuickHirePhoneInput from "@evt/components/quick-hire/QuickHirePhoneInput";
import { findCountryByIso } from "@evt/lib/country-phone-data";
import { readContact, captureContact } from "@evt/lib/contactCapture";

/* v27 EG (18 Aug 2026): Google 403s OAuth inside in-app browsers (Instagram, Facebook,
   LinkedIn, TikTok, Messenger, Android WebView). A buyer who taps our Google button in one
   of those hits a Google error page and the sale dies — the consistency canon says HIDE it
   there. Detection is the standard UA sniff; false negatives just show the button as before. */
const IN_APP_BROWSER =
  /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Twitter|TikTok|BytedanceWebview|Snapchat|Line\/|MicroMessenger|; wv\)/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );

export default function ExpressJoin({
  eventCheckoutPath,
  expressSource = "oneevent_checkout",
  onContinue,
}: {
  eventCheckoutPath: string;
  onContinue?: () => Promise<void>;
  expressSource?:
    | "oneevent_checkout"
    | "oneevent_question"
    | "oneevent_manager_invite"
    | "oneevent_express_gate";
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  /* v14 intelligent capture (Lee): whatever they typed on ANY earlier OneEvent form
     (apply, checkout) starts here pre-filled — nobody types their details twice. */
  const cap = readContact();
  const initialNameParts = (cap.name || "").trim().split(/\s+/).filter(Boolean);
  const [firstName, setFirstName] = useState(initialNameParts[0] || "");
  const [lastName, setLastName] = useState(initialNameParts.slice(1).join(" "));
  const [email, setEmail] = useState(cap.email || "");
  const [phone, setPhone] = useState(cap.phone || "");
  const [phoneCountry, setPhoneCountry] = useState(cap.phoneCountry || "US");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [step, setStep] = useState<"choice" | "email">("choice");
  const [busy, setBusy] = useState<null | "google" | "create">(null);
  const [err, setErr] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordRules = [
    { label: "At least 9 characters", met: pw.length >= 9 },
    { label: "One uppercase letter", met: /[A-Z]/.test(pw) },
    { label: "One lowercase letter", met: /[a-z]/.test(pw) },
    { label: "One number", met: /\d/.test(pw) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(pw) },
    { label: "Passwords match", met: Boolean(pw2) && pw === pw2 },
  ];
  const pwOk = passwordRules.every((rule) => rule.met);
  const ready =
    emailOk &&
    firstName.trim().length >= 1 &&
    lastName.trim().length >= 1 &&
    phone.trim().length >= 7 &&
    pwOk;

  const google = async () => {
    setErr(null);
    setBusy("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${eventCheckoutPath}` },
    });
    if (error) {
      setErr(error.message);
      setBusy(null);
    }
    /* success navigates to Google and returns here with a session */
  };

  const create = async () => {
    if (!ready) {
      setErr("Fill in your name, email, phone, and meet the password rules.");
      return;
    }
    setErr(null);
    setExists(false);
    setBusy("create");
    try {
      const { data, error } = await supabase.functions.invoke(
        "express-account",
        {
          body: {
            email: email.trim(),
            name: name.trim(),
            phone: `${findCountryByIso(phoneCountry)?.code || "+1"} ${phone.trim()}`,
            password: pw,
            source: expressSource,
          },
        },
      );
      if (error)
        throw new Error(error.message || "Could not create your account.");
      if (data?.error) throw new Error(data.error);
      if (data?.exists) {
        setExists(true);
        setBusy(null);
        return;
      }
      if (!data?.tokenHash)
        throw new Error("Could not create your account. Please try again.");
      const { error: vErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: data.tokenHash,
      });
      if (vErr) throw new Error(vErr.message);
      sessionStorage.setItem("evt-express-join", "1"); // checkout offers biometrics once
      /* Express members SKIP the account-setup tour (Lee: no extra steps on the ticket
         path) — stay-signed-in is already the session default, and biometrics are offered
         inline right here in checkout. Same stamp AccountSetup writes for itself. */
      if (data.userId) {
        try {
          localStorage.setItem(`ow.setup.${data.userId}`, "1");
        } catch {
          /* private mode */
        }
      }
      toast.success(t("express.ready", "Account created — review your ticket and continue to payment."));
      /* Account creation is its own screen. The parent advances to the separate ticket and
         payment screen; Stripe is opened only by the final payment action there. */
      if (onContinue) await onContinue();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-5 mb-6">
      <h2 className="text-sm font-bold text-foreground mb-1">
        {t("express.almost", "Create your account")}
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        {t(
          "express.subtitle",
          "Choose Google or Email. We’ll use this information for your ticket and receipt.",
        )}
      </p>

      {step === "choice" ? (
        <div className="space-y-3">
          {/* v27 EG: no Google inside in-app browsers — it 403s at Google's door. */}
          {!IN_APP_BROWSER && (
            <button
              onClick={google}
              disabled={busy === "google"}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-white text-[#1f1f1f] border border-ink/20 shadow-sm"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#FFC107"
                  d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41.4 34.9 44 30 44 24c0-1.3-.1-2.6-.4-3.9z"
                />
              </svg>
              {busy === "google"
                ? t("express.google_busy", "Opening Google…")
                : t("express.google", "Continue with Google")}
            </button>
          )}
          <button
            type="button"
            disabled
            className="w-full rounded-xl border border-border bg-secondary/55 px-4 py-3 text-sm font-semibold text-muted-foreground opacity-70"
          >
            Continue with Apple
            <span className="ml-2 text-[11px] font-bold uppercase tracking-wide">
              Coming soon
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setErr(null);
              setStep("email");
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/15"
          >
            <Mail className="h-4 w-4" />
            Continue with Email
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setErr(null);
              setStep("choice");
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={firstName}
              onChange={(e) => {
                const nextFirst = e.target.value;
                setFirstName(nextFirst);
                captureContact({
                  name: [nextFirst.trim(), lastName.trim()]
                    .filter(Boolean)
                    .join(" "),
                });
              }}
              placeholder="First name"
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => {
                const nextLast = e.target.value;
                setLastName(nextLast);
                captureContact({
                  name: [firstName.trim(), nextLast.trim()]
                    .filter(Boolean)
                    .join(" "),
                });
              }}
              placeholder="Last name"
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setExists(false);
              captureContact({ email: e.target.value });
            }}
            placeholder="you@example.com"
            className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {/* v14 (Lee): the ONE phone control, everywhere — flag trigger, dial in the sheet,
              formats as you type. Same experience as the apply form and checkout. */}
          <QuickHirePhoneInput
            countryCode={phoneCountry}
            phone={phone}
            onCountryChange={setPhoneCountry}
            onPhoneChange={setPhone}
          />
          {/* Password, twice, with an eye on both fields so people can recover typos. */}
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Choose a strong password"
              autoComplete="new-password"
              className="ow-password-input w-full px-3 py-2.5 pr-10 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
            >
              {showPw ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="relative">
            <input
              type={showPw2 ? "text" : "password"}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder={t("express.pw2_ph", "Enter the password again")}
              autoComplete="new-password"
              className="ow-password-input w-full px-3 py-2.5 pr-10 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              aria-label={
                showPw2 ? "Hide confirm password" : "Show confirm password"
              }
              onClick={() => setShowPw2((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
            >
              {showPw2 ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="grid gap-1 rounded-xl border border-border bg-secondary/35 p-3 text-[11px] text-muted-foreground">
            {passwordRules.map((rule) => (
              <p
                key={rule.label}
                className={rule.met ? "font-semibold text-emerald-600" : ""}
              >
                {rule.met ? "✓" : "•"} {rule.label}
              </p>
            ))}
          </div>

          {exists ? (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
              <p className="text-xs text-foreground mb-2">
                {t("express.exists_pre", "Good news —")}{" "}
                <strong>{email.trim()}</strong>{" "}
                {t("express.exists_post", "already has a One World account.")}
              </p>
              <button
                onClick={() =>
                  navigate(
                    `/signin?next=${encodeURIComponent(eventCheckoutPath)}`,
                  )
                }
                className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                {t("express.signin_continue", "Sign in to continue")}
              </button>
            </div>
          ) : (
            <button
              onClick={create}
              disabled={!ready || busy === "create"}
              className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
            >
              <Ticket className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              {busy === "create"
                ? t("express.creating", "Creating your account…")
                : t("express.create", "Proceed to payment")}
            </button>
          )}
        </div>
      )}

      {err && <p className="mt-3 text-xs text-red-500">{err}</p>}
      <p className="mt-3 text-[10px] text-muted-foreground">
        {IN_APP_BROWSER
          ? t("express.member_webview", "Already a member?")
          : t("express.member", "Already a member? Use Google above, or")}{" "}
        <button
          className="underline"
          onClick={() =>
            navigate(`/signin?next=${encodeURIComponent(eventCheckoutPath)}`)
          }
        >
          {t("express.signin", "sign in")}
        </button>
        .
      </p>
    </div>
  );
}

/** One-tap biometrics offer, shown once right after an express join (optional, never a gate). */
export function BiometricsOffer() {
  const [state, setState] = useState<"offer" | "done" | "hidden">(
    sessionStorage.getItem("evt-express-join") === "1" ? "offer" : "hidden",
  );
  const busyRef = useRef(false);
  if (state === "hidden" || state === "done") return null;
  const enable = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await (
        supabase.auth as unknown as { registerPasskey: () => Promise<unknown> }
      ).registerPasskey();
      toast.success("Fingerprint sign-in is on.");
    } catch {
      toast.info("No worries — you can turn this on any time in Settings.");
    }
    sessionStorage.removeItem("evt-express-join");
    setState("done");
  };
  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3 flex items-center gap-3">
      <Fingerprint className="w-5 h-5 text-primary shrink-0" />
      <p className="flex-1 text-xs text-muted-foreground">
        Sign in with your fingerprint next time?
      </p>
      <button onClick={enable} className="text-xs font-semibold text-primary">
        Enable
      </button>
    </div>
  );
}
