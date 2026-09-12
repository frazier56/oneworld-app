import { ScreenHeading } from "@oneworld/shell";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@evt/lib/supabase";
import { shortLocation } from "@evt/lib/locationFormat";
import { Search, MapPin, ArrowRight, Users } from "lucide-react";
import InfoTip from "@evt/components/InfoTip";

interface HostCard {
  id: string; full_name: string | null; photo_url: string | null;
  location: string | null; category: string | null; job_title: string | null;
  score: number | null; eventCount: number;
}
type Sort = "events" | "name" | "score";

/** OneEvent — Discover Hosts. Find organizers by city, sort, and jump to a
 *  host's public profile (/p/:id) to see everything they run. Only surfaces
 *  people who have published >=1 event. */
export default function HostSearch() {
  const nav = useNavigate();
  const [hosts, setHosts] = useState<HostCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("events");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: evs } = await supabase.from("events").select("host_id").eq("status", "published");
      const counts: Record<string, number> = {};
      (evs || []).forEach((r: any) => { if (r.host_id) counts[r.host_id] = (counts[r.host_id] || 0) + 1; });
      const ids = Object.keys(counts);
      if (!ids.length) { setHosts([]); setLoading(false); return; }
      const { data: profs } = await supabase.from("profiles")
        .select("id, full_name, photo_url, location, category, job_title, score_v9_snapshot")
        .in("id", ids);
      const cards: HostCard[] = (profs || []).map((p: any) => ({
        id: p.id, full_name: p.full_name, photo_url: p.photo_url, location: p.location,
        category: p.category, job_title: p.job_title, score: p.score_v9_snapshot ?? null,
        eventCount: counts[p.id] || 0,
      }));
      setHosts(cards);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let r = [...hosts];
    if (q) { const s = q.toLowerCase(); r = r.filter(h => (h.location || "").toLowerCase().includes(s) || (h.full_name || "").toLowerCase().includes(s)); }
    r.sort((a, b) =>
      sort === "name" ? (a.full_name || "").localeCompare(b.full_name || "")
      : sort === "score" ? (b.score ?? 0) - (a.score ?? 0)
      : b.eventCount - a.eventCount);
    return r;
  }, [hosts, q, sort]);

  return (
    <div className="space-y-4">
      <ScreenHeading right={
        <InfoTip text="Find event organizers by city, then open their profile to see every event they run — current and past." />
      }>Hosts</ScreenHeading>

      {/* Search by city */}
      <div className="flex items-center gap-2 rounded-xl border border-ink/25 bg-ink/[0.025] px-3.5 py-2.5 dark:border-white/20 dark:bg-white/5">
        <Search size={18} className="opacity-50" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by city or name…" className="flex-1 bg-transparent text-sm outline-none" />
      </div>

      {/* Sort */}
      <div className="flex gap-2">
        {([["events", "Most events"], ["score", "Top rated"], ["name", "A–Z"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${sort === k ? "bg-teal text-white" : "border border-ink/10 dark:border-white/15"}`}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="card grid place-items-center gap-2 !rounded-3xl py-14 text-center">
          <Users size={40} className="opacity-40" />
          <p className="font-bold">No hosts found</p>
          <p className="text-sm opacity-60">Try a different city or check back soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(h => (
            <button key={h.id} onClick={() => nav(`/events/p/${h.id}`)} className="card flex w-full items-center gap-3 !rounded-3xl p-3 text-left transition active:scale-[.99]">
              {h.photo_url
                ? <img src={h.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand/15 text-xl font-bold text-brand">{h.full_name?.[0]?.toUpperCase() ?? "?"}</div>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold leading-tight">{h.full_name || "Host"}</p>
                <p className="truncate text-xs opacity-60">{h.category || h.job_title || "Event host"}</p>
                <p className="mt-0.5 flex items-center gap-3 text-xs opacity-70">
                  {h.location && <span className="flex items-center gap-1 truncate"><MapPin size={12} className="text-brand" />{shortLocation(h.location)}</span>}
                  <span className="shrink-0 font-semibold text-brand">{h.eventCount} event{h.eventCount === 1 ? "" : "s"}</span>
                </p>
              </div>
              <ArrowRight size={18} className="text-brand" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
