import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase, W, useI18n } from "@oneworld/shell";

/**
 * THE ONE WORLD OPENER — R13.
 * ============================================================================================
 * Lee, 20 September 2026, holding his phone: *"make the film play."*
 *
 * The film has been sitting in the release as a static asset since batch 62 — 13 MB at
 * `/opener/one-world-opener-v5.mp4`, 1080×1920, about sixteen seconds — and NOTHING in the app
 * played it. This file is the thing that plays it.
 *
 * ── THE SEQUENCE, AND WHY IT IS ONE SHOT AND NOT A SCREEN ───────────────────────────────────
 * Film on a fresh open → fade into the LIVE "Create your One ID" screen with no cut and no white
 * frame → they sign in → the feed. The important word is LIVE. The film is not followed by a
 * picture of a sign-up screen and it does not hand over to a loading spinner: the real screen is
 * mounted and painted UNDERNEATH the film for the whole sixteen seconds, so when the video's
 * opacity goes to zero there is a finished, interactive screen already sitting there. That is
 * the only way to get "no cut, no white frame" — a route change at the end of the film would
 * give you both.
 *
 * Which is also why this is mounted ABOVE `<Routes>` in App.tsx rather than inside the root
 * route. It navigates the app underneath itself while it plays; if it lived inside the route it
 * was navigating away from, it would unmount itself mid-film.
 *
 * ── ONCE PER PERSON, EXCEPT WHERE LEE IS WATCHING IT ────────────────────────────────────────
 * Production: once, ever, per device. Sandbox: every single refresh, because Lee is designing it
 * and the version that only plays once is the version he cannot look at twice.
 *
 * ── EVERY EXIT LEADS FORWARD ────────────────────────────────────────────────────────────────
 * Autoplay refused, codec refused, file missing, network stalled, a person who would rather not
 * watch it, or somebody who arrived on a deep link: every one of those ends with the app, never
 * with a black rectangle. The watchdog below exists because the worst outcome of a launch film
 * is not "it did not play", it is "the app never appeared".
 */

/* ── V7, NARRATED, SEVEN LANGUAGES (PUB30) ─────────────────────────────────────────────────
   Seven cuts shipped and nothing chose between them, so ninety-two megabytes would have ridden
   along with only v5 ever playing. Pick the cut, fall back to English. World Feed 30's file;
   additive and declared. Full R16 and R17 stay theirs. */
const FILM_LANGS = ["en", "es", "de", "ru", "zh", "pt"];
function filmSrc(lang: string): string {
  let tag = "";
  try { tag = String(navigator.languages?.[0] || navigator.language || "").toLowerCase(); }
  catch { /* no navigator */ }
  if (tag.startsWith("es") && tag.includes("-co")) return "opener/one-world-opener-v7-co.mp4";
  const base = String(lang || tag.split("-")[0] || "en").toLowerCase();
  const pick = FILM_LANGS.indexOf(base) >= 0 ? base : "en";
  return `opener/one-world-opener-v7-${pick}.mp4`;
}
/** Versioned, so recutting the film shows it to everybody once more by construction. */
const KEY = "ow.opener.v7.seen";
/** The film's own frame. The skip pill's design coordinates are in this space. */
const FILM_W = 1080, FILM_H = 1920;
/** Design thread's measured position for the pill, in film pixels. */
const PILL_RIGHT = 44, PILL_TOP = 110;
/** Long enough that a slow first frame is not mistaken for a dead one; short enough to forgive. */
const STALL_MS = 4500;
/** The crossfade. Matches the chrome's curve so the whole product moves the same way. */
const FADE_MS = 320;

