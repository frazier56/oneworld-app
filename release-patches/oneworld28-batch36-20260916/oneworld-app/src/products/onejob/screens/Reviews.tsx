import { ScreenHeading } from "@oneworld/shell";
import { useState } from "react";
import { useQuery, useQueryClient } from "@job/lib/query";
import { supabase } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import { useI18n } from "@job/lib/i18n";
import ReviewModal from "@job/components/ReviewModal";
import ReportBlockSheet from "@job/components/ReportBlockSheet";
import BackLink from "@job/components/BackLink";
import Coachmark from "@job/components/Coachmark";

export default function Reviews() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<"received" | "given">("received");
  /** The received review being reported, or null. */
  const [reportReview, setReportReview] = useState<{ id: string; userId: string } | null>(null);
  const [pendingReview, setPendingReview] = useState<any>(null);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["reviews-page", user?.id, tab], enabled: !!user,
    queryFn: async () => {
      const col = tab === "received" ? "reviewee_id" : "reviewer_id";
      const { data } = await supabase.from("job_reviews")
        .select("id, rating, comment, created_at, reviewer_id, reviewee_id")
        .eq(col, user!.id).order("created_at", { ascending: false }).limit(40);
      return data ?? [];
    },
  });

  const { data: pending } = useQuery({
    queryKey: ["pending-reviews", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: ex } = await supabase.from("job_executions")
        .select("id, host_id, talent_id, agreement_id, status")
        .or(`host_id.eq.${user!.id},talent_id.eq.${user!.id}`).eq("status", "completed")
        .order("completed_at", { ascending: false }).limit(20);
      if (!ex?.length) return [];
      const { data: mine } = await supabase.from("job_reviews").select("execution_id").eq("reviewer_id", user!.id).in("execution_id", ex.map(e => e.id));
      const done = new Set((mine ?? []).map(r => r.execution_id));
      const todo = ex.filter(e => !done.has(e.id));
      const ids = todo.map(e => e.agreement_id).filter(Boolean);
      let map: any = {};
      if (ids.length) { const { data: ags } = await supabase.from("agreements").select("id, title").in("id", ids); map = Object.fromEntries((ags ?? []).map(a => [a.id, a])); }
      return todo.map(e => ({ ...e, title: map[e.agreement_id!]?.title ?? "Job" }));
    },
  });

  return (
    <div className="space-y-4">
      <BackLink to="/jobs" label={t("home")} />
      <ScreenHeading>⭐ {t("reviews")}</ScreenHeading>
      <Coachmark id="reviews-value" textKey="tipReviewsValue" />

      {!!pending?.length && (
        <section className="space-y-2">
          {pending.map(p => (
            <div key={p.id} className="card flex items-center justify-between gap-2 border-brand/40 bg-brand/5 p-4">
              <div><p className="text-xs font-bold uppercase text-brand">{t("pendingReview")}</p><p className="font-bold">{p.title}</p></div>
              <button onClick={() => setPendingReview(p)} className="btn-primary !py-2 px-4 text-sm">⭐ {t("reviewSubmit")}</button>
            </div>
          ))}
        </section>
      )}

      <div className="flex rounded-xl bg-ink/5 p-1 dark:bg-white/10">
        {(["received", "given"] as const).map(k => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === k ? "bg-white shadow dark:bg-ink" : "opacity-60"}`}>
            {k === "received" ? t("revReceived") : t("revGiven")}
          </button>
        ))}
      </div>

      {!data?.length ? <p className="py-10 text-center opacity-50">—</p> : (
        <div className="space-y-2">
          {/* Report sits on RECEIVED reviews only. A review you were given is written about you by
              someone else and is permanent and public — it's the piece of user-generated content on
              this platform with the most power to damage a person, and until now there was no way
              to flag one. Reviews you GAVE are your own words; reporting them would be nonsense.
              (Apple 1.2 — Jul 31 2026) */}
          {data.map(r => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-brand">{"★".repeat(Math.max(1, Math.round((r.rating / 7) * 5)))}<span className="ml-1 text-xs opacity-60">{Number(r.rating).toFixed(1)}</span></span>
                  {r.comment && <p className="mt-1 text-sm opacity-70">{r.comment}</p>}
                  <p className="mt-1 text-xs opacity-40">{new Date(r.created_at).toLocaleDateString(lang === "es" ? "es" : "en")}</p>
                </div>
                {tab === "received" && (
                  <button
                    onClick={() => setReportReview({ id: r.id, userId: r.reviewer_id })}
                    aria-label="Report this review"
                    className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold opacity-40 transition hover:text-red-500 hover:opacity-100">
                    Report
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingReview && user && (
        <ReviewModal executionId={pendingReview.id} reviewerId={user.id}
          revieweeId={pendingReview.host_id === user.id ? pendingReview.talent_id : pendingReview.host_id}
          revieweeIsHost={pendingReview.host_id !== user.id}
          jobTitle={pendingReview.title}
          onClose={() => { setPendingReview(null); qc.invalidateQueries({ queryKey: ["pending-reviews"] }); }} />
      )}

      <ReportBlockSheet
        open={!!reportReview}
        onClose={() => setReportReview(null)}
        targetType="review"
        targetId={reportReview?.id ?? ""}
        targetUserId={reportReview?.userId}
        onBlocked={() => { setReportReview(null); qc.invalidateQueries({ queryKey: ["reviews"] }); }}
      />
    </div>
  );
}
