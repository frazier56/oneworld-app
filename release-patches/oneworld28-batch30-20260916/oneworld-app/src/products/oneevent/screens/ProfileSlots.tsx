/**
 * PROFILE SLOTS — the app-specific holes in the shared ProfileScreen (/events/profile).
 * ============================================================================================
 * Tiles: My events (→ /events/events) · My tickets (→ /events/tickets), as .tile cards.
 * Stats: Events hosted · Tickets sold · Reviews. Counts are cheap: a head-count on `events`
 * and a ga_sold/vip_sold sum off the host's own rows — both columns the hub already reads.
 * There is NO reviews table anywhere in the ported OneEvent code, so that stat renders
 * WITHOUT a number ("—") rather than invent a table name (the honest-dash rule).
 * Calendar: the next 3 upcoming items, the same calendar_events + job_executions fetch
 * CalendarPage runs, linking through to /events/calendar.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Ticket } from "lucide-react";
import { supabase } from "@evt/lib/supabase";
import { useAuth } from "@evt/hooks/useAuth";
import { useI18n } from "@evt/lib/i18n";

export default function ProfileTiles() {
  const { t } = useI18n();
  return (
    <section className="grid grid-cols-2 gap-2">
      <Link to="/events/events" className="tile !rounded-2xl">
        <Calendar size={20} className="text-brand" />
        <span className="text-[13px] font-bold leading-tight">{t("myEventsTile")}</span>
      </Link>
      <Link to="/events/tickets" className="tile !rounded-2xl">
        <Ticket size={20} className="text-brand" />
        <span className="text-[13px] font-bold leading-tight">{t("myTicketsTile")}</span>
      </Link>
    </section>
  );
}

export function ProfileStats() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [hostedN, setHostedN] = useState<number | null>(null);
  const [soldN, setSoldN] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const [{ count, error: cErr }, { data: soldRows, error: sErr }] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true })
          .eq("host_id", user.id).eq("status", "published"),
        supabase.from("events").select("ga_sold, vip_sold").eq("host_id", user.id),
      ]);
      if (!alive) return;
      if (cErr) console.error("[oneevent] hosted count failed:", cErr); else setHostedN(count ?? 0);
      if (sErr) console.error("[oneevent] sold sum failed:", sErr);
      else setSoldN((soldRows || []).reduce((n, r: any) => n + (r.ga_sold || 0) + (r.vip_sold || 0), 0));
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const stats: { label: string; value: number | null }[] = [
    { label: t("statEventsHosted"), value: hostedN },
    { label: t("statTicketsSold"), value: soldN },
    /* No OneEvent reviews table exists in the ported code — numberless, honestly. */
    { label: t("statReviews"), value: null },
  ];

  return (
    <section className="card grid grid-cols-3 gap-2 !rounded-2xl text-center">
      {stats.map(s => (
        <div key={s.label}>
          <p className="text-xl font-extrabold">{s.value ?? "—"}</p>
          <p className="text-[12px] opacity-60">{s.label}</p>
        </div>
      ))}
    </section>
  );
}

export function ProfileCalendarSlot() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  type CalItem = { id: string; title: string; start: string; kind: string };
  const [next, setNext] = useState<CalItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      /* Same two queries CalendarPage runs, capped to what the card shows. */
      const now = new Date().toISOString();
      const [ev, ex] = await Promise.all([
        supabase.from("calendar_events").select("id, title, start_at, end_at")
          .eq("user_id", user.id).gte("end_at", now).order("start_at").limit(3),
        supabase.from("job_executions").select("id, scheduled_start, scheduled_end, status, host_id, talent_id")
          .or(`host_id.eq.${user.id},talent_id.eq.${user.id}`).gte("scheduled_end", now).order("scheduled_start").limit(3),
      ]);
      const a = (ev.data ?? []).map(e => ({ id: "e" + e.id, title: e.title, start: e.start_at, kind: "event" }));
      const b = (ex.data ?? []).map(e => ({ id: "x" + e.id, title: `Job (${e.status})`, start: e.scheduled_start, kind: "job" }));
      if (!alive) return;
      setNext([...a, ...b].sort((p, q) => p.start.localeCompare(q.start)).slice(0, 3));
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  if (!loaded || next.length === 0) return null;

  const fmt = (s: string) =>
    new Date(s).toLocaleString(lang === "es" ? "es" : "en", {
      weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <section className="card !rounded-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{t("upcoming")}</h2>
        <Link to="/events/calendar" className="text-[13px] font-bold text-brand">{t("calendar")}</Link>
      </div>
      <div className="mt-2 space-y-2">
        {next.map(i => (
          <Link key={i.id} to="/events/calendar"
                className="ow-tap flex items-center gap-3 rounded-xl border border-ink/10 px-3 py-2.5 dark:border-white/15">
            <span className="w-1 self-stretch rounded-full bg-brand" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold">{i.title}</p>
              <p className="text-[12.5px] opacity-60">{fmt(i.start)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
