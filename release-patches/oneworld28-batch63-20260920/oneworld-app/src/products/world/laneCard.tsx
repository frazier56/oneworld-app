import { useRef } from "react";
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
  engagement: { source: EngagementSource; savesAs?: "rental_property" | "sale_property"; allowShare?: boolean } | null;
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

/** One full-screen item, in any lane. */
export function Slide({ card, lane, lang, eager, sound, chromeHidden, onTap }: {
  card: LaneCard; lane: Lane; lang: string; eager: boolean; sound: boolean;
  /** True while the header and tab bar are away — the block drops, it does not hide. */
  chromeHidden: boolean;
  /** "Open this one." Fired by a real tap only — never by the tail end of a swipe. */
  onTap: () => void;
}) {
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  return (
    <section className="relative h-full w-full snap-start snap-always bg-black"
      onPointerDown={e => { down.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }}
      onPointerCancel={() => { down.current = null; }}
      onPointerUp={e => {
        const d = down.current;
        down.current = null;
        if (!d) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP) return;   // a swipe
        if (Date.now() - d.t > TAP_MS) return;                                 // a long look
        if ((e.target as HTMLElement | null)?.closest?.(CONTROLS)) return;      // they meant that
        onTap();
      }}>
      {card.media
        ? <FeedMedia media={card.media} poster={card.poster} eager={eager} sound={sound}
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

/** The save, comment and share column — drawn only where those three are real for this record. */
export function SlideEngagement({ card, lang }: { card: LaneCard; lang: string }) {
  if (!card.engagement) return null;
  return (
    <ListingEngagement vertical onDark lang={lang}
      itemId={card.id} source={card.engagement.source} savesAs={card.engagement.savesAs}
      allowShare={card.engagement.allowShare !== false}
      shareUrl={`${window.location.origin}${card.href}`} shareTitle={card.title} />
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
