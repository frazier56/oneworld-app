import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";

/**
 * REVIEWS — what other people said about this person (SHELL, public).
 * ============================================================================================
 * Lee, 10 Aug 2026, on the public profile: *"Always show the staples regardless of toggles:
 * photo, name, profession, location, media, reviews, and the Message / Connect buttons."*
 *
 * Reviews were not on the public profile at all. They are the single strongest credibility
 * signal a stranger can read, on a platform whose whole pitch is credibility — and unlike the
 * score, the passport and My World, reviews are NOT behind a visibility switch. They are what
 * other people said, not what the member chose to publish.
 *
 * THE 7-POINT SCALE. `job_reviews.rating` is stored 1..7, and every surface that shows a star
 * rating converts it (`rating / 7 * 5`) — `OneWorldHub` already did this and it is easy to miss,
 * so it is written down here: a raw 6 rendered as "6.0 ★" would be a five-star scale showing six.
 *
 * HONEST WHEN EMPTY. At the time of writing, `job_reviews` holds ZERO rows platform-wide — the
 * review flow exists but nobody has completed a job through it yet. So this renders its empty
 * state everywhere today, and that is correct: a new marketplace with no reviews should say so
 * rather than hide the section and leave the visitor wondering. The moment the first review is
 * written it appears here with no further work.
 */
export default function PublicReviews({ userId }: { userId: string }) {
  const { lang } = useI18n();
  const isEs = lang === "es" || lang === "co";

  const data = useAsync(async () => {
    const { data: rows, error } = await supabase.from("job_reviews")
      .select("id, reviewer_id, rating, comment, created_at")
      .eq("reviewee_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) { console.error("[PublicReviews] job_reviews read failed:", error.message); throw error; }
    const list = (rows ?? []) as {
      id: string; reviewer_id: string; rating: number; comment: string | null; created_at: string;
    }[];

    /* Reviewer names in ONE batched follow-up, columns named — `select('*')` on profiles throws
       42501 under the column-level grants. A per-row lookup here would be ten round trips on a
       public page a stranger is waiting on. */
    const ids = [...new Set(list.map(r => r.reviewer_id))];
    let names: Record<string, { full_name: string | null; photo_url: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("id, full_name, photo_url").in("id", ids);
      names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, photo_url: p.photo_url }]));
    }

    const avg = list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length / 7 * 5 : null;
    return { list, names, avg };
  }, [userId], !!userId);

  const list = data?.list ?? [];
  const avg = data?.avg ?? null;

  return (
    <section className="card p-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="font-bold">{isEs ? "Reseñas" : "Reviews"}</h2>
        {avg != null && (
          <span className="text-[13px] font-semibold opacity-70">
            {"★"} {avg.toFixed(1)} <span className="opacity-55">· {list.length}</span>
          </span>
        )}
      </div>

      {list.length ? (
        <ul className="space-y-3">
          {list.map(r => {
            const who = data!.names[r.reviewer_id];
            const stars = Math.round(r.rating / 7 * 5);
            return (
              <li key={r.id} className="flex gap-3">
                {who?.photo_url
                  ? <img src={who.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-[13px] font-bold text-brand">
                      {(who?.full_name ?? "·")[0]?.toUpperCase()}
                    </div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold">{who?.full_name ?? (isEs ? "Miembro" : "Member")}</span>
                    <span className="shrink-0 text-[12px] text-amber-500">{"★".repeat(stars)}<span className="opacity-25">{"★".repeat(5 - stars)}</span></span>
                  </div>
                  {r.comment && <p className="mt-0.5 text-[13px] leading-relaxed opacity-75">{r.comment}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm opacity-55">
          {isEs ? "Aún no hay reseñas." : "No reviews yet."}
        </p>
      )}
    </section>
  );
}
