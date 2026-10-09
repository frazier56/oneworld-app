import { useEffect, useRef, useState } from "react";
import { W } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import PlatformMark from "./PlatformMark";
import { createPortal } from "react-dom";
import { rollUp, compact } from "../lib/socialMetrics";
import type { PlatformSnapshot, SocialTotals } from "../lib/socialMetrics";

/**
 * SOCIAL MEDIA — everything this person posts, everywhere, in one section (SHELL).
 * ============================================================================================
 * Replaces `MediaWall` + `ConnectedPlatforms` on the profile. Lee, 8 Oct 2026:
 *
 *   *"It should say social media… it shows connected media and connected apps, it shows all of
 *   it here. So you can filter on OneSocial stuff and Twitter stuff. Right. I want to see all of
 *   it. You can say all."*
 *
 * It sits LAST on the profile, below websites and reviews, so it can run on as long as it likes:
 *   *"do we move the media to the end? That way people can just scroll, scroll, scroll… you get
 *   to the websites and the reviews ahead of time."*
 *
 * ── FOUR THINGS THE LIVE DATA FORCES, three of which a naive port gets wrong ────────────────
 *
 * 1. ⚠️ THE PLATFORM IS IN `source`, NOT `source_platform`. Both columns exist. Measured on the
 *    live project 8 Oct 2026: `source_platform` is NULL on every one of the founder's 33 posts,
 *    while `source` carries `upload`, `tiktok`, `twitter`, `linkedin`, `native`, `instagram`,
 *    `wavespeed`, `seed`, `portfolio`, `onesocial`. A filter keyed on `source_platform` returns
 *    nothing and looks exactly like "no posts yet" — the same defect class as the media wall
 *    reading `media_items`, a table that never existed.
 *
 * 2. CONNECTED IS NOT POPULATED. The founder has ONE connection (Instagram) with ZERO posts, and
 *    five TikTok videos with NO connection row. Chips built from `social_connections` alone hide
 *    the content he has; chips built from `media_posts` alone make a connected account vanish.
 *    So the chips are the UNION, and a connected-but-empty app says so in words rather than
 *    rendering an empty grid with no explanation.
 *
 * 3. TEXT POSTS ARE REAL POSTS. `MediaWall` dropped `media_type = 'text'` because a paragraph
 *    paints a grey square in a picture grid. That silently hid three real LinkedIn posts. Lee:
 *    *"media needs to be with media, and text needs to be together, but not combined."* So they
 *    are two tabs of ONE section — never mixed into the grid, never a second card.
 *
 * 4. `media_type` IS MIXED CASE on the live rows (`image`, `PHOTO`, `video`, `VIDEO`, `text`) —
 *    imported rows shout, native ones do not. Every comparison is lower-cased.
 *
 * `moderation_status = 'visible'` is filtered because this renders on PUBLIC profiles. Showing a
 * stranger something moderation has held is worse than showing nothing.
 */

/** Sources that are the person's OWN posting, not an imported platform. */
const OWN: Record<string, true> = {
  upload: true, native: true, seed: true, wavespeed: true, portfolio: true, onesocial: true,
};
/** `source` / `platform` values that mean the same platform. */
const ALIAS: Record<string, string> = { x: "twitter" };

const LABEL: Record<string, string> = {
  onesocial: "OneSocial", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube",
  facebook: "Facebook", twitter: "X", linkedin: "LinkedIn", twitch: "Twitch",
};
/** The order a person reads them in, matching OneSocial's own connect screen. */
const ORDER = ["onesocial", "instagram", "tiktok", "youtube", "facebook", "twitter", "linkedin", "twitch"];

const norm = (s: string | null | undefined) => {
  const k = (s ?? "").toLowerCase().trim();
  if (!k) return "onesocial";
  if (OWN[k]) return "onesocial";
  return ALIAS[k] ?? k;
};
const name = (k: string) => LABEL[k] ?? (k.charAt(0).toUpperCase() + k.slice(1));

type Post = {
  id: string; media_url: string | null; thumbnail_url: string | null; media_type: string | null;
  caption: string | null; likes_count: number | null; comments_count: number | null;
  source: string | null; source_post_url: string | null; created_at: string;
};
type Row = Post & { plat: string; kind: string; likes: number };

const ROWS_PER_PAGE = 3;
const COLS: Record<number, number> = { 1: 1, 2: 2, 3: 3 };

