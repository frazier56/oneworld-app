import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@job/lib/query";
import { supabase } from "@job/lib/supabase";
import ScoreDonut from "@job/components/ScoreDonut";
import ReportBlockSheet from "@job/components/ReportBlockSheet";
import { useAuth } from "@job/hooks/useAuth";
import { IconVideo, IconWrite, IconBriefcase, IconPin, IconCash, IconPlay, IconChat } from "@job/components/ActionIcons";
import { useI18n } from "@job/lib/i18n";
import Avatar from "@job/components/Avatar";
import Lightbox, { type LightboxItem } from "@job/components/Lightbox";
import PlacesInput from "@job/components/PlacesInput";
import { createMediaPost, fetchItemsForPosts, MAX_ITEMS_PER_POST } from "@job/lib/mediaPost";
import { fnError, thrownError } from "@job/lib/fnError";

/**
 * ONEJOB'S FEED — the app-specific half of the home tab (the `feedSlot`).
 * ============================================================================================
 * ADAPTED 9 Aug 2026 from the hash-verified 5-Aug OneJob build. Two things came OUT of this file
 * and nothing was rebuilt: the search box and the filter-pill row are now the shell's `HomeTop`,
 * which is identical on all eight products, and the composer STRIP is HomeTop's four-action row.
 * What stayed is the part that is genuinely OneJob's — the merged posts+jobs rail, the card, and
 * the write modal with the "I'm hiring" toggle that makes a real `jobs` row.
 *
 * HomeTop's composer navigates to `?mode=video|photo|write|live`; `Home.tsx` points `composeTo`
 * back at `/jobs` so those modes open THIS composer rather than the money screen. The centre tab
 * is "Start a job" — a contract, not a post — and conflating the two would be the wrong door.
 *
 * V2-15 — HOME = FEED ("Instagram for jobs").
 *  Data rail (council decision, Jul 11): job-asks ARE jobs rows (one rail, no parallel
 *  post type) — a "Write" post with the hiring toggle creates a real `jobs` row so the
 *  existing apply flow (platform_job_applications + convo) is the respond path.
 *  Portfolio/text posts = media_posts (source native; text-only = caption, no media).
 *  Feed merge = media_posts + jobs from credible authors (photo + score ≥ 50, engine rule).
 */

export type FeedFilter = "all" | "posts" | "jobs" | "near";

/**
 * ── WHO IS ALLOWED INTO THE FEED (rewritten 9 Aug 2026, Lee's UAT) ──────────────────────────
 * This used to require an author to have BOTH a photo AND a OneScore of 50 or more. Counted
 * against the live database on 9 Aug: 28 profiles out of 103 cleared that bar. The jobs half
 * additionally required status published/live AND created within 60 days, and EXACTLY ONE job
 * on the entire platform qualified — out of 1,385 rows. So OneJob's home feed was structurally
 * near-empty while OneScore's, which asks only for `is_public`, showed 100 people.
 *
 * Lee: *"OneJob home feed should not feel empty if there are real profiles/content that should
 * be surfaced… OneSocial/OneScore already show richer real-user data; OneJob should be checked
 * against that standard."*
 *
 * So the credibility signal moves from a GATE to a RANKING. Public profiles are eligible; the
 * ones with a score still come first, and the ones without sort last instead of vanishing. A
 * missing photo no longer erases somebody — 63 of the 103 real profiles are people who were
 * seeded or imported and have no login yet, and they are exactly the population Lee wants
 * discoverable.
 *
 * The 60-day job window is now a year. The newest `live` job is dated 11 July; a 60-day window
 * measured from today throws the entire back catalogue away for no benefit on a platform this
 * young.
 */
const AUTHOR_LIMIT = 300;
const JOB_WINDOW_DAYS = 365;
const FEED_LIMIT = 40;

type Author = { id: string; full_name: string | null; photo_url: string | null; job_title: string | null; location: string | null; score_v9_snapshot: number | null };
type PostRow = { id: string; user_id: string; caption: string | null; media_url: string | null; thumbnail_url: string | null; media_type: string | null; likes_count: number | null; comments_count: number | null; source_platform: string | null; created_at: string; items?: { media_url: string; media_type: string; position: number }[] };
type JobRow = { id: string; user_id: string; title: string; pay_range: string | null; location: string | null; background_image_url: string | null; created_at: string };
type Item =
  | { kind: "post"; id: string; created_at: string; author: Author; posts: PostRow[] }
  | { kind: "job"; id: string; created_at: string; author: Author; job: JobRow };

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now"; if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The author's OneScore, in the feed.
 *
 * It used to be a flame emoji in a tinted pill — a different object from the ring people see on
 * a profile, showing the same number. Lee, 31 Jul: "it should show in its same circular fashion
 * and not this little bubble… just a small version of it."
 *
 * So it is now literally the same component the profile uses, at a smaller size. One score, one
 * shape, everywhere it appears — which is the only way a number like this earns recognition.
 */