export function openerSeen(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function markOpenerSeen() {
  try { localStorage.setItem(KEY, "1"); } catch { /* seeing it twice is the harmless direction */ }
}
/** The menu's "Show the intro again" sibling, for when Lee wants the film back on production. */
export function clearOpenerSeen() {
  try { localStorage.removeItem(KEY); } catch { /* the caller replays it directly anyway */ }
}

/** Where the skip pill goes, given a viewport, if the film is drawn `object-cover`. */
function pillBox(w: number, h: number): { right: number; top: number } {
  /* `object-cover` scales by whichever axis needs the most, then centres and crops the other.
     On a 390×844 phone the film is scaled to fit the HEIGHT, so roughly 42 px of its width is
     cropped off each side — and the pill's design position, 44 px in from the film's own right
     edge, lands just outside the glass. So the mapped position is a starting point and the
     clamp is the thing that keeps a control the person has to tap on the screen. */
  const scale = Math.max(w / FILM_W, h / FILM_H);
  const dispW = FILM_W * scale, dispH = FILM_H * scale;
  const left = (w - dispW) / 2, top = (h - dispH) / 2;
  return {
    right: Math.max(12, w - (left + dispW - PILL_RIGHT * scale)),
    top: Math.max(12, top + PILL_TOP * scale),
  };
}

/**
 * ARMED IS DECIDED ONCE PER PAGE LOAD — AT MODULE SCOPE, NOT IN A HOOK.
 *
 * ⚠️ THIS WAS A REAL DEFECT AND THE HARNESS CAUGHT IT. The decision first lived in a `useState`
 * initialiser, which is "once per mount" — and React's StrictMode mounts every component twice
 * in development. Mount one armed the film and wrote the seen-flag; mount two re-read the flag,
 * found the one it had just written, and tore the film down about a second in. The sandbox hid
 * it completely, because the sandbox replays on every refresh and never reads the flag.
 *
 * A module-level latch is the right scope for the actual question, which is not "has this
 * component mounted before" but "has this PAGE LOAD already decided about the film". It survives
 * a remount and resets on a real navigation, which is exactly the lifetime wanted.
 *
 * It is also why the path is read here and never re-read: by the time anything could reconsider,
 * this component has already navigated the app underneath itself to `/join`, and a second look
 * would see a path that is no longer the root and pull the film off the screen.
 */
let decided: boolean | null = null;
function decideOnce(replayAlways: boolean, pathname: string): boolean {
  if (decided !== null) return decided;
  let ok = true;
  try {
    if (pathname !== "/" && pathname !== "") ok = false;        // a deep link is an errand, not an arrival
    else if (!replayAlways && openerSeen()) ok = false;
    else if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) ok = false;
  } catch { ok = false; }
  decided = ok;
  return ok;
}

