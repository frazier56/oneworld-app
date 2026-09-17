/**
 * EventApply — Public-facing application form for paid events that require an application.
 * Guests answer the application first, then create/sign into One ID at checkout. The
 * completed answers are handed off locally and become a server application only after
 * identity is known, avoiding duplicate name/email capture and mismatched Google accounts.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@evt/hooks/useAuth";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { supabase } from "@evt/integrations/supabase/client";
import { Navbar } from "@evt/components/Navbar";
import { Footer } from "@evt/components/Footer";
import { ArrowLeft, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@evt/components/ui/input";
import ApplicationFormRenderer, { AnswerMap } from "@evt/components/events/ApplicationFormRenderer";
import { captureContact } from "@evt/lib/contactCapture";
import { ScreenHeading } from "@oneworld/shell";

/* DRAFT SAFETY: an interrupted application must survive a closed tab/browser, not merely
   a Back tap in the same tab. Keep the local draft for seven days. Once the applicant
   presses Request to join, the server-side application becomes the durable copy; the
   browser copy stays until payment authorization succeeds so every hand-off is resumable. */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const draftKey = (id: string) => `evt-apply-draft-${id}`;
const draftTokenKey = (id: string) => `evt-apply-token-${id}`;
type ApplyDraft = {
  t: number;
  answers?: AnswerMap;
  /* Legacy fields remain readable so an in-progress pre-refactor application survives. */
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestPhoneCountry?: string;
};
const splitDisplayName = (value?: string) => {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
};
function readDraft(id: string): ApplyDraft | null {
  try {
    // Read the durable copy first, then migrate the previous same-tab draft if present.
    const raw = localStorage.getItem(draftKey(id)) || sessionStorage.getItem(draftKey(id));
    if (!raw) return null;
    const d = JSON.parse(raw) as ApplyDraft;
    /* Remove only Codex-created production QA fixtures. A live screenshot exposed one of
       these test drafts on Lee's browser because draft recovery correctly remembered it.
       Real applicant drafts remain resumable for the full seven-day window. */
    const qaFingerprint = JSON.stringify(d).toLowerCase();
    if (
      qaFingerprint.includes("permission ui qa") ||
      qaFingerprint.includes("qa-live checkout-") ||
      qaFingerprint.includes("qa draft capture") ||
      qaFingerprint.includes("internal qa") ||
      qaFingerprint.includes("quality assurance")
    ) {
      localStorage.removeItem(draftKey(id));
      sessionStorage.removeItem(draftKey(id));
      localStorage.removeItem(draftTokenKey(id));
      return null;
    }
    if (!d?.t || Date.now() - d.t > DRAFT_TTL_MS) {
      localStorage.removeItem(draftKey(id));
      sessionStorage.removeItem(draftKey(id));
      return null;
    }
    localStorage.setItem(draftKey(id), raw);
    return d;
  } catch { return null; }
}