function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return null;
  return (
    <span className="shrink-0" title={`OneScore ${score}`}>
      <ScoreDonut score={score} size={34} />
    </span>
  );
}

export default function Feed({ query = "", filter = "all" }: { query?: string; filter?: FeedFilter }) {
  const { user, profile } = useAuth();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [composer, setComposer] = useState<null | "write">(null);
  const [text, setText] = useState("");
  /** The feed item being reported, or null. */
  const [reportItem, setReportItem] = useState<{ type: "post" | "job"; id: string; userId: string; name: string | null } | null>(null);
  const [hiring, setHiring] = useState(false);
  const [jobBuilding, setJobBuilding] = useState("");
  const [jobLoc, setJobLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingMedia, setPendingMedia] = useState<File[] | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [viewer, setViewer] = useState<{ items: LightboxItem[]; start: number } | null>(null);

  /* HomeTop's shared composer routes to `<composeTo>?mode=…`. Home.tsx points it back here, so a
     tap on Write/Photo/Video opens OneJob's own composer. The param is consumed (replace: true)
     so a refresh or a back-tap does not re-open the sheet — a modal that reappears on Back is the
     single most common way a composer feels broken. */
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode");
  const linkedEventId = params.get("event");
  useEffect(() => {
    if (!mode) return;
    if (mode === "write") {
      setComposer("write");
      if (linkedEventId) setHiring(true);
    }
    else if (mode === "photo" || mode === "video") fileRef.current?.click();
    /* "live" is deliberately unhandled — Go Live is not built, and the strip labels it Soon. */
    const next = new URLSearchParams(params); next.delete("mode");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["feed"],
    staleTime: 60_000,
    queryFn: async (): Promise<Item[]> => {
      const { data: authors, error: authorErr } = await supabase.from("profiles")
        .select("id, full_name, photo_url, job_title, location, score_v9_snapshot")
        .eq("is_public", true)
        /* Scored people first, unscored last — a ranking, not a gate. */
        .order("score_v9_snapshot", { ascending: false, nullsFirst: false })
        .limit(AUTHOR_LIMIT);
      if (authorErr) console.error("[onejob] feed: authors read failed —", authorErr.message);
      const list = (authors ?? []) as Author[];
      if (!list.length) return [];
      const ids = list.map(a => a.id);
      const byId = new Map(list.map(a => [a.id, a]));
      const since = new Date(Date.now() - JOB_WINDOW_DAYS * 864e5).toISOString();
      const [postsRes, jobsRes] = await Promise.all([
        supabase.from("media_posts")
          .select("id, user_id, caption, media_url, thumbnail_url, media_type, likes_count, comments_count, source_platform, created_at")
          .in("user_id", ids).order("created_at", { ascending: false }).limit(FEED_LIMIT * 2),
        supabase.from("jobs")
          .select("id, user_id, title, pay_range, location, background_image_url, created_at")
          .in("user_id", ids).in("status", ["published", "live"]).gte("created_at", since)
          .order("created_at", { ascending: false }).limit(FEED_LIMIT),
      ]);
      // attach multi-photo items (Instagram-style posts)
      const postRows = (postsRes.data ?? []) as PostRow[];
      const itemsMap = await fetchItemsForPosts(postRows.map(p => p.id));
      for (const p of postRows) p.items = itemsMap.get(p.id) as PostRow["items"];
      const flat: Array<{ created_at: string; row: PostRow | JobRow; isJob: boolean }> = [
        ...postRows.map(r => ({ created_at: r.created_at, row: r, isJob: false })),
        ...((jobsRes.data ?? []) as JobRow[]).map(r => ({ created_at: r.created_at, row: r, isJob: true })),
      ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      // group consecutive posts by same author into one horizontal-strip card
      const out: Item[] = [];
      for (const f of flat) {
        const author = byId.get((f.row as any).user_id); if (!author) continue;
        if (f.isJob) { out.push({ kind: "job", id: `j-${f.row.id}`, created_at: f.created_at, author, job: f.row as JobRow }); continue; }
        const last = out[out.length - 1];
        if (last?.kind === "post" && last.author.id === author.id) { last.posts.push(f.row as PostRow); continue; }
        out.push({ kind: "post", id: `p-${f.row.id}`, created_at: f.created_at, author, posts: [f.row as PostRow] });
      }
      return out.slice(0, FEED_LIMIT);
    },
  });

  const myCity = (profile?.location ?? "").split(",")[0].trim().toLowerCase();
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => (items ?? []).filter(it => {
    /* HomeTop owns the search box; the app filters its OWN feed — the shell never reaches into
       a product's data. Author, headline, and the job's own title/location are what a person is
       actually looking for here. */
    if (needle) {
      const hay = [
        it.author.full_name, it.author.job_title, it.author.location,
        it.kind === "job" ? it.job.title : it.posts.map(p => p.caption).join(" "),
        it.kind === "job" ? it.job.location : null,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (filter === "posts") return it.kind === "post";
    if (filter === "jobs") return it.kind === "job";
    if (filter === "near") return !!myCity && (
      (it.kind === "job" ? it.job.location ?? it.author.location : it.author.location) ?? ""
    ).toLowerCase().includes(myCity);
    return true;
  }), [items, filter, myCity, needle]);

  const publish = async () => {
    if (!text.trim()) { setErr(t("fixFields")); return; }
    setBusy(true); setErr("");
    try {
      if (hiring) {
        const title = text.trim().split("\n")[0].slice(0, 80);
        const jobLocation = [jobBuilding.trim(), jobLoc.trim()].filter(Boolean).join(", ") || profile?.location || null;
        const { data: jobRow, error: jobErr } = await supabase.from("jobs").insert({
          user_id: user!.id, title, description: text.trim(),
          location: jobLocation, status: "live",
        }).select("id").single();
        if (jobErr) throw new Error(await fnError(jobErr, "Couldn’t post that — try again."));
        if (linkedEventId && jobRow?.id) {
          const { error: linkErr } = await supabase.from("job_event_links").insert({
            job_id: jobRow.id,
            event_id: linkedEventId,
            linked_by: user!.id,
          } as any);
          if (linkErr) console.error("[onejob] event job link failed:", linkErr.message);
          const next = new URLSearchParams(params);
          next.delete("event");
          setParams(next, { replace: true });
        }
      } else {
        await supabase.from("media_posts").insert({ user_id: user!.id, caption: text.trim(), media_type: "text", source: "native" });
      }
      setText(""); setHiring(false); setJobBuilding(""); setJobLoc(""); setComposer(null);
      qc.invalidateQueries({ queryKey: ["feed"] });
    } catch (e: any) { setErr(thrownError(e, "Couldn’t post that — try again.")); }
    setBusy(false);
  };

  const pickMedia = (files: FileList | null) => {
    if (!files?.length) return;
    setPendingMedia(Array.from(files).slice(0, MAX_ITEMS_PER_POST));
    setMediaCaption("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const publishMedia = async () => {
    if (!pendingMedia?.length) return;
    setBusy(true); setErr("");
    try {
      await createMediaPost(user!.id, pendingMedia, mediaCaption);
      setPendingMedia(null); setMediaCaption("");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["media-wall", user!.id] });
    } catch (e: any) { setErr(thrownError(e, "Couldn’t post that — try again.")); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {/* The composer STRIP and the search box are HomeTop's (shell). Only the file input stays —
          HomeTop's Photo/Video actions arrive here as `?mode=`, and the picker must live beside
          the upload code that consumes it. */}
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={e => pickMedia(e.target.files)} />

      {/* Write modal */}
      {composer === "write" && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !busy && setComposer(null)}>
          <div className="w-full max-w-lg glass-modal rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><IconWrite size={17} className="text-brand-deep dark:text-brand-light" />{t("newPost")}</h2>
              <button onClick={() => setComposer(null)} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 text-lg dark:border-white/15" aria-label="Close">×</button>
            </div>
            <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
              placeholder={hiring ? t("hiringPlaceholder") : t("postPlaceholder")}
              className={`input min-h-[120px] !resize-y ${err && !text.trim() ? "!border-red-500" : ""}`} />
            <label className="mt-3 flex items-center justify-between rounded-xl bg-brand/5 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold"><IconBriefcase size={15} />{t("imHiring")}</span>
              <button onClick={() => setHiring(v => !v)} type="button"
                className={`relative h-7 w-12 rounded-full transition ${hiring ? "bg-teal" : "bg-ink/20 dark:bg-white/20"}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${hiring ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </label>
            {hiring && <p className="mt-1 px-1 text-xs opacity-60">{t("hiringHint")}</p>}
            {hiring && (
              <div className="mt-3 space-y-2">
                <PlacesInput value={jobBuilding} onChange={setJobBuilding} onSelect={v => { if (!jobLoc.trim()) setJobLoc(v); }}
                  placeholder={lang === "es" ? "Nombre del lugar / edificio (opcional)" : "Building / venue name (optional)"} variant="establishment" />
                <PlacesInput value={jobLoc} onChange={setJobLoc}
                  placeholder={lang === "es" ? "Dirección (opcional)" : "Address (optional)"} variant="address" />
              </div>
            )}
            {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
            <button onClick={publish} disabled={busy} className="btn-primary mt-3 w-full">{busy ? "…" : hiring ? t("postJob") : t("post")}</button>
          </div>
        </div>
      )}

      {/* Feed */}
      {isLoading && <div className="card h-40 animate-pulse" />}
      {!isLoading && !visible.length && (
        <div className="card p-6 text-center text-sm opacity-60">
          {filter === "near" && !myCity ? t("nearNeedsCity") : t("feedEmpty")}
        </div>
      )}
      {visible.map(it => (
        <article key={it.id} className="card overflow-hidden p-4">
          <div className="flex items-center gap-2.5">
            <Link to={`/jobs/p/${it.author.id}`}><Avatar src={it.author.photo_url} name={it.author.full_name} size={40} rounded="rounded-full" textSize="text-base" /></Link>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                <Link to={`/jobs/p/${it.author.id}`} className="truncate">{it.author.full_name}</Link>
                <ScoreChip score={it.author.score_v9_snapshot} />
              </p>
              <p className="truncate text-xs opacity-60">{it.author.job_title ?? ""}{it.author.job_title ? " · " : ""}{timeAgo(it.created_at)}</p>
            </div>
            {it.kind === "job" && <span className="shrink-0 rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-bold text-brand-deep dark:bg-brand/20 dark:text-brand-light"><IconBriefcase size={12} className="inline -mt-px mr-1" />{t("hiringChip")}</span>}
            {/* ── Report ─────────────────────────────────────────────────────────────────
                The feed is the most-seen user-generated surface in the app and had NO report
                path — messages, profiles and (as of today) comments all did, but the posts
                themselves did not. Apple 1.2 wants one on every piece of UGC, and this is the
                one a reviewer opens first.

                Only on other people's content: "report" on your own post is meaningless, and the
                owner already has delete on their own wall. (Jul 31 2026) */}
            {user && it.author.id !== user.id && (
              <button
                onClick={() => setReportItem({
                  type: it.kind === "job" ? "job" : "post",
                  id: it.kind === "job" ? it.job.id : it.posts[0].id,
                  userId: it.author.id,
                  name: it.author.full_name,
                })}
                aria-label="Report this post"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full opacity-35 transition hover:bg-ink/5 hover:opacity-100 dark:hover:bg-white/10">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>
            )}
          </div>

          {it.kind === "post" ? (
            <>
              {it.posts.some(p => p.media_url || p.items?.length) ? (() => {
                const slides: LightboxItem[] = [];
                const thumbs: { url: string; type: string; slideIdx: number; extra: number }[] = [];
                for (const p of it.posts) {
                  const its = p.items?.length ? p.items : (p.media_url ? [{ media_url: p.media_url, media_type: p.media_type ?? "image", position: 0 }] : []);
                  if (!its.length) continue;
                  thumbs.push({ url: its[0].media_url, type: its[0].media_type, slideIdx: slides.length, extra: its.length - 1 });
                  for (const m of its) slides.push({ url: m.media_url, type: m.media_type, caption: p.caption });
                }
                return (
                  <>
                    {/* Singular has its own key — a {n} replace alone printed "shared 1 portfolio posts", live on screen. */}
                    <p className="mt-2 text-xs opacity-60">
                      {slides.length === 1 ? t("sharedWork1") : t("sharedWork").replace("{n}", String(slides.length))}
                    </p>
                    <div className="scrollbar-none -mx-1 mt-2 flex snap-x gap-1.5 overflow-x-auto px-1">
                      {thumbs.map((th, i) => (
                        <button key={i} onClick={() => setViewer({ items: slides, start: th.slideIdx })}
                          className="relative h-44 w-36 shrink-0 snap-start overflow-hidden rounded-xl bg-ink/5 dark:bg-white/5">
                          {/video/i.test(th.type)
                            ? <video src={th.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                            : <img src={th.url} className="h-full w-full object-cover" loading="lazy" alt="" />}
                          {/video/i.test(th.type) && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/45 p-0.5 text-white"><IconPlay size={11} /></span>}
                          {th.extra > 0 && <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">⧉ {th.extra + 1}</span>}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })() : null}
              {/* Consecutive posts by the same author are merged into ONE card, so rendering
                *  `posts[0].caption` alone silently threw away the description on every post after
                *  the first — the author wrote it, the card never showed it. Render them all, in
                *  order, de-duplicated (repeats look like a rendering bug, not a caption). */}
              {Array.from(new Set(it.posts.map(p => p.caption?.trim()).filter(Boolean) as string[]))
                .map((cap, i) => (
                  <p key={i} className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{cap}</p>
                ))}
              <div className="mt-2.5 flex items-center gap-4 text-xs opacity-60">
                <span>❤️ {it.posts.reduce((s, p) => s + (p.likes_count ?? 0), 0)}</span>
                <span className="inline-flex items-center gap-1"><IconChat size={12} />{it.posts.reduce((s, p) => s + (p.comments_count ?? 0), 0)}</span>
                <Link to={`/jobs/p/${it.author.id}`} className="ml-auto font-semibold text-brand opacity-100">{t("viewProfile")} →</Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 font-bold leading-snug">{it.job.title}</p>
              <p className="mt-0.5 text-xs opacity-60">
                {it.job.pay_range && <><IconCash size={12} className="mr-0.5 inline-block align-[-1px]" />{it.job.pay_range}</>}
                {it.job.pay_range && it.job.location ? " · " : ""}
                {it.job.location && <><IconPin size={12} className="mr-0.5 inline-block align-[-1px]" />{it.job.location}</>}
              </p>
              <button onClick={() => nav(`/jobs/j/${it.job.id}`)} className="btn-primary mt-3 w-full !py-2.5 text-sm">{t("apply")}</button>
            </>
          )}
        </article>
      ))}

      {pendingMedia && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !busy && setPendingMedia(null)}>
          <div className="w-full max-w-lg glass-modal rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">🖼️ {t("newPost")} <span className="text-sm font-semibold text-brand">({pendingMedia.length}{pendingMedia.length >= MAX_ITEMS_PER_POST ? ` — ${t("maxPerPost")}` : ""})</span></h2>
              <button onClick={() => setPendingMedia(null)} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 text-lg dark:border-white/15" aria-label="Close">×</button>
            </div>
            <div className="scrollbar-none mb-3 flex gap-1.5 overflow-x-auto">
              {pendingMedia.map((f, i) => (
                <div key={i} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ink/5 dark:bg-white/5">
                  {f.type.startsWith("video")
                    ? <span className="grid h-full w-full place-items-center opacity-55"><IconVideo size={22} /></span>
                    : <img src={URL.createObjectURL(f)} className="h-full w-full object-cover" alt="" />}
                </div>
              ))}
            </div>
            <textarea value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} placeholder={t("captionPlaceholder")} className="input min-h-[80px] !resize-y" />
            {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
            <button onClick={publishMedia} disabled={busy} className="btn-primary mt-3 w-full">{busy ? "…" : t("post")}</button>
          </div>
        </div>
      )}

      {viewer && <Lightbox items={viewer.items} start={viewer.start} onClose={() => setViewer(null)} />}

      {/* Reporting also offers to block the author. Blocking has to drop their content from view
          immediately — a block that leaves the posts on screen reads as "it didn't work". */}
      <ReportBlockSheet
        open={!!reportItem}
        onClose={() => setReportItem(null)}
        targetType={reportItem?.type ?? "post"}
        targetId={reportItem?.id ?? ""}
        targetUserId={reportItem?.userId}
        targetName={reportItem?.name}
        onBlocked={() => { setReportItem(null); qc.invalidateQueries({ queryKey: ["feed"] }); }}
      />
    </div>
  );
}
