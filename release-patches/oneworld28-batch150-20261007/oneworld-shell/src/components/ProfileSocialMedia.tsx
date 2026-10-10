import { useEffect, useMemo, useRef, useState } from "react";
import { W } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { useOneId } from "../lib/oneId";
import PlatformMark from "./PlatformMark";
import MediaPostComposer from "./MediaPostComposer";
import MediaPostViewer, { type Shot } from "./MediaPostViewer";
import { rollUp, compact } from "../lib/socialMetrics";
import type { PlatformSnapshot, SocialTotals } from "../lib/socialMetrics";
import {
  ACCEPT_ATTR, fetchMyLikes, fetchPostsByUser, isText as isTextType, isVideo,
  postThumbnail, type MediaPost,
} from "../lib/mediaPosts";
import { thumbFor } from "../lib/imageDerivatives";

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

/**
 * A post, plus the three things this section derives from it. The post itself — including the
 * files inside it — comes from `lib/mediaPosts`, which is the ported original.
 *
 * ⚠️ `items` IS WHY THIS CHANGED. The section used to read `media_posts` alone, so a post
 * holding four photographs rendered as one tile and the other three did not exist anywhere in
 * the product. Measured on the shared project 9 Oct 2026: 548 rows in `media_post_items`, 15
 * posts with more than one. Lee named it from the other end — *"it wasn't just upload it, it
 * worked out"* — and the carousel is the biggest single thing the original had that we lost.
 */
type Row = MediaPost & { plat: string; kind: string; likes: number };

const ROWS_PER_PAGE = 3;
const COLS: Record<number, number> = { 1: 1, 2: 2, 3: 3 };

