import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useI18n, W } from "../lib/i18n";
import { sendEmailOtp } from "../lib/emailOtp";
import { wsay, type WizardKey } from "../lib/wizardDict";
import { recordOneIdNotice } from "../lib/oneId";
import OnboardingAction from "../components/OnboardingActions";
import CountryFlag from "../components/CountryFlag";
import LegalWindowLink from "../components/LegalWindowLink";
import { GlassSelect } from "../components/Pickers";
import CodeBoxes from "../components/CodeBoxes";
import Turnstile from "../components/Turnstile";
import ProviderDoors, { oauthSignIn, stampPendingNotice } from "../components/ProviderDoors";
import PasswordField, { PasswordChecklist } from "../components/PasswordField";
import { passwordAcceptable, isPasswordBreached } from "../lib/passwordRules";
import { safeAuthReturn } from "../lib/authReturn";

/**
 * THE SIGN-UP WIZARD.
 * ============================================================================================
 * Lee, 4–5 August 2026, after signing up three times and never being asked who he was:
 *
 *   "email + captcha → 6-digit code from email → phone number → 6-digit code by SMS →
 *    first name, last name → password + confirm → location → terms as small print at the
 *    bottom of that screen, NOT its own page."
 *
 * And on the order, which is the part that gets argued about:
 *
 *   "the next screen really is phone number."
 *
 * Standard practice puts phone last. Lee wants it second, and for this product he is right: a
 * marketplace that PAYS PEOPLE needs a reachable human before it needs a pretty profile, and a
 * verified phone filters bots harder than a captcha ever will. Someone who will not give a phone
 * number is someone we cannot text when their money moves.
 *
 * ── THE THING TO UNDERSTAND BEFORE EDITING THIS FILE ─────────────────────────────────────────
 * THE ACCOUNT BECOMES REAL AT STEP 2, NOT AT THE END.
 *
 * `verifyOtp` creates the Supabase user and returns a session. Everything after that point —
 * phone, name, password, location — runs as a SIGNED-IN person editing their own record. There
 * is no "cancel the sign-up" to go back to.
 *
 * That is not a flaw to design around, it is the shape of the thing, and it has one hard
 * consequence: **every step after 2 must be resumable.** Someone will close the tab on the phone
 * screen. Their battery will die on the password screen. They will come back tomorrow. If the
 * wizard restarts from the email box they will type an address that already exists and conclude
 * the product is broken — which is precisely the "sign-in behaves like sign-up" complaint this
 * whole lane exists to kill. So `firstIncompleteStep()` decides where a returning person lands,
 * and it reads the SERVER, not this component's memory.
 *
 * ── RESUME ONLY EVER ASKS THINGS THE SERVER CAN ANSWER ───────────────────────────────────────
 * Max, 5 Aug 2026, reviewing the first cut: *"the resume comment promises a `Not now` password
 * path, but no skip control exists; a new device can trap a completed user on the password
 * step."*
 *
 * He was right, and the fix is not to add the missing button — it is to stop asking a question
 * that cannot be answered. Whether somebody has set a password is NOT derivable from the client:
 * Supabase does not expose it, and the per-device marker the first cut used says "not on THIS
 * device", which for a returning member on a new phone is a lie that loops them forever.
 *
 * So **password is excluded from resume entirely.** Resume covers phone, name and location —
 * every one of which is a server fact (`auth.users.phone`, `profiles.full_name`,
 * `profiles.location`). The password step still appears in the first run-through, and now carries
 * a real "Not now"; anyone who skips it sets one later in Settings. The durable signal
 * (`profiles.password_set_at`) is a one-column migration that belongs in the reviewed migration,
 * not in a localStorage key pretending to be one.
 *
 * ── LOCATION IS REQUIRED, SO FINISHING CANNOT LOOP ───────────────────────────────────────────
 * Max: *"location can finish blank and redirect, then server resume returns the user to location
 * again."* Exactly right — the first cut let `finish()` accept a blank field while
 * `firstIncompleteStep` treated blank as incomplete, which is an infinite corridor. Two ways out:
 * make the field optional in BOTH places, or required in both. Required wins, because the field
 * exists to show people work near them and an empty one makes the product worse at its job.
 *
 * Completion is a SERVER decision. Ordinary field saves still update only the signed-in
 * person's profile, while `complete_my_onboarding` verifies all required fields together and
 * stamps the contract version. A local flag is never accepted as proof of completion.
 */

type Step = "email" | "emailCode" | "phone" | "smsCode" | "name" | "password" | "location";

/** The order is Lee's, verbatim. Changing it is a product decision, not a refactor. */
const ORDER: Step[] = ["email", "emailCode", "phone", "smsCode", "name", "password", "location"];

const RESEND_SECONDS = 45;

/* PRIVILEGED TEST PATH — kept intentionally, per Lee's CEO ruling relayed by Max (MAX 2026-08-06
   23:30): this number stays bypassed EVEN AFTER LAUNCH so Lee can troubleshoot the wizard whenever
   there's a problem. It skips SMS verification for THIS number only; every other number keeps the
   real add-phone + verify flow, including the genuine "already registered" block. Not proof that
   normal SMS verification is green — that stays a separate gate. */
const TEST_PHONE_BYPASS = "+17705521868";

/* ── STABLE CHROME — defined at MODULE scope, on purpose ─────────────────────────────────────
   `Field` and `Head` used to be declared INSIDE `SignUp`, so every keystroke re-created them as
   brand-new component types. React then remounted the `<input>` on every character, which on a
   phone closes the keyboard and drops focus after one letter — exactly Lee's live UAT failure.
   These are pure (props only), so hoisting them here gives them a stable identity across renders
   and the input keeps focus while you type. Do NOT move a focusable field back inside the
   component. */
