import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, IconCamera, IconPhoto, thumbFor, Chevron,
} from "@oneworld/shell";
import { type Property, PROPERTY_COLUMNS, priceLabel } from "../lib/rental";
import { coverOf } from "../lib/media";

/**
 * The three profile slots OneRental fills. ProfileScreen itself is SHELL — never rebuilt.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"they'll upload the listing onto their page, their profile, as a listing…
 * during the upload process, either ask, is this personal media or property listing. And then
 * it's always tagged that way. And then the public viewer can see: do I wanna see everything?
 * Do I wanna see personal media, or do I wanna see property listings?"*
 *
 * That three-way filter is built here, on OneRental's own profile tab, and it works today.
 *
 * ⚠️ FOR THREAD A — THIS BELONGS IN THE SHELL EVENTUALLY. The same filter over the same wall
 * should appear on every product's profile, because a listing is a thing about the PERSON, not
 * about the app you happen to be standing in. `MediaWall` is a shell component, and adding a
 * tag filter to it changes the profile of all six apps at once. That change is deliberately NOT
 * made here: Max rolled back an app bundle yesterday, Thread A is mid-flight in this exact
 * surface, and a shared-surface change made from a side lane is how yesterday happened. It is
 * written up in the hand-off instead.
 */

/**
 * OneHome's profile tiles — ONE grid, with a horizontal filter across the top.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"regarding the properties and the individual or personal pictures, let's just
 * combine them together. You had it before where there's, like, a horizontal toggle to where it
 * says All and then Properties and then Personal. That way if they wanna toggle to properties they
 * could just see properties. It's like a filter. That way everything is in one area. It'll
 * consolidate the real estate space."*
 *
 * ── I SPLIT THIS EARLIER AND HE WANTS IT BACK. HE IS RIGHT, AND HERE IS WHY I WAS WRONG ─────
 * On 11 Aug I replaced the filter with two stacked labelled sections, on the argument that a
 * filter defaulting to "Everything" mixes somebody's holiday photographs into their property
 * listings — and on OneHome a photograph means a room you might sign a lease for.
 *
 * The concern was real; the fix was not. Two stacked sections do not remove the mixing, they just
 * make you SCROLL PAST one to reach the other, and they cost twice the vertical space to say the
 * same thing. The filter solves the actual problem better: it lets the READER choose, in one tap,
 * and it defaults to a state where properties come first anyway.
 *
 * So it is one grid with a horizontal filter — All · Properties · Personal — with the counts on
 * the chips so an empty section is visible before it is selected.
 *
 * ── ONE THING KEPT FROM THE SPLIT VERSION ───────────────────────────────────────────────────
 * In "All", PROPERTIES SORT FIRST and personal photographs follow. Lee's original worry stands
 * even inside a merged grid: an agent whose first six tiles are holiday pictures reads as somebody
 * who does not have any listings. Interleaving by date would do exactly that. So the filter is the
 * reader's choice and the ORDER is the product's.
 *
 * A TILE IS A PROPERTY, NOT A PHOTOGRAPH. Lee: *"each square would be a different property. When
 * you click it, you'll see all fifty images."* The cover is `photos[0]`, and the count of the rest
 * is stamped on the tile so it is obvious there is more behind it.
 */
type Tab = "all" | "properties" | "personal";

/* ── HOW MUCH OF SOMEBODY'S WALL BELONGS ON THE PROFILE (Lee, 11 Aug 2026) ───────────────────
   *"The same thing with the photos — you should only show maybe 4 rows before you say See more,
   that way you don't have to scroll scroll scroll to get to other stuff, because there's other
   stuff on the page… unless someone wants to break this out into a separate window. Maybe
   there's a button for that, that way they can just see the media by itself. But in this window
   it's not realistic to have a 100 rows when there's other stuff to see after it."*

   And, separately, on the fetch rather than the paint:

   *"From a throttling perspective we may not want to populate a 1000 listings on the page all at
   one time — probably only populate maybe 10, before they scroll to the bottom and get to
   another 10."*

   Two different limits, and they are not the same limit:
     · GRID_ROWS  — how many rows the profile is allowed to spend on the wall before it says See
       all. Four rows of two is eight tiles: enough to know what this person deals in, short
       enough that the reviews and the stats under it are still reachable.
     · PAGE       — how many rows we ASK THE DATABASE for at a time. This was 60 of each table on
       every profile open. Now it is 12, and the full-screen view asks for the next 12 when you
       reach the bottom of what you have.

   The profile is capped; the full-screen wall is not. Lee's own rule for where infinite scroll
   is fine: *"if there's nothing below it, like on the main homepage where there's just a feed,
   then yeah, let them scroll forever."* A dedicated wall has nothing below it. */
