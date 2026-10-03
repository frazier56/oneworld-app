import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { readPref, writePref } from "../lib/safeStorage";

/**
 * ACCOUNT SETUP — the three choices, once, in the shell.
 * ============================================================================================
 * Lee, 4 Aug 2026: *"the biometrics, the ninety day, the notification — all that stuff is the
 * normal flow for everyone. Every app goes to that same process for the sign up, for account
 * creation. The only difference per app is that the background colour may be different, but the
 * information, how it's laid out on the screen, should be identical, because you're creating
 * profile-level information. It's not specific to the app itself, it's specific to the person."*
 *
 * That sentence is the whole design. These are facts about a PERSON — how long their session
 * lives, whether their face unlocks it, whether their phone may buzz. None of them belong to a
 * product, so none of them may be re-implemented by one. This screen renders identically in all
 * eight; the aurora behind it is the only thing that changes, and it changes for free because
 * `AppShell` has already applied the product's hue before this paints.
 *
 * ── Why a screen rather than three settings rows ────────────────────────────────────────────
 * All three are worth more the moment the account exists and worth almost nothing buried in
 * Settings, because the person who would benefit most never goes to Settings. Notifications in
 * particular are one-shot: the browser lets you ask ONCE, and a denial is close to permanent. So
 * it is asked deliberately, after the account is real, with the reason next to it — never on
 * page load, which is how a permission prompt gets refused reflexively.
 *
 * ── Shown once, and skippable ───────────────────────────────────────────────────────────────
 * "Not now" is a real answer and it is one tap. Everything here is reachable later from
 * Settings, so a person who declines has lost nothing — but a person who is forced to decide
 * three times has learned the product nags.
 */

/** Per-account, per-device. Stamped when the screen is finished OR skipped. */
const setupKey = (uid: string) => `ow.setup.${uid}`;

/**
 * NINETY DAYS. Lee asked for "stay signed in 90 days".
 *
 * Two halves, and only one of them lives in this file:
 *   · the SERVER decides how long a refresh token may live — a project setting, not code;
 *   · the CLIENT decides whether to keep refreshing it, which is what this preference drives.
 *
 * Left off, the person is signed out when their session lapses. Left on, the client keeps the
 * session alive on this device for the window below. Recording the choice is what makes it
 * honest: a promise of "90 days" with nothing storing the answer is a promise nobody kept.
 */
export const STAY_KEY = "ow.stay90";
export const STAY_DAYS = 90;

export function staysSignedIn(): boolean {
  return readPref(STAY_KEY) !== "0";     // default ON — this is a consumer app, not a bank console
}

type Step = "biometrics" | "stay" | "notifications" | "done";

