import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import ScoreDonut from "./ScoreDonut";
import { W } from "../lib/i18n";

/**
 * THE AGENT ROW AT THE FOOT OF EVERY LISTING CARD — one implementation, both halves of OneHome.
 * ============================================================================================
 * Lee, 15 August 2026, comparing the rent feed against the for-sale feed:
 *
 *   *"I like how you have it on the for-sale side, to where the listing agent is at the bottom
 *   most row of that panel — their picture on the left, their score on the right, and their name
 *   should really be in the middle. And I like how we can keep that part separated into white on
 *   both, on rentals and for sale. The point is that they need to look the same."*
 *
 * ── WHY THIS ONE STRIP IS ALLOWED TO BE WHITE WHEN NOTHING ELSE IS ─────────────────────────
 * Lee's 11 August ruling on the rent card was absolute: *"you shouldn't have a white strip at
 * all — everything should be within the picture."* That was about the PROPERTY's facts, and it
 * was right: a price is about the home, so it belongs on the home.
 *
 * A person is not a fact about the property. The agent's face, name and score are the credibility
 * layer that the whole company is built on, and burying them in a scrim over somebody's kitchen
 * is the one place that layer must not be hard to read. So the photo owns the property, and this
 * strip owns the person — which is also exactly the split Lee arrived at independently by looking
 * at the two feeds side by side.
 *
 * ── AND IT REPLACES THE AVATAR THAT USED TO FLOAT TOP-LEFT ─────────────────────────────────
 * The rent card carried a 32px avatar ringed in white over the top-left corner of the photo. It
 * had no name and no score beside it, so it identified nobody — it was a face on a picture. That
 * is removed; the agent appears once, here, with the two things that make a face mean something.
 */
export default function AgentStrip({
  product, agentId, name, photoUrl, score, rating, ratingCount, lang, right,
}: {
  /** Which product's route to link into — the two feeds live under different prefixes. */
  product: string;
  agentId: string;
  name?: string | null;
  photoUrl?: string | null;
  /** OneScore, 0–100. Null renders no donut rather than a zero — see below. */
  score?: number | null;
  /** Average review score for this PROPERTY, 0–5. Null means nobody has reviewed it yet. */
  rating?: number | null;
  ratingCount?: number;
  lang: string;
  /** Anything the card wants on the far right instead of the donut. Rarely used. */
  right?: React.ReactNode;
}) {
  /* ⚠️ `bg-paper` IS NOT DECORATION. 15 Aug 2026.
     Lee: *"at the very bottom of each listing there will be a white strip… the host name and
     score will be in white below each listing, so you can read it clearly. Everything else would
     be within the picture itself."*

     Without an explicit surface this strip inherits whatever the card sits on — which on both
     feeds is a translucent `bg-ink/5`, i.e. the page showing through. The whole argument for
     letting the person out of the scrim is legibility; a translucent strip gives that away and
     leaves a face and a score sitting on nothing. */
  return (
    <div className="flex items-center gap-3 border-t border-ink/[0.07] bg-paper px-3 py-2.5 dark:border-white/10 dark:bg-ink">
      <Link to={`/${product}/p/${agentId}`} className="ow-tap flex min-w-0 flex-1 items-center gap-3">
        <Avatar src={photoUrl} name={name} size={32} rounded="rounded-full" textSize="text-[11px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">
            {name ?? W(lang, "Member", "Miembro")}
          </span>
          {/* ── THE PROPERTY'S OWN RATING, NOT THE AGENT'S ────────────────────────────────
              `rental_reviews.property_id` was added on 15 Aug specifically so a review could be
              about the HOME rather than only about the person. Until this line nothing in the app
              read it.

              ⚠️ NO REVIEWS RENDERS NOTHING — never "0.0", never five empty stars. A brand-new
              listing showing zero stars reads as "people rated this badly", which is the opposite
              of the truth and is unfair to every host who joins. Airbnb learned this one publicly
              and now hides the rating until a listing has enough reviews to mean something. */}
          {rating != null && ratingCount ? (
            <span className="mt-0.5 flex items-center gap-1 text-[11.5px] opacity-70">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
                <path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 5.9 20.6l1.4-6.8-5-4.7 6.8-.8z" />
              </svg>
              <span className="font-bold tabular-nums">{rating.toFixed(1)}</span>
              <span className="opacity-75">
                ({ratingCount} {ratingCount === 1
                  ? W(lang, "review", "reseña")
                  : W(lang, "reviews", "reseñas")})
              </span>
            </span>
          ) : null}
        </span>
      </Link>
      {right ?? (score != null ? <ScoreDonut score={Number(score)} size={34} /> : null)}
    </div>
  );
}
