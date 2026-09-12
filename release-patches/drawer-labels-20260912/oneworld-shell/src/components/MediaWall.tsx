import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";

/**
 * MEDIA WALL — the person's own posts (SHELL). Matrix: "Media (own uploads only)".
 * ============================================================================================
 * ⚠️ REWRITTEN 10 Aug 2026 — THIS READ HAD NEVER WORKED.
 *
 * It selected `id, url, type` from a table called `media_items`. Checked against the live
 * database: **there is no `media_items` table and there never has been.** Every call failed,
 * `useAsync` turned the rejection into `undefined`, and the wall rendered its "nothing yet"
 * state — on the owner's profile and on every public profile, in all five apps.
 *
 * Counted live at the time of the fix: **584 media posts belonging to 59 people**, all with
 * `moderation_status = 'visible'`, none of them reachable. This is the same defect class as the
 * Messages screen (seven columns that did not exist): an empty grid and a broken query look
 * identical from the outside, so nothing ever errored and nobody could see it was wrong.
 *
 * The real shape is `media_posts` (+ `media_post_items` for multi-image posts):
 *   user_id · media_url · thumbnail_url · media_type · caption · moderation_status · created_at
 *
 * TWO THINGS THE REAL DATA FORCES, both of which a naive port would get wrong:
 *
 * 1. `media_type` IS MIXED CASE. The live values are `image`, `PHOTO`, `text`, `video`, `VIDEO`
 *    — the imported rows shout and the native ones do not. Matching `=== "video"` silently drops
 *    every imported clip, so the comparison is lower-cased.
 * 2. `text` POSTS ARE NOT MEDIA. A text-only post has no image to show; leaving it in paints a
 *    grey square in the grid. They are filtered out here and belong in the feed instead.
 *
 * `moderation_status` is filtered to `visible` because this component renders on PUBLIC profiles.
 * A wall that shows a stranger something moderation has held is a worse failure than an empty one.
 */
export default function MediaWall({ userId, editable = false, onUpload }: { userId: string; editable?: boolean;
  /** Supplied by a product that actually has an uploader. Absent means no button — see above. */
  onUpload?: () => void;
}) {
  const { lang } = useI18n();
  const isEs = lang === "es" || lang === "co";

  const items = useAsync(async () => {
    const { data, error } = await supabase.from("media_posts")
      /* Columns named, never select('*') — column-level grants are on and the star throws 42501
         for a signed-in member. */
      .select("id, media_url, thumbnail_url, media_type, caption, created_at")
      .eq("user_id", userId)
      .eq("moderation_status", "visible")
      .order("created_at", { ascending: false })
      .limit(24);
    /* Say what the server said. The previous version's silence is precisely why a query against a
       non-existent table survived in the shell of five products. */
    if (error) { console.error("[MediaWall] media_posts read failed:", error.message); throw error; }
    return (data ?? []) as {
      id: string; media_url: string | null; thumbnail_url: string | null;
      media_type: string | null; caption: string | null; created_at: string;
    }[];
  }, [userId], !!userId);

  const list = (items ?? [])
    .map(m => ({ ...m, kind: (m.media_type ?? "").toLowerCase() }))
    .filter(m => m.kind !== "text")                       // a text post has nothing to show here
    .filter(m => m.thumbnail_url || m.media_url)          // and neither does a row with no image
    .slice(0, 12);

  return (
    <section className="card p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="font-bold">{isEs ? "Medios" : "Media"}</h2>
        {/* ⚠️ THIS BUTTON HAD NO onClick. NONE. It rendered in brand colours on the owner's own
            profile in ALL SIX APPS and invited a tap that did nothing at all.

            Lee's standing rule, and he is right: *"never ship a control that only half works and
            call the rest tracked or a known gap. Showing seven flags is a promise that all seven
            work. Either finish it or do not show it."*

            So it now uses the pattern the architecture already sanctions three times over — Apple
            sign-in, Google Places city autocomplete and the AI writing assist all DERIVE whether
            their dependency is really there and render nothing rather than a dead control. A
            product that passes `onUpload` gets the button; one that does not gets no button at
            all. It goes live with no code change here and no second deploy.

            HIDDEN, NOT DISABLED. A greyed control advertises a feature and then refuses it, which
            reads as a broken app — worse than the feature simply not being there yet. */}
        {editable && onUpload && (
          <button type="button" onClick={onUpload}
            className="ow-tap rounded-xl border border-brand/40 bg-brand/5 px-3 py-1.5 text-[12px] font-semibold text-brand">
            {isEs ? "＋ Subir" : "＋ Upload"}
          </button>
        )}
      </div>
      {list.length ? (
        <div className="grid grid-cols-3 gap-1.5">
          {list.map(m => (
            <div key={m.id} className="relative aspect-square overflow-hidden rounded-lg bg-ink/5 dark:bg-white/5">
              <img src={m.thumbnail_url || m.media_url || ""} alt={m.caption ?? ""} loading="lazy"
                className="h-full w-full object-cover" />
              {m.kind === "video" && (
                <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/50 text-white">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm opacity-55">
          {isEs ? "Aún no hay medios." : "No media yet."}
        </p>
      )}
    </section>
  );
}
