/**
 * LinkJobToMyEvent — v21 BZ (Lee, 18 Aug 2026): the OneJob half of the two-way
 * event↔job link. On the owner's own job posting: shows which of their OneEvent
 * events this job is linked to, plus a dropdown of their events to link another.
 * The OneEvent side (LinkJobsToEvent) searches jobs from the event; this is the
 * mirror — pick an event from the job. Same job_event_links table, RLS lets the
 * job owner OR the event host create/delete a link (linked_by = auth.uid()).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@job/lib/supabase";

interface EventRow { id: string; title: string; start_date: string | null; status: string }
interface LinkRow { id: string; event_id: string }

export default function LinkJobToMyEvent({ jobId, userId }: { jobId: string; userId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: ev }, { data: ln }] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, start_date, status")
        .eq("host_id", userId)
        .in("status", ["published", "draft"])
        .order("start_date", { ascending: true }),
      supabase.from("job_event_links").select("id, event_id").eq("job_id", jobId),
    ]);
    setEvents((ev || []) as EventRow[]);
    setLinks((ln || []) as LinkRow[]);
  }, [jobId, userId]);

  useEffect(() => { void load(); }, [load]);

  const linkedIds = new Set(links.map((l) => l.event_id));
  const linkable = events.filter((e) => !linkedIds.has(e.id));

  const link = async () => {
    if (!chosen) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase
      .from("job_event_links")
      .insert({ job_id: jobId, event_id: chosen, linked_by: userId });
    setBusy(false);
    if (error) { setMsg("Could not link — try again."); return; }
    setChosen("");
    setMsg("Linked — attendees of that event can now discover this job.");
    void load();
  };

  const unlink = async (linkId: string) => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("job_event_links").delete().eq("id", linkId);
    setBusy(false);
    if (error) { setMsg("Could not unlink — try again."); return; }
    void load();
  };

  return (
    <div className="card space-y-3 p-5">
      <div>
        <h2 className="font-bold">Link this job to your event</h2>
        <p className="mt-0.5 text-xs opacity-60">
          Linked jobs show on the event's Jobs tab, so attendees can discover the work.
          {events.length === 0 ? " Create an event in OneEvent first and it will appear here." : ""}
        </p>
      </div>

      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((l) => {
            const ev = events.find((e) => e.id === l.event_id);
            return (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm dark:border-white/15">
                <span className="min-w-0 truncate font-semibold">{ev?.title || "Linked event"}</span>
                <button onClick={() => unlink(l.id)} disabled={busy}
                  className="shrink-0 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-bold opacity-70 transition hover:opacity-100 disabled:opacity-40 dark:border-white/20">
                  Unlink
                </button>
              </div>
            );
          })}
        </div>
      )}

      {linkable.length > 0 && (
        <div className="flex gap-2">
          <select value={chosen} onChange={(e) => setChosen(e.target.value)}
            className="input min-w-0 flex-1">
            <option value="">Choose an event…</option>
            {linkable.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}{e.start_date ? ` — ${new Date(e.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}{e.status === "draft" ? " (draft)" : ""}
              </option>
            ))}
          </select>
          <button onClick={link} disabled={!chosen || busy} className="btn-primary shrink-0 whitespace-nowrap px-4">
            {busy ? "…" : "Link"}
          </button>
        </div>
      )}

      {msg && <p className="text-xs opacity-70">{msg}</p>}
    </div>
  );
}
