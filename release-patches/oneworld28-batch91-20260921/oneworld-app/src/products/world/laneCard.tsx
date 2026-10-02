import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Avatar, FeedMedia, ListingEngagement, ScoreDonut, W, supabase, useOneId,
  type BadgeTier, type FeedPreview, type EngagementSource,
} from "@oneworld/shell";

/**
 * ── THE INFORMATION BLOCK AND THE RAIL BELONG TO THE ITEM, NOT TO THE CHROME (R15) ──────────
 * Lee, 20 September 2026, holding it on his phone: *"when the footer is not there it's just an
 * empty space down there… the text should really be lower on the page… and all the side icons on
 * the right side need to drop down too… it should be dynamic."*
 *
 * Save, comment, share, map and sound are about THE THING YOU ARE LOOKING AT. So are the host's
 * name, the title, the price and the button. None of them is chrome. When the header and the tab
 * bar hide on a swipe up, these do not go with them — they DROP into the space the tab bar has
 * just left, and rise again when it returns. Only the header and the tab bar hide.
 *
 * The numbers are the design thread's, measured in the v5 prototype at 390 wide: the information
 * block sits 112 pixels up with the chrome and 40 without, the rail 120 and 48 — the same 72
 * pixel move for both, so the text and the rail can never drift apart. The safe-area inset is
 * kept UNDER both in either state, so nothing lands under the home indicator.
 *
 * One animated move on the chrome's own curve and duration, never a jump.
 */
export const DROP = "translateY(72px)";
/** The chrome's own curve and duration — the block must move WITH the bar, not after it. */
export const DROP_EASE = { transitionProperty: "transform", transitionDuration: "320ms", transitionTimingFunction: "cubic-bezier(.7,0,.25,1)" } as const;
import type { Lane } from "./lanes";

/**
 * ONE CARD SHAPE, FOUR LANES.
 * ============================================================================================
 * A home, an event, a job, a person for hire and a post are five different records, and the
 * world feed shows all of them as the SAME screen: media behind, who posted it, what it is, what
 * it costs, one button. So they are normalised to one shape here and drawn once, below.
 *
 * Four copies of this slide is how the four lanes would quietly drift apart — a price that sits
 * two pixels higher on Events, a button that is a different height on Jobs. One component, and a
 * change to the layout is a change to all four by construction.
 */
export type LaneCard = {
  id: string;
  /** What plays or shows behind. Null draws the lane's card instead of a broken image. */
  media: FeedPreview | null;
  /** The still under a video — never a video frame, always a photograph. */
  poster: string | null;
  /**
   * WHO POSTED IT, AND WHAT THEIR ONESCORE ACTUALLY IS (R16 note 5).
   *
   * `tier` is the BADGE TIER — member, verified, trusted, authority — and it is what decides the
   * COLOUR of the donut beside the name. The score decides the arc's length and depth. They are
   * two different facts and the donut has a long comment explaining why conflating them is the
   * single most-corrected mistake in this project; this type carries both so the feed cannot
   * repeat it. Null tier just means the RPC has not answered yet and the ring draws slate.
   */
  who: { name: string; photo: string | null; score: number | null; tier?: BadgeTier | null } | null;
  title: string;
  /** The money line, IN the information block. Never on the video. */
  price: string | null;
  /** One sentence under the price: where, when, how many left. */
  sub: string | null;
  /** A LABEL, not a sentence: "Get ticket", not "Get your ticket now". */
  cta: string;
  /** The existing screen this opens. Never a new screen written for the feed. */
  href: string;
  /** How many files one upload carried. Above 1 the slide shows the multi-photo mark (R24). */
  group?: number;
  /** Only where a real save, comment and share already exist for this kind of record. */
  engagement: { source: EngagementSource; savesAs?: "rental_property" | "sale_property" | "event" | "job" | "profile" | "media_post"; allowShare?: boolean } | null;
};

/* ── THE DRAWN CARD ──────────────────────────────────────────────────────────────────────────
   Lee: an item with no media must never be a blank green screen. It is DRAWN from the lane's own
   colour, with texture and a soft mark, so it reads as a listing without a photograph rather
   than a picture that failed to load. Jobs live on this today — the job form has no media step
   yet; that is the next batch.

   ⚠️ IT CARRIES NO TITLE, AND THAT IS THE FIX FOR A DEFECT THE HARNESS CAUGHT. The first draft
   printed the title large in the middle of the card, and the information block below prints the
   title too — so every job read "Replace a water heater, Belhaven" twice on one screen, once in
   26 pixel type and once in 19. The title belongs in the information block, where it is on every
   other card in every lane. The card behind it is a BACKGROUND. */
