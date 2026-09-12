import { useEffect, useMemo, useRef, useState } from "react";
import { listingFacts } from "../../shared/listingFacts";
import { HostAvatar, PhotoCount } from "../../shared/CardChrome";
import { ListingRatings, RatingRetry, useListingRatings, type RatingSet } from "../../shared/ListingRatings";
import { Link, useNavigate } from "react-router-dom";
import {
  HomeTop, Avatar, useI18n, useAsync, supabase, productHref, W, IconPin,
  fetchTrm, type Trm, CO_NEIGHBOURHOODS, coCityKey, Chevron,
  useViewerCcy, type ViewerCcy, drawPrice, NoticeRow,
  /* v84 · U18 + U20/R41 · every one of these is already built and already exported from the
     shell; the sale feed was the only screen not importing them. */
  SearchTriad, ListingMap, type MapPin, fillMissingPoints,
  ListingEngagement, appDoorway,
} from "@oneworld/shell";
import { type SaleProperty, SALE_COLUMNS, usd, cop, KIND_LABEL, CO_CITIES } from "../lib/sale";
import SegmentToggle from "../../shared/SegmentToggle";
/* ── THE SAME FILTER SHEET, NOT A SECOND ONE (Lee, 12 Aug 2026) ───────────────────────────────
   *"These are twin forms… literally copy the code and make them identical."* The same ruling
   applies to the two feeds, and the sale feed had NO filters and NO sort at all — the rent feed
   grew both on 11 Aug and this side was never brought along.

   It imports the rent product's component rather than owning a copy, which is the same shape as
   `onesale/routes.tsx` importing `onerental/screens/PublicListings`. The columns it filters on
   exist on BOTH tables by design (one migration put the attribute block on each), so one
   `matches()` reads either without branching. Worth promoting into the shell next time anybody
   opens it — noted for Max rather than done here, because moving a file both feeds import is a
   change to make deliberately rather than in passing. */
import {
  FilterSheet, ControlRow, EMPTY, matches, sortListings, type Filters, type Sort,
} from "../../onerental/components/FilterSheet";

/**
 * /sales — the for-sale feed, and the second half of ONE HOME.
 *
 * The honest banner at the top is the whole design brief for this product: you can list a
 * property, people can find it, you can talk — and the sale itself closes with your attorney.
 * Saying that at the top rather than discovering it at the end is the difference between a
 * useful tool and a bait-and-switch.
 */
/* Lee's throttle, 11 Aug 2026: *"we may not want to populate a 1000 listings on the page all at
   one time — probably only populate maybe 10, before they scroll to the bottom and get to another
   10."* Same `PAGE` and the same sentinel as the rental feed, so the two halves of OneHome do not
   load at two different speeds. */
const PAGE = 12;

/* What the PRICE segment of the triad reads. One bound on its own is a real and common thing
   to have chosen — "up to 400M" — so it renders rather than waiting for both, the same way the
   rent feed's WHEN segment shows a single date. Written in the currency the reader picked the
   numbers in, which is what `priceCcy` is for. */
export function owPriceLabel(f: { minPrice: number | null; maxPrice: number | null; priceCcy: "USD" | "COP" }, lang: string): string | null {
  const n = (v: number) => f.priceCcy === "COP" ? v.toLocaleString("es-CO") : v.toLocaleString("en-US");
  if (f.minPrice != null && f.maxPrice != null) return `${n(f.minPrice)} – ${n(f.maxPrice)}`;
  if (f.minPrice != null) return W(lang, `From ${n(f.minPrice)}`, `Desde ${n(f.minPrice)}`);
  if (f.maxPrice != null) return W(lang, `Up to ${n(f.maxPrice)}`, `Hasta ${n(f.maxPrice)}`);
  return null;
}

