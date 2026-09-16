/**
 * LinkJobsToEvent — Search and link existing jobs to an event.
 * Used in the EventManagement "Jobs" tab.
 */
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, X, Briefcase, MapPin, DollarSign, Loader2, Unlink } from "lucide-react";
import { supabase } from "@evt/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@evt/lib/utils";

interface LinkedJob {
  id: string;
  job_id: string;
  title: string;
  location: string | null;
  pay_range: string | null;
  status: string;
  category: string | null;
  start_date: string | null;
}

interface SearchJob {
  id: string;
  title: string;
  location: string | null;
  pay_range: string | null;
  status: string;
  category: string | null;
  start_date: string | null;
}

interface Props {
  eventId: string;
  hostId: string;
  currentUserId: string;
}

export default function LinkJobsToEvent({ eventId, hostId, currentUserId }: Props) {
  const [linkedJobs, setLinkedJobs] = useState<LinkedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  const isOwner = currentUserId === hostId;

  const fetchLinkedJobs = useCallback(async () => {
    const { data: links } = await supabase
      .from("job_event_links")
      .select("id, job_id")
      .eq("event_id", eventId);

    if (!links || links.length === 0) {
      setLinkedJobs([]);
      setLoading(false);
      return;
    }

    const jobIds = links.map(l => l.job_id);
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, title, location, pay_range, status, category, start_date")
      .in("id", jobIds);

    setLinkedJobs((jobs || []).map(j => {
      const link = links.find(l => l.job_id === j.id);
      return { ...j, job_id: j.id, id: link?.id || j.id };
    }));
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchLinkedJobs(); }, [fetchLinkedJobs]);

  // Search user's own jobs
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("jobs")
        .select("id, title, location, pay_range, status, category, start_date")
        .eq("user_id", currentUserId)
        .ilike("title", `%${searchQuery}%`)
        .limit(10);

      // Filter out already linked
      const linkedIds = new Set(linkedJobs.map(j => j.job_id));
      setSearchResults((data || []).filter(j => !linkedIds.has(j.id)));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId, linkedJobs]);

  const handleLink = async (job: SearchJob) => {
    setLinking(job.id);
    const { error } = await supabase.from("job_event_links").insert({
      job_id: job.id,
      event_id: eventId,
      linked_by: currentUserId,
    } as any);

    if (error) {
      toast.error("Failed to link job");
    } else {
      toast.success(`"${job.title}" linked to this event`);
      setSearchQuery("");
      setSearchResults([]);
      fetchLinkedJobs();
    }
    setLinking(null);
  };

  const handleUnlink = async (linkId: string, jobTitle: string) => {
    const { error } = await supabase.from("job_event_links").delete().eq("id", linkId);
    if (error) {
      toast.error("Failed to unlink job");
    } else {
      toast.success(`"${jobTitle}" unlinked`);
      fetchLinkedJobs();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — v18 (Lee): the button was crushed into a three-line wrap beside the
          intro text. Text gets the full width; the actions sit on their own row below.

          "Create a Job" opens OneJob's feed composer with this event id in the URL. That route
          creates a discoverable jobs row and then writes the job_event_links row, so the host does
          not have to come back here and search for the job they just made. */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Linked Jobs</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Connect job postings to this event so attendees can discover available opportunities.
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
                showSearch
                  ? "bg-secondary text-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {showSearch ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showSearch ? "Cancel" : "Link a Job"}
            </button>
            {!showSearch && (
              <a
                href={`/jobs?mode=write&event=${encodeURIComponent(eventId)}`}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap bg-secondary border border-border text-foreground hover:bg-primary/10 transition-all"
              >
                <Plus className="w-4 h-4" /> Create a Job
              </a>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      {showSearch && (
        <div className="rounded-2xl border border-primary/20 p-5 bg-card">
          <div className="flex items-center gap-3 px-4 h-12 rounded-xl bg-secondary/50 border border-border mb-3">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search your job postings..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
              autoFocus
            />
          </div>

          <div className="rounded-xl overflow-hidden bg-secondary/30 border border-border max-h-60 overflow-y-auto">
            {searching ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {searchQuery.length >= 2 ? "No matching jobs found" : "Type at least 2 characters"}
              </div>
            ) : (
              searchResults.map(job => (
                <button
                  key={job.id}
                  onClick={() => handleLink(job)}
                  disabled={linking === job.id}
                  className="w-full flex items-center gap-3 p-3 transition-all text-left hover:bg-secondary/60 border-b border-border/50 last:border-b-0 disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {job.location || "Remote"} · {job.pay_range || "Rate TBD"}
                    </p>
                  </div>
                  {linking === job.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <Plus className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Linked Jobs List */}
      {linkedJobs.length === 0 ? (
        <div className="p-12 rounded-2xl text-center bg-secondary/50 border border-border">
          <Briefcase className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No jobs linked to this event yet.</p>
          {isOwner && <p className="text-xs text-muted-foreground/60 mt-1">Click "Link a Job" to connect your job postings.</p>}
        </div>
      ) : (
        <div className="grid gap-3">
          {linkedJobs.map(job => (
            <div key={job.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{job.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>}
                  {job.pay_range && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {job.pay_range}</span>}
                </div>
              </div>
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-semibold uppercase",
                job.status === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
              )}>
                {job.status}
              </span>
              {isOwner && (
                <button
                  onClick={() => handleUnlink(job.id, job.title)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Unlink job"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
