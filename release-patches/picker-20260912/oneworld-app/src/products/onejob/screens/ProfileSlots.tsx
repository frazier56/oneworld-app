import { Link } from "react-router-dom";
import { useOneId, useAsync, supabase } from "@oneworld/shell";
import { IconBriefcase, IconStar, IconSearch, IconCalendar } from "@job/components/ActionIcons";
import { useI18n } from "@job/lib/i18n";
import MiniCalendar from "@job/components/MiniCalendar";

/**
 * ONEJOB'S PROFILE SLOTS — the app-specific holes in the SHARED ProfileScreen.
 * ============================================================================================
 * `ProfileScreen` (shell) owns everything identical across the five apps: avatar, name, title,
 * location, the OneScore ring, complete-your-profile, My World, the Reputation Passport,
 * connected platforms, bio, the public-profile switches and the actions row. It is NOT rebuilt
 * here — this file supplies only the three holes it leaves, lifted from the 5-Aug OneJob
 * ProfilePage so the tiles, the numbers and the calendar are the ones Lee already signed off:
 *
 *   tilesSlot     → My jobs · Reviews · Find work · Hire      (the 2×2 block, with live badges)
 *   statsSlot     → Jobs completed · Hires made · Reviews     (each one a DOOR, not a dead card)
 *   calendarSlot  → the month strip with job and event days marked
 *
 * Every number is a counted row, never an estimate, and every count is a `head: true` COUNT —
 * no row data crosses the wire for a number on a screen. `profiles` is column-granted, so
 * nothing here selects `*`.
 */

/* One tile. Same `.tile` class the rest of the family uses — the look is the shell's. */
function Tile({ to, icon, label, badge, urgent }:
  { to: string; icon: React.ReactNode; label: string; badge?: number; urgent?: boolean }) {
  return (
    <Link to={to} className="tile">
      <div className="flex w-full items-start justify-between">
        <span className="grid place-items-center text-brand">{icon}</span>
        {!!badge && (
          <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-extrabold text-white ${urgent ? "bg-red-500" : "bg-brand-deep"}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="mt-2 font-bold leading-tight">{label}</p>
    </Link>
  );
}

/** What the profile's tiles need to know: how much is waiting, and which days are busy. */
function useJobCounts() {
  const { userId } = useOneId();
  return useAsync(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59).toISOString();
    const [recv, sent, act, revs, ex, ev] = await Promise.all([
      supabase.from("agreements").select("id", { count: "exact", head: true })
        .eq("recipient_id", userId!).in("status", ["sent", "pending"]),
      supabase.from("agreements").select("id", { count: "exact", head: true })
        .eq("sender_id", userId!).in("status", ["sent", "pending"]),
      supabase.from("job_executions").select("id", { count: "exact", head: true })
        .or(`host_id.eq.${userId},talent_id.eq.${userId}`).in("status", ["scheduled", "in_progress", "active"]),
      supabase.from("job_reviews").select("id", { count: "exact", head: true }).eq("reviewee_id", userId!),
      supabase.from("job_executions").select("scheduled_start")
        .or(`host_id.eq.${userId},talent_id.eq.${userId}`)
        .gte("scheduled_start", monthStart).lte("scheduled_start", monthEnd),
      supabase.from("calendar_events").select("start_at").eq("user_id", userId!)
        .gte("start_at", monthStart).lte("start_at", monthEnd),
    ]);
    return {
      received: recv.count ?? 0, awaiting: sent.count ?? 0, active: act.count ?? 0, reviews: revs.count ?? 0,
      jobDays: [...new Set((ex.data ?? []).map(r => new Date(r.scheduled_start).getDate()))],
      eventDays: [...new Set((ev.data ?? []).map(r => new Date(r.start_at).getDate()))],
    };
  }, [userId], !!userId);
}

/** Quick tiles. The badge on My jobs turns RED when something is waiting on YOU. */
export function JobTiles() {
  const { t } = useI18n();
  const counts = useJobCounts();
  const waiting = (counts?.received ?? 0) + (counts?.awaiting ?? 0) + (counts?.active ?? 0);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile to="/jobs/jobs" icon={<IconBriefcase size={20} />} label={t("myJobs")}
            badge={waiting} urgent={(counts?.received ?? 0) > 0} />
      <Tile to="/jobs/reviews" icon={<IconStar size={20} />} label={t("reviews")} badge={counts?.reviews} />
      <Tile to="/jobs/find" icon={<IconSearch size={20} />} label={t("findWork")} />
      <Tile to="/jobs/find?tab=pros" icon={<IconBriefcase size={20} />} label={t("findPros")} />
    </div>
  );
}

/**
 * The three numbers — and each one is a DOOR.
 *
 * Lee, 1 Aug 2026: *"those should be links. Jobs completed should actually take you to My jobs
 * filtered on completed."* A number somebody cares about, rendered as a dead card, is a dead end
 * at exactly the moment they are curious — and "0 reviews" is the one most likely to be doubted,
 * so it had better be inspectable.
 */
export function JobStats() {
  const { t } = useI18n();
  const { userId } = useOneId();
  const stats = useAsync(async () => {
    const [done, hired, revs] = await Promise.all([
      supabase.from("job_executions").select("id", { count: "exact", head: true })
        .eq("talent_id", userId!).eq("status", "completed"),
      supabase.from("job_executions").select("id", { count: "exact", head: true })
        .eq("host_id", userId!).eq("status", "completed"),
      supabase.from("job_reviews").select("id", { count: "exact", head: true }).eq("reviewee_id", userId!),
    ]);
    return { done: done.count ?? 0, hired: hired.count ?? 0, reviews: revs.count ?? 0 };
  }, [userId], !!userId);

  const CELLS: { value: number | null; label: string; to: string }[] = [
    { value: stats?.done ?? null, label: t("jobsDone"), to: "/jobs/jobs?tab=completed&role=working" },
    { value: stats?.hired ?? null, label: t("hiredCount"), to: "/jobs/jobs?tab=completed&role=hiring" },
    { value: stats?.reviews ?? null, label: t("reviews"), to: "/jobs/reviews" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      {CELLS.map(c => (
        <Link key={c.label} to={c.to} className="card p-3 transition active:scale-[.97]">
          {/* A count that has not arrived yet reads "—", never a fake 0. */}
          <p className="text-xl font-extrabold text-brand">{c.value ?? "—"}</p>
          <p className="text-xs opacity-60">{c.label}</p>
        </Link>
      ))}
    </div>
  );
}

/** The month strip. Job days wear the product hue, event days amber — OneJob's calendar
 *  integrates both, which is why the slot exists at all (Score and Social pass none). */
export function JobCalendar() {
  const { t } = useI18n();
  const counts = useJobCounts();
  return (
    <Link to="/jobs/calendar" className="tile block">
      <div className="mb-2 flex w-full items-center justify-between">
        <p className="flex items-center gap-2 font-bold">
          <IconCalendar size={17} className="text-brand-deep dark:text-brand-light" />{t("calendar")}
        </p>
        <span className="text-brand">→</span>
      </div>
      <MiniCalendar jobDays={counts?.jobDays ?? []} eventDays={counts?.eventDays ?? []} />
    </Link>
  );
}