export default function AccountSetup({ onDone }: { onDone: () => void }) {
  const { userId } = useOneId();
  const { t } = useI18n();
  /* ── ORDER: BIOMETRICS, THEN STAY SIGNED IN, THEN NOTIFICATIONS ──────────────────────
     Lee, 4 Aug 2026, thinking it through out loud and landing here: *"I think biometrics should
     be first and then stay signed in and then notifications."*

     It is the right order for a reason worth writing down: biometrics and "stay signed in" are
     the SAME question asked twice — how much friction do you want on the way back in — and
     answering the strong one first makes the weak one easy. Someone who has just enrolled a
     fingerprint says yes to ninety days without thinking, because the fingerprint is what makes
     ninety days feel safe. Asked the other way round, "stay signed in for 90 days" sounds like a
     risk, and the person who declines it has already decided this app is careless before the
     biometrics screen even loads. Notifications is a different question and goes last. */
  const [step, setStep] = useState<Step>("biometrics");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /* Whether this device can do biometrics AT ALL. Asked before the step is offered, because an
     offer that cannot be accepted is worse than no offer — the person taps, nothing happens, and
     they conclude the app is broken. Desktop Chrome without a platform authenticator answers
     false here and the step is skipped silently. */
  const [canBio, setCanBio] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const ok = typeof window !== "undefined"
      && typeof (window as any).PublicKeyCredential !== "undefined";
    if (!ok) { setCanBio(false); return; }
    (window as any).PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable()
      .then((v: boolean) => { if (alive) setCanBio(v); })
      .catch(() => { if (alive) setCanBio(false); });
    return () => { alive = false; };
  }, []);

  const finish = () => {
    if (userId) writePref(setupKey(userId), "1");
    onDone();
  };

  /* ── AN ERROR MUST NOT OUTLIVE THE SCREEN THAT PRODUCED IT ───────────────────────────
     Lee, 5 Aug 2026: *"the error message is carrying across the next pages."* It was: `note`
     is one piece of state shared by three steps, so a biometrics failure was still sitting
     there under the notifications button. Cleared on every transition — a message about a
     screen you have left is worse than no message, because the person reads it as a new
     failure of whatever they are looking at now. */
  const next = () => {
    setNote(null);
    if (step === "biometrics") { setStep("stay"); return; }
    if (step === "stay") { setStep("notifications"); return; }
    finish();
  };

  /* A device with no platform authenticator never sees the biometrics step — an offer that
     cannot be accepted is worse than no offer. `canBio` is null until the probe answers, so the
     screen holds rather than flashing the wrong step first. */
  useEffect(() => {
    if (canBio === false && step === "biometrics") setStep("stay");
  }, [canBio, step]);

  /* ── BIOMETRICS ───────────────────────────────────────────────────────────────────────────
     A passkey bound to THIS origin. The relying-party id is the origin and it can never change
     afterwards — a passkey enrolled against one host is unusable from another, and there is no
     migration. That is a second, quieter reason the single-origin decision was right: eight
     hostnames would have meant eight enrolments and eight ways to strand somebody. */
  /**
   * ── WRONG API ENTIRELY. THIS IS WHY IT KEPT FAILING ──────────────────────────────────────
   * Lee's third test finally printed the real sentence, because the catch-all was replaced with
   * the server's own words: **"MFA enroll is disabled for WebAuthn."**
   *
   * That is not a misconfiguration to go and switch on — there is no such switch on this project.
   * Supabase has TWO separate WebAuthn features and I had been calling the wrong one:
   *
   *   · `mfa.enroll({factorType:"webauthn"})` — a SECOND FACTOR, added on top of a password.
   *     Not enabled here, and not what was wanted.
   *   · `auth.registerPasskey()` — a passkey as a way to SIGN IN. This is the Passkeys (BETA)
   *     feature, enabled 4 Aug 2026 with relying party `app.oneworldlabs.ai`.
   *
   * The second one is what "unlock it the way you unlock your phone" actually means, and it is
   * the one that has been switched on the whole time. `registerPasskey` runs the entire WebAuthn
   * ceremony itself — challenge, `navigator.credentials.create()`, verification — so the three
   * hand-rolled calls this replaced were solving a problem the SDK had already solved.
   *
   * THE LESSON, written down because it cost three test rounds: a generic error message is not a
   * kindness, it is a blindfold. Printing the server's own sentence solved this in one reading.
   */
  const enrolBiometrics = async () => {
    setBusy(true); setNote(null);
    const auth = supabase.auth as any;
    try {
      if (!auth.passkey?.startRegistration) throw new Error("This browser build does not support passkeys.");

      /* STEP 1 - ask the server for a challenge and the creation options it wants. */
      const { data, error } = await auth.passkey.startRegistration();
      if (error) throw error;

      const o = data.options.publicKey ?? data.options;
      const publicKey: any = {
        ...o,
        challenge: b64uToBuf(o.challenge),
        user: { ...o.user, id: b64uToBuf(o.user.id) },
        excludeCredentials: (o.excludeCredentials ?? []).map((c: any) => ({ ...c, id: b64uToBuf(c.id) })),

        /* == STEP 2 - OVERRIDE SUPABASE'S DEFAULTS. THIS IS THE WHOLE FIX =================
           Lee, 5 Aug 2026: *"it's asking for a passkey. It's not bringing up the fingerprint.
           Your fingerprint should show up - that would be the expected result."*

           He is right, and the reason is sitting in the SDK's own source. Its defaults are
           written for YubiKeys, not phones:

               hints: ['security-key']
               authenticatorAttachment: 'cross-platform'
               residentKey: 'discouraged'
               userVerification: 'preferred'   // "older yubikeys don't have PIN/Biometric"

           `cross-platform` means *a key that is NOT this device*, so Android correctly showed
           the generic "create a passkey" chooser - plug in a key, or use another phone - and
           never touched the fingerprint sensor. Nothing was broken. It was doing exactly what
           it had been asked to do.

           Every one of those is flipped below. `platform` means THIS device's own sensor.
           `userVerification: required` forces the biometric instead of letting it be skipped.
           `residentKey: required` makes it discoverable, which is what lets it sign you in
           later without typing an email first. */
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "required",
          requireResidentKey: true,
          userVerification: "required",
        },
        hints: ["client-device"],
        attestation: "none",
      };

      const cred: any = await navigator.credentials.create({ publicKey });
      if (!cred) throw new Error("No credential was created.");

      /* STEP 3 - hand it back for verification. */
      const r = cred.response;
      const { error: vErr } = await auth.passkey.verifyRegistration({
        challengeId: data.challenge_id,
        credential: {
          id: cred.id,
          rawId: bufToB64u(cred.rawId),
          type: cred.type,
          authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
          clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
          response: {
            clientDataJSON: bufToB64u(r.clientDataJSON),
            attestationObject: bufToB64u(r.attestationObject),
            transports: r.getTransports?.() ?? [],
          },
        },
      });
      if (vErr) throw vErr;

      setNote("Biometrics are on for this device.");
      setTimeout(next, 900);
    } catch (e: any) {
      const msg = String(e?.message ?? e?.error_description ?? e ?? "");
      const name = String(e?.name ?? "");
      /* ── A CANCELLED / TIMED-OUT CEREMONY IS "NOT NOW", NOT A FAILURE ─────────────────────────
         Lee UAT, 7 Aug 2026: the screen showed a scary red "Could not turn it on: The operation
         either timed out or was not allowed" even though the fingerprint then worked. That is the
         standard WebAuthn `NotAllowedError` a person triggers by dismissing the sheet or letting it
         time out. The old test only matched the string "NotAllowed" (no space), so the real message
         "was not allowed" / "timed out" slipped through and printed as an error. Match the exception
         NAME and both phrasings, and treat it as the benign decision it is. */
      const benign =
        /NotAllowed|Abort/i.test(name) ||
        /abort|cancel|not\s*allowed|timed?\s*out/i.test(msg);
      if (benign) {
        setNote("No problem - you can turn this on later in Settings.");
      } else {
        setNote(msg ? `Could not turn it on: ${msg}` : "Could not turn it on. You can try again in Settings.");
      }
    } finally { setBusy(false); }
  };

  /* ── NOTIFICATIONS ────────────────────────────────────────────────────────────────────────
     Asked ON A TAP, never on load. The browser grants exactly one chance to ask, and a prompt
     that appears unprompted is refused far more often than one the person asked for. */
  const askNotifications = async () => {
    setBusy(true); setNote(null);
    try {
      if (typeof Notification === "undefined") { finish(); return; }
      /* v25: two real-world traps fixed here.
         1) Safari (macOS legacy / some wrappers) implements the CALLBACK form of
            requestPermission - the shim below supports both the promise and callback forms.
         2) Edge/Chrome "quieter messaging" parks the prompt as a bell icon in the address
            bar and the promise stays PENDING until the person finds it - which they often
            never do. A 12-second race treats no-answer as "default" (left off) so the
            screen always moves on; if they answer the bell later, the browser still
            remembers their choice for next time. */
      const request = () => new Promise<NotificationPermission>((resolve) => {
        try {
          const maybe = Notification.requestPermission((p) => resolve(p));
          if (maybe && typeof (maybe as Promise<NotificationPermission>).then === "function") {
            (maybe as Promise<NotificationPermission>).then(resolve).catch(() => resolve("default"));
          }
        } catch { resolve("default"); }
      });
      const r = await Promise.race<NotificationPermission>([
        request(),
        new Promise<NotificationPermission>((res) => setTimeout(() => res("default"), 12000)),
      ]);
      setNote(r === "granted"
        ? "You are set. We will only send things that need you."
        : r === "denied"
          ? "Left off. You can turn it on later in Settings."
          : "No answer from the browser - look for the bell icon in the address bar, or turn it on later in Settings.");
      setTimeout(finish, r === "default" ? 1600 : 900);
    } catch { finish(); } finally { setBusy(false); }
  };

  const Frame = ({ title, body, children, back }: { title: string; body: string; children: React.ReactNode; back?: () => void }) => (
    <div className="mx-auto grid min-h-[100dvh] max-w-md place-items-center px-5">
      <div className="w-full">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em] opacity-40">
          {t("signin") === "Sign in" ? "One ID" : "One ID"}
        </p>
        <h1 className="mt-2 text-center text-[26px] font-extrabold leading-tight">{title}</h1>
        <p className="mx-auto mt-3 max-w-[19rem] text-center text-[14px] leading-snug opacity-60">{body}</p>
        <div className="mt-8 space-y-3">{children}</div>
        {note && <p className="mt-4 text-center text-[13px] font-medium opacity-70">{note}</p>}
        {/* v25 (Lee's stuck sign-in, 18 Aug 2026): "Not now" is the ESCAPE HATCH — it must
            never be disabled. Edge/Chrome show the notification prompt as a quiet bell in the
            address bar; Notification.requestPermission() then stays pending until the person
            finds that bell. With busy locking every button, the whole screen froze. */}
        <button type="button" onClick={step === "notifications" ? finish : next}
          className="ow-tap card mt-5 min-h-11 w-full rounded-2xl px-4 text-center
                     text-[13px] font-semibold opacity-70">
          Not now
        </button>
        {/* ── BACK, BECAUSE PEOPLE CHANGE THEIR MINDS ──────────────────────────────────────
            Lee, 4 Aug 2026: *"we need to have a back button too… in case they wanted to go back
            and change their mind about something."*

            "Not now" and "Back" are different answers and the screen was only offering one.
            Skipping says *no, move on*; going back says *wait, I answered the last one wrong* —
            and a flow that cannot be reversed makes people abandon it rather than risk a wrong
            choice they cannot undo. Hidden on the first step, where there is nothing behind it. */}
        {back && (
          <button type="button" onClick={back}
            className="ow-tap card mt-2 flex min-h-11 w-full items-center justify-center gap-2
                       rounded-2xl px-4 text-center text-[13px] font-semibold opacity-70">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12.5 4.5-5 5 5 5" />
            </svg>
            Back
          </button>
        )}
      </div>
    </div>
  );

  if (step === "stay") return (
    <Frame back={canBio ? () => { setNote(null); setStep("biometrics"); } : undefined}
           title="Stay signed in?"
           body={`Keep this device signed in for ${STAY_DAYS} days, so you are not asked every time you come back.`}>
      <button type="button" disabled={busy}
        onClick={() => { writePref(STAY_KEY, "1"); next(); }}
        className="ow-tap btn-primary w-full rounded-2xl py-4 text-[16px] font-bold">
        Keep me signed in
      </button>
      <button type="button" disabled={busy}
        onClick={() => { writePref(STAY_KEY, "0"); next(); }}
        className="ow-tap card w-full rounded-2xl py-3.5 text-[15px] font-semibold">
        Ask me every time
      </button>
    </Frame>
  );

  if (step === "biometrics") return (
    <Frame title="Use your face or fingerprint?"
           body="Unlock One World the way you unlock your phone. Nothing is sent to us — your device keeps it."
           back={undefined}>
      {/* Lee, 4 Aug 2026: *"usually when you're enabling biometrics you see the little fingerprint
          right above the button. So I would put that fingerprint there."* Right — it is the one
          glyph everybody already recognises, and it says "this is the thing your phone does"
          faster than the sentence above it can. */}
      <FingerprintMark />
      <button type="button" disabled={busy} onClick={enrolBiometrics}
        className="ow-tap btn-primary w-full rounded-2xl py-4 text-[16px] font-bold disabled:opacity-50">
        {busy ? "Waiting for your device…" : "Turn on biometrics"}
      </button>
    </Frame>
  );

  return (
    /* Lee, 4 Aug 2026: *"I don't like that sentence where it says 'can we tell you when it
       matters'. That's just not correct… if it says something it should be really, really short,
       because the grey text does the job."* He is right — the question mark was asking for
       permission twice, once in the heading and again in the button, and the grey line below
       already says exactly what will be sent. The heading is now a label, not a plea. */
    <Frame title="Notifications"
           body="Only the things you would want interrupting you — a job accepted, money released, someone waiting on a reply."
           back={() => { setNote(null); setStep("stay"); }}>
      <button type="button" disabled={busy} onClick={askNotifications}
        className="ow-tap btn-primary w-full rounded-2xl py-4 text-[16px] font-bold disabled:opacity-50">
        {busy ? "…" : "Turn on notifications"}
      </button>
    </Frame>
  );
}

