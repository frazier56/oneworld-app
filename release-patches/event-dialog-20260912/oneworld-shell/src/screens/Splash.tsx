import { useI18n } from "../lib/i18n";
import LangPicker from "../components/LangPicker";
import { sc } from "../lib/shellCopy";
import { OneIdNotice } from "../lib/oneId";
import Wordmark from "../components/Wordmark";
import type { AppConfig } from "../config";

/**
 * THE SPLASH — one component, eight sets of words.
 *
 * Lee, 2 Aug 2026: "the splash page, then the login page — all of that needs to be the same.
 * Same format, same look. It's just gonna have different words."
 *
 * So the structure below never varies by product. Only `headline`, `sub` and the hue change,
 * and both come from the product's own dictionary. Nobody forks this file.
 *
 * The parent brand is deliberately SMALL here. Google's signed-out Gmail screen says "Sign in —
 * to continue to Gmail" with the Google wordmark reduced to a mark; the product the person came
 * for is the large thing on screen. Someone who clicked a OneJob advert should see OneJob, not a
 * holding company they have never heard of.
 */
export default function Splash({ headline, sub, pitch, onSignIn, onJoin, wordmark, below }:
  { headline: string; sub: string;
    /** 2-3 sentences saying what the product does. Rendered UNDER the buttons — see below. */
    pitch?: string;
    onSignIn: () => void; onJoin?: () => void;
    /**
     * The mark, above the headline. Lee, 4 Aug 2026: *"the logo is missing from all of the shell
     * pages."* The splash is the first screen anybody sees and it carried no mark at all — the
     * person met a sentence with no idea whose it was.
     */
    wordmark?: AppConfig["wordmark"];
    /**
     * Content BELOW the buttons. The eight products go here on the One World splash.
     *
     * Lee, 4 Aug 2026: *"all of that app and app description should go under the sign in. You
     * shouldn't have to scroll that far to sign in."* Right — it was above the button, so the
     * one thing the screen exists to do had eight rows of marketing in front of it. The pitch
     * still gets read; it just stops standing in the doorway.
     *
     * A slot rather than a prop-per-thing, so the eight product splashes stay exactly as they
     * are and this screen does not fork the component to say one more sentence.
     */
    below?: React.ReactNode }) {
  const { t, lang } = useI18n();

  /* ── WHICH LANGUAGES ARE OFFERED IS NOT DECIDED HERE ──────────────────────────────────────
     It used to be, and it was got wrong once in exactly the way that matters: all seven were
     mapped while products shipped three, so four flags visibly selected, changed nothing, and
     PERSISTED the choice — after which the header painted a German flag with no German row to
     change it back with. `LangPicker` derives the list from the dictionary the provider actually
     resolved, so that class of bug cannot be reintroduced from this file. */

  return (
    /* ── CENTRED, BECAUSE IT IS AN APP ────────────────────────────────────────────────────
       Lee, 4 Aug 2026: *"I'm thinking that logo needs to be centered because it's an app. The
       only time it would be on the left side is if it was a website."*

       That is the right distinction and it settles the whole screen, not just the mark. A
       left-aligned wordmark is a website header — it sits at the start of a navigation bar. An
       app's launch screen has no navigation, so the mark has nothing to align to and centring is
       what every app store screenshot on a phone looks like. Half-centring would be worse than
       either: a centred mark over a left-ragged headline reads as a mistake.

       ── AND THE VERTICAL RHYTHM ────────────────────────────────────────────────────────────
       Lee: *"the scrolling marquee — vertically it's not centred between the Join text and the
       small text at the bottom. I would shift it up a little so it's vertically centred."*

       So the page is four bands: header, the two buttons, a FLEXIBLE middle that centres whatever
       is in it, and the small print pinned at the bottom. On the eight product splashes the
       middle band is empty, which makes it behave exactly as the old `justify-between` did —
       nothing about those screens changes. */
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-6 py-10 text-center">
      <header className="pt-1">
        {/* LANGUAGE AT THE TOP (Lee, 17 Aug 2026): *"people aren't gonna scroll... put the same
            language selector at the top... I'm thinking maybe top middle."* Top-centre, first
            thing on the screen — if the language is wrong, the fix is the first control you see.
            Same control as before, opening DOWNWARD now because it sits at the top.

            v11 (Lee, 18 Aug 2026, from the live screenshot): *"the logo is too small, and it makes
            the translator button above it look too big... the logo definitely needs to be, like,
            twice the size."* So the mark doubles (34 → 68), the picker slides UP (header pt-6 →
            pt-1) to hand that vertical room to the mark, and the gap under the picker widens so
            the logo owns its own band in the middle instead of crowding the control above it. */}
        <div className="mb-8 flex justify-center"><LangPicker dropUp={false} /></div>
        {wordmark && <div className="mb-7 flex justify-center"><Wordmark wordmark={wordmark} h={68} /></div>}
        <h1 className="text-[30px] font-extrabold leading-[1.12] tracking-tight">{headline}</h1>
        <p className="mt-3 text-[15px] leading-snug opacity-60">{sub}</p>

        {/* ── ONE ID AS A THING, NOT AS A SENTENCE ─────────────────────────────────────────
            Lee, 3 Aug: the copy *"does not clearly explain that one sign-in gives access across
            the ecosystem."* Then, 4 Aug, on the blue line that answered it: *"I like the blue
            text that says one sign-in works across all eight apps. I wouldn't say eight, I would
            just say all apps... I would use that One ID framework we have on the One World Labs
            home page. You can have a graphic there instead of just blue text... advertise it as
            if it's a thing, like the trademark."*

            Both notes point the same way. A sentence describes a feature; a badge names an
            ASSET. The hub already treats One ID as a named thing, so this matches it rather than
            inventing a second treatment.

            "All apps", not "all eight" — a number has to be maintained, and it was already wrong
            once this week (the marketing site still says two services; there are three). */}
        {/* ── NO ICON. Lee, 4 Aug 2026: *"the icon on the left is not centred with it. Put the
            icon outside the panel, or don't even use the icon — take it away, re-centre
            everything, it will look perfectly centred. That would probably be better."*

            He is right and the geometry says why. An icon on the left of a centred pill makes the
            BOX centred while the TEXT inside it is pushed right of the box's middle. The eye
            centres on the words, so the whole badge reads as off-axis against the logo above it —
            which is exactly the misalignment he drew a vertical line through. Removing the icon
            makes the text's centre and the box's centre the same point, and the badge lines up
            with everything else on the page for free. */}
        <div className="mx-auto mt-5 inline-block rounded-2xl border-[1.5px] border-brand/70 bg-brand/[0.09] px-5 py-2 text-center leading-tight">
          <span className="block text-[13.5px] font-extrabold tracking-tight text-brand">One ID</span>
          <span className="block text-[11.5px] font-medium opacity-60">{sc(lang, "oneIdWorks")}</span>
        </div>
      </header>

      {/* v12 (Lee, 18 Aug 2026): FLIPPED. *"the big button should say create your account, and
          the small text should say sign in... the big call to action is to get people to create
          their account."* Growth-standard and he's right: a splash is mostly met by people
          without an account, and returning members know to look for the small sign-in. The big
          espresso CTA is now CREATE ACCOUNT; Sign in is the quiet line under it. When a splash
          has no onJoin path, the primary falls back to Sign in and the quiet line hides —
          never two buttons doing the same thing. */}
      <div className="mt-9 space-y-3">
        <button onClick={onJoin ?? onSignIn}
          className="ow-tap btn-primary w-full rounded-2xl py-4 text-[16px] font-bold">
          {onJoin ? t("join") : t("signin")}
        </button>

        {onJoin && (
          <button onClick={onSignIn}
            className="ow-tap w-full rounded-2xl py-3 text-[14px] font-semibold opacity-60">
            {t("signin")}
          </button>
        )}

      </div>

      {/* ── WHAT THIS APP ACTUALLY IS ─────────────────────────────────────────────────
          Lee, 13 Aug 2026: *"every splash and landing page needs two or three sentences of
          marketing under the sign-in block explaining what the app actually is. Right now
          there is nothing."*

          UNDER the buttons, deliberately, and for the same reason the product list moved
          there on 4 Aug: *"you shouldn't have to scroll that far to sign in."* Somebody who
          already knows what they came for should not read a paragraph to reach the button,
          and somebody who does not know will keep reading past it. Both are served by
          putting the pitch second.

          Small and dimmed rather than body-sized: it is the third thing on the screen, after
          the headline and the decision. */}
      {pitch && (
        <p className="mx-auto mt-6 max-w-[30rem] text-[13.5px] leading-relaxed opacity-55">
          {pitch}
        </p>
      )}

      {/* The flexible middle. Whatever sits here is centred in the space left between the buttons
          and the small print, so the marquee has equal air above and below it at any screen
          height. Carries the family marquee on EVERY splash from 11 Aug 2026 — it used to be empty
          on the product splashes, which left a blank stripe Lee circled in two screenshots. */}
      <div className="flex min-w-0 flex-1 items-center justify-center py-4">{below}</div>

      <div className="space-y-3 pt-6">
        <OneIdNotice />

        {/* Language moved to the TOP of the screen (Lee, 17 Aug 2026) — nothing down here now;
            the 4 Aug drop-up note lives with the control's new home in the header. */}
      </div>
    </div>
  );
}
