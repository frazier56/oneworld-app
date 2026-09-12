import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { sc } from "../lib/shellCopy";
import { productHref } from "../routes";
import { CONFIGS } from "../products";
import type { AppKey } from "../lib/oneWorld";
import { IconVideo, IconPhoto, IconWrite, IconLive, IconSearch, IconPlus } from "./ActionIcons";
import ScreenHeading from "./ScreenHeading";
import { screenTitle } from "../lib/screenTitles";

/**
 * HOME TOP — the shared head of every app's home tab (SHELL, merged 1.6.1).
 * ============================================================================================
 * Search + composer + filter pills, identical on every app; the app supplies ONLY its feed
 * (`feedSlot`). Template Map: "Home / feed — APP — most app-specific screen"; everything above
 * the feed is chrome the family shares.
 *
 * ── MERGE NOTE, 8 Aug 2026 — read before "improving" this ────────────────────────────────────
 * Threads A and B each built a HomeTop the same day (both kickoffs claimed one already existed;
 * none did). This file is the RECONCILED single implementation; the two 1.6.0 tarballs that
 * carry the divergent parents are stamped superseded. What survived from each, and why:
 *   · Composer, TWO shared variants, chosen by PROP (not by product — no per-product branches):
 *     pass `composerLabel` and you get the single-strip composer ("Host an event…" — Event,
 *     Agent); omit it and you get the four-action row (Video · Photo · Write · Go Live — Social,
 *     Score), which routes to the centre action with `?mode=` so the centre screen decides what
 *     each mode means. Both are one shared control; an app picks a variant, never a new design.
 *   · Default destination derives from the CONFIG's raised centre tab (Thread A) — Thread B's
 *     hard-coded `/post` default sent OneEvent's composer to a route that doesn't exist there.
 *   · Active pill wears Selection ink (`bg-ink`, inverted on dark) — the exact idiom
 *     MessagesScreen's filter row already ships. Thread B's teal ran white-on-teal at ~2:1 and
 *     teal is the STATE colour, not the chosen-thing colour.
 *   · Strings come from `shellCopy` in ALL SEVEN languages (Thread A) — `W()` covers only en/es.
 *   · The head renders while signed out (Thread B) — compose actions disable rather than the
 *     whole strip vanishing, so the top of home never flickers on session load.
 */
