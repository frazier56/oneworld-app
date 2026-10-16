import { W } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import "../lib/reviewsCopy";

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
 *
 * ── TESTIMONIALS, SHOWN HONESTLY (overlay 49, 7 Oct 2026) ──────────────────────────────────
 * Studio, 5 Oct: Aria's two reviews live in `testimonials` and this card read only `job_reviews`,
 * so every profile said "No reviews yet". They are now shown — but as what they ARE. A testimonial
 * is pre-One World proof the member added (the owner can insert their own), so it gets NO stars,
 * NO average, and a line saying it is not from a job here. Job reviews keep the stars and stay the
 * only thing the average is built from. On a sample profile each one carries a "Sample" tag.
 */
export default function PublicReviews({ userId }: { userId: string }) {
  const { lang } = useI18n();

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

    /* Testimonials: only `active` ones are public (RLS says the same). A failed read hides the block
       rather than the whole card — job reviews are the stronger signal and must not depend on it. */
    const [{ data: tRows, error: tErr }, { data: owner }] = await Promise.all([
      supabase.from("testimonials")
        .select("id, author_name, author_role, author_company, author_photo_url, quote_text, created_at")
        .eq("user_id", userId).eq("status", "active")
        .order("position", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
        .limit(10),
      supabase.from("profiles").select("is_sample").eq("id", userId).maybeSingle(),
    ]);
    if (tErr) console.error("[PublicReviews] testimonials read failed:", tErr.message);
    const testimonials = ((tErr ? [] : tRows) ?? []).filter((t: any) => String(t.quote_text ?? "").trim()) as {
      id: string; author_name: string | null; author_role: string | null; author_company: string | null;
      author_photo_url: string | null; quote_text: string; created_at: string;
    }[];
    return { list, names, avg, testimonials, sample: !!(owner as any)?.is_sample };
  }, [userId], !!userId);

  const list = data?.list ?? [];
  const avg = data?.avg ?? null;
  const testimonials = data?.testimonials ?? [];
  const sample = !!data?.sample;

  return (
    <section className="card p-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="font-bold">{W(lang, "Reviews", "Reseñas")}</h2>
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
                  ? <img decoding="async" src={who.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-[13px] font-bold text-brand">
                      {(who?.full_name ?? "·")[0]?.toUpperCase()}
                    </div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold">{who?.full_name ?? (W(lang, "Member", "Miembro"))}</span>
                    <span className="shrink-0 text-[12px] text-amber-500">{"★".repeat(stars)}<span className="opacity-25">{"★".repeat(5 - stars)}</span></span>
                  </div>
                  {r.comment && <p className="mt-0.5 text-[13px] leading-relaxed opacity-75">{r.comment}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : !testimonials.length ? (
        <p className="py-6 text-center text-sm opacity-55">
          {W(lang, "No reviews yet.", "Aún no hay reseñas.")}
        </p>
      ) : null}

      {testimonials.length > 0 && (
        <div className={list.length ? "mt-4 border-t border-ink/10 pt-3 dark:border-white/10" : ""} data-ow="testimonials">
          <h3 className="text-[13.5px] font-bold">{W(lang, "Testimonials", "Testimonios")}</h3>
          <p className="mb-2.5 text-[11.5px] opacity-60">
            {W(lang, "Added by this member. Not from a job on One World.", "Agregados por este miembro. No provienen de un trabajo en One World.")}
          </p>
          <ul className="space-y-3">
            {testimonials.map(t => {
              const who = (t.author_name ?? "").trim() || W(lang, "Client", "Cliente");
              const role = [t.author_role, t.author_company].map(x => (x ?? "").trim()).filter(Boolean).join(" · ");
              return (
                <li key={t.id} className="flex gap-3">
                  {t.author_photo_url
                    ? <img decoding="async" src={t.author_photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-[13px] font-bold text-brand">
                        {who[0]?.toUpperCase()}
                      </div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold">{who}</span>
                      {sample && (
                        <span className="shrink-0 rounded-full border border-amber-600/40 px-1.5 py-[2px] text-[10.5px] font-bold leading-none text-amber-700 dark:border-amber-300/40 dark:text-amber-300">
                          {W(lang, "Sample", "Muestra")}
                        </span>
                      )}
                    </div>
                    {role && <p className="truncate text-[11.5px] opacity-60">{role}</p>}
                    <p className="mt-0.5 text-[13px] leading-relaxed opacity-80">{t.quote_text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