export function DrawnCard({ hue }: { hue: string }) {
  return (
    <div className="absolute inset-0" aria-hidden
      style={{ background: `linear-gradient(160deg, ${hue}, #0B0F1A)` }}>
      <div className="absolute inset-0 opacity-25"
        style={{ backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,.06) 0 2px, transparent 2px 9px)" }} />
      {/* One soft ring, off-centre and well above the information block, so the screen has a
          focal point without competing with a word. */}
      <div className="absolute left-1/2 top-[30%] h-40 w-40 -translate-x-1/2 rounded-full border-[10px] border-white/10" />
    </div>
  );
}

/* ── WHAT COUNTS AS A TAP (R16 note 2) ──────────────────────────────────────────────────────
   Lee: *"tapping anywhere on a slide should open that listing, same as the button."*

   Which makes the whole screen a link — and the whole screen is also the surface the two
   scrollers read gestures from, so "anywhere" has to mean "anywhere, without ever firing on a
   swipe". These are the same two numbers `FeedSlideStrip` already uses for exactly this
   distinction, copied deliberately: a tap that opens a home in the strip and a tap that opens a
   home in the feed should not need different thumbs.

   Twelve pixels because a thumb never lands perfectly still, and half a second because a slow
   press-and-hold on a photograph is somebody looking at it, not somebody asking to leave. */
const TAP_SLOP = 12;
const TAP_MS = 500;
/* Anything the person could have meant to press instead. The CTA is a real link inside this
   block and must open on its own terms; `closest` walks up from whatever the finger actually
   landed on, which is usually a span inside the control rather than the control. */
const CONTROLS = "a,button,[role='button'],[role='radio'],input,select,textarea,label";


/* ══════════════════════════════════════════════════════════════════════════════════════════
   THE REEL PLAYER — R20.
   ══════════════════════════════════════════════════════════════════════════════════════════
   Lee, on the published feed: *"when the video is playing, if you tap it once it should pause
   the video… one tap should be a pause and then another tap should be play. Except if you want
   to see the listing, you click View listing. And we should have a little bar at the top —
   like a play bar — so if you want to rewind or fast forward you can grab it and slide. Touch
   and hold on the far left fast-forwards; touch and hold on the right rewinds. Touch in the
   middle eighty percent, it pauses."*

   ⚠️ THIS SUPERSEDES R16 NOTE 2, AND LEE SUPERSEDED IT HIMSELF. Tap-anywhere-opens-the-listing
   shipped in overlay 5 and was right until the feed had a video player in it, at which point
   the single most common gesture on a full-screen video — tap to pause — was navigating people
   out of the app. His own words: *"we really need to adjust our requirement."* So the whole
   surface belongs to the player now, and the ONE way into a listing is the View listing button,
   which is the thing that button is for.

   ── THE THREE ZONES ──────────────────────────────────────────────────────────────────────
   Left 20% · middle 60% · right 20%, measured on the slide rather than assumed, so the split
   is the same on a 390 phone and a 430 one.

   A SHORT PRESS anywhere is pause/play, including on the two side zones. That is deliberate:
   the sides are a HOLD gesture, and a person who taps one has almost certainly done what every
   other person does on a full-screen video — tapped to pause. Punishing a mis-aimed thumb with
   "nothing happened" is worse than being generous with it.

   A LONG PRESS on a side seeks, and it starts at 260 ms — long enough that a tap is never
   mistaken for a hold, short enough that a hold never feels stuck. Four times speed, which is
   fast enough to cross a two-minute clip in half a minute and slow enough to still see it.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

const HOLD_MS = 260;
/** Two taps inside this window on the same side is a jump, not two pauses. */
const DOUBLE_MS = 300;
/** What a double tap moves. The number every player uses, so nobody has to learn ours. */
const JUMP_S = 10;
const SEEK_TICK_MS = 60;
const SEEK_RATE = 4;          // 4× — 0.24s of video per 60ms tick
const SIDE_ZONE = 0.2;        // the outer fifth on each edge

/* `chromeHidden` used to be a prop here and nothing in the body ever read it — the video does
   not move when the bars hide; the card's own wrapper does, further down this file. It was
   threaded from `WorldFeed` through `Slide` to this signature and dropped, which is the kind of
   dead wire that makes the next person look for a behaviour that was never here. Removed
   22 Sep 2026; `Slide` still takes it, because `Slide` genuinely uses it. */