/**
 * THE FINGERPRINT — Lee's own artwork, traced to vector.
 * ============================================================================================
 * He sent the exact glyph he wanted rather than describing it, which settles the argument: this
 * is that file, traced to a path so it takes `currentColor` and stays crisp at any size. A PNG
 * would have been one more asset to 404 and one more thing that cannot be recoloured — the same
 * lesson the wordmark taught. 2.6 kB of path data, no network request, no fallback needed.
 */
/* Lee, 4 Aug 2026: *"slide the fingerprint button up just a little bit because it needs to be
   centred vertically between the two sections."* The mark sat inside the button stack, so it
   inherited that stack's top spacing and read as belonging to the button rather than sitting in
   the gap between the sentence and the button. The negative top margin pulls it back up into
   that gap; the symmetric padding centres it inside it. */
function FingerprintMark() {
  return (
    <div className="-mt-3 grid place-items-center pb-2">
      <span className="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-ink/[0.05] dark:bg-white/10">
        {/* Lee, 4 Aug 2026: *"that's a better biometric image. You just have to turn it white or
              black depending on the background."* So it is INK on light and PAPER on dark, not the
              product hue — the glyph is a system affordance, the same one the phone itself draws,
              and those are never brand-coloured. `currentColor` is what makes that one class. */}
          <svg viewBox="0 0 382 512" width="40" height="40" aria-hidden
               className="text-ink dark:text-paper">
          <g transform="translate(0,512) scale(0.1,-0.1)" fill="currentColor" stroke="none">
            <path d="M1725 5109 c-497 -60 -1051 -319 -1429 -667 -86 -80 -101 -139 -47 -192 62 -63 100 -55 222 50 220 188 469 340 729 443 750 298 1463 157 2115 -420 50 -44 100 -85 112 -91 81 -44 178 36 153 126 -8 31 -29 56 -102 120 -402 350 -771 539 -1208 617 -113 20 -428 28 -545 14z M1700 4599 c-130 -14 -242 -38 -270 -58 -37 -26 -53 -83 -36 -124 32 -76 66 -83 247 -54 215 34 515 20 728 -34 634 -163 1055 -684 1201 -1489 32 -173 54 -210 127 -210 70 0 113 43 113 115 0 91 -77 411 -146 610 -50 143 -192 424 -271 535 -177 248 -458 473 -728 581 -276 110 -661 162 -965 128z M980 4379 c-383 -181 -708 -573 -859 -1034 -60 -184 -110 -443 -111 -572 0 -93 77 -147 156 -110 45 22 60 55 73 167 78 649 387 1137 857 1356 112 52 136 85 114 156 -25 85 -102 98 -230 37z M1690 4165 c-508 -83 -937 -467 -1130 -1011 -45 -127 -65 -220 -100 -459 -70 -472 -149 -726 -270 -868 -58 -68 -68 -102 -44 -152 47 -100 157 -81 247 42 131 179 222 479 292 963 40 277 75 399 162 575 217 434 605 696 1038 699 312 2 586 -103 911 -349 47 -35 98 -67 114 -70 68 -15 139 57 126 126 -18 98 -384 338 -669 438 -201 70 -483 98 -677 66z M1809 3740 c-501 -63 -837 -466 -914 -1096 -66 -544 -264 -1195 -416 -1368 -51 -57 -63 -90 -49 -131 24 -73 105 -105 167 -66 185 116 449 893 523 1541 54 467 280 787 620 877 91 24 281 24 375 -1 199 -52 363 -168 448 -316 67 -117 86 -219 147 -773 74 -665 110 -887 185 -1143 38 -128 106 -316 136 -376 39 -76 124 -96 180 -43 48 47 47 75 -10 217 -134 336 -181 577 -271 1394 -65 588 -79 660 -165 822 -162 309 -578 510 -956 462z M3103 3306 c-64 -29 -76 -88 -38 -189 63 -168 95 -372 125 -797 40 -565 73 -758 161 -933 37 -72 80 -96 140 -78 82 25 99 94 50 202 -62 139 -88 301 -121 759 -35 494 -71 726 -141 914 -45 119 -99 156 -176 122z M1855 3300 c-290 -51 -457 -317 -540 -858 -44 -292 -55 -348 -81 -439 -81 -282 -292 -707 -500 -1010 -101 -148 -108 -181 -49 -240 33 -33 39 -35 81 -30 59 6 70 17 179 182 113 170 184 293 280 484 179 358 246 564 295 906 82 563 199 785 416 785 91 0 207 -77 253 -169 96 -188 53 -521 -144 -1116 -178 -536 -448 -1140 -631 -1408 -58 -85 -65 -116 -39 -167 29 -56 96 -74 151 -41 162 99 648 1193 833 1876 135 498 140 750 21 973 -103 193 -323 307 -525 272z M1843 2830 c-41 -24 -48 -54 -63 -240 -57 -714 -338 -1453 -744 -1954 -94 -115 -107 -143 -95 -192 23 -84 119 -107 184 -44 265 254 577 836 729 1361 106 369 192 949 152 1027 -32 63 -101 80 -163 42z M2474 1542 c-29 -23 -35 -35 -103 -224 -176 -486 -316 -783 -511 -1087 -68 -106 -71 -148 -17 -198 41 -37 80 -43 126 -18 77 39 335 514 492 903 51 128 54 132 62 100 57 -235 216 -591 277 -623 60 -31 132 -8 156 51 18 43 12 65 -42 172 -93 183 -163 395 -228 692 -40 181 -56 222 -92 239 -37 16 -96 13 -120 -7z" />
          </g>
        </svg>
      </span>
    </div>
  );
}

/* WebAuthn speaks ArrayBuffers; the server speaks base64url. Written out here rather than
   imported from a deep path inside the SDK - those helpers are not a public export and would
   break on any patch release. */
const b64uToBuf = (v: string): ArrayBuffer => {
  const bin = atob(v.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const bufToB64u = (b: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Has this person already been through it on this device? */
export function needsAccountSetup(userId: string | null): boolean {
  if (!userId) return false;
  return readPref(setupKey(userId)) !== "1";
}
