import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@job/lib/query";
import { supabase } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import { useI18n } from "@job/lib/i18n";
import BackLink from "@job/components/BackLink";
import { IconPin } from "@job/components/ActionIcons";
import { IconCalendar } from "@job/components/ActionIcons";
import LinkJobToMyEvent from "@job/components/LinkJobToMyEvent";

export default function JobDetail() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs")
        .select("id, user_id, title, description, location, pay_type, pay_range, fixed_pay_amount, category, created_at, start_date, end_date, requirements, positions_available, applicants_count")
        .eq("id", jobId!).maybeSingle();
      return data;
    },
  });

  const { data: applied } = useQuery({
    queryKey: ["applied", jobId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("platform_job_applications").select("id")
        .eq("job_id", jobId!).eq("applicant_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const apply = async () => {
    setBusy(true);
    try {
      await supabase.from("platform_job_applications").insert({
        job_id: jobId, applicant_id: user!.id, cover_message: note.trim() || null, status: "submitted",
      });
      // open a conversation with the poster (matches engine behavior)
      if (job?.user_id && job.user_id !== user!.id) {
        const { data: convos } = await supabase.from("conversations").select("id")
          .contains("participant_ids", [user!.id, job.user_id]).limit(1);
        let cid = convos?.[0]?.id;
        if (!cid) {
          const { data: c } = await supabase.from("conversations").insert({
            participant_ids: [user!.id, job.user_id], category: "jobs",
            last_message_text: `Applied: ${job.title}`, last_message_at: new Date().toISOString(),
          }).select("id").single();
          cid = c?.id;
        }
        if (cid) await supabase.from("messages").insert({
          conversation_id: cid, sender_id: user!.id, message_type: "text",
          content: `👋 I just applied to "${job.title}"${note.trim() ? ` — ${note.trim()}` : ""}`,
        });
      }
      qc.invalidateQueries({ queryKey: ["applied", jobId] });
    } catch {}
    setBusy(false);
  };

  if (!job) return <div className="card h-40 animate-pulse" />;
  const fmt = (s?: string | null) => s ? new Date(s).toLocaleDateString(lang === "es" ? "es" : "en", { weekday: "short", month: "short", day: "numeric" }) : null;

  return (
    <div className="space-y-4">
      <BackLink to="/jobs/find" label={t("jobs")} />
      <div className="card space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-extrabold">{job.title}</h1>
          <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1.5 text-sm font-bold text-brand">
            {job.fixed_pay_amount ? `$${job.fixed_pay_amount}` : job.pay_range || "$—"}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-60">
          {job.location && <span className="inline-flex items-center gap-1"><IconPin size={13} />{job.location}</span>}
          {job.start_date && <span className="inline-flex items-center gap-1"><IconCalendar size={13} />{fmt(job.start_date)}{job.end_date && job.end_date !== job.start_date ? ` – ${fmt(job.end_date)}` : ""}</span>}
          {job.category && <span>🏷️ {job.category}</span>}
        </div>
        {job.description && <p className="whitespace-pre-wrap text-[15px] leading-relaxed opacity-80">{job.description}</p>}
        {job.requirements && <div><h2 className="mb-1 font-bold">{t("requirements")}</h2>
          <p className="whitespace-pre-wrap text-sm opacity-70">{String(job.requirements)}</p></div>}
      </div>

      {/* v21 BZ (Lee): "from that job, at the bottom, it should have a link that says
          link job to [my event]" — the OneJob side of the two-way event↔job link. Owners
          see this instead of an apply box for their own posting. */}
      {user && job.user_id === user.id ? (
        <LinkJobToMyEvent jobId={job.id} userId={user.id} />
      ) : applied ? (
        <div className="card border-brand/30 bg-brand/5 p-4 text-center font-semibold text-brand">✓ {t("appliedOk")}</div>
      ) : (
        <div className="card space-y-3 p-5">
          <label className="label">{t("coverNote")}</label>
          <textarea className="input min-h-[70px]" value={note} onChange={e => setNote(e.target.value)} />
          <button onClick={apply} disabled={busy} className="btn-primary w-full">{busy ? "…" : t("apply")}</button>
        </div>
      )}
    </div>
  );
}
