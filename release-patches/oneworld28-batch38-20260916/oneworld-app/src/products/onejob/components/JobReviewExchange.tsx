import { useQuery } from "@job/lib/query";
import { supabase } from "@job/lib/supabase";
import { useI18n, W } from "@job/lib/i18n";

/**
 * DID THEY REVIEW YOU, AND DID YOU REVIEW THEM.
 *
 * Lee, 1 Aug 2026: *"if I click on that job, I should be able to see if she gave me a review or
 * not, and then it should show up on my page if she gave me a review. There should be some section
 * that says no review was left."*
 *
 * ── What was actually broken ─────────────────────────────────────────────────────────────────
 * Checked the database first: Lee has two completed jobs, and there are ZERO rows in `job_reviews`
 * touching him in either direction. So the profile's "0 reviews" was telling the truth — the
 * reviews were never written.
 *
 * The reason is the prompt. `MyJobs` opens the review modal in exactly one moment: the instant
 * `markComplete` comes back with `both: true`. If you were the FIRST side to mark complete, that
 * moment never happens for you. If you dismissed the sheet, it never comes back. There is a
 * pending-reviews list on the Reviews page that would have caught it, but nothing on the job
 * itself says a review is outstanding, so there was no reason to go looking.
 *
 * A review that can only be left during a two-second window after a button press is a review that
 * mostly doesn't get left. This block makes the state permanent and visible on the job: what you
 * gave, what you got, and a way to fix the first one.
 *
 * ── Why "No review left" is stated rather than hidden ────────────────────────────────────────
 * Silence reads as "not loaded yet". A marketplace that hides the absence of a review is quietly
 * flattering — and on a credibility product, an absence people can't see is an absence they can't
 * chase. Both directions are named, including the unflattering one.
 */

export default function JobReviewExchange({ executionId, meId, otherName, onLeaveReview }: {
  executionId: string;
  meId: string;
  otherName: string;
  /** Opens the review modal. Absent when there is nothing to open (e.g. a cancelled job). */
  onLeaveReview?: () => void;
}) {
  const { lang } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["job-review-exchange", executionId, meId],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("job_reviews")
        .select("id, reviewer_id, reviewee_id, rating, comment, created_at")
        .eq("execution_id", executionId);
      const rows = data ?? [];
      return {
        given: rows.find(r => r.reviewer_id === meId) ?? null,
        received: rows.find(r => r.reviewee_id === meId) ?? null,
      };
    },
  });

  if (isLoading) return null;

  const stars = (rating: number) => "★".repeat(Math.max(1, Math.round((rating / 7) * 5)));

  const Row = ({ label, review, empty, action }: {
    label: string; review: { rating: number; comment: string | null; created_at: string } | null;
    empty: string; action?: React.ReactNode;
  }) => (
    <div className="py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-45">{label}</p>
      {review ? (
        <>
          <p className="mt-1 text-sm font-semibold text-brand">
            {stars(review.rating)}
            <span className="ml-1.5 text-[11px] font-medium opacity-55">
              {new Date(review.created_at).toLocaleDateString(lang === "es" ? "es" : "en")}
            </span>
          </p>
          {review.comment && <p className="mt-1 text-[12.5px] leading-snug opacity-75">{review.comment}</p>}
        </>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-[12.5px] opacity-55">{empty}</p>
          {action}
        </div>
      )}
    </div>
  );

  return (
    <section className="mt-4 rounded-2xl border border-ink/10 px-3.5 py-1 dark:border-white/10">
      <div className="divide-y divide-ink/5 dark:divide-white/5">
        <Row
          label={W(lang, "Your review of them", "Tu reseña sobre ellos")}
          review={data?.given ?? null}
          empty={W(lang, "You haven’t reviewed this job yet.", "Todavía no has reseñado este trabajo.")}
          action={onLeaveReview ? (
            <button onClick={onLeaveReview}
              className="shrink-0 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-bold text-brand">
              {W(lang, "Leave a review", "Dejar reseña")}
            </button>
          ) : undefined}
        />
        <Row
          label={W(lang, "Their review of you", "Su reseña sobre ti")}
          review={data?.received ?? null}
          /* Named, not nudged. There is no button here on purpose — you cannot make someone review
             you, and a "remind them" control on a completed job is a way to pester a client. */
          empty={W(lang, `${otherName} hasn’t left a review yet.`, `${otherName} todavía no ha dejado una reseña.`)}
        />
      </div>
    </section>
  );
}