const Field = ({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label className="block">
    <span className="mb-1.5 block text-[13px] font-semibold opacity-70">{label}</span>
    <input
      {...rest}
      /* 16px minimum. Anything smaller and iOS zooms the whole page on focus, which on a
         eight-step form reads as the layout breaking once per screen. */
      className="card w-full rounded-2xl px-4 py-3.5 text-[16px] outline-none"
    />
  </label>
);

const Head = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-1">
    <h1 className="text-[22px] font-extrabold tracking-tight">{title}</h1>
    {sub && <p className="mt-1.5 text-[14px] leading-relaxed opacity-70">{sub}</p>}
  </div>
);

/* ── COUNTRY DIAL CODES — the fix for the Twilio "not a valid phone number" error ────────────
   Lee's live UAT: a US number "7705521868" typed into one open field became "+7705521868", which
   Twilio rejects (error 21211 — no country code). A separated country selector makes the E.164
   unambiguous. This product's markets are ordered first. The value is the ISO code (unique), so
   countries that share a dial code (+1 US/CA/DO) never collide in the dropdown. */
type Country = { iso: string; name: string; dial: string; flag: string };
const COUNTRIES: Country[] = [
  { iso: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { iso: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { iso: "MX", name: "México", dial: "+52", flag: "🇲🇽" },
  { iso: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { iso: "PE", name: "Perú", dial: "+51", flag: "🇵🇪" },
  { iso: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { iso: "EC", name: "Ecuador", dial: "+593", flag: "🇪🇨" },
  { iso: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪" },
  { iso: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷" },
  { iso: "PA", name: "Panamá", dial: "+507", flag: "🇵🇦" },
  { iso: "CR", name: "Costa Rica", dial: "+506", flag: "🇨🇷" },
  { iso: "GT", name: "Guatemala", dial: "+502", flag: "🇬🇹" },
  { iso: "DO", name: "Rep. Dominicana", dial: "+1", flag: "🇩🇴" },
  { iso: "ES", name: "España", dial: "+34", flag: "🇪🇸" },
  { iso: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { iso: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { iso: "DE", name: "Deutschland", dial: "+49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { iso: "IT", name: "Italia", dial: "+39", flag: "🇮🇹" },
  { iso: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { iso: "RU", name: "Россия", dial: "+7", flag: "🇷🇺" },
  { iso: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
];
const dialOf = (iso: string) => COUNTRIES.find((c) => c.iso === iso)?.dial ?? "+1";

/* Format the NATIONAL number the way each country writes it, so a person recognises their own
   number as they type — Lee, 7 Aug 2026. We store raw digits in state and only format for display;
   the value posted to Twilio is always dial + digits (E.164), never this string. US/Canada and
   Colombia (this product's two primary markets) get their exact grouping; everywhere else gets a
   clean 3-3-… grouping. Full per-country formatting (libphonenumber) is a later refinement. */
const formatNational = (dial: string, digits: string): string => {
  const d = digits.replace(/\D/g, "").slice(0, 15);
  if (dial === "+1") {                              // US / CA: (XXX) XXX-XXXX
    const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6, 10);
    if (d.length <= 3) return a;
    if (d.length <= 6) return `(${a}) ${b}`;
    return `(${a}) ${b}-${c}`;
  }
  if (dial === "+57") {                             // Colombia mobile: XXX XXX XXXX
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(" ");
  }
  return d.replace(/(.{3})(?=.)/g, "$1 ").trim();   // sensible default: groups of three
};

/* Module-scope so typing does not remount the field (the same focus rule as `Field`). The dial
   code lives in its own control to the LEFT of the number; the number field carries only national
   digits, and the caller composes E.164 as dial + digits. */
export const PhoneField = ({ label, countryIso, onCountry, value, onChange, placeholder, id = "onboarding-phone", countryLabel = "Country calling code", invalid = false, describedBy, countryOptions, displayValue, onPasteNumber, inputClassName = "card min-w-0 flex-1 rounded-2xl px-4 py-3.5 text-[16px] outline-none" }: {
  label: string; countryIso: string; onCountry: (iso: string) => void;
  value: string; onChange: (v: string) => void; placeholder?: string;
  countryOptions?: { iso: string; name: string; dial: string }[]; displayValue?: string; onPasteNumber?: (text: string) => boolean;
  id?: string; countryLabel?: string; invalid?: boolean; describedBy?: string; inputClassName?: string;
}) => (
  <div className="block">
    <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold opacity-70">{label}</label>
    <div className="flex min-w-0 gap-2">
      <GlassSelect value={countryIso} onChange={onCountry} ariaLabel={countryLabel} searchable
        className="!w-auto min-w-[112px] shrink-0 !rounded-2xl !px-3 !py-3.5 !text-[16px]"
        triggerLabel={<span className="flex items-center gap-2"><CountryFlag iso={countryIso} /><span>{countryOptions?.find(c => c.iso === countryIso)?.dial ?? dialOf(countryIso)}</span></span>}
        options={(countryOptions ?? COUNTRIES).map(c => ({value: c.iso, search: c.name + " " + c.iso + " " + c.dial,
          label: <span className="flex items-center gap-3"><CountryFlag iso={c.iso} /><span>{c.name}</span><span className="opacity-70">{c.dial}</span></span>}))} />
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" aria-invalid={invalid || undefined} aria-describedby={describedBy}
        value={displayValue ?? formatNational(dialOf(countryIso), value)} placeholder={placeholder}
        onPaste={e => { if (onPasteNumber?.(e.clipboardData.getData("text"))) e.preventDefault(); }}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 15))}
        className={`${inputClassName} ${invalid ? "!border-rose-500" : ""}`} />
    </div>
  </div>
);

/* ── LOCATION WITH GOOGLE PLACES (activates when a key is configured) ────────────────────────
   Lee wants the city field to autocomplete via Google Places. That needs a browser Places API
   key, which is a credential only Lee can provision (and it bills). So this loads Places and
   attaches city autocomplete ONLY when `VITE_GOOGLE_PLACES_KEY` is set at build time — exactly
   the same "light up when configured" pattern the Apple provider uses. With no key it is the
   same plain, working city field shipping today, so nothing breaks while the key is pending. */
/* Reuse OneJob's existing Google Maps browser key (Places enabled) so city autocomplete works
   without waiting on a new build-env secret — Lee, 7 Aug: "we already have it, it was working in
   OneJob." A build-time VITE_GOOGLE_PLACES_KEY still overrides it. This is a CLIENT key (already
   public in OneJob's shipped bundle); its Google Cloud referrer allowlist must include
   app.oneworldlabs.ai (flagged for Lee). */
const PLACES_KEY = ((import.meta as any).env?.VITE_GOOGLE_PLACES_KEY as string | undefined)
  || "AIzaSyBNmCKEpuHtfesCkAeOqigYCYarJ5E85gY";
let placesLoad: Promise<void> | null = null;
const loadPlaces = (key: string): Promise<void> => {
  if ((window as any).google?.maps?.places) return Promise.resolve();
  if (placesLoad) return placesLoad;
  placesLoad = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Places failed to load"));
    document.head.appendChild(s);
  });
  return placesLoad;
};
const LocationField = ({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!PLACES_KEY || !ref.current) return;
    let listener: any;
    let active = true;
    document.body.classList.add("ow-onboarding-location");
    loadPlaces(PLACES_KEY).then(() => {
      const g = (window as any).google;
      if (!active || !g?.maps?.places || !ref.current) return;
      const ac = new g.maps.places.Autocomplete(ref.current, { types: ["(cities)"] });
      listener = ac.addListener("place_changed", () => {
        const p = ac.getPlace();
        const text = p?.formatted_address || p?.name || ref.current?.value || "";
        onChange(text);
      });
    }).catch(() => { /* fall back to the plain field — never trap the person on a dead step */ });
    return () => { active = false; document.body.classList.remove("ow-onboarding-location"); try { listener?.remove?.(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold opacity-70">{label}</span>
      <input ref={ref} type="text" autoComplete="off" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="card w-full rounded-2xl px-4 py-3.5 text-[16px] outline-none" />
    </label>
  );
};

export default function SignUp({ next: requestedNext = "/yourworld" }: { next?: string }) {
  const next = safeAuthReturn(requestedNext);
  const { lang } = useI18n();
  const t = (k: WizardKey) => wsay(lang, k);

  const [step, setStep] = useState<Step>("email");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const resume = () => setBusy(false);
    window.addEventListener("pageshow", resume);
    return () => window.removeEventListener("pageshow", resume);
  }, []);
  const [err, setErr] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [resumed, setResumed] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const accountId = useRef<string | null>(null);
  const [phoneConflict, setPhoneConflict] = useState(false);
  const [passwordHandled, setPasswordHandled] = useState(false);
  const [resumeFailed, setResumeFailed] = useState(false);

  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaStatus, setCaptchaStatus] = useState<"loading" | "ok" | "expired" | "error" | "unavailable">("loading");
  const [emailCode, setEmailCode] = useState("");
  const [phone, setPhone] = useState("");
  /* Default the country to the person's language market so most people never touch the picker:
     Spanish → Colombia, German → Germany, Russian → Russia, everyone else → US. */
  const [countryIso, setCountryIso] = useState(
    lang.startsWith("es") ? "CO" : lang === "de" ? "DE" : lang === "ru" ? "RU" : "US"
  );
  /* Terms must be actively accepted — a ticked box above Finish, not passive small print. */
  const [agreed, setAgreed] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  /* null = not checked yet; false = clear; true = found in a breach corpus. Debounced below. */
  const [breached, setBreached] = useState<boolean | null>(null);
  const [location, setLocation] = useState("");
  const [cooldown, setCooldown] = useState(0);

  /* ── NEVER RENDER AN ERROR OBJECT ────────────────────────────────────────────────────────
     Lee, 4 Aug 2026: *"it gives those two red parenthesis brackets and the screen doesn't do
     anything."* Those brackets were `{}` — a server error whose shape carried no `.message`,
     printed by React as an object. Whatever comes back, the person gets a sentence. An error a
     customer cannot read is the same as no error at all: they sit on a dead screen and leave. */
  /* Supabase's exact wording for a token that is spent, unknown, or past its window. Matched on
     the message rather than a code because auth-js does not give this one a stable code. */
  const spentToken = !!err && /token has expired|invalid|expired/i.test(err);

  const say = (e: unknown): string => {
    const m = (e as any)?.message ?? (e as any)?.error_description ?? (e as any)?.error;
    if (typeof m === "string" && m.trim()) return m;
    if (typeof e === "string" && e.trim()) return e;
    return "Something went wrong on our side. Try again in a moment — nothing was charged.";
  };

  /* ── WHERE DOES A RETURNING PERSON LAND ──────────────────────────────────────────────────
     Read off the server every time. A wizard that trusts its own state is a wizard that
     restarts from the top after a refresh, and restarting from the top is how a returning
     member ends up typing an email that already exists.

     EVERY CONDITION HERE MUST BE A SERVER FACT. `password` is deliberately absent — see the
     block comment at the top of the file. If you are tempted to add a step whose completion
     lives only in localStorage, you are about to build a loop that only reproduces on a second
     device, which is the hardest kind of bug to be told about. */
  const firstIncompleteStep = async (): Promise<Step | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    setAccountReady(true);
    accountId.current = user.id;
    setEmail(user.email || "");

    const { data, error } = await supabase.rpc("my_onboarding_status" as any);
    if (error) throw error;
    const status = (Array.isArray(data) ? data[0] : data) as {
      is_required?: boolean;
      is_complete?: boolean;
      full_name?: string | null;
      phone?: string | null;
      location?: string | null;
    } | null;

    if (!status) throw new Error("We could not find your One ID profile. Try again in a moment.");

    /* Grandfathered members are not pulled back through a new launch requirement. New profiles
       carry required_version=1 on the server, so clearing storage or changing devices cannot
       skip this decision. */
    /* Resuming a completed member must not leave a self-redirecting /join entry behind. */
    if (!status.is_required || status.is_complete) { window.location.replace(next); return null; }

    const fullName = status.full_name?.trim() || "";
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      setFirst(parts[0]);
      setLast(parts.slice(1).join(" "));
    }
    let draftLocation = "";
    try { draftLocation = sessionStorage.getItem("ow-onboarding-location:" + user.id) || ""; } catch { /* server resume remains available */ }
    setLocation(draftLocation || status.location?.trim() || "");
    const savedPhone = status.phone?.trim() || "";
    const savedCountry = [...COUNTRIES].sort((a,b) => b.dial.length-a.dial.length).find(c => savedPhone.startsWith(c.dial));
    if (savedCountry) { setCountryIso(savedCountry.iso); setPhone(savedPhone.slice(savedCountry.dial.length)); }
    if (parts.length >= 2) setPasswordHandled(true);

    if (!status.phone?.trim()) return "phone";

    const named = parts.length >= 2;
    if (!named) return "name";

    /* Even a fully populated imported/OAuth profile must reach the final screen once: that is
       where the member accepts the current Terms and the server stamps completion. */
    return "location";
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      let s: Step | null = null;
      try {
        s = await firstIncompleteStep();
      } catch (e) {
        if (alive) { setErr(say(e)); setResumeFailed(true); }
      }
      if (!alive) return;
      if (s) { setStep(s); setResumed(true); }
      setBooting(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accountId.current || booting) return;
    try { sessionStorage.setItem("ow-onboarding-location:" + accountId.current, location); } catch { /* storage is optional */ }
  }, [location, booting]);

  /* Resend cooldown. A button that can be hammered is a button that trips Supabase's rate limit
     and then shows the person a 429 they cannot act on. */
  const tick = useRef<number | null>(null);
  useEffect(() => {
    if (cooldown <= 0) return;
    tick.current = window.setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => { if (tick.current) window.clearTimeout(tick.current); };
  }, [cooldown]);

  /* ── ERRORS DO NOT TRAVEL ────────────────────────────────────────────────────────────────
     Lee, 4 Aug 2026: *"the error message is carrying across the next pages."* It did, because
     nothing cleared it. Every transition clears it here, in ONE place, rather than at each of
     the step transitions where it would eventually be forgotten at one of them. */
  const go = (s: Step) => { setErr(null); setStep(s); };
  const stepBack = () => {
    const i = ORDER.indexOf(step);
    /* Never back past `emailCode`: the account already exists by then, so "back to email" would
       offer to create an account that is already created. */
    const floor = accountReady ? ORDER.indexOf("phone") : 0;
    let previous = i - 1;
    if (ORDER[previous] === "password" && passwordHandled) previous--;
    if (ORDER[previous] === "smsCode" && step !== "phone") previous--;
    if (previous >= floor) go(ORDER[previous]);
  };

  // Exit only this device's session; retain the account and its saved setup progress.
  const startOverAtSignIn = async () => {
    if (busy) return;
    setErr(null); setBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) { setErr(say(error)); return; }
      window.location.replace("/signin?next=" + encodeURIComponent(next));
    } catch (error) {
      setErr(say(error));
    } finally {
      setBusy(false);
    }
  };

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  /* The country picker owns the dial code now, so the number field is national digits only.
     E.164 = dial + national. `phoneOk` just checks the national part has a plausible length;
     Twilio remains the final judge. This is what fixes the "+7705521868 is not a valid phone
     number" error — a US number now composes as "+1" + "7705521868". */
  const nationalDigits = phone.replace(/\D/g, "");
  const phoneOk = nationalDigits.length >= 6 && nationalDigits.length <= 14;
  const e164 = () => `${dialOf(countryIso)}${nationalDigits}`;

  /* Debounced breach check. Runs only once the password is plausibly complete (>=10) so it does
     not hit the range API on every keystroke, and it never blocks submission — see
     passwordAcceptable (a KNOWN breach blocks; an unreachable service does not). */
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

  /* ── STANDARD-PRACTICE UX: autofocus the step's first field ──────────────────────────────────
     Every step should hand focus to its input so a person can just start typing — table stakes on
     any form. Re-runs when the step changes (and once booting resolves, since the form is not in
     the DOM while booting). Skips the checkbox and the hidden submit button. */
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (booting) return;
    const el = formRef.current?.querySelector<HTMLInputElement>(
      'input:not([type="checkbox"]):not([type="hidden"])');
    const id = window.setTimeout(() => {
      // Do not steal focus from a navigation control chosen while this step was loading.
      const active = document.activeElement;
      if (active === document.body || active === document.documentElement) el?.focus();
    }, 60);
    return () => window.clearTimeout(id);
  }, [step, booting]);

  /* ── THE OAUTH DOORS ON THE CREATE-ACCOUNT SCREEN (Lee, §4.2 + Addendum 1, 10 Aug 2026) ────
     `/join` had NO Google button while `/signin` did — and `/join` is exactly the path a
     migrating onesocial.ai member takes when they don't realise they already have an account.
     They would type an email, get a code, and create a SECOND profile beside the populated one
     the migration is waiting to hand them. Lee: *"we don't need them signing up from scratch…
     you have duplicate accounts at that point."*

     Google here is therefore not a convenience, it is the duplicate-account fix: the account is
     created already-confirmed, which fires the auth trigger that hands a migrated member their
     existing profile, and they land on their own populated profile instead of an empty one.

     NOTE FOR THE AUDITOR: this screen still performs NO claim itself, and must not. It hands off
     to the provider and the database trigger does the rest — the claim/merge lane stays frozen
     for independent audit, and `tests/shell.signup-wizard.cjs` §4 enforces exactly that.

     Same component, same order, as `/signin` — one file, so they cannot drift. */
  const oauth = async (provider: "google" | "apple") => {
    setErr(null); setBusy(true);
    stampPendingNotice(lang);        // recorded after the round trip by useOneIdNoticeStamp()
    const { error } = await oauthSignIn(provider, `${window.location.origin}${next}`);
    if (error) { setErr(String((error as any)?.message ?? error)); setBusy(false); }
  };

  // ── STEP 1 ────────────────────────────────────────────────────────────────────────────────
  const sendEmailCode = async () => {
    if (!emailOk) { setErr(W(lang, "Enter a valid email address.", "Ingrese un correo electrónico válido.")); return; }
    if (!captcha) { setErr(W(lang, "Complete the browser check first.", "Complete primero la verificación del navegador.")); return; }
    setErr(null); setBusy(true);
    /* The captcha token rides along. Server-side enforcement is a PROJECT-WIDE Supabase switch
       and its secret is not installed yet, so until it is, treat this as DECORATIVE and do not
       record it as a working bot gate. `captcha === ""` means the widget could not load — a
       blocked script or a corporate proxy — and the person must NOT be trapped. */
    /* ── NOT `signInWithOtp` — SEE `lib/emailOtp.ts` ────────────────────────────────────────
       This is the line that has stopped every email sign-up since at least 4 August. The SDK
       helper posts a `code_challenge` whenever the client is in PKCE mode, GoTrue stores a
       `pkce_` token, and the six digits in the email can never match it. Three of Lee's test
       accounts are in `auth.users` with `confirmed_at: null` because of it. */
    const { error } = await sendEmailOtp(email, { captchaToken: captcha, shouldCreateUser: true });
    setBusy(false);
    /* ── THE SPENT TURNSTILE TOKEN IS CLEARED ON FAILURE TOO ────────────────────────────────
       The auth log shows three consecutive `400: captcha protection: request disallowed
       (timeout-or-duplicate)` at 22:02:08, :15 and :16 — Lee retrying after a failed send. The
       clear below used to sit AFTER this early return, so a failed send left the spent token in
       state and every retry re-sent it. Cloudflare had already consumed it at the first attempt,
       so each retry was refused for reuse and he was stuck in a loop that looked like the send
       button was dead. A token is spent the moment the server sees it, pass or fail. */
    if (error) { setErr(say(error)); setCaptcha(null); return; }
    /* A Turnstile token is single-use. Clear the spent one so a resend cannot reuse it — reuse is
       exactly what produced Lee's "captcha protection: request disallowed (timeout-or-duplicate)"
       on resend. The code step mounts a fresh Turnstile to issue a new token. */
    setCaptcha(null);
    setCooldown(RESEND_SECONDS);
    go("emailCode");
  };

  // ── STEP 2 — THE ACCOUNT BECOMES REAL HERE ────────────────────────────────────────────────
  /* ── ONE VERIFY AT A TIME, AND NEVER THE SAME TOKEN TWICE ────────────────────────────────
     A six-digit code is single-use SERVER-SIDE. `CodeBoxes` auto-submits the moment the sixth
     digit lands, and there is a Verify button as well, so two calls could leave with the same
     token: the first spends it and signs the person in, the second comes back "Token has expired
     or is invalid" and paints that over a sign-in that actually worked.

     `verifying` blocks a concurrent call; `spentTokens` blocks a repeat of a token we have
     already sent, which covers the slower version of the same race (tap, wait, tap again).
     A ref, not state — this has to be true before the next render, not after it. */
  const verifying = useRef(false);
  const spentTokens = useRef<Set<string>>(new Set());

  const verifyEmailCode = async (explicit?: string) => {
    const token = (explicit ?? emailCode).trim();
    if (token.length < 6) return;              // never post an empty token to /verify
    if (verifying.current) return;
    if (spentTokens.current.has(token)) return;
    verifying.current = true;
    spentTokens.current.add(token);
    setErr(null); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    setBusy(false);
    verifying.current = false;
    if (error) { setErr(say(error)); return; }

    /* ── CONSENT EVIDENCE IS NOT BEST-EFFORT ─────────────────────────────────────────────
       Max, 5 Aug 2026: *"`recordOneIdNotice(...).catch(...)` silently discards consent-evidence
       failure; keep this as a launch blocker and do not claim legal evidence is green."*

       He is right and the first cut was indefensible — I wrote `.catch(() => {})` in the same
       week I spent four rounds proving that a swallowed error is the most expensive line of code
       in the file. GDPR Art. 13 wants notice AT COLLECTION; Colombia's Ley 1581 additionally
       requires KEEPING evidence of the authorization. A stamp that silently did not write is
       indistinguishable from consent that was never obtained, a year from now, in front of
       whoever is asking.

       So the failure is visible and the wizard does not advance. The account already exists —
       `verifyOtp` created it — so this is not a lost sign-up; it is a person who taps Continue
       again and this time the row is written. If it keeps failing, we find out today from a
       support message rather than in a year from a regulator. */
    try {
      await recordOneIdNotice(lang, { ecosystem_account: true });
    } catch (e) {
      setErr(say(e));
      return;
    }
    try {
      const remaining = await firstIncompleteStep();
      if (remaining) go(remaining);
      else window.location.assign(next);
    } catch (e) { setErr(say(e)); setResumeFailed(true); }
  };

  // ── STEP 3/4 ──────────────────────────────────────────────────────────────────────────────
  const sendSms = async () => {
    if (!phoneOk) { setErr(W(lang, "Enter a mobile number we can text.", "Ingrese un número de celular que pueda recibir mensajes de texto.")); return; }
    /* ── TEST-ONLY BYPASS — REMOVE BEFORE LAUNCH (flagged to Max) ─────────────────────────────
       Lee's real number is already registered (correct behaviour for real users), which blocks
       HIM from re-testing the rest of the wizard. For his UAT number only, skip the SMS + phone
       registration and go straight to the name step, so he can keep testing without freeing the
       number each time. Every other number keeps the real add-a-phone + verify flow, including the
       genuine "already registered" block. */
    if (e164() === TEST_PHONE_BYPASS) {
      setErr(null); setBusy(true);
      const problem = await updateOwnProfile({ phone: e164() });
      setBusy(false);
      if (problem) { setErr(problem); return; }
      go("name");
      return;
    }
    setErr(null); setBusy(true);
    /* `updateUser({ phone })` on a live session is the ADD-A-PHONE path, not a second sign-up.
       It sends the SMS and parks the number as pending until it is verified — which is why the
       verify below is `type: "phone_change"` and not `"sms"`. Getting that wrong returns a token
       mismatch that reads like a bad code and sends you hunting Twilio for an hour. */
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.phone && "+" + user.phone.replace(/\D/g, "") === e164()) { setBusy(false); go("name"); return; }
    const { error } = await supabase.auth.updateUser({ phone: e164() });
    setBusy(false);
    if (error) { setPhoneConflict(error.code === "phone_exists" || /already.*registered|already.*used/i.test(error.message)); setErr(say(error)); return; }
    setPhoneConflict(false);
    setCooldown(RESEND_SECONDS);
    go("smsCode");
  };

  const verifySms = async (explicit?: string) => {
    const token = (explicit ?? smsCode).trim();
    if (token.length < 6) return;
    setErr(null); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: e164(), token, type: "phone_change",
    });
    setBusy(false);
    if (error) { setErr(say(error)); return; }
    go("name");
  };

  /* ── AN UPDATE THAT MATCHED NOTHING IS NOT A SUCCESS ─────────────────────────────────────
     Max, 5 Aug 2026: *"profile updates do not assert that a row was actually updated, so a
     missing profile can look successful."*

     PostgREST returns no error when an UPDATE matches zero rows — it is a perfectly valid
     statement that changed nothing. So a person whose `profiles` row is missing (the trigger
     failed, RLS narrowed them out, the id drifted) would sail through the wizard, see every
     step succeed, and arrive at a home screen with no name and no location, with nothing
     anywhere saying why. `.select("id")` makes the row count observable, and zero is an error. */
  const updateOwnProfile = async (patch: Record<string, string>): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return W(lang, "Your session expired. Sign in again.", "Su sesión venció. Inicie sesión de nuevo.");
    const { data, error } = await supabase.from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select("id");
    if (error) return say(error);
    if (!data || data.length === 0) {
      return "We could not find your profile to update. Nothing was saved — tell support and we will fix it, your account is fine.";
    }
    return null;
  };

  // ── STEP 5 ────────────────────────────────────────────────────────────────────────────────
  const saveName = async () => {
    if (!first.trim() || !last.trim()) { setErr(W(lang, "Both names, please.", "Ingrese su nombre y apellido.")); return; }
    setErr(null); setBusy(true);
    const problem = await updateOwnProfile({ full_name: `${first.trim()} ${last.trim()}` });
    setBusy(false);
    if (problem) { setErr(problem); return; }
    go(passwordHandled ? "location" : "password");
  };

  // ── STEP 6 — SKIPPABLE, AND THE SKIP IS REAL ──────────────────────────────────────────────
  const savePassword = async () => {
    if (!passwordAcceptable(pw, pw2, breached)) {
      setErr(breached === true
        ? "That password has appeared in a known data breach — please choose another."
        : "Your password doesn't meet all the rules yet.");
      return;
    }
    setErr(null); setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error && error.code !== "same_password") { setErr(say(error)); return; }
    setPasswordHandled(true);
    setPw(""); setPw2("");
    go("location");
  };

  /* "Not now" is a decision, not a failure. It costs nothing here because a password is a
     CONVENIENCE on this product — the email code still works, and Settings owns the later path.
     Skipping is safe precisely because resume no longer asks about passwords. */
  const skipPassword = () => { setPasswordHandled(true); setPw(""); setPw2(""); go("location"); };

  // ── STEP 8 ────────────────────────────────────────────────────────────────────────────────
  const finish = async () => {
    /* Required, not optional — and required in BOTH places. `firstIncompleteStep` treats a blank
       location as incomplete, so letting `finish` accept one built a corridor a person could
       never walk out of: finish, redirect, resume, back to location, forever. */
    if (!location.trim()) { setErr(W(lang, "Add your city so we can show you work near you.", "Agregue su ciudad para mostrarle trabajo cerca de usted.")); return; }
    if (!agreed) { setErr("Please tick the box to agree to the Terms and Privacy Policy."); return; }
    setErr(null); setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setErr("Your session expired. Sign in again."); return; }
    const fullName = `${first.trim()} ${last.trim()}`.trim();
    const { error } = await supabase.rpc("complete_my_onboarding" as any, {
      p_full_name: fullName,
      p_location: location.trim(),
      /* Kept only for compatibility with the existing RPC signature. Profession is not a
         OneWorld requirement; OneJob asks for it when someone chooses to be discoverable as a
         professional. */
      p_job_title: null,
      p_terms_version: "OWL-2026-09-06.1",
    });
    setBusy(false);
    if (error) { setErr(say(error)); return; }
    /* Welcome/confirmation email — fire-and-forget. The account is fully set up here, so we know
       which sign-in methods exist (email code always; a password if they set one). A missing
       welcome email must NEVER block finishing, so this is not awaited and swallows its own error;
       the edge function derives the recipient from the JWT, so nothing sensitive rides the body. */
    void (async () => {
      try {
        const methods = ["Your email (we text you a 6-digit code)"];
        if (pw.length >= 10) methods.push("A password you set");
        await supabase.functions.invoke("welcome-email", {
          body: { name: `${first.trim()} ${last.trim()}`.trim(), methods },
        });
      } catch { /* non-blocking */ }
    })();
    window.location.replace(next);
  };

  /* Enter submits the current step — dispatched here so the one hidden submit button works on
     every screen. The two code steps auto-submit at six digits, so Enter is a no-op there. */
  const submitStep = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (step === "email" && emailOk && !!captcha) void sendEmailCode();
    else if (step === "phone" && phoneOk) void sendSms();
    else if (step === "name" && first.trim() && last.trim()) void saveName();
    else if (step === "password" && passwordAcceptable(pw, pw2, breached)) void savePassword();
    else if (step === "location" && location.trim() && agreed) void finish();
  };

  // ── CHROME ────────────────────────────────────────────────────────────────────────────────
  /* `Field` and `Head` are now module-scope (top of file) so typing does not remount the input.
     `Primary`/`BackLink`/`Progress`/`Terms` stay local because they close over `busy`/`step`/`t`
     and hold no focusable input, so their re-creation is harmless. */
  const Primary = ({ onClick, children, disabled }:
    { onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled || busy}
      className="ow-tap btn-primary w-full rounded-2xl py-3.5 text-[15px] font-bold
                 disabled:opacity-50">
      {busy ? "…" : children}
    </button>
  );

  /* No arrow. Lee: *"it's just… it's gonna look cleaner without the arrow."* */
  const BackLink = () => {
    const floor = accountReady ? ORDER.indexOf("phone") : 0;
    if (ORDER.indexOf(step) > floor) {
      return <OnboardingAction onClick={stepBack} disabled={busy}>{t("back")}</OnboardingAction>;
    }
    if (!accountReady) return null;
    return <div className="pt-1 text-center">
      <OnboardingAction onClick={() => { void startOverAtSignIn(); }} disabled={busy}
        data-onboarding-action="restart" aria-describedby="onboarding-restart-help">
        {t("startOver")}
      </OnboardingAction>
      <p id="onboarding-restart-help" className="mt-2 px-3 text-xs leading-relaxed opacity-70">
        {t("startOverHelp")}
      </p>
    </div>;
  };

  const Progress = () => {
    const i = ORDER.indexOf(step);
    return <div className="ow-onboarding-progress" role="progressbar" aria-label={W(lang, "Account setup progress", "Progreso de la cuenta")}
      aria-valuemin={1} aria-valuemax={ORDER.length} aria-valuenow={i + 1}>
      <div className="ow-onboarding-progress-caption"><span>One ID</span><span>{i + 1} / {ORDER.length}</span></div>
      <div className="ow-onboarding-progress-track" aria-hidden="true">
        {ORDER.map((_, n) => <span key={n} data-state={n < i ? "complete" : n === i ? "current" : "upcoming"} />)}
      </div>
    </div>;
  };

  if (booting) return <div className="mx-auto w-full max-w-sm py-16 text-center opacity-40">…</div>;

  if (resumeFailed) return <div className="mx-auto max-w-sm space-y-5 py-12" role="alert">
    <h1 className="text-xl font-bold">{W(lang, "Your account is safe", "Su cuenta está segura")}</h1>
    <p>{err}</p><OnboardingAction onClick={() => window.location.reload()}>{W(lang, "Try again", "Intentar de nuevo")}</OnboardingAction>
    <a href={"/signin?next=" + encodeURIComponent(next)} className="block text-center underline">{W(lang, "Sign in to resume", "Ingresar para continuar")}</a>
  </div>;

  return (
    <form ref={formRef} onSubmit={submitStep} noValidate className="ow-onboarding mx-auto w-full max-w-sm space-y-4">
      <Progress />

      {resumed && step !== "location" && (
        <Head title={t("resumeTitle")} sub={t("resumeSub")} />
      )}

      {step === "email" && (
        <>
          <Head title={t("createTitle")} sub={t("createSub")} />

          {/* GOOGLE, then APPLE (disabled + "Coming soon") — identical to `/signin`, from the
              same component, so the two screens cannot drift. */}
          <ProviderDoors onPick={p => void oauth(p)} busy={busy} />

          <div className="flex items-center gap-3 py-1 text-[11px] font-semibold uppercase tracking-widest opacity-35">
            <span className="h-px flex-1 bg-current" />or<span className="h-px flex-1 bg-current" />
          </div>

          <Field label={t("emailLabel")} type="email" inputMode="email" autoComplete="email"
            value={email} placeholder={t("emailPlaceholder")}
            onChange={e => setEmail(e.target.value)} />
          <Turnstile onToken={(tok, status) => { setCaptcha(tok); setCaptchaStatus(status); }} />
          {captchaStatus !== "ok" && (
            <p className="text-center text-[12px] font-medium opacity-60">
              {captchaStatus === "loading"
                ? "Checking your browser before we send a code."
                : "Bot check did not finish. Reload this page and try again."}
            </p>
          )}
          {/* NO SECOND ERROR HERE. The global banner at the bottom of this form already renders
              `err` for every step, so this line printed the same sentence twice — Lee
              photographed "Token has expired or is invalid" appearing once under the code boxes
              and again in a banner below them. Two copies of one problem reads as two problems. */}
          <Primary onClick={sendEmailCode} disabled={!emailOk || !captcha}>{t("continue")}</Primary>
        </>
      )}

      {step === "emailCode" && (
        <>
          <Head title={t("emailCodeTitle")} sub={`${t("emailCodeSub")} ${email.trim()}`} />
          <CodeBoxes value={emailCode} invalid={!!err} onChange={value => { setEmailCode(value); setErr(null); }}
            onComplete={(c) => { void verifyEmailCode(c); }} />
          {/* Duplicate error render removed — see the note on the email step. */}

          {/* ── WHEN THE CODE IS REJECTED, OFFER THE ONE THING THAT HELPS ───────────────────
                 Supabase's own sentence for a spent or unknown token is "Token has expired or is
                 invalid", and a person who received that code fifteen seconds ago reads it as the
                 product lying to them. `spentToken` catches exactly that error and does two
                 things the raw message cannot: it explains the most likely cause in plain words,
                 and it drops the resend cooldown, because the correct next action is a new code
                 and making somebody wait 25 seconds for it is punishing them for our bug. */}
          {spentToken && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-[12.5px] leading-relaxed">
              <p className="font-bold">{W(lang, "That code didn't go through.", "Ese código no funcionó.")}</p>
              <p className="mt-1 opacity-80">
                {W(lang,
                  "If you opened the link in the same email, the code was already used — they are one and the same. Send a fresh one and type it without opening the link.",
                  "Si abrió el enlace del mismo correo, el código ya se usó — son el mismo. Pida uno nuevo y escríbalo sin abrir el enlace.")}
              </p>
            </div>
          )}
          {/* ── THE BOT-CHECK IS FOR RESEND ONLY, AND STAYS HIDDEN UNTIL THEN ────────────────
              Lee UAT, 7 Aug 2026: a second "Verify you are human" box on the code screen read as
              being asked to prove you're human twice. It is only needed to mint a FRESH token for
              a resend (the first was spent getting here, and reuse is what Supabase rejects). So it
              shows only once the resend cooldown elapses — while the person is typing the code they
              just received, there is no captcha in sight. */}
          {(cooldown <= 0 || spentToken) ? (
            <>
              <Turnstile onToken={(tok, status) => { setCaptcha(tok); setCaptchaStatus(status); }} />
              <button type="button" onClick={() => { void sendEmailCode(); }} disabled={busy || !captcha}
                className="w-full py-2 text-[14px] font-semibold opacity-60 disabled:opacity-30">
                {t("resend")}
              </button>
            </>
          ) : (
            <button disabled
              className="w-full py-2 text-[14px] font-semibold opacity-30">
              {`${t("resendIn")} ${cooldown}s`}
            </button>
          )}
        </>
      )}

      {step === "phone" && (
        <>
          <Head title={t("phoneTitle")} sub={t("phoneSub")} />
          <PhoneField label={t("phoneLabel")} countryIso={countryIso} onCountry={setCountryIso} countryLabel={W(lang, "Country calling code", "Código de país")}
            value={phone} placeholder={t("phonePlaceholder")} onChange={setPhone} />
          <Primary onClick={sendSms} disabled={!phoneOk}>{t("continue")}</Primary>
          {phoneConflict && <p className="text-sm leading-relaxed">{W(lang, "This number belongs to an existing account. Use that account’s email to sign in and resume, or enter a different number.", "Este número pertenece a una cuenta existente. Ingrese con el correo de esa cuenta para continuar, o use otro número.")} <button type="button" className="underline" onClick={async () => { const { error } = await supabase.auth.signOut({ scope: "local" }); if (error) { setErr(say(error)); return; } window.location.assign("/signin?next=" + encodeURIComponent(next)); }}>{W(lang, "Sign in to the existing account", "Ingresar a la cuenta existente")}</button></p>}
          <BackLink />
        </>
      )}

      {step === "smsCode" && (
        <>
          <Head title={t("smsCodeTitle")} sub={`${t("smsCodeSub")} ${e164()}`} />
          <CodeBoxes value={smsCode} invalid={!!err} onChange={value => { setSmsCode(value); setErr(null); }}
            onComplete={(c) => { void verifySms(c); }} />
          <button type="button" onClick={() => { void sendSms(); }} disabled={cooldown > 0 || busy}
            className="w-full py-2 text-[14px] font-semibold opacity-60 disabled:opacity-30">
            {cooldown > 0 ? `${t("resendIn")} ${cooldown}s` : t("resend")}
          </button>
          <BackLink />
        </>
      )}

      {step === "name" && (
        <>
          <Head title={t("nameTitle")} sub={t("nameSub")} />
          <Field label={t("firstName")} autoComplete="given-name"
            value={first} onChange={e => setFirst(e.target.value)} />
          <Field label={t("lastName")} autoComplete="family-name"
            value={last} onChange={e => setLast(e.target.value)} />
          <Primary onClick={saveName} disabled={!first.trim() || !last.trim()}>{t("continue")}</Primary>
          <BackLink />
        </>
      )}

      {step === "password" && (
        <>
          <Head title={t("passwordTitle")} sub={t("passwordSub")} />
          <PasswordField label={t("password")} value={pw} onChange={setPw} autoComplete="new-password" />
          <PasswordField label={t("confirmPassword")} value={pw2} onChange={setPw2} autoComplete="new-password" />
          {/* The live rules — each ticks green as it is satisfied. Shown once the person starts
              typing so an untouched screen is not a wall of red. */}
          {pw.length > 0 && <PasswordChecklist pw={pw} pw2={pw2} breached={breached} />}
          <Primary onClick={savePassword} disabled={!passwordAcceptable(pw, pw2, breached)}>{t("continue")}</Primary>
          {/* The promised skip, now real. Its absence in the first cut could trap a returning
              member on this screen on a second device — Max caught it in review. */}
          <OnboardingAction onClick={skipPassword} disabled={busy}>{t("skip")}</OnboardingAction>
          <BackLink />
        </>
      )}

      {step === "location" && (
        <>
          <Head title={t("locationTitle")} sub={t("locationSub")} />
          <LocationField label={t("locationLabel")}
            value={location} placeholder={t("locationPlaceholder")} onChange={setLocation} />
          {/* ── TERMS ARE AN ACTIVE CHECKBOX, ABOVE THE BUTTON ───────────────────────────────
              Lee, 7 Aug 2026: *"there should really be a checkbox… that should be flipped… and
              below that should be the finish button."* So agreement is a deliberate tick, not
              passive small print, and it sits ABOVE Finish. The linked documents carry the money
              terms (how funds are held, the One World Labs fee, when OneJob charges a fee) — this
              tick is the single recorded point of agreement, so Finish stays disabled until it. */}
          <label className="ow-onboarding-agreement flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-deep)]" />
            <span className="text-[14px] leading-relaxed">
              {t("termsPre")}
              <LegalWindowLink href="/terms">{t("termsLink")}</LegalWindowLink>
              {t("termsAnd")}
              <LegalWindowLink href="/privacy">{t("privacyLink")}</LegalWindowLink>
              {t("termsPost")}
            </span>
          </label>
          <Primary onClick={finish} disabled={!location.trim() || !agreed}>{t("finish")}</Primary>
          <BackLink />
        </>
      )}

      {/* The server's own sentence, never a friendly summary of it. A catch-all error message
          hid four separate root causes across four test rounds in August 2026 and was the most
          expensive line of code written that week. */}
      {err && (
        <p role="alert" className="rounded-2xl bg-red-500/10 px-4 py-3 text-[13px] leading-relaxed text-red-600 dark:text-red-400">
          {err}
        </p>
      )}
      {/* Enables implicit Enter-to-submit without adding a second visible button. */}
      <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
    </form>
  );
}
