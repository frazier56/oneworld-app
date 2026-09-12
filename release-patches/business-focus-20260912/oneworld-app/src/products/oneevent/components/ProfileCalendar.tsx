import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@evt/lib/supabase";
import { Calendar, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import InfoTip from "@evt/components/InfoTip";

interface CalEv { id: string; title: string; date: Date; location: string | null; kind: "hosted" | "ticketed"; }

/** Profile calendar (Lee, Jul16): glass month grid with dots on days that have
 *  an event you host (teal) or hold a ticket for (amber). Tap a day to see that
 *  day's events; tap an event to open it. Reuses the family MiniCalendar visual
 *  language with day-level interactivity added. */
export default function ProfileCalendar({ userId }: { userId: string }) {
  const nav = useNavigate();
  const [events, setEvents] = useState<CalEv[]>([]);
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: hosted }, { data: regs }] = await Promise.all([
        supabase.from("events").select("id, title, start_date, location, venue_name").eq("host_id", userId),
        supabase.from("event_registrations").select("event_id, events!event_registrations_event_id_fkey(id, title, start_date, location, venue_name)").eq("user_id", userId),
      ]);
      const out: CalEv[] = [];
      (hosted || []).forEach((e: any) => { if (e.start_date) out.push({ id: e.id, title: e.title, date: new Date(e.start_date), location: e.venue_name || e.location, kind: "hosted" }); });
      (regs || []).forEach((r: any) => { const e = r.events; if (e?.start_date) out.push({ id: e.id, title: e.title, date: new Date(e.start_date), location: e.venue_name || e.location, kind: "ticketed" }); });
      setEvents(out);
    })();
  }, [userId]);

  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = useMemo(() => {
    const m: Record<string, CalEv[]> = {};
    events.forEach(e => { const k = key(e.date); (m[k] ||= []).push(e); });
    return m;
  }, [events]);

  const y = cursor.getFullYear(), mo = cursor.getMonth();
  const firstDow = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === y && today.getMonth() === mo && today.getDate() === d;
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selEvents = selected ? (byDay[selected] || []) : [];

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">Calendar
          <InfoTip text="Days with a dot have an event. Teal = you're hosting, amber = you hold a ticket. Tap a day to see what's on." /></h2>
        <div className="flex items-center gap-1">
          <button aria-label="Previous month" onClick={() => { setSelected(null); setCursor(new Date(y, mo - 1, 1)); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-teal/10"><ChevronLeft size={18} /></button>
          <span className="min-w-[8.5rem] text-center text-sm font-semibold">{monthLabel}</span>
          <button aria-label="Next month" onClick={() => { setSelected(null); setCursor(new Date(y, mo + 1, 1)); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-teal/10"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase opacity-40">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center text-sm">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = `${y}-${mo}-${d}`;
          const dayEvents = byDay[k] || [];
          const hosted = dayEvents.some(e => e.kind === "hosted");
          const ticketed = dayEvents.some(e => e.kind === "ticketed");
          const sel = selected === k;
          return (
            <button key={i} onClick={() => setSelected(dayEvents.length ? (sel ? null : k) : null)}
              className={`relative grid h-9 place-items-center rounded-lg transition ${sel ? "bg-teal text-white" : isToday(d) ? "bg-teal/15 font-bold text-teal" : dayEvents.length ? "hover:bg-teal/10" : ""}`}>
              {d}
              {dayEvents.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {hosted && <span className={`h-1 w-1 rounded-full ${sel ? "bg-white" : "bg-teal"}`} />}
                  {ticketed && <span className={`h-1 w-1 rounded-full ${sel ? "bg-white" : "bg-amber-400"}`} />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 space-y-2 border-t border-ink/10 pt-3 dark:border-white/10">
          {selEvents.length === 0 ? (
            <p className="text-sm opacity-60">No events this day.</p>
          ) : selEvents.map(e => (
            <button key={e.id + e.kind} onClick={() => nav(`/events/e/${e.id}`)} className="flex w-full items-center gap-3 rounded-xl border border-ink/10 p-2.5 text-left transition hover:bg-teal/5 dark:border-white/10">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${e.kind === "hosted" ? "bg-teal/15 text-teal" : "bg-amber-400/15 text-amber-500"}`}><Calendar size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{e.title}</p>
                <p className="flex items-center gap-2 text-xs opacity-60">
                  <span>{e.date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  {e.location && <span className="flex items-center gap-1 truncate"><MapPin size={11} />{e.location}</span>}
                  <span className="shrink-0 font-medium">{e.kind === "hosted" ? "Hosting" : "Ticket"}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
