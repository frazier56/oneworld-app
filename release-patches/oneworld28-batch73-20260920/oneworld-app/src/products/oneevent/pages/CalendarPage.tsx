import { ScreenHeading } from "@oneworld/shell";
import { supabase } from "@evt/lib/supabase";
import { useAuth } from "@evt/hooks/useAuth";
/* v11 (18 Aug 2026): straight to useLanguage — the @evt/lib/i18n wrapper folds the seven
   shell languages down to en/es (the dead-flag bug's third layer). cal.* keys ride the
   OneEvent dictionary in all seven languages, and `locale` formats dates to match. */
import { useLanguage } from "@evt/i18n/LanguageContext";
import { useEffect, useState } from "react";

export default function CalendarPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();

  /* react-query is not part of this stack (the shell replaced it with plain effects —
     resolve.dedupe's duplicate-package lesson). Same fetch, no cache layer. */
  type CalItem = { id: string; title: string; start: string; end: string; kind: string };
  const [items, setItems] = useState<CalItem[] | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const now = new Date().toISOString();
      const [ev, ex] = await Promise.all([
        supabase.from("calendar_events").select("id, title, start_at, end_at").eq("user_id", user!.id).gte("end_at", now).order("start_at").limit(20),
        supabase.from("job_executions").select("id, scheduled_start, scheduled_end, status, host_id, talent_id")
          .or(`host_id.eq.${user!.id},talent_id.eq.${user!.id}`).gte("scheduled_end", now).order("scheduled_start").limit(20),
      ]);
      const a = (ev.data ?? []).map(e => ({ id: "e" + e.id, title: e.title, start: e.start_at, end: e.end_at, kind: "event" }));
      const b = (ex.data ?? []).map(e => ({ id: "x" + e.id, title: `Job (${e.status})`, start: e.scheduled_start, end: e.scheduled_end, kind: "job" }));
      const merged = [...a, ...b].sort((p, q) => p.start.localeCompare(q.start));
      if (alive) setItems(merged);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const fmt = (s: string) => new Date(s).toLocaleString(locale, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-3">
      <ScreenHeading>{t("cal.title", "Calendar")}</ScreenHeading>
      <h2 className="font-bold opacity-60">{t("cal.upcoming", "Upcoming")}</h2>
      {!items?.length ? <p className="py-10 text-center opacity-50">{t("cal.none", "Nothing scheduled yet.")}</p> :
        items.map((i: CalItem) => (
          <div key={i.id} className="card flex items-center gap-3 p-4">
            <span className={`h-10 w-1.5 rounded-full ${i.kind === "job" ? "bg-teal" : "bg-ink/20 dark:bg-white/20"}`} />
            <div><p className="font-semibold">{i.title}</p><p className="text-sm opacity-60">{fmt(i.start)}</p></div>
          </div>
        ))}
    </div>
  );
}
