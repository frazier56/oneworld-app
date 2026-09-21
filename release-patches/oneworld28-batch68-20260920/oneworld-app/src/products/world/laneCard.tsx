import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Avatar, FeedMedia, ListingEngagement, ScoreDonut, W,
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
  /** Only where a real save, comment and share already exist for this kind of record. */
  engagement: { source: EngagementSource; savesAs?: "rental_property" | "sale_property" | "event" | "job" | "profile"; allowShare?: boolean } | null;
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
const SEEK_TICK_MS = 60;
const SEEK_RATE = 4;          // 4× — 0.24s of video per 60ms tick
const SIDE_ZONE = 0.2;        // the outer fifth on each edge

function SlideVideo({ url, poster, sound, className, chromeHidden }: {
  url: string; poster?: string | null; sound: boolean; className: string; chromeHidden: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [at, setAt] = useState(0);
  const [dur, setDur] = useState(0);
  const [seeking, setSeeking] = useState<null | "ff" | "rw">(null);
  const press = useRef<{ x: number; y: number; t: number; zone: "ff" | "mid" | "rw" } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const seekTimer = useRef<number | null>(null);
  const dragging = useRef(false);

  /* Autoplay when the slide is the one on screen — the SAME rule and the same muted-first dance
     the shell's own `FeedVideo` uses, because a second answer to "when does a feed video play"
     is how two surfaces start disagreeing. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    const start = () => void el.play().then(() => { el.muted = !sound; setPaused(false); }).catch(() => undefined);

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
  }, [url, sound]);

  const stopSeek = () => {
    if (seekTimer.current) { window.clearInterval(seekTimer.current); seekTimer.current = null; }
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
    setSeeking(null);
  };
  useEffect(() => stopSeek, []);

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
    if (el.paused) { void el.play().then(() => setPaused(false)).catch(() => undefined); }
    else { el.pause(); setPaused(true); }
  };

  /* The scrub bar. Dragging it seeks live, which is the whole point — Lee wants to watch the
     clip move under his thumb, not jump when he lets go. */
  const scrubTo = (clientX: number) => {
    const el = ref.current, bar = box.current;
    if (!el || !bar || !el.duration) return;
    const r = bar.getBoundingClientRect();
    el.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * el.duration;
  };

  const pct = dur ? Math.min(100, (at / dur) * 100) : 0;

  return (
    <div ref={box} className="absolute inset-0"
      onPointerDown={e => {
        if (dragging.current) return;
        const zone = zoneAt(e.clientX);
        press.current = { x: e.clientX, y: e.clientY, t: Date.now(), zone };
        if (zone !== "mid") holdTimer.current = window.setTimeout(() => beginHold(zone), HOLD_MS);
      }}
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
        toggle();
      }}>
      <video ref={ref} src={url} poster={poster ?? undefined} muted playsInline loop
        preload="auto" className={className}
        onTimeUpdate={e => setAt((e.target as HTMLVideoElement).currentTime)}
        onLoadedMetadata={e => setDur((e.target as HTMLVideoElement).duration || 0)}
        onPlay={() => setPaused(false)} onPause={() => setPaused(true)} />

      {/* ── THE PLAY BAR, AT THE VERY TOP ───────────────────────────────────────────────────
          Lee: *"we'll make it probably double as thick as the one on Instagram so you can
          actually see it. A lot of people don't even know that thing is there."* Instagram's is
          about two pixels; this track is five with a six-pixel fill, and it carries a wide
          invisible grab strip above and below so a thumb can find it without aiming. */}
      {/* ⚠️ IT HAD TO COME DOWN OFF THE VERY TOP, AND THAT IS WHY IT DID NOT WORK (R23).
          Lee: *"I should grab the little bar at the very top and be able to drag it. That part
          still doesn't work."* It did not, and not because of the drag code: the feed's HEADER
          sits at `z-20` on the screen root, ABOVE this whole slide, so every touch aimed at the
          top strip landed on the header instead and the bar never saw a pointer at all.

          So it sits just under the header while the header is there, and slides up to the true
          top the moment the chrome hides on a swipe up — on the chrome's own curve, so it moves
          with the bar rather than after it. */}
      <div
        className="absolute inset-x-0 z-[4] cursor-pointer py-3"
        /* `touchAction: none` is what lets a finger DRAG this instead of scrolling the feed
           with it — without it the browser claims the gesture before the handler sees it. */
        style={{ touchAction: "none",
                 top: chromeHidden ? 0 : "calc(env(safe-area-inset-top) + 52px)",
                 transitionProperty: "top", transitionDuration: "320ms",
                 transitionTimingFunction: "cubic-bezier(.7,0,.25,1)" }}
        onPointerDown={e => {
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          scrubTo(e.clientX);
          e.stopPropagation();
        }}
        onPointerMove={e => { if (dragging.current) { scrubTo(e.clientX); e.stopPropagation(); } }}
        onPointerUp={e => { dragging.current = false; e.stopPropagation(); }}
        onPointerCancel={() => { dragging.current = false; }}>
        <div className="relative h-[5px] w-full bg-white/30">
          <div className="h-full bg-white" style={{ width: `${pct}%` }} />
          {/* A thumb, because a bare progress line does not read as something you can grab —
              which is Lee's point that nobody knows Instagram's is there. */}
          <span aria-hidden
            className="absolute top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full
              bg-white shadow-[0_1px_4px_rgba(0,0,0,.6)]"
            style={{ left: `${pct}%` }} />
        </div>
      </div>

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
              chromeHidden={chromeHidden}
              className="absolute inset-0 h-full w-full object-cover" />
          : <FeedMedia media={card.media} poster={card.poster} eager={eager} sound={sound}
              className="absolute inset-0 h-full w-full object-cover" />
        : <DrawnCard hue={lane.hue} />}

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
          className="inline-flex h-[42px] items-center justify-center rounded-[14px] bg-clay px-[18px] text-[14px] font-extrabold text-white">
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
export function SlideEngagement({ card, lang, href, title }: {
  card: LaneCard | undefined; lang: string;
  /** Passed by the rail so share works on a lane with no engagement row of its own. */
  href?: string; title?: string;
}) {
  if (!card) return null;
  if (!card.engagement) return <RailShare lang={lang} href={href ?? card.href} title={title ?? card.title} />;
  return (
    <ListingEngagement vertical onDark lang={lang}
      itemId={card.id} source={card.engagement.source} savesAs={card.engagement.savesAs}
      allowShare={card.engagement.allowShare !== false}
      shareUrl={`${window.location.origin}${card.href}`} shareTitle={card.title} />
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
          setCopied(true); window.setTimeout(() => setCopied(false), 2000);
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
          className="mt-5 inline-flex h-[42px] items-center rounded-[14px] bg-clay px-5 text-[14px] font-extrabold text-white">
          {actionLabel ?? W(lang, `Open the ${lane.en} feed`, `Abrir el feed de ${lane.es}`)}
        </Link>
      </div>
    </div>
  );
}