export default function ProfileSocialMedia({ userId, editable = false, onUpload, onConnect }: {
  userId: string;
  /** The owner's own profile. Shows connected-but-empty apps and the Connect chip. */
  editable?: boolean;
  /** Supplied only by a product that really has an uploader — hidden, not disabled, otherwise. */
  onUpload?: () => void;
  /** Supplied only where a connect screen exists. Same rule. */
  onConnect?: () => void;
}) {
  const { lang } = useI18n();
  const [kind, setKind] = useState<"media" | "text">("media");
  const [view, setView] = useState(3);
  const [sort, setSort] = useState<"recent" | "likes" | "app">("recent");
  const [sel, setSel] = useState<string[]>([]);
  const [pages, setPages] = useState(1);

  const posts = useAsync(async () => {
    const { data, error } = await supabase.from("media_posts")
      /* Columns named, never select('*') — column grants are on and the star throws 42501. */
      .select("id, media_url, thumbnail_url, media_type, caption, likes_count, comments_count, source, source_post_url, created_at")
      .eq("user_id", userId)
      .eq("moderation_status", "visible")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { console.error("[ProfileSocialMedia] media_posts read failed:", error.message); throw error; }
    return (data ?? []) as Post[];
  }, [userId], !!userId);

  /* The accounts they have actually connected — the other half of the chip row. */
  const conns = useAsync(async () => {
    const { data, error } = await supabase.from("social_connections_public")
      .select("platform, username, is_verified").eq("user_id", userId).eq("is_active", true);
    if (error) { console.error("[ProfileSocialMedia] connections read failed:", error.message); return []; }
    return (data ?? []) as { platform: string; username: string | null; is_verified: boolean | null }[];
  }, [userId], !!userId);

  /* ── THE FOUR NUMBERS AT THE TOP ────────────────────────────────────────────────────────
     Lee, 9 Oct 2026: *"at the header we need to show cross-platform metrics — total followers,
     total likes, total comments, and engagement percent… and at the subset it should show, on
     Instagram you got this many followers, on TikTok you got this many, so people can see what
     the breakdown is."*

     `social_snapshots` has carried followers, posts, likes, comments, shares and saves since
     August, and `ConnectedPlatforms` only ever displayed the first three. Nothing new is
     stored here — two columns that already existed stop being invisible. */
  const snaps = useAsync(async () => {
    const { data: cs, error } = await supabase.from("social_connections_public")
      .select("id, platform, username, is_verified").eq("user_id", userId!).eq("is_active", true);
    if (error || !cs?.length) return [] as PlatformSnapshot[];
    const out: PlatformSnapshot[] = [];
    for (const c of cs as { id: string; platform: string; username: string | null; is_verified: boolean | null }[]) {
      const { data: snap } = await supabase.from("social_snapshots")
        .select("followers, total_posts, total_likes, total_comments")
        .eq("connection_id", c.id).order("captured_at", { ascending: false }).limit(1).maybeSingle();
      const r = (snap ?? null) as { followers: number | null; total_posts: number | null; total_likes: number | null; total_comments: number | null } | null;
      if (!r) continue;
      out.push({
        platform: norm(c.platform), username: c.username, verified: !!c.is_verified,
        followers: r.followers ?? 0, posts: r.total_posts ?? 0,
        likes: r.total_likes ?? 0, comments: r.total_comments ?? 0,
      });
    }
    return out;
  }, [userId], !!userId);

  const all: Row[] = (posts ?? []).map(p => ({
    ...p,
    plat: norm(p.source),
    kind: (p.media_type ?? "").toLowerCase(),
    likes: p.likes_count ?? 0,
  }));

  const isText = (r: Row) => r.kind === "text";
  const hasPicture = (r: Row) => !!(r.thumbnail_url || r.media_url);
  /* A non-text row with no image is not a written post either — it is a broken row, and it
     belongs in neither tab rather than painting a grey square in one of them. */
  const pool = all.filter(r => kind === "text" ? isText(r) : (!isText(r) && hasPicture(r)));

  /* ⚠️ TWO COUNTS, AND THEY ARE NOT THE SAME COUNT. Found by rendering revision 4 against a
     person whose LinkedIn posts are all WRITTEN — which is Lee's own account: three LinkedIn
     paragraphs and no LinkedIn photograph.

     The first version derived the chip row from `pool`, and `pool` is whichever tab you are
     standing on. So on Photos the LinkedIn chip did not exist at all, and the chip row — which
     IS the connected-apps list — answered "which of my accounts are connected?" differently
     depending on a tab that has nothing to do with the question. An app would appear and vanish
     as the person switched between Photos and Written.

     So: WHICH apps come from everything the person has (`all`) plus everything they have
     connected, and never change. HOW MANY is the number in the view they are looking at, and
     reads "—" when this tab has none of that app. */
  const counts: Record<string, number> = {};
  for (const r of pool) counts[r.plat] = (counts[r.plat] ?? 0) + 1;

  const everywhere: Record<string, number> = {};
  for (const r of all) everywhere[r.plat] = (everywhere[r.plat] ?? 0) + 1;
  const connected = new Set((conns ?? []).map(c => norm(c.platform)));
  for (const k of connected) if (!(k in everywhere)) everywhere[k] = 0;
  for (const k of Object.keys(everywhere)) if (!(k in counts)) counts[k] = 0;

  const keys = ORDER.filter(k => k in everywhere)
    .concat(Object.keys(everywhere).filter(k => !ORDER.includes(k)).sort())
    /* A visitor is never shown an app with nothing in it ANYWHERE — there is nothing they can do
       about it, and an empty chip on someone else's profile reads as a fault. The owner IS shown
       it, because they are the only person who can fix it. */
    .filter(k => editable || everywhere[k] > 0);

  const chosen = sel.filter(k => keys.includes(k));
  let list = pool.filter(r => keys.includes(r.plat) && (chosen.length === 0 || chosen.includes(r.plat)));

  if (sort === "likes" && kind !== "text") list = [...list].sort((a, b) => b.likes - a.likes);
  else if (sort === "app") list = [...list].sort((a, b) =>
    (ORDER.indexOf(a.plat) - ORDER.indexOf(b.plat)) || (a.created_at < b.created_at ? 1 : -1));
  /* "recent" needs no sort — the query already returned newest first. */

  const per = (kind === "text" ? 2 : COLS[view]) * ROWS_PER_PAGE;
  const shown = list.slice(0, per * pages);
  const more = shown.length < list.length;

  /* Loads itself as the bottom comes into view, three rows at a time. Lee: *"it should load
     periodically, three rows at a time, and then people scroll, it loads more, kind of like how
     Instagram does their search — it doesn't put all a thousand pictures on the screen at once."*

     ⚠️ THE CAP IS THE POINT, AND IT WAS FOUND BY LOOKING, NOT BY READING. Rendered at 390 pixels
     against 30 posts, the first version loaded ALL of them in one go: every time a page was added
     the new sentinel was still inside the viewport, so it fired again immediately and cascaded
     until the list ran out. On a tall screen that is invisible; on a person with 500 posts it is
     exactly the thousand pictures at once Lee ruled out.

     So automatic loading stops after AUTO_PAGES and the sentinel becomes a real button. The
     button is therefore not only the no-observer fallback — it is the floor under a runaway. */
  /* Which item is open full screen, as an index into what is currently on the grid. Null is
     closed. An index rather than an id so the viewer can walk left and right from it. */
  const [opened, setOpened] = useState<number | null>(null);

  const AUTO_PAGES = 4;
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!more || pages >= AUTO_PAGES) return;
    if (!sentinel.current || typeof IntersectionObserver === "undefined") return;
    const el = sentinel.current;
    const io = new IntersectionObserver(e => { if (e[0].isIntersecting) setPages(p => p + 1); },
      { rootMargin: "160px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, pages, shown.length]);

  /* Any change of what is being looked at starts again at the first page — otherwise the person
     is left staring at page four of a list they did not ask for. */
  const reset = () => setPages(1);

  const toggle = (k: string) => { setSel(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]); reset(); };

  const total = pool.filter(r => keys.includes(r.plat)).length;
  const live = keys.filter(k => counts[k] > 0);
  const who = chosen.length === 0
    ? (live.length === 1 ? name(live[0]) : W(lang, `all ${live.length} apps`, `las ${live.length} apps`))
    : chosen.map(name).join(" · ");

  return (
    <section id="ow-social" className="card p-4">
      <div className="mb-0.5 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate font-bold">{W(lang, "Social media", "Redes sociales")}</h2>

        {/* The three widths. Meaningless for written posts, so it is not drawn there at all —
            hidden, not disabled. */}
        {kind === "media" && (
          <div className="flex shrink-0 gap-0.5 rounded-xl border border-ink/8 bg-ink/[0.03] p-0.5 dark:border-white/10 dark:bg-white/[0.04]"
            role="group" aria-label={W(lang, "View", "Vista")}>
            {[1, 2, 3].map(v => (
              <button key={v} type="button" onClick={() => { setView(v); reset(); }} aria-pressed={view === v}
                title={v === 1 ? W(lang, "One at a time", "Uno a la vez")
                  : v === 2 ? W(lang, "Two across", "Dos por fila") : W(lang, "Three across", "Tres por fila")}
                className={`ow-tap grid h-7 w-7 place-items-center rounded-lg ${view === v
                  ? "bg-white text-ink shadow-sm dark:bg-white/15 dark:text-white" : "opacity-45"}`}>
                <ViewGlyph n={v} />
              </button>
            ))}
          </div>
        )}

        {editable && onUpload && (
          <button type="button" onClick={onUpload}
            className="ow-tap shrink-0 rounded-xl border border-brand/40 bg-brand/5 px-3 py-1.5 text-[12px] font-semibold text-brand">
            {W(lang, "＋ Upload", "＋ Subir")}
          </button>
        )}
      </div>

      <p className="mb-2.5 text-[11.5px] font-semibold opacity-55">
        {total === 0
          ? W(lang, "Nothing here yet.", "Nada todavía.")
          : `${list.length} ${kind === "text"
            ? W(lang, "written", "escritos") : W(lang, "posts", "publicaciones")} · ${who}`}
      </p>

      {/* ── THE HEADER NUMBERS ─────────────────────────────────────────────────────────────
             Four numbers that describe the whole person, above the grid that describes one post
             at a time — and THE CHIPS ARE THE CONTROL FOR THEM. Lee, 9 Oct 2026: *"if you select
             Instagram and Facebook, the metrics at the top would just be filtered based on
             whatever icons you select. If you only select Instagram, you'll see only
             Instagram."*

             That is one gesture doing two jobs instead of two controls doing one each, and it is
             why the per-app breakdown list underneath is gone: the person can already see any
             app's numbers by tapping its logo. */}
      <SocialKPIs rows={(snaps ?? []).filter(r => chosen.length === 0 || chosen.includes(r.platform))}
        lang={lang} />

      {/* Photos / written. Only drawn when the person actually has both kinds — a tab that
          leads to an empty list is a promise the screen cannot keep. */}
      {all.some(isText) && all.some(r => !isText(r) && hasPicture(r)) && (
        <div className="mb-2.5 flex gap-0.5 rounded-full border border-ink/8 bg-ink/[0.03] p-0.5 dark:border-white/10 dark:bg-white/[0.04]"
          role="group" aria-label={W(lang, "Kind", "Tipo")}>
          {(["media", "text"] as const).map(k => (
            <button key={k} type="button" aria-pressed={kind === k}
              onClick={() => { setKind(k); setSel([]); setPages(1); if (k === "text" && sort === "likes") setSort("recent"); }}
              className={`ow-tap flex-1 rounded-full py-1.5 text-[12px] font-bold ${kind === k
                ? "bg-white text-ink shadow-sm dark:bg-white/15 dark:text-white" : "opacity-55"}`}>
              {k === "media" ? W(lang, "Photos & video", "Fotos y video") : W(lang, "Written posts", "Publicaciones escritas")}
            </button>
          ))}
        </div>
      )}

      {/* ── The chips ARE the connected-apps list ─────────────────────────────────────────────
             `ConnectedPlatforms` used to be a second card saying the same thing. Lee has had the
             two-sections-saying-one-thing fault on this page before (11 Aug, the duplicated media
             grid); this is the same rule applied again. */}
      {/* ⚠️ NO PERMANENT "ALL" CHIP, AND CONNECT IS A PLUS. Measured, not guessed: six logo
             tiles plus a worded All plus a worded Connect came to 458 pixels against the 334 a
             phone gives this row, so two of them were still off the right edge — the exact fault
             the logos were meant to cure, two thirds cured.

             "All" is not a filter, it is the absence of one, so it only needs to exist once
             there is something to clear — and then it is the one control the person is looking
             for, at the front where their thumb already is. Connect is a plus, like every other
             add button in the app.

             Resting state is now seven tiles and 330 pixels: **the whole connected-apps list,
             visible, with nothing to scroll.** */}
      {keys.length > 0 && (
        <div className="ow-scroll -mx-1 mb-2 flex items-center gap-1 overflow-x-auto px-1 py-1.5">
          {chosen.length > 0 && (
            <Chip on={false} onClick={() => { setSel([]); reset(); }}
              label={W(lang, "All", "Todas")} count={total} />
          )}
          {keys.map(k => (
            <Chip key={k} on={chosen.includes(k)} onClick={() => toggle(k)}
              label={name(k)} count={counts[k]} platform={k} iconOnly
              quiet={chosen.length > 0 && !chosen.includes(k)} />
          ))}
          {editable && onConnect && (
            <button type="button" onClick={onConnect} title={W(lang, "Connect an account", "Conectar una cuenta")}
              aria-label={W(lang, "Connect an account", "Conectar una cuenta")}
              className="ow-tap grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[13px] border border-dashed border-ink/25 text-ink/50 dark:border-white/25 dark:text-white/50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          )}
        </div>
      )}

      {/* Sort, inline. Lee asked whether it needed a pop-up and answered it himself: *"if you
          could just click them right here on the screen without having a pop-up box, that would
          probably be best."* Three choices fit on one row at 390 pixels, so no box opens. */}
      {list.length > 1 && (
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-wide opacity-40">
            {W(lang, "Sort", "Orden")}
          </span>
          <div className="flex min-w-0 flex-1 gap-0.5 rounded-full border border-ink/8 bg-ink/[0.03] p-0.5 dark:border-white/10 dark:bg-white/[0.04]">
            {([["recent", W(lang, "Newest", "Recientes")],
               ...(kind === "text" ? [] : [["likes", W(lang, "Most liked", "Más gustadas")] as const]),
               ["app", W(lang, "By app", "Por app")]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={sort === k}
                onClick={() => { setSort(k as typeof sort); reset(); }}
                className={`ow-tap min-w-0 flex-1 truncate rounded-full py-1 text-[11.5px] font-bold ${sort === k
                  ? "bg-white text-ink shadow-sm dark:bg-white/15 dark:text-white" : "opacity-55"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty lang={lang} only={chosen.length === 1 ? chosen[0] : null}
          connectedEmpty={chosen.length === 1 && counts[chosen[0]] === 0} />
      ) : kind === "text" ? (
        <div className="space-y-2">
          {shown.map(r => (
            <article key={r.id} className="rounded-xl border border-ink/8 bg-ink/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[9.5px] font-bold uppercase tracking-wide opacity-50">{name(r.plat)}</p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed">{r.caption}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className={`grid gap-1.5 ${view === 1 ? "grid-cols-1" : view === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {shown.map((r, i) => (
            <Tile key={r.id} r={r} withCaption={view === 1} onOpen={() => setOpened(i)} />
          ))}
        </div>
      )}

      {/* Full screen, swipe left and right. Mounted last so it sits over everything. */}
      {opened !== null && shown[opened] && (
        <MediaViewer items={shown} start={opened} lang={lang} onClose={() => setOpened(null)} />
      )}

      {more && (
        <div ref={sentinel} className="pt-3 text-center">
          {pages < AUTO_PAGES ? (
            <span className="text-[11.5px] font-bold opacity-45">
              {W(lang, "Loading more…", "Cargando más…")}
            </span>
          ) : (
            /* Past the cap the person asks for the next pages themselves, so a long library never
               paints itself onto one screen. */
            <button type="button" onClick={() => setPages(p => p + 1)}
              className="ow-tap w-full rounded-xl border border-ink/10 py-2.5 text-[12.5px] font-bold dark:border-white/12">
              {W(lang, `Show more · ${list.length - shown.length} left`,
                       `Ver más · faltan ${list.length - shown.length}`)}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** PUB30 (TESTING OS4 P0-5): an imported post's link is user data. Only a parsed https URL with
 *  no credentials becomes a link; anything else (javascript:, data:, http:, junk) renders as a plain tile. */
function safeHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.href;
  } catch { return null; }
}

function ViewGlyph({ n }: { n: number }) {
  if (n === 1) return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>;
  if (n === 2) return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="8" height="16" rx="1.5" /><rect x="13" y="4" width="8" height="16" rx="1.5" /></svg>;
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="4" width="5.6" height="16" rx="1.3" /><rect x="9.2" y="4" width="5.6" height="16" rx="1.3" /><rect x="15.9" y="4" width="5.6" height="16" rx="1.3" /></svg>;
}

/**
 * ⚠️ SELECTING A LOGO TAKES THE PANE AWAY AND MAKES THE LOGO BIGGER.
 *
 * Lee, 9 Oct 2026, on the version before this: *"if you select it, the border goes away — the
 * whole little white thing it's on kind of goes away. I want to say it needs to enlarge itself
 * a little bit. But if you select Instagram and TikTok they're next to each other, they're
 * going to crash into each other. So maybe the ones that are deselected get smaller while the
 * ones that are selected get bigger, to allow room horizontally."*
 *
 * That is the whole rule, and it is better than a ring for a reason worth writing down: a ring
 * is a decoration added to say "chosen", while **growing is the thing itself becoming more
 * important.** Nothing is added to the screen, so nothing can collide with anything, and the
 * row stays legible at a glance from across a desk.
 *
 * ── THE SIZES, AND WHY THE ROW CANNOT BURST ────────────────────────────────────────────────
 *   nothing chosen   every tile 42, logo 28, on glass
 *   something chosen chosen 46, logo 34, NO glass at all — bare, full strength
 *                    the rest 34, logo 22, on glass, at 55 percent
 * The others shrinking pays for the chosen one growing, so two selected still fits where seven
 * resting tiles fit. He predicted the collision before it happened; this is the arithmetic that
 * makes it impossible.
 *
 * ── AND THE ROW HAS VERTICAL ROOM NOW ──────────────────────────────────────────────────────
 * Lee: *"in the screenshot you have Instagram selected, but vertically it's cut off — the
 * border is cut off at the top."* He was right: the row had half a pixel of bottom padding and
 * none at the top, so the moment a tile grew it was clipped by its own scroll container. The
 * row is `py-1.5` and `items-center`, which is room for the largest tile at either size.
 *
 * The name still reaches a screen reader through `aria-label` and a long press through `title`.
 * "All" keeps its word and **lost its dot** — Lee: *"that doesn't need to have a dot next to it,
 * it's just taking up more horizontal space unnecessarily."*
 */
function Chip({ on, onClick, label, count, platform, iconOnly, quiet }: {
  on: boolean; onClick: () => void; label: string; count: number;
  platform?: string; iconOnly?: boolean;
  /** Something else is selected, so this one steps back and makes room. */
  quiet?: boolean;
}) {
  const empty = count === 0 ? "opacity-40" : "";
  const glass = "bg-white/55 ring-1 ring-ink/[0.06] shadow-[0_1px_2px_rgba(0,0,0,.05)] dark:bg-white/[0.07] dark:ring-white/[0.08]";

  if (iconOnly && platform) {
    const box = on ? 46 : quiet ? 34 : 42;
    const glyph = on ? 34 : quiet ? 22 : 28;
    return (
      <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} title={label}
        style={{ width: box, height: box }}
        className={`ow-tap grid shrink-0 place-items-center rounded-[14px] transition-all duration-150
          ${on ? "" : `${glass} backdrop-blur-[3px]`} ${quiet ? "opacity-55" : ""} ${empty}`}>
        <PlatformMark name={platform} size={glyph} onChip={false} />
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`ow-tap flex h-[38px] shrink-0 items-center whitespace-nowrap rounded-[13px] px-3 text-[12.5px] font-bold backdrop-blur-[3px] transition ${glass}`}>
      {label}
    </button>
  );
}

function Tile({ r, withCaption, onOpen }: { r: Row; withCaption: boolean; onOpen: () => void }) {
  const img = (
    <div className={`relative overflow-hidden rounded-lg bg-ink/5 dark:bg-white/5 ${withCaption ? "aspect-[4/5]" : "aspect-square"}`}>
      {/* PUB30, batch 137: a missing or dead file shows the plain tile, never the browser's
          broken-image glyph with the caption printed over it (seen at 390 px on two of Lee's posts). */}
      {(r.thumbnail_url || r.media_url) && (
        <img decoding="async" loading="lazy" alt=""
          src={r.thumbnail_url || r.media_url || ""} className="h-full w-full object-cover"
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
      )}
      {/* WHERE THIS CAME FROM — and only when it came from somewhere else.
             A badge on the person's OWN OneSocial post answers a question nobody asked: the whole
             profile is OneSocial. Worse, `onesocial` is not a key in the icon map, so those posts
             were being badged with the GLOBE — the mark the map uses for "unrecognised". On this
             account that painted 22 globes across the grid, which is most of what Lee was looking
             at when he said the icon was hard to read. Imported posts get the mark; ours get air. */}
      {r.plat !== "onesocial" && (
        <PlatformMark name={r.plat} size={13} className="absolute left-1.5 top-1.5" />
      )}
      {r.likes > 0 && (
        <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.7)]">
          ♥ {r.likes >= 1000 ? `${(r.likes / 1000).toFixed(1)}K` : r.likes}
        </span>
      )}
      {r.kind === "video" && (
        <span className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/50 text-white">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
      )}
    </div>
  );

  /* ⚠️ TAPPING A TILE OPENS THE PICTURE, IT DOES NOT LEAVE THE APP. Lee, 9 Oct 2026: *"you
     should be able to select the pictures and they should become full screen — or if it's a
     video, full screen — and you should be able to swipe left and right between the pictures."*

     It used to be a link straight out to Instagram. That is the wrong default twice over: a tap
     on a photograph should show the photograph, and sending somebody to another app from the
     grid is the one thing a profile that exists to hold their work should not do. The link to
     the original is still there, on the full-screen view, where it is a deliberate choice
     rather than the only thing a tap can do. */
  const body = (
    <button type="button" onClick={onOpen} className="block w-full text-left">{img}</button>
  );

  if (!withCaption) return body;
  return (
    <div>
      {body}
      {r.caption && <p className="px-0.5 pt-1.5 text-[12px] leading-snug">{r.caption}</p>}
      <p className="px-0.5 pt-1 text-[10.5px] font-semibold opacity-45">
        {name(r.plat)}{r.comments_count ? ` · 💬 ${r.comments_count}` : ""}
      </p>
    </div>
  );
}

function Empty({ lang, only, connectedEmpty }: { lang: string; only: string | null; connectedEmpty: boolean }) {
  /* A connected account with nothing in it is a TRUE and useful state, and saying so is the
     whole reason the chips are built from connections as well as posts. */
  if (connectedEmpty && only) return (
    <div className="py-6 text-center">
      <p className="text-[13px] font-bold">{name(only)} {W(lang, "is connected", "está conectada")}</p>
      <p className="mt-0.5 text-[12.5px] opacity-55">{W(lang, "Nothing has come across yet.", "Todavía no ha llegado nada.")}</p>
    </div>
  );
  return <p className="py-6 text-center text-[13px] opacity-55">{W(lang, "No posts yet.", "Aún no hay publicaciones.")}</p>;
}

/* ──────────────────────────────────────────────────────────────────────────────────────────
   THE FOUR NUMBERS — followers, likes, comments, engagement.

   Lee: *"we have to basically enhance the whole header section, but not make it too convoluted.
   Remember the Porsche Taycan — real simple looking, but complicated behind the scenes."*

   So the front is four tiles and nothing else. The breakdown by app, which he also asked for
   (*"on Instagram you got this many followers, on TikTok you got this many, so people can see
   what the breakdown is"*), is behind a tap on the tile rather than a second permanent block —
   four rows of per-app numbers sitting open above a photo grid is exactly the convolution he
   warned about, and nobody reads it until they want one specific figure.
   ────────────────────────────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────────────────────────
   THE FOUR NUMBERS — followers, likes, comments, engagement.

   Lee, 9 Oct 2026, on the first version of this: *"we're showing too much information. Remember
   the Taycan principle… you don't need this section where it's just listing your engagement per
   account. Take that section away. And the description underneath — that's correct, I like it,
   but you don't need to advertise it."*

   So what was three things is one thing. The per-app list is gone, the footnote explaining the
   weighting is gone, and the tiles do not take a tap any more — because **the chips already do
   that job.** Select Instagram and these four numbers are Instagram's. Select Instagram and
   Facebook and they are those two added together. Select nothing and they are everything. One
   control, one row of numbers, nothing to discover.

   What is left is what a stranger reads in two seconds: how big is this person's audience, and
   does that audience actually do anything.
   ────────────────────────────────────────────────────────────────────────────────────────── */

function SocialKPIs({ rows, lang }: { rows: PlatformSnapshot[]; lang: string }) {
  /* Nothing measured for this selection. Four zeros is a worse answer than no strip: zero means
     nobody engaged, and blank means we have not looked — on a credibility product those must
     never look the same. Selecting only OneSocial lands here, correctly: a person's own posts
     have no follower count to report. */
  if (!rows.length) return null;
  const t: SocialTotals = rollUp(rows);
  if (t.followers === 0 && t.likes === 0 && t.comments === 0) return null;

  const K = [
    { label: W(lang, "Followers", "Seguidores"), value: compact(t.followers) },
    { label: W(lang, "Likes", "Me gusta"), value: compact(t.likes) },
    { label: W(lang, "Comments", "Comentarios"), value: compact(t.comments) },
    { label: W(lang, "Engagement", "Interacción"),
      value: t.engagement == null ? "—" : `${t.engagement}%` },
  ];

  return (
    <div className="mb-2.5 grid grid-cols-4 gap-0.5 rounded-2xl border border-ink/8 bg-ink/[0.02] px-1 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      {K.map(x => (
        <div key={x.label} className="text-center">
          <p className="text-[15px] font-extrabold tabular-nums leading-none">{x.value}</p>
          {/* Not uppercase: caps are about fifteen percent wider, and "ENGAGEMENT" — longer
              still as "Interacción" — ran past its tile and had to be cut to "ENGAGEME…". */}
          <p className="mt-[5px] text-[9px] font-bold leading-none opacity-55">{x.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────────────────
   FULL SCREEN — one post at a time, swipe left and right.

   Lee, 9 Oct 2026: *"you should be able to select the pictures and they should become full
   screen, or if it's a video, full screen, and you should be able to swipe left and right
   between the pictures or photos as well."*

   ── WHY THIS IS A SCROLLER AND NOT A SWIPE HANDLER ───────────────────────────────────────
   No drag maths, no touch listeners, no animation library: it is one horizontally scrolling
   row with CSS scroll-snap, and the phone's own scrolling does the swiping. That means it
   arrives with momentum, rubber-banding at the ends and interruption mid-flick already
   correct — the three things hand-written swipe code always gets wrong — and it costs nothing
   on the main thread while the person is moving. Same reason the listing gallery's cover strip
   works that way.

   Two details that are not obvious:
   • The row is `overscroll-contain`, so flicking past the last photo does not start scrolling
     the profile underneath the viewer.
   • The video is NOT autoplayed. A full-screen video that starts talking the instant somebody
     taps a thumbnail, in public, with the sound on, is how people learn not to tap thumbnails.
   ────────────────────────────────────────────────────────────────────────────────────────── */

function MediaViewer({ items, start, lang, onClose }: {
  items: Row[]; start: number; lang: string; onClose: () => void;
}) {
  const strip = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(start);

  /* ⚠️ FULL SCREEN MEANS FULL SCREEN. Lee, 9 Oct 2026: *"if people click on photos and videos
     they should take up the full screen, unless there's a button that says show me original
     size of photo — that way you can get full screen if you want to."*

     The first version letterboxed everything: a tall phone photo in a tall phone window still
     left grey bars, because `object-contain` fits the WHOLE picture inside the frame whatever
     shape it is. Filling means cropping the overflowing edge, which is right for looking and
     wrong for judging, so both exist and the person says which — filling by default, because
     that is what tapping a photograph is for. */
  const [fill, setFill] = useState(true);

  /* Open on the one that was tapped. Jumped without animation — a viewer that opens on the
     first photo and then slides to the fourth tells the person they tapped the wrong thing. */
  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollTo({ left: el.clientWidth * start, behavior: "auto" });
  }, [start]);

  /* Escape closes, arrows walk. A phone never sends these; a laptop always does, and the
     profile is the same component on both. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      const el = strip.current;
      if (!el) return;
      if (e.key === "ArrowRight") el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
      if (e.key === "ArrowLeft") el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* The page behind must not scroll while this is open, or closing the viewer leaves the
     person somewhere they never scrolled to. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const r = items[at] ?? items[start];

  /* PUB30: portalled to <body>. Inside the glass card (backdrop-filter) a fixed layer is
     positioned against the card, not the screen, so the viewer opened off-screen. */
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black" role="dialog" aria-modal="true">
      <div ref={strip}
        onScroll={e => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== at) setAt(Math.max(0, Math.min(items.length - 1, i)));
        }}
        className="ow-scroll flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-contain">
        {items.map(it => (
          <div key={it.id} className="grid h-full w-full shrink-0 snap-center place-items-center overflow-hidden">
            {it.kind === "video" && it.media_url ? (
              <video src={it.media_url} poster={it.thumbnail_url ?? undefined} controls playsInline
                className={fill ? "h-full w-full object-cover" : "max-h-full max-w-full"} />
            ) : (
              <img src={it.media_url || it.thumbnail_url || ""} alt={it.caption ?? ""} decoding="async"
                className={fill ? "h-full w-full object-cover" : "max-h-full max-w-full object-contain"} />
            )}
          </div>
        ))}
      </div>

      {/* Close, top right, away from the thumb that is swiping. */}
      <button type="button" onClick={onClose} aria-label={W(lang, "Close", "Cerrar")}
        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/18 text-white ring-1 ring-white/15 backdrop-blur-md">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <p className="absolute left-3 top-4 text-[12px] font-bold text-white/80 tabular-nums
        [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
        {at + 1} / {items.length}
      </p>

      {/* Fill the screen, or see the whole thing. One tap, and the label says what it will do
          next rather than what it is doing now — a toggle that names its current state makes
          everybody read it twice. */}
      <button type="button" onClick={() => setFill(f => !f)}
        /* ⚠️ A BLACK PILL ON A BLACK LETTERBOX IS NOT A BUTTON. In "whole photo" the ground
           behind these controls is the viewer's own black, so bg-black/55 vanished and both the
           close cross and this toggle were bare glyphs floating on nothing — caught on the
           screenshot of the state I had just added. White glass reads on a photograph AND on
           black, which are the only two things ever behind them. */
        className="absolute right-3 top-16 rounded-full bg-white/18 px-3 py-1.5 text-[11.5px] font-bold text-white ring-1 ring-white/15 backdrop-blur-md">
        {fill ? W(lang, "Whole photo", "Foto completa") : W(lang, "Fill the screen", "Llenar la pantalla")}
      </button>

      {/* Caption, where it came from, and the way out to the original — a deliberate choice
          here rather than the only thing a tap on the grid could do. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-6 pt-10">
        {r?.caption && (
          <p className="line-clamp-3 text-[13px] leading-snug text-white">{r.caption}</p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          {r && r.plat !== "onesocial" && (
            /* PUB30: the viewer is always dark, so the black TikTok/X marks must read white in both themes (the mark itself already inverts in dark). */
            <span className={`inline-flex ${["tiktok", "x", "twitter"].includes(r.plat) ? "invert dark:invert-0" : ""}`}>
              <PlatformMark name={r.plat} size={16} onChip={false} />
            </span>
          )}
          <span className="text-[11.5px] font-bold text-white/70">
            {r ? name(r.plat) : ""}{r && r.likes > 0 ? ` · ♥ ${r.likes >= 1000 ? `${(r.likes / 1000).toFixed(1)}K` : r.likes}` : ""}
          </span>
          {r && safeHttpsUrl(r.source_post_url) && (
            <a href={safeHttpsUrl(r.source_post_url)!} target="_blank" rel="noopener noreferrer nofollow"
              className="pointer-events-auto ml-auto rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-bold text-white backdrop-blur-sm">
              {W(lang, "See the original", "Ver el original")}
            </a>
          )}
        </div>
      </div>
    </div>
  , document.body);
}

