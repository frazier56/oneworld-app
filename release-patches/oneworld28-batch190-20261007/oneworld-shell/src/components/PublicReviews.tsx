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
 * ── THE SUMMARY, LIKE GOOGLE (16 Oct 2026) ─────────────────────────────────────────────────
 * Lee: *"everyone should have star ratings, like literally physical yellow stars… half stars,
 * 3/4 stars, 1/4 stars… and a number… 3.6, 4.8, 4.2… how many reviews… and if you don't have any
 * reviews yet, it's just gonna say no reviews yet."* So: a big average to one decimal, five yellow
 * stars filled to the nearest quarter, and the count — on EVERY profile, own and public.
 *
 * ONE SOURCE FOR THE NUMBER. It reads `member_review_ledger` (job + rental host/guest + the shared
 * review sheet every app now uses), not `job_reviews` alone — an agent's host reviews or a driver's
 * ride reviews would otherwise be invisible here. Job ratings are 1..7 and are put on the 5 scale;
 * the others are already 1..5. The average is taken over ALL rows, not the ten shown.
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
export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  /* Filled to the nearest quarter: 4.6 → four full and a three-quarter star. */
  const q = Math.max(0, Math.min(5, Math.round(value * 4) / 4));
  return (
    <span className="inline-flex shrink-0 items-center gap-[2px]" aria-hidden>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, q - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0 text-ink/20 dark:text-white/25">
              <path fill="currentColor" d={STAR} />
            </svg>
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <svg viewBox="0 0 24 24" width={size} height={size}><path fill="#FBBC04" d={STAR} /></svg>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
const STAR = "M12 2.6l2.85 6.03 6.6.8-4.87 4.53 1.27 6.54L12 17.3l-5.85 3.2 1.27-6.54L2.55 9.43l6.6-.8z";

const to5 = (system: string, rating: number) => system === "job" ? rating / 7 * 5 : rating;

export default function PublicReviews({ userId }: { userId: string }) {
  const { lang } = useI18n();

  const data = useAsync(async () => {
    const { data: rows, error } = await supabase.from("member_review_ledger")
      .select("system, app, reviewer_id, rating, comment, created_at")
      .eq("reviewee_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) { console.error("[PublicReviews] member_review_ledger read failed:", error.message); throw error; }
    const all = ((rows ?? []) as {
      system: string; app: string | null; reviewer_id: string; rating: number; comment: string | null; created_at: string;
    }[]).filter(r => Number.isFinite(r.rating));
    const avg = all.length ? all.reduce((a, r) => a + to5(r.system, r.rating), 0) / all.length : null;
    const list = all.slice(0, 10);

    /* Reviewer names in ONE batched follow-up, columns named — `select('*')` on profiles throws
       42501 under the column-level grants. */
    const ids = [...new Set(list.map(r => r.reviewer_id))];
    let names: Record<string, { full_name: string | null; photo_url: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("id, full_name, photo_url").in("id", ids);
      names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, photo_url: p.photo_url }]));
    }

    /* Testimonials: only `active` ones are public (RLS says the same). A failed read hides the block
       rather than the whole card — reviews are the stronger signal and must not depend on it. */
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
    return { list, total: all.length, names, avg, testimonials, sample: !!(owner as any)?.is_sample };
  }, [userId], !!userId);

  const list = data?.list ?? [];
  const testimonials = data?.testimonials ?? [];
  const sample = !!data?.sample;
  /* ── SAMPLE PROFILES ONLY (Lee, 16 Oct 2026: "yeah, you can put a sample on there") ─────────
     Aria and Juan are demo agents with testimonials and no real reviews, so the summary would read
     "No reviews yet" on the two profiles we show people. On a profile flagged `is_sample` — and
     ONLY there, and only while it has no real reviews — each testimonial carries a fixed demo
     rating and the summary is built from those, tagged "Sample". Nothing is written to the
     database, so OneScore and every real member's numbers are untouched. */
  const SAMPLE_STARS = [5, 4.5, 5, 4.75, 4.5];
  /* A sample profile with no testimonials (Juan, 16 Oct) still shows a sample summary, so every
     demo agent reads the same way; the count is a fixed demo figure, never stored anywhere. */
  const demo = sample && (data?.total ?? 0) === 0;
  const demoStar = (i: number) => SAMPLE_STARS[i % SAMPLE_STARS.length];
  const total = demo ? (testimonials.length || 18) : (data?.total ?? 0);
  const avg = demo
    ? (testimonials.length
        ? testimonials.reduce((a, _t, i) => a + demoStar(i), 0) / testimonials.length
        : 4.7)
    : (data?.avg ?? null);
  const loc = lang === "es" || lang === "co" ? "es-CO" : lang;
  const one = (n: number) => { try { return n.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); } catch { return n.toFixed(1); } };

  return (
    <section className="card p-4" id="ow-reviews">
      <h2 className="mb-2.5 font-bold">{W(lang, "Reviews", "Reseñas")}</h2>

      {/* ── THE SUMMARY: average, stars, count. Always drawn while loaded, so an empty profile
             still shows the five empty stars beside "No reviews yet". ── */}
      {data && (
        <div className="mb-3 flex items-center gap-3" data-ow="rating-summary">
          <span className="text-[34px] font-black leading-none tabular-nums">{avg != null ? one(avg) : "–"}</span>
          <div className="min-w-0">
            <Stars value={avg ?? 0} size={20} />
            <p className="mt-1 text-[12.5px] font-semibold opacity-60">
              {demo && (
                <span className="mr-1.5 rounded-full border border-amber-600/40 px-1.5 py-[2px] text-[10.5px] font-bold leading-none text-amber-700 dark:border-amber-300/40 dark:text-amber-300">
                  {W(lang, "Sample", "Muestra")}
                </span>
              )}
              {total === 0 ? W(lang, "No reviews yet", "Aún no hay reseñas")
                : total === 1 ? W(lang, "1 review", "1 reseña")
                : `${total.toLocaleString(loc)} ${W(lang, "reviews", "reseñas")}`}
            </p>
          </div>
          {avg != null && <span className="sr-only">{one(avg)} / 5</span>}
        </div>
      )}

      {list.length > 0 && (
        <ul className="space-y-3 border-t border-ink/10 pt-3 dark:border-white/10">
          {list.map((r, i) => {
            const who = data!.names[r.reviewer_id];
            return (
              <li key={`${r.reviewer_id}-${r.created_at}-${i}`} className="flex gap-3">
                {who?.photo_url
                  ? <img decoding="async" src={who.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-[13px] font-bold text-brand">
                      {(who?.full_name ?? "·")[0]?.toUpperCase()}
                    </div>}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-[13.5px] font-semibold">{who?.full_name ?? (W(lang, "Member", "Miembro"))}</span>
                    <Stars value={to5(r.system, r.rating)} size={13} />
                  </div>
                  {r.comment && <p className="mt-0.5 text-[13px] leading-relaxed opacity-75">{r.comment}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {testimonials.length > 0 && (
        <div className="mt-4 border-t border-ink/10 pt-3 dark:border-white/10" data-ow="testimonials">
          <h3 className="text-[13.5px] font-bold">{W(lang, "Testimonials", "Testimonios")}</h3>
          <p className="mb-2.5 text-[11.5px] opacity-60">
            {W(lang, "Added by this member. Not from a job on One World.", "Agregados por este miembro. No provienen de un trabajo en One World.")}
          </p>
          <ul className="space-y-3">
            {testimonials.map((t, ti) => {
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
                    {demo && <div className="mt-0.5"><Stars value={demoStar(ti)} size={13} /></div>}
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
