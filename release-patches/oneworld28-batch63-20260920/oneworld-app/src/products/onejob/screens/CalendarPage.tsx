import { ScreenHeading } from "@oneworld/shell";
import { useQuery } from "@job/lib/query";
import { supabase } from "@job/lib/supabase";
import { useAuth } from "@job/hooks/useAuth";
import { useI18n } from "@job/lib/i18n";

export default function CalendarPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();

  const { data: items } = useQuery({
    queryKey: ["cal", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const now = new Date().toISOString();
      const [ev, ex] = await Promise.all([
        supabase.from("calendar_events").select("id, title, start_at, end_at").eq("user_id", user!.id).gte("end_at", now).order("start_at").limit(20),
        supabase.from("job_executions").select("id, scheduled_start, scheduled_end, status, host_id, talent_id")
          .or(`host_id.eq.${user!.id},talent_id.eq.${user!.id}`).gte("scheduled_end", now).order("scheduled_start").limit(20),
      ]);
      const a = (ev.data ?? []).map(e => ({ id: "e" + e.id, title: e.title, start: e.start_at, end: e.end_at, kind: "event" }));
      const b = (ex.data ?? []).map(e => ({ id: "x" + e.id, title: `Job (${e.status})`, start: e.scheduled_start, end: e.scheduled_end, kind: "job" }));
      return [...a, ...b].sort((p, q) => p.start.localeCompare(q.start));
    },
  });

  const fmt = (s: string) => new Date(s).toLocaleString(lang === "es" ? "es" : "en", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-3">
      <ScreenHeading>{t("calendar")}</ScreenHeading>
      <h2 className="font-bold opacity-60">{t("upcoming")}</h2>
      {!items?.length ? <p className="py-10 text-center opacity-50">{t("noEvents")}</p> :
        items.map(i => (
          <div key={i.id} className="card flex items-center gap-3 p-4">
            <span className={`h-10 w-1.5 rounded-full ${i.kind === "job" ? "bg-brand" : "bg-ink/20 dark:bg-white/20"}`} />
            <div><p className="font-semibold">{i.title}</p><p className="text-sm opacity-60">{fmt(i.start)}</p></div>
          </div>
        ))}
    </div>
  );
}