function SlideVideo({ url, poster, sound, className }: {
  url: string; poster?: string | null; sound: boolean; className: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [seeking, setSeeking] = useState<null | "ff" | "rw">(null);
  const press = useRef<{ x: number; y: number; t: number; zone: "ff" | "mid" | "rw" } | null>(null);
  /* The last tap, so a second one on the same side can be read as a double. */
  const lastTap = useRef<{ t: number; zone: "ff" | "mid" | "rw" } | null>(null);
  const pending = useRef<number | null>(null);
  const [jumped, setJumped] = useState<null | "ff" | "rw">(null);
  const holdTimer = useRef<number | null>(null);
  const seekTimer = useRef<number | null>(null);
  /* The 600 ms that the ⏩ / ⏪ badge stays on screen. It is a ref and not a bare `setTimeout`
     because a slide unmounts the moment you swipe past it: a loose timer then fires into a dead
     component, and React logs the update-on-unmounted warning for something nobody can see.
     Held here so the unmount cleanup below can cancel it, and so a rapid second double-tap
     restarts the badge rather than having the first tap's timer clear it early. — 22 Sep 2026 */
  const jumpTimer = useRef<number | null>(null);

  /* Autoplay when the slide is the one on screen — the SAME rule and the same muted-first dance
     the shell's own `FeedVideo` uses, because a second answer to "when does a feed video play"
     is how two surfaces start disagreeing. */
  /* ⚠️ A DELIBERATE PAUSE OUTRANKS EVERY AUTOMATIC PLAY. — 22 Sep 2026
     A ref, not state, because `start()` below is called from an IntersectionObserver callback
     and from a `canplay` listener — both of which close over whatever `paused` was when the
     effect last ran, which is exactly the stale value that made this wrong. */
  const pausedByUser = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    /* ⚠️ THIS USED TO RESTART A CLIP THE READER HAD JUST PAUSED. Two ways in, both real:
       tapping the sound button changed `sound`, which is a dependency, so the effect tore down
       (pausing) and re-ran — and `start()` played unconditionally; and the observer calls
       `start()` again every time the slide re-crosses the 25% line, so a small scroll nudge
       resumed a paused video too. Pausing a clip and having it start itself again is the app
       arguing with the person holding the phone. */
    const start = () => {
      if (pausedByUser.current) return;
      void el.play().then(() => { el.muted = !sound; setPaused(false); }).catch(() => undefined);
    };

    /* ── WHY THIS IS NOT JUST AN INTERSECTION OBSERVER (R19) ────────────────────────────────
       Lee, on a desktop: *"I don't even see the video playing. It only shows the still images.
       So the desktop is missing the videos."*

       Two things can produce exactly that, and both are fixed here rather than guessed between:

       · A THRESHOLD THAT IS NEVER MET. The old rule was "half of the element visible". A slide
         is the full height of the column, and on a tall desktop window the element can be taller
         than the viewport — at which point HALF of it is never on screen at once and the
         observer never fires, so the poster sits there forever. A quarter is met by anything
         that is genuinely the slide in front of you.
       · AN OBSERVER THAT NEVER FIRES AT ALL, because the element was already in view when it
         mounted and nothing has scrolled since. So the first frame is asked to play directly,
         and `canplay` asks once more for the case where the file had not arrived yet.

       `preload` also moves from `metadata` to `auto` on this surface only: in a feed you are
       about to watch this, and a poster that never becomes a video is the failure being fixed. */
    start();
    el.addEventListener("canplay", start, { once: true });

    if (typeof IntersectionObserver === "undefined") return () => { el.removeEventListener("canplay", start); el.pause(); };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) start();
      else { el.pause(); el.muted = true; }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => { io.disconnect(); el.removeEventListener("canplay", start); el.pause(); };
    /* `sound` is still a dependency and that is deliberate — `start()` reads it when the clip
       begins. What changed is that re-running no longer overrides a deliberate pause. The mute
       flag is also applied on its own below, so the sound button works on a paused clip. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, sound]);

  /* Mute follows the sound button whether or not anything is playing. Without this, toggling
     sound on a paused clip did nothing until it started again. */
  useEffect(() => {
    const el = ref.current;
    if (el && !el.paused) el.muted = !sound;
  }, [sound]);

  const stopSeek = () => {
    if (seekTimer.current) { window.clearInterval(seekTimer.current); seekTimer.current = null; }
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
    setSeeking(null);
  };
  useEffect(() => () => {
    stopSeek();
    if (pending.current) window.clearTimeout(pending.current);
    if (jumpTimer.current) window.clearTimeout(jumpTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ⚠️ LEFT IS REWIND, RIGHT IS FAST FORWARD (R23). They were the other way round, which is
     backwards from every video player anyone has used — left is back. Lee: *"on the video, the
     left side really should be rewind… and the right side, touch and hold it and it fast
     forwards."* */
  const zoneAt = (clientX: number): "ff" | "mid" | "rw" => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width) return "mid";
    const f = (clientX - r.left) / r.width;
    return f < SIDE_ZONE ? "rw" : f > 1 - SIDE_ZONE ? "ff" : "mid";
  };

  const beginHold = (zone: "ff" | "rw") => {
    const el = ref.current;
    if (!el) return;
    setSeeking(zone);
    seekTimer.current = window.setInterval(() => {
      const step = (SEEK_TICK_MS / 1000) * SEEK_RATE;
      const next = zone === "ff" ? el.currentTime + step : el.currentTime - step;
      el.currentTime = Math.max(0, Math.min(el.duration || 0, next));
    }, SEEK_TICK_MS);
  };

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      pausedByUser.current = false;
      void el.play().then(() => { el.muted = !sound; setPaused(false); }).catch(() => undefined);
    } else {
      /* Recorded BEFORE the pause, so neither the observer nor a `sound` change can undo it. */
      pausedByUser.current = true;
      el.pause(); setPaused(true);
    }
  };

  /* ── THE PLAYER HAD NO KEYBOARD AT ALL, AND THAT IS A REGRESSION. — 22 Sep 2026 ────────
     Everything this component does — pause, resume, seek, jump ten seconds — existed only as
     pointer events on a bare `<div>`, on a `<video>` with no `controls`, under overlays that
     are all `aria-hidden`. So a keyboard or switch user could not stop a full-screen
     autoplaying video, and nothing announced its state. Before R20 a tap opened the listing and
     the player was not the owner of the gesture, so this is something the reel player took
     away. Space and Enter pause; the arrows seek; the label says which it is.

     `role="button"` rather than a real `<button>`: this element is the full-bleed video surface
     and a button would inherit form semantics and default styling this cannot carry. The three
     things that matter — it is focusable, it announces, it responds to keys — are all here. */
  const seekBy = (step: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + step));
    setJumped(step > 0 ? "ff" : "rw");
    if (jumpTimer.current) window.clearTimeout(jumpTimer.current);
    jumpTimer.current = window.setTimeout(() => { jumpTimer.current = null; setJumped(null); }, 600);
  };

  return (
    <div ref={box} className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      role="button" tabIndex={0}
      aria-label={paused ? "Video, paused. Space to play, arrow keys to seek."
                         : "Video, playing. Space to pause, arrow keys to seek."}
      onKeyDown={e => {
        if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") { e.preventDefault(); toggle(); return; }
        if (e.key === "ArrowRight") { e.preventDefault(); seekBy(JUMP_S); return; }
        if (e.key === "ArrowLeft")  { e.preventDefault(); seekBy(-JUMP_S); }
      }}
      onPointerDown={e => {
        const zone = zoneAt(e.clientX);
        press.current = { x: e.clientX, y: e.clientY, t: Date.now(), zone };
        /* ⚠️ CAPTURE, OR A MOUSE CAN LEAVE THE SEEK RUNNING FOREVER. A touch pointer gets
           implicit capture; a mouse does not. Press and hold on the left edge, drag off the
           element — onto the rail, or out of the window — and release: no `pointerup` ever
           reaches this div, the seek interval keeps rewinding to zero, and the 4× badge stays
           on screen until the slide unmounts. Desktop only, which is why it survived testing on
           a phone. */
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not supported */ }
        if (zone !== "mid") holdTimer.current = window.setTimeout(() => beginHold(zone), HOLD_MS);
      }}
      onLostPointerCapture={() => { press.current = null; stopSeek(); }}
      onPointerMove={e => {
        const d = press.current;
        /* A vertical drag is the FEED's gesture, not the player's — let go of it immediately so
           a swipe to the next slide is never turned into a seek. */
        if (d && Math.abs(e.clientY - d.y) > 12) { press.current = null; stopSeek(); }
      }}
      onPointerCancel={() => { press.current = null; stopSeek(); }}
      onPointerUp={e => {
        const d = press.current;
        press.current = null;
        const wasSeeking = seeking !== null;
        stopSeek();
        if (!d || wasSeeking) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;   // a swipe
        if (Date.now() - d.t > 500) return;                              // a long look

        /* ── ONE TAP OR TWO (R26) ─────────────────────────────────────────────────────────
           A single tap anywhere pauses. TWO taps on a SIDE jump ten seconds, the way every
           player does it. The pause therefore has to wait 300 ms to find out which it was —
           and that wait is why the second tap cancels the first rather than pausing and then
           jumping, which would leave the video stopped ten seconds along. */
        const now = Date.now();
        const prev = lastTap.current;
        const isDouble = !!prev && d.zone !== "mid" && prev.zone === d.zone && now - prev.t < DOUBLE_MS;
        lastTap.current = { t: now, zone: d.zone };

        if (isDouble && d.zone !== "mid") {
          if (pending.current) { window.clearTimeout(pending.current); pending.current = null; }
          lastTap.current = null;
          const el = ref.current;
          if (el) {
            const step = d.zone === "ff" ? JUMP_S : -JUMP_S;
            el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + step));
          }
          setJumped(d.zone as "ff" | "rw");
          if (jumpTimer.current) window.clearTimeout(jumpTimer.current);
          jumpTimer.current = window.setTimeout(() => { jumpTimer.current = null; setJumped(null); }, 600);
          return;
        }

        if (pending.current) window.clearTimeout(pending.current);
        pending.current = window.setTimeout(() => { pending.current = null; toggle(); }, DOUBLE_MS);
      }}>
      <video ref={ref} src={url} poster={poster ?? undefined} muted playsInline loop
        preload="auto" className={className}
        onPlay={() => setPaused(false)} onPause={() => setPaused(true)} />

      {/* ── THE PLAY BAR, AT THE VERY TOP ───────────────────────────────────────────────────
          Lee: *"we'll make it probably double as thick as the one on Instagram so you can
          actually see it. A lot of people don't even know that thing is there."* Instagram's is
          about two pixels; this track is five with a six-pixel fill, and it carries a wide
          invisible grab strip above and below so a thumb can find it without aiming. */}
      {/* ── THE PLAY BAR IS GONE (R26) ─────────────────────────────────────────────────
          Lee: *"I like the function, I just don't like the look. You already don't have a lot
          of vertical space and it's there. Let's just remove it — if we double tap to rewind,
          tap and hold to rewind on the left and fast forward on the right, and pause in the
          middle, that should be good enough."*

          He is right that it was paying for itself in the wrong currency. A scrub track has to
          sit at the top of the frame, which is the one strip of a vertical video where the
          subject's head usually is, and it had already been pushed below the header to be
          touchable at all. Four gestures on the picture itself do the same job and cost no
          pixels. */}

      {/* PAUSED SAYS SO. A still frame with no glyph on it is indistinguishable from a video
          that failed to load, which is the single most common "is this broken?" in a feed. */}
      {paused && !seeking && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[3] grid place-items-center">
          <span className="grid h-[68px] w-[68px] place-items-center rounded-full bg-black/45 backdrop-blur-md">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" aria-hidden>
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          </span>
        </div>
      )}

      {/* A double tap has to say so, or it reads as the video glitching. */}
      {jumped && (
        <div aria-hidden className={`pointer-events-none absolute top-1/2 z-[3] -translate-y-1/2 ${
          jumped === "rw" ? "left-8" : "right-8"}`}>
          <span className="flex flex-col items-center gap-0.5 rounded-2xl bg-black/55 px-3 py-2 text-white backdrop-blur-md">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden
              style={{ transform: jumped === "rw" ? "scaleX(-1)" : undefined }}>
              <path d="M4 5.5v13l9-6.5zM13 5.5v13l9-6.5z" />
            </svg>
            <b className="text-[11px] font-extrabold">{JUMP_S}s</b>
          </span>
        </div>
      )}

      {/* While seeking, say which way and how fast — otherwise a held thumb looks like a freeze. */}
      {seeking && (
        <div aria-hidden className={`pointer-events-none absolute top-1/2 z-[3] -translate-y-1/2 ${
          seeking === "rw" ? "left-6" : "right-6"}`}>
          <span className="flex items-center gap-1 rounded-full bg-black/55 px-3 py-2 text-[13px] font-extrabold text-white backdrop-blur-md">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden
              style={{ transform: seeking === "rw" ? "scaleX(-1)" : undefined }}>
              <path d="M4 5.5v13l9-6.5zM13 5.5v13l9-6.5z" />
            </svg>
            {SEEK_RATE}×
          </span>
        </div>
      )}
    </div>
  );
}

