/**
 * EventLinkedJobs — Shows linked jobs on the public EventDetail page.
 * Displays a summary with price range and "I'm Interested" button.
 */
import { useState, useEffect } from "react";
import { Briefcase, MapPin, Calendar, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@evt/integrations/supabase/client";
import { useAuth } from "@evt/hooks/useAuth";
import { toast } from "sonner";
import { notifySmsNewMessage } from "@evt/lib/notifySms";
import { useNavigate } from "react-router-dom";
import { cn } from "@evt/lib/utils";
import { startConversation } from "@oneworld/shell";

interface LinkedJobDisplay {
  id: string;
  title: string;
  location: string | null;
  pay_range: string | null;
  category: string | null;
  start_date: string | null;
  user_id: string;
}

interface Props {
  eventId: string;
  eventTitle: string;
  hostId: string;
}

export default function EventLinkedJobs({ eventId, eventTitle, hostId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<LinkedJobDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: links } = await supabase
        .from("job_event_links")
        .select("job_id")
        .eq("event_id", eventId);

      if (!links || links.length === 0) { setLoading(false); return; }

      const jobIds = links.map(l => l.job_id);
      const { data: jobData } = await supabase
        .from("jobs")
        .select("id, title, location, pay_range, category, start_date, user_id")
        .in("id", jobIds)
        .in("status", ["live", "published"]);

      setJobs(jobData || []);
      setLoading(false);
    };
    fetch();
  }, [eventId]);

  const handleInterest = async (job: LinkedJobDisplay) => {
    if (!user) {
      toast.error("Please sign in to express interest");
      return;
    }
    if (user.id === job.user_id) {
      toast("This is your own job posting");
      return;
    }

    setSendingInterest(job.id);
    try {
      /* ── ONE DOOR FOR STARTING A CHAT (10 Oct 2026) ──────────────────────────────────────
         The old lookup pulled EVERY conversation this member has and scanned it in the browser
         for one containing the other person — which also matched group threads — then inserted
         with `is_request: false` hard-coded. That last part is the subtle one: `is_request`
         means "a message from somebody you do not know yet", and forcing it false puts a cold
         approach straight into a stranger's main inbox. The shell computes it from a real
         accepted connection. */
      const messageContent = `Hi! I'm interested in the "${job.title}" position linked to the "${eventTitle}" event. I'd love to learn more about this opportunity.`;

      const started = await startConversation(user.id, job.user_id, messageContent, {
        messageType: "job_interest",
        metadata: {
          job_interest: {
            job_id: job.id,
            job_title: job.title,
            event_id: eventId,
            event_title: eventTitle,
            pay_range: job.pay_range,
            location: job.location,
          },
        },
        conversationMetadata: { created_by: user.id, source: "event_job_interest" },
      });
      if ("error" in started) throw new Error(started.error);
      const conversationId = started.conversationId;
      notifySmsNewMessage({ recipientId: job.user_id, senderId: user.id, messagePreview: `Interested in: ${job.title}`, messageType: "job_offer" });

      toast.success("Interest sent! Check your messages.");
      navigate("/events/messages");
    } catch (err: any) {
      toast.error("Failed to send: " + (err.message || "Unknown error"));
    } finally {
      setSendingInterest(null);
    }
  };

  if (loading) return null;
  if (jobs.length === 0) return null;

  return (
    <div className="rounded-2xl p-6 bg-card border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Available Positions</h2>
        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
          {jobs.length} {jobs.length === 1 ? "role" : "roles"}
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        The host is hiring for this event. Express interest and they'll send you the details.
      </p>

      <div className="space-y-3">
        {jobs.map(job => (
          <div
            key={job.id}
            className="rounded-xl border border-border/60 p-4 bg-secondary/20 hover:bg-secondary/40 transition-colors"
>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Briefcase className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{job.title}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                  {job.location && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                  )}
                  {job.pay_range && (
                    <span className="flex items-center gap-1 text-primary font-medium">{job.pay_range}</span>
                  )}
                  {job.start_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(job.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleInterest(job)}
              disabled={sendingInterest === job.id || !user || user.id === job.user_id}
              className={cn(
                "mt-3 w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all",
                "border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
>
              {sendingInterest === job.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" />
              )}
              {sendingInterest === job.id ? "Sending..." : "I'm Interested — Message Host"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
