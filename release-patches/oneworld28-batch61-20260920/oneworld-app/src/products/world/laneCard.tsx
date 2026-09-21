import { Link } from "react-router-dom";
import {
  Avatar, FeedMedia, ListingEngagement, W, type FeedPreview, type EngagementSource,
} from "@oneworld/shell";
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
  who: { name: string; photo: string | null; score: number | null } | null;
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

/** One full-screen item, in any lane. */
export function Slide({ card, lane, lang, eager, sound, onTap }: {
  card: LaneCard; lane: Lane; lang: string; eager: boolean; sound: boolean; onTap: () => void;
}) {
  return (
    <section className="relative h-full w-full snap-start snap-always bg-black" onPointerUp={onTap}>
      {card.media
        ? <FeedMedia media={card.media} poster={card.poster} eager={eager} sound={sound}
            className="absolute inset-0 h-full w-full object-cover" />
        : <DrawnCard hue={lane.hue} />}

      {/* One scrim, four stops — the same one every OneHome surface puts under text on a photo.
          `via-*` pins its stop at the midpoint, which left the top of the text over clear glass. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%]"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,.94) 0%, rgba(0,0,0,.86) 28%, rgba(0,0,0,.55) 62%, rgba(0,0,0,0) 100%)" }} />

      <div className="absolute bottom-[112px] left-[18px] right-20 z-[3] text-white">
        {card.who && (
          <div className="mb-1.5 flex items-center gap-2">
            <Avatar name={card.who.name} src={card.who.photo} size={34} />
            <span className="text-[15px] font-extrabold">{card.who.name}</span>
            {card.who.score != null && (
              <span className="inline-flex items-center gap-1 text-[12px] font-extrabold text-amber-400">
                <i aria-hidden className="inline-block h-[15px] w-[15px] rounded-full border-2 border-amber-400" />
                {Math.round(card.who.score)}
              </span>
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