const GRID_ROWS = 4;
const GRID_COLS = 2;
const INLINE_MAX = GRID_ROWS * GRID_COLS;
const PAGE = 12;

/* Same construction as the feed card's scrim and for the same reason: `via-*` pins its stop at the
   midpoint, which left the top line of text over near-clear glass. Explicit stops, with a floor. */
const TILE_SCRIM = "linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.78) 34%, rgba(0,0,0,.42) 70%, rgba(0,0,0,0) 100%)";

export function RentalTiles({ publicView = false }: { publicView?: boolean }) {
  const { lang } = useI18n();
  const { userId: me } = useOneId();
  const { userId: routeUserId } = useParams();
  /* On the public page the person being LOOKED AT owns the tiles; on your own profile it is you. */
  const userId = publicView ? routeUserId : me;
  const [tab, setTab] = useState<Tab>("all");
  /* `wall` is the full-screen view. `take` is how many rows we have asked the database for; it
     only ever grows, and only from inside the wall — the profile never fetches a second page,
     because the profile never shows one. */
  const [wall, setWall] = useState(false);
  const [take, setTake] = useState(PAGE);

  /* ── "PROPERTIES" MEANS BOTH HALVES OF ONEHOME ────────────────────────────────────────────
     An agent does not have a rental self and a sale self — they have properties, some to let and
     some to sell. Reading only `rental_properties` here would have meant the SALE side of the
     public profile showed nothing but rentals, which is the regression this note exists to record:
     I caught it converting the two-grid version to one, because the old public component read both
     tables and the profile component did not.

     Interleaved by date, tagged per tile, so one filter chip answers the whole question. */
  const listings = useAsync(async () => {
    if (!userId) return [];
    let rq = supabase.from("rental_properties")
      /* `city`, `neighbourhood`, `bedrooms`, `bathrooms` are read by the tile overlay. Added at
         the same moment the overlay was written — a tile that renders a column the query does not
         select is a blank line nobody notices until it is in front of Lee. */
      .select("id, title, photos, cover_photo, price, price_unit, currency, display_currency, display_fx_rate, city, neighbourhood, bedrooms, bathrooms, created_at, is_public, status")
      .eq("agent_id", userId);
    let sq = supabase.from("sale_properties")
      .select("id, title, photos, asking_price, city, neighbourhood, bedrooms, bathrooms, created_at, is_public, status")
      .eq("agent_id", userId);
    /* A stranger sees published, public listings only. A draft on somebody's public page is a
       leak, not a preview — and RLS says the same thing again on the server. */
    if (publicView) {
      rq = rq.eq("is_public", true).eq("status", "published");
      sq = sq.eq("is_public", true).eq("status", "published");
    }
    const [r, sl] = await Promise.all([
      rq.order("created_at", { ascending: false }).limit(take),
      sq.order("created_at", { ascending: false }).limit(take),
    ]);
    const a = (r.data ?? []).map((x: any) => ({ ...x, _kind: "rent" as const }));
    const b = (sl.data ?? []).map((x: any) => ({ ...x, _kind: "sale" as const }));
    return [...a, ...b].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
  }, [userId, publicView, take]);

  const media = useAsync(async () => {
    if (!userId) return [];
    const { data } = await supabase.from("media_posts")
      .select("id, media_type, media_url, thumbnail_url, caption, created_at")
      .eq("user_id", userId).eq("moderation_status", "visible")
      .order("created_at", { ascending: false }).limit(take);
    return data ?? [];
  }, [userId, take]);

  /* ── THE TRUE COUNTS COME FROM `count`, NOT FROM `data.length` ────────────────────────────
     The chips have to say how many there ARE, not how many arrived in the current page — a
     "Properties 12" that becomes "Properties 27" when you open the wall is the page telling you
     it was lying the first time. These are HEAD requests: a number, no rows. */
  const totals = useAsync(async () => {
    if (!userId) return { listings: 0, media: 0 };
    const pub = (q: any) => publicView ? q.eq("is_public", true).eq("status", "published") : q;
    const [r, sl, m] = await Promise.all([
      pub(supabase.from("rental_properties").select("id", { count: "exact", head: true }).eq("agent_id", userId)),
      pub(supabase.from("sale_properties").select("id", { count: "exact", head: true }).eq("agent_id", userId)),
      supabase.from("media_posts").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("moderation_status", "visible"),
    ]);
    return { listings: (r.count ?? 0) + (sl.count ?? 0), media: m.count ?? 0 };
  }, [userId, publicView]);

  const loadedL = listings ?? [];
  const loadedM = media ?? [];
  /* ── NEVER LET THE COUNT QUERY HIDE ROWS WE ALREADY HAVE ─────────────────────────────────
     `Math.max`, not `??`. The head-count query is a SECOND request and it can fail, be slow, or
     be blocked by a policy the row read is not — and when it did, the profile rendered "Nothing
     here yet" over three listings that were sitting in memory. I caught that in the screenshot,
     not in the types: every check passed and the page was blank.

     The count is only ever used to say how many MORE there are than we fetched, so the honest
     floor is what we are actually holding. */
  const nL = Math.max(totals?.listings ?? 0, loadedL.length);
  const nM = Math.max(totals?.media ?? 0, loadedM.length);
  const loading = listings === undefined || media === undefined;

  const showL = tab === "all" || tab === "properties";
  const showM = tab === "all" || tab === "personal";
  const shownTotal = (showL ? nL : 0) + (showM ? nM : 0);

  const TABS: { id: Tab; label: string; n: number }[] = [
    { id: "all",        label: W(lang, "All", "Todo"),             n: nL + nM },
    { id: "properties", label: W(lang, "Properties", "Inmuebles"), n: nL },
    /* Lee, 11 Aug 2026: *"really it just needs to be called Media, because it may not even be
       personal — it could be a video or whatever."* He is right, and "Personal" was also making a
       claim about the content that we cannot check. */
    { id: "personal",   label: W(lang, "Media", "Multimedia"),     n: nM },
  ];

  if (loading) {
    return (
      <div className="mt-4 grid grid-cols-2 gap-2" aria-busy="true">
        {[0, 1, 2, 3].map(i => <div key={i} className="ow-shimmer h-36 rounded-xl" />)}
      </div>
    );
  }

  /* Nothing at all — render nothing rather than a filter over an empty grid. On a public page
     that also means a person with no listings and no photos gets a clean passport, not three
     chips reading zero. */
  if (nL + nM === 0) {
    return publicView ? null : (
      <p className="py-6 text-center text-[12.5px] opacity-50">
        {W(lang, "Nothing here yet. Your listings and photos will appear here.",
                 "Aún no hay nada. Sus inmuebles y fotos aparecerán aquí.")}
      </p>
    );
  }

  /* Properties first, always — an agent whose first six tiles are holiday pictures reads as
     somebody with no listings. The filter is the reader's choice; the ORDER is the product's. */
  const items: any[] = [
    ...(showL ? loadedL.map(l => ({ ...l, _t: "listing" as const })) : []),
    ...(showM ? loadedM.map(m => ({ ...m, _t: "media" as const })) : []),
  ];
  const loadedMore = items.length < shownTotal;

  const tile = (it: any) => {
    if (it._t === "media") {
      return (
        /* The media tile matches the listing tile exactly — same ratio, same overlay treatment —
           because the whole point of merging the two grids was that they read as ONE wall. A
           4:5 photo beside a 4:5 photo-with-a-caption-panel is two grids wearing one heading.

           A missing thumbnail no longer renders the browser's broken-image glyph and its alt
           text (Lee's screenshot: a torn-page icon captioned "Test 123"). Videos frequently have
           no poster yet; `onError` swaps in a plain surface instead. */
        <div key={`m-${it.id}`} className="relative overflow-hidden rounded-xl border border-ink/[0.08] dark:border-white/10">
          {(it.thumbnail_url ?? it.media_url)
            ? <img src={it.thumbnail_url ?? it.media_url} alt="" loading="lazy"
                className="aspect-[4/5] w-full bg-ink/5 object-cover dark:bg-white/5"
                onError={e => { e.currentTarget.style.visibility = "hidden"; }} />
            : <div className="aspect-[4/5] w-full bg-ink/5 dark:bg-white/5" />}
          {String(it.media_type ?? "").toLowerCase().includes("video") && (
            <span className="pointer-events-none absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink/60 text-white backdrop-blur-sm">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            </span>
          )}
          {it.caption && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-8 text-white"
              style={{ background: TILE_SCRIM }}>
              <p className="line-clamp-2 break-words text-[11px] leading-snug">{it.caption}</p>
            </div>
          )}
        </div>
      );
    }
    const rent = it._kind === "rent";
    const price = rent
      ? priceLabel(it as Property, lang)
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
          .format(Number(it.asking_price) || 0);
    /* ── WHAT FITS ON A HALF-WIDTH TILE (Lee, 11 Aug 2026) ────────────────────────────────
       *"You need to be strategic about what you're showing. You don't need to show the property
       title at that point, because there's not enough space on a little thumbnail like that. You
       just need to show, like, the city, the rent, and the bedroom, bathroom. That's all you have
       room to show until they click it."*

       He is right, and the old tile proved it: the title was `truncate`d to "Beautiful first
       listing …", which tells a reader nothing at all while spending the most valuable line on
       the tile. Price, then beds/baths, then city — every one of them a fact somebody decides on. */
    const facts = [
      it.bedrooms != null ? `${it.bedrooms} ${W(lang, "bd", "hab")}` : null,
      it.bathrooms != null ? `${it.bathrooms} ${W(lang, "ba", "baños")}` : null,
    ].filter(Boolean).join(" · ");
    const where = [it.neighbourhood, it.city].filter(Boolean).join(", ");
    return (
      /* ── ONE PHOTOGRAPH, TEXT ON TOP OF IT ──────────────────────────────────────────────
         *"The listing should be the full panel. Right now you're showing the listing where the
         listing is like half the picture and then half the actual description, and that's not the
         way it's supposed to be. It should be one big nice picture, and the words should be
         overlaying on top of the picture with a black underlay under it so you can see the text."*

         This is the same decision already made on the feed card, arriving on the profile: a tile
         beside somebody's photographs should BE a photograph, or the grid reads as two different
         kinds of object badly aligned. Same `SCRIM` reasoning too — an explicit gradient with a
         floor, not `via-black/70`, because half these tiles will be bright rooms. */
      <Link key={`${it._kind}-${it.id}`}
        to={productHref(rent ? "onerental" : "onesale", `${rent ? "/r/" : "/s/"}${it.id}`)}
        className="ow-tap relative block overflow-hidden rounded-xl border border-ink/[0.08] dark:border-white/10">
        {/* The host's chosen cover (7 Sep 2026, media lane), first photo when none is chosen.
            One tile per property — the profile never fans a listing out into its photos. */}
        {coverOf(it)
          ? <img src={thumbFor(coverOf(it)!)} alt="" className="aspect-[4/5] w-full object-cover" loading="lazy"
              onError={e => { const t = e.currentTarget; if (t.src !== coverOf(it)) t.src = coverOf(it)!; }} />
          : <div className="grid aspect-[4/5] w-full place-items-center bg-ink/5 dark:bg-white/5"><IconPhoto size={18} /></div>}
        {/* Rent or sale, on the tile. The price alone does not distinguish them — $1,900 is
            a monthly rent or a very cheap apartment depending on a word that has to be there. */}
        <span className="absolute left-1.5 top-1.5 rounded-md bg-ink/70 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
          {rent ? W(lang, "Rent", "Arriendo") : W(lang, "Sale", "Venta")}
        </span>
        {(it.photos?.length ?? 0) > 1 && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-ink/65 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            +{it.photos.length - 1}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-8 text-white"
          style={{ background: TILE_SCRIM }}>
          <p className="text-[13px] font-black leading-none tracking-tight">{price}</p>
          {facts && <p className="mt-0.5 truncate text-[10.5px] font-semibold opacity-90">{facts}</p>}
          {where && <p className="truncate text-[10.5px] opacity-80">{where}</p>}
        </div>
      </Link>
    );
  };

  /* ── THE FILTER ROW ──────────────────────────────────────────────────────────────────────
     Scrollable rather than wrapping, so a fourth tab later cannot push the row onto two lines
     and shift everything under it.

     `relative z-[1]` and an opaque backdrop: Lee, 11 Aug — *"when you added the horizontal
     selector, you see that it's still hidden behind the other element."* The row sat in the
     normal flow with no stacking context of its own, directly under a card that paints a
     translucent glass fill and a shadow past its own border box, so on his phone the chips were
     rendered under that spill. Giving the row its own layer and its own background means nothing
     above it can paint over it, whatever that thing's shadow does. */
  const chips = (
    /* ── NO PANEL BEHIND THE CHIPS (Lee, 12 Aug 2026) ─────────────────────────────────────
       *"Just under the reputation passport section you have this white box — it's like a nested
       panel for the filters, All versus Properties versus Media. You don't need a white box. That
       is the sloppiest box, it's not even formatted. It looks like you started something and
       didn't finish it. Just remove that, you don't need it at all."*

       He is right, and it was mine: I gave the row an opaque `bg-paper` on 11 Aug to stop
       something painting over it, on a report I could never reproduce. That fix was a guess, and
       the guess left a hard-edged white rectangle sitting behind three chips with no radius, no
       border and no padding — a panel that announces itself and explains nothing.

       The stacking layer stays (`relative z-[1]`), because that part costs nothing and is what
       actually prevents an overlap. The background comes off. */
    <div className="relative z-[1] -mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1 py-1"
      style={{ scrollbarWidth: "none" }} role="tablist">
      {TABS.map(t => {
        const on = t.id === tab;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on}
            onClick={() => setTab(t.id)}
            className={`ow-tap flex min-h-[40px] shrink-0 items-center rounded-xl px-3.5 text-[12.5px] font-bold transition ${
              on ? "bg-ink text-paper dark:bg-white dark:text-ink"
                 : "border border-ink/12 opacity-70 dark:border-white/15"}`}>
            {t.label}
            <span className={`ml-1.5 text-[11px] tabular-nums ${on ? "opacity-70" : "opacity-55"}`}>
              {t.n}
            </span>
          </button>
        );
      })}
    </div>
  );

  const empty = (
    <p className="py-6 text-center text-[12.5px] opacity-50">
      {tab === "properties"
        ? W(lang, "No properties listed yet.", "Aún no hay inmuebles publicados.")
        : W(lang, "No media yet.", "Aún no hay multimedia.")}
    </p>
  );

  return (
    <>
      <section className="mt-4">
        {chips}
        {shownTotal === 0 ? empty : (
          <>
            <div className="grid grid-cols-2 gap-2">{items.slice(0, INLINE_MAX).map(tile)}</div>
            {/* ── SEE ALL — THE SEPARATE WINDOW HE ASKED FOR ─────────────────────────────
                   Lee: *"unless someone wants to break this out into a separate window — maybe
                   there's a button for that, that way they can just see the media by itself."*
                   Below the cap the button is not rendered at all: "See all 6" over six visible
                   tiles is a control that does nothing. */}
            {shownTotal > INLINE_MAX && (
              <button type="button" onClick={() => setWall(true)}
                className="ow-tap mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-ink/12 text-[13px] font-bold dark:border-white/15">
                {W(lang, `See all ${shownTotal}`, `Ver los ${shownTotal}`)}
                <Chevron size="sm" dir="right" />
              </button>
            )}
          </>
        )}
      </section>

      {wall && (
        <MediaWallSheet
          title={W(lang, "Properties & photos", "Inmuebles y fotos")}
          onClose={() => setWall(false)}
          chips={chips}
          canLoadMore={loadedMore}
          onLoadMore={() => setTake(t => t + PAGE)}
          moreLabel={W(lang, "Load more", "Cargar más")}
        >
          {shownTotal === 0 ? empty : <div className="grid grid-cols-2 gap-2">{items.map(tile)}</div>}
        </MediaWallSheet>
      )}
    </>
  );
}