export default function Opener({ replayAlways }: {
  /** True in the sandbox: play it on every refresh, not once per device. */
  replayAlways: boolean;
}) {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const vid = useRef<HTMLVideoElement | null>(null);

  const [armed] = useState(() => decideOnce(replayAlways, pathname));

  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(!armed);
  const [muted, setMuted] = useState(false);
  const [box, setBox] = useState(() => {
    /* The film's column, not the window — the pill's design coordinates are in the FILM's
       frame, and since R19 that frame is capped at a phone's width on a desktop. */
    try { return pillBox(Math.min(window.innerWidth, 460), window.innerHeight); } catch { return { right: 16, top: 56 }; }
  });

  /* One exit, called by the end of the film, the skip pill, an error and the watchdog alike, so
     there is exactly one way out and it cannot be half-taken. */
  const finish = useCallback(() => {
    setLeaving(prev => {
      if (!prev) window.setTimeout(() => setDone(true), FADE_MS);
      return true;
    });
    try { vid.current?.pause(); } catch { /* it may already be gone */ }
  }, []);

  /* ── THE SCREEN THAT IS WAITING UNDERNEATH ────────────────────────────────────────────────
     Signed out, the film hands over to the real Create-your-One-ID screen, which is `/join` —
     the same screen the splash's own button opens, not a copy of it written for the film.
     Signed in, it hands over to whatever the root already renders for them: somebody who has an
     account does not want to be asked to make one, and on the sandbox that root IS the feed. */
  useEffect(() => {
    if (!armed) return;
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!live || data.session?.user) return;
      navigate("/join", { replace: true });
    }).catch(() => { /* leave the root screen underneath; it is a real screen either way */ });
    return () => { live = false; };
  }, [armed, navigate]);

  /* Remembered the moment it starts, not when it ends. Somebody who closes the tab eight seconds
     in has seen the film; showing it again on their next launch would read as a bug. */
  useEffect(() => { if (armed && !replayAlways) markOpenerSeen(); }, [armed, replayAlways]);

  /* Nothing behind the film may scroll while it is over the whole screen. */
  useEffect(() => {
    if (!armed || done) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [armed, done]);

  useEffect(() => {
    if (!armed || done) return;
    const onResize = () => setBox(pillBox(Math.min(window.innerWidth, 460), window.innerHeight));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [armed, done]);

  /* ── PLAY IT, WITH SOUND IF THE BROWSER ALLOWS SOUND ──────────────────────────────────────
     Design's rule: try it with sound; if the browser refuses — and on a cold mobile tab it very
     often will, because nobody has tapped anything yet — fall back to muted and let the first
     tap turn the sound on. Never let the refusal stop the picture. */
  useEffect(() => {
    if (!armed || done) return;
    const el = vid.current;
    if (!el) return;
    let stalled = window.setTimeout(finish, STALL_MS);
    const alive = () => { window.clearTimeout(stalled); stalled = 0 as unknown as number; };
    el.addEventListener("timeupdate", alive, { once: true });
    el.muted = false;
    el.play().catch(() => {
      el.muted = true;
      setMuted(true);
      el.play().catch(finish);   // refused even muted: there is no film to show
    });
    return () => { window.clearTimeout(stalled); el.removeEventListener("timeupdate", alive); };
  }, [armed, done, finish]);

  if (!armed || done) return null;

  const skip = W(lang, "Skip", "Saltar");

  return (
    <div
      data-ow="opener"
      aria-label={W(lang, "One World", "One World")}
      aria-hidden={leaving || undefined}
      className="fixed inset-0 z-[120] flex justify-center bg-black"
      /* `pointer-events` goes off the moment it starts leaving, so the last frames of the fade
         cannot eat the first tap on the screen coming up behind it. */
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_MS}ms linear`,
        pointerEvents: leaving ? "none" : undefined,
      }}
    >
      {/* ── THE FILM IS 1080 × 1920, SO IT GETS A 1080 × 1920 HOLE (R19) ──────────────────
          Lee, on a desktop: *"the video is okay, but everything should be showing in the same
          mobile aspect ratio… it's too wide."* Stretched across a wide window, `object-cover`
          was throwing away most of a vertical film to fill a horizontal box. The film now sits
          in a column the width of a large phone, on black, exactly as the feed behind it does —
          and on a phone the cap never applies, so nothing changes there. */}
      <div className="relative h-full w-full" style={{ maxWidth: "min(100vw, 460px)" }}>
      <video
        ref={vid}
        className="absolute inset-0 h-full w-full object-cover"
        src={`${(import.meta as any).env?.BASE_URL ?? "/"}${filmSrc(lang)}`}
        playsInline
        preload="auto"
        autoPlay
        onEnded={finish}
        onError={finish}
        /* The whole picture is the unmute target when sound was refused — a person reaching for
           a small speaker glyph in the middle of a film is a person who has already missed it. */
        onClick={() => {
          const el = vid.current;
          if (!el || !muted) return;
          el.muted = false;
          setMuted(false);
          el.play().catch(() => { /* it is already playing; only the sound was in question */ });
        }}
      />

      {/* SKIP. Positioned where the film's own art expects it, clamped onto the glass on phones
          taller than 9:16, and given a real 44-point target rather than the word alone. It lives
          INSIDE the film's column so that on a desktop it sits on the film, not out on the black
          field beside it. */}
      <button
        type="button"
        data-ow="opener-skip"
        onClick={finish}
        className="absolute z-[1] inline-flex h-[34px] items-center rounded-full border border-white/25 bg-black/35 px-4 text-[13px] font-extrabold text-white backdrop-blur-md"
        style={{
          right: `calc(${box.right}px + env(safe-area-inset-right))`,
          top: `calc(${box.top}px + env(safe-area-inset-top))`,
        }}
      >
        {skip}
      </button>

      {muted && (
        <div aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-[calc(40px+env(safe-area-inset-bottom))] text-center text-[13px] font-bold text-white/80">
          {W(lang, "Tap for sound", "Toca para el sonido")}
        </div>
      )}
      </div>
    </div>
  );
}