/** One full-screen item, in any lane. */
export function Slide({ card, lane, lang, eager, sound, chromeHidden, onTap }: {
  card: LaneCard; lane: Lane; lang: string; eager: boolean; sound: boolean;
  /** True while the header and tab bar are away — the block drops, it does not hide. */
  chromeHidden: boolean;
  /** "Open this one." Fired by a real tap only — never by the tail end of a swipe. */
  onTap: () => void;
}) {
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const isVideo = card.media?.kind === "video";
  return (
    <section className="relative h-full w-full snap-start snap-always bg-black"
      onPointerDown={e => { down.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }}
      onPointerCancel={() => { down.current = null; }}
      onPointerUp={e => {
        const d = down.current;
        down.current = null;
        /* ⚠️ ON A VIDEO THE PLAYER OWNS THE TAP (R20). Pause is the gesture people already know
           on a full-screen clip, and it cannot share a surface with "leave the app". A photo
           slide has nothing to pause, so a tap there still just brings the chrome back. */
        if (isVideo || !d) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP) return;   // a swipe
        if (Date.now() - d.t > TAP_MS) return;                                 // a long look
        if ((e.target as HTMLElement | null)?.closest?.(CONTROLS)) return;      // they meant that
        onTap();
      }}>
      {/* R20 — a video slide gets the reel player (pause, seek, scrub); a photo slide stays on
          the shell's `FeedMedia`, which is the same component every other surface uses. */}
      {card.media
        ? card.media.kind === "video"
          ? <SlideVideo url={card.media.url} poster={card.poster} sound={sound}
              className="absolute inset-0 h-full w-full object-cover" />
          : <FeedMedia media={card.media} poster={card.poster} eager={eager} sound={sound}
              className="absolute inset-0 h-full w-full object-cover" />
        : <DrawnCard hue={lane.hue} />}

      {/* ── THE MULTI-PHOTO MARK (R24) ─────────────────────────────────────────────────────
          Instagram's stacked-squares glyph, top right. It is NOT a control — Lee was explicit
          that you do not tap it — it is a label saying "there are more of these, they are on
          the profile". Placed opposite the rail so it never collides with a thumb, and it drops
          with the chrome like everything else that belongs to the item. */}
      {(card.group ?? 1) > 1 && (
        <div data-ow="multi" aria-hidden
          className="absolute right-4 top-[calc(env(safe-area-inset-top)+62px)] z-[3] flex items-center gap-1
            rounded-full bg-black/45 px-2 py-1 text-[11px] font-extrabold text-white backdrop-blur-md">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinejoin="round">
            <rect x="8" y="3" width="13" height="13" rx="2.5" />
            <path d="M16 20.5H5.5A2.5 2.5 0 0 1 3 18V7.5" />
          </svg>
          {card.group}
        </div>
      )}

      {/* One scrim, four stops — the same one every OneHome surface puts under text on a photo.
          `via-*` pins its stop at the midpoint, which left the top of the text over clear glass. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%]"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,.94) 0%, rgba(0,0,0,.86) 28%, rgba(0,0,0,.55) 62%, rgba(0,0,0,0) 100%)" }} />

      {/* `data-ow` so the harness can measure THIS block rather than guess at a selector —
          the first measuring pass picked a different element and reported nonsense. */}
      <div data-ow="info-block"
        className="absolute bottom-[calc(112px+env(safe-area-inset-bottom))] left-[18px] right-20 z-[3] text-white"
        style={{ ...DROP_EASE, transform: chromeHidden ? DROP : undefined }}>
        {card.who && (
          <div className="mb-1.5 flex items-center gap-2">
            <Avatar name={card.who.name} src={card.who.photo} size={34} />
            <span className="text-[15px] font-extrabold">{card.who.name}</span>
            {/* ── THE REAL ONESCORE, NOT A DRAWING OF IT (R16 note 5) ──────────────────────
                Lee: *"the score beside a name has to be the real OneScore component — the
                gradient donut, the colour following the band, one decimal place. Find how
                OneScore and OneSocial draw it and reuse that exact component. Do not rebuild
                it."*

                It was a flat amber circle with a rounded whole number next to it, which got two
                separate things wrong at once: amber is the AUTHORITY tier's colour, so every
                member in the feed was wearing the top badge; and a rounded integer is not the
                number OneScore publishes. `ScoreDonut` is shell code precisely so that this
                cannot happen — one implementation, one chance to get it wrong instead of nine.

                34 pixels to match the avatar beside it, and `text-white` so the number inside
                reads over the video; the donut takes its own colours from the tier. */}
            {card.who.score != null && (
              <span className="text-white"><ScoreDonut score={card.who.score} size={34}
                tier={card.who.tier ?? undefined} /></span>
            )}
          </div>
        )}
        {/* ⚠️ BOTH OF THESE ARE CLAMPED, AND THE REASON IS THE BUTTON. This block is anchored to
            the bottom of the screen; a four-line title with a three-line detail under it pushes
            the one button that matters up into the middle of the photograph. Two lines of title
            and two of detail is the most a swipe card can carry and still read at a glance. */}
        <p className="mb-1 line-clamp-2 text-[19px] font-extrabold leading-tight tracking-tight">{card.title}</p>
        {card.price && <p className="mb-0.5 text-[15px] font-extrabold">{card.price}</p>}
        {card.sub && <p className="mb-3 line-clamp-2 text-[13px] text-white/85">{card.sub}</p>}
        <Link to={card.href}
          className="ow-tap inline-flex h-[42px] items-center justify-center rounded-[14px] bg-clay px-[18px] text-[14px] font-extrabold text-white">
          {card.cta}
        </Link>
      </div>
    </section>
  );
}