/**
 * THE FULL-SCREEN WALL — "just see the media by itself".
 * ============================================================================================
 * A portal to `document.body`, not a nested div. The profile sits inside a scroll container with
 * its own transforms and backdrop filters, and a `position: fixed` child of a transformed
 * ancestor is positioned against the ANCESTOR, not the viewport — which is how a full-screen
 * overlay ends up three-quarters of the way down a page, clipped. The portal removes the whole
 * class of problem rather than fighting it with z-index.
 *
 * `Escape` closes it and the body stops scrolling underneath while it is open, because a sheet
 * you can scroll the page behind reads as a rendering fault rather than a layer.
 */
function MediaWallSheet({
  title, onClose, chips, children, canLoadMore, onLoadMore, moreLabel,
}: {
  title: string; onClose: () => void; chips: React.ReactNode; children: React.ReactNode;
  canLoadMore: boolean; onLoadMore: () => void; moreLabel: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-paper dark:bg-ink" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sticky top-0 z-10 border-b border-ink/8 bg-paper/95 backdrop-blur dark:border-white/10 dark:bg-ink/95">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-2.5">
          <button onClick={onClose}
            className="ow-tap inline-flex min-h-[40px] items-center gap-1 rounded-full border border-ink/10 py-1.5 pl-2 pr-3.5 text-sm font-semibold dark:border-white/15">
            <Chevron size="sm" dir="left" />
          </button>
          <p className="flex-1 truncate text-center text-[15px] font-extrabold">{title}</p>
          {/* Balances the back control so the title is optically centred rather than nudged. */}
          <span className="w-[58px] shrink-0" aria-hidden />
        </div>
      </div>
      <div className="mx-auto max-w-lg px-4 pb-24 pt-2">
        {chips}
        {children}
        {/* Lee's throttle, made visible. Nothing below this sheet, so more may keep arriving —
            but on a tap, not on a scroll guess: a button that says how to get more is honest
            about the wait, where a spinner that fires itself is not. */}
        {canLoadMore && (
          <button type="button" onClick={onLoadMore}
            className="ow-tap mt-3 min-h-[44px] w-full rounded-xl border border-ink/12 text-[13px] font-bold dark:border-white/15">
            {moreLabel}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Stats: what this person's word is worth, in numbers rather than adjectives. */
export function RentalStats() {
  const { lang } = useI18n();
  const { userId } = useOneId();

  const s = useAsync(async () => {
    if (!userId) return null;
    const [{ count: active }, { count: letCount }, { count: agreed }] = await Promise.all([
      supabase.from("rental_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId).eq("status", "published"),
      supabase.from("rental_contracts").select("id", { count: "exact", head: true })
        .or(`agent_id.eq.${userId},tenant_id.eq.${userId}`).in("status", ["active", "ended"]),
      supabase.from("rental_contracts").select("id", { count: "exact", head: true })
        .or(`agent_id.eq.${userId},tenant_id.eq.${userId}`).eq("status", "ended"),
    ]);
    return { active: active ?? 0, let: letCount ?? 0, completed: agreed ?? 0 };
  }, [userId]);

  const Cell = ({ n, label }: { n: number; label: string }) => (
    <div className="flex-1 text-center">
      <p className="text-[20px] font-black tracking-tight">{n}</p>
      <p className="text-[11px] leading-tight opacity-55">{label}</p>
    </div>
  );

  return (
    <div className="card mt-3 flex p-3">
      <Cell n={s?.active ?? 0} label={W(lang, "Listed now", "Publicados")} />
      <Cell n={s?.let ?? 0} label={W(lang, "Rentals", "Arriendos")} />
      <Cell n={s?.completed ?? 0} label={W(lang, "Completed", "Completados")} />
    </div>
  );
}

/** Calendar slot: the next thing that needs a human. */
export function RentalCalendar() {
  const { lang } = useI18n();
  const { userId } = useOneId();

  const next = useAsync(async () => {
    if (!userId) return [];
    const { data } = await supabase.from("rental_contracts")
      .select("id, starts_on, ends_on, status, deposit_required")
      .or(`agent_id.eq.${userId},tenant_id.eq.${userId}`)
      .in("status", ["sent", "awaiting_first_payment", "active"])
      .order("starts_on").limit(4);
    return data ?? [];
  }, [userId]);

  if (!next?.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {next.map((c: any) => (
        <Link key={c.id} to={productHref("onerental", `/c/${c.id}`)} className="card ow-tap flex items-center gap-3 p-3">
          <span className="text-brand"><IconCamera size={17} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{c.starts_on} → {c.ends_on}</p>
            <p className="text-[11.5px] opacity-60">
              {c.status === "awaiting_first_payment"
                ? W(lang, "Signed — waiting on the first payment before it starts",
                          "Firmado — esperando el primer pago para iniciar")
                : c.status === "sent"
                ? W(lang, "Sent — waiting on a signature", "Enviado — esperando firma")
                : W(lang, "Active", "Activo")}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