export default function Feed() {
  const { lang } = useI18n();
  const [q, setQ] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [take, setTake] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  /* ── v84 · U18 · LIST OR MAP ────────────────────────────────────────────────────────
     Lee, on the sale feed: *"where's my map?"* It was never built on this side rather than
     broken. Same state name, same two values and the same ControlRow group as the rent feed,
     so the two halves of OneHome behave identically rather than merely looking alike. */
  const [view, setView] = useState<"list" | "map">("list");
  const nav = useNavigate();
  /* Listings published before the geo migration carry no point. `fillMissingPoints` resolves
     those once per session on READ, so an old listing still appears on the map instead of
     silently vanishing from it — which is the failure that would get reported as a broken map. */
  const [latePoints, setLatePoints] = useState<Record<string, { lat: number; lng: number; precision: string }>>({});
  /* The official rate, so a peso price range can be converted before it is compared. */
  const [trm, setTrm] = useState<Trm | null>(null);
  /* Seeds the draft from the live filters BEFORE opening — the sheet edits a draft and commits
     on close, so opening it unseeded would throw away whatever the reader had already chosen. */
  const openFilters = () => { setDraftFilters(filters); setSheetOpen(true); };
  useEffect(() => { void fetchTrm().then(setTrm); }, []);
  /* The reader's currency — one preference shared with the rent feed and with Settings. */
  const [viewCcy] = useViewerCcy();

  const listings = useAsync(async () => {
    const { data } = await supabase.from("sale_properties").select(SALE_COLUMNS)
      .eq("is_public", true).in("status", ["published", "under_offer"])
      .order("created_at", { ascending: false }).limit(take);
    return (data ?? []) as unknown as SaleProperty[];
  }, [take]);

  /* A short page means the table had nothing else to give — stop asking, or the sentinel refires
     forever at the bottom of a finished list. 600px of margin starts the next page slightly
     before the last card leaves the screen. */
  const atEnd = (listings?.length ?? 0) < take;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || atEnd || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) setTake(t => t + PAGE); },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [atEnd, listings?.length, take]);

  const ratings = useListingRatings(listings, false);
  const agents = useAsync(async () => {
    const ids = [...new Set((listings ?? []).map(l => l.agent_id))];
    if (!ids.length) return {} as Record<string, any>;
    const { data } = await supabase.from("profiles")
      .select("id, full_name, photo_url").in("id", ids);
    return Object.fromEntries((data ?? []).map((a: any) => [a.id, a]));
  }, [listings?.length], listings !== undefined);

  const pills = useMemo(() => {
    const present = new Set((listings ?? []).map(l => (l.city ?? "").toLowerCase()).filter(Boolean));
    return [{ key: "all", label: W(lang, "All", "Todo") },
      ...CO_CITIES.filter(c => present.has(c.label.toLowerCase())).map(c => ({ key: c.key, label: c.label }))];
  }, [listings, lang]);

  /* The barrios actually present, then the curated ones for the chosen city — same rule as the
     rent feed, so a pick in the dropdown can never produce an empty feed by accident. */
  const feedHoods = useMemo(() => {
    const present = [...new Set((listings ?? [])
      .map(l => (l.neighbourhood ?? "").trim()).filter(Boolean))].sort();
    const curated = CO_NEIGHBOURHOODS[coCityKey(
      CO_CITIES.find(c => c.key === city)?.label ?? "")] ?? [];
    const seen = new Set(present.map(h => h.toLowerCase()));
    return [...present, ...curated.filter(h => !seen.has(h.toLowerCase()))];
  }, [listings, city]);

  const narrow = (f: Filters) => {
    const needle = q.trim().toLowerCase();
    const cityLabel = CO_CITIES.find(c => c.key === city)?.label.toLowerCase();
    return (listings ?? [])
      .filter(l => !cityLabel || (l.city ?? "").toLowerCase() === cityLabel)
      .filter(l => !needle || [l.title, l.description, l.city, l.neighbourhood]
        .some(v => (v ?? "").toLowerCase().includes(needle)))
      .filter(l => matches(l, f, trm?.rate));
  };

  const list = useMemo(() => sortListings(narrow(filters), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listings, q, city, filters, sort, trm]);

  useEffect(() => {
    let alive = true;
    void fillMissingPoints(list as any[]).then(m => {
      if (alive && Object.keys(m).length) setLatePoints(p => ({ ...p, ...m }));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  /* Same shape as the rent feed's, with sale facts instead of rental ones. `exact` drives the
     pin style: an approximate listing draws as an area, never as a doorstep. */
  const pins: MapPin[] = useMemo(() => list
    .map(l => ({ l, pt: (l.display_lat != null && l.display_lng != null)
      ? { lat: l.display_lat as number, lng: l.display_lng as number, precision: l.geo_precision === "exact" ? "exact" as const : "approximate" as const }
      : latePoints[l.id] }))
    .filter(({ pt }) => !!pt)
    .map(({ l, pt }) => ({
      id: l.id,
      lat: pt!.lat,
      lng: pt!.lng,
      exact: pt!.precision === "exact",
      priceLabel: drawPrice(l.asking_price, viewCcy, trm?.rate),
      title: l.title,
      photo: l.photos?.[0] ?? null,
      facts: [
        l.bedrooms != null ? `${l.bedrooms} ${W(lang, "bd", "hab")}` : null,
        l.bathrooms != null ? `${l.bathrooms} ${W(lang, "ba", "baños")}` : null,
        l.area_m2 != null ? `${l.area_m2} m²` : null,
      ].filter(Boolean).join(" · ") || null,
      href: productHref("onesale", `/s/${l.id}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [list, lang, latePoints, viewCcy, trm]);

  /* What the sheet's footer promises, against the same text/pill narrowing already in force. */
  const draftCount = useMemo(() => narrow(draftFilters).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listings, q, city, draftFilters, trm]);

  return (
    <>
    <FilterSheet
      open={sheetOpen} value={filters} resultCount={draftCount} fx={trm?.rate}
      onChange={setDraftFilters}
      onClose={() => { setFilters(draftFilters); setSheetOpen(false); }} />
    <HomeTop
      product="onesale"
      composeTo={productHref("onesale", "/list")}
      noComposer
      onSearch={setQ}
      searchSlot={
        <SearchTriad
          where={{
            label: W(lang, "Where", "Dónde"),
            value: filters.neighbourhood?.trim() || filters.city || null,
            placeholder: W(lang, "Anywhere", "En cualquier lugar"),
          }}
          when={{
            label: W(lang, "Price", "Precio"),
            value: owPriceLabel(filters, lang),
            placeholder: W(lang, "Any price", "Cualquier precio"),
          }}
          who={{
            label: W(lang, "Type", "Tipo"),
            value: filters.types.length
              ? (filters.types.length === 1
                  ? String(filters.types[0])
                  : W(lang, `${filters.types.length} types`, `${filters.types.length} tipos`))
              : null,
            placeholder: W(lang, "Any type", "Cualquier tipo"),
          }}
          onWhere={openFilters} onWhen={openFilters} onWho={openFilters} />
      }
      /* The city pill row is gone here too — same reasoning as the rent feed. Twin feeds. */
      /* 70/30 — search, then where. Identical to the rent feed's. */
      searchAside={
        <label className="relative flex h-full items-center rounded-2xl border border-ink/10 bg-white/70 pl-2.5 pr-7 dark:border-white/15 dark:bg-white/10">
          <span className="sr-only">{W(lang, "Neighbourhood", "Barrio")}</span>
          <select
            value={filters.neighbourhood}
            onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, neighbourhood: v })); setDraftFilters(f => ({ ...f, neighbourhood: v })); }}
            className="ow-fade w-full appearance-none bg-transparent text-[13px] font-semibold outline-none">
            <option value="">{W(lang, "Anywhere", "Todo")}</option>
            {feedHoods.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <span className="pointer-events-none absolute right-2 opacity-40"><Chevron /></span>
        </label>
      }
      feedSlot={
        <div className="space-y-3 pb-28">
          <SegmentToggle current="sale" lang={lang} />

          {/* The same ControlRow as the rent feed, with two of its four groups: this product
              has no map and no layout picker yet, so those are simply not passed rather than
              rendered dead. Noted in ControlRow — it is the one remaining twin gap on the feeds. */}
          <ControlRow filters={filters} sort={sort} view={view}
            onOpenFilters={openFilters}
            onSort={setSort} onView={setView} />

          {/* ⚠️ THE ON-PAGE CURRENCY CONTROL IS GONE — the header owns this, and has since the
              currency moved up there. Leaving this one behind meant a reader could see two
              different currency controls on one screen, and Lee has been clear that currency is a
              property of the READER carried to every screen, not a filter on one feed. Removed
              from the rent feed in the same breath: they are twins, and every single thing that
              has ever been fixed on one half and not the other became a separately reported bug. */}
          {/* ── ONE ROW, NOT A WALL ────────────────────────────────────────────────────────
              Lee, 15 August 2026: *"no one knows what that means if you read it... it's taking
              away too much vertical space right here in the front. It should be one little row
              that you can expand and collapse."*

              The old copy opened with "Listing and documents are live. The closing is not." —
              which describes our build status, not the reader's situation. Somebody looking to
              sell a flat does not know or care which parts of our product are finished. What they
              need to know is whose hands their money passes through, and the answer is a genuinely
              good one, so it is now said as a promise instead of as a release note.

              ⚠️ The wording is deliberate and legally load-bearing. "Held" and "released", never
              "escrow" and never "fiducia" — both imply a licensed status OneHome does not hold,
              and `booking-check.mjs` fails the build if either appears outside a comment. And
              "arras", not "deposit": earnest money on a sale is a Civil Code instrument and is
              lawful, while a deposit on a residential lease is prohibited by Ley 820 Article 16.
              One shared word across those two screens would import a prohibition that does not
              apply here. */}
          <NoticeRow
            title={W(lang, "We never hold the purchase price.",
                           "Nunca retenemos el precio de compra.")}
            body={W(lang,
              "Your attorney closes the sale, exactly as it works in Colombia today. The purchase price never passes through us. What we do hold is the earnest money, released when both sides sign off, and every document in one place.",
              "Su abogado cierra la venta, tal como funciona hoy en Colombia. El precio de compra nunca pasa por nosotros. Lo que sí retenemos son las arras, liberadas cuando ambas partes firman, y cada documento en un solo lugar.")} />

          {view === "map"
            ? <ListingMap pins={pins} onOpen={p => nav(p.href)} />
            : listings === undefined ? [0, 1].map(i => <div key={i} className="card ow-shimmer h-64" />)
            : list.length ? (
              <>
                <RatingRetry host={ratings.host} retry={ratings.retry} lang={lang} />
                {list.map(l => <SaleCard key={l.id} l={l} agent={agents?.[l.agent_id]} lang={lang}
                  ccy={viewCcy} fx={trm?.rate} hostRatings={ratings.host} />)}
                <div ref={sentinel} aria-hidden className="h-px w-full" />
                {!atEnd && <div className="card ow-shimmer h-64" aria-label={W(lang, "Loading more", "Cargando más")} />}
              </>
            )
            : (
              <div className="card p-8 text-center">
                <p className="text-sm font-bold">
                  {W(lang, "Nothing for sale here yet.", "Aún no hay inmuebles en venta.")}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed opacity-55">
                  {W(lang,
                    "Colombia has no public record of what a property last sold for. Every listing here starts one.",
                    "Colombia no tiene un registro público de por cuánto se vendió un inmueble. Cada anuncio aquí empieza uno.")}
                </p>
                <Link to={productHref("onesale", "/list")} className="btn-brand mt-4 inline-block">
                  {W(lang, "List a property", "Publicar un inmueble")}
                </Link>
              </div>
            )}
        </div>
      }
    />
    </>
  );
}

export function SaleCard({ l, agent, lang, ccy = "USD", fx, hostRatings }:
  { l: SaleProperty; agent?: any; lang: string;
    /* Passed down, not read from the hook here, so every card in a render uses one rate. */
    /* ⚠️ `ViewerCcy`, NOT `"USD" | "COP"`. THE TWINS DRIFTED AGAIN, AND THIS TIME I CAUSED IT.
       The reader's currency stopped being a two-value toggle when the picker grew to 22
       currencies — `viewerCurrency.ts` says so in as many words: *"Two values could not express
       that, so this is now any code offered by fx.ts."* `ListingCard` on the rent side was
       widened at the time. This one was not, exactly as everything else on this side has gone:
       filters, sort, the map, three card layouts, the engagement row, comments, the size stepper,
       the attribute line, the dashboard hub and the showing button.

       Max had already hand-fixed this once, directly in `oneworld-origin`. My version 57 package
       shipped a whole reconstructed `Feed.tsx` built from the version 32 baseline plus the
       incremental packages — and that reconstruction never contained his repo-side fix, so
       delivering my file silently reverted it. He caught it on `tsc` and stopped before pushing,
       which is exactly right.

       The lesson is not "widen the type." It is that a package must carry the MINIMAL diff against
       the repo, never a wholesale file rebuilt from somewhere else. A reconstructed file is a
       revert wearing a change's clothes. */
    ccy?: ViewerCcy; fx?: number | null; hostRatings: RatingSet }) {
  const es = lang === "es" || lang === "co";
  const where = [l.neighbourhood, l.city].filter(Boolean).join(", ");
  /* v95 · U25 · Which photo of how many, the way the rent card has always shown it.
     The state and the arithmetic below are COPIED from onerental/screens/Feed.tsx, not
     reimplemented — two cards with two ideas of "which photo is showing" is exactly the
     drift that v87, v89, v90 and v93 all exist to undo. */
  const [idx, setIdx] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  return (
    <article className="card overflow-hidden p-0">
      {l.photos.length > 0 && (
        <div className="relative">
          <Link to={productHref("onesale", `/s/${l.id}`)} className="block">
            <div
              ref={strip}
              onScroll={e => {
                const el = e.currentTarget;
                /* The rent strip is one photo per screen; this one has gap-1 (4px) between
                   photos, and over ten photos that accumulates to most of a photo. So the gap
                   joins the divisor. Everything else — Math.round, and Math.max(1, …) to stop a
                   divide-by-zero before layout settles — is the rent card's, character for
                   character. Same formula, corrected for the one real difference between the two
                   strips rather than pretending there is none. */
                const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth + 4));
                if (n !== idx) setIdx(n);
              }}
              className="scrollbar-none flex snap-x snap-mandatory gap-1 overflow-x-auto">
              {l.photos.slice(0, 10).map((src, i) => (
                <img key={i} src={src} alt="" loading="lazy"
                  className="aspect-square w-full shrink-0 snap-start bg-ink/5 object-cover dark:bg-white/5" />
              ))}
            </div>
          </Link>

          {/* Canonical anatomy, copied from the FOR RENT card: TOP LEFT who listed it,
              TOP RIGHT how many photos. The agent OneScore is deliberately NOT on a browse
              card — see DIRECTION_LOCKED_ONEHOME_CARDS.md. */}
          <HostAvatar to={productHref("onesale", `/p/${l.agent_id}`)} agent={agent} />

          <PhotoCount idx={idx} total={l.photos.length} />

          {/* ── v90 · U36 · THE HEART, ALONE ────────────────────────────────────────────────
              Lee, after testing v87: *"I think we should have at least a like button somewhere on
              the main screen, and you could share it from the listing once you click on it… I would
              say the same place, on the right side, middle towards the bottom."*

              `allowShare={false}` and `hideComments` together leave the heart on its own — that
              is the component's own documented behaviour, not a hack.

              ⚠️ `onComments` is still passed even though no comment button is drawn. Inside
              ListingEngagement that prop is what makes the count query SKIP `media_comments`;
              drop it and every card in the feed runs a count for a button nobody sees. That note is
              Max's, from the rent card, and it applies identically here.

              Positioned on the right edge below the middle, clear of the scrim text on the left. */}
          <div className="pointer-events-auto absolute right-2 top-[58%] z-10">
            <ListingEngagement
              itemId={l.id} source="sale_property"
              shareUrl={`${appDoorway("onehome")}/s/${l.id}`}
              shareTitle={l.title}
              allowShare={false}
              hideComments
              onComments={() => {}}
              lang={lang} compact onDark />
          </div>
        </div>
      )}
      {/* ── v87 · THE CARD, to Lee's layout ─────────────────────────────────────────────
          Everything now sits ON the photograph under the rent card's dark gradient, in white.
          Reading DOWN: description, price, location, then the attribute row at the very
          bottom. Lee: *"at the very bottom of every card it has what type of property it is…
          I like how that's laid out, so we should keep that layout at the bottom. Right above
          that should be the city or the location. And then right above that should be the
          price."* The price and the location have SWAPPED — that was the ask.

          ⚠️ THE ATTRIBUTE ROW IS THE ONE PLACE THE SALE CARD IS CANONICAL AND RENT COPIES IT.
          Normally the FOR RENT card is the reference and this side moves toward it — stated six
          or seven times and locked in DIRECTION_LOCKED_ONEHOME_CARDS.md. This row is the
          deliberate exception, named by Lee himself. Logged as R45: bring it to the rent card.
          Do not "fix" this back.

          ⚠️ THE DESCRIPTION IS BACK, ON THIS CARD ONLY. v78/R36 removed a grey paragraph
          inside a white block. This is a two-line clip in white over a gradient — different
          object, different job, and Lee asked for it by name on 17 Aug. The RENT card keeps
          R36 and the gate still asserts that. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent pt-20">
        <Link to={productHref("onesale", `/s/${l.id}`)}
          className="pointer-events-auto block px-3.5 pb-3 text-white">

          {/* The title still leads — you cannot price a thing you cannot name. */}
          <h3 className="line-clamp-1 text-[15px] font-bold leading-tight drop-shadow">{l.title}</h3>
          <ListingRatings hostId={l.agent_id} host={hostRatings} lang={lang} />

          {/* v89 · U35 · TITLE ONLY. The description went on in v87 and came straight back off
              after Lee saw it live: *"we only need the title listed… description can be found
              when you click on the details."* R36 is back in force on BOTH cards. */}


          {/* PRICE, left justified, directly above the location. */}
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <span className="text-[19px] font-black leading-none tracking-tight drop-shadow">
              {drawPrice(l.asking_price, ccy, fx)}
            </span>
            {l.display_currency === "COP" && l.display_fx_rate && (
              <span className="text-[11.5px] opacity-70">≈ {cop(l.asking_price, l.display_fx_rate)}</span>
            )}
            {l.status === "under_offer" && (
              <span className="rounded-full border border-amber-300/70 px-2 py-0.5 text-[10.5px] font-black uppercase text-amber-200">
                {W(lang, "Under offer", "En negociación")}
              </span>
            )}
          </p>

          {/* LOCATION, left justified, directly above the attribute row. */}
          {where && (
            <p className="mt-1 flex items-center gap-1 truncate text-[12.5px] opacity-85">
              <IconPin size={12} />{where}
            </p>
          )}

          {/* THE ATTRIBUTE ROW — unchanged in content and order, now at the very bottom. */}
          {/* v99 · R6a · The order and the words come from src/products/shared/listingFacts.ts —
              one definition for both cards. The KIND LABEL stays here: KIND_LABEL is sale's own
              vocabulary over sale's own column, and rent has a different one. This owns the
              markup, which is genuinely different from rent's joined line, and that is fine. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] opacity-85">
            {listingFacts(KIND_LABEL[l.kind][es ? "es" : "en"], l, lang).map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </Link>
      </div>
    </article>
  );
}
