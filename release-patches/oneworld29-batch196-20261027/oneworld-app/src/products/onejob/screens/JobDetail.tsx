import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@job/lib/query";
import { supabase } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import { useI18n, W } from "@job/lib/i18n";
import BackLink from "@job/components/BackLink";
import { IconPin } from "@job/components/ActionIcons";
import { IconCalendar } from "@job/components/ActionIcons";
import LinkJobToMyEvent from "@job/components/LinkJobToMyEvent";
import { ShareSheet, startConversation, publicUrl } from "@oneworld/shell";
import { Share2 } from "lucide-react";

export default function JobDetail() {
  /* The route is `j/:id` — reading `jobId` here left it undefined and the screen never loaded. */
  const { id: jobId } = useParams();
  const [sharing, setSharing] = useState(false);
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [note, setNote] = useState("");
  /* Said on the screen, not only in the console — a member who taps Apply and sees nothing
     change has no way to tell "sent" from "refused". */
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs")
        .select("id, user_id, title, description, location, pay_type, pay_range, fixed_pay_amount, category, created_at, start_date, end_date, requirements, positions_available, applicants_count, status, direct_recipient_id, background_image_url")
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

  /* Max W12-APPLY (23 Oct 2026): the application and the chat are two different outcomes. A saved
     application stays saved even if the chat cannot open, and a lost answer is checked by READING,
     never by sending again. One tap at a time, decided synchronously. */
  const applyLock = useRef(false);
  const apply = async () => {
    if (applyLock.current || !user) return;
    applyLock.current = true;
    setBusy(true); setApplyErr(null); setApplyNote(null);
    try {
      /* 1) The application. PostgREST does not throw: a refusal arrives in `error` with a SQLSTATE /
            PGRST code; a lost answer arrives with an EMPTY code and may well have committed. */
      let saved: "ok" | "refused" | "unknown" = "unknown";
      try {
        const { data, error } = await supabase.from("platform_job_applications").insert({
          job_id: jobId, applicant_id: user.id, cover_message: note.trim() || null, status: "submitted",
        }).select("id").single();
        const code = (error?.code ?? "").trim();
        if (!error && data && typeof (data as { id?: unknown }).id === "string") saved = "ok";
        else if (code === "23505") saved = "unknown";                     // a uniqueness clash: READ BACK, don't assume which (Max W12R2)
        else if (/^[0-9A-Z]{5}$/.test(code) || /^PGRST\d+$/.test(code)) saved = "refused";
        if (error) console.error("[onejob] application insert —", code || "no code", error.message);
      } catch (e: any) { console.error("[onejob] application insert threw —", e?.message ?? e); }
      if (saved === "unknown") {
        try {
          const { data, error } = await supabase.from("platform_job_applications").select("id")
            .eq("job_id", jobId!).eq("applicant_id", user.id).maybeSingle();
          if (!error) saved = data ? "ok" : "refused";
        } catch { /* stays unknown */ }
      }
      if (saved !== "ok") {
        setApplyErr(saved === "refused"
          ? W(lang, "That application didn't go through. Nothing was sent — please try again.", "Esa postulación no se envió. No se guardó nada — intenta de nuevo.")
          : W(lang, "We couldn't confirm your application. Refresh this page to check before trying again.", "No pudimos confirmar tu postulación. Recarga esta página para comprobarlo antes de intentarlo de nuevo."));
        return;
      }
      qc.invalidateQueries({ queryKey: ["applied", jobId] });

      /* 2) The chat with the poster. Separate: it can fail without un-applying anybody.
         ONE DOOR FOR STARTING A CHAT (10 Oct 2026): `startConversation()` is the shell's single helper. */
      if (job?.user_id && job.user_id !== user.id) {
        let chatOk = false;
        try {
          const res = await startConversation(
            user.id,
            job.user_id,
            `👋 I just applied to "${job.title}"${note.trim() ? ` — ${note.trim()}` : ""}`,
            { conversationMetadata: { source: "job_application", job_id: jobId, job_title: job.title } },
          );
          chatOk = !("error" in res);
          if (!chatOk) console.error("[onejob] application thread failed:", (res as { error: string }).error);
        } catch (e: any) { console.error("[onejob] application thread threw —", e?.message ?? e); }
        if (!chatOk) setApplyNote(W(lang,
          "You applied. We couldn't open a chat with the poster — you can message them from Messages.",
          "Te postulaste. No pudimos abrir un chat con quien publicó — puedes escribirle desde Mensajes."));
      }
    } finally {
      setBusy(false);
      applyLock.current = false;
    }
  };

  if (!job) return <div className="card h-40 animate-pulse" />;
  const pay = job.fixed_pay_amount ? `$${job.fixed_pay_amount}` : job.pay_range || "";
  /* Only an open posting can be shared — a direct offer is private to its one recipient. */
  const shareable = ["live", "published"].includes(String(job.status)) && !job.direct_recipient_id;
  /* OJ-173-LEGACY-06: an unparseable stored date used to render the literal words "Invalid Date"
     on the posting. Nothing is better than nonsense — an unreadable date is simply not shown. */
  const fmt = (s?: string | null) => {
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString((lang === "es" || lang === "co") ? "es" : "en",
      { weekday: "short", month: "short", day: "numeric" });
  };

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
        {shareable && (
          <button onClick={() => setSharing(true)} className="btn-ghost inline-flex w-full items-center justify-center gap-2 !py-2.5 text-sm font-semibold">
            <Share2 size={16} />{W(lang, "Share", "Compartir")}
          </button>
        )}
      </div>
      {sharing && (
        <ShareSheet onClose={() => setSharing(false)} card={{
          kind: "job", entityId: job.id, app: "jobs", title: job.title,
          subtitle: [pay, job.location].filter(Boolean).join(" · "),
          badge: (lang === "es" || lang === "co") ? "Se busca" : "Hiring",
          coverUrl: job.background_image_url ?? null, brand: "onejob",
          fallbackUrl: publicUrl(`/jobs/j/${job.id}`),
        }} />
      )}

      {/* v21 BZ (Lee): "from that job, at the bottom, it should have a link that says
          link job to [my event]" — the OneJob side of the two-way event↔job link. Owners
          see this instead of an apply box for their own posting. */}
      {user && job.user_id === user.id ? (
        <LinkJobToMyEvent jobId={job.id} userId={user.id} />
      ) : applied ? (
        <div className="card border-brand/30 bg-brand/5 p-4 text-center font-semibold text-brand">✓ {t("appliedOk")}
          {applyNote && <p role="status" className="mt-2 text-[13px] font-medium text-ink/70 dark:text-white/70">{applyNote}</p>}
        </div>
      ) : (
        <div className="card space-y-3 p-5">
          {/* OJ-AUTH-A11Y-09: the label was a bare <label> with no `htmlFor` and the textarea had
              no id, so a screen reader announced an unnamed text box. The visible words are the
              name — they just had to be connected. */}
          <label className="label" htmlFor="onejob-cover-note">{t("coverNote")}</label>
          <textarea id="onejob-cover-note" className="input min-h-[70px]"
            value={note} onChange={e => setNote(e.target.value)}
            aria-describedby={applyErr ? "onejob-apply-error" : undefined} />
          <button onClick={apply} disabled={busy} className="btn-primary w-full">{busy ? "…" : t("apply")}</button>
          {applyErr && (
            <p id="onejob-apply-error" role="alert" className="text-[13px] font-semibold text-red-500">{applyErr}</p>
          )}
        </div>
      )}
    </div>
  );
}