export default function HomeTop({
  product,
  feedSlot,
  pills,
  activePill,
  activePills,
  onPill,
  onSearch,
  composeTo,
  composerLabel,
  noComposer = false,
  pillsTrailing,
  title,
  titleRight,
  searchAside,
  searchSlot,
}: {
  product: AppKey;
  /** The app's own feed, rendered under the shared head. */
  feedSlot: ReactNode;
  /** Feed facet pills — labels arrive ALREADY translated by the app's own dictionary. */
  pills?: { key: string; label: string }[];
  activePill?: string;
  /** Multi-select mode (Lee, 9 Aug — "I want YouTube AND Instagram"): pass the active SET and
   *  the app toggles membership in onPill. Wins over activePill when both are given. */
  activePills?: string[];
  onPill?: (key: string) => void;
  /** Live search hook — the app filters its own feed. Absent = navigate on submit. */
  onSearch?: (q: string) => void;
  /**
   * A control that shares the search row, taking 30% of it — Lee, 12 Aug 2026:
   *
   *   *"You need a way to search by location right there on the feed. Split the search bar —
   *   seventy percent for the search and thirty percent for the location dropdown."*
   *
   * WHY A SLOT AND NOT A LOCATION PROP. "Location" means a Colombian barrio on OneHome and would
   * mean something else entirely on OneJob or OneEvent; the shell has no business knowing what.
   * What the shell DOES own is the geometry, and the geometry is the part that was wrong when
   * each product invented its own row.
   *
   * 60/40 as of 13 Aug 2026. It shipped at 70/30 and Lee measured it by eye the same day:
   * *"it's still not enough room for a location there… I would make the search bar just a little
   * shorter."* The numbers agree with him. On a 390px screen 70/30 gave the aside 97px, which
   * truncates almost every Medellín barrio ("Anywhe⌄"); 60/40 gives it about 140px, which fits
   * "El Poblado" and a chevron. The search box drops to ~210px and stays above the ~180px floor
   * OneJob's SearchBar established as the point where a text input stops being usable.
   */
  searchAside?: ReactNode;
  /** Where the composer routes. Defaults to the product's raised centre action. */
  composeTo?: string;
  /** App-translated single-strip sentence ("Host an event…"). Omit → four-action composer. */
  composerLabel?: string;
  /* ── A FEED YOU SEARCH IS NOT A FEED YOU POST TO (Lee, 11 Aug 2026) ────────────────────────
     *"On the feed page there's a section at the top right under the search that says List a
     place. That needs to go away — it just doesn't belong there at all."*

     Omitting `composerLabel` was not enough: it falls through to the FOUR-ACTION composer, which
     on OneHome's search feed is worse — Video / Photo / Write / Go live, over a list of flats.
     There has to be a way to say "no composer", explicitly, and this is it. Default `false`, so
     the five products that post keep both variants exactly as they are. */
  noComposer?: boolean;
  /** App slot at the END of the pills row (a view toggle, a sort control) — one row, no
      wasted vertical space (Lee, 8 Aug 2026). */
  pillsTrailing?: ReactNode;
  /**
   * OVERRIDE THE SCREEN TITLE. Almost nothing should.
   *
   * Every app's first tab is a feed of things somebody else put there, so the shared title is
   * "Discover" in the member's own language — see `lib/screenTitles.ts`. A product passing its
   * own word here is re-opening exactly the drift Lee asked to close, so this exists for one
   * reason only: a screen that is genuinely NOT a discover feed but still wants this head.
   */
  title?: ReactNode;
  /** A control that belongs beside the VAIA pill on the title row. Rare. */
  titleRight?: ReactNode;
  /**
   * REPLACE the search row outright — Lee, 16 August 2026: *"the search needs to be laid out as
   * where, when, who."*
   *
   * Supply this and the free-text box and its 60/40 aside are not rendered at all; omit it and
   * every product that has one today renders byte-identically to before. It is an option, never
   * a migration — five products still want a box you type into, and a triad would be worse for
   * every one of them.
   *
   * WHY REPLACE RATHER THAN SIT BESIDE. Two searches on one screen is two answers to "where do I
   * type", and the reader has to work out which one the feed is listening to. The shell keeps
   * owning the geometry of the row; what stands in it is the product's decision.
   */
  searchSlot?: ReactNode;
}) {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [q, setQ] = useState("");

  /* Derived from the config, never hard-coded (render.cjs's lesson — and Thread B's `/post`
     default was exactly this bug for three of the five apps). */
  const centre = CONFIGS[product].tabs.find(t => t.primary)?.to ?? CONFIGS[product].tabs[0].to;
  const base = composeTo ?? centre;
  const compose = (mode: "video" | "photo" | "write" | "live") =>
    nav(`${base}${base.includes("?") ? "&" : "?"}mode=${mode}`);

  const ACTIONS: { mode: "video" | "photo" | "write" | "live"; label: string; icon: ReactNode; tone: string }[] = [
    /* `tone` is the icon's colour and nothing else's — the identity hue never carries text. */
    { mode: "video", label: sc(lang, "composeVideo"), icon: <IconVideo size={17} />, tone: "text-brand dark:text-brand-light" },
    { mode: "photo", label: sc(lang, "composePhoto"), icon: <IconPhoto size={17} />, tone: "text-teal" },
    { mode: "write", label: sc(lang, "composeWrite"), icon: <IconWrite size={17} />, tone: "text-ink/70 dark:text-white/70" },
    /* Going live is the loud one — a red dot is the universal recording idiom and needs no
       reading at all. It is the one action that is not reversible once people are watching. */
    { mode: "live", label: sc(lang, "composeLive"), icon: <IconLive size={17} />, tone: "text-red-500" },
  ];

  return (
    <div className="space-y-3">
      {/* ── THE TITLE ROW. Shell-owned, present on EVERY app's home tab. ────────────────────
          Lee, 10 Aug 2026, from live screenshots: the home tabs had no heading at all, so
          `AppShell` fell back to rendering the VAIA pill as its own full-width row above the
          search box — which is the "misaligned, in their own different rows" he reported. A
          `ScreenHeading` here CLAIMS the pill (see ScreenHeading's slot context), so the shell
          stands its standalone row down and the title and VAIA end up on one row, the same row,
          in every product. Fixed once, in the shell, rather than five times in five feeds. */}
      <ScreenHeading right={titleRight}>{title ?? screenTitle(lang, "discover")}</ScreenHeading>

      {/* Search — one control, every app; 70/30 with an aside when the product supplies one. */}
      {searchSlot ?? (
        <div className={searchAside ? "flex items-stretch gap-2" : undefined}>
        <label className={`flex items-center gap-2 rounded-2xl border border-ink/10 bg-white/70 px-3 py-2.5 dark:border-white/15 dark:bg-white/10 ${
          searchAside ? "min-w-0 flex-[6]" : ""}`}>
          <IconSearch size={18} className="shrink-0 opacity-50" />
          <input
            type="search"
            value={q}
            onChange={e => { setQ(e.target.value); onSearch?.(e.target.value); }}
            onKeyDown={e => { if (e.key === "Enter" && !onSearch) nav(productHref(product, `/?q=${encodeURIComponent(q)}`)); }}
            placeholder={sc(lang, "searchPh")}
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:opacity-50"
            aria-label={sc(lang, "searchPh")}
          />
        </label>
        {searchAside && <div className="min-w-0 flex-[4]">{searchAside}</div>}
      </div>
      )}

      {/* Composer — one of the two shared variants, or none at all. */}
      {noComposer ? null : composerLabel ? (
        /* Same box as the search field — same radius, same padding, same height. The avatar
           initial that used to sit here read as a mystery letter ("L"?) on Lee's review; a
           quiet brand plus says "start something" without needing decoding. */
        <Link to={base}
              className="ow-tap flex items-center gap-2 rounded-2xl border border-ink/10 bg-white/70 px-3 py-2.5 dark:border-white/15 dark:bg-white/10">
          <IconPlus size={18} className="shrink-0 text-brand dark:text-brand-light" />
          <span className="ow-fade text-sm opacity-60">{composerLabel}</span>
        </Link>
      ) : (
        /* ── THE COMPOSER STRIP (Lee, 10 Aug 2026) ──────────────────────────────────────────
           *"Remove the avatar taking up space, use coloured icons, make it more polished."*

           THE AVATAR IS GONE. It cost 38px plus a gap on the narrowest screen we support, and it
           bought nothing: you already know what you look like, and on a profileless account it
           rendered a bare initial that reads as a mystery letter (the same note Lee made about
           the single-strip variant, which lost its avatar for the same reason).

           COLOURED ICONS, ONE PER ACTION, and the colours are not decoration — they are how you
           tell three same-shaped pills apart at a glance without reading: video = the product
           hue, photo = teal (the shared STATE colour), write = ink. Going live is the loud one
           and gets a red dot, the universal recording idiom.

           The colour lives on the ICON only. Per the colour rules the identity hue never carries
           text, so the labels stay ink and the pills stay neutral — which is also what keeps the
           row from looking like a toy. */
        <div className="card flex items-center gap-2 p-2.5">
          {ACTIONS.map(a => (
            <button
              key={a.mode}
              onClick={() => compose(a.mode)}
              disabled={!userId}
              className="ow-tap flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink/[0.07] bg-white/50 px-2 py-2 text-[12.5px] font-bold transition hover:bg-brand/5 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <span className={a.tone}>{a.icon}</span>
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter pills — active = Selection ink, the shared chosen-thing idiom (MessagesScreen). */}
      {(!!pills?.length || pillsTrailing) && (
        <div className="flex items-center gap-2 pb-1">
          <div className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto" role="tablist">
          {(pills ?? []).map(pl => {
            const active = activePills ? activePills.includes(pl.key) : pl.key === activePill;
            return (
              <button
                key={pl.key}
                role="tab"
                aria-selected={active}
                onClick={() => onPill?.(pl.key)}
                className={`ow-tap shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${
                  active
                    ? "ow-ink-sel"
                    : "border border-ink/10 dark:border-white/15"
                }`}
              >
                {pl.label}
              </button>
            );
          })}
          </div>
          {pillsTrailing && <div className="shrink-0">{pillsTrailing}</div>}
        </div>
      )}

      {feedSlot}
    </div>
  );
}