export default function EventApply() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [event, setEvent] = useState<any>(null);
  const [form, setForm] = useState<{ questions: any[]; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft] = useState<ApplyDraft | null>(() => (id ? readDraft(id) : null));
  const initialGuestName = splitDisplayName(draft?.guestName);
  const [guestFirstName, setGuestFirstName] = useState(initialGuestName.first);
  const [guestLastName, setGuestLastName] = useState(initialGuestName.last);
  const [nameError, setNameError] = useState("");
  const guestName = [guestFirstName.trim(), guestLastName.trim()].filter(Boolean).join(" ");
  const [resumeToken] = useState(() => {
    if (!id) return "";
    try {
      const fromLink = new URLSearchParams(window.location.search).get("resumeDraft") || "";
      const stored = localStorage.getItem(draftTokenKey(id)) || "";
      const token = /^[0-9a-f-]{36}$/i.test(fromLink)
        ? fromLink
        : (/^[0-9a-f-]{36}$/i.test(stored) ? stored : crypto.randomUUID());
      localStorage.setItem(draftTokenKey(id), token);
      return token;
    } catch {
      return crypto.randomUUID();
    }
  });
  const [liveAnswers, setLiveAnswers] = useState<AnswerMap>(draft?.answers ?? {});

  /* Recover older server drafts when the prior version already captured an email. New
     anonymous drafts stay on this device until the applicant chooses Google or Email. */
  useEffect(() => {
    if (!id || !resumeToken || user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await (supabase as any).rpc("get_event_application_draft", {
          p_event_id: id,
          p_resume_token: resumeToken,
        });
        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled && row) {
          if (row.applicant_name) {
            const parts = splitDisplayName(row.applicant_name);
            setGuestFirstName(parts.first);
            setGuestLastName(parts.last);
          }
          if (row.answers && typeof row.answers === "object") setLiveAnswers(row.answers as AnswerMap);
        }
      } catch (error) {
        console.warn("[EventApply] server draft recovery unavailable", error);
      }
    })();
    return () => { cancelled = true; };
  }, [id, resumeToken, user?.id]);

  // Persist on every change so closing the tab, browser, or an in-app browser does not
  // force the applicant to start over on this device.
  useEffect(() => {
    if (!id) return;
    try {
      localStorage.setItem(draftKey(id), JSON.stringify({
        t: Date.now(), guestName, answers: liveAnswers,
      } satisfies ApplyDraft));
    } catch { /* storage full/private mode — the form still works, just without draft safety */ }
  }, [id, guestName, liveAnswers]);

  /* A name-only server draft lets the host/support team identify an abandoned first page.
     Email and phone are deliberately deferred to the single account step on page two. */
  useEffect(() => {
    if (!id || !resumeToken || user?.id || !guestFirstName.trim() || !guestLastName.trim()) return;
    const timer = window.setTimeout(() => {
      void (supabase as any).rpc("upsert_event_application_draft", {
        p_event_id: id,
        p_resume_token: resumeToken,
        p_name: guestName,
        p_email: null,
        p_phone: null,
        p_phone_country: null,
        p_answers: liveAnswers as any,
      }).then(({ error }: { error?: { message?: string } | null }) => {
        if (error) console.warn("[EventApply] name-only draft save unavailable", error.message);
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [id, resumeToken, user?.id, guestFirstName, guestLastName, guestName, liveAnswers]);

  const [profile, setProfile] = useState<{ full_name?: string; email?: string; phone?: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
      if (!ev) { navigate("/events"); return; }
      setEvent(ev);

      if (!ev.requires_application) {
        navigate(`/events/e/${id}/checkout`, { replace: true });
        return;
      }

      const { data: f } = await supabase
        .from("event_application_forms")
        .select("questions, title, is_active")
        .eq("event_id", id)
        .maybeSingle();

      if (!f || !(f as any).is_active || !Array.isArray((f as any).questions) || (f as any).questions.length === 0) {
        // Form gate is on but no questions configured — fall through to normal checkout
        navigate(`/events/e/${id}/checkout`, { replace: true });
        return;
      }

      setForm({ questions: (f as any).questions, title: (f as any).title || "Apply to attend" });

      if (user?.id) {
        /* full_name is a granted public column; email/phone are owner-private and only come
           back from the my_private_profile() RPC — selecting them off profiles throws 42501. */
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        let priv: Record<string, unknown> = {};
        try {
          const { data: privData } = await supabase.rpc("my_private_profile");
          const row = Array.isArray(privData) ? privData[0] : privData;
          if (row && typeof row === "object") priv = row as Record<string, unknown>;
        } catch { /* degrade — the session e-mail below still covers the applicant */ }
        setProfile({
          full_name: (prof as any)?.full_name ?? undefined,
          email: (priv.email as string | undefined) ?? user.email ?? undefined,
          phone: (priv.phone as string | undefined) ?? undefined,
        });
      }

      setLoading(false);
    };
    load();
  }, [id, user?.id, navigate]);

  const handleSubmit = async (answers: AnswerMap) => {
    if (!id || !event) return;
    const isGuest = !user?.id;

    /* Guests establish identity once, at the top of checkout. Keeping the application
       page question-only avoids collecting an email here and then asking for Google or
       Email again on the very next screen. */
    if (isGuest) {
      if (!guestFirstName.trim() || !guestLastName.trim()) {
        setNameError("Please add your first and last name to continue.");
        toast.error("Please add your first and last name to continue.");
        return;
      }
      try {
        localStorage.setItem(draftKey(id), JSON.stringify({ t: Date.now(), guestName, answers } satisfies ApplyDraft));
      } catch { /* checkout also receives the handoff flag; private-mode users can retry */ }
      toast.success(t("apply.saved", "Application saved. Create your account, then continue to payment."));
      navigate(`/events/e/${id}/checkout?applicationDraft=1`);
      return;
    }

    setSubmitting(true);
    try {
      const applicantName = profile?.full_name || user?.email || "Applicant";
      const applicantEmail = profile?.email || user?.email || "";
      const applicantPhone = profile?.phone || null;

      /* Save the completed form first. For paid approval-gated events the host may see it
         as Awaiting payment, but approval stays locked until Stripe confirms authorization. */
      const { data: appId, error } = await supabase.rpc("submit_event_application", {
        p_event_id: id,
        p_name: applicantName,
        p_email: applicantEmail,
        p_phone: applicantPhone,
        p_answers: answers as any,
        p_ticket_type: "ga",
        p_quantity: 1,
      });

      if (error) throw error;
      const applicationId = appId as string;
      if (!applicationId) throw new Error("Could not submit your request. Please try again.");

      // Forward to checkout with applicationId so Stripe metadata can link it
      const params = new URLSearchParams({ applicationId });
      /* v24 DG-UX (Lee): on a FREE approval-gated event there is nothing to pay — skip the
         pointless "Confirm free ticket" tap. pending=1 makes checkout stamp the request
         server-side on arrival and show the full "request sent" confirmation screen. */
      const gatedFree =
        event.requires_application && (event as any).application_requires_approval &&
        (((event as any).ga_ticket_price || (event as any).ticket_price || 0) === 0) &&
        (((event as any).vip_ticket_price || 0) === 0);
      if (gatedFree) {
        supabase.functions
          .invoke("score-event-application", { body: { applicationId } })
          .catch(err => console.warn("[score-event-application] async error:", err));
        toast.success(t("apply.sent", "Request sent to the host — a copy is on its way to your email."));
        try {
          localStorage.removeItem(draftKey(id));
          sessionStorage.removeItem(draftKey(id));
        } catch { /* the completed server record is already durable */ }
      } else {
        toast.success(t("apply.saved", "Application saved. Continue with your details and payment."));
      }
      if (gatedFree && !isGuest) params.set("pending", "1");
      navigate(`/events/e/${id}/checkout?${params.toString()}`);
    } catch (err: any) {
      console.error("Apply submit error:", err);
      toast.error(err.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !event) {
    return (
      <div>
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      {/* AppShell provides the max-w-lg column — old page chrome removed. */}
      <div className="pb-8">
        {/* Page title on the VAIA row (Lee, 17 Aug 2026): the header had a bare "Tap for
            insights" pill floating over nothing — every screen carries its name. */}
        <ScreenHeading>{t("apply.title", "Register")}</ScreenHeading>
        <button
          onClick={() => navigate(`/events/e/${id}`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> {t("ev.back", "Back")}
        </button>

        {/* Event summary */}
        <div className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h1 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {event.title}
          </h1>
          <div className="flex items-center gap-2 text-xs text-primary font-semibold">
            <ClipboardList className="w-3.5 h-3.5" /> {t("apply.request_join", "Request to join")}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {t("apply.host_reviews", "The host reviews requests in their dashboard. If payment is required, your card is authorized first and only charged if you're approved.")}
          </p>
        </div>

        {!user?.id && (
          <div className={`rounded-2xl bg-card border p-5 mb-4 ${nameError ? "border-destructive" : "border-border"}`}>
            <h2 className="text-sm font-bold text-foreground">Your name</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">We’ll save your progress under this name. You’ll choose Google or Email on the next screen.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Input
                value={guestFirstName}
                onChange={(event) => {
                  setNameError("");
                  const next = event.target.value;
                  setGuestFirstName(next);
                  captureContact({ name: [next.trim(), guestLastName.trim()].filter(Boolean).join(" ") });
                }}
                autoComplete="given-name"
                placeholder="First name"
                className="min-w-0 bg-secondary border-border"
              />
              <Input
                value={guestLastName}
                onChange={(event) => {
                  setNameError("");
                  const next = event.target.value;
                  setGuestLastName(next);
                  captureContact({ name: [guestFirstName.trim(), next.trim()].filter(Boolean).join(" ") });
                }}
                autoComplete="family-name"
                placeholder="Last name"
                className="min-w-0 bg-secondary border-border"
              />
            </div>
            {nameError && <p className="mt-2 text-xs font-semibold text-destructive">{nameError}</p>}
          </div>
        )}

        {/* Form */}
        <div className="rounded-2xl bg-card border border-border p-5 mb-6">
          <h2 className="text-sm font-bold text-foreground mb-4">{form?.title || "Application"}</h2>
          {form && (
            <ApplicationFormRenderer
              questions={form.questions}
              initialAnswers={draft?.answers}
              onAnswersChange={setLiveAnswers}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitLabel={t("common.next", "Next")}
            />
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