/**
 * THE RAIL'S ITEM CONTROLS (R17 note 4).
 *
 * Where the record has somewhere to write — a home, a post — this is the shell's own
 * `ListingEngagement`, stacked: the same hearts, the same `saved_items` and `media_likes` rows,
 * the same share sheet as every other One World surface. Not a second implementation.
 *
 * Where it does not — an event, a job — the save and the comment are simply absent, because a
 * heart that writes nowhere is a control that half works. SHARE still appears, on its own,
 * because sharing needs nothing but a URL and every card in every lane has one. That is the
 * difference between an icon that is missing for a reason and an icon that is missing by
 * accident, and it is the whole of the rule.
 */
export function SlideEngagement({ card, lang, href, title, onComments, commentCount }: {
  card: LaneCard | undefined; lang: string;
  /** Passed by the rail so share works on a lane with no engagement row of its own. */
  href?: string; title?: string;
  /** R24 — the feed opens comments in a SHEET, so the rail never changes height. */
  onComments?: () => void;
  /** R26 — how many comments this item has, counted by the feed for the card on screen. */
  commentCount?: number;
}) {
  if (!card) return null;
  if (!card.engagement) return <RailShare lang={lang} href={href ?? card.href} title={title ?? card.title} />;
  return (
    <ListingEngagement vertical onDark lang={lang}
      itemId={card.id} source={card.engagement.source}
      /* ⚠️ NO `savesAs` HERE, DELIBERATELY. — 22 Sep 2026
         On a listing card the heart doubles as a save, because there is only one control. On
         this rail there are TWO — the heart and `RailSave` below — and both were writing the
         same `saved_items` row. So unliking something DELETED a bookmark the member had made
         on purpose with the other control, and the bookmark went on drawing "not saved" for
         something the heart had just saved. On the feed the rail's Save owns that row alone;
         the heart is a like and nothing else. The classic cards keep passing `savesAs` and are
         unaffected. */
      allowShare={card.engagement.allowShare !== false}
      /* ⚠️ THIS PROP IS THE WHOLE FIX FOR THE JUMPING RAIL. Without it `ListingEngagement`
         expands its comment list inline, directly under the three controls — right on a
         listing card, wrong in a fixed column pinned to the edge of a full-screen video, where
         it pushed save, comment and share up the screen on every tap. */
      onComments={onComments}
      /* Lee: *"I like how you have a count of the hearts. You can also have a count of comments
         as well."* `ListingEngagement` already draws one when it is given one — the feed counts
         them because the feed is the only surface that knows which card is on screen. */
      commentCount={commentCount}
      shareUrl={`${window.location.origin}${card.href}`} shareTitle={card.title} />
  );
}