export default function ProfileSocialMedia({ userId, editable = false, onUpload, onConnect }: {
  userId: string;
  /** The owner's own profile. Shows connected-but-empty apps, Add photos, and Connect. */
  editable?: boolean;
  /** Optional override. Left out, the section uploads for itself — see below. */
  onUpload?: () => void;
  /** Supplied only where a connect screen exists. Hidden, not disabled, otherwise. */
  onConnect?: () => void;
}) {
  const { lang } = useI18n();
  /* WHO IS LOOKING, as distinct from whose profile this is. `userId` is the subject; `viewerId`
     is the person holding the phone. A visitor can like and comment; only the owner can post,
     caption and delete — and signed out, nobody can do either. */
  const { userId: viewerId } = useOneId();
  /**
   * ⚠️ OWNER MEANS SIGNED IN **AND** THIS PROFILE, PROVED HERE RATHER THAN TRUSTED.
   *
   * Caught by rendering the viewer signed out, 9 Oct 2026: the Edit-caption and Delete controls
   * were on screen for a visitor with no session at all. `editable` is the PRODUCT saying "this
   * is the owner's own profile", and every product derives it correctly today — but a prop is a
   * claim, and a claim is not evidence. The one that costs nothing to check is checked, so a
   * product that one day passes `editable` on a public route cannot hand a stranger a delete
   * button. The server would refuse the delete; drawing the button is still a defect, and it is
   * the same `useIsAdmin` rule — fail closed, ask the session, not the caller.
   *
   * It also stops a button that cannot work: the uploader needs a user id, so without one the
   * Add control would open nothing.
   */
  const mine = editable && !!viewerId && viewerId === userId;
  const [kind, setKind] = useState<"media" | "text">("media");
  /* ⚠️ TWO ACROSS IS THE DEFAULT, AND IT IS A DECISION, NOT A FALLBACK. Lee, 9 Oct 2026:
     *"the default mode should be two columns, not one column or three columns, as far as the
     view mode for your media is concerned."*

     Three across on a 390 pixel phone gives each photograph about 118 pixels, which is a
     thumbnail you squint at; one across turns twelve posts into a page nobody reaches the
     bottom of. Two is the width at which you can actually see what the picture is of and still
     take in a row at a glance. All three widths stay — this is only where it opens. */
  const [view, setView] = useState(2);
  const [sort, setSort] = useState<"recent" | "likes" | "app">("recent");
  const [sel, setSel] = useState<string[]>([]);
  const [pages, setPages] = useState(1);

  /* ── ADDING YOUR OWN PHOTOS AND VIDEOS LIVES HERE, AND IT DOES NOT NEED EDIT MODE ────────
     Lee, 9 Oct 2026, looking at his own profile: *"we need the capability of uploading media,
     photos and videos, to my media section. And I should also have the capability to connect
     accounts, which goes into the media section still. I don't see that. And you shouldn't
     have to edit your profile to do that."*

     He is right twice. **Adding a photograph is not editing your profile**, it is using it —
     the same way posting on any other app is not "editing" anything. Making it a mode you have
     to enter first is a step that exists for the developer's convenience, not the member's.

     And it was worse than a step: the button was drawn only when a product passed an `onUpload`
     handler, and **no product ever passed one**, so on every profile in the ecosystem the
     uploader did not exist at all. The section now does the upload itself, so it works
     everywhere the section is mounted and nothing has to be wired per app. */
  const fileRef = useRef<HTMLInputElement | null>(null);
  /* What they just picked, on its way to the composer. Empty means no composer. */
  const [picked, setPicked] = useState<File[]>([]);
  /* What happened last time they posted, said once and then cleared. */
  const [note, setNote] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  /* ⚠️ THE INPUT IS RESET ON EVERY PICK — AND THE ORDER OF THOSE TWO LINES IS THE WHOLE THING.
     The reset exists because choosing the SAME file twice in a row fires no `change` event at
     all (the value has not changed), so the second attempt looks like a dead button. The
     original did it, and the original did it SECOND.

     I wrote it first, and the composer then never opened — caught by rendering, not by reading.
     `e.target.files` is a LIVE FileList belonging to the input, so clearing the value empties it
     in the same breath, and the handler goes on to read a list of nothing. Copy out, then clear.

     Ten at a time: past that the preview strip is unusable and a phone upload is a ten minute
     wait with nothing to look at. */
  const pick = (files: FileList | null) => {
    const chosen = files ? Array.from(files).slice(0, 10) : [];
    if (fileRef.current) fileRef.current.value = "";
    if (!chosen.length) return;
    setNote(null);
    setPicked(chosen);
  };

  const posts = useAsync(async () => {
    try { return await fetchPostsByUser(userId); }
    catch (e) {
      console.error("[ProfileSocialMedia] media_posts read failed:", (e as Error).message);
      throw e;
    }
  }, [userId, bump], !!userId);

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

  const all: Row[] = useMemo(() => (posts ?? []).map(p => ({
    ...p,
    plat: norm(p.source),
    kind: (p.media_type ?? "").toLowerCase(),
    likes: p.likes_count ?? 0,
  })), [posts]);

  const isText = (r: Row) => isTextType(r.kind);
  const hasPicture = (r: Row) => !!postThumbnail(r);
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
    .filter(k => mine || everywhere[k] > 0);

  const chosen = sel.filter(k => keys.includes(k));
  let list = pool.filter(r => keys.includes(r.plat) && (chosen.length === 0 || chosen.includes(r.plat)));

  if (sort === "likes" && kind !== "text") list = [...list].sort((a, b) => b.likes - a.likes);
  else if (sort === "app") list = [...list].sort((a, b) =>
    (ORDER.indexOf(a.plat) - ORDER.indexOf(b.plat)) || (a.created_at < b.created_at ? 1 : -1));
  /* "recent" needs no sort — the query already returned newest first. */

  const per = (kind === "text" ? 2 : COLS[view]) * ROWS_PER_PAGE;
  const shown = list.slice(0, per * pages);
  const more = shown.length < list.length;

  /* ── EVERY FILE OF EVERY SHOWN POST, FLATTENED, PLUS WHERE EACH POST BEGINS ──────────────
     The grid is posts; the viewer is files. `firstShotOf[i]` is the index in `shots` of the
     first file of the i-th tile, so a tap on a tile opens that post's first picture however
     many files the posts before it held. Getting this wrong is the classic carousel bug: tap
     the fourth photo, land on the seventh. */
  const { shots, firstShotOf } = useMemo(() => {
    const out: Shot[] = [];
    const firsts: number[] = [];
    for (const r of shown) {
      firsts.push(out.length);
      const items = r.items.length ? r.items : [];
      items.forEach((item, idx) => out.push({
        post: r, item, index: idx, count: items.length, plat: r.plat,
        /* `OWN` is already the list of sources that mean "this person posted it here". Anything
           else arrived from another platform, and its stored like and comment counts are that
           platform's numbers — see the warning on `Shot.imported`. */
        imported: !OWN[norm(r.source)],
      }));
    }
    return { shots: out, firstShotOf: firsts };
  }, [shown]);

  /* Which of these the signed-in person has liked, so the heart on the grid is already filled
     before they open anything. One query for the page, not one per tile. */
  const myLikes = useAsync(
    async () => fetchMyLikes(shown.map(r => r.id), viewerId),
    [viewerId, shown.map(r => r.id).join(","), bump],
    !!viewerId && shown.length > 0,
  );

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
  /* Which FILE is open full screen. Null is closed.
     ⚠️ A POST IS NOT A FILE. The grid draws one tile per post, because that is what a post is;
     the viewer walks every file of every post in order, because that is what swiping through
     somebody's pictures means. Tapping the third tile of a grid whose second post held four
     photographs must open the third POST, not the third picture — hence `firstShotOf`. */
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

        {mine && (
          <>
            {/* ⚠️ `accept` IS BUILT FROM THE BUCKET'S OWN MIME LIST, NOT FROM `image/*`. The
                bucket refuses anything outside nine types, and a picker set to `image/*` hands
                over .avif and .svg quite happily — which then fail at the server with a message
                the member never sees. The list has one home, in `lib/mediaPosts`. */}
            <input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple hidden
              onChange={e => pick(e.target.files)} />
            <button type="button"
              onClick={() => (onUpload ? onUpload() : fileRef.current?.click())}
              className="ow-tap shrink-0 rounded-xl border border-brand/40 bg-brand/5 px-3 py-1.5 text-[12px] font-semibold text-brand">
              {W(lang, "＋ Add", "＋ Añadir")}
            </button>
          </>
        )}
      </div>

      <p className="mb-2.5 text-[11.5px] font-semibold opacity-55">
        {total === 0
          ? W(lang, "Nothing here yet.", "Nada todavía.")
          : `${list.length} ${kind === "text"
            ? W(lang, "written", "escritos") : W(lang, "posts", "publicaciones")} · ${who}`}
      </p>

      {note && <p className="mb-2 text-[12px] font-bold text-brand">{note}</p>}

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
          {mine && onConnect && (
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
            <Tile key={r.id} r={r} withCaption={view === 1} lang={lang}
              liked={!!myLikes?.has(r.id)} onOpen={() => setOpened(firstShotOf[i])} />
          ))}
        </div>
      )}

      {/* Full screen, swipe left and right, like / comment / share. Mounted last so it sits
          over everything. */}
      {opened !== null && shots[opened] && (
        <MediaPostViewer shots={shots} start={opened} viewerId={viewerId} canManage={mine}
          platformName={name} onClose={() => setOpened(null)}
          onChanged={() => setBump(b => b + 1)} />
      )}

      {/* NEW POST — files picked, caption written, then published as ONE post. */}
      {picked.length > 0 && viewerId && (
        <MediaPostComposer userId={viewerId} files={picked}
          onCancel={() => setPicked([])}
          onDone={(added, failed) => {
            setPicked([]);
            setNote(added === 0
              ? W(lang, "Nothing was posted.", "No se publicó nada.")
              : failed.length
                ? W(lang, `Posted ${added}. ${failed.length} didn't upload.`,
                          `Se publicaron ${added}. ${failed.length} no se subieron.`)
                : W(lang, added === 1 ? "Posted." : `Posted ${added} files.`,
                          added === 1 ? "Publicado." : `Se publicaron ${added} archivos.`));
            setBump(b => b + 1);
          }} />
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

function Tile({ r, withCaption, lang, liked, onOpen }: {
  r: Row; withCaption: boolean; lang: string; liked: boolean; onOpen: () => void;
}) {
  const lead = r.items[0];
  const leadIsVideo = lead ? isVideo(lead.media_type, lead.media_url) : r.kind === "video";
  /* ⚠️ NEVER AN EMPTY `src`. An empty string is a request for the page itself, which the browser
     paints as a broken-image glyph — uglier than the grey box it was meant to avoid. A video with
     no poster falls back to the clip itself, which the browser renders as its first frame. */
  const shownSrc = postThumbnail(r);

  const img = (
    <div className={`relative overflow-hidden rounded-lg bg-ink/5 dark:bg-white/5 ${withCaption ? "aspect-[4/5]" : "aspect-square"}`}>
      {leadIsVideo && !lead?.thumbnail_url && shownSrc ? (
        /* ⚠️ `preload="metadata"`, NOT `auto`. A twelve-tile grid of `auto` videos downloads
           twelve whole files before the person has tapped anything — on a phone plan that is
           somebody's afternoon of data to look at one profile. Metadata is the duration and the
           headers, which is all a tile needs. Muted and inert: a grid that starts playing is a
           grid nobody can read.

           ⚠️ AND `#t=0.1` IS WHAT STOPS IT BEING A BLACK SQUARE. Lee, 2 Oct 2026, from
           Instagram's in-app browser: two uploaded videos showing as solid black. `metadata`
           loads the duration but Android WebView and iOS never PAINT a frame until playback —
           the media fragment asks for a seek, and a seek paints that frame. Learned once
           already in `PublicVideoDeck`; the same clip in this grid would have been black too. */
        <video src={`${shownSrc}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1}
          className="h-full w-full object-cover" />
      ) : shownSrc ? (
        <Thumb src={shownSrc} />
      ) : null}

      {/* WHERE THIS CAME FROM — and only when it came from somewhere else.
             A badge on the person's OWN OneSocial post answers a question nobody asked: the whole
             profile is OneSocial. Worse, `onesocial` is not a key in the icon map, so those posts
             were being badged with the GLOBE — the mark the map uses for "unrecognised". On this
             account that painted 22 globes across the grid, which is most of what Lee was looking
             at when he said the icon was hard to read. Imported posts get the mark; ours get air. */}
      {r.plat !== "onesocial" && (
        <PlatformMark name={r.plat} size={13} className="absolute left-1.5 top-1.5" />
      )}

      {/* ⚠️ HOW MANY FILES ARE IN HERE — the thing the grid has never said. Straight from the
             original, which badged the count because a carousel that looks like a single photo is
             a carousel nobody opens. Fifteen posts on this project are carousels. */}
      {r.items.length > 1 && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[9.5px] font-bold text-white">
          {r.items.length}
        </span>
      )}

      {r.likes > 0 && (
        <span className={`absolute bottom-1.5 left-1.5 text-[10px] font-bold [text-shadow:0_1px_3px_rgba(0,0,0,.7)]
          ${liked ? "text-red-400" : "text-white"}`}>
          {liked ? "♥" : "♡"} {r.likes >= 1000 ? `${(r.likes / 1000).toFixed(1)}K` : r.likes}
        </span>
      )}

      {leadIsVideo && (
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
    <button type="button" onClick={onOpen} className="block w-full text-left"
      aria-label={r.caption?.slice(0, 60) || W(lang, "Open", "Abrir")}>{img}</button>
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

/**
 * ⚠️ THE 512-PIXEL TWIN FIRST, THE FULL PICTURE IF IT IS NOT THERE. `thumbFor()` is a
 * CONVENTION on the stored path, not a stored column, so the twin is allowed to be missing — an
 * imported Instagram photo has none at all, and an upload whose thumbnail write failed has none
 * either. The fallback on `error` is what makes both of those cases merely slower instead of
 * blank. Exactly the `Thumb` that `PhotoDeck` already uses; same reason, same shape.
 */
/**
 * ⚠️ A GRID TILE'S `alt` MUST BE EMPTY, AND THIS WAS VISIBLE IN A SCREENSHOT. Rendered against
 * an imported Instagram library 9 Oct 2026: five of seven tiles painted the post's ENTIRE
 * caption as text, overflowing the square and shoving the grid apart, because the photographs
 * had not loaded and a broken `<img>` renders its `alt` instead.
 *
 * The harness could not reach Instagram's CDN, but this is not only a harness fault — imported
 * platform URLs expire, and when one does, that is exactly what a member sees on a public
 * profile. So the image is DECORATIVE: the caption is already on the button that wraps it as an
 * `aria-label`, which is the correct place for it (the control is what a screen reader
 * announces), and a dead picture now leaves a quiet grey square instead of a wall of Spanish.
 */
function Thumb({ src }: { src: string }) {
  /* ⚠️ ONLY OUR OWN FILES HAVE A TWIN, AND ASKING ANYWAY COSTS A FAILED REQUEST PER TILE.
     Measured while rendering an imported Instagram library 9 Oct 2026: every photograph fired
     `…_n-t.webp` at Instagram's CDN first, was refused, and only then loaded the real file.
     Twelve tiles, twelve wasted round trips, and on a slow connection twelve visibly late
     pictures. The `-t` convention belongs to the `media` bucket; anything else is somebody
     else's URL and is used exactly as it came. */
  const ours = src.includes("/object/public/media/");
  const [url, setUrl] = useState(ours ? thumbFor(src) : src);
  useEffect(() => { setUrl(ours ? thumbFor(src) : src); }, [src, ours]);
  return (
    <img decoding="async" loading="lazy" alt="" src={url} className="h-full w-full object-cover"
      onError={() => { if (url !== src) setUrl(src); }} />
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
