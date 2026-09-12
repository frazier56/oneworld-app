import { useParams, Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { PRODUCT_BRAND, type AppKey } from "../lib/oneWorld";
import { productHref } from "../routes";
import { getPublicAppLinks } from "../lib/appLinks";
import { isSectionPublic } from "../lib/publicSections";
import MyWorldHub from "../components/MyWorldHub";
import MediaWall from "../components/MediaWall";
import PublicReviews from "../components/PublicReviews";
import PassportStrip from "../components/passport/PassportStrip";
import ClampBlock from "../components/ClampBlock";
import { IconPin } from "../components/ActionIcons";

/**
 * PUBLIC "THEIR WORLD" — the profile a stranger opens from a shared link.
 * ============================================================================================
 * Public by default (mounted on a `publicPaths` route).
 *
 * ── WHAT IS A STAPLE AND WHAT IS A SWITCH (Lee, 10 Aug 2026) ────────────────────────────────
 * Lee, on his own public page: *"It just looks like a thread."* His screenshot had three things
 * on it — Connect, Message, Passport — and nothing else.
 *
 * Two separate faults produced that, and only one of them was cosmetic:
 *
 *   1. THE PRIVACY FAULT. The visibility switches were decorative on this page for everything
 *      except the score. Turning a section off on your profile did not reliably turn it off for
 *      strangers. That is a privacy bug, not a layout bug, and it is the more serious half.
 *
 *   2. THE EMPTY-PAGE FAULT. Everything worth reading was INSIDE the passport, so a member who
 *      switched the passport off was left with two buttons. The bio, the media and the reviews
 *      had no existence of their own.
 *
 * So the page is now split explicitly, and the split is the contract:
 *
 *   STAPLES — always rendered, never behind a switch, because a public profile with none of them
 *   is not a profile: photo · name · profession · location · bio · media · reviews · Connect and
 *   Message. Reviews in particular are what OTHER people said, not something the member elects
 *   to publish, and on a credibility-first platform they are the point.
 *
 *   SWITCHED — score, passport and My World, each gated through the SAME `isSectionPublic`
 *   predicate the owner's profile writes, so the switch and the gate cannot drift. (They did
 *   drift once already: the switch rendered OFF for a new member while the gate rendered
 *   VISIBLE, so "Show my score: off" sat next to a score that was public the whole time.)
 *
 * A stranger still never sees the owner's roadmap or checklist (publicView), and a dark bulb is
 * filtered out — a visitor does not need a list of things you have not done.
 */
export default function PublicWorld({ product, belowSlot, primarySlot, mediaOwnedByPrimary = false }: {
  product: AppKey;
  /** App-specific public content under the passport — OneSocial passes the person's
   *  cross-platform post feed (Lee, 9 Aug: a visitor sees ALL their social media in one
   *  place); OneEvent could pass hosted events. The shell owns the header/hub/passport;
   *  what a product is ABOUT stays the product's slot. */
  belowSlot?: React.ReactNode;
  /**
   * The app-specific content that is the REASON somebody opened this page, rendered ABOVE the
   * generic media wall rather than under it.
   *
   * Lee, 11 Aug 2026: *"when you click on a person you should see all of their properties on their
   * page, which you kinda do, but it's at the very bottom. I'd prioritize that."*
   *
   * He is right, and `belowSlot` had the ordering backwards for a property app. Somebody tapping
   * an agent's name on a listing came for the other listings; the personal photo wall is context,
   * not the point. Two slots rather than one flag, because OneSocial legitimately wants the
   * opposite order — there the posts ARE the person.
   */
  primarySlot?: React.ReactNode;
  /* ── TWO MEDIA SECTIONS ON ONE PAGE (Lee, 11 Aug 2026) ──────────────────────────────────
     *"On the profile page you have a section where you can see the properties and your personal
     media — but the problem is you have a media section right below that. So you have two media
     sections, and you don't need that. You only need one."*

     His screenshot shows it exactly: the merged grid, then "See all 34", then a second card
     headed Media holding the same photographs again. The owner's own profile already had this
     switch (`mediaOwnedByTiles`); the PUBLIC page never got one, so `primarySlot` rendered the
     merged grid and `MediaWall` rendered underneath it unconditionally.

     Default `false`, so the five apps that do not merge anything are untouched. */
  mediaOwnedByPrimary?: boolean;
}) {
  const { lang } = useI18n();
  const isEs = lang === "es";
  const { userId } = useParams();

  const owner = useAsync(async () => {
    const { data } = await supabase.from("profiles")
      .select("full_name, photo_url, job_title, location, bio, score_v9_snapshot")
      .eq("id", userId!).maybeSingle();
    return data as {
      full_name: string | null; photo_url: string | null; job_title: string | null;
      location: string | null; bio: string | null; score_v9_snapshot: number | null;
    } | null;
  }, [userId], !!userId);

  const links = useAsync(async () => getPublicAppLinks(userId!), [userId], !!userId);

  if (!userId) return null;
  const name = owner?.full_name ?? "";
  const worldHref = productHref(product, `/world/${encodeURIComponent(userId)}`);
  const showWorld = isSectionPublic(links ?? undefined, "show_world");
  const showPassport = isSectionPublic(links ?? undefined, "show_passport");
  /* Lee, 9 Aug: the switches MUST rule the public page — all of them. `show_score` was shown
     on the profile and then ignored here, so "Show my score: off" sat next to a public score. */
  const showScore = isSectionPublic(links ?? undefined, "show_score");

  return (
    <div className="space-y-4">
      {/* ── Public header ── */}
      <div className="flex items-center gap-4">
        {owner?.photo_url
          ? <img src={owner.photo_url} className="h-20 w-20 shrink-0 rounded-2xl object-cover" alt="" />
          : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-brand/15 text-3xl font-bold text-brand">{name?.[0]?.toUpperCase() ?? "·"}</div>}
        <div className="min-w-0 flex-1">
          {/* `truncate` — the two lines under it already had it and this one did not, so a long
              name was the one thing on this card that could push the layout. */}
          <h1 className="truncate text-lg font-extrabold leading-tight sm:text-xl">{name || "—"}</h1>
          {owner?.job_title && <p className="truncate text-sm opacity-60">{owner.job_title}</p>}
          {owner?.location && (
            <p className="flex items-center gap-1 truncate text-[13px] opacity-50">
              <IconPin size={12} className="shrink-0" />{owner.location}
            </p>
          )}
        </div>
      </div>

      {/* ── Connect / Message ── */}
      <div className="flex gap-2">
        <Link to={productHref(product, `/messages?to=${encodeURIComponent(userId)}`)}
          className="btn-primary flex-1 text-center">{isEs ? "Conectar" : "Connect"}</Link>
        <Link to={productHref(product, `/messages?to=${encodeURIComponent(userId)}`)}
          className="btn-ghost flex-1 text-center">{isEs ? "Mensaje" : "Message"}</Link>
      </div>

      {/* ── STAPLE: the bio. It used to exist only inside the passport, so switching the passport
             off deleted the one paragraph explaining who this person is. ── */}
      {owner?.bio && (
        /** Clamped to four lines with a More, same as the owner's own profile. Lee, 11 Aug:
              *"any section that's very long, you should always show just a summary of it, and
              then let people expand it if they want to, especially if there's something below
              it."* There is a great deal below this one — media, listings, reviews — and a
              stranger scrolling past somebody's life story to reach their listings leaves. */
          <ClampBlock lines={4} className="text-[14px] leading-relaxed opacity-80">{owner.bio}</ClampBlock>
      )}

      {/* ── SWITCHED: sister-app hub ── */}
      {showWorld && <MyWorldHub product={product} worldHref={worldHref} publicView userId={userId} />}

      {/* ── Public passport ── */}
      {showPassport && (
        <PassportStrip
          product={product}
          worldHref={worldHref}
          userId={userId}
          score={showScore ? (owner?.score_v9_snapshot ?? null) : null}
          name={name}
          photo={owner?.photo_url ?? null}
          title={owner?.job_title ?? null}
          bio={owner?.bio ?? null}
          location={owner?.location ?? null}
          publicView
        />
      )}

      {/* The product's own answer to "who is this", first. See `primarySlot` above. */}
      {primarySlot}

      {/* ── STAPLES: media and reviews. Both are unconditional. Media reads `media_posts` — the
             wall pointed at a table that has never existed until 10 Aug, so 584 real posts from
             59 people were invisible on every profile in every app. ── */}
      {!mediaOwnedByPrimary && <MediaWall userId={userId} />}
      <PublicReviews userId={userId} />

      {belowSlot}

      <p className="pt-2 text-center text-[11px] opacity-40">
        {isEs ? `Perfil público en ${PRODUCT_BRAND[product].name}` : `Public profile on ${PRODUCT_BRAND[product].name}`}
      </p>
    </div>
  );
}