/**
 * SAVE — a bookmark of its own (R24).
 *
 * Lee, with Instagram's rail beside ours: *"we need to add save. I think save is an option, so
 * we need to make sure the save function works."*
 *
 * On a listing card the heart doubles as a save, because there is only one control. On a reel
 * rail, like and save are two different intentions and Instagram gives them two different
 * controls — so this is the save, and it OWNS the `saved_items` row on this screen. The rail's
 * `ListingEngagement` is deliberately given no `savesAs`, because both controls writing the same
 * row meant an unlike silently deleted a bookmark the member had made on purpose.
 *
 * It is the same row the Saved screen lists, so a save made here shows up there.
 */
export function RailSave({ card, lang }: { card: LaneCard | undefined; lang: string }) {
  const { userId } = useOneId();
  const kind = card?.engagement?.savesAs ?? null;
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  /* The card id a save/unsave request was issued for — see `toggle` below. */
  const inFlightFor = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!userId || !kind || !card) { setOn(false); return; }
    supabase.from("saved_items").select("id")
      .eq("user_id", userId).eq("item_type", kind).eq("item_id", card.id).maybeSingle()
      .then(({ data }) => { if (live) setOn(!!data); });
    return () => { live = false; };
  }, [userId, kind, card?.id]);

  /* A new card means any request still in flight belongs to the last one, and the button has to
     be live again immediately — not when that request happens to come back. */
  useEffect(() => { inFlightFor.current = null; setBusy(false); }, [card?.id]);

  if (!card || !kind) return null;

  /* ⚠️ THIS COMPONENT OUTLIVES THE CARD IT IS ACTING ON. — 22 Sep 2026
     `WorldFeed` mounts exactly one `RailSave` and hands it `card={current}`, with no `key` — so
     the same instance carries on as the reader swipes. The read effect above already guards on
     that with `live`; this did not. Tap Save on card A, swipe to B before the request returns:
     the effect repaints B's true state, then A's error fires `setOn(!next)` and B is drawing
     A's bookmark. `busy` had the same shape — it stayed true across the swipe, so the Save
     button was simply dead on card B until A's request settled.

     Both are the same fix: remember which card the request belongs to, and drop the answer if
     the reader has moved on. */
  const toggle = async () => {
    if (!userId || busy) return;
    const forId = card.id;
    inFlightFor.current = forId;
    setBusy(true);
    const next = !on;
    setOn(next);                       // optimistic: a bookmark that lags reads as broken
    const q = next
      ? supabase.from("saved_items").upsert(
          { user_id: userId, item_type: kind, item_id: forId },
          { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true })
      : supabase.from("saved_items").delete()
          .eq("user_id", userId).eq("item_type", kind).eq("item_id", forId);
    const { error } = await q;
    if (inFlightFor.current !== forId) return;   // the reader swiped; this answer is not theirs
    inFlightFor.current = null;
    if (error) setOn(!next);           // put it back rather than lie about it
    setBusy(false);
  };

  return (
    <button type="button" onClick={() => void toggle()} aria-pressed={on}
      className="ow-tap grid h-[48px] w-[48px] place-items-center text-white"
      aria-label={on ? W(lang, "Saved", "Guardado") : W(lang, "Save", "Guardar")}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill={on ? "#fff" : "none"} stroke="currentColor"
        strokeWidth="2" strokeLinejoin="round" aria-hidden>
        <path d="M6 3.8h12a1 1 0 0 1 1 1v15.4l-7-4.2-7 4.2V4.8a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}

/**
 * SHARE, WITHOUT AN ENGAGEMENT ROW.
 *
 * The share sheet first, the clipboard when there is no sheet, and a prompt when the clipboard
 * is refused — the same three-step fallback `ListingEngagement` uses, because a share that
 * silently does nothing on a desktop browser is worse than no share button.
 *
 * It records NO analytics, and that is deliberate: `media_shares` is keyed by a media source
 * this record does not have, so the only honest options were to write a wrong row or to write
 * none. The share itself is real either way, which is what the member cares about.
 */
function RailShare({ lang, href, title }: { lang: string; href: string; title: string }) {
  const [copied, setCopied] = useState(false);
  /* The last timer this component left behind. The rail unmounts the moment the comment sheet
     or the map opens, or the Homes layout changes — so copying a link and immediately opening
     the map used to leave a timeout firing into a component that no longer exists. Same defect
     the seek badge above had and `flash` solved in `ListingEngagement`; this one was missed in
     that sweep. — 22 Sep 2026 */
  const copyTimer = useRef<number | null>(null);
  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current); }, []);
  const url = typeof window === "undefined" ? href : `${window.location.origin}${href}`;
  return (
    <button type="button"
      className="ow-tap relative grid h-[38px] w-[38px] place-items-center rounded-full border border-white/30
        bg-black/40 text-white backdrop-blur-md"
      aria-label={W(lang, "Share", "Compartir")}
      onClick={async () => {
        try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch { /* dismissed */ }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          if (copyTimer.current) window.clearTimeout(copyTimer.current);
          copyTimer.current = window.setTimeout(() => { copyTimer.current = null; setCopied(false); }, 2000);
        } catch { window.prompt(W(lang, "Copy this link", "Copie este enlace"), url); }
      }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M12 16V3M8 7l4-4 4 4" />
      </svg>
      {copied && (
        <span className="pointer-events-none absolute right-[46px] top-1/2 -translate-y-1/2 whitespace-nowrap
          rounded-full bg-black/75 px-2 py-1 text-[11px] font-bold">
          {W(lang, "Link copied", "Enlace copiado")}
        </span>
      )}
    </button>
  );
}

/** An honest full-screen card for a lane with nothing in it yet. */
export function LaneNote({ lane, lang, title, body, actionHref, actionLabel }: {
  lane: Lane; lang: string; title: string; body: string; actionHref?: string; actionLabel?: string;
}) {
  return (
    <div className="relative grid h-full w-full place-items-center px-8 text-center">
      <DrawnCard hue={lane.hue} />
      <div className="relative z-[1]">
        <p className="text-[19px] font-extrabold leading-tight text-white">{title}</p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-white/70">{body}</p>
        <Link to={actionHref ?? lane.classicPath}
          className="ow-tap mt-5 inline-flex h-[42px] items-center rounded-[14px] bg-clay px-5 text-[14px] font-extrabold text-white">
          {actionLabel ?? W(lang, `Open the ${lane.en} feed`, `Abrir el feed de ${lane.es}`)}
        </Link>
      </div>
    </div>
  );
}
